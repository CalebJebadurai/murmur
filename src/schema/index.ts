export type { AgentDefinition } from "./agent.ts";
export type { SubagentDefinition, SpawnMeta } from "./subagent.ts";
export type { SkillDefinition } from "./skill.ts";
export type { InstructionDefinition, OutputSection } from "./instruction.ts";
export type {
  PipelineDefinition,
  BranchDefinition,
  PhaseDefinition,
  PhaseAgent,
  DispatchRule,
  LoopDefinition,
  ParallelDefinition,
  TierDefinition,
  RoutingDefinition,
} from "./pipeline.ts";
export { MAX_LOOP_ITERATIONS } from "./pipeline.ts";
export type {
  RubricDefinition,
  RubricSetDefinition,
  RubricSetMember,
  DimensionDefinition,
  RubricQuestion,
} from "./rubric.ts";
export type {
  MurmurConfig,
  ProjectConfig,
  PublishConfig,
  RunConfig,
} from "./config.ts";
export { DEFAULT_CONFIG } from "./config.ts";
export type {
  ValidationError,
  ValidationResult,
  DefinitionKind,
} from "./types.ts";

import type { AgentDefinition } from "./agent.ts";
import type { SubagentDefinition } from "./subagent.ts";
import type { SkillDefinition } from "./skill.ts";
import type { InstructionDefinition } from "./instruction.ts";
import type { PipelineDefinition } from "./pipeline.ts";
import type { RubricDefinition } from "./rubric.ts";

/** The full set of IR definitions loaded from a murmur/ directory. */
export type IRSet = {
  agents: AgentDefinition[];
  subagents: SubagentDefinition[];
  skills: SkillDefinition[];
  instructions: InstructionDefinition[];
  pipelines: PipelineDefinition[];
  rubrics: RubricDefinition[];
};
