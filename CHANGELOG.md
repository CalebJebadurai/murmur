# Changelog

All notable changes to Murmuration are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project adheres to
semantic versioning.

## [0.1.0] — 2026-06-15

First implementation milestone. Tool-agnostic multi-agent framework with a
compile-once / emit-many architecture.

### Added

- **Abstract IR + typed schema** for agents, subagents, skills, and instructions,
  with a runtime validator and a `murmur/` directory layout.
- **Compiler** with a `RuntimeCompiler` adapter interface and atomic
  staging-then-move output.
- **Two structurally-dissimilar adapters:** Copilot (persona-Markdown
  `.github/agents/*.agent.md` + instructions + skills) and goose (parameterized
  recipe YAML + `.goosehints` + AGENTS.md/CLAUDE.md parity).
- **CLI** (`murmur`) with `init`, `add`, `compile`, `doctor`, `list`, `publish`.
- **Deterministic structural `init`** pass (no LLM, no network) plus an
  agent-invoked semantic pass (`murmur-init` agent/skill).
- **Master-agent dynamic spawning** via the externalized `subagent-authoring`
  skill, with file-writing and in-context ephemeral-persona paths gated by the
  runtime hot-load probe.
- **Defense-in-depth `publish`** scrubber: denylist + path/email/domain redaction
  plus gitleaks-style pattern and Shannon-entropy secret scanning, `--dry-run`,
  `--strict`, and a constrained config loader (`--allow-config-exec`).
- **Knowledge-externalization gate** asserting zero codebase facts in agent bodies.
- Zero runtime dependencies; bundled to `dist/cli.js` via `bun build`.

### Known limitations

- Runtime hot-load capability is recorded as unproven; spawning defaults to the
  safe ephemeral-persona path until probed in a live session.
- Semantic init depth, global commands, and the Claude Code / Cursor / ACP
  adapters are deferred to a future release.

## [0.0.0] — 2026-06-14

- Initial scaffold: README, vision document, and bun package skeleton.
