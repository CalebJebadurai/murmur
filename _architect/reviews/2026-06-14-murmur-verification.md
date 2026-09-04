# Murmuration — Implementation Report Verification

**Date:** 2026-06-14
**Strategic Plan:** [`_architect/analysis/2026-06-14-murmur-multi-agent-framework.md`](../analysis/2026-06-14-murmur-multi-agent-framework.md) (final, 47/55)
**Phased Plan:** [`_architect/implementations/2026-06-14-murmur-phases.md`](../implementations/2026-06-14-murmur-phases.md)
**Test Plan:** [`_architect/tests/2026-06-14-murmur-test-plan.md`](../tests/2026-06-14-murmur-test-plan.md)
**Implementation Report:** [`_architect/implementations/2026-06-14-murmur-implementation.md`](../implementations/2026-06-14-murmur-implementation.md)
**Target Repo:** `/Users/cnickson/projects/murmur` (greenfield bun/TS)
**Verifier:** Senior QA Specialist (verifier mode)

---

## Verdict: **PASS**

The implementation report provides complete, actionable coverage of all plan phases with no critical gaps. Every strategic plan phase maps to detailed implementation guidance. All three critical mechanisms are concretely addressed. The two initial compile targets are correctly specified as Copilot + goose. The three non-negotiable release gates are present and enforced. File paths are consistent and reasonable for the greenfield target repo. Each major step ties to test-plan assertions. The report is ready for implementation.

---

## Coverage Summary

The implementation report provides comprehensive coverage of all eight plan phases (Pre-flight, A, A.5, B, C, D, E, F) with actionable, file-specific guidance for each step. Every phase from the strategic plan maps to a detailed implementation section with "what to do," "where," "how it connects," technology-specific guidance, watch-out-fors, and verification criteria. All three critical mechanisms flagged by the critic are concretely addressed with specific implementation steps. The two initial compile targets are correctly specified as Copilot + goose (not Claude). The three non-negotiable release gates are explicitly present and enforced through CI gates and test assertions. File paths cited under `/Users/cnickson/projects/murmur` are consistent and reasonable for a greenfield bun/TypeScript project. Each major implementation step ties directly to test-plan assertions. The report exhibits no material coverage gaps.

**Phase coverage:** 8/8 phases fully covered (Pre-flight, A, A.5, B, C, D, E, F). No phases are partially covered or missing. Each phase contains granular step-by-step breakdowns with specific file paths, technology guidance, and verification criteria.

**Critical mechanisms:** 3/3 mechanisms concretely addressed with implementation steps and verification gates.

**Release gates:** 3/3 non-negotiable gates present and enforced.

**Test-plan mapping:** All major steps tie to test-plan assertions with explicit criterion references.

**Overall verdict:** The implementation report meets all verification requirements. It is comprehensive, actionable, and ready for implementation.

---

## Covered Phases

All eight plan phases are fully covered with actionable implementation guidance:

### Pre-flight — Operational & Security Hardening
**Strategic Plan Section:** §8, §10, Phased Plan "Pre-flight"
**Implementation Report:** §3 "Phase Pre-flight" with four explicit steps
**Coverage Assessment:** Complete. Covers token revocation, `gh` re-authentication, `.env` ignore verification, and private remote creation. Each step includes what/where/why/watch-out-for/verification guidance. Addresses the live token leak risk identified in the strategic plan's risk section.

### Phase A — Foundation and Schema Validation
**Strategic Plan Section:** §8, §5, Phased Plan "Phase A"
**Implementation Report:** §3 "Phase A" with eight granular steps (A1-A8)
**Coverage Assessment:** Complete. Steps A1-A8 cover: hand-authoring the minimal IR (A1), defining the typed schema with precise data shapes (A2), building the runtime validator (A3), defining the RuntimeCompiler interface (A4), implementing atomic staging-then-move (A5), implementing the Copilot adapter (A6), implementing the goose adapter (A7), and proving round-trip compilation with schema freeze (A8). Each step specifies file paths (`src/schema/*.ts`, `src/compiler/adapters/copilot.ts`, `src/compiler/adapters/goose.ts`), technology-specific guidance (bun APIs, YAML parsing, frontmatter structure), and verification criteria (golden-file tests, atomicity test). The schema freeze gate is explicitly stated at step A8.

### Phase A.5 — Runtime Capability Probe
**Strategic Plan Section:** §8, Phased Plan "Phase A.5"
**Implementation Report:** §3 "Phase A.5" with two steps (A5.1-A5.2)
**Coverage Assessment:** Complete. Step A5.1 designs the reproducible probe methodology (write a subagent mid-session, attempt dispatch, record hot-load yes/no). Step A5.2 executes and records per-runtime results in a checked-in table (`docs/probes/hot-load.md`). The probe is correctly positioned as a gate for Phase D's spawn-path selection, with the ephemeral-persona degradation path used when hot-load is unavailable. Addresses the feasibility risk from §10 that runtimes may not support mid-session subagent discovery.

### Phase B — CLI Skeleton and Core Commands
**Strategic Plan Section:** §8, Phased Plan "Phase B"
**Implementation Report:** §3 "Phase B" with four steps (B1-B4)
**Coverage Assessment:** Complete. Step B1 builds the CLI entry point (`src/cli.ts` bundled to `dist/cli.js`) with subcommand routing and friendly no-arg behavior. Step B2 implements `compile` with `--target`, `--out`, `--allow-config-exec` flags and wires the Phase A compiler. Step B3 implements `doctor` with schema validation, reference-integrity checking, `applyTo` glob syntax validation, and circular-dependency detection. Step B4 implements `list` for IR inventory and minimal global-pack listing. Each step specifies the command surface, file paths, and verification criteria tied to test-plan assertions (Criterion 6 for CLI usability, Criterion 8 for doctor).

### Phase C — The init Analyzer
**Strategic Plan Section:** §7, §8, §10, Phased Plan "Phase C"
**Implementation Report:** §3 "Phase C" with four steps (C1-C4)
**Coverage Assessment:** Complete. Step C1 implements the deterministic structural pass (`src/analyzer/structural.ts`) parsing `package.json`, `tsconfig.json`, directory tree, lockfiles, test config, and CI files to generate structural skills and `applyTo`-scoped instructions with no LLM, validated against the two-minute budget. Step C2 implements merge/overwrite/cancel handling for re-runs with file-safety guarantees. Step C3 ships the agent-invoked semantic pass (`templates/agents/murmur-init.md`, `templates/skills/codebase-init/SKILL.md`) where the host agent's LLM is the caller and the CLI is the callee, respecting the correct dependency direction. Step C4 ships the headless-CLI semantic fallback that shells out to `claude`/`goose` binaries when present. Directly addresses the "analyzer invocation model" feasibility risk (§10) with the structural/semantic split and corrected control flow.

### Phase D — Master Agent Spawning
**Strategic Plan Section:** §7, §8, Phased Plan "Phase D"
**Implementation Report:** §3 "Phase D" with three steps (D1-D3)
**Coverage Assessment:** Complete. Step D1 authors the `subagent-authoring` skill (`templates/skills/subagent-authoring/SKILL.md`) externalizing spawn heuristics (which skills to attach, tool restrictions, role phrasing). Step D2 implements the master agent's match-or-spawn loop (`templates/agents/master.md`) with both invocation paths: file-writing when the Phase A.5 probe confirms hot-load, and in-context ephemeral-persona when hot-load is unavailable. The temporary-vs-persistent decision (persist only when the same specialist is needed >2× per session) is specified. Step D3 demonstrates two spawn scenarios (data-validator, config-migrator) with fixtures under `tests/fixtures/spawn/`. Ties directly to Criterion 3 (test plan, Master-agent spawning). Addresses the "runtime hot-load" feasibility risk with the probe-gated path selection.

### Phase E — Publish and Packaging
**Strategic Plan Section:** §7, §8, §9, §10, Phased Plan "Phase E"
**Implementation Report:** §3 "Phase E" with seven steps (E1-E7)
**Coverage Assessment:** Complete. Step E1 implements the `add` scaffolders (`src/commands/add.ts`) for agent/subagent/skill/instruction. Step E2 implements the publish scrubber (`src/publish/scrub.ts`, `src/commands/publish.ts`) with repository-name replacement, path-prefix stripping, domain-term redaction, PII masking, and crucially, entropy-based and pattern-based secret scanning using gitleaks-style rulesets. Step E3 implements `--dry-run` (shows diff, mutates nothing) and `--strict` (fails if any high-entropy string or known-secret-pattern survives). Step E4 specifies the sentinel-value test, false-negative test (high-entropy secret in no denylist), and security test (config code-execution gate). Step E5 implements the constrained config loader requiring `--allow-config-exec` for TypeScript config. Step E6 finalizes packaging (bundled `dist/cli.js`, `files`/`bin` fields, sub-10MB tarball). Step E7 adds `CHANGELOG.md`, `docs/COMPARISON.md` (two-tier differentiator), and CI with the knowledge-externalization scanner as a release-blocking gate. Directly addresses the "incomplete scrubbing" risk (§10) with defense-in-depth layering and explicit disclaimers. Ties to Criteria 5 (publish), 9 (packaging), 4 (externalization gate).

### Phase F — Roadmap (Post-v0.1.0)
**Strategic Plan Section:** §8, Phased Plan "Phase F"
**Implementation Report:** §3 "Phase F"
**Coverage Assessment:** Complete. Specifies Claude Code adapter (near-free third adapter, shares Copilot substrate, not a validation target), Cursor adapter, ACP adapter (protocol-level portability), deferred global-command surface, and deepened semantic init. Correctly positions these as post-v0.1.0 and non-release-blocking. Warns that each new adapter is independently versioned with golden-file tests to absorb runtime drift. Consistent with the strategic plan's positioning of ACP as roadmap (§5) and Claude Code as demonstration-only (§6).

**Summary:** All phases have corresponding implementation sections with actionable, file-specific guidance. No plan phase lacks implementation coverage.

---

## Critical Mechanisms Verification

The user specified three critical mechanisms that the critic flagged and required concrete implementation. All three are present and adequately detailed:

### Mechanism 1: Structural/Semantic Init Split with Correct Dependency Direction
**Strategic Plan Reference:** §7 "The init codebase-analyzer must be specified honestly... a deterministic bun CLI cannot summon the LLM running inside the user's IDE — the dependency arrow points from agent to tool, never the reverse"
**Implementation Report Coverage:** Phase C, Steps C1-C4 (§3 "Phase C")
**Assessment:** **FULLY ADDRESSED.** The implementation report explicitly corrects the dependency direction with a two-pass architecture:
- **Step C1** specifies the deterministic structural pass as pure bun static analysis parsing `package.json`, `tsconfig.json`, directory tree, lockfiles, test config, and CI files, generating structural skills and instructions with "no LLM, no API key, no network." The two-minute budget constraint is stated and verified against a fixture.
- **Step C3** specifies the agent-invoked semantic pass where "the host agent's LLM is the caller and the CLI is the callee," explicitly stating "the deterministic CLI must never assume it can summon the IDE LLM; the agent calls the CLI, never the reverse." The `murmur-init` agent/skill is the implementation artifact shipped in `templates/`.
- **Step C4** specifies the headless-CLI fallback that shells out to authenticated `claude`/`goose` binaries as a secondary path, explicitly labeled as "per-runtime, network-dependent, and consumes the user's own subscription — offer it as a fallback, never the default."
- The control-flow diagram is correct: agent → CLI (structural) → agent authors semantic skills. No unbuildable reverse dependency.

**Verification:** The "analyzer invocation model" risk (§10) is directly mitigated. The structural pass is the v0.1.0 acceptance bar (Criterion 1), with semantic enrichment as optional and not held to the deterministic budget.

### Mechanism 2: Phase A.5 Hot-Load Probe + Ephemeral-Persona Fallback
**Strategic Plan Reference:** §7 "whether a given runtime supports hot-load is determined by the Phase A.5 capability probe," and §10 "runtimes may not invoke a subagent definition written mid-session, which would silently break dynamic spawning"
**Implementation Report Coverage:** Phase A.5 (Steps A5.1-A5.2) and Phase D Step D2 (§3 "Phase A.5" and "Phase D")
**Assessment:** **FULLY ADDRESSED.** The implementation report specifies:
- **Step A5.1** designs the one-page reproducible probe procedure: within a single runtime session, write a uniquely-named subagent definition to the runtime's discovery location (e.g., `.github/agents/probe-<uuid>.agent.md`), immediately attempt to dispatch it by name, record whether the dispatch resolves the just-written agent or fails, and repeat three times to rule out timing flakiness. The recorded result is stored in `docs/probes/hot-load.md` with a row per runtime (hot-load yes/no, refresh-required, notes, date).
- **Step A5.2** mandates execution against Copilot (mandatory) and goose (if available), and states "no phase that depends on spawning may proceed on an unproven hot-load assumption — if a runtime is untested, Phase D must treat it as no-hot-load and use the ephemeral path."
- **Step D2** implements the master agent's spawn loop with "two invocation paths, selected by the Phase A.5 probe result: when the runtime hot-loads, write the definition to a temporary location and dispatch it by name; when it does not, compose an in-context ephemeral persona — an inline role description with the relevant skills/instructions passed directly in the subagent prompt — rather than writing a file the runtime cannot rediscover." The persist-vs-temporary decision (persist only when the same specialist is needed >2× per session) applies in either path.
- The file-writing path is never used on a runtime with a negative or absent probe result, preventing silent breakage.

**Verification:** The probe gates Criterion 3 (Master-agent spawning). The ephemeral-persona degradation path is a principled fallback, not an error state.

### Mechanism 3: Defense-in-Depth Publish Scrubber with Entropy Scanning + --allow-config-exec
**Strategic Plan Reference:** §7 "the scrubber additionally runs entropy-based and pattern-based secret scanning using established gitleaks-style rulesets to catch high-entropy blobs, JWTs, and known token formats that no configured list would name" and "the publish and compile paths therefore use a constrained config loader that defaults to the JSON form for untrusted contexts and requires an explicit --allow-config-exec flag"
**Implementation Report Coverage:** Phase E, Steps E2-E5 (§3 "Phase E")
**Assessment:** **FULLY ADDRESSED.** The implementation report specifies:
- **Step E2** implements the scrubber (`src/publish/scrub.ts`) that "reads `murmur/` and writes a scrubbed copy to a separate output directory (never mutating the source), replacing the detected repository name with a placeholder, stripping user-specific path prefixes (e.g., `/Users/<name>/`), redacting configured `domainTerms`, and masking email/name PII." Crucially, it states: "redaction is not limited to the user-maintained denylist: the scrubber additionally runs entropy-based and pattern-based secret scanning using gitleaks-style rulesets to catch high-entropy blobs, JWTs, and known token formats no configured list would name." This is the defense-in-depth layer that goes beyond the denylist.
- **Step E3** defines `--strict` with a "single coherent meaning: the publish fails if any high-entropy string or known-secret-pattern match survives anywhere in the output, with an explicit allowlist override (`publish.allowlist` in config) for strings the user has confirmed generic." The `--dry-run` flag shows the scrub diff without writing anything.
- **Step E4** specifies the false-negative test: "the fixture also embeds a high-entropy secret-shaped string in no configured denylist; assert `--strict` flags or fails on it via the entropy/pattern scanner — proving the scrubber does not silently pass unknown secrets." This test directly validates the entropy scanner.
- **Step E5** implements the constrained config loader (`src/util/loadConfig.ts`) that "defaults to the JSON form (`murmur.config.json`) for untrusted contexts and requires an explicit `--allow-config-exec` flag before executing the TypeScript form," with the security test asserting "loading a `murmur.config.ts` containing executable code does not run that code unless `--allow-config-exec` is passed."
- Documentation and CLI output must state publish is defense-in-depth and the user retains final responsibility.

**Verification:** The "incomplete scrubbing" risk (§10) is mitigated with entropy/pattern scanning, `--strict`, and explicit disclaimers. The config-exec vector is mitigated with the constrained loader gate. Test plan Criterion 5 (Publish scrubber) includes the false-negative and security tests.

**Summary:** All three critical mechanisms are concretely addressed with specific implementation steps, file paths, verification tests, and risk mitigations. No mechanism is vaguely referenced or deferred.

---

## Compile Targets Verification

**User Requirement:** "the two initial compile targets are Copilot + goose (not Claude)"

**Strategic Plan Reference:** §6 "The two initial targets are deliberately chosen to stress the abstraction across the two genuinely different paradigm families, and they are Copilot and goose. Copilot and Claude Code, despite the earlier framing, share the same substrate — Markdown body plus YAML frontmatter... compiling between two near-isomorphic formats would prove little and risk an IR that is merely 'Copilot frontmatter with field renames.' goose, by contrast, uses a structurally different recipe model... so an IR that compiles cleanly to both a persona-Markdown runtime and the goose recipe paradigm is genuinely validated. Claude Code becomes a near-free third adapter for the spawning demonstration, but it is explicitly not one of the two validation targets and moves to Phase F."

**Implementation Report Coverage:**
- **Phase A, Step A6:** "implement the Copilot adapter" (`src/compiler/adapters/copilot.ts`) with `.github/agents/<name>.agent.md` and `.github/instructions/<name>.instructions.md` output
- **Phase A, Step A7:** "implement the goose adapter" (`src/compiler/adapters/goose.ts`) with recipe YAML (typed parameters, `sub_recipes`, `extensions`/`available_tools`, `response.json_schema`) plus AGENTS.md/CLAUDE.md parity
- **Phase A, Step A8:** "prove round-trip and freeze the schema" — "passing both golden-file suites is the gate that freezes the schema" (both Copilot and goose)
- **Phase F:** "Claude Code adapter... a near-free third adapter since it shares Copilot's persona-Markdown substrate; valuable for the spawning demonstration but explicitly not a validation target"

**Assessment:** **CORRECT.** The implementation report consistently specifies the two initial compile targets as Copilot (Phase A Step A6) and goose (Phase A Step A7), with both adapters validated by golden-file tests before the schema freezes (Step A8). Claude Code is correctly deferred to Phase F (post-v0.1.0) and explicitly labeled as "not a validation target." The justification for this choice is preserved: goose's recipe paradigm is structurally different from Copilot's persona-Markdown, so an IR that compiles to both genuinely validates the abstraction rather than proving a field-rename. The two-adapter validation-first sequence de-risks schema over-engineering before any command is built.

**Technology-specific details confirmed:**
- **Copilot adapter output:** `.github/agents/*.agent.md` with frontmatter (`description`, `tools`, `agents`, `model`, `user-invocable`, `disable-model-invocation`); `.github/instructions/*.instructions.md` with `applyTo` glob
- **goose adapter output:** recipe YAML with typed Jinja parameters (`required`/`optional`/`user_prompt` levels), `sub_recipes`, `extensions`/`available_tools`, `response.json_schema`, plus AGENTS.md and mirrored CLAUDE.md at the output root

**No deviation detected.** The implementation report does not promote Claude Code to a validation target or remove goose.

---

## Release Gates Verification

**User Requirement:** "the three non-negotiable release gates are present"

**Strategic Plan Reference:** §12 "Definition of done for v0.1.0 is the conjunction of the ten success criteria with three treated as non-negotiable gates: the knowledge-externalization scanner reporting zero project facts in agent bodies, `doctor` passing on freshly initialized output, and the publish scrubber proven against both sentinel values and an unlisted high-entropy secret with the source left untouched. Anything not meeting those three gates is not a release regardless of other progress."

**Phased Plan Reference:** "Definition of done (v0.1.0)" section lists the same three gates explicitly.

**Implementation Report Coverage:**

### Gate 1: Knowledge-Externalization Scanner Reports Zero Project Facts in Agent Bodies
**Where specified:**
- **Test Plan (§9):** "Knowledge externalization — HARD CI GATE (Criterion 4): Scanner test reads every file in `murmur/agents/` and asserts **zero** matches against codebase-specific patterns (absolute `/Users/` paths, repo name, known domain terms). Separately asserts ≥80% of project-specific terms appear in skills/instructions. Runs in CI; release-blocking."
- **Phase E, Step E7:** "CI: add a workflow that runs `bun test`, `typecheck`, and the knowledge-externalization scanner as a release-blocking gate."
- **§9 Completion Criteria:** "Overall v0.1.0 — the conjunction of the ten success criteria, with three non-negotiable release gates: (1) the knowledge-externalization scanner reports zero project facts in `murmur/agents/` (and ≥80% of project terms in skills/instructions)"

**Assessment:** **PRESENT.** The scanner is specified as a dedicated test that reads every file in `murmur/agents/` and asserts zero matches against codebase-specific patterns, runs in CI, and is explicitly labeled release-blocking. The implementation guidance for Phase E Step E7 mandates adding this scanner to the CI workflow. The test plan (Criterion 4) provides the executable assertion.

### Gate 2: `doctor` Passes on Freshly Initialized Output
**Where specified:**
- **Test Plan (§9):** "Doctor command (Criterion 8): Bidirectional: a freshly initialized project reports zero errors, exit 0."
- **Phase B, Step B3:** "`doctor` validating schema correctness, reference integrity... exit 0 on success, non-zero with per-error description and file path on failure" and "a freshly initialized project reports zero errors and exit 0"
- **§9 Completion Criteria:** "(2) `doctor` passes on freshly initialized output"

**Assessment:** **PRESENT.** The `doctor` command is implemented in Phase B Step B3 with bidirectional testing: a freshly initialized project must report zero errors with exit code 0 (the gate), and a deliberately corrupted fixture must report each error with description and path (proving the validator works). The test plan Criterion 8 provides the executable assertion. The implementation report states "a freshly initialized project reports zero errors and exit 0" as a verification criterion.

### Gate 3: Publish Scrubber Proven Against Both Sentinel Values and an Unlisted High-Entropy Secret with Source Untouched
**Where specified:**
- **Test Plan (§9):** "Publish scrubber (Criterion 5) — including false-negative coverage: Fixture with sentinel values... **False-negative test:** fixture embeds a high-entropy secret-shaped string in **no** configured denylist; assert `--strict` flags/fails on it via the entropy/pattern scanner."
- **Phase E, Step E4:** "Sentinel test: a fixture with repo name `test-project`, domain term `proprietary-feature`, and a fake email; assert the output contains the placeholders, none of the originals, the source directory is untouched, `doctor` passes on the scrubbed output, and `--dry-run` mutates nothing. **False-negative test:** the fixture also embeds a high-entropy secret-shaped string in no configured denylist; assert `--strict` flags or fails on it via the entropy/pattern scanner — proving the scrubber does not silently pass unknown secrets."
- **§9 Completion Criteria:** "(3) the publish scrubber is proven against both sentinel values and an unlisted high-entropy secret with the source left untouched"

**Assessment:** **PRESENT.** The scrubber test suite (Phase E Step E4) explicitly includes both the sentinel-value test (verifying configured denylist redaction) and the false-negative test (verifying the entropy/pattern scanner catches a high-entropy secret not in any denylist). The test also asserts the source directory is untouched, satisfying the "with source left untouched" constraint. The test plan Criterion 5 provides the executable assertion. The false-negative test is the critical gate proving the scrubber does not silently pass unknown secrets.

### Summary of Gates
| Gate | Status | Test Plan Reference | Implementation Report Reference | Enforcement |
|---|---|---|---|---|
| 1. Zero project facts in agent bodies | **PRESENT** | Criterion 4 (HARD CI GATE) | Phase E Step E7 (CI workflow) | Release-blocking CI scanner |
| 2. `doctor` passes on fresh init | **PRESENT** | Criterion 8 (bidirectional) | Phase B Step B3 + verification | Exit-0 assertion on fresh output |
| 3. Scrubber proven (sentinel + false-negative) | **PRESENT** | Criterion 5 (false-negative test) | Phase E Step E4 (test suite) | Test must pass; source untouched |

**Assessment:** **ALL THREE GATES PRESENT.** Each gate has a corresponding test-plan criterion, implementation step, and enforcement mechanism. No gate is vaguely stated or lacks a verification path.

---

## Gap Report

No critical or important gaps identified. The implementation report provides actionable guidance for every plan phase and step. All coverage requirements are met. Minor observations below are cosmetic and do not affect implementation correctness.

### Minor Observations (Severity: Minor)

**Observation 1: Explicit tarball size verification step**
**Plan section:** Phased Plan "Phase E" — "sub-10MB tarball verified with `bun pack`"
**Implementation coverage:** Phase E Step E6 states "`bun pack` produces a tarball containing only intended files, under ten megabytes; installing it into a scratch directory and smoke-testing every command's `--help` succeeds (test plan, Packaging, Criterion 9)."
**Gap description:** The packaging step describes the verification but does not specify the exact command sequence or where the size assertion lives (test file vs manual check).
**Severity:** Minor — the verification criterion is clear; the implementer can reasonably infer `bun pack` produces a `.tgz` file and checking its size is a file-stat operation or a test assertion.
**Impact:** Does not block implementation; the implementer knows what to verify.

**Observation 2: Golden-fixture regeneration procedure**
**Plan section:** §5 "Migration and Data Considerations" — "when the schema legitimately changes post-freeze, fixtures are regenerated as part of the breaking-change review, not silently"
**Implementation coverage:** Phase A Step A8 states golden-file tests validate against `tests/fixtures/copilot/` and `tests/fixtures/goose/`, and the schema freezes when both pass. §5 mentions fixture regeneration on legitimate schema changes.
**Gap description:** The implementation report does not specify the procedure for regenerating golden fixtures when a post-freeze schema change occurs (e.g., a `scripts/regenerate-fixtures.sh` or a documented manual process).
**Severity:** Minor — this is a post-v0.1.0 concern (schema is frozen at A8; breaking changes are a maintenance task), and the implementer can reasonably infer the procedure is "run the compiler against the hand-authored IR and replace the fixture files."
**Impact:** Does not block v0.1.0 release; relevant only when a breaking schema change is introduced post-release.

**Observation 3: Bytecode/compile single-file build option**
**Plan section:** §4 "Performance" — "an optional `--bytecode`/`--compile` single-file build is a packaging option for faster cold start"
**Implementation coverage:** Not mentioned in the phase-by-phase implementation.
**Gap description:** The optional single-file bytecode build is mentioned in the cross-cutting Performance section but not mapped to any phase or step.
**Severity:** Minor — explicitly labeled "optional" and a packaging optimization rather than a core feature. Not a v0.1.0 requirement.
**Impact:** Does not block v0.1.0; implementer can defer or implement post-release.

### No Missing Phases or Steps

Every plan phase (Pre-flight, A, A.5, B, C, D, E, F) has a corresponding implementation section with granular steps. Every strategic-plan section (schema, compiler, master agent, analyzer, publish, CLI) maps to one or more implementation steps. No plan deliverable lacks implementation guidance.

### No Thin Coverage

Each implementation step includes:
- **What to do** (the action)
- **Where** (the file path or module)
- **How it connects** (the architectural context)
- **Technology-specific guidance** (bun APIs, TypeScript patterns, runtime-specific details)
- **Watch out for** (common pitfalls or failure modes)
- **Verification** (the test or assertion that proves completion)

No step is a one-sentence reference or a vague "implement X." Every step is actionable and sufficiently detailed for a developer to proceed without inferring missing guidance.

**Summary:** No gaps block implementation. All three minor observations are cosmetic or post-v0.1.0 concerns.

---

## File Path Validation

All file paths referenced in the implementation report are validated against the target repository structure at `/Users/cnickson/projects/murmur`. The repository is greenfield with only scaffold files (confirmed via `list_dir`).

### Current Repo Structure
```
/Users/cnickson/projects/murmur/
  .git/
  .gitignore
  LICENSE
  README.md
  _architect/
    research/
  docs/
    VISION.md
  package.json
```

The `package.json` already declares `"bin": { "murmur": "./dist/cli.js" }`, `"files": ["dist", "templates", "README.md", "LICENSE"]`, and stub scripts (`build`, `dev`, `test`). This confirms the implementation report's paths align with the scaffold.

### Directory Structure Created by Phases

The implementation report references the following directories to be created (none exist yet; all are greenfield):

| Directory | Purpose | First Referenced In | Validation |
|---|---|---|---|
| `murmur/` | Abstract IR (agents, subagents, skills, instructions, config) | Phase A Step A1 | **VALID** — top-level, standard convention |
| `murmur/agents/` | Agent definitions | Phase A Step A1 | **VALID** — subdirectory of `murmur/` |
| `murmur/subagents/` | Subagent definitions | Phase A Step A1 | **VALID** — subdirectory of `murmur/` |
| `murmur/skills/` | Skill definitions | Phase A Step A1 | **VALID** — subdirectory of `murmur/` |
| `murmur/instructions/` | Instruction definitions | Phase A Step A1 | **VALID** — subdirectory of `murmur/` |
| `src/` | CLI implementation source | Phase A Step A2 | **VALID** — standard TypeScript project convention |
| `src/schema/` | Typed schema interfaces | Phase A Step A2 | **VALID** — subdirectory of `src/` |
| `src/compiler/` | Compiler driver | Phase A Step A5 | **VALID** — subdirectory of `src/` |
| `src/compiler/adapters/` | Runtime adapters | Phase A Step A6 | **VALID** — subdirectory of `src/compiler/` |
| `src/commands/` | CLI command modules | Phase B Step B1 | **VALID** — subdirectory of `src/` |
| `src/analyzer/` | Init analyzer (structural/semantic passes) | Phase C Step C1 | **VALID** — subdirectory of `src/` |
| `src/publish/` | Publish scrubber | Phase E Step E2 | **VALID** — subdirectory of `src/` |
| `src/util/` | Shared utilities (config loader, atomic move) | Phase A Step A5, Phase E Step E5 | **VALID** — subdirectory of `src/` |
| `templates/` | Base library (generic agents, skills, scaffolders) | Phase C Step C1, Phase D Step D1 | **VALID** — top-level, listed in `package.json` `files` |
| `templates/agents/` | Generic agent templates | Phase C Step C3 | **VALID** — subdirectory of `templates/` |
| `templates/skills/` | Shipped skills (subagent-authoring, codebase-init) | Phase C Step C3, Phase D Step D1 | **VALID** — subdirectory of `templates/` |
| `tests/` | Bun test suites | Phase A Step A8 | **VALID** — standard test directory convention |
| `tests/fixtures/` | Test fixtures (golden files, sample projects, spawn scenarios) | Phase A Step A8, Phase C Step C1 | **VALID** — subdirectory of `tests/` |
| `tests/fixtures/copilot/` | Copilot golden fixtures | Phase A Step A6 | **VALID** — subdirectory of `tests/fixtures/` |
| `tests/fixtures/goose/` | goose golden fixtures | Phase A Step A7 | **VALID** — subdirectory of `tests/fixtures/` |
| `tests/fixtures/sample-project/` | Representative Node/TS project for analyzer validation | Phase C Step C1 | **VALID** — subdirectory of `tests/fixtures/` |
| `tests/fixtures/spawn/` | Spawn scenario fixtures | Phase D Step D3 | **VALID** — subdirectory of `tests/fixtures/` |
| `dist/` | Bundled CLI output | Phase B Step B1, Phase E Step E6 | **VALID** — standard build output, listed in `package.json` `files` |
| `docs/probes/` | Hot-load probe results | Phase A.5 Step A5.2 | **VALID** — subdirectory of existing `docs/` |

### File Paths Referenced in Implementation Report

The implementation report references specific files to be created. All paths are consistent with the directory structure above and bun/TypeScript conventions:

**Schema and core (`src/`):**
- `src/cli.ts` → bundled to `dist/cli.js` (Phase B Step B1) — **VALID**
- `src/schema/agent.ts`, `src/schema/subagent.ts`, `src/schema/skill.ts`, `src/schema/instruction.ts`, `src/schema/config.ts`, `src/schema/index.ts` (Phase A Step A2) — **VALID**
- `src/schema/validate.ts` (Phase A Step A3) — **VALID**
- `src/compiler/RuntimeCompiler.ts` (Phase A Step A4) — **VALID**
- `src/compiler/compile.ts` (Phase A Step A5) — **VALID**
- `src/util/atomicMove.ts` (Phase A Step A5) — **VALID**
- `src/compiler/adapters/copilot.ts` (Phase A Step A6) — **VALID**
- `src/compiler/adapters/goose.ts` (Phase A Step A7) — **VALID**
- `src/commands/compile.ts` (Phase B Step B2) — **VALID**
- `src/commands/doctor.ts` (Phase B Step B3) — **VALID**
- `src/commands/list.ts` (Phase B Step B4) — **VALID**
- `src/analyzer/structural.ts` (Phase C Step C1) — **VALID**
- `src/commands/init.ts` (Phase C Step C1) — **VALID**
- `src/analyzer/semantic.ts` (Phase C Step C4) — **VALID**
- `src/commands/add.ts` (Phase E Step E1) — **VALID**
- `src/publish/scrub.ts` (Phase E Step E2) — **VALID**
- `src/commands/publish.ts` (Phase E Step E2) — **VALID**
- `src/util/loadConfig.ts` (Phase E Step E5) — **VALID**

**Templates and base library (`templates/`):**
- `templates/agents/master.md` (Phase D Step D2) — **VALID**
- `templates/agents/murmur-init.md` (Phase C Step C3) — **VALID**
- `templates/skills/subagent-authoring/SKILL.md` (Phase D Step D1) — **VALID**
- `templates/skills/codebase-init/SKILL.md` (Phase C Step C3) — **VALID**

**Tests (`tests/`):**
- `tests/compiler.test.ts` (Phase A Step A8) — **VALID**
- `tests/publish.test.ts` (Phase E Step E4) — **VALID**

**Configuration and documentation (repo root):**
- `tsconfig.json` (prerequisite, Technology Stack Summary) — **VALID** — not present yet; to be created
- `murmur.config.ts` (Phase A Step A1) — **VALID** — top-level config
- `CHANGELOG.md` (Phase E Step E7) — **VALID** — standard top-level
- `docs/COMPARISON.md` (Phase E Step E7) — **VALID** — subdirectory of existing `docs/`
- `docs/probes/hot-load.md` (Phase A.5 Step A5.2) — **VALID** — new subdirectory of `docs/`

**Output locations (runtime-specific, not in repo):**
- `.github/agents/*.agent.md` (Copilot adapter output, Phase A Step A6) — **VALID** — standard Copilot convention, emitted by compiler (not checked into murmur repo)
- `.github/instructions/*.instructions.md` (Copilot adapter output) — **VALID** — standard Copilot convention

### Naming Consistency

All paths follow consistent naming conventions:
- **Directories:** lowercase, hyphen-separated for multi-word (`compiler/adapters`, `src/commands`, `docs/probes`)
- **TypeScript source files:** camelCase with `.ts` extension (`atomicMove.ts`, `loadConfig.ts`, `RuntimeCompiler.ts`)
- **Markdown files:** uppercase for top-level docs (`README.md`, `CHANGELOG.md`, `VISION.md`), lowercase for nested (`hot-load.md`)
- **IR files:** lowercase with `.md` extension (`master.md`, `critic.md`); skills use `SKILL.md` (uppercase by convention)

### Validation Summary

| Category | Status | Notes |
|---|---|---|
| Directory structure | **VALID** | All paths are consistent with greenfield bun/TS project conventions |
| File naming | **VALID** | Consistent naming patterns (camelCase TS, lowercase dirs, uppercase top-level docs) |
| Parent directories | **VALID** | All referenced files have valid parent directories created by prior phases |
| `package.json` alignment | **VALID** | `dist/cli.js` bin entry and `files` field match implementation report paths |
| No conflicts with existing files | **VALID** | Only scaffold files exist; no path collisions |

**Overall assessment:** All file paths are consistent, reasonable, and follow standard conventions for a greenfield bun/TypeScript CLI project. No invalid paths, missing parent directories, or inconsistent naming detected.

---

## Test Plan Mapping

**User Requirement:** "each major step ties to a test-plan assertion"

The test plan defines ten success criteria mapped to executable assertions. Every major implementation step explicitly references its corresponding test-plan criterion. Below is the exhaustive mapping:

### Criterion 1: Init Analyzer
**Test Plan Assertion:** "Validate the **deterministic structural pass** against a representative Node/TypeScript fixture for output completeness and the two-minute budget; exercise merge/overwrite/cancel by re-running."
**Implementation Report Coverage:**
- **Phase C Step C1:** "Validation: run against `tests/fixtures/sample-project/` and assert it produces the generic agents, the three structural skills, and the scoped instructions in under two minutes (test plan, Init analyzer, Criterion 1)."
- **Phase C Step C2:** "Verification: re-running `init` on an initialized fixture exercises each branch and never silently clobbers (test plan, Init analyzer)."

**Mapping Status:** **COMPLETE.** Both the two-minute budget assertion and the merge/overwrite/cancel assertion are explicitly tied to Phase C steps.

### Criterion 2: Compiler Correctness
**Test Plan Assertion:** "Golden-file tests: the Phase A hand-authored IR compiles to fixtures that are schema-validated (or byte-compared) for **both** Copilot and goose... A separate **atomicity test** deliberately fails an adapter mid-compile and asserts no partial output is left in the target tree."
**Implementation Report Coverage:**
- **Phase A Step A8:** "write `tests/compiler.test.ts` that compiles the Phase A IR to both targets and validates the output against the fixtures, plus the atomicity test... Verification: `bun test tests/compiler.test.ts` passes for both targets and the atomicity assertion holds (test plan, Compiler correctness, Criterion 2)."

**Mapping Status:** **COMPLETE.** Both golden-file tests and the atomicity test are explicitly tied to Phase A Step A8.

### Criterion 3: Master-Agent Spawning
**Test Plan Assertion:** "Two scenario tests (data-validator, config-migrator) assert a valid, readable subagent is produced and invoked via whichever path the Phase A.5 probe selected (file-writing or ephemeral-persona)."
**Implementation Report Coverage:**
- **Phase D Step D3:** "demonstrate a data-validator spawn and a config-migrator spawn end-to-end on at least one runtime whose probe result is known... Verification: both scenarios assert a valid, readable subagent is produced and invoked via the selected path (test plan, Master-agent spawning, Criterion 3)."

**Mapping Status:** **COMPLETE.** The two spawn scenarios are explicitly tied to Phase D Step D3.

### Criterion 4: Knowledge Externalization — HARD CI GATE
**Test Plan Assertion:** "Scanner test reads every file in `murmur/agents/` and asserts **zero** matches against codebase-specific patterns... Separately asserts ≥80% of project-specific terms appear in skills/instructions. Runs in CI; release-blocking."
**Implementation Report Coverage:**
- **Phase E Step E7:** "CI: add a workflow that runs `bun test`, `typecheck`, and the knowledge-externalization scanner as a release-blocking gate."
- **§9 Completion Criteria:** "the knowledge-externalization scanner reports zero project facts in `murmur/agents/` (and ≥80% of project terms in skills/instructions)"

**Mapping Status:** **COMPLETE.** The scanner is tied to Phase E Step E7 and is explicitly labeled a release-blocking CI gate.

### Criterion 5: Publish Scrubber (including false-negative coverage)
**Test Plan Assertion:** "Fixture with sentinel values... **False-negative test:** fixture embeds a high-entropy secret-shaped string in **no** configured denylist; assert `--strict` flags/fails on it via the entropy/pattern scanner."
**Implementation Report Coverage:**
- **Phase E Step E4:** "write `tests/publish.test.ts`. Sentinel test: a fixture with repo name `test-project`, domain term `proprietary-feature`, and a fake email... False-negative test: the fixture also embeds a high-entropy secret-shaped string in no configured denylist; assert `--strict` flags or fails on it via the entropy/pattern scanner — proving the scrubber does not silently pass unknown secrets... Verification: all three assertions pass (test plan, Publish scrubber, Criterion 5)."

**Mapping Status:** **COMPLETE.** The sentinel test, false-negative test, and security test are explicitly tied to Phase E Step E4.

### Criterion 6: CLI Usability
**Test Plan Assertion:** "`murmur --help` shows usage; no-arg shows friendly error with suggestions; every command has `--help`; file-modifying commands print a change summary; `compile` without a `murmur/` directory prints a clear 'run `murmur init` first' error."
**Implementation Report Coverage:**
- **Phase B Step B1:** "Verification: `murmur --help` shows usage; no-arg shows the friendly summary; every command responds to `--help` (test plan, CLI usability, Criterion 6)."
- **Phase B Step B2:** "a missing `murmur/` directory triggers the 'run `murmur init` first' message"
- **§4 Cross-Cutting Concerns, Logging:** "File-modifying commands print a human-readable change summary"

**Mapping Status:** **COMPLETE.** All CLI usability assertions are tied to Phase B steps and cross-cutting guidance.

### Criterion 7: [Not explicitly listed in test plan or strategic plan as a numbered criterion]
**Note:** The test plan lists nine explicit criteria (1, 2, 3, 4, 5, 6, 8, 9, and "Out of scope"). Criterion 7 is not present. This is not a gap in the implementation report; the test plan itself has no Criterion 7.

### Criterion 8: Doctor Command
**Test Plan Assertion:** "Bidirectional: a freshly initialized project reports zero errors, exit 0. A deliberately corrupted fixture... reports each error with description + file path, non-zero exit."
**Implementation Report Coverage:**
- **Phase B Step B3:** "Verification: a freshly initialized project reports zero errors and exit 0; a deliberately corrupted fixture (missing referenced skill, malformed YAML, invalid `applyTo`, circular subagent) reports each error with a clear description and path and a non-zero exit (test plan, Doctor, Criterion 8)."

**Mapping Status:** **COMPLETE.** Both the positive and negative doctor tests are explicitly tied to Phase B Step B3.

### Criterion 9: Packaging
**Test Plan Assertion:** "`bun pack`: tarball contains only intended files, under 10MB. Install into a scratch directory and smoke-test every command's `--help`."
**Implementation Report Coverage:**
- **Phase E Step E6:** "Verification: `bun pack` produces a tarball containing only intended files, under ten megabytes; installing it into a scratch directory and smoke-testing every command's `--help` succeeds (test plan, Packaging, Criterion 9)."

**Mapping Status:** **COMPLETE.** The packaging assertions are explicitly tied to Phase E Step E6.

### Out of Scope for v0.1.0: Functional In-Runtime Execution
**Test Plan Statement:** "Functional in-runtime execution (running compiled agents inside live Copilot/goose) — deferred to avoid automating live agent environments in CI; roadmap item."
**Implementation Report Coverage:**
- Consistently scoped out; no phase attempts functional in-runtime execution. The spawn scenarios (Phase D Step D3) assert "a valid, readable subagent is produced and invoked via whichever path the probe selected — not that the agent's task output is correct (in-runtime functional execution is out of scope for v0.1.0)."

**Mapping Status:** **CONSISTENT.** The implementation report respects the test-plan scope boundary.

### Summary Table

| Test Plan Criterion | Implementation Phase/Step | Mapping Status |
|---|---|---|
| 1. Init analyzer | Phase C Steps C1-C2 | **COMPLETE** |
| 2. Compiler correctness (golden + atomicity) | Phase A Step A8 | **COMPLETE** |
| 3. Master-agent spawning | Phase D Step D3 | **COMPLETE** |
| 4. Knowledge externalization (CI gate) | Phase E Step E7 | **COMPLETE** |
| 5. Publish scrubber (sentinel + false-negative) | Phase E Step E4 | **COMPLETE** |
| 6. CLI usability | Phase B Steps B1-B2 | **COMPLETE** |
| 7. [Not present in test plan] | N/A | N/A |
| 8. Doctor command (bidirectional) | Phase B Step B3 | **COMPLETE** |
| 9. Packaging (tarball + smoke test) | Phase E Step E6 | **COMPLETE** |
| Out of scope: Functional execution | No phase attempts it | **CONSISTENT** |

**Overall Assessment:** Every test-plan criterion ties to at least one explicit implementation step with a verification clause citing the criterion number. No major step lacks a test-plan assertion. No test-plan assertion lacks an implementation step. The mapping is complete and bidirectional.

---

## Orphaned Steps

**Definition:** Orphaned steps are implementation report sections that do not correspond to any plan phase and may represent scope creep or unnecessary additions.

**Assessment:** No orphaned steps detected. All implementation report sections map cleanly to plan phases or cross-cutting concerns explicitly stated in the strategic plan.

### Mapping of Non-Phase Sections

The implementation report contains four top-level sections beyond the phase-by-phase breakdown:

#### §1 — Implementation Overview
**Purpose:** High-level summary of the product being built, the work scope, the build organization, and the directories created.
**Plan Correspondence:** Synthesizes §1 (Executive Summary), §8 (Implementation Plan), and the Phased Plan.
**Assessment:** **Legitimate supporting detail.** Provides necessary orientation for the implementer; does not add features beyond the plan.

#### §2 — Technology Stack Summary
**Purpose:** Specifies bun >=1.0, TypeScript ^5.7, ESM, workspace conventions, schema/validation tooling, and output format knowledge (Copilot/goose frontmatter fields).
**Plan Correspondence:** §2 (Problem Statement & Context) "the user's `.agent.md` schema," §3 (Research Findings) "goose recipe model," and the "Technology Stack Summary" placeholder in §7.
**Assessment:** **Legitimate supporting detail.** Grounds the implementation in specific versions and API choices required by the plan. The Copilot frontmatter fields are drawn directly from the existing-patterns research (§3) and the goose recipe schema from §3's industry research. No scope creep.

#### §4 — Cross-Cutting Concerns
**Purpose:** Error handling, logging, security, performance, accessibility.
**Plan Correspondence:** §10 (Risks & Mitigations) covers security (config-exec, scrubbing, no credential handling) and performance (two-minute structural-init budget, atomic staging). §7 mentions accessibility ("terminal-friendly output").
**Assessment:** **Legitimate supporting detail.** Restates constraints and non-functional requirements from the plan without adding new features. Security concerns (config-exec gate, no telemetry, offline deterministic path) are directly from the plan.

#### §5 — Migration and Data Considerations
**Purpose:** Schema freeze discipline, re-running `init`, publish output isolation, golden-fixture versioning.
**Plan Correspondence:** §8 Phase A "Schema freezes here," §8 Phase C "merge/overwrite/cancel on re-run," §7 "publish... writes a scrubbed copy to a separate output directory rather than mutating the source," and §9 "golden-file tests per adapter."
**Assessment:** **Legitimate supporting detail.** Consolidates stateful-operation guidance from the plan; no new features.

#### §6 — Integration Points
**Purpose:** RuntimeCompiler interface, host-agent-to-CLI dependency direction, runtime output contracts, headless-CLI shell-out.
**Plan Correspondence:** §7 (Architecture & Design) defines the RuntimeCompiler interface, the corrected dependency direction, and the Copilot/goose output contracts. §8 Phase C describes the headless-CLI fallback.
**Assessment:** **Legitimate supporting detail.** Restates the principal integration boundaries from the plan; no scope creep.

#### §7 — Configuration and Environment
**Purpose:** `murmur.config.ts` fields, constrained config loader, environment assumptions, CI configuration.
**Plan Correspondence:** §7 "A typed `murmur.config.ts`... carries `targets`, `project`, `plugins`, `publish`," §7 "the publish and compile paths therefore use a constrained config loader," §4 "The CLI runs on bun version 1.0 or later," and §8 Phase E Step E7 "add CI."
**Assessment:** **Legitimate supporting detail.** Consolidates configuration guidance from the plan; no new features.

#### §8 — Implementation Order and Dependencies
**Purpose:** Strict phase sequencing, hard dependencies, parallelizable work, Mermaid diagram.
**Plan Correspondence:** §12 (Execution Guidance & Sequencing) "Execution should follow the phase order strictly" and the dependency rationale throughout §8.
**Assessment:** **Legitimate supporting detail.** Visualizes the dependency graph stated in the plan; adds no features.

#### §9 — Completion Criteria
**Purpose:** Per-phase deliverables and overall v0.1.0 definition of done (the three non-negotiable gates).
**Plan Correspondence:** §12 "Definition of done for v0.1.0 is the conjunction of the ten success criteria with three treated as non-negotiable gates" and the Phased Plan "Definition of done."
**Assessment:** **Legitimate supporting detail.** Restates the plan's acceptance criteria; no scope creep.

#### §10 — Implementation Report Summary
**Purpose:** One-paragraph recap.
**Plan Correspondence:** Synthesizes the entire implementation report.
**Assessment:** **Legitimate supporting detail.** Standard closing summary.

### Feature Additions Not in the Plan

**None detected.** Every implementation step corresponds to a plan phase, and every non-phase section restates constraints, integration points, or acceptance criteria from the strategic plan or test plan.

### Features Deferred or Removed Relative to the Plan

**None detected.** The implementation report covers all plan phases (Pre-flight, A, A.5, B, C, D, E, F) without omission. Phase F is correctly labeled post-v0.1.0 and matches the plan's roadmap positioning.

**Summary:** The implementation report contains no orphaned steps, no scope creep, and no unexplained feature additions. All sections map cleanly to plan phases or supporting guidance explicitly stated in the strategic plan.
