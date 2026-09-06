import { basename } from "node:path";
import {
  asStringArray,
  parseFrontmatter,
  type Frontmatter,
} from "../util/frontmatter.ts";
import { isValidGlob } from "../util/glob.ts";
import { extractYamlBlock, parsePipelineYaml } from "../util/pipelineYaml.ts";
import type {
  AgentDefinition,
  AgentDispatchRule,
  InstructionDefinition,
  OutputSection,
  SkillDefinition,
  SubagentDefinition,
  ValidationError,
  ValidationResult,
} from "./index.ts";

function stem(file: string): string {
  return basename(file).replace(/\.(md|markdown)$/i, "");
}

function parseDispatch(fm: Frontmatter): AgentDispatchRule | undefined {
  const rawDispatch = fm["dispatch"];
  let invokeWhen: string[] = [];
  let skipWhen: string[] = [];
  let tasks: string[] = [];

  if (rawDispatch && typeof rawDispatch === "object" && !Array.isArray(rawDispatch)) {
    const d = rawDispatch as Record<string, unknown>;
    invokeWhen = asStringArray(d["invoke-when"] ?? d["invokeWhen"]);
    skipWhen = asStringArray(d["skip-when"] ?? d["skipWhen"]);
    tasks = asStringArray(d["tasks"]);
  }

  if (fm["invoke-when"] || fm["invokeWhen"]) {
    invokeWhen = [...invokeWhen, ...asStringArray(fm["invoke-when"] ?? fm["invokeWhen"])];
  }
  if (fm["skip-when"] || fm["skipWhen"]) {
    skipWhen = [...skipWhen, ...asStringArray(fm["skip-when"] ?? fm["skipWhen"])];
  }
  if (fm["dispatch-tasks"] || fm["tasks"]) {
    tasks = [...tasks, ...asStringArray(fm["dispatch-tasks"] ?? fm["tasks"])];
  }

  if (invokeWhen.length === 0 && skipWhen.length === 0 && tasks.length === 0) {
    return undefined;
  }

  return {
    invokeWhen: Array.from(new Set(invokeWhen)),
    skipWhen: Array.from(new Set(skipWhen)),
    tasks: Array.from(new Set(tasks)),
  };
}

function requireString(
  fm: Frontmatter,
  field: string,
  file: string,
  errors: ValidationError[],
): string {
  const v = fm[field];
  if (typeof v !== "string" || v.trim() === "") {
    errors.push({ message: `missing or empty required field "${field}"`, file, field });
    return "";
  }
  return v;
}

export function validateAgent(
  content: string,
  file: string,
): ValidationResult<AgentDefinition> {
  const errors: ValidationError[] = [];
  const { frontmatter: fm, body } = parseFrontmatter(content);
  const description = requireString(fm, "description", file, errors);
  if (body.trim() === "") {
    errors.push({ message: "agent body (role) is empty", file, field: "role" });
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name: stem(file),
      description,
      role: body,
      tools: asStringArray(fm["tools"]),
      skills: asStringArray(fm["skills"]),
      instructions: asStringArray(fm["instructions"]),
      agents: asStringArray(fm["agents"]),
      model: fm["model"] !== undefined ? asStringArray(fm["model"]) : undefined,
      userInvocable:
        typeof fm["user-invocable"] === "boolean"
          ? (fm["user-invocable"] as boolean)
          : undefined,
      dispatch: parseDispatch(fm),
    },
  };
}

export function validateSubagent(
  content: string,
  file: string,
): ValidationResult<SubagentDefinition> {
  const errors: ValidationError[] = [];
  const base = validateAgent(content, file);
  const { frontmatter: fm } = parseFrontmatter(content);
  const trigger = fm["spawn-trigger"];
  if (typeof trigger !== "string" || trigger.trim() === "") {
    errors.push({
      message: 'subagent missing required "spawn-trigger"',
      file,
      field: "spawn-trigger",
    });
  }
  if (!base.ok) errors.push(...base.errors);
  if (errors.length || !base.ok) return { ok: false, errors };
  return {
    ok: true,
    value: {
      ...base.value,
      userInvocable: base.value.userInvocable ?? false,
      spawn: {
        trigger: trigger as string,
        attachSkills: asStringArray(fm["attach-skills"]),
        attachInstructions: asStringArray(fm["attach-instructions"]),
        toolPolicy: asStringArray(fm["tool-policy"]),
      },
    },
  };
}

export function validateSkill(
  content: string,
  file: string,
): ValidationResult<SkillDefinition> {
  const errors: ValidationError[] = [];
  const { frontmatter: fm, body } = parseFrontmatter(content);
  const description = requireString(fm, "description", file, errors);
  const name =
    typeof fm["name"] === "string" && fm["name"].trim() !== ""
      ? (fm["name"] as string)
      : stem(file) === "SKILL"
        ? basename(file.replace(/\/SKILL\.(md|markdown)$/i, ""))
        : stem(file);
  if (body.trim() === "") {
    errors.push({ message: "skill body is empty", file, field: "body" });
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { name, description, body } };
}

export function validateInstruction(
  content: string,
  file: string,
): ValidationResult<InstructionDefinition> {
  const errors: ValidationError[] = [];
  const { frontmatter: fm, body } = parseFrontmatter(content);
  const applyTo = requireString(fm, "applyTo", file, errors);
  if (applyTo && !isValidGlob(applyTo)) {
    errors.push({ message: `invalid applyTo glob: "${applyTo}"`, file, field: "applyTo" });
  }
  if (body.trim() === "") {
    errors.push({ message: "instruction body (rules) is empty", file, field: "rules" });
  }
  if (errors.length) return { ok: false, errors };
  const value: InstructionDefinition = { name: stem(file), applyTo, rules: body };
  const sections = parseSections(body, file, errors);
  if (errors.length) return { ok: false, errors };
  if (sections.length) value.sections = sections;
  return { ok: true, value };
}

/** Parse an optional ordered `sections:` contract from a fenced yaml block. */
function parseSections(body: string, file: string, errors: ValidationError[]): OutputSection[] {
  if (!extractYamlBlock(body)) return [];
  const parsed = parsePipelineYaml(body, file);
  if (!parsed.ok) {
    errors.push({ message: `PARSE-ERROR (line ${parsed.error.line}): ${parsed.error.message}`, file });
    return [];
  }
  const root = parsed.value;
  if (typeof root !== "object" || root === null || Array.isArray(root)) return [];
  const sNode = (root as { [k: string]: unknown })["sections"];
  if (!Array.isArray(sNode)) return [];
  const out: OutputSection[] = [];
  let order = 0;
  for (const s of sNode) {
    if (typeof s !== "object" || s === null || Array.isArray(s)) continue;
    const rec = s as { [k: string]: unknown };
    const name = typeof rec["name"] === "string" ? rec["name"] : "";
    if (!name) continue;
    const sec: OutputSection = {
      name,
      required: rec["required"] !== false,
      order: typeof rec["order"] === "number" ? rec["order"] : order,
    };
    if (typeof rec["wordTarget"] === "number") sec.wordTarget = rec["wordTarget"];
    out.push(sec);
    order++;
  }
  return out;
}

export { validatePipeline } from "./validatePipeline.ts";
export { validateRubric } from "./validateRubric.ts";
