import { Glob } from "bun";

/** Returns true if `pattern` is a valid glob (compiles without throwing). */
export function isValidGlob(pattern: string): boolean {
  try {
    // Constructing and exercising the glob surfaces syntax errors.
    new Glob(pattern).match("probe/path.ts");
    return true;
  } catch {
    return false;
  }
}
