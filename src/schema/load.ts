import { Glob } from "bun";
import { join } from "node:path";
import type {
  IRSet,
  ValidationError,
  ValidationResult,
} from "./index.ts";
import {
  validateAgent,
  validateInstruction,
  validateSkill,
  validateSubagent,
} from "./validate.ts";

export type LoadResult = ValidationResult<IRSet>;

async function readFiles(dir: string, pattern: string): Promise<string[]> {
  const out: string[] = [];
  const glob = new Glob(pattern);
  for await (const rel of glob.scan({ cwd: dir, onlyFiles: true })) {
    out.push(join(dir, rel));
  }
  return out.sort();
}

/**
 * Load and validate a murmur/ IR directory into an IRSet.
 * Returns aggregated validation errors if any file is malformed.
 */
export async function loadIR(murmurDir: string): Promise<LoadResult> {
  const errors: ValidationError[] = [];
  const set: IRSet = { agents: [], subagents: [], skills: [], instructions: [] };

  const agentFiles = await readFiles(join(murmurDir, "agents"), "*.md");
  for (const f of agentFiles) {
    const res = validateAgent(await Bun.file(f).text(), f);
    if (res.ok) set.agents.push(res.value);
    else errors.push(...res.errors);
  }

  const subFiles = await readFiles(join(murmurDir, "subagents"), "*.md");
  for (const f of subFiles) {
    const res = validateSubagent(await Bun.file(f).text(), f);
    if (res.ok) set.subagents.push(res.value);
    else errors.push(...res.errors);
  }

  // skills: support both flat skills/<name>.md and skills/<name>/SKILL.md
  const skillFiles = [
    ...(await readFiles(join(murmurDir, "skills"), "*.md")),
    ...(await readFiles(join(murmurDir, "skills"), "*/SKILL.md")),
  ].sort();
  for (const f of skillFiles) {
    const res = validateSkill(await Bun.file(f).text(), f);
    if (res.ok) set.skills.push(res.value);
    else errors.push(...res.errors);
  }

  const instrFiles = await readFiles(join(murmurDir, "instructions"), "*.md");
  for (const f of instrFiles) {
    const res = validateInstruction(await Bun.file(f).text(), f);
    if (res.ok) set.instructions.push(res.value);
    else errors.push(...res.errors);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: set };
}
