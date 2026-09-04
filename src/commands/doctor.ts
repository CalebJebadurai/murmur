import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { loadIR } from "../schema/load.ts";
import { isValidGlob } from "../util/glob.ts";
import type { IRSet, ValidationError } from "../schema/index.ts";

export type DoctorOptions = {
  fix?: boolean;
};

export type DoctorReport = {
  ok: boolean;
  errors: ValidationError[];
  fixed?: string[];
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
 *
 * If `opts.fix` is enabled, missing skill, instruction, and subagent references
 * are automatically scaffolded, making the IR self-healing.
 */
export async function runDoctor(
  murmurDir: string,
  opts?: DoctorOptions,
): Promise<DoctorReport> {
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

  const missingSkills = new Set<string>();
  const missingInstructions = new Set<string>();
  const missingAgents = new Set<string>();

  const checkRefs = (
    owner: { name: string; skills: string[]; instructions: string[]; agents: string[] },
    kind: string,
  ): void => {
    const file = `murmur/${kind}/${owner.name}.md`;
    for (const s of owner.skills) {
      if (!skillNames.has(s)) {
        errors.push({ message: `references missing skill "${s}"`, file, field: "skills" });
        missingSkills.add(s);
      }
    }
    for (const i of owner.instructions) {
      if (!instrNames.has(i)) {
        errors.push({
          message: `references missing instruction "${i}"`,
          file,
          field: "instructions",
        });
        missingInstructions.add(i);
      }
    }
    for (const a of owner.agents) {
      if (!agentNames.has(a)) {
        errors.push({ message: `references missing agent "${a}"`, file, field: "agents" });
        missingAgents.add(a);
      }
    }
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

  // Pipeline reference-integrity, routing, loop-cap, and tier checks.
  for (const p of ir.pipelines) {
    const file = `murmur/pipelines/${p.name}.md`;
    const branchNames = new Set(Object.keys(p.branches));
    // routing
    if (!branchNames.has("") && Object.keys(p.routing.map).length > 0) {
      for (const [label, branch] of Object.entries(p.routing.map)) {
        if (!branchNames.has(branch))
          errors.push({ message: `routing maps "${label}" to unknown branch "${branch}"`, file, field: "routing.map" });
      }
    }
    for (const [bname, branch] of Object.entries(p.branches)) {
      const phaseIds = new Set(branch.phases.map((ph) => ph.id));
      // routing.at must exist in at least one branch — check per pipeline below
      for (const phase of branch.phases) {
        for (const a of phase.agents) {
          if (a.builtin) continue;
          if (!agentNames.has(a.name)) {
            errors.push({
              message: `branch "${bname}" phase "${phase.id}" references missing agent "${a.name}"`,
              file,
              field: "phases",
            });
            missingAgents.add(a.name);
          }
        }
      }
      for (const loop of branch.loops) {
        if (!phaseIds.has(loop.from))
          errors.push({ message: `loop "${loop.name}" from unknown phase "${loop.from}" in branch "${bname}"`, file, field: "loops" });
        if (!phaseIds.has(loop.to))
          errors.push({ message: `loop "${loop.name}" to unknown phase "${loop.to}" in branch "${bname}"`, file, field: "loops" });
      }
      for (const tier of branch.tiers) {
        for (const pid of tier.phases) {
          if (!phaseIds.has(pid))
            errors.push({ message: `tier "${tier.name}" lists unknown phase "${pid}" in branch "${bname}"`, file, field: "tiers" });
        }
      }
      const allAgentNames = new Set(branch.phases.flatMap((ph) => ph.agents.map((a) => a.name)));
      for (const [x, y] of branch.parallel.neverParallel) {
        if (!allAgentNames.has(x))
          errors.push({ message: `neverParallel names "${x}" not dispatched in branch "${bname}"`, file, field: "parallel" });
        if (!allAgentNames.has(y))
          errors.push({ message: `neverParallel names "${y}" not dispatched in branch "${bname}"`, file, field: "parallel" });
      }
    }
    // routing.at must be a real phase in at least one branch
    const everyPhase = new Set(
      Object.values(p.branches).flatMap((b) => b.phases.map((ph) => ph.id)),
    );
    if (p.routing.at && !everyPhase.has(p.routing.at))
      errors.push({ message: `routing.at "${p.routing.at}" is not a declared phase`, file, field: "routing.at" });
  }

  errors.push(...findCircular(ir));

  // If self-healing is requested and we detected missing references, scaffold them
  if (opts?.fix && (missingSkills.size > 0 || missingInstructions.size > 0 || missingAgents.size > 0)) {
    const fixed: string[] = [];

    for (const s of missingSkills) {
      const dest = join(murmurDir, "skills", s, "SKILL.md");
      await mkdir(dirname(dest), { recursive: true });
      const content = `---\nname: ${s}\ndescription: "Knowledge and guidelines for ${s}."\n---\n\n# ${s}\n\nCodebase-specific knowledge and reference patterns for ${s}.\n`;
      await Bun.write(dest, content);
      fixed.push(`skills/${s}/SKILL.md`);
    }

    for (const i of missingInstructions) {
      const dest = join(murmurDir, "instructions", `${i}.md`);
      await mkdir(dirname(dest), { recursive: true });
      const content = `---\napplyTo: "**/*"\n---\n\n# ${i} Conventions\n\nScoped rules and behavioral conventions for ${i}.\n`;
      await Bun.write(dest, content);
      fixed.push(`instructions/${i}.md`);
    }

    for (const a of missingAgents) {
      const dest = join(murmurDir, "subagents", `${a}.md`);
      await mkdir(dirname(dest), { recursive: true });
      const content = `---\ndescription: "Specialist subagent for ${a}."\nspawn-trigger: "when ${a} tasks or domain problems arise"\n---\n\n# ${a}\n\nSpecialist subagent role and responsibilities for ${a}.\n`;
      await Bun.write(dest, content);
      fixed.push(`subagents/${a}.md`);
    }

    // Re-validate to verify that fixes resolved the problems
    const recheck = await runDoctor(murmurDir, { fix: false });
    return { ok: recheck.ok, errors: recheck.errors, fixed };
  }

  return { ok: errors.length === 0, errors };
}

/** CLI entry: run doctor on `<root>/murmur`, print results, return exit code. */
export async function doctorCommand(
  projectRoot: string,
  opts?: DoctorOptions,
): Promise<number> {
  const murmurDir = join(projectRoot, "murmur");
  if (!(await Bun.file(join(murmurDir, "agents")).exists().catch(() => false))) {
    // directory check via a known subpath; fall through to loader which reports cleanly
  }
  const report = await runDoctor(murmurDir, opts);
  if (report.fixed && report.fixed.length > 0) {
    console.log(`doctor: automatically fixed ${report.fixed.length} issue(s):`);
    for (const f of report.fixed) {
      console.log(`  + created murmur/${f}`);
    }
  }
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
