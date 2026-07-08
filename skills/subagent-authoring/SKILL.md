---
name: subagent-authoring
description: "Rules the master agent follows to author a scoped subagent on demand."
---

# Subagent Authoring

This skill externalizes the master agent's spawn heuristic. It is **procedural**
knowledge only — it contains no project facts.

## When to spawn

Spawn a new subagent only when a subtask matches no standing agent's `description`
trigger. Prefer reusing an existing specialist.

## How to author the definition

1. **Role description** — one focused paragraph stating the single capability the
   specialist provides. Begin with a `"Use when: …"` trigger.
2. **Skills to attach** — attach the skills whose `description` covers the domain
   knowledge the subtask needs. Attach nothing speculative.
3. **Instructions to attach** — attach instructions whose `applyTo` glob matches the
   files the subtask will touch.
4. **Tool policy** — grant the minimum tools required (read-only unless the subtask
   must edit or create files).
5. **Body** — generic prose; never inline a project fact that belongs in a skill.

## Choosing the dispatch path

- If the runtime hot-loads newly written agent files (see the recorded capability
  probe), write the definition and dispatch by name.
- Otherwise compose an in-context ephemeral persona and pass the role, skills, and
  instructions directly in the subagent prompt.

## Persistence

Persist a spawned subagent to `murmur/subagents/` only after it has been needed
more than twice in a session; otherwise discard it.
