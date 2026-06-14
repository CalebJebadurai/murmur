import type {
  AgentDefinition,
  InstructionDefinition,
  SkillDefinition,
  SubagentDefinition,
} from "../../schema/index.ts";
import { emitFrontmatterDoc, type YamlValue } from "../../util/yaml.ts";
import type {
  CompileContext,
  EmittedFile,
  RuntimeCompiler,
} from "../RuntimeCompiler.ts";

/**
 * Copilot adapter — emits VS Code Copilot customization files:
 *  - .github/agents/<name>.agent.md   (persona-Markdown with YAML frontmatter)
 *  - .github/instructions/<name>.instructions.md   (applyTo-scoped)
 *  - .github/skills/<name>/SKILL.md
 */
export class CopilotAdapter implements RuntimeCompiler {
  readonly id = "copilot";

  private agentFrontmatter(
    agent: AgentDefinition,
    extra: Record<string, YamlValue> = {},
  ): Record<string, YamlValue> {
    const fm: Record<string, YamlValue> = { description: agent.description };
    if (agent.tools.length) fm["tools"] = agent.tools;
    if (agent.agents.length) fm["agents"] = agent.agents;
    if (agent.model && agent.model.length) fm["model"] = agent.model;
    if (agent.userInvocable !== undefined) fm["user-invocable"] = agent.userInvocable;
    return { ...fm, ...extra };
  }

  compileAgent(agent: AgentDefinition): EmittedFile[] {
    const fm = this.agentFrontmatter(agent);
    return [
      {
        path: `.github/agents/${agent.name}.agent.md`,
        contents: emitFrontmatterDoc(fm, agent.role),
      },
    ];
  }

  compileSubagent(sub: SubagentDefinition): EmittedFile[] {
    // Subagents are dispatch-only agents in Copilot.
    const fm = this.agentFrontmatter(sub, {
      "user-invocable": sub.userInvocable ?? false,
    });
    return [
      {
        path: `.github/agents/${sub.name}.agent.md`,
        contents: emitFrontmatterDoc(fm, sub.role),
      },
    ];
  }

  compileSkill(skill: SkillDefinition): EmittedFile[] {
    const fm: Record<string, YamlValue> = {
      name: skill.name,
      description: skill.description,
    };
    return [
      {
        path: `.github/skills/${skill.name}/SKILL.md`,
        contents: emitFrontmatterDoc(fm, skill.body),
      },
    ];
  }

  compileInstruction(instruction: InstructionDefinition): EmittedFile[] {
    const fm: Record<string, YamlValue> = { applyTo: instruction.applyTo };
    return [
      {
        path: `.github/instructions/${instruction.name}.instructions.md`,
        contents: emitFrontmatterDoc(fm, instruction.rules),
      },
    ];
  }

  finalize(_ctx: CompileContext): EmittedFile[] {
    return [];
  }
}
