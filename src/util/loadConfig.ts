import { join } from "node:path";
import { DEFAULT_CONFIG, type MurmurConfig } from "../schema/config.ts";

export type LoadConfigOptions = {
  /** Allow executing a TypeScript config (arbitrary code). Default false. */
  allowConfigExec?: boolean;
};

/**
 * Constrained config loader.
 *
 * `murmur.config.ts` is executable TypeScript — importing it runs arbitrary code,
 * which is a code-execution vector for untrusted repositories. The loader therefore
 * prefers the JSON form and only executes the TS form when `allowConfigExec` is set.
 */
export async function loadConfig(
  projectRoot: string,
  opts: LoadConfigOptions = {},
): Promise<MurmurConfig> {
  const jsonPath = join(projectRoot, "murmur.config.json");
  if (await Bun.file(jsonPath).exists()) {
    const parsed = JSON.parse(await Bun.file(jsonPath).text());
    return { ...DEFAULT_CONFIG, ...parsed };
  }

  const tsPath = join(projectRoot, "murmur.config.ts");
  if (await Bun.file(tsPath).exists()) {
    if (!opts.allowConfigExec) {
      throw new Error(
        "Refusing to execute murmur.config.ts (arbitrary code). " +
          "Pass --allow-config-exec to run it, or provide murmur.config.json instead.",
      );
    }
    const mod = (await import(tsPath)) as { default?: MurmurConfig };
    if (!mod.default) throw new Error("murmur.config.ts must export a default config");
    return { ...DEFAULT_CONFIG, ...mod.default };
  }

  return DEFAULT_CONFIG;
}
