import { basename } from "node:path";
import {
  asStringArray,
  parseFrontmatter,
  type Frontmatter,
} from "../util/frontmatter.ts";
import { isValidGlob } from "../util/glob.ts";
import type {
  AgentDefinition,
  InstructionDefinition,
  SkillDefinition,
  SubagentDefinition,
  ValidationError,
  ValidationResult,
} from "./index.ts";

function stem(file: string): string {
  return basename(file).replace(/\.(md|markdown)$/i, "");
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
  return { ok: true, value: { name: stem(file), applyTo, rules: body } };
}
