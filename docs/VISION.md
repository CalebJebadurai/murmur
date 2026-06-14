# Murmuration — Architecture & Vision

This document captures the design so implementation can proceed later. Scope of the
initial session was intentionally limited to **repo + README + this spec**.

## 1. Principles

1. **Agents are generic.** No agent prompt contains project-specific facts.
2. **Knowledge is data, not prompt.** All context comes from *skills* (domain knowledge)
   and *instructions* (scoped behavioral rules), loaded on demand.
3. **Emergence over orchestration scripts.** A master agent coordinates via simple,
   shared rules; specialists are spawned as needed rather than pre-wired.
4. **Portable by compilation.** Author once in an abstract format; compile to each runtime.
5. **Publishable.** Anything shared is scrubbed of codebase-specific context.

## 2. Components

### 2.1 Master agent
- Decomposes a task into subtasks.
- Matches subtasks to existing subagents.
- **Spawns a new subagent** when no specialist fits: writes a scoped agent definition,
  attaches the relevant skills/instructions, runs it, and optionally persists or discards it.
- Maintains a registry of available subagents and their capabilities.

### 2.2 Generic agents (portable)
- `implementer`, `researcher`, `analyst`, `critic`, `verifier`, `planner`.
- Behavior parameterized entirely by attached skills/instructions.

### 2.3 Subagents
- Narrow, often ephemeral specialists with isolated context.
- Created by hand (`murmur add subagent`) or on demand by the master agent.

### 2.4 Skills
- Self-contained knowledge packages (a `SKILL.md` + optional assets).
- Loaded on demand by any agent that declares a need.

### 2.5 Instructions
- Behavioral rules scoped by `applyTo` glob patterns.
- Map cleanly to Copilot `*.instructions.md`, Claude `CLAUDE.md` sections, goose hints.

### 2.6 `init` codebase-analyzer agent
- Runs **inside the host agent** (no separate API key).
- Reads the target repo (structure, build files, conventions, test setup, domain terms).
- Emits skills + instructions that make the generic agents project-aware.
- Idempotent: re-running updates rather than duplicates.

### 2.7 Compiler
- Input: abstract agent/skill/instruction definitions (proposed: `murmur/` dir, YAML+MD).
- Output targets: Copilot, Claude Code, goose, Cursor, ACP.
- `AGENTS.md` as the universal manifest fallback.

## 3. Abstract schema (draft)

```
murmur/
  agents/        # generic agent defs (name, role, allowed tools, skill/instruction refs)
  subagents/     # specialist defs (+ spawn templates the master agent uses)
  skills/        # SKILL.md packages
  instructions/  # applyTo-scoped rule files
  murmur.config.{ts,json}   # targets, project metadata, publish rules
```

## 4. CLI surface (draft)

- `init`, `add agent|subagent|skill|instruction`, `compile --target`, `doctor`,
  `publish`, `list`, `update`.
- Global install (`bun add -g murmur`) + project-local (`bunx murmur`).

## 5. Publish / context-stripping

- `murmur publish` scrubs generated artifacts of:
  - repo names, paths, proprietary domain terms, secrets, author PII.
- Produces a clean, reusable agent pack.

## 6. Competitive synthesis (best-of-all-worlds)

- **Claude Code:** isolated-context sub-agents → adopt.
- **goose (AAIF):** skills as first-class, recipes, multi-runtime skill mirroring,
  `AGENTS.md`/`CLAUDE.md` parity → adopt skill-centric model + manifest parity.
- **ACP:** editor/agent decoupling standard → long-term portability target.
- **Net-new:** master-agent on-demand subagent spawning + `init` auto-generation of
  context from the codebase.

## 7. Open decisions

- Config language: TS (typed, importable) vs JSON (simple). Leaning TS with JSON fallback.
- Whether subagents spawned at runtime persist by default.
- Skill packaging: single-file vs directory with assets.
