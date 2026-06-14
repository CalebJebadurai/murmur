export type { AgentDefinition } from "./agent.ts";
export type { SubagentDefinition, SpawnMeta } from "./subagent.ts";
export type { SkillDefinition } from "./skill.ts";
export type { InstructionDefinition } from "./instruction.ts";
export type {
  MurmurConfig,
  ProjectConfig,
  PublishConfig,
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

/** The full set of IR definitions loaded from a murmur/ directory. */
export type IRSet = {
  agents: AgentDefinition[];
  subagents: SubagentDefinition[];
  skills: SkillDefinition[];
  instructions: InstructionDefinition[];
};
