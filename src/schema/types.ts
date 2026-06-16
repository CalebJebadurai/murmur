/**
 * Shared schema types for the Murmuration abstract intermediate representation (IR).
 *
 * The IR lives in a project's `murmur/` directory and is the single, runtime-neutral
 * source of truth that the compiler emits to each target runtime.
 */

/** Result of a validation pass over a single IR file. */
export type ValidationError = {
  message: string;
  file: string;
  field?: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationError[] };

/** The kind of an IR definition, inferred from its directory. */
export type DefinitionKind =
  | "agent"
  | "subagent"
  | "skill"
  | "instruction"
  | "pipeline"
  | "rubric";
