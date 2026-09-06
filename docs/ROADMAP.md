# Murmuration Roadmap

> Single source of truth for where `murmr` is going. v0.1.0 (shipped) defines and
> compiles agent definitions. The roadmap below grows murmur from a *definition
> compiler* into a portable engine for **governed multi-agent / agent-swarm
> workflows** with automatic context **and** tool generation.

## North star

Anyone runs one command in any codebase and gets a complete, portable multi-agent
setup — generic agents, auto-generated context (skills/instructions), auto-generated
tools, and a governed orchestration pipeline — that compiles to whatever runtime they
use (Copilot, Claude Code, goose, Cursor, ACP).

```bash
bunx murmr init         # analyze codebase → context + tools + agents + pipeline
murmr compile           # emit to every configured runtime
murmr run <pipeline>    # execute a governed pipeline locally, with a RUN-LOG
```

## Shipped Milestones

### v0.1.0 — Core IR & Multi-Compiler
- Typed IR: agents, subagents, skills, instructions.
- Compiler with a `RuntimeCompiler` adapter interface + atomic staging.
- Structural adapters: Copilot (persona-Markdown) and goose (recipes).
- CLI: `init`, `add`, `compile`, `doctor`, `list`, `publish`.
- Deterministic structural `init` + agent-invoked semantic pass.
- Master-agent dynamic spawning via the externalized `subagent-authoring` skill.
- Defense-in-depth `publish` scrubber (denylist + entropy/pattern secret scanning).
- Knowledge-externalization CI gate. Zero runtime dependencies.

### v0.2 / v0.3 — Orchestration IR & Evaluation Contracts
- **Pipeline IR (5th kind)** — multi-phase workflows with routing branches (CODING / RESEARCH), loop limits, and tiers.
- **`murmr run <pipeline>`** — deterministic local runner walking pipelines and emitting structured `RUN-LOG.md`.
- **Scoring rubrics (6th kind)** — typed scorecards (dimensions, 1–5 scales, readiness gates).
- **`murmr score <doc> --rubric <name>`** — automated document scoring against quantitative rubrics.
- **Output-section contracts** — structured section schemas checked by `doctor`.

### v0.4 — Selective Dispatch & Domain-Critic Rosters
- **Dispatch tables** in agent frontmatter: machine-readable `invokeWhen`, `skipWhen`, and `tasks` matrices.
- **Task classifier** (`murmr classify`) scoring queries against dispatch rules with `skipWhen` suppression.
- **Complete domain-critic roster** in base library (`critic`, `business-critic`, `data-critic`, `social-critic`, `research-critic`, `fact-checker`, `verifier`).
- **Target compiler preservation**: all 5 runtime adapters emit dispatch metadata into native agent definitions and recipes.

### Multi-Runtime Adapters & DX Hardening
- **5 Supported Compilation Targets**: VS Code Copilot, Goose (AAIF), Google Antigravity, Claude Code, Cursor.
- **Tool IR & Auto-Discovery**: `murmr tool discover` scanning package scripts and emitting MCP schemas.
- **Interactive Documentation Portal**: `murmr docs` compiling a self-contained HTML guide with live preview.
### v0.5 — Concurrency Engine & Worker Budgeting
- **Worker pool with budget enforcement:** `runWorkerPool` with `maxConcurrent: min(configured, cap, tasks)`.
- **Mutual exclusion (`neverParallel`):** strict guarantee that conflicting agent pairs (e.g. `critic` and `planner`) never execute concurrently.
- **Retry with exponential backoff:** automatic retry with configurable delays for soft-failure agent turns.
- **Parallel phase execution in `murmr run`:** `--concurrency <n>` and `--retries <n>` CLI flags, with peak concurrency tracking.

### v0.7 — ACP & Cloud Sandbox Dispatch
- **Agent Client Protocol (ACP) adapter:** protocol-level portability target conforming to [agentclientprotocol.com](https://agentclientprotocol.com/), emitting `.acp/manifest.json`, `.acp/agents/*.json`, `.acp/pipelines/*.json`, and a standalone JSON-RPC 2.0 stdio server (`.acp/server.ts`).
- **Cloud Sandbox Dispatch Adapter:** `makeSandboxDispatcher` allowing `murmr run` to dispatch tasks to remote isolated sandbox runners via Docker containers (`--sandbox docker`) or remote HTTP/JSON-RPC endpoints (`--sandbox remote`), maintaining `murmr` as the local, git-tracked authoring authority.
- **6 Supported Compilation Targets:** VS Code Copilot, Goose (AAIF), Google Antigravity, Claude Code, Cursor, ACP.
- **Tool IR & Auto-Discovery:** `murmr tool discover` scanning package scripts and emitting MCP schemas.
- **Interactive Documentation Portal:** `murmr docs` compiling a self-contained HTML guide with live preview.
- **Real-Time Watcher:** `murmr watch` daemon with debounced change detection.
- **Git Pre-Commit Hook:** `murmr hook install` verifying IR validity and externalization pre-commit.

---

## The Next Horizons

### v1.0 — The Full Union (Active Priority)

ACP protocol portability + cross-runtime spawning proven by the hot-load probe + semantic init
+ tool generation + the orchestration/scoring/dispatch layer + cloud sandboxing = a system that doesn't
just *define* agents but **runs governed multi-agent pipelines portably** — the union
no competitor (goose, Claude Code, ECC.tools, cloud VM fleet platforms) offers together.

- **npm-package plugin model** — adapters shippable as `murmr-plugin-*` with auto-discovery.
- **Skill assets** — directory-structured skills with per-runtime asset resolution.
- **End-to-End Orchestration Probe** — cross-runtime multi-agent evaluation test harness.

---

## Priority order

1. ~~Pipeline/orchestration IR + `murmr run` + RUN-LOG (v0.2)~~ — ✅ Shipped.
2. ~~Scoring rubrics + output-section contracts (v0.3)~~ — ✅ Shipped.
3. ~~Selective-dispatch tables + task classifier + critic rosters (v0.4)~~ — ✅ Shipped.
4. ~~Concurrency / worker-budget engine (v0.5)~~ — ✅ Shipped.
5. ~~Tool generation / auto MCP (v0.6)~~ — ✅ Shipped.
6. ~~Claude Code + Cursor + Antigravity adapters (v0.7)~~ — ✅ Shipped.
7. ~~Git hooks, docs compiler (v0.8)~~ — ✅ Shipped.
8. ~~ACP adapter + Cloud Sandbox dispatch (v0.7 / v0.9)~~ — ✅ Shipped.
9. **The Full Union (v1.0)** — Next priority.

## Release & versioning

Versioning is automated via Conventional Commits + release-please (see
[CONTRIBUTING.md](../CONTRIBUTING.md)). Merges to `main` open a release PR that bumps
the version and updates [CHANGELOG.md](../CHANGELOG.md); merging it tags the release.
