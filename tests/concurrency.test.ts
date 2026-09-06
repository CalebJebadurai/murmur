import { describe, expect, test } from "bun:test";
import {
  runWorkerPool,
  isNeverParallel,
  type ExecutionItem,
} from "../src/util/workerPool.ts";
import { runCommand, type TurnResult } from "../src/commands/run.ts";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";

const MURMUR_DIR = join(import.meta.dir, "..", "murmur");

async function scratchProject(): Promise<string> {
  const root = join(tmpdir(), `murmur-conc-${crypto.randomUUID()}`);
  const { $ } = await import("bun");
  await mkdir(root, { recursive: true });
  await $`cp -R ${MURMUR_DIR} ${join(root, "murmur")}`.quiet();
  return root;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("v0.5 Concurrency Engine — Worker Pool", () => {
  test("isNeverParallel identifies symmetric and self-conflicts", () => {
    const pairs: [string, string][] = [
      ["critic", "planner"],
      ["implementer", "critic"],
    ];
    expect(isNeverParallel("critic", "planner", pairs)).toBe(true);
    expect(isNeverParallel("planner", "critic", pairs)).toBe(true);
    expect(isNeverParallel("critic", "implementer", pairs)).toBe(true);
    expect(isNeverParallel("implementer", "critic", pairs)).toBe(true);
    // Self-conflict
    expect(isNeverParallel("analyst", "analyst", pairs)).toBe(true);
    // Non-conflicting pair
    expect(isNeverParallel("analyst", "critic", pairs)).toBe(false);
    expect(isNeverParallel("researcher", "planner", pairs)).toBe(false);
  });

  test("enforces maxConcurrent bounds strictly across asynchronous tasks", async () => {
    const items: ExecutionItem<number>[] = [
      { name: "t1", payload: 30 },
      { name: "t2", payload: 30 },
      { name: "t3", payload: 30 },
      { name: "t4", payload: 30 },
    ];

    let currentRunning = 0;
    let maxObserved = 0;

    const summary = await runWorkerPool(
      items,
      async (duration) => {
        currentRunning++;
        maxObserved = Math.max(maxObserved, currentRunning);
        await sleep(duration);
        currentRunning--;
        return { status: "SUCCESS" };
      },
      { maxConcurrent: 2 },
    );

    expect(summary.peakConcurrency).toBe(2);
    expect(maxObserved).toBe(2);
    expect(summary.results.length).toBe(4);
    expect(summary.results.map((r) => r.name)).toEqual(["t1", "t2", "t3", "t4"]);
  });

  test("enforces neverParallel mutual exclusion even with idle capacity", async () => {
    // 3 items with maxConcurrent = 3, but "critic" and "planner" must never run concurrently
    const items: ExecutionItem<{ delay: number }>[] = [
      { name: "critic", payload: { delay: 40 } },
      { name: "business-critic", payload: { delay: 20 } },
      { name: "planner", payload: { delay: 20 } },
    ];

    const activeSet = new Set<string>();
    let criticAndPlannerCoexisted = false;

    const summary = await runWorkerPool(
      items,
      async (payload, name) => {
        activeSet.add(name);
        if (activeSet.has("critic") && activeSet.has("planner")) {
          criticAndPlannerCoexisted = true;
        }
        await sleep(payload.delay);
        activeSet.delete(name);
        return { status: "SUCCESS" };
      },
      {
        maxConcurrent: 3,
        neverParallel: [["critic", "planner"]],
      },
    );

    expect(criticAndPlannerCoexisted).toBe(false);
    // Peak concurrency should be 2 because planner had to wait for critic
    expect(summary.peakConcurrency).toBe(2);
    expect(summary.results.length).toBe(3);
    // Original order preserved
    expect(summary.results.map((r) => r.name)).toEqual(["critic", "business-critic", "planner"]);
  });

  test("retries soft-failure turns with exponential backoff", async () => {
    let attempts = 0;
    const items: ExecutionItem<void>[] = [{ name: "unstable-agent", payload: undefined }];

    const summary = await runWorkerPool(
      items,
      async () => {
        attempts++;
        if (attempts < 3) {
          return { status: "FAILED", note: `attempt ${attempts} failed` };
        }
        return { status: "SUCCESS", note: "attempt 3 succeeded" };
      },
      {
        maxConcurrent: 1,
        maxRetries: 2,
        retryDelayMs: 10,
      },
    );

    expect(attempts).toBe(3);
    expect(summary.results[0]!.result.status).toBe("SUCCESS");
    expect(summary.results[0]!.retries).toBe(2);
    expect(summary.results[0]!.result.note).toBe("attempt 3 succeeded");
  });

  test("earlyExit stops launching subsequent queued tasks", async () => {
    const executed: string[] = [];
    const items: ExecutionItem<void>[] = [
      { name: "agent-1", payload: undefined },
      { name: "agent-2", payload: undefined },
      { name: "agent-3", payload: undefined },
    ];

    const summary = await runWorkerPool(
      items,
      async (_, name) => {
        executed.push(name);
        if (name === "agent-1") {
          return { status: "SUCCESS", earlyExit: true };
        }
        return { status: "SUCCESS" };
      },
      {
        maxConcurrent: 1,
        stopOnEarlyExit: true,
      },
    );

    expect(summary.earlyExitTriggered).toBe(true);
    expect(executed).toEqual(["agent-1"]);
  });

  test("integration: murmr run honors concurrency option and tracks peak concurrency", async () => {
    const root = await scratchProject();
    try {
      const seen: TurnResult[] = [];
      const code = await runCommand(root, {
        pipeline: "architect",
        branch: "coding",
        tier: "standard",
        concurrency: 2,
        dispatcher: async (agent, phase, iteration) => {
          await sleep(10);
          return { agent, phase, iteration, status: "SUCCESS" };
        },
        dryRun: true,
      });

      expect(code).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
