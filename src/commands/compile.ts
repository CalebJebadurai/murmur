import { join } from "node:path";
import { existsSync } from "node:fs";
import { loadIR } from "../schema/load.ts";
import { compileTarget } from "../compiler/compile.ts";
import { backupStamp } from "../util/backup.ts";
import { availableTargets, getAdapter, resolveAdapters } from "../compiler/registry.ts";
import type { CompileContext } from "../compiler/RuntimeCompiler.ts";
import { loadConfig } from "../util/loadConfig.ts";
import { runDoctor } from "./doctor.ts";

export type CompileOptions = {
  target?: string;
  out?: string;
  allowConfigExec?: boolean;
  /** Replace existing files after backing them up. */
  replace?: boolean;
};

/** `murmr compile [--target <id>] [--out <dir>]`. */
export async function compileCommand(
  projectRoot: string,
  opts: CompileOptions,
): Promise<number> {
  const murmurDir = join(projectRoot, "murmur");
  if (!existsSync(join(murmurDir, "agents"))) {
    console.error('No murmur/ directory found. Run "murmr init" first.');
    return 1;
  }

  // Refuse to compile invalid IR.
  const report = await runDoctor(murmurDir);
  if (!report.ok) {
    console.error("Refusing to compile: doctor found problems. Run `murmr doctor`.");
    return 1;
  }

  const loaded = await loadIR(murmurDir);
  if (!loaded.ok) {
    console.error("Failed to load IR.");
    return 1;
  }

  const config = await loadConfig(projectRoot, {
    allowConfigExec: opts.allowConfigExec,
  });

  try {
    await resolveAdapters(config, projectRoot, {
      allowConfigExec: opts.allowConfigExec,
    });
  } catch (err) {
    console.error(`Plugin error: ${(err as Error).message}`);
    return 1;
  }

  const targets = opts.target ? [opts.target] : config.targets;
  const outRoot = opts.out ? join(projectRoot, opts.out) : projectRoot;
  const stamp = backupStamp();
  const kept = new Set<string>();
  const backups = new Set<string>();

  for (const name of loaded.value.shadowed ?? []) {
    console.log(`kept your ${name}; the library version is not used`);
  }

  for (const id of targets) {
    const adapter = getAdapter(id);
    if (!adapter) {
      console.error(
        `Unknown target "${id}". Available: ${availableTargets().join(", ")}.`,
      );
      return 1;
    }
    const ctx: CompileContext = { config, ir: loaded.value };
    const result = await compileTarget(adapter, ctx, outRoot, { replace: opts.replace, stamp });
    console.log(`compiled ${id}: ${result.files.length} file(s)`);
    for (const f of result.files) console.log(`  ${f}`);
    for (const f of result.kept) kept.add(f);
    for (const f of result.backups) backups.add(f);
  }

  if (kept.size) {
    console.log(`\nKept ${kept.size} existing file(s) that Murmur did not write:`);
    for (const f of [...kept].sort()) console.log(`  ${f}`);
    console.log("These targets did not get Murmur's version. To replace them, run with --replace (backups are kept).");
  }
  if (backups.size) {
    console.log(`\nBacked up ${backups.size} replaced file(s) under .murmur/backups/${stamp}/`);
  }
  return 0;
}
