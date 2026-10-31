import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { emitAll } from "../src/compiler/RuntimeCompiler.ts";
import { getAdapter } from "../src/compiler/registry.ts";
import { loadIR } from "../src/schema/load.ts";
import type { CompileContext } from "../src/compiler/RuntimeCompiler.ts";

async function context(): Promise<CompileContext> {
  const loaded = await loadIR(join(process.cwd(), "murmur"));
  if (!loaded.ok) throw new Error("fixture IR is invalid");
  return { ir: loaded.value, config: { targets: [], project: { name: "demo" } } as never };
}

describe("Codex and OpenCode targets", () => {
  test("codex emits TOML custom agents and shared skills", async () => {
    const ctx = await context();
    const files = emitAll(getAdapter("codex")!, ctx);
    const critic = files.find((f) => f.path === ".codex/agents/critic.toml");
    expect(critic?.contents).toContain('name = "critic"');
    expect(critic?.contents).toContain("developer_instructions = ");
    expect(critic?.contents).toContain("read-only");
    expect(files.some((f) => f.path === ".agents/skills/build-system/SKILL.md")).toBe(true);
  });

  test("opencode emits agents with modes and edit limits", async () => {
    const ctx = await context();
    const files = emitAll(getAdapter("opencode")!, ctx);
    const critic = files.find((f) => f.path === ".opencode/agents/critic.md");
    expect(critic?.contents).toContain("mode: primary");
    expect(critic?.contents).toContain("edit: deny");
    expect(files.some((f) => f.path === ".opencode/skills/build-system/SKILL.md")).toBe(true);
  });

  test("every AGENTS.md target emits identical contents, including instructions", async () => {
    const ctx = await context();
    const bodies = ["cursor", "goose", "antigravity", "codex", "opencode"].map(
      (id) => emitAll(getAdapter(id)!, ctx).find((f) => f.path === "AGENTS.md")?.contents,
    );
    expect(new Set(bodies).size).toBe(1);
    expect(bodies[0]).toContain("## Instructions");
  });
});
