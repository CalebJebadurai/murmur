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
- **Real-Time Watcher**: `murmr watch` daemon with debounced change detection.
- **Git Pre-Commit Hook**: `murmr hook install` verifying IR validity and externalization pre-commit.

---

## The Next Horizons

### v0.5 — Concurrency Engine & Worker Budgeting (Active Priority)

- **Worker pool with budget enforcement:**
  `effective_workers = min(configured, rpm, tpm, n_tasks)`, retry-with-backoff, for
  parallel subagent dispatch — porting the proven concurrency model and loop-cap
  discipline.
- Parallel phase execution in `murmr run` respecting host rate limits and process bounds.
- _Source patterns:_ audio2text `gemini.py` / `gemini_batch.py`.

### v0.7 — ACP & Cloud Sandbox Dispatch

- **Agent Client Protocol (ACP) adapter** — protocol-level portability target (JSON-RPC / stdio conforming to [agentclientprotocol.com](https://agentclientprotocol.com/)).
- **Cloud Sandbox Dispatch Adapter** — interface allowing `murmr run` to dispatch tasks to remote isolated sandbox runners (e.g. cloud VMs / Docker containers) for long-running workflows, maintaining `murmr` as the local, git-tracked authoring authority.
- **npm-package plugin model** — adapters shippable as `murmr-plugin-*` with auto-discovery.
- **Skill assets** — directory-structured skills with per-runtime asset resolution.

### v1.0 — The Full Union

ACP portability + cross-runtime spawning proven by the hot-load probe + semantic init
+ tool generation + the orchestration/scoring/dispatch layer = a system that doesn't
just *define* agents but **runs governed multi-agent pipelines portably** — the union
no competitor (goose, Claude Code, ECC.tools, cloud VM fleet platforms) offers together.

---

## Priority order

1. ~~Pipeline/orchestration IR + `murmr run` + RUN-LOG (v0.2)~~ — ✅ Shipped.
2. ~~Scoring rubrics + output-section contracts (v0.3)~~ — ✅ Shipped.
3. ~~Selective-dispatch tables + task classifier + critic rosters (v0.4)~~ — ✅ Shipped.
4. **Concurrency / worker-budget engine (v0.5)** — Next priority.
5. ~~Tool generation / auto MCP (v0.6)~~ — ✅ Shipped.
6. ~~Claude Code + Cursor + Antigravity adapters (v0.7)~~ — ✅ Shipped.
7. ~~Git hooks, docs compiler (v0.8)~~ — ✅ Shipped.
8. **ACP adapter + Cloud Sandbox dispatch (v0.7 / v0.9)**.
9. **The Full Union (v1.0)**.

## Release & versioning

Versioning is automated via Conventional Commits + release-please (see
[CONTRIBUTING.md](../CONTRIBUTING.md)). Merges to `main` open a release PR that bumps
the version and updates [CHANGELOG.md](../CHANGELOG.md); merging it tags the release.
