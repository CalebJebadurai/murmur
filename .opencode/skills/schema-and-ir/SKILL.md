---
name: schema-and-ir
description: The shape of the abstract IR — the murmur/ directory, its six definition kinds, and how loadIR parses and validates them.
---

# Schema & IR

The intermediate representation (IR) is the runtime-neutral source of truth: frontmatter+Markdown files under `murmur/`, typed in `src/schema/`.

## The six definition kinds

`IRSet` (`src/schema/index.ts`) collects six arrays, one directory each under `murmur/`:

| Kind | Directory | Type |
|---|---|---|
| agents | `murmur/agents/*.md` | `AgentDefinition` |
| subagents | `murmur/subagents/*.md` | `SubagentDefinition` |
| skills | `murmur/skills/<name>/SKILL.md` or `skills/<name>.md` | `SkillDefinition` |
| instructions | `murmur/instructions/*.md` | `InstructionDefinition` |
| pipelines | `murmur/pipelines/*.md` | `PipelineDefinition` |
| rubrics | `murmur/rubrics/*.md` | `RubricDefinition` |

## Loading & validation

`loadIR(murmurDir)` (`src/schema/load.ts`) globs each directory (Bun `Glob`), reads every file in sorted order (deterministic), and runs the matching `validate*` function from `src/schema/validate.ts`. It returns a `LoadResult` — either the populated `IRSet` or aggregated `ValidationError[]`.

- Skills support **both** flat `skills/<name>.md` and nested `skills/<name>/SKILL.md`.
- Every definition is YAML frontmatter + a Markdown body; `util/frontmatter.ts` parses the split.

## Where project facts belong

Agent bodies stay generic — enforced by `scripts/check-externalization.ts`. **Skills and instructions are the home for codebase-specific knowledge**, like this skill.

