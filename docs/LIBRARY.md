# Shared Agent Library

Keep shared agents in one git repository, and let each project choose what it uses. Collaborators do not need access to the library, because each project commits its own copies.

## Your files are safe

| Situation | What Murmur does |
|---|---|
| You already have `.claude/agents/architect.md` | Keeps yours and reports it |
| You have your own `AGENTS.md` | Keeps yours and reports it |
| You edited a file Murmur generated | Keeps your edit and reports it |
| `murmur/agents/architect.md` matches a library name | Your agent wins, and the library version is ignored |
| You run `murmr init` in a project with `murmur/` | Keeps your agents, skills and instructions |
| You run `murmr library sync` | Writes only inside `murmur/.library/` |

Murmur replaces an existing file only if you pass `--replace` or `--force`, or use `--mode overwrite`. It backs the file up to `.murmur/backups/` first. It never deletes generated files.

If you already compiled with an older version, Murmur treats changed output as yours until you run `murmr compile --replace` once. After that, it knows which files it owns.

## Set up a library

A library uses the same layout as `murmur/`, either at the repo root or inside a `murmur/` folder:

```text
agent-library/
  agents/critic.md
  skills/review-basics/SKILL.md
  instructions/typescript.md
  traits/cost-analysis.md
```

Then add it to `murmur.config.json` in a project:

```json
{
  "targets": ["claude", "codex"],
  "project": { "name": "paisa" },
  "library": {
    "source": "github.com/you/agent-library#main",
    "use": ["analyst", "critic"]
  }
}
```

`source` can be a local path, or an https, ssh or `git@` URL with an optional `#ref`. Dependencies such as skills come along automatically.

```bash
murmr library sync
```

```bash
murmr compile
```

Commit `murmur/.library/`, `murmur.lock.json`, `.murmur/manifest.json` and the generated files. The lockfile pins the library commit, so `sync` stays on that commit until you ask for newer content:

```bash
murmr library sync --update
```

A local path source always uses its current working copy.

## When names collide

Your agent always wins. You have three options:

1. **Keep yours only:** do nothing.
2. **Keep both:** rename the library version:

   ```json
   { "use": [{ "name": "architect", "as": "library-architect" }] }
   ```

3. **Build on the library version:** add your rules to it:

   ```yaml
   ---
   extends: library:architect
   ---
   Add my own planning rules here.
   ```

`as` works for agents and subagents. If a name exists in two kinds, write it as `skills/review`.

## Inheritance

```yaml
# agents/human.md: exists only to be extended
---
description: Shared behavior.
abstract: true
---
Be honest and direct.
```

```yaml
# agents/critic.md
---
description: "Use when: work needs critical review."
extends: human
---
Find weaknesses and unstated assumptions.
```

```yaml
# agents/financial-critic.md
---
extends: critic
traits: [cost-analysis]
---
Focus on unit economics and cash flow.
```

Murmur flattens this before compiling, so coding tools see one plain agent.

| Field | How it merges |
|---|---|
| Body text | Parent, then traits, then child |
| `## Section` with the same heading | The later one replaces the earlier one |
| `skills`, `instructions`, `agents` | Combined |
| `description`, `tools`, `model`, `dispatch` | The child's value, or the parent's if it has none |

Use `extends` for what an agent is, and `traits` for what it knows. A trait is a Markdown file in `traits/`, and it can list `skills` and `instructions` of its own.

## Limits

- Pipelines and rubrics are not imported yet.
- Your existing `.claude/agents/` files are kept, but they are not imported into `murmur/`.
- Generated files contain the full inherited text. A public repo that imports a private rule makes that rule public, so check before you push.
