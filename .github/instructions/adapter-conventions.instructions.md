---
applyTo: "src/compiler/adapters/**/*.ts"
---

# Adapter Conventions

Rules for authoring a runtime adapter under `src/compiler/adapters/`.

- Implement the `RuntimeCompiler` interface from `src/compiler/RuntimeCompiler.ts`; expose a stable `readonly id`.
- Return `EmittedFile[]` from every `compile*` method. Paths are **relative to the output root** and must be deterministic (same IR → same paths and contents) so compiles are reproducible.
- Keep adapters **pure**: build and return file contents; never write to disk or mutate the IR. `compileTarget` owns staging, atomic writes, and cleanup.
- Resolve cross-references through `ctx.ir` (the full `IRSet`), not by re-reading files.
- Implement `compilePipeline?` only if the runtime can express orchestration; otherwise omit it (a clean no-op). Use `finalize?` for target-level manifest files.
- Emit YAML frontmatter via `util/yaml.ts` (`emitFrontmatterDoc`) rather than hand-formatting strings.
- Register the adapter in `src/compiler/registry.ts` (id → factory) so `getAdapter` / `availableTargets` pick it up.
- Add a compilation test under `tests/` (see `pipelineCompile.test.ts`) asserting the emitted file shape.

