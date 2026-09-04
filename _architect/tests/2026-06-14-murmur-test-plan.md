# Murmuration — Test Plan

> Extracted from [`_architect/analysis/2026-06-14-murmur-multi-agent-framework.md`](../analysis/2026-06-14-murmur-multi-agent-framework.md) §9.
> Each test maps to one of the ten success criteria. Schema validity is the v0.1.0 acceptance bar; functional in-runtime execution is deferred.

## Compiler correctness (Criterion 2)

Golden-file tests: the Phase A hand-authored IR compiles to fixtures that are schema-validated (or byte-compared) for **both** Copilot and goose. Because goose's recipe paradigm is structurally unlike Copilot's persona-Markdown, these golden files genuinely exercise the abstraction rather than a field-rename. A separate **atomicity test** deliberately fails an adapter mid-compile and asserts no partial output is left in the target tree (proves staging-then-move).

## Knowledge externalization — HARD CI GATE (Criterion 4)

Scanner test reads every file in `murmur/agents/` and asserts **zero** matches against codebase-specific patterns (absolute `/Users/` paths, repo name, known domain terms). Separately asserts ≥80% of project-specific terms appear in skills/instructions. Runs in CI; release-blocking.

## Doctor command (Criterion 8)

Bidirectional: a freshly initialized project reports zero errors, exit 0. A deliberately corrupted fixture (missing referenced skill, malformed YAML frontmatter, invalid `applyTo` glob, circular subagent dependency) reports each error with description + file path, non-zero exit.

## Init analyzer (Criterion 1)

Validate the **deterministic structural pass** against a representative Node/TypeScript fixture for output completeness and the two-minute budget; exercise merge/overwrite/cancel by re-running. The semantic pass is validated separately and is **not** held to the deterministic budget.

## Master-agent spawning (Criterion 3)

Two scenario tests (data-validator, config-migrator) assert a valid, readable subagent is produced and invoked via whichever path the Phase A.5 probe selected (file-writing or ephemeral-persona).

## Publish scrubber (Criterion 5) — including false-negative coverage

Fixture with sentinel values (repo `test-project`, domain term `proprietary-feature`, fake email): output contains placeholders, none of the originals; source directory untouched; `doctor` passes on scrubbed output; `--dry-run` mutates nothing. **False-negative test:** fixture embeds a high-entropy secret-shaped string in **no** configured denylist; assert `--strict` flags/fails on it via the entropy/pattern scanner. **Security test:** loading a `murmur.config.ts` containing executable code does **not** run it unless `--allow-config-exec` is passed.

## Packaging (Criterion 9)

`bun pack`: tarball contains only intended files, under 10MB. Install into a scratch directory and smoke-test every command's `--help`.

## CLI usability (Criterion 6)

`murmur --help` shows usage; no-arg shows friendly error with suggestions; every command has `--help`; file-modifying commands print a change summary; `compile` without a `murmur/` directory prints a clear "run `murmur init` first" error.

## Out of scope for v0.1.0

Functional in-runtime execution (running compiled agents inside live Copilot/goose) — deferred to avoid automating live agent environments in CI; roadmap item.
