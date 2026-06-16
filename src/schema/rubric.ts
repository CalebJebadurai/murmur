/**
 * RubricDefinition — a scoring scorecard (a sixth IR kind).
 *
 * Two extensions over a flat dimension list are mandatory to reproduce real
 * multi-critic review formats:
 *   - CONDITIONAL dimensions (excluded from the denominator when N/A by task type)
 *   - weighted multi-rubric aggregation via RubricSetDefinition
 *
 * Like pipelines, the structured body lives in a fenced YAML block; only the
 * name/description header is in frontmatter.
 */

export type RubricQuestion = {
  text: string;
  /** [M] mandatory vs [O] optional depth-probe. */
  mandatory: boolean;
};

export type DimensionDefinition = {
  label: string;
  classification: "MANDATORY" | "CONDITIONAL";
  questions: RubricQuestion[];
  scaleMax: number;
  weight: number;
  /** When this conditional dimension applies (host decides; advisory metadata). */
  appliesWhen?: string;
  /** When this conditional dimension is N/A (excluded from the denominator). */
  naWhen?: string;
};

export type RubricDefinition = {
  name: string;
  description: string;
  dimensions: DimensionDefinition[];
  severityLevels: string[];
  /** Readiness condition, e.g. "all mandatory dimensions >= 4". */
  readinessGate: string;
  /** The denominator (e.g. 55 for an 11-dimension /5 technical scorecard). */
  totalMax: number;
};

export type RubricSetMember = {
  rubric: string;
  weight: number;
  /** When to include this member (host decides; advisory). Default: always. */
  includeWhen?: string;
};

/** Weighted aggregation of multiple rubrics (e.g. technical + business + social). */
export type RubricSetDefinition = {
  name: string;
  description: string;
  members: RubricSetMember[];
};
