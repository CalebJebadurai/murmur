# Murmuration — Implementation Plan (Phased)

> Extracted from [`_architect/analysis/2026-06-14-murmur-multi-agent-framework.md`](../analysis/2026-06-14-murmur-multi-agent-framework.md) (final, 47/55).
> Target repo: `/Users/cnickson/projects/murmur` (bun CLI, `murmur`).

## Pre-flight (operational/security — do first)

Revoke the GitHub token exposed in the user's `.env`, re-authenticate `gh auth login`, confirm `.env` is git-ignored in every project, then create and push the private `murmur` remote. The repo already has its scaffold commit; Phase A becomes the second commit (satisfies two-commit hygiene).

## Phase A — Foundation and schema validation

Hand-author a minimal abstract IR (one master agent, three generic agents from the recurring ten-agent archetype, two skills, one instruction) and a typed schema with a runtime validator. Implement the `RuntimeCompiler` interface and two **structurally dissimilar** adapters — Copilot (persona-Markdown) and goose (parameterized recipe). Prove the hand-authored IR compiles to schema-valid output for both. **Schema freezes here.** Author the smallest IR that exercises every schema feature (agent referencing a skill + instruction, subagent with spawn metadata, flat skill, `applyTo` instruction).

## Phase A.5 — Runtime capability probe

One-page empirical probe per target: can an agent write a new subagent definition mid-session and dispatch it in the same session (hot-load)? Unverified for Copilot/Claude — must be measured. Result gates Criterion 3: hot-load → file-writing spawn path; no hot-load → in-context ephemeral-persona fallback.

## Phase B — CLI skeleton and core commands

Bun-bundled CLI entry point with subcommand routing, `--help`, friendly no-arg behavior. Implement `compile --target`, `doctor` (schema, reference integrity, glob syntax), `list`. Wire the Phase A compiler behind `compile`. Delivers a usable tool for hand-written `murmur/` directories.

## Phase C — The init analyzer

Implement the **deterministic structural pass** first: pure bun static analysis of `package.json`, `tsconfig.json`, directory tree, lockfiles, test config, CI files → structural skills + `applyTo` instructions, no LLM, no API key, under two minutes. Handle merge/overwrite/cancel on re-run. Then ship the **optional semantic pass** as a `murmur-init` agent/skill the user runs inside their host agent (agent-invoked model; LLM is caller, CLI is callee), with headless-CLI shell-out (`claude`/`goose`) as fallback.

## Phase D — Master agent spawning

Author the `subagent-authoring` skill; implement the master agent's match-or-spawn loop, selecting file-writing vs ephemeral-persona path per the A.5 probe, including temporary-vs-persistent decision (persist only when the same specialist is needed >2× per session). Demonstrate two spawn scenarios end-to-end (data-validator, config-migrator).

## Phase E — Publish and packaging

Implement `publish` (scrubbing rules, `--dry-run`, `--strict`, `--allow-config-exec`) and `add agent|subagent|skill|instruction` scaffolders. Finalize packaging: `build` bundling to `dist/cli.js`, correct `files`/`bin` fields, sub-10MB tarball verified with `bun pack`, `CHANGELOG.md`, `docs/COMPARISON.md`. Resolve `gh` auth, push private remote, add CI.

## Phase F (roadmap, post-v0.1.0)

Claude Code (near-free third adapter, shares Copilot substrate), Cursor, and ACP adapters; deferred global-command surface; deepened semantic init analysis.

## Definition of done (v0.1.0)

All ten success criteria, with three non-negotiable gates: (1) knowledge-externalization scanner reports zero project facts in agent bodies; (2) `doctor` passes on freshly initialized output; (3) publish scrubber proven against sentinel values **and** an unlisted high-entropy secret, source untouched.
