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

/**
 * OpenCode adapter — emits OpenCode customization files:
 *  - .opencode/agents/<name>.md (the file name is the agent name)
 *  - .opencode/skills/<name>/SKILL.md
 *  - AGENTS.md at root, which carries instructions
 */
export class OpenCodeAdapter implements RuntimeCompiler {
  readonly id = "opencode";

  compileAgent(agent: AgentDefinition): EmittedFile[] {
    const fm: Record<string, YamlValue> = { description: agent.description, mode: "primary" };
    if (agent.tools.length && !agent.tools.includes("edit") && !agent.tools.includes("new")) {
      fm["permission"] = { edit: "deny" };
    }
    return [
      {
        path: `.opencode/agents/${agent.name}.md`,
        contents: emitFrontmatterDoc(fm, agent.role),
      },
    ];
  }

  compileSubagent(sub: SubagentDefinition): EmittedFile[] {
    return [
      {
        path: `.opencode/agents/${sub.name}.md`,
        contents: emitFrontmatterDoc({ description: sub.description, mode: "subagent" }, sub.role),
      },
    ];
  }

  compileSkill(skill: SkillDefinition): EmittedFile[] {
    const fm: Record<string, YamlValue> = { name: skill.name, description: skill.description };
    const files: EmittedFile[] = [
      {
        path: `.opencode/skills/${skill.name}/SKILL.md`,
        contents: emitFrontmatterDoc(fm, skill.body),
      },
    ];
    for (const a of skill.assets ?? []) {
      files.push({
        path: `.opencode/skills/${skill.name}/${a.relativePath}`,
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
        path: `.opencode/agents/${pipeline.name}.md`,
        contents: emitFrontmatterDoc(
          { description: pipeline.description, mode: "primary" },
          renderPipelineProse(pipeline),
        ),
      },
    ];
  }

  finalize(ctx: CompileContext): EmittedFile[] {
    return [{ path: "AGENTS.md", contents: renderAgentsMd(ctx) }];
  }
}
