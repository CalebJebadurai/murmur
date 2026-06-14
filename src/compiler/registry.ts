import type { RuntimeCompiler } from "./RuntimeCompiler.ts";
import { CopilotAdapter } from "./adapters/copilot.ts";
import { GooseAdapter } from "./adapters/goose.ts";

/** Built-in adapter registry. Adding a runtime = register its adapter here. */
const adapters = new Map<string, () => RuntimeCompiler>([
  ["copilot", () => new CopilotAdapter()],
  ["goose", () => new GooseAdapter()],
]);

export function getAdapter(id: string): RuntimeCompiler | undefined {
  const factory = adapters.get(id);
  return factory ? factory() : undefined;
}

export function availableTargets(): string[] {
  return [...adapters.keys()];
}
