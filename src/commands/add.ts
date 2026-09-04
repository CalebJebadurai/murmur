import { join } from "node:path";
import { templatesDir } from "../util/templates.ts";

export type AddKind = "agent" | "subagent" | "skill" | "instruction" | "tool";

const DEST: Record<AddKind, (name: string) => string> = {
  agent: (n) => `agents/${n}.md`,
  subagent: (n) => `subagents/${n}.md`,
  skill: (n) => `skills/${n}/SKILL.md`,
  instruction: (n) => `instructions/${n}.md`,
  tool: (n) => `tools/${n}.md`,
};

const TEMPLATE: Record<AddKind, string> = {
  agent: "scaffold/agent.md",
  subagent: "scaffold/subagent.md",
  skill: "scaffold/skill.md",
  instruction: "scaffold/instruction.md",
  tool: "scaffold/tool.md",
};

/** `murmr add <kind> <name>` — scaffold a new IR definition from a template. */
export async function addCommand(
  projectRoot: string,
  kind: AddKind,
  name: string,
): Promise<number> {
  if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    console.error("Provide a kebab-case name, e.g. `murmr add agent my-agent`.");
    return 1;
  }
  const murmurDir = join(projectRoot, "murmur");
  const dest = join(murmurDir, DEST[kind](name));
  if (await Bun.file(dest).exists()) {
    console.error(`Refusing to overwrite existing ${kind}: ${dest}`);
    return 1;
  }
  const tpl = await Bun.file(join(templatesDir(), TEMPLATE[kind])).text();
  const contents = tpl.replaceAll("__NAME__", name);
  await Bun.write(dest, contents);
  console.log(`add: created ${kind} at murmur/${DEST[kind](name)}`);
  console.log("Fill in the __PLACEHOLDER__ fields, then run `murmr doctor`.");
  return 0;
}
