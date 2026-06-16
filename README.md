# 🐦‍⬛ Murmuration (`murmr`)

> A tool-agnostic, packageable multi-agent + subagent framework you can drop into **any** project.
> Generic agents. Specialized subagents. All knowledge sourced from **skills** and **instructions** — never hard-coded into the agents themselves.

A *murmuration* is thousands of starlings moving as a single, coordinated intelligence — **no central controller, emergent behavior from simple shared rules.** That's the design philosophy: a small set of generic agents, a master agent that spawns specialized subagents on demand, and a shared substrate of skills/instructions that gives them context.

> **Status:** ✅ v0.1.0 shipped. Defines and compiles agents/subagents/skills/instructions, with `init`, `compile` (Copilot + goose), `doctor`, `add`, `list`, and a defense-in-depth `publish` scrubber. The roadmap grows this into a portable engine for **governed multi-agent / agent-swarm workflows** with automatic context **and** tool generation — see [`docs/ROADMAP.md`](docs/ROADMAP.md) and [`docs/VISION.md`](docs/VISION.md).

---

## Why this exists

Most agent setups bake project-specific knowledge directly into agent prompts, making them non-portable. Murmuration inverts that:

- **Agents stay generic and reusable.** A `master`, an `implementer`, a `researcher`, a `critic` — none of them know anything about *your* codebase.
- **Context lives in skills & instructions.** Project-specific knowledge is generated into portable skill/instruction files that any agent can pull in.
- **A master agent spawns subagents on demand.** When a task needs a specialist that doesn't exist yet, the master agent creates one — scoped, disposable, isolated-context.
- **An `init` workflow auto-generates skills + instructions from your codebase** by reading it with whatever host agent you're already running (Copilot, Claude Code, goose, etc.) — no extra API key required.
- **One package, any project.** Install via `bunx murmr init` and it scaffolds the right files for your runtime.

---

## Core concepts

| Concept | Role |
|---|---|
| **Master agent** | Orchestrates. Decomposes tasks, delegates to subagents, spawns *new* subagents when no existing specialist fits. |
| **Generic agents** | Portable, codebase-agnostic roles (implementer, researcher, critic, analyst, verifier). |
| **Subagents** | Narrow specialists, often spawned on demand, with isolated context. |
| **Skills** | Packaged domain knowledge the agents read on demand (the *what to know*). |
| **Instructions** | Rules/conventions scoped via `applyTo` globs (the *how to behave*). |
| **`init` generator** | Reads your codebase via the host agent and emits the skills + instructions that make the generic agents project-aware. |
| **Compiler** | Translates the abstract agent/skill/instruction definitions into each runtime's native format. |

---

## Tool-agnostic by design

Agents, skills, and instructions are authored once in an abstract format and **compiled** into each runtime's native layout:

| Runtime | Compiles to |
|---|---|
| VS Code Copilot | `.github/agents/*.md`, `*.instructions.md`, `*.prompt.md`, `SKILL.md` |
| Claude Code | sub-agents, `CLAUDE.md`, `.claude/skills/` |
| goose (AAIF) | recipes, root-level skills, `AGENTS.md` |
| Cursor | `.cursor/` rules + skills |
| ACP-compatible editors | via the [Agent Client Protocol](https://agentclientprotocol.com/) (north-star target) |

`AGENTS.md` is treated as the universal lowest-common-denominator manifest.

---

## How it compares (best-of-all-worlds)

| Capability | Claude Code | goose (AAIF) | Cursor | **Murmuration** |
|---|---|---|---|---|
| Sub-agents w/ isolated context | ✅ | ⚠️ (recipes) | ⚠️ | ✅ |
| Master agent spawns new subagents on demand | ❌ | ❌ | ❌ | ✅ (core feature) |
| Knowledge fully externalized to skills/instructions | ⚠️ | ✅ (skills) | ⚠️ | ✅ (enforced) |
| Auto-generate context from codebase | ❌ | ❌ | ❌ | ✅ (`init` agent) |
| Multi-runtime / portable | ❌ | ⚠️ | ❌ | ✅ (compiler) |
| Installable package + CLI | ✅ (`npx`) | ✅ (binary) | ❌ | ✅ (`bunx murmr`) |
| Global + project-level commands | ⚠️ | ✅ | ⚠️ | ✅ |

---

## Install & quick start

No install required — run it straight from the registry with `bunx`:

```bash
# In any project directory:
bunx murmr init                  # analyze the codebase → agents + skills + instructions
bunx murmr compile --target copilot    # or: goose
bunx murmr doctor                # validate the generated IR
```

Or install it for repeated use:

```bash
bun add -g murmr                 # global
# or, as a dev dependency in a project:
bun add -d murmr
```

> Installs two equivalent commands: **`murmr`** and the shorter **`mrmr`** — use whichever you prefer.

The goal: **anyone runs one command in any codebase and gets it ready for any
multi-agent / agent-swarm workflow** — with auto-generated context (skills +
instructions today; tools and pipelines on the [roadmap](docs/ROADMAP.md)) that
compiles to whatever runtime they use.

---

## CLI

```bash
# Project level
murmr init                   # analyze codebase → generate skills + instructions + agents
murmr add agent <name>       # scaffold a new generic agent
murmr add subagent <name>    # scaffold a specialist subagent
murmr add skill <name>       # scaffold a skill
murmr add instruction <name> # scaffold a scoped instruction
murmr compile --target copilot|goose    # claude|cursor|acp on the roadmap
murmr doctor                 # validate frontmatter, applyTo globs, references
murmr list                   # inventory the murmur/ IR
murmr publish [--dry-run] [--strict]     # strip codebase-specific context for sharing
```

---

## Publishing hygiene

Before this repo (or any derived agent pack) is published, **all codebase-specific context is stripped** — `murmr publish` scrubs generated skills/instructions of project-identifying details (repo name, paths, domain terms, PII) and runs gitleaks-style secret scanning, leaving only the generic agent framework. `--dry-run` previews the scrub; `--strict` fails if any secret-shaped string survives.

---

## Roadmap

v0.1.0 defines and compiles agents. The roadmap grows murmur into a portable engine for **governed multi-agent pipelines** with automatic context and tool generation:

- **v0.2** — Orchestration IR (`pipeline`/`workflow`) + `murmr run` + `RUN-LOG`
- **v0.3** — Scoring rubrics + output-section contracts (`murmr score`)
- **v0.4** — Selective-dispatch tables + task classifier + critic rosters
- **v0.5** — Concurrency engine (worker pool + rpm/tpm budgets)
- **v0.6** — Tool generation (auto MCP / tool stubs)
- **v0.7** — Claude Code → Cursor → ACP adapters + plugin model
- **v0.8** — Git hooks, schema-driven plugin validation, docs compiler
- **v1.0** — The full union: portable governed agent swarms

Full detail in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Contributing

Contributions welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md). Commits follow
[Conventional Commits](https://www.conventionalcommits.org/) and releases are
automated via release-please (merging to `main` opens a version-bump + changelog PR).

## License

MIT © calebjebadurai
