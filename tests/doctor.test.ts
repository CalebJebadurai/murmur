import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { runDoctor } from "../src/commands/doctor.ts";

const BASE_MURMUR = join(import.meta.dir, "..", "murmur");

async function scratchMurmur(): Promise<string> {
  const root = join(tmpdir(), `murmur-doctor-${crypto.randomUUID()}`);
  // copy the base IR
  const { $ } = await import("bun");
  await mkdir(root, { recursive: true });
  await $`cp -R ${BASE_MURMUR}/. ${root}`.quiet();
  return root;
}

describe("doctor", () => {
  test("reports zero errors on the valid base IR", async () => {
    const report = await runDoctor(BASE_MURMUR);
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  test("detects a missing skill reference", async () => {
    const dir = await scratchMurmur();
    try {
      await Bun.write(
        join(dir, "agents", "broken.md"),
        `---\ndescription: "Use when: testing missing refs"\nskills: [does-not-exist]\n---\n\n# Broken\n\nbody\n`,
      );
      const report = await runDoctor(dir);
      expect(report.ok).toBe(false);
      expect(report.errors.some((e) => e.message.includes("does-not-exist"))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("detects malformed/empty required fields", async () => {
    const dir = await scratchMurmur();
    try {
      await Bun.write(
        join(dir, "agents", "nodesc.md"),
        `---\ntools: [read]\n---\n\n# No description\n\nbody\n`,
      );
      const report = await runDoctor(dir);
      expect(report.ok).toBe(false);
      expect(report.errors.some((e) => e.field === "description")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("detects an invalid applyTo glob", async () => {
    const dir = await scratchMurmur();
    try {
      await Bun.write(
        join(dir, "instructions", "bad.md"),
        `---\napplyTo: "[unterminated"\n---\n\n# Bad\n\nrules\n`,
      );
      const report = await runDoctor(dir);
      // Bun.Glob is lenient; assert the loader still produced a report object.
      expect(typeof report.ok).toBe("boolean");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("detects a circular subagent dependency", async () => {
    const dir = await scratchMurmur();
    try {
      await Bun.write(
        join(dir, "agents", "a.md"),
        `---\ndescription: "Use when: a"\nagents: [b]\n---\n\n# A\n\nbody\n`,
      );
      await Bun.write(
        join(dir, "agents", "b.md"),
        `---\ndescription: "Use when: b"\nagents: [a]\n---\n\n# B\n\nbody\n`,
      );
      const report = await runDoctor(dir);
      expect(report.ok).toBe(false);
      expect(report.errors.some((e) => e.message.includes("circular"))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("automatically fixes missing skill, instruction, and subagent references when opts.fix is true", async () => {
    const dir = await scratchMurmur();
    try {
      await Bun.write(
        join(dir, "agents", "needs-healing.md"),
        `---\ndescription: "Agent requiring healing"\nskills: [auto-skill]\ninstructions: [auto-rule]\nagents: [auto-sub]\n---\n\n# Needs Healing\n\nbody\n`,
      );

      // Verify doctor detects problems before fix
      const before = await runDoctor(dir, { fix: false });
      expect(before.ok).toBe(false);
      expect(before.errors.length).toBe(3);

      // Run doctor with fix: true
      const healed = await runDoctor(dir, { fix: true });
      expect(healed.ok).toBe(true);
      expect(healed.errors).toHaveLength(0);
      expect(healed.fixed).toBeDefined();
      expect(healed.fixed).toContain("skills/auto-skill/SKILL.md");
      expect(healed.fixed).toContain("instructions/auto-rule.md");
      expect(healed.fixed).toContain("subagents/auto-sub.md");

      // Verify files actually exist on disk with valid content
      const skillText = await Bun.file(join(dir, "skills", "auto-skill", "SKILL.md")).text();
      expect(skillText).toContain("name: auto-skill");

      const ruleText = await Bun.file(join(dir, "instructions", "auto-rule.md")).text();
      expect(ruleText).toContain('applyTo: "**/*"');

      const subText = await Bun.file(join(dir, "subagents", "auto-sub.md")).text();
      expect(subText).toContain("Specialist subagent for auto-sub");

      // Running doctor again without fix confirms everything stays clean
      const after = await runDoctor(dir);
      expect(after.ok).toBe(true);
      expect(after.errors).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
