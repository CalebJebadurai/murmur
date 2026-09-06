/**
 * Murmuration (murmr) library exports.
 * Provides programmatic APIs for schema loading, plugin definition, compilation, and evaluation.
 */

export { defineAdapter } from "./compiler/plugin.ts";
export type { RuntimeCompiler, EmittedFile } from "./compiler/RuntimeCompiler.ts";
export { loadIR } from "./schema/load.ts";
export { scoreRubric, parseDocumentScores } from "./commands/score.ts";
export { classifyTask } from "./commands/classify.ts";
export { runWorkerPool } from "./util/workerPool.ts";
export { makeSandboxDispatcher } from "./commands/sandboxDispatch.ts";
export { discoverInstalledPlugins, loadPluginAdapter, resolveAdapters } from "./compiler/registry.ts";
