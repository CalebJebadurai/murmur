# 🐦‍⬛ Murmuration (`murmur`)

> A tool-agnostic, packageable multi-agent + subagent framework you can drop into **any** project.
> Generic agents. Specialized subagents. All knowledge sourced from **skills** and **instructions** — never hard-coded into the agents themselves.

A *murmuration* is thousands of starlings moving as a single, coordinated intelligence — **no central controller, emergent behavior from simple shared rules.** That's the design philosophy: a small set of generic agents, a master agent that spawns specialized subagents on demand, and a shared substrate of skills/instructions that gives them context.

> **Status:** 🚧 Scaffold / vision stage. Repo initialized; implementation to follow. See [`docs/VISION.md`](docs/VISION.md) for the full architecture.

---

## Why this exists

Most agent setups bake project-specific knowledge directly into agent prompts, making them non-portable. Murmuration inverts that:

- **Agents stay generic and reusable.** A `master`, an `implementer`, a `researcher`, a `critic` — none of them know anything about *your* codebase.
- **Context lives in skills & instructions.** Project-specific knowledge is generated into portable skill/instruction files that any agent can pull in.
- **A master agent spawns subagents on demand.** When a task needs a specialist that doesn't exist yet, the master agent creates one — scoped, disposable, isolated-context.
- **An `init` workflow auto-generates skills + instructions from your codebase** by reading it with whatever host agent you're already running (Copilot, Claude Code, goose, etc.) — no extra API key required.
- **One package, any project.** Install via `bunx murmur init` and it scaffolds the right files for your runtime.

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
| Installable package + CLI | ✅ (`npx`) | ✅ (binary) | ❌ | ✅ (`bunx murmur`) |
| Global + project-level commands | ⚠️ | ✅ | ⚠️ | ✅ |

---

## Planned CLI

```bash
# Global (once)
bun add -g murmur            # or: bunx murmur <cmd>

# Project level
murmur init                  # analyze codebase → generate skills + instructions + agents
murmur add agent <name>      # scaffold a new generic agent
murmur add subagent <name>   # scaffold a specialist subagent
murmur add skill <name>      # scaffold a skill
murmur compile --target copilot|claude|goose|cursor|acp
murmur doctor                # validate frontmatter, applyTo globs, references
murmur publish               # strip codebase-specific context, prep for sharing
```

---

## Publishing hygiene

Before this repo (or any derived agent pack) is published, **all codebase-specific context is stripped** — `murmur publish` (planned) scrubs generated skills/instructions of project-identifying details, leaving only the generic agent framework.

---

## Roadmap

- [x] Repo scaffold + vision
- [ ] Abstract agent/skill/instruction schema
- [ ] Compiler (Copilot + Claude Code first)
- [ ] `init` codebase-analyzer agent
- [ ] Master agent + subagent spawning protocol
- [ ] CLI (`bun`)
- [ ] `publish` context-stripping
- [ ] ACP target

## License

MIT © cnickson
