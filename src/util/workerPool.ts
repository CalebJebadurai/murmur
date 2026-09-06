/**
 * Worker Pool Engine — v0.5 Concurrency & Worker Budgeting.
 *
 * Provides concurrency-bounded async task scheduling with:
 *  - maxConcurrent enforcement: min(configured, cap, tasks)
 *  - mutual exclusion: pairs in `neverParallel` are guaranteed to never co-execute
 *  - exponential backoff retry for soft-failure agent turns
 *  - early-exit short-circuiting
 *  - deterministic result ordering matching input sequence
 */

export type WorkerPoolOptions = {
  /** Maximum number of concurrent tasks. Must be >= 1. */
  maxConcurrent: number;
  /** Pairs of agent names that must never execute concurrently. */
  neverParallel?: [string, string][];
  /** Max retries for failed tasks (default 0). */
  maxRetries?: number;
  /** Initial backoff delay in ms before retry (default 50). */
  retryDelayMs?: number;
  /** If true, stops launching pending tasks once any task returns earlyExit. */
  stopOnEarlyExit?: boolean;
};

export type ExecutionItem<T> = {
  name: string;
  payload: T;
};

export type WorkerTaskResult<R> = {
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  earlyExit?: boolean;
  score?: number;
  note?: string;
  data?: R;
};

export type ExecutedItem<T, R> = {
  name: string;
  payload: T;
  result: WorkerTaskResult<R>;
  retries: number;
};

export type WorkerPoolSummary<T, R> = {
  results: ExecutedItem<T, R>[];
  peakConcurrency: number;
  earlyExitTriggered: boolean;
};

/** Check whether two agent names are constrained by neverParallel. */
export function isNeverParallel(
  a: string,
  b: string,
  pairs?: [string, string][],
): boolean {
  if (!pairs || pairs.length === 0) return false;
  if (a === b) return true; // Same agent is never executed concurrently with itself in the same phase
  for (const [p1, p2] of pairs) {
    if ((p1 === a && p2 === b) || (p1 === b && p2 === a)) {
      return true;
    }
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an array of items through a bounded worker pool respecting concurrency
 * caps and mutual-exclusion rules.
 */
export async function runWorkerPool<T, R = unknown>(
  items: ExecutionItem<T>[],
  executor: (payload: T, name: string) => Promise<WorkerTaskResult<R>>,
  opts: WorkerPoolOptions,
): Promise<WorkerPoolSummary<T, R>> {
  if (items.length === 0) {
    return { results: [], peakConcurrency: 0, earlyExitTriggered: false };
  }

  const maxConcurrent = Math.max(1, opts.maxConcurrent);
  const neverParallel = opts.neverParallel ?? [];
  const maxRetries = Math.max(0, opts.maxRetries ?? 0);
  const initialRetryDelay = Math.max(1, opts.retryDelayMs ?? 20);

  // Map to preserve original order
  const orderMap = new Map<ExecutionItem<T>, number>();
  items.forEach((item, index) => orderMap.set(item, index));

  const pending = [...items];
  const activeTasks = new Map<string, Promise<void>>();
  const executedResults: ExecutedItem<T, R>[] = [];
  let peakConcurrency = 0;
  let earlyExitTriggered = false;

  // Signal mechanism to wake scheduler whenever a slot is freed
  let wakeScheduler: (() => void) | null = null;
  const notifySlotFreed = () => {
    if (wakeScheduler) {
      wakeScheduler();
      wakeScheduler = null;
    }
  };

  while (pending.length > 0 || activeTasks.size > 0) {
    if (opts.stopOnEarlyExit && earlyExitTriggered && activeTasks.size === 0) {
      break;
    }

    // Schedule available tasks while under capacity
    let scheduledAny = false;
    if (!(opts.stopOnEarlyExit && earlyExitTriggered)) {
      let i = 0;
      while (i < pending.length && activeTasks.size < maxConcurrent) {
        const candidate = pending[i]!;

        // Check for conflicts with any currently active agent
        let hasConflict = false;
        for (const activeAgent of activeTasks.keys()) {
          if (isNeverParallel(candidate.name, activeAgent, neverParallel)) {
            hasConflict = true;
            break;
          }
        }

        if (!hasConflict) {
          // Can launch candidate
          pending.splice(i, 1);
          scheduledAny = true;

          const taskPromise = (async () => {
            let attempt = 0;
            let lastResult: WorkerTaskResult<R>;

            while (true) {
              try {
                lastResult = await executor(candidate.payload, candidate.name);
              } catch (err) {
                lastResult = {
                  status: "FAILED",
                  note: err instanceof Error ? err.message : String(err),
                };
              }

              if (lastResult.status === "FAILED" && attempt < maxRetries) {
                attempt++;
                const delay = initialRetryDelay * Math.pow(2, attempt - 1);
                await sleep(delay);
                continue;
              }
              break;
            }

            if (lastResult.earlyExit) {
              earlyExitTriggered = true;
            }

            executedResults.push({
              name: candidate.name,
              payload: candidate.payload,
              result: lastResult,
              retries: attempt,
            });

            activeTasks.delete(candidate.name);
            notifySlotFreed();
          })();

          activeTasks.set(candidate.name, taskPromise);
          peakConcurrency = Math.max(peakConcurrency, activeTasks.size);
        } else {
          // Candidate blocked by active agent, check next candidate in queue
          i++;
        }
      }
    }

    if (activeTasks.size === 0 && pending.length > 0) {
      // If no tasks are active and pending remains, candidate has no active conflicts
      // but loop couldn't schedule.
      // This is a safety break to prevent any infinite stall.
      const candidate = pending.shift()!;
      const taskPromise = (async () => {
        let lastResult: WorkerTaskResult<R>;
        try {
          lastResult = await executor(candidate.payload, candidate.name);
        } catch (err) {
          lastResult = {
            status: "FAILED",
            note: err instanceof Error ? err.message : String(err),
          };
        }
        executedResults.push({
          name: candidate.name,
          payload: candidate.payload,
          result: lastResult,
          retries: 0,
        });
        activeTasks.delete(candidate.name);
        notifySlotFreed();
      })();
      activeTasks.set(candidate.name, taskPromise);
    }

    if (activeTasks.size > 0 && (!scheduledAny || activeTasks.size >= maxConcurrent || (opts.stopOnEarlyExit && earlyExitTriggered))) {
      // Wait for at least one active task to finish
      await new Promise<void>((resolve) => {
        wakeScheduler = resolve;
      });
    }
  }

  // Restore input sequence order
  executedResults.sort((a, b) => {
    const idxA = items.findIndex((it) => it.name === a.name && it.payload === a.payload);
    const idxB = items.findIndex((it) => it.name === b.name && it.payload === b.payload);
    return idxA - idxB;
  });

  return {
    results: executedResults,
    peakConcurrency,
    earlyExitTriggered,
  };
}
