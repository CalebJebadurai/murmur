import { basename } from "node:path";
import { parseFrontmatter } from "../util/frontmatter.ts";
import { parsePipelineYaml, type YamlNode } from "../util/pipelineYaml.ts";
import type {
  DimensionDefinition,
  RubricDefinition,
  RubricQuestion,
} from "./rubric.ts";
import type { ValidationError, ValidationResult } from "./types.ts";

function stem(file: string): string {
  return basename(file).replace(/\.(md|markdown)$/i, "");
}
function isObj(n: YamlNode | undefined): n is { [k: string]: YamlNode } {
  return typeof n === "object" && n !== null && !Array.isArray(n);
}
function isArr(n: YamlNode | undefined): n is YamlNode[] {
  return Array.isArray(n);
}
function asStr(n: YamlNode | undefined): string | undefined {
  return typeof n === "string" ? n : typeof n === "number" || typeof n === "boolean" ? String(n) : undefined;
}
function asNum(n: YamlNode | undefined): number | undefined {
  return typeof n === "number" ? n : undefined;
}

export function validateRubric(
  content: string,
  file: string,
): ValidationResult<RubricDefinition> {
  const errors: ValidationError[] = [];
  const { frontmatter: fm, body } = parseFrontmatter(content);
  const description = typeof fm["description"] === "string" ? fm["description"] : "";
  if (!description.trim()) errors.push({ message: 'missing required field "description"', file, field: "description" });

  const parsed = parsePipelineYaml(body, file);
  if (!parsed.ok) {
    errors.push({ message: `PARSE-ERROR (line ${parsed.error.line}): ${parsed.error.message}`, file });
    return { ok: false, errors };
  }
  const root = parsed.value;
  if (!isObj(root)) {
    errors.push({ message: "rubric body must be a mapping with dimensions", file });
    return { ok: false, errors };
  }

  const dimensions: DimensionDefinition[] = [];
  const dnode = root["dimensions"];
  if (!isArr(dnode)) {
    errors.push({ message: 'rubric requires a "dimensions" sequence', file, field: "dimensions" });
  } else {
    for (const d of dnode) {
      if (!isObj(d)) continue;
      const label = asStr(d["label"]) ?? "";
      if (!label) {
        errors.push({ message: "a dimension is missing its label", file, field: "dimensions" });
        continue;
      }
      const classRaw = asStr(d["classification"]) ?? "MANDATORY";
      const classification = classRaw === "CONDITIONAL" ? "CONDITIONAL" : "MANDATORY";
      const scaleMax = asNum(d["scaleMax"]) ?? 5;
      const weight = asNum(d["weight"]) ?? 1;
      if (scaleMax < 1) errors.push({ message: `dimension "${label}" scaleMax must be >= 1`, file, field: "dimensions" });
      if (weight < 0) errors.push({ message: `dimension "${label}" weight must be >= 0`, file, field: "dimensions" });
      const questions: RubricQuestion[] = [];
      if (isArr(d["questions"])) {
        for (const q of d["questions"]) {
          if (typeof q === "string") questions.push({ text: q, mandatory: true });
          else if (isObj(q)) questions.push({ text: asStr(q["text"]) ?? "", mandatory: q["mandatory"] !== false });
        }
      }
      const dim: DimensionDefinition = { label, classification, questions, scaleMax, weight };
      const aw = asStr(d["appliesWhen"]);
      const nw = asStr(d["naWhen"]);
      if (aw) dim.appliesWhen = aw;
      if (nw) dim.naWhen = nw;
      dimensions.push(dim);
    }
  }

  const severityLevels = isArr(root["severityLevels"])
    ? (root["severityLevels"] as YamlNode[]).map((x) => asStr(x) ?? "").filter(Boolean)
    : ["critical", "important", "minor"];
  const readinessGate = asStr(root["readinessGate"]) ?? "all mandatory dimensions >= 4";
  const totalMax = asNum(root["totalMax"]) ?? dimensions.reduce((a, d) => a + d.scaleMax * d.weight, 0);

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: { name: stem(file), description, dimensions, severityLevels, readinessGate, totalMax },
  };
}
