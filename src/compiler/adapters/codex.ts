import type {
  AgentDefinition,
  InstructionDefinition,
  PipelineDefinition,
  SkillDefinition,
  SubagentDefinition,
} from "../../schema/index.ts";
import { emitFrontmatterDoc, type YamlValue } from "../../util/yaml.ts";
import { renderAgentsMd } from "../agentsMd.ts";
import { renderPipelineProse } from "../pipelineProse.ts";
import type { CompileContext, EmittedFile, RuntimeCompiler } from "../RuntimeCompiler.ts";

const READ_ONLY_NOTE = "This agent is read-only. Do not create, edit or delete files.\n\n";

/** TOML basic strings share JSON's escape syntax. */
function agentToml(name: string, description: string, instructions: string): string {
  return [
    `name = ${JSON.stringify(name)}`,
    `description = ${JSON.stringify(description)}`,
    `developer_instructions = ${JSON.stringify(instructions)}`,
    "",
  ].join("\n");
}

function isReadOnly(tools: string[]): boolean {
  return tools.length > 0 && !tools.includes("edit") && !tools.includes("new");
}

/**
 * Codex adapter — emits OpenAI Codex customization files:
 *  - .codex/agents/<name>.toml (custom agents)
 *  - .agents/skills/<name>/SKILL.md
 *  - AGENTS.md at root, which carries instructions because Codex has no scoped rule files
 */
export class CodexAdapter implements RuntimeCompiler {
  readonly id = "codex";

  compileAgent(agent: AgentDefinition): EmittedFile[] {
    const prefix = isReadOnly(agent.tools) ? READ_ONLY_NOTE : "";
    return [
      {
        path: `.codex/agents/${agent.name}.toml`,
        contents: agentToml(agent.name, agent.description, prefix + agent.role),
      },
    ];
  }

  compileSubagent(sub: SubagentDefinition): EmittedFile[] {
    return [
      {
        path: `.codex/agents/${sub.name}.toml`,
        contents: agentToml(sub.name, sub.description, sub.role),
      },
    ];
  }

  compileSkill(skill: SkillDefinition): EmittedFile[] {
    const fm: Record<string, YamlValue> = { name: skill.name, description: skill.description };
    const files: EmittedFile[] = [
      {
        path: `.agents/skills/${skill.name}/SKILL.md`,
        contents: emitFrontmatterDoc(fm, skill.body),
      },
    ];
    for (const a of skill.assets ?? []) {
      files.push({
        path: `.agents/skills/${skill.name}/${a.relativePath}`,
        contents: a.contents ?? "",
      });
    }
    return files;
  }

  compileInstruction(_instruction: InstructionDefinition): EmittedFile[] {
    return [];
  }

  compilePipeline(pipeline: PipelineDefinition): EmittedFile[] {
    return [
      {
        path: `.codex/agents/${pipeline.name}.toml`,
        contents: agentToml(pipeline.name, pipeline.description, renderPipelineProse(pipeline)),
      },
    ];
  }

  finalize(ctx: CompileContext): EmittedFile[] {
    return [{ path: "AGENTS.md", contents: renderAgentsMd(ctx) }];
  }
}
