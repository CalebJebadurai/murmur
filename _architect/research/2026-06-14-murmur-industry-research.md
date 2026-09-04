# Murmuration — Industry Research: Agentic-Coding Systems & "Best of All Worlds" Synthesis

**Topic:** Competitive/industry research for Murmuration (tool-agnostic, packageable multi-agent + subagent framework distributed as a bun CLI)
**Date:** 2026-06-14
**Author:** Researcher (architect pipeline)
**Status:** Draft v1
**Research question:** What do the leading agentic-coding systems do well and poorly, and which best practices should a tool-agnostic, multi-runtime, auto-initializing multi-agent framework adopt or improve upon?

---

## Executive Summary

No existing agentic-coding system covers Murmuration's full scope; each leads on one axis. **Claude Code** sets the standard for named, isolated-context subagents (Markdown+YAML frontmatter, per-agent model/tools/memory, auto-delegation by `description`, nested spawning). **goose** (now AAIF/Linux Foundation) leads on composable, parameterized, validated knowledge (its recipe schema) and already mirrors root skills into `.claude`/`.codex`/`.cursor`, maintains AGENTS.md↔CLAUDE.md parity, supports custom distros, and ships ACP support — plus subagent delegation via its `summon` extension. **ACP** is the LSP-style protocol that makes any agent editor-portable and reuses MCP JSON types. **ECC.tools** already sells "repo-history→reusable skills" across four harnesses, validating (but running server-side/closed) Murmuration's auto-init bet. **Hermes Agent** contributes the self-improving-skills/persistent-memory pattern. **AGENTS.md** is the de-facto universal instruction manifest (60k+ repos, ~12 tools, LF-stewarded). Murmuration's defensible position is the *union*: local codebase auto-init + compile-once/emit-many (incl. ACP) + first-class spawnable specialists + goose-grade composable skills + a context-stripping publish step. Confidence in this synthesis: High for goose/Claude/ACP/AGENTS.md (Tier 1); Medium for ECC/Hermes (Tier 2, internals not public).

---

## Methodology

Research was conducted by fetching and analyzing primary documentation and source repositories for each system (accessed 2026-06-14), supplemented by web search for the two ambiguously-named systems (ECC.tools, Hermes). For each system, the goal was to extract the concrete mechanism (file format, schema, runtime behavior) rather than marketing claims, and to attribute each capability to an observable artifact (a documented frontmatter field, a repository directory, a CLI flag).

Sources were tiered for reliability:

- **Tier 1 (primary/authoritative):** official product documentation (`code.claude.com`, `bun.sh`/`bun.com`, `agentclientprotocol.com`, `goose-docs.ai`, `agents.md`) and canonical source repositories (`github.com/aaif-goose/goose`).
- **Tier 2 (vendor marketing / curated):** product landing pages (`ecc.tools`, `hermes-agent.org`), which describe capabilities but expose limited implementation detail.
- **Tier 3 (secondary):** third-party blog posts and aggregator pages (`agentsmd.net`, Medium articles), used only for corroboration, not as sole support for any claim.

Where a system's internals are not publicly documented (notably ECC.tools' server-side analysis and Hermes' coding-specific behavior), this is flagged explicitly and the evaluation is restricted to public materials. Claims that could not be verified against a Tier 1 source are marked inline.

Known evidence gap: the goose **skills** documentation page (`/docs/guides/skills/`) returned HTTP 404 at access time, and the rendered docs landing pages failed content extraction. The goose skills model below is therefore reconstructed from the **repository structure** (directory layout and commit history visible on GitHub), which is itself a Tier 1 artifact, plus the Tier 1 recipe reference. This is noted again in Gaps and Limitations.

---

## System Deep-Dives

### 1. AAIF goose (formerly block/goose)

goose is a general-purpose, Rust-built open-source agent (desktop app, CLI, and API) that recently moved from `block/goose` to the **Agentic AI Foundation (AAIF) at the Linux Foundation** [S1]. It connects to 15+ model providers and 70+ extensions via the Model Context Protocol (MCP), and notably supports **ACP** both as a client and for using existing Claude/ChatGPT/Gemini subscriptions as providers [S1]. Confidence: High.

**Knowledge externalization — skills and hints.** The goose repository demonstrates the exact pattern Murmuration targets: agent **skills authored once at the repo root and mirrored into per-runtime directories**. The repo contains `.claude/skills`, `.codex/skills`, and `.cursor/skills` directories, and a commit ("move agent skills to repo root for tool discoverability", #8535) shows skills being hoisted to root so multiple tools can discover them [S1]. The repo also ships a `.goosehints` file (lightweight project guidance, analogous to a always-loaded instruction file), and **mirrored `AGENTS.md` and `CLAUDE.md`** at the root — a commit ("agents: add CLAUDE.mds to mirror AGENTS.mds", #9029) confirms goose deliberately maintains parity between the open `AGENTS.md` convention and the Claude-specific `CLAUDE.md` [S1]. Confidence: High (directory/commit evidence).

**Recipes — parameterized, composable workflows.** goose's most mature differentiator is its **recipe** system: reusable YAML/JSON configurations with a rich, validated schema [S2]. Key schema features Murmuration should study:

- **`parameters`** with typed inputs (`string`, `number`, `boolean`, `date`, `file`, `select`), `required`/`optional`/`user_prompt` requirement levels, defaults, and Jinja-style `{{ }}` substitution into `instructions`/`prompt`/`activities` [S2].
- **`extensions`** — per-recipe declaration of which MCP servers/tools are available, with types `stdio`, `builtin`, `platform`, `streamable_http`, `frontend`, and `inline_python`; plus `available_tools` to allow-list specific tools and `env_keys` that trigger secure keyring prompts for secrets [S2].
- **`sub_recipes`** — recipes can call other recipes with pre-bound `values`, optional sequential-vs-parallel execution, and parameter passing via the `indent()` filter [S2].
- **`settings`** — per-recipe model/provider/temperature and `max_turns` (with documented precedence: subagent tool override > recipe setting > `GOOSE_SUBAGENT_MAX_TURNS` env > default of 1000 main / 25 subagent) [S2].
- **`retry`** with shell-based success `checks`, `on_failure` commands, and timeouts — automated validate-and-recover loops [S2].
- **`response.json_schema`** — enforced structured output for non-interactive automation [S2].
- **Template inheritance** (`{% extends %}`/blocks), a built-in `recipe_dir` parameter, and load paths from local dirs, `GOOSE_RECIPE_PATH`, or GitHub repos [S2].

**Subagent delegation does exist — via `summon`.** A key correction to the framing: goose **does** support subagent delegation. The `delegate` and `load` tools are provided by a `summon` **platform extension**, and recipes that declare `sub_recipes` get `summon` auto-injected [S2]. So goose's "subagent" story is recipe-centric (spawn a parameterized sub-recipe as a delegated task) rather than persona-centric. Confidence: High.

**Hooks and custom distros.** The repo contains a Hooks feature (examples dir, commit #9093) and a `CUSTOM_DISTROS.md` documenting how to build a branded goose distribution with preconfigured providers/extensions [S1]. This is directly relevant to Murmuration's "publish/distribution" goal. Confidence: High.

**What goose lacks (opportunities for Murmuration):**

- **No first-class named-persona subagents with isolated context windows.** Delegation is recipe/task-based via `summon`; there is no documented equivalent of Claude Code's per-persona system prompt + tool restriction + per-subagent model + fresh isolated context as a primary abstraction. Murmuration's master-agent-spawns-specialists model is a differentiator here.
- **No codebase auto-init that generates skills/instructions.** goose mirrors skills across runtimes but does not (publicly) analyze a codebase to *generate* the skills/instructions in the first place — that is exactly Murmuration's init workflow and ECC.tools' niche.
- **goose is the runtime, not a compiler.** goose mirrors skills into other tools' directories, but it is itself an agent; it does not *compile* an abstract agent definition into multiple foreign runtimes as a build artifact. Murmuration's compile-to-many-runtimes positioning is distinct.

**Best practice to adopt:** goose's **recipe schema is the gold standard for parameterized, composable, validated agent workflows** — Murmuration should model its skill/agent definition format on it (typed parameters, declared extensions with tool allow-lists, sub-recipe composition, structured-output schemas, retry/validation), and adopt the **repo-root-with-per-runtime-mirroring** layout plus **AGENTS.md/CLAUDE.md parity** as table stakes.

### 2. Claude Code sub-agents

Claude Code provides the most mature **named-persona subagent** model in the industry, and it is the closest reference for Murmuration's master-agent-spawns-specialists design [S3]. Confidence: High (primary docs).

**Schema.** Subagents are Markdown files with YAML frontmatter; the body is the subagent's system prompt. Only `name` and `description` are required. The full documented frontmatter field set is: `name`, `description`, `tools` (allow-list), `disallowedTools` (deny-list, applied before `tools`), `model` (`sonnet`/`opus`/`haiku`/`fable`/full ID/`inherit`), `permissionMode`, `maxTurns`, `skills` (preloads full skill content into the subagent's startup context), `mcpServers` (inline or by-reference, scoped to the subagent), `hooks` (lifecycle, scoped to subagent), `memory` (`user`/`project`/`local` persistent directory with `MEMORY.md`), `background`, `effort`, `isolation: worktree` (run in a throwaway git worktree), `initialPrompt`, and `color` [S3]. The same fields are accepted as JSON via the `--agents` CLI flag for ephemeral session-only subagents [S3].

**Scope & precedence.** Subagents resolve from (highest to lowest): managed/org settings → `--agents` flag → `.claude/agents/` (project) → `~/.claude/agents/` (user) → plugin `agents/` directory. Identity comes only from the `name` field; directories are scanned recursively [S3]. This **global + project + distributable-plugin layering directly mirrors Murmuration's global/project CLI command requirement.**

**Delegation model.** Claude **automatically delegates** based on the task and the subagent's `description` field ("use proactively" encourages it); users can also force a subagent via `@`-mention or run a whole session as one with `--agent`. Critically, each non-fork subagent **starts with a fresh, isolated context window** — it does not see conversation history; the parent composes a delegation message and only the subagent's *summary* returns to the main context [S3]. This isolation is the core value proposition (keeps verbose research/test output out of the main window). A `fork` variant inherits full conversation context instead. As of v2.1.172 subagents can **spawn nested subagents** (depth-limited), and `Agent(type1, type2)` syntax allow-lists which subagents a coordinator may spawn [S3].

**Skills vs. subagents distinction.** Claude Code treats **Skills** (reusable prompts/workflows run in the *main* context) as orthogonal to subagents (isolated context). Skills can be preloaded into a subagent via the `skills` field, or a skill can run in a forked subagent via `context: fork` [S3]. This clean separation — *skills = portable knowledge, subagents = isolated execution personas* — is exactly the architecture Murmuration espouses (generic agents + externalized skills/instructions).

**What it lacks (opportunities):** Claude Code subagents are **single-runtime** (Claude only). There is no compile-to-other-runtimes story, no codebase auto-init that generates the subagents/skills, and no context-stripping publish step. The format is also Anthropic-proprietary even though it is Markdown+YAML.

**Best practice to adopt:** Murmuration's agent definition format should be **Markdown + YAML frontmatter**, near-isomorphic to Claude Code's, with `description`-driven automatic delegation, explicit `tools`/`disallowedTools`, per-agent `model`, `skills` preloading, scoped `mcpServers`, and a worktree isolation option. Adopt the **fresh-isolated-context + return-only-summary** semantics for spawned specialists, and the **three-tier scope precedence** (managed → project → user → plugin) as Murmuration's global/project/publishable model.

### 3. Agent Client Protocol (ACP)

ACP (`agentclientprotocol.com`) is a standardization layer that decouples coding agents from editors/IDEs, explicitly modeled on the **Language Server Protocol** analogy: just as LSP let any language server work with any editor, ACP lets any ACP-compliant agent work with any ACP-compliant editor [S4]. Confidence: High (primary docs).

**Mechanism.** Local agents run as **sub-processes of the editor, communicating via JSON-RPC over stdio**; remote agents may use HTTP/WebSocket (remote support is explicitly a work-in-progress) [S4]. Crucially for Murmuration, **ACP re-uses MCP's JSON representations where possible**, adding custom types only for agentic-coding UX elements (e.g., diffs), and defaults user-readable text to Markdown [S4]. ACP is governed in the open (GitHub `agentclientprotocol/agent-client-protocol`) and already has real adopters — goose ships ACP client support and uses ACP for subscription-based providers [S1][S4].

**Why it matters for portability.** Murmuration wants to compile abstract definitions to multiple runtimes (Copilot, Claude Code, goose, Cursor, ACP). ACP is the one target that is a *protocol* rather than a *file format* — targeting ACP means Murmuration-compiled agents could be driven by **any ACP-compatible editor** (Zed, goose, etc.) without per-editor integration work. The MCP type-reuse means Murmuration's tool/extension declarations (already MCP-shaped if it follows goose/Claude conventions) map cleanly onto ACP.

**What it lacks / caveats:** ACP standardizes the *editor↔agent session transport*, not the *authoring format* for skills/subagents/instructions. It does not define how knowledge is externalized or how subagents are declared — it is complementary, not competitive, to the file-format work. Remote/cloud support is immature [S4].

**Best practice to adopt:** Treat **ACP as a first-class compile target and the portability backbone**: emit an ACP-speaking agent process as one of Murmuration's outputs, reuse MCP JSON shapes for tool/extension definitions so they are simultaneously valid for MCP, Claude Code `mcpServers`, goose `extensions`, and ACP. This is the highest-leverage interoperability decision available.

### 4. ECC.tools ("Everything Claude Code")

ECC.tools is an **open-source-first agent harness toolkit by Affaan Mustafa** (MIT licensed), distributed both as an npm package (`ecc-universal`) and a GitHub App, with a Claude Code plugin marketplace install path (`/plugin marketplace add …/ECC`) [S5]. Confidence: Medium (Tier 2 vendor landing page; OSS repo exists but internals not deeply inspected here).

**What it does (per public materials).** ECC bills itself as "skills, agents, and security for your coding agent" and explicitly works **across Claude Code, Codex, Cursor, and OpenCode** — a multi-harness portability story very close to Murmuration's. The landing page advertises an OSS layer of **261 skills, 64 agents, and 84 commands**, plus an "AgentShield" security layer of 102 rules that scan every agent session [S5]. Install profiles (core/developer/security/full) let users select skill bundles [S5].

**The directly competitive feature — codebase→skills extraction.** ECC's headline GitHub-App workflow is "**turn repo history into reusable skills and defaults**": you install the app, comment `/ecc-tools analyze`, and it "inspects workflow patterns, repo conventions, and risky config surfaces" then opens a PR proposing generated skills/defaults [S5]. This is essentially **Murmuration's init-workflow value proposition delivered as a hosted service** — the strongest direct overlap found in this research.

**What it lacks / caveats (explicitly flagged).** The *implementation* of the analysis (how it extracts skills, what model/runtime it uses, the generated skill schema) is **not publicly documented** on the materials reviewed; the npm install output and skill/agent counts are marketing figures. The GitHub-App analysis is **server-side and closed** even though the skill library is OSS. This evaluation is therefore based on public materials only and cannot verify the quality or portability fidelity of the generated artifacts.

**Best practice to adopt / improve upon:** ECC validates demand for **codebase→skills auto-generation** and **multi-harness skill libraries** — confirming two of Murmuration's core bets. Murmuration can *improve upon* it by (a) running init **locally via the host agent runtime** (no hosted server, no closed analysis — a privacy/trust differentiator), (b) producing a **single abstract definition that compiles** to each runtime rather than maintaining parallel per-tool skill copies, and (c) shipping a **publish step that strips codebase-specific context** so generated skills can be safely open-sourced — a step ECC's repo-history extraction does not advertise.

### 5. Hermes (NousResearch Hermes Agent)

**Identification (with caveat).** "Hermes" is ambiguous in the agentic space — it could refer to NousResearch's *Hermes LLM model family*. In the **agent-framework** context, the most likely referent is **NousResearch's "Hermes Agent"** (`hermes-agent.org`, docs at `hermes-agent.nousresearch.com`, repo `github.com/nousresearch/hermes-agent`), described as "the agent that grows with you" [S6]. There are also unrelated/derivative projects sharing the name (a "Hermes Kanban" multi-agent orchestration write-up, an "agentic-os" dashboard coordinating opencode + Hermes Agent + Gemini CLI) [S6]. The identification below is **Medium confidence** and based on Tier 2/Tier 3 materials; primary docs were not deeply fetched.

**What it is (per public materials).** Hermes Agent is an **open-source autonomous agent built around persistent memory and automated skill creation** — a built-in "learning loop" that **creates skills from experience and refines them during use**, remembering user preferences/context across sessions. It is explicitly **not an IDE coding copilot**; it is self-hosted ("$5 VPS," serverless, or local), runs continuously, and reaches users through channels like Telegram/Discord/Slack [S6]. Confidence: Medium.

**Relevance to Murmuration.** The relevant idea is **self-improving / auto-generated skills** — Hermes generates skills from runtime *experience*, whereas Murmuration's init generates them from *codebase analysis*. Both converge on "skills as the durable, externalized knowledge unit that the system writes for itself." Hermes also reinforces the **persistent-memory** pattern (cf. Claude Code's per-subagent `memory` directories).

**What it lacks / caveats (explicitly flagged):** Hermes is an **always-on autonomous-agent harness, not a coding-agent compiler or multi-runtime tool** — it does not target Copilot/Cursor/Claude Code runtimes, and its coding-specific capabilities are not the focus. Its applicability to Murmuration is conceptual (the learning-loop/skill-synthesis pattern), not architectural. Because evaluation rests on landing-page/blog materials, specific mechanism claims should be verified against the repo before being relied upon.

**Best practice to adopt:** Borrow the **"skills as a self-written, continuously-refined knowledge store"** framing — Murmuration's init is a one-shot codebase→skills generator, but a Hermes-style **incremental refinement loop** (agents append lessons to skills/memory as they work, as Claude Code's `memory` already enables) would strengthen the value proposition over time.

### 6. Brief surveys: Cursor rules, OpenAI Codex skills, AGENTS.md convention

**AGENTS.md (the emerging universal manifest).** AGENTS.md is "a README for agents" — a plain-Markdown, no-required-fields file at the repo root carrying build/test/convention context that would clutter a human README [S7]. Its significance is **ecosystem reach**: it is used by 60k+ open-source projects and supported across a broad compatible set — OpenAI Codex, Cursor, Zed, Aider, Jules (Google), Gemini CLI, VS Code, Factory, Phoenix, Augment, Ona, goose, and others [S7]. Nested AGENTS.md files cascade (closest-to-edited-file wins; the main OpenAI repo reportedly has 88) [S7]. It is now **stewarded by the Agentic AI Foundation under the Linux Foundation** — the same body that governs goose [S7]. Confidence: High. For Murmuration this is the **single most important interop target for project-level instructions**: emit/maintain AGENTS.md (with CLAUDE.md mirror, as goose does) and Murmuration instructions are instantly portable to the widest tool set.

**OpenAI Codex (`.codex/skills`).** Codex consumes AGENTS.md as its primary guidance file [S7b], and the goose repo's `.codex/skills` directory confirms Codex participates in the same root-skills-mirrored-per-runtime convention as Claude and Cursor [S1]. Detailed Codex skill schema was not separately fetched (flagged as a gap). Confidence: Medium.

**Cursor rules/skills.** Cursor supports project rules (historically `.cursorrules`, now `.cursor/rules` MDC files) and participates in the AGENTS.md ecosystem [S7]; the goose repo also carries a `.cursor/skills` directory [S1]. The Cursor rules docs page redirected during fetch and was not fully captured (flagged as a gap), so the precise current MDC schema is not asserted here. Confidence: Medium. The takeaway is structural: **each runtime has its own rules/skills directory, but the content is the same knowledge** — reinforcing Murmuration's compile-once/emit-many thesis.

**Cross-cutting pattern.** All three converge on the same shape Murmuration assumes: **externalized, plain-Markdown knowledge** (instructions in AGENTS.md-style files, capabilities in per-runtime `*/skills` directories), discovered by convention, with the *generic agent* carrying little domain knowledge itself.

---

## Comparison Matrix

Legend: ✓✓ = strong/first-class, ✓ = partial/present, — = absent or not publicly evidenced, ? = unverifiable from public materials. Ratings reflect public documentation as of 2026-06-14.

| Dimension | goose | Claude Code | ACP | ECC.tools | Hermes Agent | AGENTS.md ecosystem |
|---|---|---|---|---|---|---|
| **Named-persona subagent support** | ✓ (recipe/`summon` delegation) | ✓✓ (isolated-context personas, full schema) | — (transport only) | ✓ (64 agents, schema undocumented) | ✓ (single autonomous agent) | — |
| **Dynamic agent spawning** | ✓ (sub_recipes, parallel/sequential) | ✓✓ (auto-delegation + nested spawning) | — | ? | ✓ (autonomous, persistent) | — |
| **Knowledge externalization (skills/instructions)** | ✓✓ (root skills mirrored; `.goosehints`; AGENTS/CLAUDE) | ✓✓ (Skills + memory, orthogonal to subagents) | — | ✓✓ (261-skill library, multi-harness) | ✓ (self-written skills + memory) | ✓✓ (the convention itself) |
| **Codebase auto-init (generates skills/instructions)** | — | — (manual or `/agents` generate per-agent) | — | ✓✓ (repo-history→skills, server-side/closed) | ✓ (from runtime experience, not codebase) | — |
| **Multi-runtime portability** | ✓ (mirrors to .claude/.codex/.cursor; ACP client) | — (Claude only) | ✓✓ (protocol-level, any ACP editor) | ✓✓ (Claude/Codex/Cursor/OpenCode) | — (own harness) | ✓✓ (60k repos, ~12+ tools) |
| **CLI installability** | ✓✓ (Rust CLI + desktop + API) | ✓✓ (`claude` CLI) | n/a (spec) | ✓ (`npm i -g ecc-universal`, GitHub App) | ✓ (self-hosted package) | n/a (file format) |
| **Global vs project commands/scopes** | ✓ (global config + project recipes; GOOSE_RECIPE_PATH) | ✓✓ (`~/.claude` user vs `.claude` project vs plugin) | — | ✓ (install profiles) | ✓ (per-deployment) | ✓ (root + nested cascade) |
| **Publish / context-stripping** | ✓ (custom distros; CONTRIBUTING_RECIPES) | ✓ (plugins distribute agents) | — | ✓ (OSS skill library publish) | — | ✓ (commit AGENTS.md to repo) |

**Reading of the matrix:** No single system covers all eight dimensions. Claude Code dominates subagents/isolation; goose dominates composable knowledge + custom distros + ACP; ACP owns protocol portability; ECC owns codebase→skills auto-init; AGENTS.md owns instruction-format reach. **Murmuration's whitespace is the union: codebase auto-init (ECC) + compile-to-many-runtimes including ACP (no one does all of these) + first-class named subagents (Claude) + composable parameterized skills (goose) + a context-stripping publish step (nearly no one).**

---

## Packaging Concerns: bun/npm CLI Distribution

Murmuration ships as a bun CLI; the following are evidence-based packaging mechanics (Tier 1: bun docs) [S8][S9]. Confidence: High.

**Bin linking & execution.** Standard npm/bun convention applies: a `bin` field in `package.json` (e.g. `"bin": { "murmur": "./dist/cli.js" }`) makes the command available on `PATH` after a global install (`bun add -g` / `npm i -g`) and runnable ad-hoc via `bunx murmur` or `npx murmur` without installation. The entry file needs a shebang (`#!/usr/bin/env bun` or `#!/usr/bin/env node`) and executable permission. Notably, **bun's bundler auto-selects `target: "bun"` when an entrypoint contains a Bun shebang** [S8].

**Bundling (bun build / esbuild).** `bun build <entry> --outdir ./dist` (or `Bun.build({...})`) bundles TS/JSX to JS with tree-shaking and dead-code elimination [S8]. Relevant options for a CLI: `--target bun|node|browser` (use `bun` or `node`); `--format esm|cjs` (cjs+node is the most broadly Node-compatible); `--packages external` or `--external` to keep `node_modules` deps unbundled (smaller, but requires install) vs. bundling everything into one file; `--minify`; `--sourcemap`; `--banner '"use client";'` or a shebang banner; `--define`/`env` for build-time constants; and a markdown metafile (`--metafile-md`) for bundle analysis. bun's bundler is API-compatible in spirit with esbuild (the docs benchmark against esbuild's three.js bench) [S8].

**The `files` field.** `package.json`'s `files` array controls which files are included in the published npm tarball (e.g. `["dist", "templates", "skills"]`) — essential for shipping the compiled CLI plus its scaffolding templates and default skill/instruction assets while excluding source.

**Single-file executables.** bun's `--compile` flag produces a standalone binary embedding the Bun runtime, the bundled code, and any assets — deployable with no Node/Bun installed [S9]. Supports **cross-compilation** (`--target=bun-linux-x64`, `-darwin-arm64`, `-windows-x64`, musl/baseline variants), `--bytecode` for ~2x faster cold start, `--minify`, `--sourcemap`, build-time `--define` constants, embedded files via `import x from "./f" with { type: "file" }` (resolved to a `$bunfs/` internal path), embedded SQLite, and macOS codesigning [S9]. For Murmuration this enables an **optional zero-dependency distribution** alongside the npm package — useful for users without a JS toolchain. (Caveat: `--compile` takes a single entrypoint and disallows `--target=node`.)

**`create-*` scaffolders.** The npm convention `npm create murmur` / `bunx create-murmur` maps to a package named `create-murmur` whose bin scaffolds a project. The standard structure is a thin bin that (1) prompts for options, (2) copies a `templates/` directory (shipped via the `files` field) into the target, and (3) does token substitution. bun's `Bun.build({ files: {...} })` in-memory virtual-file API and import-time `with { type: "file" }` embedding are both convenient for shipping templates inside the scaffolder [S8][S9]. This pattern directly supports Murmuration's init/global commands: a `create-murmur` (or `murmur init`) scaffolder lays down the abstract agent/skill/instruction definitions, then the compile step emits per-runtime directories.

**Recommended Murmuration packaging shape (synthesis, not a published spec):** publish an npm/bun package with a `bin` (shebang'd, ESM or cjs+node target), bundle the CLI with `bun build --target node` (or `bun`) keeping heavy/optional deps `external`, ship `dist/` + `templates/` + default `skills/`/`instructions/` via `files`, expose `bunx murmur` / `npx murmur` for zero-install use, offer an optional `--compile` single-file binary for non-JS users, and provide a `create-murmur` scaffolder for project init.

---

## Best-of-All-Worlds Synthesis for Murmuration

**Adoptable best practices (ranked by leverage):**

1. **Markdown + YAML-frontmatter definitions, Claude-Code-isomorphic.** Use a single Markdown-body + frontmatter format for agents (and a parallel one for skills) so a Murmuration definition is *already* close to a valid Claude Code subagent/skill. Carry the proven fields: `description` (drives auto-delegation), `tools`/`disallowedTools`, per-agent `model`, `skills` preloading, scoped `mcpServers`, `memory`, `isolation: worktree` [S3].
2. **Compile-once / emit-many, with MCP-shaped tool declarations.** Author abstractly; compile to each runtime's directory (`.claude/agents` + skills, `.cursor/skills`, `.codex/skills`, goose recipes, VS Code Copilot, ACP). Keep tool/extension declarations in **MCP JSON shape** so they are simultaneously valid for Claude `mcpServers`, goose `extensions`, and ACP [S1][S2][S4]. goose's repo proves the root-skills-mirrored-per-runtime layout works [S1].
3. **Target ACP as the portability backbone.** It is the only *protocol* target; emitting an ACP agent process makes Murmuration agents drivable by any ACP editor without bespoke integrations, and its MCP type-reuse aligns with #2 [S4].
4. **Model the skill/agent schema on goose recipes.** Adopt typed `parameters`, `required/optional/user_prompt` levels, declared `extensions` with `available_tools` allow-lists and `env_keys` secret prompting, `sub_recipes` composition, `settings.max_turns` precedence, `retry` validate-and-recover, and `response.json_schema` structured output [S2].
5. **Local, host-runtime codebase auto-init.** Generate skills/instructions by having the *host agent runtime* analyze the repo locally — ECC proves the demand but runs it server-side/closed; local execution is a trust/privacy differentiator [S5].
6. **AGENTS.md (+ CLAUDE.md mirror) as the instruction interop target.** Emit/maintain AGENTS.md for instant reach across 60k-repo/~12-tool ecosystem; mirror to CLAUDE.md as goose does [S7][S1].
7. **Global + project + publishable scopes with precedence.** Mirror Claude Code's managed→project→user→plugin layering for Murmuration's global vs project CLI commands [S3].
8. **A context-stripping publish step.** Nearly unique in the field — strip codebase-specific context so generated skills/agents can be safely open-sourced/shared. Combine with goose-style **custom distros** for branded, preconfigured bundles [S1].
9. **Incremental skill refinement (Hermes-style) on top of one-shot init.** Let agents append lessons to skills/memory as they work, using Claude-Code-style per-agent `memory` directories [S3][S6].
10. **bun packaging: `bin`+shebang, `bunx`/`npx` zero-install, optional `--compile` single-file binary, `create-murmur` scaffolder, `files`-scoped templates** [S8][S9].

**Key differentiators Murmuration should claim:** (a) the *only* tool that does **codebase auto-init AND compile-to-many-runtimes (including ACP)** in one package; (b) **generic agents + fully externalized skills/instructions** with a master agent that **dynamically spawns isolated specialists**; (c) a **context-stripping publish** step that turns a project's private agent config into a shareable, generic distribution — something neither goose, Claude Code, nor ECC offers as a first-class workflow.

---

## Conflicting Evidence

- **"goose lacks subagent delegation" (the research brief's premise) is contradicted by primary evidence.** The recipe reference documents a `summon` platform extension providing `delegate`/`load` tools, `sub_recipes` with parallel/sequential execution, and subagent `max_turns` precedence [S2]. goose's delegation is real but **recipe/task-centric** rather than **named-persona-centric** — a difference in *model*, not *absence*. Resolved in goose's favor (Tier 1).
- **"Hermes" identity.** Multiple referents exist (NousResearch Hermes *models* vs. Hermes *Agent* vs. derivative orchestration projects). The Agent interpretation is most consistent with an "agent orchestration framework" reading, but this rests on Tier 2/3 materials and is flagged Medium confidence; the alternative (Hermes LLMs) cannot be fully excluded.
- **ECC.tools capability figures** (261 skills / 64 agents / 102 security rules) are vendor marketing numbers [S5] and could not be independently verified.

---

## Gaps and Limitations

- **goose skills page (404).** `goose-docs.ai/docs/guides/skills/` returned HTTP 404 at access time; the goose skills model is reconstructed from repository directory/commit evidence [S1] plus the recipe reference [S2], not a dedicated skills doc. The precise goose SKILL.md frontmatter schema was not captured.
- **ECC.tools internals not public.** The codebase→skills analysis mechanism, generated-skill schema, and portability fidelity are not documented on reviewed materials; evaluation is public-materials-only and Medium confidence.
- **Hermes Agent primary docs not deep-fetched.** Identification and capability claims rest on landing-page/search-snippet (Tier 2/3) evidence; mechanism claims should be verified against `github.com/nousresearch/hermes-agent` before reliance.
- **Cursor rules MDC schema and OpenAI Codex skill schema not fully captured** (Cursor docs redirected; Codex skills not separately fetched). Treated as Medium confidence; precise current formats not asserted.
- **VS Code Copilot customization format** (instructions/prompt/agent files) was not separately researched in this pass despite being a named compile target; flagged for follow-up.
- **bun `bin`/shebang specifics** are stated from general npm/bun convention plus bundler docs; the dedicated bun "executables/bin linking" guide was inferred rather than fetched verbatim for the `bin` field (the `--compile` single-file path *was* fetched directly [S9]).

---

## Source Registry

| # | Source | URL | Tier | Accessed | Relevance |
|---|---|---|---|---|---|
| S1 | AAIF goose repository (README, dir structure, commits) | https://github.com/aaif-goose/goose (formerly github.com/block/goose) | 1 | 2026-06-14 | Skills mirroring (.claude/.codex/.cursor), .goosehints, AGENTS.md/CLAUDE.md parity, hooks, custom distros, ACP/MCP, LF governance |
| S2 | goose Recipe Reference Guide | https://goose-docs.ai/docs/guides/recipes/recipe-reference/ | 1 | 2026-06-14 | Recipe schema: parameters, extensions, sub_recipes, summon delegation, settings/max_turns, retry, response.json_schema |
| S3 | Claude Code — Create custom subagents | https://code.claude.com/docs/en/sub-agents | 1 | 2026-06-14 | Subagent frontmatter schema, scopes/precedence, isolation, auto-delegation, nested spawning, skills/memory |
| S4 | Agent Client Protocol — Introduction | https://agentclientprotocol.com/ | 1 | 2026-06-14 | LSP-for-agents, JSON-RPC/stdio, MCP type reuse, portability |
| S5 | ECC.tools ("Everything Claude Code") landing page | https://ecc.tools/ (OSS: github.com/affaan-m/everything-claude-code; npm: ecc-universal) | 2 | 2026-06-14 | Repo-history→skills auto-init, multi-harness (Claude/Codex/Cursor/OpenCode), AgentShield |
| S6 | Hermes Agent (NousResearch) | https://hermes-agent.org / https://hermes-agent.nousresearch.com/docs/ (repo: github.com/nousresearch/hermes-agent) | 2 | 2026-06-14 | Self-improving skill creation, persistent memory, self-hosted autonomous agent |
| S7 | AGENTS.md official site | https://agents.md/ | 1 | 2026-06-14 | Universal manifest convention, ecosystem reach, nested cascade, LF/AAIF stewardship |
| S7b | Agents.md guide (third-party, Codex-focused) | https://agentsmd.net/ | 3 | 2026-06-14 | Codex consumption of AGENTS.md (corroboration only) |
| S8 | Bun Bundler docs | https://bun.sh/docs/bundler | 1 | 2026-06-14 | bun build, targets/formats, external/packages, files (virtual), shebang→target bun, metafile |
| S9 | Bun Single-file executable docs | https://bun.com/docs/bundler/executables | 1 | 2026-06-14 | --compile, cross-compile targets, bytecode, embedded files, BUN_BE_BUN, codesigning |

---

## Recommendations for Further Research

1. **Fetch the goose SKILL.md schema directly** (resolve the 404 via the repo's root skill files) to confirm the exact frontmatter Murmuration should mirror.
2. **Inspect the ECC `ecc-universal` npm package and OSS repo** to recover the generated-skill schema and the analysis pipeline — the closest competitor to Murmuration's init.
3. **Verify Hermes Agent mechanics against its GitHub repo** to confirm the learning-loop/skill-synthesis implementation before borrowing the pattern.
4. **Research the VS Code Copilot customization format** (instructions/prompt/agent/skill files) in depth — a named compile target not covered this pass.
5. **Capture the current Cursor `.cursor/rules` MDC schema and OpenAI Codex `.codex/skills` schema** to finalize the compile-target matrix.
6. **Prototype the ACP emission path** and validate that an MCP-shaped tool declaration round-trips through Claude `mcpServers`, goose `extensions`, and ACP without lossy translation.
7. **Survey existing context-stripping / secret-scrubbing approaches** (e.g., ECC's AgentShield, secret-scanning tools) to inform Murmuration's publish step.
