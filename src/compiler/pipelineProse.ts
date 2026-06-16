import type { BranchDefinition, PipelineDefinition } from "../schema/index.ts";

/** The union of every non-builtin agent referenced across all branches/phases. */
export function pipelineRoster(p: PipelineDefinition): string[] {
  const set = new Set<string>();
  for (const branch of Object.values(p.branches)) {
    for (const phase of branch.phases) {
      for (const a of phase.agents) if (!a.builtin) set.add(a.name);
    }
  }
  return [...set].sort();
}

function phaseTable(branch: BranchDefinition): string {
  const rows = branch.phases.map((ph) => {
    const agents = ph.agents.map((a) => a.name + (a.builtin ? " (builtin)" : "")).join(", ");
    return `| ${ph.id} | ${ph.label ?? ""} | ${agents} |`;
  });
  return ["| Phase | Label | Agents |", "|---|---|---|", ...rows].join("\n");
}

function loopTable(branch: BranchDefinition): string {
  if (!branch.loops.length) return "_No refinement loops._";
  const rows = branch.loops.map(
    (l) => `| ${l.name} | ${l.from} | ${l.to} | ${l.min} | ${l.max} | ${l.earlyExit ?? ""} |`,
  );
  return ["| Loop | From | To | Min | Max | Early exit |", "|---|---|---|---|---|---|", ...rows].join("\n");
}

function parallelBlock(branch: BranchDefinition): string {
  const np = branch.parallel.neverParallel.map(([a, b]) => `\`${a}\` ✕ \`${b}\``).join(", ") || "none";
  return `- **Max concurrent:** ${branch.parallel.maxConcurrent}\n- **Never parallel:** ${np}`;
}

function tierTable(branch: BranchDefinition): string {
  if (!branch.tiers.length) return "_No tiers._";
  const rows = branch.tiers.map((t) => `| ${t.name} | ${t.phases.join(" → ")} |`);
  return ["| Tier | Phase sequence |", "|---|---|", ...rows].join("\n");
}

/**
 * Render a pipeline as advisory prose tables (one section per branch). The caps
 * and loops are ADVISORY here — a host model interprets them; only `murmr run`'s
 * own worker pool enforces them.
 */
export function renderPipelineProse(p: PipelineDefinition): string {
  const lines: string[] = [
    `# ${p.name} — Orchestration Pipeline`,
    "",
    `> ${p.description}`,
    "",
    "> **Note:** The phase, loop, and parallelism tables below are **advisory** —",
    "> a host model interprets them. Deterministic enforcement of loop and",
    "> concurrency caps happens only under `murmr run`.",
    "",
    "## Routing",
    "",
    `Classification occurs at phase **${p.routing.at}**:`,
    "",
    ...Object.entries(p.routing.map).map(([label, branch]) => `- \`${label}\` → **${branch}** branch`),
  ];
  for (const [bname, branch] of Object.entries(p.branches)) {
    lines.push(
      "",
      `## Branch: ${bname}`,
      "",
      "### Phases",
      "",
      phaseTable(branch),
      "",
      "### Refinement loops",
      "",
      loopTable(branch),
      "",
      "### Parallelism (advisory)",
      "",
      parallelBlock(branch),
      "",
      "### Tiers",
      "",
      tierTable(branch),
    );
  }
  return lines.join("\n");
}
