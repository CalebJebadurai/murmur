# Changelog

All notable changes to Murmuration are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project adheres to
semantic versioning.

## [1.0.0] — 2026-09-06

The Full Union: Murmuration moves from an abstract agent definition compiler to a complete, portable engine for **governed multi-agent orchestration** across 6 native targets with zero runtime dependencies.

### Added

- **Directory-Structured Skill Assets (`SkillAsset`)**:
  - `SkillAsset` interface (`relativePath`, `absolutePath`, `contents`) in IR.
  - Companion asset discovery in `src/schema/load.ts` (`skills/<name>/*`).
  - Companion asset emission across all 6 compiler adapters (`copilot`, `goose`, `antigravity`, `claude`, `cursor`, `acp`).
- **npm Plugin Architecture**:
  - `murmr-plugin-*` auto-discovery in `package.json`.
  - `defineAdapter` typed wrapper for plugin authors (`src/compiler/plugin.ts`).
  - Dynamic runtime registration with `--allow-config-exec` security permissions.
- **Agent Client Protocol (ACP) Adapter**:
  - Conforms to [agentclientprotocol.com](https://agentclientprotocol.com/).
  - Emits `.acp/manifest.json`, `.acp/agents/*.json`, `.acp/pipelines/*.json`, and a standalone JSON-RPC 2.0 stdio server (`.acp/server.ts`).
- **Cloud Sandbox Dispatcher**:
  - `makeSandboxDispatcher` supporting isolated Docker containers (`--sandbox docker`) and remote HTTP/JSON-RPC runners (`--sandbox remote`).
- **Worker Pool Concurrency Engine**:
  - Budgeted concurrent execution (`runWorkerPool`) with `neverParallel` mutual exclusion and exponential backoff retries in `murmr run`.
- **End-to-End Orchestration Probe**:
  - Full-lifecycle automated integration probe in `tests/e2eProbe.test.ts`.

## [0.2.0] — 2026-06-16

The orchestration layer: murmur moves from compiling agent definitions to
compiling — and optionally running — governed multi-agent pipelines.

### Added

- **Pipeline IR (5th kind)** — branch-aware orchestration: `routing` + named
  `branches` (e.g. CODING / RESEARCH), each owning its own phases, refinement
  loops (hard-capped at 3 iterations), parallelism caps, and tiers. Authored as a
  strict, hard-erroring YAML subset in the document body (`src/util/pipelineYaml.ts`).
- **Pipeline compilation** — optional `compilePipeline?` adapter method: Copilot
  emits a master architect-style agent (union roster + advisory prose tables);
  goose emits a recipe with `sub_recipes` + advisory orchestration metadata
  (declared degradation — goose cannot enforce loops/parallelism natively).
- **`murmr run <pipeline>`** — a deterministic local driver that walks a pipeline,
  counts loop iterations against caps, resolves branch + tier, and emits a
  `RUN-LOG.md` (agri format). It embeds no LLM: real agent turns are delegated to a
  host CLI via a gated, argv-array `Bun.spawn` (`--allow-run`), with untrusted
  output handling (size limits, no eval, soft-failure) and a compile-and-instruct
  degradation (the permanent path for Copilot, which has no headless CLI).
- **Rubric IR (6th kind) + `murmr score`** — typed scorecards with conditional
  dimensions and weighted multi-rubric aggregation; `score` computes weighted
  totals deterministically from host-supplied `SCORE:` lines (no LLM).
- **Output-section contracts** — optional ordered `sections` extension to
  instructions, enforced by `doctor`.
- Generic base-library additions: architect, planner, analyst, prompt-engineer,
  verifier, business-critic, research-critic, fact-checker agents; the `architect`
  dual-branch pipeline; and a `technical-scorecard` rubric.

### Notes

- The pipeline/rubric schema froze after both compile targets passed golden-file
  tests. The goose-drivability spike (`docs/probes/goose-drivability.md`) is
  pending a host CLI; `run` ships in deterministic + compile-and-instruct form.
- Roadmap v0.4–v0.7 (dispatch tables, concurrency engine, more adapters, DX) are
  adoption-gated and intentionally deferred.

## [0.1.0] — 2026-06-15

First implementation milestone. Tool-agnostic multi-agent framework with a
compile-once / emit-many architecture.

### Added

- **Abstract IR + typed schema** for agents, subagents, skills, and instructions,
  with a runtime validator and a `murmur/` directory layout.
- **Compiler** with a `RuntimeCompiler` adapter interface and atomic
  staging-then-move output.
- **Two structurally-dissimilar adapters:** Copilot (persona-Markdown
  `.github/agents/*.agent.md` + instructions + skills) and goose (parameterized
  recipe YAML + `.goosehints` + AGENTS.md/CLAUDE.md parity).
- **CLI** (`murmr`) with `init`, `add`, `compile`, `doctor`, `list`, `publish`.
- **Deterministic structural `init`** pass (no LLM, no network) plus an
  agent-invoked semantic pass (`murmur-init` agent/skill).
- **Master-agent dynamic spawning** via the externalized `subagent-authoring`
  skill, with file-writing and in-context ephemeral-persona paths gated by the
  runtime hot-load probe.
- **Defense-in-depth `publish`** scrubber: denylist + path/email/domain redaction
  plus gitleaks-style pattern and Shannon-entropy secret scanning, `--dry-run`,
  `--strict`, and a constrained config loader (`--allow-config-exec`).
- **Knowledge-externalization gate** asserting zero codebase facts in agent bodies.
- Zero runtime dependencies; bundled to `dist/cli.js` via `bun build`.

### Known limitations

- Runtime hot-load capability is recorded as unproven; spawning defaults to the
  safe ephemeral-persona path until probed in a live session.
- Semantic init depth, global commands, and the Claude Code / Cursor / ACP
  adapters are deferred to a future release.

## [0.0.0] — 2026-06-14

- Initial scaffold: README, vision document, and bun package skeleton.
