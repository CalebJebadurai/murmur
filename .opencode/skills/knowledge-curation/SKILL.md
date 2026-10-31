---
name: knowledge-curation
description: "The procedure the curator agent follows to inventory, initialize, and keep a project's knowledge base (skills + instructions) current as the single source of truth."
---

# Knowledge Curation

Procedural knowledge for maintaining a project's knowledge base. It contains no
project facts of its own — it describes *how* to keep the project-specific skills
and instructions accurate, complete, and current.

## 1. Inventory the installed knowledge

Enumerate the IR before doing anything else (read the `murmur/` tree or run the
list command):

- agents, subagents — who consumes the knowledge.
- skills, instructions — where the knowledge lives.
- pipelines, rubrics — orchestration and evaluation that also depend on it.

Build a map of which knowledge file covers which domain, and note gaps and any
placeholder stubs.

## 2. Maintain the single source of truth

Keep a canonical set of knowledge skills, **created only if missing** and sized to
the project. Small projects may need just a few; large projects warrant a
multi-level tree (one skill per bounded context), cross-linked from a top-level
index skill:

- **project-structure** — directory and module map, entry points.
- **build-system** — package manager, scripts, bundler, test runner.
- **architecture** — boundaries, data flow, key abstractions and the reasons for them.
- **deployment** — how the project ships: registry/artifacts, release process, CI.
- **environments** — runtimes, required env vars, configuration, secrets policy.
- **domain-glossary** — the business/domain terms that appear in the code.

Behavioral conventions that constrain *how files are edited* belong in an
**instruction** (scoped by an `applyTo` glob), not a skill.

## 3. Reconcile after every task

This is the curator's recurring job. When work changes the codebase:

1. Determine what actually changed — files touched, dependencies added or removed,
   scripts/config/env/deployment changes.
2. Update **only** the affected source-of-truth files. Keep edits minimal and
   strictly factual.
3. Record what was implemented (and any decisions worth remembering) in a running
   changelog/decisions skill, so the next agent inherits the context rather than
   re-deriving it.

## 4. Initialize and de-stub

Scan for scaffolding placeholders (`__PLACEHOLDER__`, `__DESCRIBE…__`,
`__GLOB_PATTERN__`, empty `applyTo`) and replace each with real facts read from the
codebase. A passing schema check does **not** mean the content is real — verify
against the source.

## 5. Validate and propagate

- Run the IR validator (`doctor`) to confirm schema, references, and globs are sound.
- Run the externalization gate to confirm project facts live in skills/instructions,
  never in agent bodies.
- Recompile every configured runtime target so host agents receive the refreshed
  context.

## Sizing guidance

- **Small project:** a handful of flat skills is enough; do not over-structure.
- **Large project:** organize knowledge hierarchically — a top-level index skill that
  links to per-area skills — and keep each skill focused on one bounded context.
- Always sample and chunk; never load an entire large codebase in one pass.

