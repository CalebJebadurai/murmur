import type { AgentDefinition } from "./agent.ts";

/** Metadata the master agent uses to decide when and how to spawn a specialist. */
export type SpawnMeta = {
  /** Natural-language condition under which the master should consider spawning. */
  trigger: string;
  /** Skills the subagent-authoring skill attaches when spawning. */
  attachSkills: string[];
  /** Instructions attached when spawning. */
  attachInstructions: string[];
  /** Restricted tool set the spawned specialist may use. */
  toolPolicy: string[];
};

/**
 * SubagentDefinition — a narrow, often ephemeral specialist.
 *
 * Extends AgentDefinition with spawn metadata. Dispatch-only by default.
 */
export type SubagentDefinition = AgentDefinition & {
  spawn: SpawnMeta;
};
