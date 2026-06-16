/**
 * InstructionDefinition — a behavioral rule scoped by an `applyTo` glob.
 *
 * Mirrors the minimal observed Copilot instruction frontmatter (only `applyTo`),
 * with an optional ordered output-section contract.
 */
export type OutputSection = {
  name: string;
  required: boolean;
  order: number;
  wordTarget?: number;
};

export type InstructionDefinition = {
  /** Filename stem. */
  name: string;
  /** Glob pattern the rules apply to, e.g. "**\/*.ts". */
  applyTo: string;
  /** The rules body (Markdown). */
  rules: string;
  /** Optional ordered section contract documents under applyTo must satisfy. */
  sections?: OutputSection[];
};
