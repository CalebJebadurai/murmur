import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { crossesSymlink } from "../util/safePath.ts";

const MANIFEST_PATH = join(".murmur", "manifest.json");

/** Generated path -> sha256 of the contents Murmur last wrote there. */
export type OwnershipManifest = {
  version: 1;
  files: Record<string, string>;
};

export type WriteDecision = "write" | "unchanged" | "yours" | "edited" | "symlink";

export function hashContents(contents: string | Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(contents).digest("hex");
}

export async function readManifest(root: string): Promise<OwnershipManifest> {
  const file = Bun.file(join(root, MANIFEST_PATH));
  if (!(await file.exists())) return { version: 1, files: {} };
  try {
    return (await file.json()) as OwnershipManifest;
  } catch {
    // Without a readable record, every existing file is treated as the user's.
    console.warn(`Could not read ${MANIFEST_PATH}. Existing files will be kept.`);
    return { version: 1, files: {} };
  }
}

export async function writeManifest(root: string, manifest: OwnershipManifest): Promise<void> {
  const files = Object.fromEntries(
    Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)),
  );
  if (await crossesSymlink(root, MANIFEST_PATH)) {
    throw new Error("Refusing to write through a symlink at .murmur/");
  }
  await mkdir(join(root, ".murmur"), { recursive: true });
  await Bun.write(
    join(root, MANIFEST_PATH),
    `${JSON.stringify({ version: 1, files }, null, 2)}\n`,
  );
}

/**
 * Decide whether Murmur may write a generated file. A file Murmur did not create, or
 * one changed since Murmur wrote it, belongs to the user and is never replaced by default.
 */
export async function decideWrite(
  root: string,
  relativePath: string,
  contents: string,
  manifest: OwnershipManifest,
): Promise<WriteDecision> {
  if (await crossesSymlink(root, relativePath)) return "symlink";

  const dest = join(root, relativePath);
  if (!existsSync(dest)) return "write";

  const current = hashContents(await Bun.file(dest).bytes());
  if (current === hashContents(contents)) return "unchanged";

  const recorded = manifest.files[relativePath];
  if (recorded === undefined) return "yours";
  return recorded === current ? "write" : "edited";
}
