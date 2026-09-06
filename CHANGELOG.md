# Changelog

All notable changes to Murmuration are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project adheres to
semantic versioning.

## [1.1.0](https://github.com/CalebJebadurai/murmur/compare/murmr-v1.0.0...murmr-v1.1.0) (2026-09-06)


### Features

* add curator knowledge-keeper agent and dogfood the agent pack ([90bd3de](https://github.com/CalebJebadurai/murmur/commit/90bd3deb51b48fe69355c21b65617331702ec2d5))
* **ci:** enable npm Trusted Publishing with OIDC and provenance ([ae8035a](https://github.com/CalebJebadurai/murmur/commit/ae8035ad331e55fe3435f6d40ca934c5cb292d50))
* **cli:** add watch daemon, git pre-commit hook, tool discovery, and run UI ([f8ceb5b](https://github.com/CalebJebadurai/murmur/commit/f8ceb5bbd1f376a47ce5c15da0591bdf94d54816))
* **compiler:** add antigravity adapter and doctor --fix self-healing ([dadb677](https://github.com/CalebJebadurai/murmur/commit/dadb67746249079fc6009fa4694b55444c5de31d))
* **compiler:** add claude, cursor adapters and murmr classify task router ([43c506a](https://github.com/CalebJebadurai/murmur/commit/43c506a81ee1e25fe0822ce4858621b239ff916e))
* **compiler:** add Tool IR, MCP config generator, and docs portal compiler ([924fa45](https://github.com/CalebJebadurai/murmur/commit/924fa452b46a6a3b2cb9ec0a93f77a4efbffd5ef))
* **compiler:** release v0.7.0 with ACP adapter, cloud sandbox dispatch, and 6-target dogfooding ([dc9da87](https://github.com/CalebJebadurai/murmur/commit/dc9da8756c25171054b4c6b15b4ce5ccebeb79fd))
* **core:** release v1.0.0 The Full Union ([b794cb9](https://github.com/CalebJebadurai/murmur/commit/b794cb92b9e6381ebfe21ad77742ccc689ddabd1))
* orchestration layer — pipeline IR, run driver, rubrics, score (v0.2/v0.3) ([c7a7e28](https://github.com/CalebJebadurai/murmur/commit/c7a7e28e25753368d245f8a5bbfde42568091480))
* **plugin:** add library entrypoint and example third-party plugin ([5b7edb4](https://github.com/CalebJebadurai/murmur/commit/5b7edb44846f1396caf2ce70a45b92636eeee7f1))
* **run:** release v0.5.0 with worker pool concurrency engine, neverParallel exclusion, and retries ([61a1361](https://github.com/CalebJebadurai/murmur/commit/61a1361fd21b7ff8d7d13892e41d2f380de624f6))
* **schema:** release v0.4.0 with selective dispatch, domain-critic rosters, and 5-target dogfooding ([90188c6](https://github.com/CalebJebadurai/murmur/commit/90188c64944f3c69ecf4c2bc0ba66dffe182d5ec))


### Bug Fixes

* **cli:** exit with 0 on --help flag ([e16ca7e](https://github.com/CalebJebadurai/murmur/commit/e16ca7eec07dbe334acf5370773f135c688a83dd))


### Documentation

* add architect pipeline docs relocated from workspace root ([b66e30a](https://github.com/CalebJebadurai/murmur/commit/b66e30aa2c5003e2ef06d8a09889a922d32c8c75))
* add roadmap, contributing, automated versioning ([7f5338f](https://github.com/CalebJebadurai/murmur/commit/7f5338fcca3c947e82048c51de30395293e31ccb))
* **release:** sync CHANGELOG and release manifest for v1.0.0 ([9917255](https://github.com/CalebJebadurai/murmur/commit/9917255865178cb1d82fc3ca94f84947574b5b65))

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
