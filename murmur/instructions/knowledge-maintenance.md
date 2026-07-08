---
applyTo: "**"
---

# Knowledge Maintenance

These rules keep the project's single source of truth current for every agent.
They apply after any task that changes the codebase.

- Before considering a task **done**, check whether it changed architecture,
  structure, dependencies, build, deployment, or environments.
- If it did, hand off to the **curator** agent — or, if you are equipped to, update
  the matching source-of-truth skill or instruction yourself in the same change.
- Record what was implemented and any decisions worth remembering, so the next agent
  inherits the context instead of re-deriving it.
- Put every project fact in a skill or instruction; never write project facts into an
  agent body.
- Prefer updating an existing knowledge file over creating a duplicate; keep edits
  minimal and factual.

> Note: host runtimes do not automatically run an agent after another finishes. This
> rule is the mechanism that makes knowledge upkeep part of every task — the active
> agent either updates the knowledge base or hands off to the curator before closing
> out the work.
