# Refined Technical Brief: Murmur Orchestration Layer

**Mode:** CODING  
**Date:** 2026-06-16  
**Status:** Phase 0 — Refinement Complete  
**Raw Prompt:** "Design and implement the orchestration layer for murmur v0.2-v0.7"

---

## Problem Statement

murmur v0.1.0 successfully compiles agent definitions (agents, subagents, skills, instructions) from a neutral IR to multiple runtimes (Copilot, goose), but it cannot represent or compile the orchestration logic that makes multi-agent systems effective in production. The reference implementation in [.github/agents/architect.agent.md](.github/agents/architect.agent.md) encodes a sophisticated multi-phase pipeline with selective agent dispatch, loop limits (critic↔planner 1-3 iterations, research-critic↔planner 1-2 iterations), parallelism constraints (max 3 concurrent Explore agents, never-parallel critic-planner pairs), multi-dimensional scoring rubrics (11 technical dimensions /55, business /40, social /40), output-section contracts (12-section analysis, 11-section domain formats), and execution tracking via [agri/_architect/RUN-LOG.md](agri/_architect/RUN-LOG.md). This orchestration layer represents the highest-value pattern that murmur must internalize to deliver on its promise of portable, governed multi-agent workflows. Without it, users get agent definitions but no executable coordination model.

## Current State

murmur operates at `/Users/cnickson/projects/personal/murmur`, running on Bun >=1.0 with TypeScript ^5.7, ESM modules, and zero runtime dependencies. The v0.1.0 architecture includes:

**IR Schema:** Four typed definition kinds defined in [src/schema/](src/schema/): [agent.ts](murmur/src/schema/agent.ts), [subagent.ts](murmur/src/schema/subagent.ts), [skill.ts](murmur/src/schema/skill.ts), [instruction.ts](murmur/src/schema/instruction.ts). Each has a typed schema, runtime validator, and frontmatter parser/emitter in [src/util/yaml.ts](murmur/src/util/yaml.ts). Loaded as an IRSet (agents[], subagents[], skills[], instructions[]) by the compiler.

**Compilation Pipeline:** [src/compiler/RuntimeCompiler.ts](murmur/src/compiler/RuntimeCompiler.ts) defines the adapter contract (compileAgent, compileSubagent, compileSkill, compileInstruction, finalize). [src/compiler/compile.ts](murmur/src/compiler/compile.ts) implements atomic staging-then-move (emit to `.murmur-stage-{target}-{pid}`, validate, then move). [src/compiler/registry.ts](murmur/src/compiler/registry.ts) registers adapters. Two adapters exist: [src/compiler/adapters/copilot.ts](murmur/src/compiler/adapters/copilot.ts) emits `.github/agents/*.agent.md` persona-Markdown; [src/compiler/adapters/goose.ts](murmur/src/compiler/adapters/goose.ts) emits recipe YAML plus AGENTS.md/CLAUDE.md parity files.

**CLI Commands:** [src/cli.ts](murmur/src/cli.ts) exposes: init (deterministic structural analyzer in [src/analyzer/structural.ts](murmur/src/analyzer/structural.ts) + agent-invoked semantic pass via [templates/agents/murmur-init.md](murmur/templates/agents/murmur-init.md)), add (scaffold new definitions), compile (run adapters), doctor (validate IR), list (inventory IR), publish (scrub for sharing via [src/publish/scrub.ts](murmur/src/publish/scrub.ts)).

**Dynamic Spawning:** Master-agent subagent authoring via [templates/skills/subagent-authoring/SKILL.md](murmur/templates/skills/subagent-authoring/SKILL.md) with file-writing vs ephemeral-persona paths gated by hot-load probe [docs/probes/hot-load.md](murmur/docs/probes/hot-load.md).

**Governance:** Defense-in-depth scrubber ([src/publish/scrub.ts](murmur/src/publish/scrub.ts) + [src/publish/secrets.ts](murmur/src/publish/secrets.ts) entropy/pattern scanning), constrained config loader ([src/util/loadConfig.ts](murmur/src/util/loadConfig.ts)), knowledge-externalization gate ([src/publish/externalization.ts](murmur/src/publish/externalization.ts)).

**Release Infrastructure:** release-please + commitlint + lefthook automation. [CONTRIBUTING.md](murmur/CONTRIBUTING.md) and [docs/ROADMAP.md](murmur/docs/ROADMAP.md) define development workflow and future direction. 25 tests pass.

**What's Missing:** No IR type for pipelines/workflows. No representation of phases, dispatch conditions, loop limits, parallelism caps, scoring rubrics, or output contracts. No `murmur run` command. No execution engine or orchestration compiler. The [docs/ROADMAP.md](murmur/docs/ROADMAP.md) explicitly calls this "the missing layer."

## Desired End State

After completing the orchestration layer roadmap (v0.2-v0.7), murmur should enable users to define, compile, and execute governed multi-agent pipelines portably across runtimes. The system should deliver:

**v0.2 (Top Priority) — Pipeline IR and Execution:** A fifth IR type (pipeline/workflow) capturing phases, per-phase agent dispatch rules, gating conditions, loop limits (min/max iterations), parallelism caps (max concurrent agents, never-parallel pairs), and tier variants (lightweight/standard/extended). The RuntimeCompiler interface extended with compilePipeline(). Adapters emit runtime-specific orchestration artifacts: for Copilot, a master architect-style agent encoding the pipeline logic; for goose, a recipe with sub_recipes and sequencing directives. A new `murmur run <pipeline>` command that executes a pipeline locally, dispatching agents per the pipeline definition, enforcing loop and parallelism constraints, and emitting a structured RUN-LOG.md (date, tier selected, phase progression, iteration counts per loop, total scores if applicable, verifier verdict).

**v0.3 — Scoring Rubrics and Output Contracts:** Scoring rubrics become first-class IR artifacts (typed scorecards: dimensions, mandatory/optional questions, 1-5 scales, severity counts, readiness gates). A critic agent loads a rubric and evaluates against it. `murmur score` validates a document against a rubric. Output-section contracts extend instructions with an enforced ordered-section schema (e.g., the 12-section analysis format, 11-section domain formats) checkable by `murmur doctor`.

**v0.4 — Selective Dispatch and Domain Rosters:** Agent frontmatter supports machine-readable dispatch tables (invoke-when/skip-when conditions by task type). A `murmur classify` command analyzes a user prompt and selects an agent set. Base library ships with a domain-critic roster (business-critic, social-critic, data-critic, fact-checker, verifier) as generic templates.

**v0.5 — Concurrency Engine:** Worker pool with budget enforcement (`effective_workers = min(configured, rpm, tpm, n_tasks)`) and retry-with-backoff, enabling parallel subagent dispatch in `murmur run`. Pattern ported from audio2text gemini.py concurrency model.

**v0.6 — Runtime Adapters Expansion:** Claude Code adapter (shares Copilot's persona-Markdown substrate). Cursor adapter (needs orchestration-without-subagent-roster path). ACP adapter (MCP orchestration). npm-package plugin model for community adapters. Skill assets support (bundling non-Markdown resources like templates, probes).

**v0.7 — Project and DX Hardening:** Generate lefthook.yml running `murmur doctor` + externalization gate pre-commit. Agent CODEOWNERS (auto-generated ownership mapping). Schema-driven validation for plugin authors. `murmur docs` command (compile agent packs + run-logs to browsable HTML like chat/build.py). Env-driven config with auto-detection (infer runtime from .copilot, .goose, cursor/ presence).

**Observable Outcome:** A user runs `bunx murmur init`, receives a codebase-specific agent pack plus a default pipeline. They run `murmur compile` to emit for Copilot and goose. In a Copilot session, they invoke the architect, which executes the pipeline (dispatching subagents, enforcing loop limits, tracking progress). In a goose session, they run the recipe, which does the same. The RUN-LOG captures execution provenance. Later, they run `murmur publish` and the scrubbed pack (agents + pipeline definitions) can be shared publicly or used in other projects with minimal adaptation.

## Scope Definition

**In Scope:**

1. **Pipeline IR Design (v0.2):** Define the typed schema for a pipeline/workflow definition kind. Must capture: phase sequence, per-phase agent dispatch logic (which agents, dispatch order, conditional dispatch), loop constructs (which phases loop, min/max iterations, exit conditions), parallelism constraints (max concurrent agents per phase, never-parallel pairs), tier variants (lightweight/standard/extended path selection), and metadata (name, description, version). The schema must be runtime-agnostic — no Copilot-specific or goose-specific constructs in the IR.

2. **Pipeline Compilation (v0.2):** Extend RuntimeCompiler interface with compilePipeline(). Implement pipeline compilation for Copilot adapter (emit a master agent file encoding the pipeline logic as prose instructions with dispatch rules, loop limits, and parallelism constraints). Implement pipeline compilation for goose adapter (emit a recipe with sub_recipes, explicit sequencing, and loop/parallelism directives in YAML). Update compile.ts to handle pipeline IR type. Update doctor command to validate pipeline definitions.

3. **Pipeline Execution (v0.2):** Add `murmur run <pipeline>` command. Decide architecture: execution engine (murmur drives the loop) vs. orchestration compiler (murmur emits a runtime-native orchestrator the host executes). If execution engine, implement: agent dispatch (invoke subagents via runtime API or CLI), loop enforcement (track iterations, respect min/max bounds), parallelism enforcement (concurrent dispatch caps), and RUN-LOG emission (date, tier, phases executed, iteration counts, scores if available, final verdict). If orchestration compiler, define the compilation target (e.g., a Copilot master agent, a goose recipe) and the execution model.

4. **Scoring Rubric IR (v0.3):** Define typed schema for rubric definitions. Must capture: dimensions (name, description, weight), questions per dimension (mandatory/optional, 1-5 scale), severity categorization (critical/important/minor), readiness gates (combined score thresholds, mandatory dimension minimums). Extend RuntimeCompiler with compileRubric(). Implement rubric loading in critic agents. Add `murmur score <document> <rubric>` command.

5. **Output Contract IR (v0.3):** Extend instruction schema to include an ordered-section schema (section names, required/optional flags, word count targets). Update doctor command to validate documents against output contracts. Provide section-schema templates for common formats (12-section analysis, 11-section domain format).

6. **Selective Dispatch Tables (v0.4):** Extend agent schema frontmatter to include dispatch conditions (invoke-when/skip-when rules by task category). Add `murmur classify <prompt>` command to analyze a prompt and select agents. Update pipeline execution to respect dispatch conditions. Ship a base library of domain-critic agents (business-critic, social-critic, data-critic, fact-checker, verifier) as generic templates in templates/agents/.

7. **Concurrency Engine (v0.5):** Implement worker pool for `murmur run` with budget enforcement (rpm, tpm, configured concurrency caps) and retry-with-backoff. Port the effective_workers calculation from audio2text gemini.py. Integrate with pipeline execution to enable parallel agent dispatch within parallelism constraints.

8. **Runtime Adapter Expansion (v0.6):** Add Claude Code adapter (reuse Copilot persona-Markdown pattern). Add Cursor adapter (handle orchestration-without-subagent-roster path). Add ACP adapter (MCP orchestration primitives). Define npm-package plugin model for community adapters. Support skill assets (bundling non-Markdown files).

9. **DX Hardening (v0.7):** Generate lefthook.yml with `murmur doctor` + externalization gate pre-commit. Generate agent CODEOWNERS. Provide schema-driven validation for plugin authors. Add `murmur docs` command (compile agent packs + run-logs to HTML). Add env-driven config with auto-detection (infer runtime from workspace files).

**Out of Scope:**

1. **Web UI or Dashboard:** All interfaces remain CLI-based. No browser-based pipeline designer, no web-based RUN-LOG viewer. If users want a UI, they build it on top of murmur's CLI.

2. **Cloud Execution or Hosted Service:** murmur runs locally. No cloud-hosted pipeline execution, no SaaS offering, no remote agent dispatch. Users execute pipelines on their own machines.

3. **LLM Provider Integrations:** murmur does not call LLMs directly (with the narrow exception of the init semantic pass, which is agent-invoked, not murmur-executed). Pipeline execution dispatches agents via the host runtime's API/CLI, not by calling OpenAI/Anthropic/etc. APIs directly. Budget enforcement (rpm/tpm) assumes the runtime handles rate limiting, or is a local advisory mechanism.

4. **Agent Marketplace or Discovery:** No registry of community-published agent packs. No search, rating, or installation of third-party agents. publish produces a scrubbed directory; users distribute it manually (GitHub, npm, etc.).

5. **Runtime-Specific Features Beyond Orchestration:** murmur compiles portable definitions. It does not expose runtime-specific features (Copilot's @workspace syntax, goose's extensions, Cursor's @Codebase) in the IR. If a runtime has a unique capability, users access it via the runtime directly, not through murmur.

6. **Backward Compatibility with v0.1.0 IR:** The pipeline IR is additive (a new definition kind), but rubric/output-contract extensions may require IR versioning. If a v0.1.0 agent definition cannot load in v0.3.0, that is acceptable — this is pre-1.0 and the IR is unstable. Migration tooling is out of scope.

7. **Multi-Project or Monorepo Support:** Each murmur/ directory compiles to one output tree per runtime. No cross-project agent sharing, no monorepo workspace detection. If users want shared agents across projects, they publish and manually copy.

8. **Real-Time Execution Monitoring:** RUN-LOG is emitted at the end of pipeline execution, not streamed during execution. No live progress bar, no WebSocket event stream. If users want real-time feedback, they implement it on top of `murmur run`'s output.

**Explicitly Scoped Out (May Revisit Post-v0.7):**

- **Auto-tuning of parallelism/loop limits:** Pipelines specify fixed limits. No dynamic adjustment based on runtime performance or cost.
- **Pipeline composition or nesting:** Pipelines are flat phase sequences. No sub-pipelines, no pipeline-calls-pipeline.
- **Agent versioning or lifecycle management:** Agents are files in murmur/. No semantic versioning, no deprecation warnings, no lifecycle hooks.
- **Cross-runtime pipeline portability testing:** murmur compiles to each runtime, but does not validate that a pipeline behaves identically across runtimes. Users test that manually.

## Constraints and Assumptions

**Architectural Constraints:**

1. **Zero Runtime Dependencies Preserved:** murmur must remain dependency-free (Bun stdlib only, no npm packages at runtime). This constrains the concurrency engine (no popular worker-pool libraries) and the execution engine (no LLM client libraries if murmur drives the loop directly).

2. **Compile, Don't Execute Principle (Under Tension):** v0.1.0's identity is "compile agent definitions to runtime-native formats, don't execute agents." The `murmur run` command creates tension: either (a) murmur becomes an execution engine (violating the principle), or (b) `murmur run` compiles a runtime-native orchestrator and invokes it via the runtime's CLI/API (preserving the principle but adding complexity). This is THE central architectural decision for v0.2.

3. **Runtime Adapter Contract Must Remain Simple:** The RuntimeCompiler interface is currently five methods (compileAgent, compileSubagent, compileSkill, compileInstruction, finalize). Adding compilePipeline, compileRubric, compileOutputContract grows the contract. We assume adapters remain feasible to implement in ~100-200 lines per runtime. If the contract grows beyond that, the adapter model may need refactoring (e.g., optional methods, adapter capabilities detection).

4. **Copilot and Goose as Reference Runtimes:** Orchestration design is constrained by what Copilot (runSubagent tool, persona-Markdown agents) and goose (sub_recipes, YAML sequencing) can express. If a pipeline feature cannot be compiled to both, it is out of scope or requires a runtime-capability flag.

5. **Atomic Compilation Guarantee:** The staging-then-move pattern must extend to pipelines. A failed pipeline compilation must leave the output tree untouched. This constrains how pipeline compilation interacts with agent/skill/instruction compilation (e.g., if a pipeline references a non-existent agent, compilation must fail atomically).

**Technical Assumptions:**

1. **Runtime APIs Are Accessible:** If `murmur run` is an execution engine, we assume the runtime (Copilot, goose) exposes a CLI or API for dispatching agents and receiving results. For Copilot, this means the VS Code API or the Copilot CLI (if available). For goose, this means the goose CLI. If no such API exists, `murmur run` must compile an orchestrator and instruct the user to run it via the runtime.

2. **RUN-LOG Format Is Markdown:** The execution log emitted by `murmur run` is a Markdown file matching the format in [agri/_architect/RUN-LOG.md](agri/_architect/RUN-LOG.md): a table (date, topic slug, tier, iterations, total score, verifier verdict, notes) plus per-phase execution logs (phase, agent, status, output path). If the format evolves (e.g., JSON for machine consumption), that is a v0.2+ enhancement, not a breaking change.

3. **Scoring Rubrics Are Numeric:** Rubrics produce numeric scores (1-5 per dimension, combined total). If a rubric needs non-numeric evaluation (e.g., pass/fail, red/yellow/green), that is modeled as a 1-5 scale with thresholds. We assume the critic agent can parse and apply a rubric definition.

4. **Output Contracts Are Section-Name Ordered Lists:** An output contract is an ordered list of section names (required/optional, word count target). It does not specify section content schemas (e.g., "this section must contain a bullet list"). That level of validation is out of scope for v0.3.

5. **Selective Dispatch Conditions Are Static:** Invoke-when/skip-when rules in agent frontmatter are evaluated at pipeline compile-time or run-time based on the task category (inferred by `murmur classify` or specified by the user). They are not dynamic predicates evaluated against runtime state (e.g., "skip if previous phase score < 30"). Dynamic gating is a v0.4+ enhancement.

6. **Concurrency Budgets Are Advisory:** The effective_workers calculation (min of configured, rpm, tpm, n_tasks) is a local constraint enforced by murmur's worker pool. If the runtime has its own rate limiting (e.g., Copilot's backend throttle), murmur cannot detect or coordinate with it. We assume users configure budgets conservatively to avoid double-throttling.

7. **Lefthook Is the CI Hook Manager:** v0.7's "generate lefthook.yml" assumes lefthook is the hook manager. If users prefer husky or another tool, they adapt the generated config manually. murmur does not auto-detect or support multiple hook managers.

8. **Bun Compatibility Is Sufficient:** murmur targets Bun >=1.0. Node.js compatibility is not guaranteed (though likely, given Bun's Node.js API surface). Deno compatibility is explicitly out of scope unless the adapter model naturally supports it.

**Process Assumptions:**

1. **Iterative Refinement of IR Schemas:** The pipeline, rubric, and output-contract schemas will evolve during implementation. We assume the schema definitions in src/schema/ are the single source of truth, and adapters are updated when schemas change. No schema registry or versioning system until post-v0.7.

2. **Adapters Are First-Party Until v0.6:** Until v0.6 (plugin model), all adapters live in src/compiler/adapters/ and are maintained in-tree. Third-party adapters are not supported. The plugin model in v0.6 defines an external adapter contract (likely npm packages exporting a RuntimeCompiler implementation).

3. **Documentation Is Roadmap + Comments + Tests:** Until v0.7 (`murmur docs`), documentation is the ROADMAP.md, code comments, and test cases. No separate user guide or API reference. The `murmur docs` command in v0.7 generates a browsable HTML site from the agent pack + run-logs, not from code annotations.

4. **Breaking Changes Are Acceptable Pre-1.0:** murmur is v0.x. IR schema changes, CLI flag changes, and adapter contract changes that break existing definitions or adapters are acceptable. We assume early adopters (the murmur repo itself, agri, elec, personal projects) tolerate migration pain. Post-1.0, semantic versioning and deprecation cycles apply.

**Unresolved Assumptions (Flagged as Open Questions):**

1. **Execution Engine vs. Orchestration Compiler:** Do we assume murmur can invoke runtime APIs directly (execution engine path), or do we assume murmur only emits artifacts the user runs (orchestration compiler path)? This determines the architecture of `murmur run`.

2. **Pipeline IR Expressiveness Ceiling:** How much orchestration complexity can the pipeline IR represent before it becomes runtime-specific? For example, Copilot's selective dispatch tables are prose-based; goose's are YAML keys. Can a single IR capture both, or do we need runtime-specific extensions?

3. **LLM Dependency for `murmur run`:** If `murmur run` is an execution engine, does it need an LLM to interpret pipeline logic (e.g., evaluating gating conditions phrased as natural language), or are all pipeline constructs deterministic (boolean conditions, numeric thresholds)? If it needs an LLM, does that reintroduce the dependency-direction problem the v0.1.0 init analyzer carefully avoided (agent invokes analyzer, analyzer does not invoke agent)?

4. **Scoring Outside Critic Agents:** Do rubrics only apply to critic agents (the current model in architect.agent.md), or can any agent evaluate against a rubric? For example, could a researcher agent self-score its research quality before returning to the pipeline? If so, the rubric-loading mechanism must be generic, not critic-specific.

5. **Parallelism Enforcement Mechanism:** If murmur is an execution engine, parallelism is enforced by the worker pool. If murmur is an orchestration compiler, parallelism is expressed in the emitted artifact (e.g., a Copilot agent's prose: "dispatch Explore agents in parallel, max 3 concurrent"). Can prose-based orchestrators reliably enforce numeric caps, or do we need structured dispatch instructions (e.g., JSON embedded in the agent Markdown)?

6. **Tier Selection at Compile-Time or Run-Time:** Does the user specify the pipeline tier (lightweight/standard/extended) at `murmur compile` time (emit three separate orchestrator files), or at `murmur run` time (one orchestrator file with conditional logic)? Compile-time tier selection is simpler but produces more artifacts; run-time tier selection is more flexible but requires runtime branching logic.

7. **Output Contract Enforcement Point:** Is output contract validation purely advisory (`murmur doctor` reports violations), or does the pipeline execution engine enforce it (e.g., reject a phase output that does not match the contract)? If enforced, what happens on violation — fail the pipeline, retry the phase, prompt the user?

8. **Cross-Runtime Pipeline Portability Goal:** Do we expect a pipeline compiled for Copilot to behave identically to the same pipeline compiled for goose, or do we accept that runtimes differ (e.g., Copilot has better subagent communication, goose has better CLI tooling) and pipelines may need runtime-specific tuning? If we expect portability, we need a test harness that runs the same pipeline on multiple runtimes and compares results.

## Success Criteria

The orchestration layer is complete and functioning when all of the following conditions are met:

### v0.2 Criteria (Pipeline IR and Execution)

1. **Pipeline Definition Validated:** The murmur repo contains a [murmur/pipelines/architect.md](murmur/pipelines/architect.md) file encoding the architect.agent.md orchestration logic as a pipeline IR definition. `murmur doctor` validates it with zero errors. The pipeline includes: 8+ phases (Phase 0, 0b, 1, 2, 3, 4, 5, 5b, 5c), per-phase agent dispatch (prompt-engineer in Phase 0, Explore + analyst in Phase 1, critic in Phase 3, etc.), loop limits (critic↔planner 1-3, research-critic↔planner 1-2), parallelism constraints (max 3 Explore, never-parallel critic-planner), and tier variants (lightweight/standard/extended phase subsets).

2. **Pipeline Compilation for Copilot:** Running `murmur compile --target copilot` with the architect pipeline produces a [.github/agents/architect.agent.md](.github/agents/architect.agent.md) file that encodes the pipeline logic in prose. The emitted file includes dispatch instructions ("invoke prompt-engineer when the prompt is ambiguous"), loop limits ("iterate critic↔planner 1-3 times"), and parallelism constraints ("dispatch max 3 Explore agents concurrently"). A human reading the file can understand and execute the pipeline manually.

3. **Pipeline Compilation for Goose:** Running `murmur compile --target goose` with the architect pipeline produces a `.goose/recipes/architect.yaml` file with sub_recipes, sequencing directives, and loop/parallelism metadata. Running `goose run architect.yaml` (or equivalent) executes the pipeline via goose's recipe engine.

4. **Execution Engine or Orchestration Compiler Decision Made:** The implementation documentation (in `_architect/analysis/`) explicitly states whether `murmur run` is an execution engine (murmur dispatches agents, enforces loops, tracks state) or an orchestration compiler (murmur emits a runtime-native orchestrator, the runtime executes it). The architecture section justifies the decision against the "compile, don't execute" principle and the feasibility constraints.

5. **RUN-LOG Emission:** Running `murmur run architect` on a test prompt produces a `_architect/RUN-LOG.md` file matching the format in [agri/_architect/RUN-LOG.md](agri/_architect/RUN-LOG.md). The log includes: date, topic slug, tier selected, iteration counts for each looped phase, total score (if critic ran), verifier verdict (if verifier ran), and per-phase execution logs (phase name, agents dispatched, status, output file paths). The log is valid Markdown and human-readable.

6. **Loop Enforcement Tested:** A test pipeline with a critic↔planner loop set to max 2 iterations terminates after 2 iterations even if the critic continues to identify weaknesses. The RUN-LOG confirms "loop terminated at max iterations" and the pipeline proceeds to the next phase.

7. **Parallelism Enforcement Tested:** A test pipeline dispatching 5 Explore agents with a parallelism cap of 3 executes at most 3 Explore agents concurrently. The RUN-LOG or execution trace confirms the cap was respected.

### v0.3 Criteria (Scoring Rubrics and Output Contracts)

8. **Rubric Definition Validated:** The murmur repo contains a [murmur/rubrics/technical-critique.md](murmur/rubrics/technical-critique.md) file encoding the critic's 11-dimension rubric (feasibility, correctness, maintainability, testability, security, performance, scalability, observability, operational risk, technical debt, execution clarity — each 1-5 with 5 questions, total /55). `murmur doctor` validates it with zero errors.

9. **Rubric Compilation for Copilot:** Running `murmur compile --target copilot` with the technical-critique rubric produces a [.github/agents/critic.agent.md](.github/agents/critic.agent.md) file that loads and applies the rubric. The emitted file includes the rubric dimensions, questions, and scoring logic.

10. **Scoring Command Functional:** Running `murmur score _architect/analysis/2026-05-08-farmer-registration.md technical-critique` evaluates the document against the rubric and outputs a score report (dimensions, scores per dimension, combined total, severity counts, readiness verdict). The output matches the format in [_architect/reviews/2026-05-08-farmer-registration-review.md](_architect/reviews/2026-05-08-farmer-registration-review.md).

11. **Output Contract Validated:** The murmur repo contains a [murmur/instructions/analysis-format.md](murmur/instructions/analysis-format.md) file encoding the 12-section analysis output contract (sections 1-12, required/optional flags, word count targets). `murmur doctor` validates it with zero errors.

12. **Contract Enforcement by Doctor:** Running `murmur doctor` on a document missing section 7 (Test Plan) reports a validation error: "Missing required section: Test Plan." Running `murmur doctor` on a conformant document reports zero errors.

### v0.4 Criteria (Selective Dispatch and Domain Rosters)

13. **Dispatch Table in Agent Definition:** The [murmur/agents/business-critic.md](murmur/agents/business-critic.md) file includes a dispatch table in YAML frontmatter: `invoke-when: ["full-stack feature", "user-facing change", "pricing change"]` and `skip-when: ["internal refactor", "tech debt"]`. `murmur doctor` validates it with zero errors.

14. **Classify Command Functional:** Running `murmur classify "Add CRUD endpoints for farmer registration"` analyzes the prompt and outputs a task category ("backend feature") and a selected agent set (Explore, analyst, critic, planner, implementer, verifier — no ui-ux, no business-critic). The output is a JSON object or structured text.

15. **Domain-Critic Roster Shipped:** The templates/agents/ directory contains business-critic.md, social-critic.md, data-critic.md, fact-checker.md, and verifier.md as generic templates. Running `murmur compile` emits them for Copilot and goose. Each template is 50-150 lines and includes a dispatch table.

### v0.5 Criteria (Concurrency Engine)

16. **Worker Pool with Budget Enforcement:** The concurrency engine enforces `effective_workers = min(configured, rpm, tpm, n_tasks)`. A test pipeline with `configured = 5`, `rpm = 60`, `tpm = 10000`, and `n_tasks = 10` calculates `effective_workers = 1` (rpm is the bottleneck: 60 requests/min = 1 request/sec). The pipeline dispatches at most 1 agent at a time.

17. **Retry with Backoff Implemented:** A test pipeline with a failing agent (simulated network error) retries the agent 3 times with exponential backoff (1s, 2s, 4s). The RUN-LOG confirms 3 retry attempts and the final failure.

### v0.6 Criteria (Runtime Adapters Expansion)

18. **Claude Code Adapter Shipped:** Running `murmur compile --target claude` emits a `.claude/agents/*.md` file matching Copilot's persona-Markdown format. The adapter reuses CopilotAdapter's logic with a different output path.

19. **Cursor Adapter Shipped:** Running `murmur compile --target cursor` emits adapter-specific artifacts for Cursor (format TBD based on Cursor's agent model). If Cursor lacks subagent roster support, the adapter emits a single master agent or a prose-based orchestrator.

20. **Plugin Model Functional:** A third-party adapter (e.g., murmur-adapter-acp published to npm) exports a RuntimeCompiler implementation. Running `murmur compile --adapter murmur-adapter-acp` loads the plugin and emits ACP-specific artifacts. The plugin does not require changes to murmur's core codebase.

### v0.7 Criteria (DX Hardening)

21. **Lefthook Config Generated:** Running `murmur init` generates a `.lefthook.yml` file with pre-commit hooks: `murmur doctor` (validate IR) and knowledge-externalization gate (check for domain terms). Committing a change with an invalid agent definition triggers a pre-commit failure.

22. **Agent CODEOWNERS Generated:** Running `murmur init` generates a `.github/CODEOWNERS` file mapping agents to owners (e.g., `murmur/agents/critic.md @architect-team`). The mapping is derived from agent metadata or a config file.

23. **Docs Command Functional:** Running `murmur docs` compiles the murmur/ directory and RUN-LOG history into a browsable HTML site (e.g., `docs/index.html` with a table of contents, per-agent pages, per-pipeline pages, and run-log tables). The output resembles chat/build.py's HTML generation.

24. **Env-Driven Config with Auto-Detection:** Running `murmur compile` without a `murmur.config.ts` file auto-detects runtimes from workspace presence (`.github/agents/` → Copilot, `.goose/` → goose, `cursor/` → Cursor) and compiles for detected runtimes. Users can override with explicit config.

### Cross-Version Integration Criteria

25. **Dogfooding in murmur Repo:** The murmur repo itself uses murmur-generated agents and pipelines. Running `murmur compile` in the murmur repo emits agents and pipelines used by the development team. The `_architect/RUN-LOG.md` file in the murmur repo contains at least 3 pipeline runs (init, compile, publish).

26. **Dogfooding in agri Repo:** The agri repo (referenced in the context) uses murmur-generated agents and pipelines. The [agri/_architect/RUN-LOG.md](agri/_architect/RUN-LOG.md) file contains at least 5 pipeline runs. All runs use the architect pipeline compiled by murmur v0.2+.

27. **Public Publish Test:** Running `murmur publish --out ~/murmur-public` on the murmur repo produces a scrubbed directory with no secrets, no domain terms, and no externalization violations. Copying the scrubbed directory to a new repo and running `murmur compile` succeeds with zero errors. The scrubbed agents are generic and reusable.

## Open Questions

These ambiguities could not be reasonably resolved from context alone. The Architect must address them or escalate to the user before proceeding to implementation planning.

### Critical Architectural Decisions

**Q1. Execution Engine vs. Orchestration Compiler — What is the architecture of `murmur run`?**

Two paths, each with deep implications:

**Path A — Execution Engine:** `murmur run` is a Node.js/Bun process that interprets the pipeline IR, dispatches agents via runtime APIs/CLIs (e.g., `copilot chat --agent critic`, `goose run analyst.yaml`), tracks state (which phase, which iteration), enforces loop/parallelism constraints, collects results, and emits the RUN-LOG. murmur becomes an orchestrator runtime, not just a compiler.

*Implications:* Violates the "compile, don't execute" principle. Requires runtime API/CLI access (may not exist or may be unstable). Reintroduces zero-dependency tension (needs HTTP client for API calls, or child-process spawning for CLI). Requires state management (which agents are running, what are their results). Requires error handling (agent failure, timeout, rate limit). Requires LLM access if gating conditions are natural-language predicates. Murmur's scope expands significantly — it becomes a runtime, not just a compiler.

**Path B — Orchestration Compiler:** `murmur run` is a compiler that emits a runtime-native orchestrator (a Copilot master agent, a goose recipe, a shell script) and invokes it via the runtime's execution model (VS Code runs the agent, goose CLI runs the recipe, bash runs the script). The orchestrator handles dispatch, loops, state, and logging. murmur's job is to generate correct orchestration artifacts, not to execute them.

*Implications:* Preserves the "compile, don't execute" principle. Murmur remains a compiler — zero runtime dependencies preserved. Orchestrators are runtime-specific — a Copilot agent cannot run in goose, a goose recipe cannot run in Copilot. `murmur run <pipeline>` becomes `murmur run <pipeline> --target copilot`, and the user must be in a Copilot session. Or `murmur run` is sugar for `murmur compile --pipeline <pipeline> && <invoke runtime>`, and the "invoke runtime" step is user-driven. RUN-LOG emission is harder — the orchestrator must emit the log, not murmur. Each runtime's orchestrator must be tested for correctness.

**Recommendation Needed:** Which path? Or a hybrid (e.g., Path B for v0.2, Path A for v0.5 after concurrency engine is built)? The decision cascades through the entire roadmap.

**Q2. Pipeline IR Expressiveness — How much orchestration complexity can the IR represent before it becomes runtime-specific?**

The tension: Copilot's orchestration is prose-based (a master agent's natural-language instructions); goose's is YAML-based (sub_recipes, explicit sequencing keys). A pipeline IR that compiles to both must either (a) be generic enough to map to both (likely the least-common-denominator), or (b) support runtime-specific extensions (pipeline-copilot.md, pipeline-goose.md).

*Examples of tension:*
- **Selective dispatch conditions:** Copilot agent says "invoke business-critic when the task has commercial implications" (prose predicate). Goose recipe says `invoke_when: {task_category: "full-stack feature"}` (structured YAML). Can a single IR represent both? Or does the IR specify structured conditions (YAML-style) and the Copilot adapter converts them to prose?
- **Loop exit conditions:** Copilot agent says "iterate until all dimensions score ≥4 or max 3 iterations" (compound predicate). Goose recipe says `loop: {max: 3, exit_if: "score >= 44"}` (structured). Can a single IR represent both?
- **Parallelism constraints:** Copilot agent says "dispatch max 3 Explore agents concurrently, never parallelize critic and planner" (prose + never-parallel pairs). Goose recipe says `parallel: {max: 3, exclude_pairs: [["critic", "planner"]]}` (structured). Can a single IR represent both?

**Recommendation Needed:** Is the pipeline IR structured (YAML-like schema with boolean conditions, numeric thresholds, agent lists) and each adapter translates it to the runtime's format? Or is the pipeline IR prose-based (natural-language orchestration instructions) and adapters parse it (risky, error-prone)? Or do we accept runtime-specific extensions and maintain separate pipeline definitions per runtime (violates portability)?

**Q3. LLM Dependency for `murmur run` — Does the execution engine need an LLM to interpret pipeline logic?**

If `murmur run` is an execution engine (Path A in Q1), and the pipeline IR uses natural-language predicates ("invoke when the task is security-critical", "exit loop when readiness is YES"), does murmur need an LLM to evaluate those predicates? Or are all pipeline constructs deterministic (boolean flags, numeric comparisons, string matching)?

*If LLM is needed:* Reintroduces the dependency-direction problem. The v0.1.0 init analyzer carefully avoided invoking LLMs directly — it emits a murmur-init agent that the user invokes in a Copilot session. If `murmur run` needs an LLM, it must either (a) call OpenAI/Anthropic APIs directly (requires API keys, reintroduces dependencies, violates zero-runtime-dep), or (b) invoke the runtime's LLM access (Copilot's model, goose's LLM backend) which brings us back to Path B (compiler, not engine).

*If LLM is not needed:* All pipeline constructs must be machine-decidable. Selective dispatch uses task categories (string enums: "backend feature", "full-stack feature"). Loop exit conditions use numeric thresholds (score >= 44). Gating conditions use boolean flags (verifier verdict == PASS). This is feasible but constrains the IR's expressiveness — no natural-language predicates, no fuzzy conditions.

**Recommendation Needed:** Is the pipeline IR fully deterministic (no LLM needed), or does it support natural-language predicates (LLM required, which implies Path B in Q1)?

**Q4. Tier Selection — Compile-Time or Run-Time?**

The architect pipeline has three tiers: lightweight (fewer phases), standard (full pipeline), extended (full pipeline + extra critic iterations + sub-critic fan-out). When does the user select the tier?

**Option A — Compile-Time Tier Selection:** `murmur compile --tier lightweight` emits a lightweight orchestrator (phases 0, 1, 2, 5). `murmur compile --tier standard` emits a standard orchestrator (phases 0, 0b, 1, 2, 3, 4, 5, 5b). The user runs the appropriate orchestrator. This produces 3x the artifacts but the orchestrator is simpler (no branching logic).

**Option B — Run-Time Tier Selection:** `murmur compile` emits one orchestrator with conditional logic. The user runs `murmur run architect --tier lightweight` (or the runtime's equivalent), and the orchestrator branches internally ("if tier == lightweight, skip phases 3, 4, 5b"). This produces 1x the artifacts but the orchestrator is more complex (requires runtime branching).

**Option C — Hybrid:** Tiers are separate pipeline definitions (`architect-lightweight.md`, `architect-standard.md`, `architect-extended.md`). The user compiles and runs the appropriate pipeline. This is the simplest IR (no tier branching logic) but requires maintaining 3 definitions (risk of divergence).

**Recommendation Needed:** Which option? Does the choice differ by runtime (e.g., Copilot agents handle branching well, goose recipes prefer separate files)?

### Intermediate Design Decisions

**Q5. Scoring Outside Critic Agents — Can any agent evaluate against a rubric, or only critics?**

The current model (architect.agent.md) has scoring as a critic-specific capability. The critic loads a rubric, evaluates the document, and returns a score. But could a researcher agent self-score its research quality against a rubric before returning to the pipeline? Could a planner evaluate its revised plan against a rubric to decide if further refinement is needed?

*If yes:* Rubric loading must be generic (any agent can load a rubric). The rubric IR must specify which agent(s) can apply it (or any agent can). Rubrics become a general-purpose evaluation tool.

*If no:* Scoring remains critic-specific. Rubrics are only loaded by critic agents. The `murmur score` CLI command is a standalone evaluator (not agent-invoked).

**Recommendation Needed:** Is scoring a general capability or a critic-specific one? Does this affect the rubric IR schema?

**Q6. Output Contract Enforcement — Advisory or Enforced?**

When a pipeline phase produces a document that violates the output contract (e.g., missing section 7, word count exceeds target), what happens?

**Option A — Advisory:** `murmur doctor` reports the violation, but the pipeline continues. The user or a subsequent critic phase may address it. This is low-friction but relies on humans or agents noticing violations.

**Option B — Enforced:** The pipeline execution engine checks the output contract after each phase. A violation fails the phase (status: FAIL in RUN-LOG), and the pipeline either halts or retries the phase. This guarantees contract compliance but is high-friction (agents may produce valuable output that is technically non-compliant).

**Option C — Conditional:** The pipeline definition specifies per-phase whether the contract is enforced or advisory. Phase 2 (draft analysis) is advisory; Phase 4 (final output) is enforced. This is flexible but more complex.

**Recommendation Needed:** Which option? Does this affect the pipeline IR schema (a per-phase `enforce_contract: true` flag)?

**Q7. Parallelism Enforcement in Prose-Based Orchestrators — Can a Copilot agent reliably enforce numeric parallelism caps?**

If the Copilot adapter emits a master agent with prose instructions like "dispatch max 3 Explore agents concurrently", can Copilot's runSubagent tool enforce that cap? Or does Copilot dispatch agents serially (no concurrency support), making the cap unenforceable in the prose layer?

*If Copilot has no concurrency primitives:* The prose instruction is advisory. The human or agent reading the orchestrator must manually enforce it (not feasible for automated pipelines). This implies Path A in Q1 is required for Copilot — murmur must be the execution engine that enforces caps.

*If Copilot can dispatch concurrently:* The prose instruction is enforceable by the Copilot runtime. This supports Path B in Q1 — the orchestrator is runtime-native, and the runtime handles enforcement.

**Recommendation Needed:** Does Copilot support concurrent subagent dispatch? If not, does the Copilot adapter emit structured dispatch instructions (e.g., JSON embedded in Markdown) that a murmur-provided Copilot subagent can parse and execute? Or does this force Path A (murmur as execution engine)?

**Q8. Cross-Runtime Pipeline Portability — Do we expect identical behavior across runtimes?**

If a user compiles the architect pipeline for both Copilot and goose, should the pipelines behave identically (same phases executed, same loop iterations, same RUN-LOG format)? Or is it acceptable for runtime differences (Copilot's subagent communication model, goose's CLI-based dispatch, Cursor's lack of subagent roster) to produce different execution paths?

*If identical behavior expected:* The pipeline IR must be a strict abstraction that each runtime faithfully implements. This requires extensive testing (run the same pipeline on all runtimes, compare RUN-LOGs). Runtime-specific optimizations or features are not exposed. This is the "write once, run anywhere" ideal.

*If divergence acceptable:* The pipeline IR is a best-effort specification. Runtimes adapt it to their capabilities (e.g., Cursor collapses subagent dispatch into a single master-agent reasoning chain). Users tune pipelines per runtime (e.g., architect-copilot.md has max 3 parallel Explore, architect-goose.md has max 5 because goose's CLI dispatch is faster). This is pragmatic but fragments the user experience.

**Recommendation Needed:** Is portability a strict requirement (implies significant testing + runtime abstraction) or a best-effort goal (implies runtime-specific tuning)?

### Tactical Implementation Questions

**Q9. Pipeline IR File Format — YAML or Markdown with YAML Frontmatter?**

The existing IR definitions (agents, subagents, skills, instructions) use Markdown with YAML frontmatter. Should pipelines follow the same pattern (pipeline-name.md with frontmatter encoding phases/loops/caps), or should pipelines be pure YAML (pipeline-name.yaml) given they are more structured and less prose-heavy?

*Markdown with frontmatter:* Consistent with existing IR. The Markdown body can include a human-readable prose description of the pipeline (useful for docs). The frontmatter encodes the structured definition.

*Pure YAML:* More natural for structured data. Easier to parse and validate. No prose body needed (pipelines are execution graphs, not documents). goose adapter maps directly (YAML to YAML).

**Recommendation Needed:** Which format? Or allow both (detect by file extension)?

**Q10. Rubric IR Structure — Inline in Agent Definitions or Separate Files?**

Should scoring rubrics be separate files in murmur/rubrics/, or embedded in agent definitions (e.g., the critic agent's frontmatter includes the rubric)? 

*Separate files:* Rubrics are reusable across agents (e.g., technical-critique rubric used by both critic and data-critic). Easy to version and share. `murmur score` can load any rubric. More files to manage.

*Inline in agents:* Rubrics are co-located with the agents that use them. Fewer files. But rubrics are not reusable — if two agents need the same rubric, it must be duplicated (DRY violation).

**Recommendation Needed:** Which approach? Or hybrid (separate files by default, agents reference them by name)?

**Q11. RUN-LOG Persistence — Single File or Per-Run Files?**

The [agri/_architect/RUN-LOG.md](agri/_architect/RUN-LOG.md) is a single file with a table of all runs. Should `murmur run` append to a single RUN-LOG.md, or emit per-run files (`_architect/run-logs/2026-06-16-architect-farmer-registration.md`) and a separate index?

*Single file:* Matches the reference format. Easy to browse history. The file grows indefinitely (pagination needed eventually). Concurrent runs may conflict (file locking required).

*Per-run files:* Each run is isolated. No concurrency conflicts. Easier to archive old runs. But the user must manually browse multiple files (unless an index is maintained).

**Recommendation Needed:** Which approach? Does the choice affect the RUN-LOG schema?

**Q12. Worker Pool Implementation — Pure Bun or Depend on a Library?**

v0.5 requires a worker pool with budget enforcement and retry logic. Should this be implemented from scratch using Bun's stdlib (preserving zero-dependency), or should murmur add a dependency on a lightweight worker-pool library (e.g., p-limit, bottleneck)?

*Pure Bun:* Preserves zero-dependency. Full control over behavior. Requires implementing: task queue, worker lifecycle, budget tracking, retry-with-backoff, concurrency limiting. Estimated ~200-300 lines. Risk of bugs (edge cases in concurrency are subtle).

*Library dependency:* Faster to implement. Battle-tested (p-limit has ~100M downloads/month). Violates zero-dependency principle. Adds supply-chain risk (though minimal for well-maintained libraries). Package size increases.

**Recommendation Needed:** Is zero-dependency a hard constraint for v0.5, or is a lightweight concurrency library acceptable? If zero-dependency is hard, is the 200-300 line investment acceptable for v0.5's timeline?

---

*This document serves as the authoritative input for the implementation planning phases. All subsequent agents should reference this brief rather than the original raw prompt.*
