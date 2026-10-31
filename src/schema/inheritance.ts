import type { AgentDefinition } from "./agent.ts";
import type { IRSet, ValidationError } from "./index.ts";
import type { SubagentDefinition } from "./subagent.ts";
import type { TraitDefinition } from "./trait.ts";

type AnyAgent = AgentDefinition | SubagentDefinition;
type Section = { heading: string; text: string };

const LIBRARY_PREFIX = "library:";

/** Split Markdown at level-two headings, ignoring headings inside code fences. */
function splitSections(markdown: string): { intro: string; sections: Section[] } {
  const intro: string[] = [];
  const sections: { heading: string; lines: string[] }[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    const match = inFence ? null : /^##\s+(.+?)\s*$/.exec(line);
    if (match) sections.push({ heading: match[1]!, lines: [line] });
    else (sections.at(-1)?.lines ?? intro).push(line);
  }
  return {
    intro: intro.join("\n").trim(),
    sections: sections.map((s) => ({ heading: s.heading, text: s.lines.join("\n").trim() })),
  };
}

/**
 * Parent text comes first. Child intro text joins the parent intro, so a later merge
 * cannot mistake it for part of a section. A child `## Heading` replaces the parent's section.
 */
export function mergeBodies(parent: string, child: string): string {
  const base = splitSections(parent);
  const extra = splitSections(child);
  const sections = base.sections.map(
    (s) => extra.sections.find((e) => e.heading === s.heading) ?? s,
  );
  const added = extra.sections.filter(
    (e) => !base.sections.some((s) => s.heading === e.heading),
  );
  return [base.intro, extra.intro, ...sections.map((s) => s.text), ...added.map((s) => s.text)]
    .filter((part) => part !== "")
    .join("\n\n");
}

function union(...lists: string[][]): string[] {
  return [...new Set(lists.flat())];
}

function applyParent<T extends AnyAgent>(child: T, parent: AnyAgent): T {
  return {
    ...child,
    description: child.description || parent.description,
    role: mergeBodies(parent.role, child.role),
    tools: child.tools.length ? child.tools : parent.tools,
    skills: union(parent.skills, child.skills),
    instructions: union(parent.instructions, child.instructions),
    agents: union(parent.agents, child.agents),
    model: child.model ?? parent.model,
    dispatch: child.dispatch ?? parent.dispatch,
  };
}

function applyTraits<T extends AnyAgent>(
  agent: T,
  ownRole: string,
  traits: Map<string, TraitDefinition>,
  errors: ValidationError[],
  file: string,
): T {
  let role = agent.role;
  let skills = agent.skills;
  let instructions = agent.instructions;
  for (const name of agent.traits ?? []) {
    const trait = traits.get(name);
    if (!trait) {
      errors.push({ message: `unknown trait "${name}"`, file, field: "traits" });
      continue;
    }
    role = mergeBodies(role, trait.body);
    skills = union(skills, trait.skills);
    instructions = union(instructions, trait.instructions);
  }
  return { ...agent, role: mergeBodies(role, ownRole), skills, instructions };
}

/**
 * Flatten `extends` and `traits` into plain agents, so adapters never see inheritance.
 * `extends: library:<name>` reaches a library agent even when a local agent shares its name.
 * Abstract agents are removed from the result.
 */
export function resolveInheritance(
  set: IRSet,
  libraryAgents: AnyAgent[],
  errors: ValidationError[],
): void {
  const traits = new Map((set.traits ?? []).map((t) => [t.name, t]));
  const local = new Map<string, AnyAgent>(
    [...set.agents, ...set.subagents].map((a) => [a.name, a]),
  );
  const library = new Map<string, AnyAgent>(libraryAgents.map((a) => [a.name, a]));
  const resolved = new Map<AnyAgent, AnyAgent>();

  const resolve = <T extends AnyAgent>(agent: T, stack: AnyAgent[]): T => {
    const done = resolved.get(agent);
    if (done) return done as T;
    const file = `murmur/agents/${agent.name}.md`;
    if (stack.includes(agent)) {
      const cycle = [...stack, agent].map((a) => a.name).join(" -> ");
      errors.push({ message: `circular extends: ${cycle}`, file, field: "extends" });
      return agent;
    }

    if (!agent.extends && !agent.traits?.length) {
      resolved.set(agent, agent);
      return agent;
    }

    let result: T = { ...agent, role: "" };
    if (agent.extends) {
      const ref = agent.extends;
      const parent = ref.startsWith(LIBRARY_PREFIX)
        ? library.get(ref.slice(LIBRARY_PREFIX.length))
        : (local.get(ref) ?? library.get(ref));
      if (parent) result = applyParent(result, resolve(parent, [...stack, agent]));
      else errors.push({ message: `unknown parent agent "${ref}"`, file, field: "extends" });
    }
    result = applyTraits(result, agent.role, traits, errors, file);
    if (!result.description.trim()) {
      errors.push({ message: 'missing or empty required field "description"', file, field: "description" });
    }
    if (!result.role.trim()) {
      errors.push({ message: "agent body (role) is empty", file, field: "role" });
    }
    resolved.set(agent, result);
    return result;
  };

  const flatten = <T extends AnyAgent>(agents: T[]): T[] =>
    agents
      .filter((a) => !a.abstract)
      .map((a) => {
        const { extends: _parent, traits: _traits, abstract: _abstract, ...plain } = resolve(a, []);
        return plain as T;
      });

  const agents = flatten(set.agents);
  set.subagents = flatten(set.subagents);
  set.agents = agents;
}
