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
  const dir = join(tmpdir(), `murmur-test-${crypto.randomUUID()}`);
  return dir;
}

describe("IR loading", () => {
  test("loads the hand-authored base IR without errors", async () => {
    const res = await loadIR(MURMUR_DIR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.agents.length).toBeGreaterThanOrEqual(4);
    expect(res.value.subagents.length).toBeGreaterThanOrEqual(1);
    expect(res.value.skills.length).toBeGreaterThanOrEqual(3);
    expect(res.value.instructions.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Copilot adapter golden output", () => {
  test("emits .github/agents and instructions with required frontmatter", async () => {
    const res = await loadIR(MURMUR_DIR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ctx: CompileContext = { config: DEFAULT_CONFIG, ir: res.value };
    const out = await freshOut();
    try {
      await compileTarget(getAdapter("copilot")!, ctx, out);
      const master = await Bun.file(
        join(out, ".github/agents/master.agent.md"),
      ).text();
      expect(master).toContain("description:");
      expect(master).toContain("# Master");
      const instr = await Bun.file(
        join(out, ".github/instructions/typescript-conventions.instructions.md"),
      ).text();
      expect(instr).toContain("applyTo:");
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});

describe("goose adapter golden output", () => {
  test("emits recipe YAML and AGENTS.md/CLAUDE.md parity", async () => {
    const res = await loadIR(MURMUR_DIR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ctx: CompileContext = { config: { ...DEFAULT_CONFIG, project: { name: "demo" } }, ir: res.value };
    const out = await freshOut();
    try {
      await compileTarget(getAdapter("goose")!, ctx, out);
      const recipe = await Bun.file(join(out, "recipes/master.yaml")).text();
      expect(recipe).toContain("title: master");
      expect(recipe).toContain("instructions:");
      const agentsMd = await Bun.file(join(out, "AGENTS.md")).text();
      expect(agentsMd).toContain("## Agents");
      const claudeMd = await Bun.file(join(out, "CLAUDE.md")).text();
      expect(claudeMd).toContain("## Agents");
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});

describe("antigravity adapter golden output", () => {
  test("emits .agents/plugins/<name>, plugin.json, agents, skills, rules and AGENTS.md", async () => {
    const res = await loadIR(MURMUR_DIR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ctx: CompileContext = {
      config: { ...DEFAULT_CONFIG, project: { name: "demo-project" } },
      ir: res.value,
    };
    const out = await freshOut();
    try {
      const adapter = getAdapter("agy");
      expect(adapter).toBeDefined();
      await compileTarget(adapter!, ctx, out);

      const pluginJson = await Bun.file(
        join(out, ".agents/plugins/demo-project/plugin.json"),
      ).json();
      expect(pluginJson.name).toBe("demo-project");

      const master = await Bun.file(
        join(out, ".agents/plugins/demo-project/agents/master.md"),
      ).text();
      expect(master).toContain("name: master");
      expect(master).toContain("mainAgent: true");
      expect(master).toContain("subagent: true");
      expect(master).toContain("commandExecutionPolicy: auto");
      expect(master).toContain("# Master");

      const skill = await Bun.file(
        join(out, ".agents/plugins/demo-project/skills/build-system/SKILL.md"),
      ).text();
      expect(skill).toContain("name: build-system");

      const rule = await Bun.file(
        join(out, ".agents/plugins/demo-project/rules/typescript-conventions.md"),
      ).text();
      expect(rule).toContain("applyTo:");

      const agentsMd = await Bun.file(join(out, "AGENTS.md")).text();
      expect(agentsMd).toContain("## Main Agents");
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});

describe("claude adapter golden output", () => {
  test("emits .claude/agents, skills, rules, and root CLAUDE.md", async () => {
    const res = await loadIR(MURMUR_DIR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ctx: CompileContext = {
      config: { ...DEFAULT_CONFIG, project: { name: "claude-demo" } },
      ir: res.value,
    };
    const out = await freshOut();
    try {
      const adapter = getAdapter("claude");
      expect(adapter).toBeDefined();
      await compileTarget(adapter!, ctx, out);

      const master = await Bun.file(join(out, ".claude/agents/master.md")).text();
      expect(master).toContain("name: master");
      expect(master).toContain("# Master");

      const skill = await Bun.file(
        join(out, ".claude/skills/build-system/SKILL.md"),
      ).text();
      expect(skill).toContain("name: build-system");

      const claudeMd = await Bun.file(join(out, "CLAUDE.md")).text();
      expect(claudeMd).toContain("Claude Code Project Guide");
      expect(claudeMd).toContain("## Available Agents");
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});

describe("cursor adapter golden output", () => {
  test("emits .cursor/rules/*.mdc, agents, skills, and root AGENTS.md", async () => {
    const res = await loadIR(MURMUR_DIR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ctx: CompileContext = {
      config: { ...DEFAULT_CONFIG, project: { name: "cursor-demo" } },
      ir: res.value,
    };
    const out = await freshOut();
    try {
      const adapter = getAdapter("cursor");
      expect(adapter).toBeDefined();
      await compileTarget(adapter!, ctx, out);

      const mdc = await Bun.file(
        join(out, ".cursor/rules/typescript-conventions.mdc"),
      ).text();
      expect(mdc).toContain("globs:");
      expect(mdc).toContain("description:");

      const master = await Bun.file(join(out, ".cursor/agents/master.md")).text();
      expect(master).toContain("name: master");

      const skill = await Bun.file(
        join(out, ".cursor/skills/build-system/SKILL.md"),
      ).text();
      expect(skill).toContain("name: build-system");

      const agentsMd = await Bun.file(join(out, "AGENTS.md")).text();
      expect(agentsMd).toContain("## Agents");
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});

describe("acp adapter golden output", () => {
  test("emits .acp/manifest.json, agents, skills, and server.ts", async () => {
    const res = await loadIR(MURMUR_DIR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ctx: CompileContext = {
      config: { ...DEFAULT_CONFIG, project: { name: "acp-demo" } },
      ir: res.value,
    };
    const out = await freshOut();
    try {
      const adapter = getAdapter("acp");
      expect(adapter).toBeDefined();
      await compileTarget(adapter!, ctx, out);

      const manifest = await Bun.file(join(out, ".acp/manifest.json")).json();
      expect(manifest.acpVersion).toBe("2.0");
      expect(manifest.protocol).toBe("agent-client-protocol");

      const master = await Bun.file(join(out, ".acp/agents/master.json")).json();
      expect(master.name).toBe("master");

      const server = await Bun.file(join(out, ".acp/server.ts")).text();
      expect(server).toContain("Agent Client Protocol");
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});

describe("atomic compile", () => {
  test("a mid-compile adapter failure leaves the output tree untouched", async () => {
    const res = await loadIR(MURMUR_DIR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ctx: CompileContext = { config: DEFAULT_CONFIG, ir: res.value };
    const out = await freshOut();
    const exploding: RuntimeCompiler = {
      id: "explode",
      compileAgent() {
        throw new Error("boom");
      },
      compileSubagent: () => [],
      compileSkill: () => [],
      compileInstruction: () => [],
    };
    try {
      await expect(compileTarget(exploding, ctx, out)).rejects.toThrow("boom");
      // No output directory contents should exist.
      const exists = await Bun.file(join(out, ".github")).exists();
      expect(exists).toBe(false);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});
