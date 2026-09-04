# Murmuration Orchestration Layer — Implementation Phases

> Extracted from [`_architect/analysis/2026-06-16-murmur-orchestration-layer.md`](../analysis/2026-06-16-murmur-orchestration-layer.md) (final, 50/55).
> Target repo: `/Users/cnickson/projects/personal/murmur`.

## Guiding principles (inherited from v0.1.0)

- Compile, don't execute. `murmur run` is **optional** and **net-new** surface — it does NOT mirror init (init has no subprocess spawning; the host LLM calls the CLI). `run` inverts that direction and is the riskiest part.
- Zero runtime dependencies. The frozen v0.1.0 schema + 25 tests + golden files + externalization gate are a standing release gate.
- Deterministic split: murmur ENFORCES mechanical caps (max iterations, max concurrency, neverParallel) and COMPUTES rubric arithmetic from host-supplied numbers; the host LLM owns all DECISIONS (dispatch, early-exit, scoring judgments).
- Lead with the **portable orchestration IR** as the moat; gate v0.4–v0.7 on adoption signal.

## v0.2 — Orchestration IR + `run` (top priority, keystone)

**v0.2a — Pipeline IR & schema.** `src/schema/pipeline.ts` (`PipelineDefinition`): `routing` (selects a branch), named `branches[]` (each with its own `phases[]` sequence — models architect's dual CODING/RESEARCH branches), in-branch `tiers[]` (phase subsets), `loops[]` (name, from, to, min, max≤3, earlyExit), `parallel{maxConcurrent, neverParallel[][]}`. Extend `IRSet` (`pipelines[]`), add `validatePipeline`, `load.ts` glob, `runDoctor` ref-integrity + loop-cap + branch/phase checks. Pipeline body is a **strict, minimal, well-specified YAML subset** parsed by a reader that hard-ERRORS (never silently mis-parses) on anything outside the subset. Author `murmur/pipelines/architect.md` round-tripping BOTH branches as the fixture. **Gate:** doctor validates the fixture, rejects malformed.

**v0.2b — Pipeline compilation.** Optional `compilePipeline?` on `RuntimeCompiler`, called from `emitAll` only when present. Copilot: master `.agent.md` with phases/loops/parallel as prose tables + union roster in `agents` frontmatter (caps are **advisory**). goose: recipe with `sub_recipes`; since goose recipes can't express loops/parallel/ordering natively, goose pipeline output is **advisory-only** with a declared degradation. Golden-file tests both; atomicity re-asserted. **Schema freezes here.**

**v0.2.0 spike (gate for v0.2d):** verify a goose runtime can actually consume the emitted recipe; if not, mark goose pipeline output advisory-only.

**v0.2c — `run` deterministic skeleton.** `src/commands/run.ts`: load+validate, resolve branch+tier to a phase sequence, walk phases, count loop iterations against caps, enforce early-exit (natural-language conditions delegated to host; only deterministic flags evaluated by murmur), bookkeep parallelism, emit `RUN-LOG.md` (agri format: date, slug, tier, iterations, total, verdict, notes). Stub echo spawn target. `--dry-run`. All tests offline.

**v0.2d — Host-CLI delegation (NET-NEW, gated).** `Bun.spawn` (argv-array, never shell-string) to `claude`/`goose` CLIs only — **Copilot has no headless CLI, so `run` always degrades to compile-and-instruct for Copilot.** Gated behind explicit `--allow-run`. Capture host output as **untrusted** (size limits, no eval). Unparseable output → soft failure that still logs. Compile-and-instruct degradation when no host CLI configured.

## v0.3 — Rubrics & output contracts

`rubric` IR kind (`src/schema/rubric.ts`): `dimensions[]` (label, mandatory/optional questions, 1–5 scale, weight, **conditional** flag), `severityLevels`, `readinessGate`. Support **weighted multi-rubric aggregation** (technical /55 + business /40 + social /40) and conditional dimensions (MANDATORY vs CONDITIONAL/N-A by task type). `murmur score <doc> --rubric <name>`: deterministic weighted arithmetic over host-provided numbers. Extend `InstructionDefinition` with optional ordered `sections` contract, enforced by `doctor`. Ship a generic technical-scorecard rubric.

## v0.4 — Dispatch tables, classifier, rosters (gate on adoption)

Optional `invokeWhen`/`skipWhen` agent frontmatter (block scalars, existing parser). `murmur classify <task>` matches task→agent-set from an editable taxonomy. Ship generic business-critic, social-critic, data-critic, fact-checker, verifier templates whose score-emission format matches what `score` consumes.

## v0.5 — Concurrency engine

`src/util/workerPool.ts`: `effective_workers = min(configured, rpm, tpm, n_tasks)` + exponential-backoff retry (port of audio2text). Wire into `run`'s parallel step; enforce `maxConcurrent` + `neverParallel` as hard limits. Default 1 worker when unspecified.

## v0.6 — Adapters & plugins (gate on adoption)

Claude Code, Cursor, ACP adapters (each implements `RuntimeCompiler` + `compilePipeline` or declared degradation). npm-package plugin discovery. Directory-structured skill assets.

## v0.7 — DX hardening (gate on adoption)

`init`-time `lefthook.yml` + CODEOWNERS generation. `defineCollection`-style typed validation export for plugin authors. `murmur docs` (markdown pack + run-logs → browsable HTML, modeled on chat/build.py).

## Definition of done — v0.2

(1) `doctor` validates the dual-branch `architect.md` fixture and rejects malformed pipelines; (2) it compiles to golden-file-correct Copilot + goose output; (3) `murmur run --dry-run` walks both branches offline, enforces loop caps + parallelism, emits a correct RUN-LOG. Original 25 tests + golden files + externalization gate stay green.
