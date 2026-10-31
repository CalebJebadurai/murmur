# Murmur Vision

**Your AI engineering setup, portable across every coding agent.**

Murmur keeps your agents, skills, rules and review workflows in one version-controlled place, then compiles them for whichever coding tools your team uses. Models and tools can change every month. The way your team works should not have to change with them.

## The problem

Coding has moved from typing code to directing agents. That move created a new kind of work: maintaining the setup that tells agents how to behave.

| What developers do now | What goes wrong |
|---|---|
| Switch between Claude Code, Codex, Cursor and others | Skills and rules stay behind in the old tool |
| Pick a new best model every few weeks | Workflows that name a model age quickly |
| Run many agents in parallel | Scope, review and proof differ from run to run |
| Hand tasks over for long autonomous runs | Teams cannot see what "done" required |
| Add more rules and skills over time | Hidden context grows and wastes tokens |
| Share conventions across a team | Each person's setup drifts apart |

Most tools solve the layers below this problem. Models produce text. Harnesses give models tools. Interfaces such as T3 Code let a person control many harnesses. None of them owns the definition of how your team works.

## Where Murmur sits

```text
Your team's way of working
        |
     Murmur        one source of truth, compiled per target
        |
   Interfaces      Claude Desktop, Cursor, T3 Code, your terminal
        |
    Harnesses      Claude Code, Codex, OpenCode, goose
        |
     Models        Claude, GPT, Gemini, open-weight models
```

Murmur does not run your agents or replace your tools. It is closer to a compiler than an app: you write the source once, and each tool gets its native files.

## Murmur in a real workflow

### Set up once

A developer runs `murmr init` in a repository. Murmur creates a `murmur/` folder from the codebase, with agents, skills, instructions and pipelines. The team reviews it like any other code.

### Work in any tool

`murmr compile` writes native files for each configured target. One developer uses Claude Code, another uses Codex, and a third uses Cursor. They all get the same project knowledge and team rules.

### Improve in one place

When an agent keeps making the same mistake, the fix goes into `murmur/` through a pull request. The next compile delivers it everywhere. A lesson learned by one person reaches the whole team.

### Check in CI

`murmr doctor` validates the setup, and the pre-commit hook keeps generated files current. A broken reference fails before it reaches a teammate.

### Switch without starting over

A new tool or model arrives. The team adds a target, recompiles and tests. Their workflow stays in git, so trying a new tool costs an afternoon rather than a migration.

## How it solves the modern workflow

| Problem | How Murmur helps | Status |
|---|---|---|
| **Setups do not travel** | One source compiled to 8 targets, including Claude Code, Codex and OpenCode | Available |
| **Team drift** | The setup lives in git and changes through review | Available |
| **Broken configuration** | `murmr doctor` validates references and can fix missing ones | Available |
| **Copies across many repos** | One git library, chosen per project, pinned by a lockfile, with inheritance and traits | Available |
| **Overwriting your work** | Compile keeps any file it did not write, and replacing needs a flag and makes a backup | Available |
| **Publishing private details** | `murmr publish` scrubs project facts and secrets from shareable packs | Available |
| **Inconsistent reviews** | A shared pipeline writes, reviews with a pass limit, then stops for approval | Planned |
| **Unproven "done"** | Pipeline gates require evidence such as test output or screenshots | Planned |
| **Model churn** | Roles such as `writer` and `reviewer` map to models in one place | Planned |
| **Hidden context cost** | `murmr doctor --cost` reports what each target loads into each session | Planned |
| **Machine drift** | `murmr sync` updates compiled config across machines, never secrets | Planned |
| **Behavior differences between tools** | Target tests show where the same skill behaves differently | Exploring |

Portable does not mean identical. Models are increasingly tuned to their own harness, so one skill can behave differently across tools. Murmur makes your intent portable and should make those differences visible. It should not pretend they do not exist.

## Principles

1. **Your setup belongs to you.** It is plain text in your repository, not locked in a vendor's account.
2. **Compile to native files.** Each tool should feel normal to use, with no Murmur runtime required.
3. **Stay out of the agent loop.** Use each tool's own harness and subscription terms.
4. **Say what is proven.** Experimental features are labeled, and claims need evidence.
5. **Humans set the gates.** Teams choose where agents can act alone. Auto-merge is never the default.
6. **Keep secrets out.** Murmur reads secrets from the environment or Keychain and never copies them into generated files.
7. **Stay deterministic.** The same input produces the same files.

## What Murmur will not be

- **A harness:** that layer is commoditizing, and the labs are tuning it to their own models.
- **An interface or ADE:** T3 Code and others already do this well. Murmur should work with them.
- **A model router or token proxy:** these depend on scale, and proxies can break provider terms.
- **A claim of self-improving AI:** `murmr evolve` is an experimental template tool. It stays labeled that way until it can test real behavior.

## Roadmap

### Now: earn trust

- Keep the website, README and package accurate.
- Keep Codex and OpenCode output working as those tools change.
- Publish a demo of one setup running in Claude Code and Codex.

### Next: own the shipping workflow

- Ship the review and shipping pack.
- Add context cost reporting.
- Add model roles and proof gates.

### Later: become the shared layer

- Add multi-machine sync.
- Expose the setup through an MCP server for tools that can read it.
- Add target behavior tests and shareable team packs.

## How we will know it works

- A developer goes from install to a working second target in under five minutes.
- Teams keep `murmur/` in their repository after the first month.
- At least one team uses it across two or more coding tools.
- Developers report fixing an agent problem once and seeing the fix everywhere.
- Third parties publish their own packs or target plugins.

## Biggest risks

- **Tools add this themselves:** an interface such as T3 Code could add skill syncing. Murmur's defense is being tool-neutral and team-owned.
- **Formats converge:** if every tool shares one skill format, a compiler matters less. Value then moves to pipelines, gates, review and cost reporting.
- **Target formats change:** vendors can change file layouts at any time, so adapters need regular testing.
- **It stays a solo project:** the idea needs real users. Conversations with developers who switch tools matter more than new features.

## The long view

Today, a team's way of working with agents is scattered across personal settings and chat history. It should be as durable as source code: reviewed, versioned, tested and portable.

The tools will keep changing. Murmur should be the part that stays.
