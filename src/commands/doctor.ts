import { join } from "node:path";
import { loadIR } from "../schema/load.ts";
import { isValidGlob } from "../util/glob.ts";
import type { IRSet, ValidationError } from "../schema/index.ts";

export type DoctorReport = {
  ok: boolean;
  errors: ValidationError[];
};

/** Detect circular subagent references (A dispatches B, B dispatches A). */
function findCircular(ir: IRSet): ValidationError[] {
  const errors: ValidationError[] = [];
  const edges = new Map<string, string[]>();
  for (const a of [...ir.agents, ...ir.subagents]) {
    edges.set(a.name, a.agents);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];

  const visit = (node: string): void => {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      if (!edges.has(next)) continue; // unresolved refs handled elsewhere
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) {
        const cycle = [...stack.slice(stack.indexOf(next)), next].join(" -> ");
        errors.push({
          message: `circular subagent dependency: ${cycle}`,
          file: `murmur/agents/${node}.md`,
          field: "agents",
        });
      } else if (c === WHITE) {
        visit(next);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  };

  for (const node of edges.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) visit(node);
  }
  return errors;
}

/**
 * Validate the murmur/ IR: schema correctness (via the loader), reference
 * integrity (skills/instructions/agents referenced must exist), applyTo glob
 * syntax, and circular subagent dependencies.
 */
export async function runDoctor(murmurDir: string): Promise<DoctorReport> {
  const loaded = await loadIR(murmurDir);
  if (!loaded.ok) return { ok: false, errors: loaded.errors };

  const ir = loaded.value;
  const errors: ValidationError[] = [];

  const skillNames = new Set(ir.skills.map((s) => s.name));
  const instrNames = new Set(ir.instructions.map((i) => i.name));
  const agentNames = new Set([
    ...ir.agents.map((a) => a.name),
    ...ir.subagents.map((s) => s.name),
  ]);

  const checkRefs = (
    owner: { name: string; skills: string[]; instructions: string[]; agents: string[] },
    kind: string,
  ): void => {
    const file = `murmur/${kind}/${owner.name}.md`;
    for (const s of owner.skills)
      if (!skillNames.has(s))
        errors.push({ message: `references missing skill "${s}"`, file, field: "skills" });
    for (const i of owner.instructions)
      if (!instrNames.has(i))
        errors.push({
          message: `references missing instruction "${i}"`,
          file,
          field: "instructions",
        });
    for (const a of owner.agents)
      if (!agentNames.has(a))
        errors.push({ message: `references missing agent "${a}"`, file, field: "agents" });
  };

  for (const a of ir.agents) checkRefs(a, "agents");
  for (const s of ir.subagents) checkRefs(s, "subagents");

  for (const instr of ir.instructions) {
    if (!isValidGlob(instr.applyTo)) {
      errors.push({
        message: `invalid applyTo glob "${instr.applyTo}"`,
        file: `murmur/instructions/${instr.name}.md`,
        field: "applyTo",
      });
    }
  }

  errors.push(...findCircular(ir));

  return { ok: errors.length === 0, errors };
}

/** CLI entry: run doctor on `<root>/murmur`, print results, return exit code. */
export async function doctorCommand(projectRoot: string): Promise<number> {
  const murmurDir = join(projectRoot, "murmur");
  if (!(await Bun.file(join(murmurDir, "agents")).exists().catch(() => false))) {
    // directory check via a known subpath; fall through to loader which reports cleanly
  }
  const report = await runDoctor(murmurDir);
  if (report.ok) {
    console.log("doctor: no problems found.");
    return 0;
  }
  console.error(`doctor: found ${report.errors.length} problem(s):`);
  for (const e of report.errors) {
    const field = e.field ? ` [${e.field}]` : "";
    console.error(`  ${e.file}${field}: ${e.message}`);
  }
  return 1;
}
