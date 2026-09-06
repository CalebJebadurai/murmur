# murmr-plugin-example

An example third-party compiler adapter plugin for **Murmuration (`murmr`)**.

## How Murmur Plugins Work

Starting in **v1.0.0**, `murmr` supports external, dynamically loaded compiler adapters. Any developer or tool vendor can create and distribute custom runtime targets as standalone npm packages.

### 1. Naming Convention & Discovery
Packages named `murmr-plugin-<target>` (or `@scope/murmr-plugin-<target>`) installed in your project's `dependencies` or `devDependencies` are **automatically discovered** by `murmr compile`.

Alternatively, plugins can be explicitly specified in `murmur.config.json`:

```json
{
  "targets": ["agy", "copilot", "custom-ai"],
  "plugins": ["murmr-plugin-example"]
}
```

### 2. Creating a Custom Adapter
Authoring an adapter requires implementing the `RuntimeCompiler` interface with `defineAdapter`:

```ts
import { defineAdapter, type EmittedFile } from "murmr";

export default defineAdapter({
  id: "custom-ai",
  targetDescription: "Custom AI workspace format",

  compileAgent(agent): EmittedFile[] {
    return [
      {
        path: `.custom-ai/agents/${agent.name}.json`,
        contents: JSON.stringify({ name: agent.name, role: agent.description, prompt: agent.body }, null, 2),
      },
    ];
  },

  compileSkill(skill): EmittedFile[] {
    return [
      {
        path: `.custom-ai/skills/${skill.name}.json`,
        contents: JSON.stringify({ name: skill.name, doc: skill.body }, null, 2),
      },
    ];
  },

  compileInstruction(instruction): EmittedFile[] {
    return [
      {
        path: `.custom-ai/instructions/${instruction.name}.json`,
        contents: JSON.stringify({ name: instruction.name, rules: instruction.body }, null, 2),
      },
    ];
  },
});
```

### 3. Security
Because external plugins execute code in the local environment, dynamic loading is guarded by default:
- Running `murmr compile --target custom-ai` prompts for or uses `--allow-config-exec` permission.
