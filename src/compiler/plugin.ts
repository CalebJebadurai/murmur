import type { RuntimeCompiler } from "./RuntimeCompiler.ts";

/**
 * Type-safe definition helper for authoring custom Murmur runtime adapter plugins.
 * Authors can publish an npm package matching `murmr-plugin-<name>` exporting
 * this defined adapter as default export.
 */
export function defineAdapter(adapter: RuntimeCompiler): RuntimeCompiler {
  if (!adapter || typeof adapter !== "object") {
    throw new Error("Plugin adapter must be an object implementing RuntimeCompiler");
  }
  if (!adapter.id || typeof adapter.id !== "string" || !adapter.id.trim()) {
    throw new Error('Plugin adapter must declare a non-empty string "id"');
  }
  if (typeof adapter.compileAgent !== "function") {
    throw new Error('Plugin adapter must implement "compileAgent" method');
  }
  if (typeof adapter.compileSubagent !== "function") {
    throw new Error('Plugin adapter must implement "compileSubagent" method');
  }
  if (typeof adapter.compileSkill !== "function") {
    throw new Error('Plugin adapter must implement "compileSkill" method');
  }
  if (typeof adapter.compileInstruction !== "function") {
    throw new Error('Plugin adapter must implement "compileInstruction" method');
  }
  return adapter;
}
