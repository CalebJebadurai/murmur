import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { loadIR } from "../src/schema/load.ts";
import { getAdapter } from "../src/compiler/registry.ts";
import { compileTarget } from "../src/compiler/compile.ts";
import type { CompileContext } from "../src/compiler/RuntimeCompiler.ts";
import { DEFAULT_CONFIG } from "../src/schema/index.ts";

async function freshDir(): Promise<string> {
  const dir = join(tmpdir(), `murmur-assets-test-${crypto.randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

describe("Directory Skill Assets", () => {
  test("discovers companion assets and emits across all 6 target compilers", async () => {
    const murmurDir = await freshDir();
    const outDir = await freshDir();

    try {
      // Create minimal valid IR with directory-structured skill
      await mkdir(join(murmurDir, "agents"), { recursive: true });
      await writeFile(
        join(murmurDir, "agents/minimal.md"),
        `---\nname: minimal\ndescription: minimal agent\ntools: []\nskills: [asset-skill]\n---\n# Minimal\nRole prose.\n`,
      );

      const skillDir = join(murmurDir, "skills/asset-skill");
      await mkdir(join(skillDir, "references"), { recursive: true });
      await mkdir(join(skillDir, "scripts"), { recursive: true });

      await writeFile(
        join(skillDir, "SKILL.md"),
        `---\nname: asset-skill\ndescription: Skill with assets\n---\n# Asset Skill\nKnowledge.\n`,
      );
      await writeFile(
        join(skillDir, "references/cheatsheet.md"),
        `# Cheatsheet\nImportant reference data.\n`,
      );
      await writeFile(
        join(skillDir, "scripts/check.sh"),
        `#!/bin/sh\necho "OK"\n`,
      );

      // Load IR
      const loaded = await loadIR(murmurDir);
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;

      const skill = loaded.value.skills.find((s) => s.name === "asset-skill");
      expect(skill).toBeDefined();
      expect(skill?.assets).toBeDefined();
      expect(skill?.assets?.length).toBe(2);

      const relPaths = skill?.assets?.map((a) => a.relativePath).sort();
      expect(relPaths).toEqual(["references/cheatsheet.md", "scripts/check.sh"].sort());

      const ctx: CompileContext = {
        config: { ...DEFAULT_CONFIG, project: { name: "asset-test" } },
        ir: loaded.value,
      };

      // Test each adapter
      const targets = ["copilot", "goose", "antigravity", "claude", "cursor", "acp"];
      for (const t of targets) {
        const adapter = getAdapter(t);
        expect(adapter).toBeDefined();
        const res = await compileTarget(adapter!, ctx, outDir);

        // Verify each asset is in emitted files
        const emittedPaths = res.files;
        const hasCheatsheet = emittedPaths.some(
          (p) => p.includes("asset-skill") && p.includes("references/cheatsheet.md"),
        );
        const hasScript = emittedPaths.some(
          (p) => p.includes("asset-skill") && p.includes("scripts/check.sh"),
        );

        expect(hasCheatsheet).toBe(true);
        expect(hasScript).toBe(true);
      }
    } finally {
      await rm(murmurDir, { recursive: true, force: true });
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
