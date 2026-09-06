import { join, isAbsolute } from "node:path";
import type { RuntimeCompiler } from "./RuntimeCompiler.ts";
import { CopilotAdapter } from "./adapters/copilot.ts";
import { GooseAdapter } from "./adapters/goose.ts";
import { AntigravityAdapter } from "./adapters/antigravity.ts";
import { ClaudeAdapter } from "./adapters/claude.ts";
import { CursorAdapter } from "./adapters/cursor.ts";
import { AcpAdapter } from "./adapters/acp.ts";
import { defineAdapter } from "./plugin.ts";
import type { MurmurConfig } from "../schema/config.ts";

/** Built-in adapter registry. Adding a runtime = register its adapter here. */
const adapters = new Map<string, () => RuntimeCompiler>([
  ["copilot", () => new CopilotAdapter()],
  ["goose", () => new GooseAdapter()],
  ["antigravity", () => new AntigravityAdapter()],
  ["agy", () => new AntigravityAdapter()],
  ["claude", () => new ClaudeAdapter()],
  ["claude-code", () => new ClaudeAdapter()],
  ["cursor", () => new CursorAdapter()],
  ["acp", () => new AcpAdapter()],
]);

export function registerAdapter(id: string, factory: () => RuntimeCompiler): void {
  adapters.set(id.toLowerCase(), factory);
}

export function unregisterAdapter(id: string): void {
  adapters.delete(id.toLowerCase());
}

export function getAdapter(id: string): RuntimeCompiler | undefined {
  const factory = adapters.get(id.toLowerCase());
  return factory ? factory() : undefined;
}

export function availableTargets(): string[] {
  return [...adapters.keys()];
}

/**
 * Scan package.json for installed npm packages matching murmr-plugin-*
 */
export async function discoverInstalledPlugins(projectRoot: string): Promise<string[]> {
  const pkgPath = join(projectRoot, "package.json");
  const plugins: string[] = [];
  try {
    const pkgFile = Bun.file(pkgPath);
    if (!(await pkgFile.exists())) return [];
    const pkg = await pkgFile.json();
    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    };

    const pluginPattern = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?murmr-plugin-[a-z0-9-_]+$/i;
    for (const name of Object.keys(allDeps)) {
      if (pluginPattern.test(name)) {
        plugins.push(name);
      }
    }
  } catch {
    /* ignore parse failure */
  }
  return plugins;
}

/**
 * Dynamically import a plugin and register its adapter.
 */
export async function loadPluginAdapter(
  pluginSpec: string,
  projectRoot: string,
  opts: { allowConfigExec?: boolean } = {},
): Promise<RuntimeCompiler | null> {
  // Code-execution guard: loading a plugin executes arbitrary JS/TS.
  if (opts.allowConfigExec === false) {
    throw new Error(
      `Refusing to execute plugin "${pluginSpec}" without --allow-config-exec permission.`,
    );
  }

  let importPath = pluginSpec;
  if (pluginSpec.startsWith(".") || isAbsolute(pluginSpec)) {
    importPath = isAbsolute(pluginSpec) ? pluginSpec : join(projectRoot, pluginSpec);
  }

  try {
    const mod = await import(importPath);
    const candidate = mod.default || mod.adapter || mod;
    const adapter = typeof candidate === "function" ? candidate() : candidate;
    const validated = defineAdapter(adapter);
    registerAdapter(validated.id, () => validated);
    return validated;
  } catch (err) {
    throw new Error(
      `Failed to load plugin adapter "${pluginSpec}": ${(err as Error).message}`,
    );
  }
}

/**
 * Resolve all configured and auto-discovered plugins for a project.
 */
export async function resolveAdapters(
  config: MurmurConfig,
  projectRoot: string,
  opts: { allowConfigExec?: boolean } = {},
): Promise<void> {
  const configuredPlugins = config.plugins ?? [];
  const discoveredPlugins = await discoverInstalledPlugins(projectRoot);

  const allToLoad = Array.from(new Set([...configuredPlugins, ...discoveredPlugins]));
  for (const p of allToLoad) {
    await loadPluginAdapter(p, projectRoot, opts);
  }
}
