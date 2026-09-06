import type {
  AgentDefinition,
  InstructionDefinition,
  PipelineDefinition,
  SkillDefinition,
  SubagentDefinition,
} from "../../schema/index.ts";
import { emitYaml, type YamlValue } from "../../util/yaml.ts";
import { pipelineRoster } from "../pipelineProse.ts";
import type {
  CompileContext,
  EmittedFile,
  RuntimeCompiler,
} from "../RuntimeCompiler.ts";

/**
 * goose adapter — emits the structurally-different recipe paradigm:
 *  - recipes/<name>.yaml   (title, description, instructions, prompt, extensions,
 *                           available_tools, sub_recipes, settings, response.json_schema)
 *  - skills/<name>/SKILL.md
 *  - .goosehints fragments via instructions
 *  - AGENTS.md / CLAUDE.md parity at the root (finalize)
 *
 * This adapter is deliberately the second target: its parameterized-recipe shape
 * is unlike Copilot's persona-Markdown, so compiling the same IR to both proves
 * the abstraction rather than a field-rename.
 */
export class GooseAdapter implements RuntimeCompiler {
  readonly id = "goose";

  private recipe(
    agent: AgentDefinition,
    subRecipes: string[],
  ): Record<string, YamlValue> {
    const recipe: Record<string, YamlValue> = {
      version: "1.0.0",
      title: agent.name,
      description: agent.description,
      instructions: agent.role,
    };
    if (agent.tools.length) recipe["available_tools"] = agent.tools;
    if (subRecipes.length) {
      recipe["sub_recipes"] = subRecipes.map((name) => ({
        name,
        path: `recipes/${name}.yaml`,
      }));
    }
    const settings: Record<string, YamlValue> = {};
    if (agent.model && agent.model.length) settings["goose_model"] = agent.model[0]!;
    if (Object.keys(settings).length) recipe["settings"] = settings;
    if (agent.dispatch) {
      recipe["annotations"] = {
        murmur_dispatch: {
          invoke_when: agent.dispatch.invokeWhen,
          skip_when: agent.dispatch.skipWhen,
          tasks: agent.dispatch.tasks,
        },
      };
    }
    return recipe;
  }

  compileAgent(agent: AgentDefinition): EmittedFile[] {
    const recipe = this.recipe(agent, agent.agents);
    return [
      {
        path: `recipes/${agent.name}.yaml`,
        contents: `${emitYaml(recipe)}\n`,
      },
    ];
  }

  compileSubagent(sub: SubagentDefinition): EmittedFile[] {
    const recipe = this.recipe(sub, sub.agents);
    // Encode the spawn policy as a recipe parameter block for transparency.
    recipe["parameters"] = [
      {
        key: "spawn_trigger",
        input_type: "string",
        requirement: "optional",
        description: sub.spawn.trigger,
        default: sub.spawn.trigger,
      },
    ];
    return [
      {
        path: `recipes/${sub.name}.yaml`,
        contents: `${emitYaml(recipe)}\n`,
      },
    ];
  }

  compileSkill(skill: SkillDefinition): EmittedFile[] {
    const header = `---\nname: ${skill.name}\ndescription: ${JSON.stringify(skill.description)}\n---\n\n`;
    return [
      {
        path: `skills/${skill.name}/SKILL.md`,
        contents: `${header}${skill.body.trim()}\n`,
      },
    ];
  }

  compileInstruction(instruction: InstructionDefinition): EmittedFile[] {
    // goose surfaces scoped rules as hint fragments.
    const contents = `# Applies to: ${instruction.applyTo}\n\n${instruction.rules.trim()}\n`;
    return [{ path: `hints/${instruction.name}.md`, contents }];
  }

  compilePipeline(pipeline: PipelineDefinition): EmittedFile[] {
    // goose recipes have no native loop/parallel/ordering semantics, so the
    // orchestration is emitted as ADVISORY metadata with a declared degradation.
    const roster = pipelineRoster(pipeline);
    const branches: YamlValue = Object.fromEntries(
      Object.entries(pipeline.branches).map(([bname, b]) => [
        bname,
        {
          sequence: b.phases.map((ph) => ph.id),
          loops: b.loops.map((l) => ({ name: l.name, from: l.from, to: l.to, min: l.min, max: l.max })),
          max_concurrent: b.parallel.maxConcurrent,
          never_parallel: b.parallel.neverParallel.map((pair) => pair.join(" + ")),
        },
      ]),
    );
    const recipe: Record<string, YamlValue> = {
      version: "1.0.0",
      title: pipeline.name,
      description: pipeline.description,
      instructions: `Orchestration pipeline. Routing at phase ${pipeline.routing.at}.`,
      sub_recipes: roster.map((name) => ({ name, path: `recipes/${name}.yaml` })),
      // Declared degradation: goose cannot enforce loops/parallel caps natively.
      annotations: {
        murmur_advisory: "loops and parallelism are advisory; only `murmr run` enforces them",
        routing: { at: pipeline.routing.at, map: pipeline.routing.map },
        branches,
      },
    };
    return [
      {
        path: `recipes/${pipeline.name}.yaml`,
        contents: `# murmur pipeline (advisory orchestration metadata)\n${emitYaml(recipe)}\n`,
      },
    ];
  }

  finalize(ctx: CompileContext): EmittedFile[] {
    const lines: string[] = [
      `# ${ctx.config.project.name} — Agent Guide`,
      "",
      "Generated by Murmuration (goose target). This file mirrors the agent roster",
      "for tools that read AGENTS.md / CLAUDE.md.",
      "",
      "## Agents",
      "",
      ...ctx.ir.agents.map((a) => `- **${a.name}** — ${a.description}`),
    ];
    if (ctx.ir.subagents.length) {
      lines.push("", "## Subagents", "");
      lines.push(...ctx.ir.subagents.map((s) => `- **${s.name}** — ${s.description}`));
    }
    const agentsMd = `${lines.join("\n")}\n`;
    return [
      { path: "AGENTS.md", contents: agentsMd },
      { path: "CLAUDE.md", contents: agentsMd },
    ];
  }
}
