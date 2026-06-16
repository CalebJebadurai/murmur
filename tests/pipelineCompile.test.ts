import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { loadIR } from "../src/schema/load.ts";
import { getAdapter } from "../src/compiler/registry.ts";
import { compileTarget } from "../src/compiler/compile.ts";
import type { CompileContext, RuntimeCompiler } from "../src/compiler/RuntimeCompiler.ts";
import { DEFAULT_CONFIG } from "../src/schema/index.ts";

const MURMUR_DIR = join(import.meta.dir, "..", "murmur");

async function freshOut(): Promise<string> {
  return join(tmpdir(), `murmur-pipe-${crypto.randomUUID()}`);
}

describe("Copilot pipeline compilation", () => {
  test("emits a master agent whose roster is the union of referenced agents, with advisory prose", async () => {
    const res = await loadIR(MURMUR_DIR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ctx: CompileContext = { config: DEFAULT_CONFIG, ir: res.value };
    const out = await freshOut();
    try {
      await compileTarget(getAdapter("copilot")!, ctx, out);
      const md = await Bun.file(join(out, ".github/agents/architect.agent.md")).text();
      // union roster present in frontmatter
      expect(md).toContain("agents:");
      expect(md).toContain("planner");
      expect(md).toContain("research-critic");
      // builtin Explore is NOT in the roster
      expect(md).not.toContain("- Explore");
      // advisory marker + branch sections + tables
      expect(md).toContain("advisory");
      expect(md).toContain("## Branch: coding");
      expect(md).toContain("## Branch: research");
      expect(md).toContain("| Loop | From | To | Min | Max | Early exit |");
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});

describe("goose pipeline compilation", () => {
  test("emits a recipe with sub_recipes and declared advisory degradation", async () => {
    const res = await loadIR(MURMUR_DIR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ctx: CompileContext = { config: { ...DEFAULT_CONFIG, project: { name: "demo" } }, ir: res.value };
    const out = await freshOut();
    try {
      await compileTarget(getAdapter("goose")!, ctx, out);
      const yaml = await Bun.file(join(out, "recipes/architect.yaml")).text();
      expect(yaml).toContain("title: architect");
      expect(yaml).toContain("sub_recipes:");
      expect(yaml).toContain("- name: planner");
      // declared degradation: advisory, not enforced
      expect(yaml).toContain("murmur_advisory");
      expect(yaml).toContain("sequence:");
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});

describe("pipeline compile atomicity", () => {
  test("a throw inside compilePipeline leaves the output tree untouched", async () => {
    const res = await loadIR(MURMUR_DIR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ctx: CompileContext = { config: DEFAULT_CONFIG, ir: res.value };
    const out = await freshOut();
    const exploding: RuntimeCompiler = {
      id: "explode",
      compileAgent: () => [],
      compileSubagent: () => [],
      compileSkill: () => [],
      compileInstruction: () => [],
      compilePipeline() {
        throw new Error("boom");
      },
    };
    try {
      await expect(compileTarget(exploding, ctx, out)).rejects.toThrow("boom");
      expect(await Bun.file(join(out, ".github")).exists()).toBe(false);
      expect(await Bun.file(join(out, "recipes")).exists()).toBe(false);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});
