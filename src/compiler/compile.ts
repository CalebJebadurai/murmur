import { rm } from "node:fs/promises";
import { join } from "node:path";
import { backupFile, backupStamp } from "../util/backup.ts";
import type { CompileContext, EmittedFile, RuntimeCompiler } from "./RuntimeCompiler.ts";
import { emitAll } from "./RuntimeCompiler.ts";
import { decideWrite, hashContents, readManifest, writeManifest } from "./ownership.ts";

export type CompileResult = {
  target: string;
  files: string[];
  /** Existing files Murmur left alone because they belong to the user. */
  kept: string[];
  /** Backups made because --replace was used. */
  backups: string[];
};

export type CompileTargetOptions = {
  /** Replace user-owned files after backing them up. */
  replace?: boolean;
  /** Shared backup folder name, so one run produces one backup set. */
  stamp?: string;
};

/**
 * Compile a single target atomically: emit all files into a sibling staging
 * directory, and only on full success move them into the output root. A failure
 * mid-emit leaves the output tree untouched. Files the user owns are never
 * replaced unless `replace` is set, and then only after a backup.
 */
export async function compileTarget(
  adapter: RuntimeCompiler,
  ctx: CompileContext,
  outputRoot: string,
  opts: CompileTargetOptions = {},
): Promise<CompileResult> {
  // Collect first — any adapter throw aborts before we touch the output tree.
  const emitted: EmittedFile[] = emitAll(adapter, ctx);
  const manifest = await readManifest(outputRoot);
  const stamp = opts.stamp ?? backupStamp();

  const toWrite: EmittedFile[] = [];
  const toBackup: string[] = [];
  const files: string[] = [];
  const kept: string[] = [];
  for (const file of emitted) {
    const decision = await decideWrite(outputRoot, file.path, file.contents, manifest);
    if (decision === "yours" || decision === "edited") {
      if (!opts.replace) {
        kept.push(file.path);
        continue;
      }
      toBackup.push(file.path);
    }
    if (decision !== "unchanged") toWrite.push(file);
    files.push(file.path);
    manifest.files[file.path] = hashContents(file.contents);
  }

  const staging = join(outputRoot, `.murmur-stage-${adapter.id}-${process.pid}`);
  await rm(staging, { recursive: true, force: true });

  const backups: string[] = [];
  try {
    for (const file of toWrite) {
      await Bun.write(join(staging, file.path), file.contents);
    }
    for (const path of toBackup) {
      backups.push(await backupFile(outputRoot, path, stamp));
    }
    // Move staged files into place (same filesystem → atomic per file).
    for (const file of toWrite) {
      const contents = await Bun.file(join(staging, file.path)).text();
      await Bun.write(join(outputRoot, file.path), contents);
    }
    await writeManifest(outputRoot, manifest);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }

  return { target: adapter.id, files, kept, backups };
}
