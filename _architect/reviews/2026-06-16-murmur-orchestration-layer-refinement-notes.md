# Refinement Notes — Murmur Orchestration Layer

**Date:** 2026-06-16
**Plan refined:** [_architect/analysis/2026-06-16-murmur-orchestration-layer.md](../analysis/2026-06-16-murmur-orchestration-layer.md)
**Critic review:** [_architect/reviews/2026-06-16-murmur-orchestration-review.md](2026-06-16-murmur-orchestration-review.md)

## Iteration 1

### Refinement Summary

This iteration resolved all three critical weaknesses and all five important weaknesses from the critic's review, and incorporated the business-critic's guidance to lead with the portable orchestration IR and demote `murmur run`. The most significant changes: (1) every false "mirrors the init spawn-fallback pattern" claim was struck and replaced with an honest framing of `murmur run` as a net-new, no-precedent code-execution surface that *inverts* the init dependency direction; (2) the deterministic/generative split was rewritten throughout to state precisely that murmur owns only iteration-counting, subprocess concurrency-capping, rubric arithmetic over host-supplied numbers, and RUN-LOG formatting — with dispatch, early-exit, and gating reclassified as generative/delegated; (3) the pipeline IR was redesigned from a single linear `phases[]` to a branch-aware model (routing + named branches + in-branch tiers) and the rubric IR gained weighted multi-rubric aggregation plus conditional dimensions, so the dual-branch architect fixture and multi-critic scoring can round-trip. Security, goose-drivability, strict-YAML, and host-output-parsing tests were added; v0.4–v0.7 were gated on adoption signal. Metadata Status set to `in-review`.

### Business-Social Tensions Resolved

No business-social tensions arose: the social-critic was N/A (developer tooling, no end-user equity surface). The business-critic's guidance was incorporated without tension against any social concern — the plan now leads with the portable orchestration IR as the moat (§1, §6, §12), demotes `murmur run` to an explicitly optional convenience targeting `claude`/`goose` only, and gates v0.4–v0.7 on adoption signal (§8, §12).

### Resolved Critical Weaknesses

- **False precedent (Finding 0).** Removed every "mirrors/reuses the init spawn-fallback pattern" claim across §3, §5, §6, §7, §11. Reframed `murmur run`'s subprocess execution as a net-new capability and code-execution surface with zero precedent in v0.1.0, noting it *inverts* the init dependency direction (init emits an artifact the host invokes; run makes murmur the active caller). The dependency-direction principle is kept intact but justified on its own merits, not by a non-existent precedent. `run` is now explicitly named the riskiest, most novel part.
- **Thin determinism / oversold governance.** Rewrote §1, §6, §7, §10 with an honest split: murmur deterministically owns only iteration-counting against caps, subprocess concurrency-capping, rubric arithmetic from host-provided numbers, and RUN-LOG formatting. Dispatch selection (natural-language predicates), loop early-exit ("all dimensions ≥4"), and gating are reclassified as generative and delegated to the host LLM. "Real governance guarantees" was replaced with an enforces-vs-computes-vs-delegates breakdown.
- **IR cannot model the fixture.** Redesigned the pipeline IR in §7 to support: (a) a top-level `routing` block with a classification step, (b) named `branches` (coding, research) each with their own phase sequence, and (c) tiers as phase subsets *within* a branch. Added the rubric `rubricSet` construct for weighted multi-rubric totals (technical/55 + business/40 + social/40 with a floating denominator) and conditional dimensions (`MANDATORY`/`CONDITIONAL`, `appliesWhen`/`naWhen`, N/A excluded from denominator). Updated the dogfooding claim (§8, §12) to require round-tripping BOTH branches.

### Resolved Important Issues

- **Goose drivability.** §7 and §8 now state that the goose adapter emits a flat, unordered `sub_recipes` list with no native loop/parallel semantics; ordering and caps are emitted as advisory metadata (declared degradations), making goose pipeline output advisory-only like Copilot. Added a v0.2.0 goose-drivability spike (gates v0.2d) and a v0.2b goose-recipe-consumption check.
- **Copilot has no CLI.** §6, §7, §11 now state plainly that Copilot has no headless CLI, so `murmur run` for Copilot users always degrades to compile-and-instruct; the host-CLI execution path targets `claude` and `goose` only.
- **Security gap.** §10 now leads with the code-execution/prompt-injection surface: `--allow-run` opt-in gate (mirroring `--allow-config-exec`), argv-array spawning (no shell string), in-repo-target validation, constrained-config-loader implications for pipelines referencing executable config, and treating host output as untrusted (no eval, size limits, soft-fail). Pipelines/rubrics/RUN-LOGs added to the publish scrub set with a test.
- **YAML reinvention.** §3, §7, §10 now constrain the pipeline body to a strict, minimal, formally-specified YAML subset that hard-errors (PARSE-ERROR) on anything outside it — never silent mis-parse — backed by a dedicated negative/fuzz corpus. The one-vetted-dependency alternative is weighed explicitly and rejected in favor of the zero-dependency invariant plus strict erroring.
- **Test gap.** §9 now pulls the risky paths into CI: malformed/oversized/injection-bearing host output handled as soft failure via a stub host CLI; a negative-parse/fuzz corpus for the YAML subset; a goose-recipe-consumption check; plus dual-branch validation, multi-rubric aggregation, and conditional-dimension scoring tests.

### Acknowledged Minor Issues

- **Single-file RUN-LOG append race** — addressed in §10 (per-run files + index or file-lock).
- **`_architect/` hardcoding** — resolved by making the run-output directory configurable (default `_architect/`) in §7 and §10.
- **Score-emission contract** — resolved by defining a machine-parseable score-emission format the critic must emit and a parser spec in §7.
- **Multi-rubric aggregation** — resolved as part of critical weakness 3 (rubricSet).
- **v0.2c parallelism enforcement vs counting** — resolved in §8/§9: v0.2c is counting only; enforcement arrives with the v0.5 worker pool.

### Remaining Open Questions

- The once-vs-per-turn goose execution fork is resolved *procedurally* by the v0.2.0 spike rather than decided in advance; the spike outcome determines whether v0.2d ships or `run` stays compile-and-instruct. This is the one item that depends on external (goose CLI) behavior not verifiable from the codebase alone.
- Whether real adoption signal will justify funding v0.4–v0.7 is left open by design (the adoption gate), to be answered in-market after v0.2–v0.3.
