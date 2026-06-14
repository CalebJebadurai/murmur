import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { scanExternalization } from "../src/publish/externalization.ts";

const BASE_MURMUR = join(import.meta.dir, "..", "murmur");

describe("knowledge-externalization gate", () => {
  test("the base agent bodies contain zero codebase-specific facts", async () => {
    // No repoName: "murmur" is the framework's own structural directory keyword,
    // not a leaked project fact. Absolute paths + domain terms are the real gate.
    const report = await scanExternalization(BASE_MURMUR, {
      domainTerms: [],
    });
    if (!report.ok) {
      console.error(report.leaks);
    }
    expect(report.ok).toBe(true);
    expect(report.leaks).toHaveLength(0);
  });

  test("flags a planted absolute path in an agent body", async () => {
    // scan a synthetic dir with a leak
    const { tmpdir } = await import("node:os");
    const { mkdir, rm } = await import("node:fs/promises");
    const dir = join(tmpdir(), `murmur-ext-${crypto.randomUUID()}`);
    await mkdir(join(dir, "agents"), { recursive: true });
    try {
      await Bun.write(
        join(dir, "agents", "leaky.md"),
        `---\ndescription: "Use when: leaking"\n---\n\n# Leaky\n\nSee /Users/alice/projects/secret-thing for details.\n`,
      );
      const report = await scanExternalization(dir, {});
      expect(report.ok).toBe(false);
      expect(report.leaks.some((l) => l.pattern === "absolute-user-path")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
