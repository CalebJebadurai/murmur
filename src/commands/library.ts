import { readLock, syncLibrary, type SyncOptions } from "../library/sync.ts";
import { loadConfig } from "../util/loadConfig.ts";

export type LibraryAction = "sync" | "status";

export type LibraryCommandOptions = SyncOptions & { allowConfigExec?: boolean };

/** `murmr library <sync|status>`. */
export async function libraryCommand(
  projectRoot: string,
  action: LibraryAction,
  opts: LibraryCommandOptions = {},
): Promise<number> {
  const config = await loadConfig(projectRoot, { allowConfigExec: opts.allowConfigExec });
  if (!config.library) {
    console.error('library: add a "library" block to murmur.config.json first.');
    return 1;
  }

  if (action === "status") {
    const lock = await readLock(projectRoot);
    if (!lock) {
      console.log("library: not synced yet. Run `murmr library sync`.");
      return 0;
    }
    console.log(`library: ${lock.source}`);
    console.log(`commit : ${lock.commit ?? "not a git repository"}`);
    console.log(`files  : ${Object.keys(lock.files).length}`);
    return 0;
  }

  try {
    const result = await syncLibrary(projectRoot, config.library, opts);
    console.log(`library: synced ${result.files.length} file(s) into murmur/.library/`);
    for (const name of result.shadowed) {
      console.log(`  kept your ${name}; the library version is not used`);
    }
    return 0;
  } catch (err) {
    console.error(`library: ${(err as Error).message}`);
    return 1;
  }
}
