import { defineAdapter, type RuntimeCompiler, type EmittedFile } from "../../../src/index.ts";

/**
 * Example third-party adapter compiling murmur agents to a custom format (.custom-ai/).
 */
export const exampleAdapter: RuntimeCompiler = defineAdapter({
  id: "custom-ai",
  targetDescription: "Custom AI workspace format (.custom-ai/)",

  compileAgent(agent: any): EmittedFile[] {
    return [
      {
        path: `.custom-ai/agents/${agent.name}.json`,
        contents: JSON.stringify(
          {
            name: agent.name,
            role: agent.description,
            systemPrompt: agent.body,
            skills: agent.skills ?? [],
          },
          null,
          2,
        ),
      },
    ];
  },

  compileSkill(skill: any): EmittedFile[] {
    const files: EmittedFile[] = [
      {
        path: `.custom-ai/skills/${skill.name}/skill.json`,
        contents: JSON.stringify(
          {
            name: skill.name,
            description: skill.description,
            instructions: skill.body,
          },
          null,
          2,
        ),
      },
    ];
    if (skill.assets) {
      for (const asset of skill.assets) {
        files.push({
          path: `.custom-ai/skills/${skill.name}/${asset.relativePath}`,
          contents: asset.contents ?? "",
        });
      }
    }
    return files;
  },

  compileInstruction(instruction: any): EmittedFile[] {
    return [
      {
        path: `.custom-ai/instructions/${instruction.name}.json`,
        contents: JSON.stringify(
          {
            name: instruction.name,
            applyTo: instruction.applyTo,
            rules: instruction.body,
          },
          null,
          2,
        ),
      },
    ];
  },
});

export default exampleAdapter;
