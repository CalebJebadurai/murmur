# How Murmuration Compares

> This document evaluates Murmuration against leading agentic-coding systems.
> Analysis of ECC.tools and Hermes is based on **public materials only**; their
> internals are not accessible and any claims about them are explicitly inferential.

## Systems evaluated

- **Claude Code sub-agents** — named-persona specialists with isolated context,
  per-agent model/tool selection, description-driven auto-delegation, and a clear
  precedence order. Public docs.
- **AAIF goose** (formerly block/goose) — skills-first model (root `SKILL.md`
  mirrored to `.claude`/`.codex`/`.cursor`), recipes with typed parameters and
  sub-recipes, MCP extensions, AGENTS.md/CLAUDE.md parity, custom distros, ACP
  support, and subagent delegation via the `summon` extension. Open source.
- **Cursor** — `.cursor/rules` (MDC) and skills. Public docs.
- **ACP (Agent Client Protocol)** — an LSP-for-agents standard (JSON-RPC over
  stdio, reuses MCP JSON types). The genuine protocol-level portability target.
- **ECC.tools** ("Everything Claude Code") — sells repo-history → skills across
  multiple harnesses; runs server-side and closed. *Public materials only.*
- **Hermes (NousResearch)** — self-improving skills + persistent memory; a model/
  agent line, not a coding-runtime compiler. *Conceptually relevant only.*
- **AGENTS.md** — the de-facto universal instruction manifest (tens of thousands
  of repos, ~12 tools). Treated as the lowest-common-denominator fallback.

## What Murmuration adopts (best-of-all-worlds)

| Source | Adopted into Murmuration |
|---|---|
| Claude Code | Named-persona subagents with isolated context, per-agent tool restriction, description (`Use when:`)-driven dispatch. |
| goose | Skills as first-class knowledge packages; parameterized recipe output; AGENTS.md/CLAUDE.md parity (goose adapter). |
| ACP | Reserved as a roadmap compile target so abstract definitions outlive any single runtime. |
| AGENTS.md | Emitted as a universal manifest by the goose adapter. |
| ECC.tools | Validates the codebase → skills auto-init bet (we do it **locally**, not server-side). |

## Dimension comparison

| Dimension | Claude Code | goose | Cursor | **Murmuration** |
|---|---|---|---|---|
| Subagent isolated context | ✅ | ⚠️ (`summon`) | ⚠️ | ✅ |
| Master spawns NEW subagents on demand | ❌ | ❌ | ❌ | ✅ |
| Knowledge externalized to skills/instructions | ⚠️ | ✅ | ⚠️ | ✅ (CI-enforced gate) |
| Codebase auto-init (local) | ❌ | ❌ | ❌ | ✅ (deterministic structural pass) |
| Compile-once / emit-many | ❌ | ⚠️ (mirrors skills) | ❌ | ✅ (adapter interface) |
| Installable CLI | ✅ | ✅ | ❌ | ✅ (`bunx murmur`) |
| Publish-time context stripping | ❌ | ❌ | ❌ | ✅ (defense-in-depth) |

## Differentiator — honest two-tier framing

No single capability here is unique: goose has subagent delegation; ECC.tools does
repo→skills. Murmuration's claim is the **union**, split by what actually ships:

- **Shipped (v0.1.0):** the only local, open-source tool combining deterministic
  structural auto-init + compile across two **structurally-different** runtime
  paradigms (Copilot persona-Markdown and goose recipes) + a CI-enforced
  externalization gate + a defense-in-depth publish scrubber.
- **Aspirational (v1.0):** adds ACP protocol portability, cross-runtime spawnable
  specialists proven by the hot-load probe, and semantic init enrichment.
