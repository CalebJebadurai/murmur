import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** A filesystem-safe timestamp shared by every backup in one run. */
export function backupStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/** Copy a file under .murmur/backups/<stamp>/ before Murmur replaces it. Returns the backup path. */
export async function backupFile(
  root: string,
  relativePath: string,
  stamp: string,
): Promise<string> {
  const murmurState = join(root, ".murmur");
  const ignore = join(murmurState, ".gitignore");
  await mkdir(murmurState, { recursive: true });
  if (!existsSync(ignore)) await writeFile(ignore, "backups/\n", "utf8");

  const backup = join("backups", stamp, relativePath);
  const dest = join(murmurState, backup);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(join(root, relativePath), dest);
  return join(".murmur", backup);
}
