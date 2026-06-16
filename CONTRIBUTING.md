# Contributing to Murmuration

Thanks for your interest in `murmur`! This document explains how to develop, test,
and contribute changes, and how releases are versioned and published.

## Prerequisites

- [bun](https://bun.sh) `>= 1.0`
- git, and (for releases) a GitHub account with access to the repo

## Getting started

```bash
git clone https://github.com/CalebJebadurai/murmur.git
cd murmur
bun install        # also installs git hooks via lefthook (prepare script)
bun test           # run the suite
bun run typecheck  # tsc --noEmit
bun run build      # bundle to dist/cli.js
```

Run the CLI from source while developing:

```bash
bun run dev -- init
bun run dev -- compile --target copilot
```

## Project layout

```
src/
  schema/        # typed IR (agents, subagents, skills, instructions, config) + validators
  compiler/      # RuntimeCompiler interface, atomic staging, adapters/
  commands/      # init, add, compile, doctor, list, publish
  analyzer/      # deterministic structural codebase analysis
  publish/       # scrubber, secret scanning, externalization gate
  util/          # frontmatter, yaml, glob, config loader, templates
templates/       # shipped base agent library + scaffolds
murmur/          # murmur's own dogfooded IR
tests/           # bun test suites + fixtures
docs/            # VISION, ROADMAP, COMPARISON, probes
```

## Adding a runtime adapter

A new runtime is one file implementing the `RuntimeCompiler` interface in
`src/compiler/adapters/<id>.ts`, registered in `src/compiler/registry.ts`, with a
golden-file test in `tests/`. Adapters must:

- emit syntactically valid output for the target,
- degrade gracefully when the runtime lacks a primitive (e.g. subagents),
- never leak project facts into agent bodies (the externalization gate enforces this).

See [`docs/COMPARISON.md`](docs/COMPARISON.md) for each runtime's native format and
[`docs/ROADMAP.md`](docs/ROADMAP.md) for what's planned.

## Quality gates (run automatically on commit)

The pre-commit hook runs `typecheck`, `bun test`, and the
**knowledge-externalization gate** (`scripts/check-externalization.ts`). All three
must pass. CI re-runs them on every push and PR.

## Commit messages — Conventional Commits (required)

Versioning is automated, so commit messages must follow
[Conventional Commits](https://www.conventionalcommits.org/). The `commit-msg` hook
validates this with commitlint.

```
<type>(<optional scope>): <description>

[optional body]
[optional footer, e.g. "BREAKING CHANGE: ..."]
```

Allowed types: `feat`, `fix`, `perf`, `docs`, `refactor`, `test`, `build`, `ci`,
`chore`, `revert`.

- `feat:` → minor bump · `fix:`/`perf:` → patch bump · `BREAKING CHANGE:` → major bump
  (while pre-1.0, breaking changes bump the minor).

Examples:

```
feat(compiler): add Cursor adapter
fix(publish): redact home-directory paths in scrubber
docs(roadmap): add tool-generation milestone
```

## Pull requests

1. Fork and branch from `main` (`feat/...`, `fix/...`).
2. Keep changes focused; add or update tests.
3. Ensure `bun test`, `bun run typecheck`, and the externalization gate pass.
4. Open a PR with a Conventional-Commit-style title; describe the change and link issues.
5. A maintainer reviews and merges via squash (the squash title becomes the release entry).

## Releases & versioning (automated)

Releases use [release-please](https://github.com/googleapis/release-please-action):

1. Conventional-commit merges to `main` make release-please open/update a **release PR**
   that bumps the version in `package.json` + `.release-please-manifest.json` and
   updates [`CHANGELOG.md`](CHANGELOG.md).
2. Merging that release PR tags the version and creates a GitHub Release.
3. The `publish` job then builds and publishes to npm **if** an `NPM_TOKEN` repository
   secret is configured. Until then, publishing is skipped (a no-op) and releases are
   GitHub-only.

Maintainers: to enable npm publishing, add a repository secret `NPM_TOKEN` (an npm
automation token with publish rights). No manual version edits are ever needed.

## Code of conduct

Be respectful and constructive. Harassment or abuse is not tolerated. Report concerns
to the maintainer via a private GitHub issue or direct contact.

## License

By contributing, you agree your contributions are licensed under the project's
[MIT License](LICENSE).
