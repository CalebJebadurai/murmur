/**
 * PipelineDefinition — the orchestration IR (a fifth IR kind).
 *
 * A pipeline is NOT a single linear phase list. It is a routing block plus named
 * branches, because a real orchestration (e.g. architect.agent.md) has distinct
 * phase sequences selected by a classification gate. Each branch owns its own
 * phases, loops, parallelism, and tiers.
 *
 * The small header (name/description/version/classifications) lives in frontmatter;
 * the structured body (routing + branches) lives in the Markdown body parsed by
 * the strict reader in util/pipelineYaml.ts.
 */

/** A predicate pair describing when a phase dispatches an agent. */
export type DispatchRule = {
  invokeWhen: string[];
  skipWhen: string[];
};

/** One agent slot within a phase. */
export type PhaseAgent = {
  name: string;
  /** True for roster members with no backing definition file (e.g. Explore). */
  builtin?: boolean;
  dispatch?: DispatchRule;
};

/** One phase in a branch's sequence. */
export type PhaseDefinition = {
  id: string;
  label?: string;
  agents: PhaseAgent[];
};

/** A bounded refinement loop. `max` is hard-capped at 3. */
export type LoopDefinition = {
  name: string;
  from: string;
  to: string;
  min: number;
  max: number;
  earlyExit?: string;
};

/** Parallelism constraints for a branch. */
export type ParallelDefinition = {
  maxConcurrent: number;
  /** Pairs of agent names that must never co-dispatch. */
  neverParallel: [string, string][];
  /** Optional named per-pattern caps, e.g. { explore: 3 }. */
  perPatternCaps?: Record<string, number>;
};

/** A tier selects a subset of a branch's phases, with optional loop overrides. */
export type TierDefinition = {
  name: string;
  phases: string[];
  iterationOverrides?: Record<string, { min?: number; max?: number }>;
};

/** One branch: its own phase sequence, loops, parallelism, and tiers. */
export type BranchDefinition = {
  phases: PhaseDefinition[];
  loops: LoopDefinition[];
  parallel: ParallelDefinition;
  tiers: TierDefinition[];
};

/** Routing: the phase at which classification occurs and the label→branch map. */
export type RoutingDefinition = {
  at: string;
  map: Record<string, string>;
};

export type PipelineDefinition = {
  name: string;
  description: string;
  version: string;
  classifications: string[];
  routing: RoutingDefinition;
  branches: Record<string, BranchDefinition>;
};

/** The hard cap on loop iterations, mirroring the architect safety rule. */
export const MAX_LOOP_ITERATIONS = 3;
