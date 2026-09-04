import { join } from "node:path";
import { existsSync, watch as fsWatch } from "node:fs";
import { loadIR } from "../schema/load.ts";
import { compileTarget } from "../compiler/compile.ts";
import { availableTargets, getAdapter } from "../compiler/registry.ts";
import type { CompileContext } from "../compiler/RuntimeCompiler.ts";
import { loadConfig } from "../util/loadConfig.ts";
import { runDoctor } from "./doctor.ts";

export type WatchCycleResult = {
  ok: boolean;
  filesCompiled: number;
  durationMs: number;
  error?: string;
};

export type WatchOptions = {
  target?: string;
  out?: string;
  allowConfigExec?: boolean;
  /** Recompile once on startup and immediately exit (useful for testing/CI). */
  once?: boolean;
  /** Debounce delay in ms. Default 150. */
  debounceMs?: number;
  /** Signal to abort watching cleanly. */
  signal?: AbortSignal;
  /** Optional callback for test observability when a recompile cycle completes. */
  onCycle?: (result: WatchCycleResult) => void;
};

function formatTime(): string {
  const now = new Date();
  return now.toTimeString().slice(0, 8);
}

export async function runRecompile(
  projectRoot: string,
  murmurDir: string,
  opts: WatchOptions,
): Promise<WatchCycleResult> {
  const start = performance.now();
  const report = await runDoctor(murmurDir);
  if (!report.ok) {
    const error = `Doctor validation found ${report.errors.length} issue(s): ${report.errors
      .slice(0, 3)
      .map((e) => e.message)
      .join("; ")}${report.errors.length > 3 ? "..." : ""}`;
    return { ok: false, filesCompiled: 0, durationMs: Math.round(performance.now() - start), error };
  }

  const loaded = await loadIR(murmurDir);
  if (!loaded.ok) {
    return {
      ok: false,
      filesCompiled: 0,
      durationMs: Math.round(performance.now() - start),
      error: "Failed to load IR definitions.",
    };
  }

  const config = await loadConfig(projectRoot, {
    allowConfigExec: opts.allowConfigExec,
  });
  const targets = opts.target ? [opts.target] : config.targets;
  const outRoot = opts.out ? join(projectRoot, opts.out) : projectRoot;

  let filesCompiled = 0;
  for (const id of targets) {
    const adapter = getAdapter(id);
    if (!adapter) {
      return {
        ok: false,
        filesCompiled: 0,
        durationMs: Math.round(performance.now() - start),
        error: `Unknown target "${id}". Available: ${availableTargets().join(", ")}.`,
      };
    }
    const ctx: CompileContext = { config, ir: loaded.value };
    const result = await compileTarget(adapter, ctx, outRoot);
    filesCompiled += result.files.length;
  }

  const durationMs = Math.round(performance.now() - start);
  return { ok: true, filesCompiled, durationMs };
}

/** `murmr watch [--target <id>] [--out <dir>]` — live automatic recompiler. */
export async function watchCommand(
  projectRoot: string,
  opts: WatchOptions = {},
): Promise<number> {
  const murmurDir = join(projectRoot, "murmur");
  if (!existsSync(join(murmurDir, "agents"))) {
    console.error('No murmur/ directory found. Run "murmr init" first.');
    return 1;
  }

  const debounceMs = opts.debounceMs ?? 150;
  const targetLabel = opts.target ? opts.target : "all configured targets";

  console.log(`[murmr watch] Starting recompiler daemon... (target: ${targetLabel})`);

  // Initial compilation run
  const initial = await runRecompile(projectRoot, murmurDir, opts);
  if (initial.ok) {
    console.log(
      `[murmr watch] ${formatTime()} Initial compile: ${initial.filesCompiled} file(s) compiled in ${initial.durationMs}ms`,
    );
  } else {
    console.warn(`[murmr watch] ${formatTime()} Initial compile warning: ${initial.error}`);
  }
  opts.onCycle?.(initial);

  if (opts.once) {
    return initial.ok ? 0 : 1;
  }

  console.log(`[murmr watch] Watching ${murmurDir} for changes (Ctrl+C to stop)...`);

  return new Promise<number>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingChanges = new Set<string>();
    let isRecompiling = false;

    const executeCycle = async () => {
      if (isRecompiling) {
        // Re-queue if currently in the middle of a compilation
        timer = setTimeout(executeCycle, debounceMs);
        return;
      }
      isRecompiling = true;
      const changesCount = pendingChanges.size;
      pendingChanges.clear();

      const result = await runRecompile(projectRoot, murmurDir, opts);
      if (result.ok) {
        console.log(
          `[murmr watch] ${formatTime()} ✓ Recompiled ${result.filesCompiled} file(s) in ${result.durationMs}ms (${changesCount} change(s))`,
        );
      } else {
        console.error(`[murmr watch] ${formatTime()} ✗ ${result.error}`);
      }
      opts.onCycle?.(result);
      isRecompiling = false;
    };

    let watcher: ReturnType<typeof fsWatch> | null = null;
    try {
      watcher = fsWatch(murmurDir, { recursive: true }, (_eventType, filename) => {
        if (filename) {
          // Ignore temp or swap files
          if (filename.endsWith("~") || filename.startsWith(".")) return;
          pendingChanges.add(filename);
        }
        if (timer) clearTimeout(timer);
        timer = setTimeout(executeCycle, debounceMs);
      });
    } catch (err) {
      console.error(`[murmr watch] Failed to watch directory: ${err}`);
      resolve(1);
      return;
    }

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (watcher) {
        try {
          watcher.close();
        } catch {
          // ignore
        }
        watcher = null;
      }
    };

    if (opts.signal) {
      opts.signal.addEventListener("abort", () => {
        cleanup();
        resolve(0);
      });
    }

    const sigHandler = () => {
      console.log("\n[murmr watch] Stopping watcher...");
      cleanup();
      resolve(0);
    };

    // Only hook process signals if we aren't in test mode with custom signal
    if (!opts.signal && typeof process !== "undefined" && typeof process.on === "function") {
      process.once("SIGINT", sigHandler);
      process.once("SIGTERM", sigHandler);
    }
  });
}
