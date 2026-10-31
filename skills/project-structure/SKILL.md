---
name: project-structure
description: "How this project's directories, modules, and entry points are organized."
---

# Project Structure

> This skill is a structural placeholder authored by hand for the Murmuration base
> library. In a real project, `murmr init` regenerates it from static analysis of
> the actual directory tree. All codebase-specific layout facts belong here, not in
> agent bodies.

- Describe the top-level layout (src, apps, packages, tests).
- Map each major module to its responsibility.
- Note entry points and where new code conventionally goes.

## v2 modules

- `src/providers/` — model provider client used by `murmr init --semantic`.
- `src/jev/` — Jev System One client and routing for `murmr classify --engine jev`; requires a key, and only uses the mock client with `--mock`.
- `src/harness2/` — experimental template generator and `EXPERIENCE.md` tiers behind `murmr evolve`. Probes check structure only and never run an agent.
- `src/util/keychain.ts` — secret lookup from the environment, then macOS Keychain.
