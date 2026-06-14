import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CompileContext, EmittedFile, RuntimeCompiler } from "./RuntimeCompiler.ts";
import { emitAll } from "./RuntimeCompiler.ts";

export type CompileResult = {
  target: string;
  files: string[];
};

/**
 * Compile a single target atomically: emit all files into a sibling staging
 * directory, and only on full success move them into the output root. A failure
 * mid-emit leaves the output tree untouched.
 */
export async function compileTarget(
  adapter: RuntimeCompiler,
  ctx: CompileContext,
  outputRoot: string,
): Promise<CompileResult> {
  // Collect first — any adapter throw aborts before we touch the output tree.
  const emitted: EmittedFile[] = emitAll(adapter, ctx);

  const staging = join(outputRoot, `.murmur-stage-${adapter.id}-${process.pid}`);
  await rm(staging, { recursive: true, force: true });

  const written: string[] = [];
  try {
    for (const file of emitted) {
      const dest = join(staging, file.path);
      await Bun.write(dest, file.contents);
      written.push(file.path);
    }
    // Move staged files into place (same filesystem → atomic per file).
    for (const file of emitted) {
      const from = join(staging, file.path);
      const to = join(outputRoot, file.path);
      const contents = await Bun.file(from).text();
      await Bun.write(to, contents);
      void dirname(to);
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }

  return { target: adapter.id, files: written };
}
