import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadIR } from "../schema/load.ts";
import { runDoctor } from "../commands/doctor.ts";
import type { IRSet } from "../schema/index.ts";
import {
  loadExperienceCascade,
  formatExperiencePrompt,
  recordExperienceLesson,
} from "./experience.ts";
import type {
  EvolveOptions,
  EvolutionResult,
  HarnessCandidate,
  ProbeTrace,
} from "./types.ts";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/**
 * 1. PROPOSE STEP: Generates candidate harness modifications (skills, instructions, subagents)
 * targeting the missing domain capabilities of the task, informed by cascading experience.
 */
export function proposeCandidates(
  task: string,
  ir: IRSet,
  k = 3,
  experienceContext?: string,
): HarnessCandidate[] {
  const taskSlug = slugify(task) || "custom-task";
  const candidates: HarnessCandidate[] = [];

  // Candidate A: Domain-Specific Skill
  const skillName = `skill-${taskSlug}`;
  const skillContent = `---
name: ${skillName}
description: "Autonomous procedural skill synthesized by Harness² for: ${task.replace(/"/g, '\\"')}"
---

# ${skillName}

Synthesized by Murmuration Harness² Engine to resolve:
> "${task}"

## Key Procedures & Operational Instructions
1. Analyze the domain constraints and dependencies for "${task}".
2. Follow verified idiomatic patterns; maintain zero-plaintext credential rules.
3. Execute validation steps and verify outcomes against target specifications.
`;
  candidates.push({
    id: "candidate-skill",
    kind: "skill",
    targetName: skillName,
    action: "create",
    content: skillContent,
    rationale: `Synthesize a domain-specific skill containing repeatable procedures for "${task}"`,
  });

  // Candidate B: Scoped Behavioral Instruction
  const instrName = `rule-${taskSlug}`;
  const instrContent = `---
name: ${instrName}
applyTo: "**"
description: "Scoped operational constraint synthesized by Harness² for: ${task.replace(/"/g, '\\"')}"
---

# Constraint: ${instrName}

Synthesized by Murmuration Harness² Engine:
- When executing tasks involving "${task}", ensure all changes adhere strictly to project conventions.
- Do not commit unverified dependencies or bypass linting gates.
`;
  candidates.push({
    id: "candidate-instruction",
    kind: "instruction",
    targetName: instrName,
    action: "create",
    content: instrContent,
    rationale: `Synthesize a scoped guardrail instruction to enforce invariants for "${task}"`,
  });

  // Candidate C: Specialist Subagent
  const subagentName = `agent-${taskSlug}`;
  const subContent = `---
name: ${subagentName}
description: "Specialist subagent synthesized by Harness² to address: ${task.replace(/"/g, '\\"')}"
mainAgent: false
subagent: true
---

# Specialist: ${subagentName}

Focused role synthesized by Murmuration Harness² Engine.
Dedicated execution agent for:
> "${task}"
`;
  candidates.push({
    id: "candidate-subagent",
    kind: "subagent",
    targetName: subagentName,
    action: "create",
    content: subContent,
    rationale: `Synthesize an isolated-context specialist subagent dedicated to "${task}"`,
  });

  return candidates.slice(0, Math.max(1, k));
}

/**
 * 2. PROBE STEP: Structural checks only. Candidates are never executed, so the score says
 * a candidate is well formed, not that it improves agent behavior.
 */
export async function probeCandidate(
  candidate: HarnessCandidate,
  task: string,
): Promise<ProbeTrace> {
  const checks = [
    candidate.content.startsWith("---\n") && candidate.content.includes("\n---\n"),
    /^(name|applyTo):/m.test(candidate.content),
    candidate.content.length > 50,
    candidate.content.includes(task),
  ];
  const passed = checks.filter(Boolean).length;
  const score = passed / checks.length;

  return {
    candidateId: candidate.id,
    success: passed === checks.length,
    score,
    outputSummary: `Structural checks for candidate ${candidate.id} (${candidate.kind}): ${passed}/${checks.length} passed. Behavior not tested.`,
  };
}

/**
 * 3. COMPOSE STEP: Contrasts probe results, chooses the optimal harness edit,
 * writes it to the target Murmur IR directory, and records lessons in EXPERIENCE.md.
 */
export async function composeHarness(
  task: string,
  candidates: HarnessCandidate[],
  probes: ProbeTrace[],
  murmurDir: string,
  dryRun = false,
): Promise<{ selectedCandidate: HarnessCandidate; writtenPath?: string; experience: string }> {
  // Pick the highest structural score; ties keep the earliest candidate.
  let bestProbe = probes[0]!;
  for (const p of probes) {
    if ((p.score ?? 0) > (bestProbe.score ?? 0)) {
      bestProbe = p;
    }
  }

  const selectedCandidate = candidates.find((c) => c.id === bestProbe.candidateId) ?? candidates[0]!;

  let writtenPath: string | undefined;

  if (!dryRun) {
    if (selectedCandidate.kind === "skill") {
      const skillDir = join(murmurDir, "skills", selectedCandidate.targetName);
      await mkdir(skillDir, { recursive: true });
      writtenPath = join(skillDir, "SKILL.md");
      await writeFile(writtenPath, selectedCandidate.content, "utf8");
    } else if (selectedCandidate.kind === "instruction") {
      const instrDir = join(murmurDir, "instructions");
      await mkdir(instrDir, { recursive: true });
      writtenPath = join(instrDir, `${selectedCandidate.targetName}.md`);
      await writeFile(writtenPath, selectedCandidate.content, "utf8");
    } else if (selectedCandidate.kind === "subagent") {
      const subDir = join(murmurDir, "subagents");
      await mkdir(subDir, { recursive: true });
      writtenPath = join(subDir, `${selectedCandidate.targetName}.md`);
      await writeFile(writtenPath, selectedCandidate.content, "utf8");
    }

    // Harnessing-level recursion: Update EXPERIENCE.md via 3-tier cascade
    const projectRoot = murmurDir.endsWith("/murmur") ? murmurDir.slice(0, -7) : murmurDir;
    await recordExperienceLesson(
      "project",
      task,
      {
        candidate: `${selectedCandidate.kind}:${selectedCandidate.targetName}`,
        score: bestProbe.score ?? 1.0,
        lesson: "Added a template candidate that passed structural checks. Its effect on agent behavior was not tested.",
      },
      projectRoot,
    );
  }

  const experience = `Adopted ${selectedCandidate.kind} "${selectedCandidate.targetName}" after structural checks (score: ${bestProbe.score?.toFixed(2)}); behavior not tested`;

  return {
    selectedCandidate,
    writtenPath,
    experience,
  };
}

/**
 * Full execution: Propose -> Probe -> Compose -> Doctor
 */
export async function evolveTask(
  task: string,
  projectRoot: string,
  opts?: EvolveOptions,
): Promise<EvolutionResult> {
  const murmurDir = join(projectRoot, "murmur");
  const loaded = await loadIR(murmurDir);
  if (!loaded.ok) {
    throw new Error("Cannot evolve harness: Murmur IR has validation errors. Run `murmr doctor` first.");
  }

  const cascade = await loadExperienceCascade(projectRoot);
  const expPrompt = formatExperiencePrompt(cascade);

  const k = opts?.k ?? 3;
  // 1. Propose with 3-tier experience cascade context
  const proposed = proposeCandidates(task, loaded.value, k, expPrompt);
  const candidates = opts?.targetKind
    ? proposed.filter((c) => c.kind === opts.targetKind)
    : proposed;
  if (candidates.length === 0) {
    throw new Error(`No candidate of kind "${opts?.targetKind}" within k=${k}. Raise --k.`);
  }

  // 2. Probe
  const probes: ProbeTrace[] = [];
  for (const c of candidates) {
    const probe = await probeCandidate(c, task);
    probes.push(probe);
  }

  // 3. Compose
  const { selectedCandidate, writtenPath, experience } = await composeHarness(
    task,
    candidates,
    probes,
    murmurDir,
    opts?.dryRun ?? false,
  );

  // 4. Validate IR with doctor
  let doctorPassed = true;
  if (!opts?.dryRun) {
    const docReport = await runDoctor(murmurDir);
    doctorPassed = docReport.ok;
  }

  return {
    task,
    candidatesProposed: candidates.length,
    probesRun: probes.length,
    selectedCandidate,
    composedFilePath: writtenPath,
    experienceSummary: experience,
    doctorPassed,
  };
}
