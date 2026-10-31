import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const MANIFEST_PATH = join(".murmur", "manifest.json");

/** Generated path -> sha256 of the contents Murmur last wrote there. */
export type OwnershipManifest = {
  version: 1;
  files: Record<string, string>;
};

export type WriteDecision = "write" | "unchanged" | "yours" | "edited";

export function hashContents(contents: string | Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(contents).digest("hex");
}

export async function readManifest(root: string): Promise<OwnershipManifest> {
  const file = Bun.file(join(root, MANIFEST_PATH));
  if (!(await file.exists())) return { version: 1, files: {} };
  return (await file.json()) as OwnershipManifest;
}

export async function writeManifest(root: string, manifest: OwnershipManifest): Promise<void> {
  const files = Object.fromEntries(
    Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)),
  );
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
  const dest = join(root, relativePath);
  if (!existsSync(dest)) return "write";

  const current = hashContents(await Bun.file(dest).bytes());
  if (current === hashContents(contents)) return "unchanged";

  const recorded = manifest.files[relativePath];
  if (recorded === undefined) return "yours";
  return recorded === current ? "write" : "edited";
}
