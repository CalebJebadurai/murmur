import { join } from "node:path";
import { existsSync } from "node:fs";
import { loadIR } from "../schema/load.ts";
import { runDoctor } from "./doctor.ts";
import { loadConfig } from "../util/loadConfig.ts";
import { makeHostDispatcher } from "./hostDispatch.ts";
import { makeSandboxDispatcher } from "./sandboxDispatch.ts";
import type { SandboxConfig } from "../schema/config.ts";
import { runWorkerPool } from "../util/workerPool.ts";
import type {
  BranchDefinition,
  PhaseDefinition,
  PipelineDefinition,
} from "../schema/index.ts";

/** Result of a single delegated agent turn. The decision content is the host's. */
export type TurnResult = {
  agent: string;
  phase: string;
  iteration: number;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  /** Numeric score the host emitted, if any (murmur never invents one). */
  score?: number;
  note?: string;
  /** Whether the host signalled a loop early-exit after this turn. */
  earlyExit?: boolean;
};

/**
 * The "ask the target" seam. In v0.2c this is a deterministic stub; in v0.2d it
 * becomes a gated Bun.spawn to a host CLI. murmur owns the orchestration around it,
 * never the generative content inside it.
 */
export type Dispatcher = (
  agent: string,
  phase: string,
  iteration: number,
) => Promise<TurnResult>;

export type RunOptions = {
  pipeline: string;
  tier?: string;
  branch?: string;
  classification?: string;
  dryRun?: boolean;
  allowRun?: boolean;
  allowConfigExec?: boolean;
  out?: string;
  verbose?: boolean;
  /** Max concurrent agent turns (v0.5 concurrency engine). */
  concurrency?: number;
  /** Max retries for failed agent turns. */
  retries?: number;
  /** Initial retry delay in ms. */
  retryDelayMs?: number;
  /** Cloud sandbox runner type: "docker" | "remote". */
  sandbox?: string;
  /** Docker image for sandbox runner. */
  sandboxImage?: string;
  /** Remote sandbox endpoint URL. */
  sandboxUrl?: string;
  /** Remote sandbox auth token. */
  sandboxToken?: string;
  /** Sandbox timeout in ms. */
  sandboxTimeoutMs?: number;
  /** Test seam: override the dispatcher. */
  dispatcher?: Dispatcher;
};

/** Deterministic stub dispatcher — never spawns, always succeeds, never scores. */
const stubDispatcher: Dispatcher = async (agent, phase, iteration) => ({
  agent,
  phase,
  iteration,
  status: "SUCCESS",
  note: "stub (dry-run)",
});

type ExecEntry = { phase: string; agent: string; iteration: number; status: string; note?: string };

export type RunReport = {
  pipeline: string;
  branch: string;
  tier: string;
  iterationsByLoop: Record<string, number>;
  totalIterations: number;
  exec: ExecEntry[];
  scored: number[];
  peakConcurrency?: number;
};


function selectBranch(p: PipelineDefinition, opts: RunOptions): { name: string; branch: BranchDefinition } | null {
  if (opts.branch && p.branches[opts.branch]) return { name: opts.branch, branch: p.branches[opts.branch]! };
  if (opts.classification) {
    const bname = p.routing.map[opts.classification];
    if (bname && p.branches[bname]) return { name: bname, branch: p.branches[bname]! };
  }
  const first = Object.keys(p.branches)[0];
  return first ? { name: first, branch: p.branches[first]! } : null;
}

function resolvePhases(branch: BranchDefinition, tier?: string): { tier: string; phases: PhaseDefinition[] } {
  if (tier) {
    const t = branch.tiers.find((x) => x.name === tier);
    if (t) {
      const order = new Map(branch.phases.map((ph, i) => [ph.id, i]));
      const phases = t.phases
        .map((id) => branch.phases.find((ph) => ph.id === id))
        .filter((ph): ph is PhaseDefinition => ph !== undefined)
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      return { tier, phases };
    }
  }
  return { tier: tier ?? "(all)", phases: branch.phases };
}

/** Walk a branch's phases, honoring loops (capped) and recording every turn. */
async function execute(
  branchName: string,
  branch: BranchDefinition,
  phases: PhaseDefinition[],
  tierName: string,
  dispatch: Dispatcher,
  opts?: {
    concurrency?: number;
    retries?: number;
    retryDelayMs?: number;
  },
): Promise<RunReport> {
  const exec: ExecEntry[] = [];
  const scored: number[] = [];
  const iterationsByLoop: Record<string, number> = {};
  const idOf = new Map(phases.map((ph, i) => [ph.id, i]));

  const loopByFrom = new Map(branch.loops.map((l) => [l.from, l]));
  const neverParallel = branch.parallel.neverParallel;
  const configuredConcurrency = opts?.concurrency;
  const effectiveMaxConcurrent = configuredConcurrency
    ? Math.max(1, Math.min(configuredConcurrency, branch.parallel.maxConcurrent))
    : Math.max(1, branch.parallel.maxConcurrent);

  let peakConcurrency = 0;

  const runPhaseOnce = async (phase: PhaseDefinition, iteration: number): Promise<boolean> => {
    if (phase.agents.length === 0) return false;

    const poolItems = phase.agents.map((a) => ({
      name: a.name,
      payload: a,
    }));

    const poolResult = await runWorkerPool(
      poolItems,
      async (agent) => {
        const res = await dispatch(agent.name, phase.id, iteration);
        return {
          status: res.status,
          earlyExit: res.earlyExit,
          score: res.score,
          note: res.note,
        };
      },
      {
        maxConcurrent: effectiveMaxConcurrent,
        neverParallel,
        maxRetries: opts?.retries,
        retryDelayMs: opts?.retryDelayMs,
        stopOnEarlyExit: true,
      },
    );

    peakConcurrency = Math.max(peakConcurrency, poolResult.peakConcurrency);

    for (const r of poolResult.results) {
      exec.push({
        phase: phase.id,
        agent: r.name,
        iteration,
        status: r.result.status,
        note: r.result.note,
      });
      if (typeof r.result.score === "number") scored.push(r.result.score);
    }

    return poolResult.earlyExitTriggered;
  };

  let i = 0;
  while (i < phases.length) {
    const phase = phases[i]!;
    const loop = loopByFrom.get(phase.id);
    if (loop && idOf.has(loop.to)) {
      const toIdx = idOf.get(loop.to)!;
      const cap = Math.min(loop.max, 3); // hard cap mirrors MAX_LOOP_ITERATIONS
      let iter = 0;
      let exited = false;
      for (iter = 1; iter <= cap; iter++) {
        let earlyExit = false;
        for (let j = i; j <= toIdx; j++) {
          const got = await runPhaseOnce(phases[j]!, iter);
          earlyExit = earlyExit || got;
        }
        if (iter >= loop.min && earlyExit) {
          exited = true;
          break;
        }
      }
      iterationsByLoop[loop.name] = exited ? iter : cap;
      i = toIdx + 1;
    } else {
      await runPhaseOnce(phase, 1);
      i++;
    }
  }

  const totalIterations = Object.values(iterationsByLoop).reduce((a, b) => a + b, 0);
  return { pipeline: "", branch: branchName, tier: tierName, iterationsByLoop, totalIterations, exec, scored, peakConcurrency };
}

/** Format a RUN-LOG in the agri two-part format (summary table + execution log). */
export function formatRunLog(report: RunReport, date: string): string {
  const iters = Object.entries(report.iterationsByLoop)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ") || "0";
  const total =
    report.scored.length > 0
      ? `${report.scored.reduce((a, b) => a + b, 0)}`
      : "unscored";
  const summary = [
    "| Date | Topic Slug | Branch | Tier | Iterations | Total Score | Verifier | Notes |",
    "|------|-----------|--------|------|------------|-------------|----------|-------|",
    `| ${date} | ${report.pipeline} | ${report.branch} | ${report.tier} | ${iters} | ${total} | n/a | run |`,
  ].join("\n");
  const logLines = report.exec.map(
    (e) =>
      `- **${date} Phase ${e.phase} — ${e.agent}** (iter ${e.iteration}): ${e.status}.${e.note ? ` ${e.note}.` : ""}`,
  );
  return [
    "# RUN-LOG",
    "",
    summary,
    "",
    `### ${report.pipeline} — ${report.branch} (${date})`,
    "",
    ...logLines,
    "",
  ].join("\n");
}

/** `murmr run <pipeline>` — deterministic orchestration skeleton. */
export async function runCommand(projectRoot: string, opts: RunOptions): Promise<number> {
  const murmurDir = join(projectRoot, "murmur");
  if (!existsSync(join(murmurDir, "pipelines"))) {
    console.error('No murmur/pipelines/ directory found. Run "murmr init" and add a pipeline first.');
    return 1;
  }
  const report = await runDoctor(murmurDir);
  if (!report.ok) {
    console.error("Refusing to run: doctor found problems. Run `murmr doctor`.");
    return 1;
  }
  const loaded = await loadIR(murmurDir);
  if (!loaded.ok) {
    console.error("Failed to load IR.");
    return 1;
  }
  const pipeline = loaded.value.pipelines.find((p) => p.name === opts.pipeline);
  if (!pipeline) {
    const avail = loaded.value.pipelines.map((p) => p.name).join(", ") || "(none)";
    console.error(`Unknown pipeline "${opts.pipeline}". Available: ${avail}.`);
    return 1;
  }

  const sel = selectBranch(pipeline, opts);
  if (!sel) {
    console.error("Pipeline has no branches to run.");
    return 1;
  }
  const { tier, phases } = resolvePhases(sel.branch, opts.tier);

  // Dispatcher selection:
  //  - an explicit test dispatcher always wins;
  //  - else, with --allow-run AND sandbox options/config, delegate to cloud sandbox runner;
  //  - else, with --allow-run AND a configured host argv, delegate to the host CLI
  //    (net-new, experimental — see docs/probes/goose-drivability.md);
  //  - else, the deterministic stub + compile-and-instruct degradation.
  let dispatch: Dispatcher = stubDispatcher;
  let usingStub = true;
  let degraded = false;
  let activeSandbox: string | undefined;

  if (opts.dispatcher) {
    dispatch = opts.dispatcher;
    usingStub = false;
  } else if (opts.allowRun) {
    const config = await loadConfig(projectRoot, { allowConfigExec: opts.allowConfigExec });
    const sandboxType = (opts.sandbox || config.run?.sandbox?.type) as "docker" | "remote" | undefined;

    if (sandboxType) {
      const sandboxConfig: SandboxConfig = {
        type: sandboxType,
        image: opts.sandboxImage || config.run?.sandbox?.image,
        endpoint: opts.sandboxUrl || config.run?.sandbox?.endpoint,
        token: opts.sandboxToken || config.run?.sandbox?.token,
        timeoutMs: opts.sandboxTimeoutMs || config.run?.sandbox?.timeoutMs,
        env: config.run?.sandbox?.env,
      };
      dispatch = makeSandboxDispatcher(sandboxConfig, projectRoot);
      usingStub = false;
      activeSandbox = sandboxType;
    } else {
      const hostArgv = config.run?.host ?? [];
      if (hostArgv.length > 0) {
        dispatch = makeHostDispatcher({ argv: hostArgv });
        usingStub = false;
      } else {
        degraded = true; // --allow-run but neither sandbox nor host configured
      }
    }
  }

  const isTTY = typeof process !== "undefined" && process.stdout && process.stdout.isTTY;
  const showBanner = !opts.dryRun || opts.verbose;

  if (showBanner || isTTY) {
    const modeDesc = opts.dryRun
      ? "dry-run (simulation)"
      : activeSandbox
        ? `cloud sandbox dispatch (${activeSandbox})`
        : opts.allowRun
          ? "live host dispatch"
          : "deterministic stub";
    console.log(`\n┌─ murmr run ───────────────────────────────────────────────────`);
    console.log(`│ Pipeline : ${pipeline.name}`);
    console.log(`│ Branch   : ${sel.name}`);
    console.log(`│ Tier     : ${tier}`);
    console.log(`│ Mode     : ${modeDesc}`);
    console.log(`└───────────────────────────────────────────────────────────────\n`);
  }

  const runReport = await execute(
    sel.name,
    sel.branch,
    phases,
    tier,
    async (agent, phase, iteration) => {
      const res = await dispatch(agent, phase, iteration);
      if (showBanner || isTTY) {
        const scoreBadge = typeof res.score === "number" ? ` [SCORE: ${res.score}]` : "";
        const noteBadge = res.note ? ` (${res.note})` : "";
        const statusIcon = res.status === "SUCCESS" ? "✓" : res.status === "SKIPPED" ? "↷" : "✗";
        console.log(`  ${statusIcon} Phase ${phase.padEnd(2)} │ ${agent.padEnd(16)} (iter ${iteration}) → ${res.status}${scoreBadge}${noteBadge}`);
      }
      return res;
    },
    {
      concurrency: opts.concurrency,
      retries: opts.retries,
      retryDelayMs: opts.retryDelayMs,
    },
  );
  runReport.pipeline = pipeline.name;

  const date = new Date().toISOString().slice(0, 10);
  const log = formatRunLog(runReport, date);

  const outDir = join(projectRoot, opts.out ?? "_architect");
  const logPath = join(outDir, "RUN-LOG.md");
  if (!opts.dryRun) {
    await Bun.write(logPath, log);
  }

  if (showBanner || isTTY) {
    console.log(`\n────────────────────────────────────────────────────────────────`);
  }

  const concInfo = runReport.peakConcurrency ? `, peak concurrency: ${runReport.peakConcurrency}` : "";
  console.log(
    `run: pipeline "${pipeline.name}" branch "${sel.name}" tier "${tier}" — ` +
      `${runReport.exec.length} turn(s)${concInfo}, loops {${Object.entries(runReport.iterationsByLoop).map(([k, v]) => `${k}:${v}`).join(", ") || "none"}}.`,
  );
  if (opts.dryRun) {
    console.log("run: --dry-run — no files written, no host CLI spawned.");
  } else {
    console.log(`run: RUN-LOG written to ${opts.out ?? "_architect"}/RUN-LOG.md`);
  }
  if (usingStub && !opts.dryRun) {
    console.log(
      "run: executed with the deterministic stub (no host CLI). To delegate real\n" +
        "     agent turns, configure run.host in murmur.config and pass --allow-run\n" +
        "     (experimental; see docs/probes/goose-drivability.md). Copilot has no\n" +
        "     headless CLI and always uses compile-and-instruct.",
    );
  }
  if (degraded) {
    console.log(
      "run: --allow-run was passed but no run.host is configured in murmur.config —\n" +
        "     degrading to compile-and-instruct. Run `murmr compile` and invoke the\n" +
        "     emitted orchestrator in your host runtime.",
    );
  }
  if (showBanner || isTTY) {
    console.log(`────────────────────────────────────────────────────────────────\n`);
  }
  return 0;
}
