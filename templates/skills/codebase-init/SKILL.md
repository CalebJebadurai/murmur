---
name: codebase-init
description: How to enrich the deterministic structural pass with semantic knowledge about a codebase.
---

# Codebase Init

Procedural knowledge for the `murmur-init` agent. Contains no project facts.

## What the structural pass already produced

`murmr init` (deterministic, no LLM) parsed package.json, tsconfig.json, the
directory tree, lockfiles, test config, and CI files, emitting:
- `project-structure` — directory layout and module map
- `build-system` — package manager, scripts, bundler
- `test-conventions` — test runner and layout
- `*-conventions` instructions scoped by `applyTo` globs

## What you should add (semantic)

- **Architecture rationale** — why the code is organized as it is; the boundaries.
- **Domain glossary** — the business/domain terms that appear in the code.
- **Non-obvious conventions** — error-handling patterns, API contracts, gotchas.

Write each as a new skill under `murmur/skills/<name>/SKILL.md`. Keep agent bodies
generic.
