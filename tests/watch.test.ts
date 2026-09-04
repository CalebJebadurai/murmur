import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { runRecompile, watchCommand, type WatchCycleResult } from "../src/commands/watch.ts";

const BASE_MURMUR = join(import.meta.dir, "..", "murmur");

async function scratchProject(): Promise<string> {
  const root = join(tmpdir(), `murmur-watch-${crypto.randomUUID()}`);
  const murmurDir = join(root, "murmur");
  const { $ } = await import("bun");
  await mkdir(murmurDir, { recursive: true });
  await $`cp -R ${BASE_MURMUR}/. ${murmurDir}`.quiet();
  return root;
}

describe("murmr watch", () => {
  test("runRecompile compiles all configured targets on valid IR", async () => {
    const root = await scratchProject();
    try {
      const murmurDir = join(root, "murmur");
      const result = await runRecompile(root, murmurDir, { target: "agy" });
      expect(result.ok).toBe(true);
      expect(result.filesCompiled).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("runRecompile reports error when IR is invalid", async () => {
    const root = await scratchProject();
    try {
      const murmurDir = join(root, "murmur");
      await Bun.write(
        join(murmurDir, "agents", "invalid.md"),
        `---\ntools: []\n---\n# Missing description\n`,
      );
      const result = await runRecompile(root, murmurDir, { target: "agy" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Doctor validation");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("watchCommand with once: true performs single compilation and exits 0", async () => {
    const root = await scratchProject();
    try {
      let cycleResult: WatchCycleResult | null = null;
      const code = await watchCommand(root, {
        target: "claude",
        once: true,
        onCycle: (r) => {
          cycleResult = r;
        },
      });
      expect(code).toBe(0);
      expect(cycleResult).not.toBeNull();
      expect(cycleResult!.ok).toBe(true);
      expect(cycleResult!.filesCompiled).toBeGreaterThan(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("watchCommand detects file changes and triggers recompile cycle", async () => {
    const root = await scratchProject();
    const ac = new AbortController();
    const cycles: WatchCycleResult[] = [];

    try {
      const watchPromise = watchCommand(root, {
        target: "cursor",
        debounceMs: 50,
        signal: ac.signal,
        onCycle: (r) => {
          cycles.push(r);
        },
      });

      // Wait a moment for initial compilation to register
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(cycles.length).toBeGreaterThanOrEqual(1);

      // Trigger a file change in murmur/agents
      await Bun.write(
        join(root, "murmur", "agents", "watcher-test.md"),
        `---\ndescription: "Use when: testing watch daemon"\n---\n\n# Watcher Test Agent\n`,
      );

      // Wait for debounce and recompile
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Abort watch daemon
      ac.abort();
      const code = await watchPromise;
      expect(code).toBe(0);
      // Initial compile + at least 1 file change compile
      expect(cycles.length).toBeGreaterThanOrEqual(2);
      expect(cycles.every((c) => c.ok)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
