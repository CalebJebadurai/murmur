import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Resolve the shipped `templates/` directory whether running from source
 * (src/util/templates.ts) or from the bundled binary (dist/cli.js). Walks up
 * from the current module until a `templates/` directory is found.
 */
export function templatesDir(): string {
  let dir = import.meta.dir;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "templates");
    if (existsSync(join(candidate, "base"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate the templates/ directory.");
}
