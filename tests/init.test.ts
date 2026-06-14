import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { initCommand } from "../src/commands/init.ts";
import { runDoctor } from "../src/commands/doctor.ts";

async function sampleProject(): Promise<string> {
  const root = join(tmpdir(), `murmur-init-${crypto.randomUUID()}`);
  await mkdir(join(root, "src"), { recursive: true });
  await Bun.write(
    join(root, "package.json"),
    JSON.stringify({ name: "sample-project", scripts: { test: "bun test", build: "bun build" } }, null, 2),
  );
  await Bun.write(join(root, "tsconfig.json"), "{}");
  await Bun.write(join(root, "src", "index.ts"), "export const x = 1;\n");
  await Bun.write(join(root, "bun.lock"), "");
  return root;
}

describe("init structural pass", () => {
  test("generates a doctor-valid murmur/ with agents, skills, instructions", async () => {
    const root = await sampleProject();
    try {
      const start = Date.now();
      const code = await initCommand(root, {});
      expect(code).toBe(0);
      // under the two-minute budget (trivially)
      expect(Date.now() - start).toBeLessThan(120_000);

      const report = await runDoctor(join(root, "murmur"));
      expect(report.ok).toBe(true);

      // structural skills present
      expect(await Bun.file(join(root, "murmur/skills/build-system/SKILL.md")).exists()).toBe(true);
      expect(await Bun.file(join(root, "murmur/skills/test-conventions/SKILL.md")).exists()).toBe(true);
      // generic base agents present
      expect(await Bun.file(join(root, "murmur/agents/master.md")).exists()).toBe(true);

      // build-system skill reflects the detected package manager
      const buildSkill = await Bun.file(join(root, "murmur/skills/build-system/SKILL.md")).text();
      expect(buildSkill).toContain("bun");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("cancel mode does not modify an existing murmur/", async () => {
    const root = await sampleProject();
    try {
      await initCommand(root, {});
      const before = await Bun.file(join(root, "murmur/agents/master.md")).text();
      const code = await initCommand(root, { mode: "cancel" });
      expect(code).toBe(0);
      const after = await Bun.file(join(root, "murmur/agents/master.md")).text();
      expect(after).toBe(before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
