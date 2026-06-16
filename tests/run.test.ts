import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  runCommand,
  formatRunLog,
  type Dispatcher,
  type TurnResult,
  type RunReport,
} from "../src/commands/run.ts";

const MURMUR_DIR = join(import.meta.dir, "..", "murmur");

/** Copy the dogfood murmur/ IR into a scratch project so run can write a RUN-LOG. */
async function scratchProject(): Promise<string> {
  const root = join(tmpdir(), `murmur-run-${crypto.randomUUID()}`);
  const { $ } = await import("bun");
  await mkdir(root, { recursive: true });
  await $`cp -R ${MURMUR_DIR} ${join(root, "murmur")}`.quiet();
  return root;
}

function recordingDispatcher(record: TurnResult[], opts: { earlyExitAt?: number; score?: number } = {}): Dispatcher {
  return async (agent, phase, iteration) => {
    const r: TurnResult = { agent, phase, iteration, status: "SUCCESS" };
    if (opts.score !== undefined && agent === "critic") r.score = opts.score;
    if (opts.earlyExitAt !== undefined && iteration >= opts.earlyExitAt) r.earlyExit = true;
    record.push(r);
    return r;
  };
}

describe("run driver — phase order and loop caps", () => {
  test("walks phases in tier order and caps the loop at max when no early-exit", async () => {
    const root = await scratchProject();
    try {
      const seen: TurnResult[] = [];
      const code = await runCommand(root, {
        pipeline: "architect",
        branch: "coding",
        tier: "standard",
        dispatcher: recordingDispatcher(seen),
        dryRun: true,
      });
      expect(code).toBe(0);
      // first turn is phase 0 prompt-engineer
      expect(seen[0]!.phase).toBe("0");
      // critic-planner loop (phase 3) ran its cap of 3 iterations
      const phase3Iters = new Set(seen.filter((t) => t.phase === "3").map((t) => t.iteration));
      expect([...phase3Iters].sort()).toEqual([1, 2, 3]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a host early-exit signal terminates the loop before the cap", async () => {
    const root = await scratchProject();
    try {
      const seen: TurnResult[] = [];
      await runCommand(root, {
        pipeline: "architect",
        branch: "coding",
        tier: "standard",
        dispatcher: recordingDispatcher(seen, { earlyExitAt: 2 }),
        dryRun: true,
      });
      const phase3Iters = new Set(seen.filter((t) => t.phase === "3").map((t) => t.iteration));
      // stops at iteration 2 (min=1 satisfied, early-exit fired)
      expect(Math.max(...phase3Iters)).toBe(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("run driver — RUN-LOG", () => {
  test("formatRunLog emits the agri summary columns and an execution log", () => {
    const report: RunReport = {
      pipeline: "architect",
      branch: "coding",
      tier: "standard",
      iterationsByLoop: { "critic-planner": 2 },
      totalIterations: 2,
      exec: [{ phase: "0", agent: "prompt-engineer", iteration: 1, status: "SUCCESS" }],
      scored: [41, 32, 32],
    };
    const log = formatRunLog(report, "2026-06-16");
    expect(log).toContain("| Date | Topic Slug | Branch | Tier | Iterations | Total Score | Verifier | Notes |");
    expect(log).toContain("architect");
    expect(log).toContain("critic-planner=2");
    expect(log).toContain("105"); // 41+32+32
    expect(log).toContain("Phase 0 — prompt-engineer");
  });

  test("dry-run writes no RUN-LOG file; a real run writes one", async () => {
    const root = await scratchProject();
    try {
      const seen: TurnResult[] = [];
      await runCommand(root, { pipeline: "architect", branch: "coding", tier: "lightweight", dispatcher: recordingDispatcher(seen), dryRun: true });
      expect(await Bun.file(join(root, "_architect", "RUN-LOG.md")).exists()).toBe(false);

      await runCommand(root, { pipeline: "architect", branch: "coding", tier: "lightweight", dispatcher: recordingDispatcher(seen) });
      expect(await Bun.file(join(root, "_architect", "RUN-LOG.md")).exists()).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("unknown pipeline name fails with a clear message", async () => {
    const root = await scratchProject();
    try {
      const code = await runCommand(root, { pipeline: "does-not-exist", dryRun: true });
      expect(code).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
