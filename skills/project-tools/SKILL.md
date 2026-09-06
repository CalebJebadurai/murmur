---
name: project-tools
description: "Discovered operational development tools and scripts for agent execution."
---

# Project Tools

These operational commands have been verified and discovered from the repository structure:

| Tool | Category | Command | Description | Source |
|---|---|---|---|---|
| `build` | `build` | `bun run build` | Compile production assets | package.json (scripts) |
| `dev` | `dev` | `bun run dev` | Start local development server | package.json (scripts) |
| `test` | `test` | `bun test` | Run test suite | package.json (scripts) |
| `typecheck` | `typecheck` | `bun run typecheck` | Type check codebase | package.json (scripts) |
| `externalization` | `other` | `bun run externalization` | Run script "externalization" | package.json (scripts) |
| `agents` | `other` | `bun run agents` | Run script "agents" | package.json (scripts) |
| `agents:check` | `other` | `bun run agents:check` | Run script "agents:check" | package.json (scripts) |
| `prepare` | `other` | `bun run prepare` | Run script "prepare" | package.json (scripts) |
| `prepublishOnly` | `other` | `bun run prepublishOnly` | Run script "prepublishOnly" | package.json (scripts) |

## Usage Guidelines
- Agents should invoke these exact commands when testing, linting, typechecking, or building the codebase.
- Prefer existing project scripts over raw third-party tool invocations.
