# Murmuration Orchestration Layer — Test Plan

> Extracted from [`_architect/analysis/2026-06-16-murmur-orchestration-layer.md`](../analysis/2026-06-16-murmur-orchestration-layer.md) §9.
> Discipline: golden files for compilation, deterministic fixtures for logic, offline-by-default, host-CLI paths gated. The original 25 tests + golden files + externalization gate must stay green.

## Pipeline IR validation

Feed the dual-branch reference `architect.md` pipeline → loads cleanly with both CODING and RESEARCH branches, routing, tiers, loops, parallel. Malformed variants each produce a precise file-and-field error: unresolved agent reference, loop `max` of 4 (exceeds cap), `neverParallel` naming a missing agent, loop `from` pointing at an unknown phase, a branch referencing an unknown phase, routing selecting an unknown branch.

## Strict YAML subset reader (SPOF guard)

Dedicated negative-parse **fuzz corpus**: anything outside the minimal documented subset (tabs, anchors, flow-mixed, arrays-of-maps beyond the spec) must hard-ERROR, never silently mis-parse. Positive cases cover nested maps and the arrays-of-maps the frontmatter parser cannot handle.

## Pipeline compilation (golden files)

Reference pipeline → Copilot master `.agent.md`: frontmatter `agents` roster equals the union of referenced agents; body contains phase/loop/parallel tables (marked advisory). Reference pipeline → goose recipe: `sub_recipes` match phase agents; output marked advisory-only. Atomicity: fail the pipeline adapter mid-emit → output tree untouched. **goose-consumption check:** the emitted recipe parses/loads in goose (or is explicitly marked advisory if the v0.2.0 spike shows it can't).

## `run` driver (offline via stub spawn)

Phases execute in branch+tier-resolved order; a critic↔planner loop stops at `max`; a deterministic early-exit terminates before the cap; natural-language early-exit is delegated (asserted by stub contract); `neverParallel` pairs never co-dispatch; `maxConcurrent` respected; emitted `RUN-LOG.md` row matches agri columns exactly. Compile-and-instruct degradation prints manual steps when no host CLI configured (and for Copilot always) and writes nothing it shouldn't.

## Host-output handling (CI-gated, the risky path)

Malformed, oversized, and injection-bearing host output are each handled as **soft failure** that still logs a RUN-LOG row — never crashes, never evals, enforces size limits. Spawn uses argv-array (no shell string); a pipeline-derived prompt containing shell metacharacters cannot inject a command.

## Worker pool

`effective_workers` = min of the four bounds (audio2text corner cases); retries back off exponentially; a permanently-failing task → soft failure that still logs.

## Rubrics & contracts

Multi-rubric aggregation: technical /55 + business /40 + social /40 → correct weighted combined total; conditional dimensions marked N/A by task type are excluded from the denominator. Readiness gate (all dims ≥4) pass/fail. A document missing a contracted ordered output section fails `doctor`. Scoring is pure arithmetic over host-provided numbers (no LLM).

## Classifier

Representative task descriptions → expected recommended agent set from the editable taxonomy.

## Standing gates

Original 25 tests, golden files, and the knowledge-externalization scan stay green. New base-library rubric + critic-roster templates themselves pass `doctor` and the externalization scan.

## Out of scope (manual, not CI)

In-runtime functional execution against a live `claude`/`goose` CLI — exercised manually, consistent with v0.1.0.
