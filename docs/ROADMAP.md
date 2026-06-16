# Murmuration Roadmap

> Single source of truth for where `murmur` is going. v0.1.0 (shipped) defines and
> compiles agent definitions. The roadmap below grows murmur from a *definition
> compiler* into a portable engine for **governed multi-agent / agent-swarm
> workflows** with automatic context **and** tool generation.

## North star

Anyone runs one command in any codebase and gets a complete, portable multi-agent
setup — generic agents, auto-generated context (skills/instructions), auto-generated
tools, and a governed orchestration pipeline — that compiles to whatever runtime they
use (Copilot, Claude Code, goose, Cursor, ACP).

```bash
bunx murmur init        # analyze codebase → context + tools + agents + pipeline
murmur compile          # emit to every configured runtime
murmur run <pipeline>   # execute a governed pipeline locally, with a RUN-LOG
```

## Shipped — v0.1.0

- Typed IR: agents, subagents, skills, instructions.
- Compiler with a `RuntimeCompiler` adapter interface + atomic staging.
- Two structurally-dissimilar adapters: Copilot (persona-Markdown) and goose (recipes).
- CLI: `init`, `add`, `compile`, `doctor`, `list`, `publish`.
- Deterministic structural `init` + agent-invoked semantic pass.
- Master-agent dynamic spawning via the externalized `subagent-authoring` skill.
- Defense-in-depth `publish` scrubber (denylist + entropy/pattern secret scanning).
- Knowledge-externalization CI gate. Zero runtime dependencies.

---

## The missing layer (why the roadmap exists)

murmur compiles agent **definitions**. The richest real-world asset — the
`architect.agent.md` orchestration systems across these projects — encodes an
**orchestration layer** murmur cannot yet represent: multi-phase pipelines with
tiers, selective-dispatch decision tables, parallelism caps and loop limits,
multi-dimensional scoring rubrics, output-section contracts, and `RUN-LOG`
execution tracking. Modeling and compiling *that* is the single highest-value
addition, and it is what turns murmur from "defines agents" into "runs governed
swarms."

---

## v0.2 — Orchestration IR (top priority)

Add a fifth IR type: **`pipeline` / `workflow`**. A typed definition capturing
phases, per-phase agent dispatch, gating conditions, loop limits, and parallelism
caps — compiled into each runtime's orchestration form (a Copilot master
`architect`-style agent; a goose recipe with `sub_recipes` + sequencing).

- **`murmur run <pipeline>`** — execute a pipeline locally, emitting a `RUN-LOG.md`
  (date, tier, iterations, scores, verifier verdict).
- **Pipeline tiers** — lightweight / standard / extended.
- _Source patterns:_ `architect.agent.md`, `RUN-LOG.md`.

## v0.3 — Evaluation & contracts

- **Scoring rubrics as a first-class artifact** — typed scorecards (dimensions,
  mandatory/optional questions, 1–5 scales, severity counts, readiness gates) that a
  `critic` agent loads. `murmur score` validates a document against a rubric.
- **Output-section contracts** — extend instructions with an enforced ordered-section
  schema (e.g. the 12-section analysis / 11-section domain formats), checkable by
  `doctor`.
- _Source patterns:_ `critic.agent.md`, `*-output-sections.instructions.md`.

## v0.4 — Selective dispatch & rosters

- **Dispatch tables** in agent frontmatter: machine-readable "invoke when / skip when"
  matrices, plus a **task classifier** (`murmur classify`) that selects an agent set
  by task type.
- **Domain-critic roster** in the base library (business-critic, social-critic,
  data-critic, fact-checker, verifier) as generic templates.
- _Source patterns:_ architect dispatch matrices, domain query-classifier agents.

## v0.5 — Concurrency engine

- **Worker pool with budget enforcement:**
  `effective_workers = min(configured, rpm, tpm, n_tasks)`, retry-with-backoff, for
  parallel subagent dispatch — porting the proven concurrency model and loop-cap
  discipline.
- _Source patterns:_ audio2text `gemini.py` / `gemini_batch.py`.

## v0.6 — Tool generation (auto MCP / tool stubs)

Auto context generation is half the promise; the other half is **auto tool
generation.** Add a **`tool` IR type** and a generator that, from the structural
analysis, scaffolds runtime tools the agents can call:

- Emit **MCP server stubs** (typed tool schemas reusing MCP JSON shapes) discovered
  from the codebase (build commands, test runners, scripts, API surfaces).
- Compile tools per runtime: MCP `mcpServers` for Claude, goose `extensions`,
  Copilot tool references.
- **`murmur add tool <name>`** and tool inclusion in `init`.

## v0.7 — Runtime adapters (the original Phase F)

- **Claude Code** adapter (near-free; shares Copilot's persona-Markdown substrate).
- **Cursor** adapter (`.cursor/rules` MDC + skills).
- **ACP** adapter — the protocol-level portability target (JSON-RPC/stdio, MCP types).
- **npm-package plugin model** — adapters shippable as `murmur-plugin-*` with
  auto-discovery, replacing directly-registered TypeScript adapters.
- **Skill assets** — directory-structured skills with per-runtime asset resolution.

## v0.8 — Project & DX hardening

- **Git-hook integration** — generate a `lefthook.yml` that runs `murmur doctor` +
  the externalization gate pre-commit; **agent CODEOWNERS** protection.
- **Schema-driven validation** à la Velite `defineCollection` for plugin authors.
- **Docs compiler** — `murmur docs` compiles agent packs + run-logs into a browsable
  HTML guide.
- **Env-driven config with auto-detection** and **phase-tagged config** in JSDoc.
- _Source patterns:_ agri (lefthook/CODEOWNERS), portfolio (Velite), chat (`build.py`),
  elec (env auto-detect), audio2text (phased config).

## v1.0 — The full union

ACP portability + cross-runtime spawning proven by the hot-load probe + semantic init
+ tool generation + the orchestration/scoring/dispatch layer = a system that doesn't
just *define* agents but **runs governed multi-agent pipelines portably** — the union
no competitor (goose, Claude Code, ECC.tools) offers together.

---

## Priority order

1. Pipeline/orchestration IR + `murmur run` + RUN-LOG (v0.2) — the keystone.
2. Scoring rubrics + output-section contracts (v0.3).
3. Selective-dispatch tables + task classifier + critic rosters (v0.4).
4. Concurrency / worker-budget engine (v0.5).
5. Tool generation / auto MCP (v0.6).
6. Claude Code → Cursor → ACP adapters + plugin model (v0.7).
7. Git hooks, schema-driven plugin validation, docs compiler (v0.8).

## Release & versioning

Versioning is automated via Conventional Commits + release-please (see
[CONTRIBUTING.md](../CONTRIBUTING.md)). Merges to `main` open a release PR that bumps
the version and updates [CHANGELOG.md](../CHANGELOG.md); merging it tags the release.
