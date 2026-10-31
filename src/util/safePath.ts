import { lstat } from "node:fs/promises";
import { join } from "node:path";

/** True when any part of a project-relative path is a symlink, so writing could leave the project. */
export async function crossesSymlink(root: string, relativePath: string): Promise<boolean> {
  let current = root;
  for (const part of relativePath.split("/")) {
    current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) return true;
    } catch {
      return false; // Nothing exists from here down, so there is nothing to follow.
    }
  }
  return false;
}
