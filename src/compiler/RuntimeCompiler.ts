import type {
  AgentDefinition,
  InstructionDefinition,
  IRSet,
  MurmurConfig,
  SkillDefinition,
  SubagentDefinition,
} from "../schema/index.ts";

/** A single file an adapter wants written, relative to the compile output root. */
export type EmittedFile = {
  /** Path relative to the output root, e.g. ".github/agents/critic.agent.md". */
  path: string;
  contents: string;
};

/** Context passed to every adapter call. */
export type CompileContext = {
  config: MurmurConfig;
  /** The full IR so adapters can resolve cross-references. */
  ir: IRSet;
};

/**
 * RuntimeCompiler — the adapter contract. Adding a runtime is implementing this
 * one interface and registering it in the adapter registry.
 */
export interface RuntimeCompiler {
  /** Target identifier, e.g. "copilot", "goose". */
  readonly id: string;

  compileAgent(agent: AgentDefinition, ctx: CompileContext): EmittedFile[];
  compileSubagent(sub: SubagentDefinition, ctx: CompileContext): EmittedFile[];
  compileSkill(skill: SkillDefinition, ctx: CompileContext): EmittedFile[];
  compileInstruction(
    instruction: InstructionDefinition,
    ctx: CompileContext,
  ): EmittedFile[];

  /** Optional target-level files (e.g. goose AGENTS.md / CLAUDE.md parity). */
  finalize?(ctx: CompileContext): EmittedFile[];
}

/** Run a full adapter over an IR set and collect every emitted file. */
export function emitAll(
  adapter: RuntimeCompiler,
  ctx: CompileContext,
): EmittedFile[] {
  const files: EmittedFile[] = [];
  for (const agent of ctx.ir.agents) files.push(...adapter.compileAgent(agent, ctx));
  for (const sub of ctx.ir.subagents) files.push(...adapter.compileSubagent(sub, ctx));
  for (const skill of ctx.ir.skills) files.push(...adapter.compileSkill(skill, ctx));
  for (const instr of ctx.ir.instructions)
    files.push(...adapter.compileInstruction(instr, ctx));
  if (adapter.finalize) files.push(...adapter.finalize(ctx));
  return files;
}
