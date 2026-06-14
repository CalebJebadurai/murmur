/**
 * InstructionDefinition — a behavioral rule scoped by an `applyTo` glob.
 *
 * Mirrors the minimal observed Copilot instruction frontmatter (only `applyTo`).
 */
export type InstructionDefinition = {
  /** Filename stem. */
  name: string;
  /** Glob pattern the rules apply to, e.g. "**\/*.ts". */
  applyTo: string;
  /** The rules body (Markdown). */
  rules: string;
};
