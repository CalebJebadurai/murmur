---
name: compiler-architecture
description: "How the compiler turns the abstract IR into each runtime's native files via the RuntimeCompiler adapter interface."
---

# Compiler Architecture

The compiler turns the runtime-neutral IR into per-runtime files. It lives in `src/compiler/`.

## The adapter contract — `RuntimeCompiler`

Defined in `src/compiler/RuntimeCompiler.ts`. Every target implements one interface:

- `readonly id` — target identifier (e.g. `"copilot"`, `"goose"`).
- `compileAgent`, `compileSubagent`, `compileSkill`, `compileInstruction` — required; each returns `EmittedFile[]` (`{ path, contents }`, path relative to the output root).
- `compilePipeline?` — optional orchestration compilation; adapters that cannot express pipelines omit it (clean no-op).
- `finalize?` — optional target-level files (e.g. goose `AGENTS.md` / `CLAUDE.md` parity).

Every method receives a `CompileContext` = `{ config, ir }`, so an adapter can resolve cross-references against the full `IRSet`.

## Driving a compile

- `emitAll(adapter, ctx)` (in `RuntimeCompiler.ts`) iterates the IR in a fixed order — agents → subagents → skills → instructions → pipelines (if `compilePipeline`) → `finalize` — collecting every `EmittedFile`.
- `compileTarget(adapter, ctx, outputRoot)` (in `src/compiler/compile.ts`) is **atomic**: it collects all files first (an adapter throw aborts before the output tree is touched), writes them into a sibling staging dir `.murmur-stage-<id>-<pid>`, then moves them into place. The staging dir is always removed in a `finally`.

## Registry & built-in adapters

`src/compiler/registry.ts` maps target id → adapter factory (`getAdapter(id)`, `availableTargets()`). Built-ins:

- `CopilotAdapter` (`adapters/copilot.ts`) → `.github/agents/<name>.agent.md`, `.github/instructions/<name>.instructions.md`, `.github/skills/<name>/SKILL.md`.
- `GooseAdapter` (`adapters/goose.ts`) → `recipes/<name>.yaml`, root-level `skills/` and `hints/`, plus `AGENTS.md` / `CLAUDE.md` via `finalize`.

All YAML frontmatter is emitted through `util/yaml.ts` (`emitFrontmatterDoc`).
