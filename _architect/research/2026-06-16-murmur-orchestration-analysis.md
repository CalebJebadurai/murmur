# Research: Murmur Orchestration Layer — Codebase Extension-Point Analysis

**Topic:** Designing murmur's orchestration layer (pipeline IR, scoring rubrics, dispatch tables, concurrency engine, `murmur run`)
**Date:** 2026-06-16
**Invoking agent:** Architect (CODING pipeline, Phase 1 — Research)
**Status:** Complete
**Source brief:** [_architect/research/2026-06-16-murmur-orchestration-layer-refined-prompt.md](_architect/research/2026-06-16-murmur-orchestration-layer-refined-prompt.md)

---

## Codebase Findings

This section maps the actual current shapes observed in `murmur/src`, organized as the extension points a fifth "pipeline" IR type plus rubric/output-contract artifacts must hook into.

### IR schema layer (`src/schema/`)

The IR is four typed definition kinds. The discriminating union is `DefinitionKind = "agent" | "subagent" | "skill" | "instruction"` in [murmur/src/schema/types.ts](murmur/src/schema/types.ts#L21). Each kind has a plain `type` (no classes) defined in its own file:

- **AgentDefinition** ([murmur/src/schema/agent.ts](murmur/src/schema/agent.ts)): `{ name, description, role, tools[], skills[], instructions[], agents[], model?, userInvocable? }`. `name` is the filename stem; `role` is the Markdown body; `agents[]` is the dispatchable roster (this is the existing field closest to orchestration — it already names subagents an agent can invoke).
- **SubagentDefinition** ([murmur/src/schema/subagent.ts](murmur/src/schema/subagent.ts)): `AgentDefinition & { spawn: SpawnMeta }` where `SpawnMeta = { trigger, attachSkills[], attachInstructions[], toolPolicy[] }`. The `trigger` is a *natural-language* condition string — precedent for storing prose dispatch conditions in the IR.
- **SkillDefinition** ([murmur/src/schema/skill.ts](murmur/src/schema/skill.ts)): `{ name, description, body, assets? }`. The `assets?` field is reserved (v1.0) — relevant because rubrics/contracts could ride as skill assets.
- **InstructionDefinition** ([murmur/src/schema/instruction.ts](murmur/src/schema/instruction.ts)): `{ name, applyTo, rules }` — `applyTo` is a glob, `rules` is the body. This is the natural host for an output-section contract extension.
- **MurmurConfig** ([murmur/src/schema/config.ts](murmur/src/schema/config.ts)): `{ targets[], project, plugins?, publish? }` with `DEFAULT_CONFIG.targets = ["copilot"]`.

The barrel [murmur/src/schema/index.ts](murmur/src/schema/index.ts) re-exports every type and defines the assembled **IRSet**: `{ agents[], subagents[], skills[], instructions[] }` (lines 22–27). **Adding a pipeline IR requires adding a `pipelines: PipelineDefinition[]` field here** — every consumer iterates the IRSet.

### Loader (`src/schema/load.ts`)

[murmur/src/schema/load.ts](murmur/src/schema/load.ts) `loadIR(murmurDir)` is the assembly point. For each kind it calls a private `readFiles(dir, pattern)` glob helper, then runs the matching `validate*` function, pushing successes into the IRSet and aggregating `ValidationError[]`. Skills uniquely support two layouts (`skills/*.md` and `skills/*/SKILL.md`). **To add pipelines:** add `const pipeFiles = await readFiles(join(murmurDir, "pipelines"), "*.md")`, loop calling a new `validatePipeline`, and initialize `pipelines: []` in the `set` literal (line 30). The function returns `ValidationResult<IRSet>` and short-circuits to `{ ok: false, errors }` if any file fails — so a malformed pipeline aborts the whole load, which is the desired atomic behavior.

### Validator (`src/schema/validate.ts`)

[murmur/src/schema/validate.ts](murmur/src/schema/validate.ts) holds one `validateX(content, file): ValidationResult<X>` per kind. Each: calls `parseFrontmatter`, uses the local helper `requireString(fm, field, file, errors)` to narrow required string fields, coerces arrays with `asStringArray`, checks the body is non-empty, and returns `{ ok: true, value }` or accumulated errors. `validateSubagent` notably *composes* `validateAgent` then layers spawn fields — a pattern a `validatePipeline` can reuse if pipelines carry agent-like metadata. **A new `validatePipeline` must narrow the structured frontmatter** (phases, loops, caps, tiers) — this is more complex than existing validators because those fields are nested arrays/objects, not flat scalars/string-arrays, which stresses the minimal frontmatter parser (see Constraints).

### Compiler core (`src/compiler/`)

[murmur/src/compiler/RuntimeCompiler.ts](murmur/src/compiler/RuntimeCompiler.ts) defines the adapter contract `interface RuntimeCompiler` with `readonly id` plus five methods: `compileAgent`, `compileSubagent`, `compileSkill`, `compileInstruction`, and optional `finalize?(ctx)`. Each returns `EmittedFile[]` (`{ path, contents }`). `CompileContext = { config, ir }` gives every adapter the full IRSet for cross-reference resolution. The free function **`emitAll(adapter, ctx)`** (lines 47–62) iterates `ctx.ir.agents`, `.subagents`, `.skills`, `.instructions` in order, then calls `finalize`. **To compile pipelines:** add `compilePipeline(pipeline, ctx): EmittedFile[]` to the interface and a `for (const p of ctx.ir.pipelines) files.push(...adapter.compilePipeline(p, ctx))` loop in `emitAll`. Making the method optional (`compilePipeline?`) lets adapters that cannot express orchestration omit it and degrade gracefully.

[murmur/src/compiler/compile.ts](murmur/src/compiler/compile.ts) `compileTarget(adapter, ctx, outputRoot)` implements the **atomic staging-then-move**: it calls `emitAll` first (any adapter throw aborts before touching the tree), writes all files into `.murmur-stage-${adapter.id}-${process.pid}`, then copies each into place, with a `finally` that `rm`s the staging dir. Pipelines need no change here — they flow through `emitAll`. Note the move loop re-reads each staged file and `Bun.write`s it; it is technically copy-then-cleanup, not a rename, so cross-IR atomicity already holds.

[murmur/src/compiler/registry.ts](murmur/src/compiler/registry.ts) is a `Map<string, () => RuntimeCompiler>` with `getAdapter(id)` and `availableTargets()`. New runtimes (Claude, Cursor, ACP) register here; the v0.6 plugin model would extend `getAdapter` to dynamically import npm packages.

### Adapters (`src/compiler/adapters/`)

[murmur/src/compiler/adapters/copilot.ts](murmur/src/compiler/adapters/copilot.ts) `CopilotAdapter` (id `copilot`) emits persona-Markdown: `.github/agents/<name>.agent.md` via `emitFrontmatterDoc(fm, role)`, `.github/instructions/<name>.instructions.md`, `.github/skills/<name>/SKILL.md`. Its private `agentFrontmatter()` maps neutral IR fields to Copilot frontmatter keys (`tools`, `agents`, `model`, `user-invocable`). **A pipeline would compile to a master architect-style `.agent.md`** whose frontmatter carries the `agents:` roster and whose body is generated prose encoding the phase list, dispatch tables, loop-limit tables, and parallel-dispatch caps — exactly the shape of the reference [.github/agents/architect.agent.md](.github/agents/architect.agent.md). Copilot CAN express: an agent roster, prose dispatch rules, prose loop limits, prose parallelism caps, and subagent invocation via the `agent/runSubagent` tool. Copilot CANNOT express: machine-enforced numeric concurrency caps or deterministic loop counters (those are advisory prose the host model interprets).

[murmur/src/compiler/adapters/goose.ts](murmur/src/compiler/adapters/goose.ts) `GooseAdapter` (id `goose`) emits the recipe paradigm: `recipes/<name>.yaml` with `version, title, description, instructions, available_tools, sub_recipes[], settings`. `sub_recipes` is already built from `agent.agents` (lines 41–46) as `{ name, path: recipes/<name>.yaml }`. `compileSubagent` encodes the spawn trigger as a recipe `parameters` block. `finalize` emits root `AGENTS.md`/`CLAUDE.md` parity files listing the roster. **A pipeline would compile to a recipe with `sub_recipes` for the agent roster plus sequencing/loop/parallel directives expressed as YAML keys.** Goose CAN express: structured `sub_recipes`, ordered sequencing, and structured metadata keys. Goose CANNOT (in current recipe schema as emitted) express native loop iteration bounds or never-parallel-pair exclusion semantics — those would be emitted as advisory YAML metadata the recipe engine may or may not enforce.

### Commands (`src/commands/`) and CLI router (`src/cli.ts`)

The command-module contract is uniform: each command is an exported `async function xCommand(projectRoot, opts?): Promise<number>` returning an exit code, printing to console itself. [murmur/src/cli.ts](murmur/src/cli.ts) hand-rolls arg parsing (`parseArgs` → `{ positionals, flags }`), holds a `USAGE` string, and a `switch (cmd)` router. **Adding `run`, `score`, `classify`, `docs` is mechanical:** import the command module, add a `case` to the switch, add a usage line. `doctorCommand` ([murmur/src/commands/doctor.ts](murmur/src/commands/doctor.ts)) is the validation hub — `runDoctor` loads the IR, builds `skillNames`/`instrNames`/`agentNames` sets, runs `checkRefs` for reference integrity, validates `applyTo` globs, and runs `findCircular` (a WHITE/GRAY/BLACK DFS over the `agents[]` edges detecting cycles). **Pipeline reference-integrity checks slot directly into `runDoctor`:** every agent named in a pipeline phase must exist in `agentNames`; every rubric/contract referenced must resolve; loop min ≤ max; parallel caps ≥ 1; tier phase-subsets must reference declared phases. The existing `findCircular` DFS is directly reusable for detecting pipeline phase cycles. `compileCommand` ([murmur/src/commands/compile.ts](murmur/src/commands/compile.ts)) refuses to compile if `runDoctor` fails (line 28) — pipelines inherit this gate automatically.

### Utilities (`src/util/`)

- [murmur/src/util/frontmatter.ts](murmur/src/util/frontmatter.ts) `parseFrontmatter` is a **deliberately minimal** zero-dep YAML subset: scalars, inline arrays `[a,b]`, and block arrays of scalars. It does **not** support arrays of maps or deeply nested objects (the doc-comment says anything outside the subset is rejected by the validator). This is the single biggest reuse constraint for a structured pipeline IR — see Architectural Constraints. `asStringArray` tolerantly coerces.
- [murmur/src/util/yaml.ts](murmur/src/util/yaml.ts) `emitYaml` / `emitFrontmatterDoc` is a full-featured emitter (nested maps, arrays of maps, block scalars). The emitter is *more* capable than the parser — it can write the goose recipe sub_recipe maps. So murmur can *emit* structured pipeline YAML but cannot currently *parse* it back from frontmatter.
- [murmur/src/util/glob.ts](murmur/src/util/glob.ts) `isValidGlob` wraps Bun's `Glob`. [murmur/src/util/loadConfig.ts](murmur/src/util/loadConfig.ts) is the constrained loader that refuses to execute `murmur.config.ts` without `--allow-config-exec` (a security precedent directly relevant to `murmur run`). [murmur/src/util/templates.ts](murmur/src/util/templates.ts) `templatesDir()` walks up to locate the shipped `templates/` tree.

### Analyzer and publish (for concurrency/docs designs)

[murmur/src/analyzer/structural.ts](murmur/src/analyzer/structural.ts) `analyzeStructural` is the pure, no-LLM, no-network static pass (package manager, scripts, deps, languages, CI files) and `renderStructuralSkills` renders facts to skill/instruction Markdown — the model for a deterministic `murmur classify` that selects an agent set without an LLM. [murmur/src/publish/scrub.ts](murmur/src/publish/scrub.ts) `scrubText` (regex denylist/PII/secret scanning) and [murmur/src/publish/secrets.ts](murmur/src/publish/secrets.ts) show the defense-in-depth pattern publish artifacts (including pipelines and RUN-LOGs) must pass through. [chat/build.py](chat/build.py) is the reference HTML-compilation pattern (`process_md` strips frontmatter, `markdown.markdown` with `tables`/`fenced_code` extensions) for the v0.7 `murmur docs` command.

## Architectural Constraints

These are the boundaries, conventions, and coupling points observed in the codebase that any orchestration design must respect.

### 1. Zero runtime dependencies (hard, observed)

`package.json` declares no runtime deps; everything uses Bun stdlib (`Bun.file`, `Bun.write`, `Bun.Glob`) and `node:` builtins (`node:path`, `node:fs/promises`, `node:os`). The custom [murmur/src/util/frontmatter.ts](murmur/src/util/frontmatter.ts) and [murmur/src/util/yaml.ts](murmur/src/util/yaml.ts) exist precisely to avoid a YAML library. This constrains: (a) the concurrency engine — no `p-limit`/`bottleneck`, the worker pool must be hand-rolled with `Promise` primitives (see audio2text's `ThreadPoolExecutor`+`Semaphore` ported to a JS promise-pool); (b) `murmur run` — no HTTP client or LLM SDK if murmur drives the loop directly.

### 2. The minimal frontmatter parser is the binding IR-expressiveness constraint

`parseFrontmatter` supports only scalars, inline scalar arrays, and block scalar arrays. It explicitly does **not** parse arrays-of-maps or nested objects. The architect pipeline's data (dispatch tables with `agent|invoke-when|skip-when` columns, loop tables with `min|max|early-exit`, parallel caps) is inherently tabular/nested. Three resolutions exist and the design must pick one: (a) **extend the parser** to a richer YAML subset (more code, more risk, but keeps the `.md`+frontmatter convention); (b) **make pipelines pure `.yaml`** parsed by a new richer reader while agents/skills keep the minimal parser; or (c) **encode structured data as the Markdown body** (tables/lists) and parse the body, not frontmatter. The emitter (`emitYaml`) already handles arrays-of-maps, so emission is not the bottleneck — only ingestion is. This asymmetry (emit-capable, parse-limited) is the central tactical constraint.

### 3. "Compile, don't execute" identity (under tension, per brief Q1/Constraint 2)

v0.1.0 never invokes an LLM. The one near-exception — the init *semantic pass* — is carefully inverted: `initCommand` ([murmur/src/commands/init.ts](murmur/src/commands/init.ts)) only runs the deterministic `analyzeStructural` pass and lays down a `templates/agents/murmur-init.md` agent that the *user* invokes inside their host runtime. murmur emits the agent; the agent (running in Copilot) does the LLM work. This is the **dependency-direction discipline**: murmur → artifact → host-runtime-LLM, never murmur → LLM. Any `murmur run` that needs model inference (to evaluate natural-language gating predicates, to actually run agents) reintroduces the exact dependency direction init avoided. The constraint strongly favors either an orchestration *compiler*, or a `run` that is a thin local *driver* shelling out to a host CLI (`goose run`, a Copilot CLI) rather than an in-process LLM engine.

### 4. Atomic compilation guarantee

`compileTarget` stages to `.murmur-stage-${id}-${pid}` and only materializes on full success, with `runDoctor` gating before any emission. A pipeline that references a non-existent agent must fail in `runDoctor` (before staging), preserving "a failed pipeline compilation leaves the output tree untouched." This means pipeline reference-integrity checks belong in `runDoctor`, not in the adapter.

### 5. Adapter contract must stay small (~100–200 lines/runtime, per brief Constraint 3)

The current contract is 5 methods; the two adapters are ~85 lines each. Adding `compilePipeline`, `compileRubric`, `compileOutputContract` as *required* methods triples the burden and breaks every future adapter that can't express orchestration. The idiomatic resolution, already prefigured by the optional `finalize?`, is **optional capability methods** (`compilePipeline?`, `compileRubric?`) so `emitAll` skips them when absent — giving the per-runtime graceful-degradation hook for free.

### 6. IR must be runtime-neutral

No file in `src/schema/` references "copilot" or "goose"; all runtime mapping lives in adapters. The pipeline IR must therefore express orchestration in neutral structured terms (phase lists, agent names, numeric loop bounds, named never-parallel pairs) and let each adapter translate — Copilot to prose, goose to YAML keys. Any construct that cannot map to *both* reference runtimes either degrades per-runtime or is out of scope (brief Constraint 4).

### 7. Naming and identity conventions

Identity is always the filename stem (`stem(file)` in the validator). Cross-references are by name string (`agents[]`, `skills[]`, `instructions[]`), resolved against Sets built in `runDoctor`. Pipelines must follow suit: phases reference agents by stem-name; pipelines, rubrics, and contracts are themselves named by stem. Directory-per-kind convention (`murmur/agents/`, `murmur/skills/`) implies `murmur/pipelines/`, `murmur/rubrics/`.

### 8. Command-module contract

Every command is `async (projectRoot, opts) => Promise<number>`, self-printing, returning an exit code; the CLI switch is the only router. New commands must not break this — `run`/`score`/`classify`/`docs` each become one module + one switch case + one usage line, with no shared mutable state.

## Industry Approaches

At least three standard approaches exist for representing and running multi-agent orchestration. Each is described neutrally; compatibility is assessed in the next section.

### Approach A — Declarative Workflow IR + Multi-Target Compiler

Model the pipeline as a static, declarative graph (phases as nodes, dispatch/loop/parallel constraints as typed edges and attributes) and compile it to runtime-native orchestration artifacts. The IR never executes; it is *lowered* per target. This is the model of CI/CD systems (GitHub Actions workflow YAML → runner steps), build systems (Bazel/Buck targets → action graphs), and infrastructure-as-code (Terraform HCL → provider API calls). The orchestration "runs" only inside the target's own engine. Loops and parallelism are expressed declaratively (`strategy.matrix`, `max-parallel`, `needs:` ordering) and enforced by the target runtime, not the compiler.

### Approach B — Embedded Execution Engine (Orchestrator Runtime)

Build an in-process interpreter that loads the pipeline IR and actively drives execution: it sequences phases, dispatches agents (via LLM API or subprocess), tracks iteration state, enforces loop/parallel caps with a real scheduler, evaluates gating conditions, and writes the run log. This is the model of workflow engines like Temporal, Airflow, Prefect, Dagster, and agent frameworks like LangGraph, CrewAI, AutoGen, and Microsoft's Semantic Kernel process framework. The engine *is* the runtime; it owns state, retries, concurrency, and observability. It typically requires direct model/provider access to actually invoke agents and to evaluate fuzzy conditions.

### Approach C — Hybrid: Compiler Core + Thin Local Driver over a Host Agent CLI

Keep declarative compilation (Approach A) as the core, but add a thin `run` driver that does *not* embed an LLM. Instead it shells out to the host runtime's own CLI (`goose run recipe.yaml`, a Copilot/Claude CLI), passes the compiled orchestrator, and captures structured output (exit codes, stdout, emitted files) into the RUN-LOG. murmur owns the *deterministic* outer scaffolding — tier selection, phase sequencing of separate CLI invocations, loop-counter bookkeeping, parallelism via a subprocess pool, RUN-LOG assembly — while the *model reasoning* (which agent, what verdict) happens inside the host CLI process. This mirrors a build tool that orchestrates compiler invocations without being a compiler itself, and directly mirrors murmur's existing init pattern (murmur emits + drives; the host runtime supplies the intelligence). The concurrency primitive is a subprocess/promise pool, the natural JS port of audio2text's `ThreadPoolExecutor` + `Semaphore` + `effective_workers` model.

### Approach D (variant) — Runtime-Native Orchestrator Only (no `run` at all)

A stricter variant of A: `murmur run` is merely sugar for `murmur compile --pipeline X` plus a printed instruction telling the user to invoke the artifact in their runtime (open the architect agent in Copilot, or `goose run`). murmur emits nothing executable and drives nothing. This is the purest expression of "compile, don't execute" and is included because it is the lowest-risk fallback if host CLIs prove unavailable.

### Cross-cutting: rubric/contract representation patterns

For scoring rubrics and output contracts, industry offers three placement patterns: (1) **first-class artifacts** (separate, referenceable, reusable — like JSON Schema files, OPA/Rego policies, or ESLint shared configs); (2) **extensions of an existing kind** (extra frontmatter on the agent/instruction that owns them — like inline ESLint rule config or pytest markers); (3) **embedded literals** duplicated wherever used. Reusability across agents (the technical-critique rubric is used by `critic` and could be used by `data-critic`) and independent validation (`murmur score doc rubric`) are the standard deciding factors favoring pattern (1) for rubrics; locality and the single-owner relationship of a section contract to its `applyTo` glob favor pattern (2) for output contracts.

## Approach Compatibility Assessment

Each approach is assessed against murmur's observed architecture, identity constraints, and the Copilot/goose reference runtimes.

### Approach A (Declarative IR + Compiler) — High compatibility with the existing core

A is the *direct continuation* of what murmur already is. The pipeline IR slots beside the four existing kinds; `compilePipeline?` slots into `emitAll`; the Copilot adapter emits a master `.agent.md` (structurally identical to the reference [.github/agents/architect.agent.md](.github/agents/architect.agent.md)), the goose adapter emits a recipe with `sub_recipes` (the `sub_recipes` machinery already exists in [murmur/src/compiler/adapters/goose.ts](murmur/src/compiler/adapters/goose.ts#L41)). It preserves zero-dependency and compile-don't-execute perfectly. Its limitation is that it does not, by itself, satisfy the brief's v0.2 success criteria 5–7 (emit a RUN-LOG, *test* loop termination, *test* parallelism enforcement) because nothing actually executes — enforcement is delegated to the host runtime's interpretation of prose/YAML, which for Copilot is advisory only (brief Q7). A is necessary but not sufficient for the stated `murmur run` criteria.

### Approach B (Embedded Engine) — Low compatibility; conflicts with two hard constraints

B directly violates the zero-dependency constraint (needs an HTTP client or LLM SDK to dispatch agents) and the compile-don't-execute identity, and it reintroduces the dependency-direction problem init solved (Constraint 3). To actually invoke a Copilot agent, murmur would need VS Code API access or an undocumented Copilot CLI; the brief's own Technical Assumption 1 flags this as uncertain. B would also balloon the codebase scope (state management, error/timeout handling, provider auth) far beyond the "~100–200 lines/runtime" adapter budget. Its only advantage — real, deterministic loop/parallelism enforcement — can be obtained more cheaply by Approach C for the parts that are deterministic. B is incompatible as a v0.2 baseline.

### Approach C (Hybrid Compiler + Thin Driver) — Highest overall fit

C preserves the compiler core (so A's compatibility carries over) while satisfying the execution-flavored success criteria *without* embedding an LLM. The deterministic outer scaffolding murmur owns — tier→phase expansion, sequencing separate host-CLI invocations, counting loop iterations against the min/max table, capping concurrent subprocesses via a `Semaphore`-equivalent, and assembling the RUN-LOG — is exactly the class of work murmur already does deterministically in `analyzeStructural` and `compileTarget`. The model reasoning stays in the host CLI subprocess, honoring the dependency direction (murmur → spawn `goose run` → goose owns the LLM). The concurrency engine (v0.5) is then a genuine, testable artifact (criteria 16–17) because the worker pool schedules *subprocesses*, not API calls — fully implementable in Bun stdlib (`Bun.spawn`) with the audio2text `effective_workers`/backoff algorithm ported. The cost: `run` becomes runtime-targeted (`murmur run X --target goose`) and Copilot support depends on a usable Copilot CLI; where none exists, C degrades to Approach D (print-and-instruct). This degradation is graceful and mirrors init's fallback. **C is the recommended architecture**, with D as the per-runtime fallback when a host CLI is absent.

### Approach D (Compile-only sugar) — High compatibility, low capability

D is trivially compatible (it is just A plus a help message) and is the correct *fallback* for runtimes lacking a CLI (notably Copilot today, per brief Q7's open question about concurrent subagent dispatch). It cannot satisfy RUN-LOG emission or enforcement-testing criteria on its own, so it is a fallback rather than the primary design.

### Runtime-capability reality check (Copilot vs goose)

- **goose**: has a real recipe engine and CLI (`goose run`), structured `sub_recipes`, and YAML sequencing. It is the runtime where Approach C's driver and Approach A's structured emission both work best. Loop/parallel *enforcement* depends on whether the recipe schema supports those keys; where it does not, they emit as advisory metadata (graceful degradation within the goose adapter).
- **Copilot**: orchestration is *prose interpreted by the host model* via `agent/runSubagent`. There is no documented guarantee of concurrent subagent dispatch (brief Q7), so numeric parallelism caps and hard loop counters compile to *advisory prose* a human/model follows — not machine-enforced. Copilot therefore lands on Approach A emission + Approach D execution semantics until a Copilot CLI exists.

### Rubric/contract placement assessment

First-class rubric artifacts (pattern 1) fit murmur's existing kind-per-directory, name-referenced, doctor-validated model with near-zero friction: a `murmur/rubrics/*.md` directory, a `validateRubric`, a `pipelines`-style IRSet field, an optional `compileRubric?`, and a `murmur score` command that loads a rubric by name — all reusing established patterns. Output contracts as an *extension of the instruction kind* (pattern 2) fit because a section contract is intrinsically 1:1 with an `applyTo` scope and is naturally checked by the already-existing `doctor` validation pass; adding an optional `sections[]` field to `InstructionDefinition` and a doctor check is far less surface area than a new kind. The minimal-parser constraint (Constraint 2) applies to both: a rubric's dimensions/questions and a contract's ordered sections are nested data that the current frontmatter parser cannot ingest, so both share the same parser-vs-body-vs-yaml decision as pipelines.

## Edge Cases and Risks

Scenarios any orchestration implementation must handle, grounded in the observed code.

- **Dangling agent references in a pipeline phase.** A phase names an agent not present in the IRSet. Must be caught in `runDoctor` exactly as `checkRefs` catches missing skills/instructions ([murmur/src/commands/doctor.ts](murmur/src/commands/doctor.ts#L66)); otherwise the Copilot adapter emits a roster entry with no backing agent file and goose emits a `sub_recipe` pointing at a non-existent path. The fix reuses the existing `agentNames` Set.
- **Phase cycles / loop non-termination.** The existing `findCircular` DFS detects agent-roster cycles; a pipeline can independently encode a phase graph cycle (Phase 3 loops to Phase 3). Loop bounds must be validated: `min ≤ max`, `max ≥ 1`, and the hard cap of 3 iterations from the reference loop-limits table must be enforced structurally so a compiled prose orchestrator cannot request unbounded iteration. The reference architect explicitly encodes "Hard maximum: 3 iterations regardless of pipeline tier."
- **Tier references a phase the pipeline doesn't declare.** The lightweight/standard/extended tiers are *subsets* of the phase list (e.g., lightweight = `0 → 1 → 2 → 5`). A tier listing a phase id absent from the canonical phase set must fail doctor. Conversely a phase declared but unreferenced by any tier is a soft warning.
- **Never-parallel pair names a non-dispatched agent.** The parallel-dispatch table lists pairs like `critic|planner` as never-parallel. If one member is never dispatched in the selected tier, the constraint is vacuous (acceptable) but a pair naming an unknown agent is an error.
- **Minimal-parser silent truncation.** If pipeline structured data is placed in frontmatter and exceeds the parser's subset (an array of maps for the dispatch table), `parseFrontmatter` will *silently mis-parse or drop* it rather than throw — the doc-comment says out-of-subset content is "rejected by the validator," meaning the validator must actively detect missing/empty structured fields, not assume the parser surfaced an error. This is a correctness landmine if frontmatter is chosen over body/YAML.
- **Partial pipeline-run failure (Approach C).** A host-CLI subprocess crashes mid-phase. The audio2text precedent is instructive: it returns a *failed-region marker* and continues rather than aborting the multi-hour run ([audio2text/audio2text/backends/gemini.py](audio2text/audio2text/backends/gemini.py#L583)). The RUN-LOG must record per-phase `status` (the reference RUN-LOG already has `FAILED→fixed`, `FAILED (no response)`, and "Implementer re-invoked" entries), and graceful-degradation rules must mirror architect.agent.md's per-agent failure handling (verifier failure → proceed; critic failure → retry once then proceed; implementer failure → flag incomplete).
- **RUN-LOG concurrency / format drift.** The reference [agri/_architect/RUN-LOG.md](agri/_architect/RUN-LOG.md) is a *single* file with a summary table plus per-run execution-log subsections. Concurrent `murmur run` invocations appending to one file race; per-run files plus an index avoid this but diverge from the reference format (brief Q11). Either way the table columns are fixed (Date, Topic Slug, Tier, Iterations, Total Score, Verifier, Notes) and must be emitted verbatim.
- **Atomicity across IR types.** A pipeline that compiles but whose referenced rubric fails validation must abort the *entire* target compile, not leave a half-written tree. The staging-then-move in `compileTarget` already guarantees this provided the reference check is in `runDoctor` (pre-staging), reinforcing that pipeline/rubric/contract integrity checks belong in doctor.
- **Adapter cannot express orchestration.** A future Cursor/ACP adapter with no roster concept must not crash on a pipeline. Optional `compilePipeline?` + skip-when-absent in `emitAll` makes the absence a no-op (emit nothing or emit a degraded single-agent), which is the graceful-degradation contract.
- **Classify without an LLM.** `murmur classify` mapping a free-text prompt to a task category + agent set risks needing inference. The deterministic precedent (`analyzeStructural`) suggests keyword/heuristic matching against the architect's task-category table; anything fuzzier reintroduces the LLM-dependency problem (brief Q3) and should instead emit a classifier *agent* the host runs (init-style inversion).

## Security Findings

- **Code execution via `murmur run` (highest concern).** The existing constrained config loader ([murmur/src/util/loadConfig.ts](murmur/src/util/loadConfig.ts)) refuses to execute `murmur.config.ts` without `--allow-config-exec`, treating arbitrary code in an untrusted repo as a threat. A `murmur run` that shells to a host CLI (Approach C) is a *new and larger* code-execution surface: a published/shared pipeline could name an arbitrary command or agent that triggers tool use. The same gate philosophy must apply — `run` should require explicit opt-in (e.g., `--allow-run`/confirmation), validate that dispatched targets resolve only to declared in-repo agents, and never interpolate untrusted pipeline strings into a shell without escaping (OWASP A03 injection). Prefer `Bun.spawn` with an argv array over a shell string.
- **Pipeline/rubric content is publishable → must be scrubbed.** Pipelines, rubrics, contracts, and especially RUN-LOGs (which embed file paths, topic slugs, and verdicts) will flow through `murmur publish`. The reference RUN-LOG contains absolute-style project paths and domain terms; [murmur/src/publish/scrub.ts](murmur/src/publish/scrub.ts) already redacts `/Users/...`, emails, denylist/domain terms, and runs `scanSecrets` over the result. The publish path must include `murmur/pipelines/`, `murmur/rubrics/`, and any emitted RUN-LOG in its file set, and the externalization gate ([murmur/src/publish/externalization.ts](murmur/src/publish/externalization.ts)) must treat pipeline bodies like agent bodies (no project-specific facts).
- **Input validation at the IR boundary.** New structured fields (numeric loop bounds, caps, tier phase-id lists) are the system boundary. The validator must bound-check (`max ≥ 1`, `min ≤ max`, caps within a sane ceiling, iteration hard-cap of 3) rather than trust frontmatter, consistent with the existing `requireString`/`isValidGlob` narrowing discipline.
- **No new secrets surface from the pipeline IR itself**, but `murmur run` against a host CLI may require the host's credentials (goose's provider key); murmur must not read, log, or persist those — they belong to the host process environment, preserving the dependency-direction boundary.
- **RUN-LOG as a data-exposure vector.** Run logs capture scores, verdicts, and output file paths. Treat them as planning artifacts under the same PII prohibition the architect enforces ("Files in `_architect/` ... must never contain real PII").

## Performance Findings

- **Compilation is I/O-bound and already cheap.** `emitAll` is synchronous in-memory string assembly; `compileTarget` does the only I/O (staging writes + copy-into-place). Adding a `pipelines` loop adds O(pipelines) string builds — negligible. The copy-then-cleanup in `compileTarget` reads each staged file back before the final write; for large emitted orchestrators this is a double-read, but volumes are tiny (tens of files).
- **Worker pool is the real performance subsystem (v0.5).** The audio2text algorithm to port is precise: `_effective_workers(cfg, n) = min(configured, tpm_limit/per_task_token_estimate, rpm_limit, n_tasks)` with a floor of 1 and the *binding* constraint reported ([audio2text/audio2text/backends/gemini.py](audio2text/audio2text/backends/gemini.py#L717)). Dispatch uses `ThreadPoolExecutor(max_workers=workers)` + `as_completed`, with a `threading.Semaphore(workers)` throttling the upload sub-step, and a serial fast-path when `workers <= 1` ([audio2text/audio2text/backends/gemini.py#L886](audio2text/audio2text/backends/gemini.py#L886)). The JS port is a promise-pool over `Bun.spawn` subprocesses with an equivalent counting semaphore; the `effective_workers` math is integer arithmetic with no dependency.
- **Retry/backoff cost.** The reference uses `delay = retry_base_seconds * (2 ** attempt) + random.uniform(0,1)` (exponential backoff + jitter), `max_retries = 3`, and a retryable-error classifier `_is_retryable` keyed on `429/5xx/rate/timeout/connection` hints ([audio2text/audio2text/backends/gemini.py#L201](audio2text/audio2text/backends/gemini.py#L201) and [#L572](audio2text/audio2text/backends/gemini.py#L572)). This directly satisfies criterion 17 (1s/2s/4s pattern) and must be ported verbatim in semantics.
- **Parallelism caps are a perf *and* correctness control.** The architect parallel-dispatch table caps (max 3 Explore, max 2 paired streams, never-parallel critic-planner) map onto the worker-pool's `effective_workers` and an explicit exclusion set. Under Approach C these are enforced by the subprocess pool (real); under Approach A/Copilot they are advisory prose (not enforced) — a measurable behavioral difference the per-runtime degradation rule must document.
- **RUN-LOG append I/O.** Single-file append (reference format) is one write per run; per-run files are one write each plus an index rebuild. Both are trivial; the only perf-relevant risk is the concurrency race noted in Edge Cases, not throughput.
- **No N+1 or serialization hotspots** exist in the current read paths; `loadIR` globs each directory once and validates linearly. Adding pipelines/rubrics adds two more single-pass globs.

## Orchestration Semantics to Model (Reference Artifacts)

This is the exact data the new IR types must represent, extracted verbatim from the reference artifacts.

### Phase list (from [.github/agents/architect.agent.md](.github/agents/architect.agent.md))

Coding branch: **Phase 0** (prompt refinement), **0b** (task classification & agent selection), **1** (research / selective subagent dispatch), **2** (drafting), **3** (critic↔planner refinement loop), **4** (final output), **5** (implementer), **5b** (verifier), **5c** (conditional re-invocation). Research branch (R-phases): **R1** (research & evidence gathering), **R2** (structure drafting), **R3** (research-critic↔planner loop), **R4** (final approved structure), **R5** (research writing), **R5b** (final validation: research-critic + fact-checker in parallel). The IR must represent two parallel phase *sequences* selected by a CODING/RESEARCH/HYBRID classification, not one linear list.

### Pipeline tiers and their phase sequences

- **Lightweight:** `0 → 1 → 2 → (optional critic spot-check) → 5`; skips the full critic-planner loop.
- **Standard:** `0 → 0b → 1 → 2 → 3 (1–2 critic-planner iterations) → 4 → 5 → 5b`.
- **Extended:** `0 → 0b → 1 → 2 → 3 (2–3 iterations + full sub-critic fan-out) → 4 → 5 → 5b → 5c`; all critic dimensions mandatory.

So a tier is `{ name, phases[] (subset of the canonical phase set), loopIterationOverrides }`.

### Selective-dispatch table (columns: agent | invoke-when | skip-when)

Per-agent rows for: prompt-engineer, Explore, analyst, researcher (research/writing modes), research-critic (validation/loop modes), fact-checker, politician, finance-analyst, data-scientist, data-critic, ui-ux, critic, business-critic, social-critic, planner, implementer, verifier. Each row has natural-language `invoke-when` and `skip-when` predicates (e.g., business-critic invoke-when "revenue, cost, market, or commercial implications", skip-when "pure internal refactor"). The IR field is therefore `dispatch: { invokeWhen: string[], skipWhen: string[] }` per agent-in-phase — confirming prose predicates must be storable (precedent: `SpawnMeta.trigger`). Brief Q3 notes these are not LLM-evaluated by murmur; they compile to prose (Copilot) or are surfaced for `murmur classify` keyword matching.

### Parallel-dispatch caps table (columns: pattern | when | max-instances)

Multiple Explore → max **3 concurrent**; Explore+analyst → **2**; researcher+domain agents → **3**; research-critic+fact-checker → **2**; business-critic+social-critic → **2 (1 each)**; **critic+planner → NEVER parallel, 1 at a time**; research-critic+planner → **NEVER parallel**. IR shape: `parallel: { maxConcurrent: number, neverParallel: [agentA, agentB][] }` plus optional per-pattern caps.

### Loop-limits table (columns: loop | min | max | early-exit)

Critic↔Planner: min **1**, max **3**, exit "all dimensions ≥4, combined score non-decreasing"; Research-Critic↔Planner: min **1**, max **2**, exit "all structure dimensions ≥4, no critical weaknesses"; Critic→business-critic: 0–1 per critic iteration; Critic→social-critic: 0–1; Planner→analyst callback: 0–1 per planner iteration; Implementer→analyst callback: 0–1 total; Verifier→implementer re-invocation: 0–1 total, only on FAIL. IR shape: `loops: [{ name, from, to, min, max, earlyExit: string }]`. Hard global cap = 3.

### Agent roster (frontmatter `agents:` of architect.agent.md)

`[Explore, analyst, researcher, research-critic, fact-checker, critic, business-critic, social-critic, prompt-engineer, planner, implementer, verifier, ui-ux, data-scientist, data-critic]` (plus politician, finance-analyst referenced in tables). Note `Explore` is a *built-in* VS Code agent, not a file — the IR must allow roster members that have no backing agent definition (a `builtin: true` flag or a doctor exemption list), else `checkRefs` would flag it.

### Scoring rubric structure (from [.github/agents/critic.agent.md](.github/agents/critic.agent.md))

**11 dimensions** (Security, Performance, Approach Validity, Pros/Cons Balance, Industry Standards, Completeness, Feasibility, Risk Assessment, Codebase Alignment [CONDITIONAL/N-A-able], Test Coverage, Logical Soundness). Each dimension: a **MANDATORY|CONDITIONAL** classification, a list of questions tagged **[M]** (mandatory) or **[O]** (optional depth-probe), and a **1–5 score** (1 = blocks implementation … 5 = fully addressed). Aggregate: **Total Score /55**, then a **Severity Summary** (counts of critical/important/minor), then **Readiness** (YES/NO). The brief's example says 11×5 questions = /55. Dimension-selection rules vary by task category (internal-refactor focuses 3,5,6,7,9,11; security-critical = all mandatory). Business-critic and social-critic use **8 dimensions each, scored /40** (e.g., business: Unit Economics, Revenue Model, …). The **Multi-Critic Scorecard** combines Technical /55 + Business /40 + Social /40 (the RUN-LOG shows combined totals like 105/130 and 106/135). Rubric IR shape: `{ name, dimensions: [{ name, mandatory: bool, questions: [{ text, mandatory: bool }], scaleMax: 5 }], totalMax, severityBuckets, readinessGate }`.

### Output-section contract (from instructions)

[.github/instructions/real-estate-output-sections.instructions.md](.github/instructions/real-estate-output-sections.instructions.md) (and the agri/elec analogues) encode an *ordered list of required sections* gated by an `applyTo` glob — the same shape as the architect's 12-section analysis and 11-section domain formats. Contract IR shape: extend `InstructionDefinition` with `sections?: [{ name, required: bool, wordTarget?: number, order: number }]`. Doctor enforcement: a document under the `applyTo` glob missing a required section → error (criterion 12).

### RUN-LOG format (from [agri/_architect/RUN-LOG.md](agri/_architect/RUN-LOG.md))

Two parts. (1) **Summary table** with columns exactly: `Date | Topic Slug | Tier | Iterations | Total Score | Verifier | Notes`. Total Score cells embed the multi-critic breakdown (`105/130 (41T+32B+32S)`); Verifier cells use `PASS`, `FAIL→fixed`, `FAIL→PASS`. (2) **Execution Logs** — per-run subsections (`### <topic> (date)`) with one bullet per phase: `**<date> Phase X — <agent>**: <STATUS>. Output: <path>.` Statuses observed: `SUCCESS`, `SUCCESS (after 1 retry due to network error)`, `FAILED (3x net::ERR_HTTP2_PROTOCOL_ERROR)`, `FAILED (no response)`. The loop-termination note ("Loop terminated") and re-invocation steps (5c) are recorded inline. `murmur run` must emit this exact structure.

### Concurrency algorithm (from [audio2text/audio2text/backends/gemini.py](audio2text/audio2text/backends/gemini.py))

`GeminiConfig` carries `max_workers` (configured cap), `rpm_limit`, `tpm_limit`, `per_chunk_token_estimate`, `max_retries=3`, `retry_base_seconds=2.0`. `_effective_workers` ([#L717](audio2text/audio2text/backends/gemini.py#L717)) builds candidate `(label, value)` pairs — `("configured", max(1,max_workers))`, `("TPM", tpm_limit//per_chunk_token_estimate)`, `("RPM", rpm_limit)`, `("chunks", n)` — and returns `min` by value (floor 1), reporting the binding constraint. Dispatch ([#L886](audio2text/audio2text/backends/gemini.py#L886)): serial path if `workers<=1`, else `ThreadPoolExecutor(max_workers=workers)` with `pool.submit` + `as_completed`, a `Semaphore(workers)` gating uploads, and per-worker thread-local clients. Retry ([#L570](audio2text/audio2text/backends/gemini.py#L570)): on retryable error, `delay = retry_base_seconds * 2**attempt + random.uniform(0,1)`, else break; permanent failure returns a *failed-region marker* so one failure never aborts the run. The JS port: replace `ThreadPoolExecutor` with a `Bun.spawn` promise-pool, `Semaphore` with a counting-promise gate, keep the `effective_workers` integer math and backoff formula identical.

## Summary of Key Decisions

**Run engine vs. compiler — recommended: Hybrid (Approach C).** Keep the declarative compiler as the core (`compilePipeline?` lowering to a Copilot master `.agent.md` and a goose recipe). Make `murmur run` a thin, opt-in local *driver* that shells (`Bun.spawn`, argv array, no shell string) to the host runtime's CLI rather than embedding an LLM — preserving zero-dependency and the init-style dependency direction (murmur → artifact → host LLM). Where a host CLI is absent (Copilot today), `run` degrades to Approach D: compile + print-and-instruct. murmur owns only the deterministic outer scaffolding (tier→phase expansion, sequencing CLI calls, loop counting vs. the min/max table, subprocess-pool concurrency caps, RUN-LOG assembly); all model reasoning stays in the host subprocess.

**Pipeline IR field list:** `name`, `description`, `version`, `classification` (CODING|RESEARCH|HYBRID), `phases: [{ id, agents: [{ name, dispatch: { invokeWhen[], skipWhen[] }, builtin? }] }]`, `loops: [{ name, from, to, min, max, earlyExit }]` (global hard-cap 3), `parallel: { maxConcurrent, neverParallel: [a,b][], perPatternCaps? }`, `tiers: [{ name, phases[] (subset), iterationOverrides }]`. Stored as `.md`; structured data goes in the **body** (or pure `.yaml`), NOT minimal frontmatter, because `parseFrontmatter` cannot ingest arrays-of-maps (it silently mis-parses). Add `pipelines: PipelineDefinition[]` to IRSet, a `validatePipeline`, a `loadIR` glob, and pipeline reference-integrity + bound checks in `runDoctor` (reuse `agentNames` Set and `findCircular` DFS; exempt `builtin` roster members like `Explore`).

**Per-runtime graceful-degradation rule:** every orchestration method is *optional* on the adapter (`compilePipeline?`), skipped in `emitAll` when absent. Each adapter emits the highest-fidelity form it can and downgrades the rest to advisory: **goose** → structured recipe (`sub_recipes`, sequencing; loop/parallel keys if the recipe schema supports them, else advisory YAML metadata). **Copilot** → master `.agent.md` with roster frontmatter + prose phase/dispatch/loop/cap tables (advisory, host-interpreted; no machine enforcement). **Runtimes with no roster** (future Cursor/ACP) → collapse to a single master agent or emit nothing for the pipeline. Numeric caps/loops are machine-enforced ONLY under Approach C's subprocess pool; under prose emission they are advisory — document this behavioral difference explicitly.

**Rubric / output-contract placement:** rubrics = **new first-class IR kind** (`murmur/rubrics/*.md`, `validateRubric`, IRSet `rubrics[]`, optional `compileRubric?`, `murmur score <doc> <rubric>`) because they are reusable across critics and independently checkable. Output contracts = **extension of the instruction kind** (add `sections?` to `InstructionDefinition`, enforced by the existing `doctor` pass) because a section list is 1:1 with an `applyTo` scope.

**Reuse map:** `parseFrontmatter`/`emitYaml` (emit-capable, parse-limited — the key asymmetry), `compileTarget` atomic staging, the `validateX`→`ValidationResult` validator pattern, `runDoctor`'s `checkRefs`/`findCircular`, `loadConfig`'s `--allow-config-exec` gate (precedent for `--allow-run`), `scrub.ts`/externalization for publishing pipelines + RUN-LOGs, `analyzeStructural` (deterministic, no-LLM model for `classify`), `chat/build.py` (HTML model for `murmur docs`), and the audio2text `effective_workers`+backoff+semaphore algorithm ported to a `Bun.spawn` promise-pool for the v0.5 concurrency engine.

---

*Report saved to [_architect/research/2026-06-16-murmur-orchestration-analysis.md](_architect/research/2026-06-16-murmur-orchestration-analysis.md). Findings are objective observations of the codebase and reference artifacts; no implementation recommendation beyond the assessed approaches is asserted, per the analyst mandate.*
