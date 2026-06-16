import { basename } from "node:path";
import { parseFrontmatter } from "../util/frontmatter.ts";
import { parsePipelineYaml, type YamlNode } from "../util/pipelineYaml.ts";
import {
  MAX_LOOP_ITERATIONS,
  type BranchDefinition,
  type LoopDefinition,
  type ParallelDefinition,
  type PhaseAgent,
  type PhaseDefinition,
  type PipelineDefinition,
  type RoutingDefinition,
  type TierDefinition,
} from "./pipeline.ts";
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
function asStrArr(n: YamlNode | undefined): string[] {
  if (n === undefined) return [];
  if (Array.isArray(n)) return n.map((x) => asStr(x) ?? "").filter((x) => x !== "");
  const s = asStr(n);
  return s ? [s] : [];
}
function asNum(n: YamlNode | undefined): number | undefined {
  return typeof n === "number" ? n : undefined;
}

/**
 * Validate a pipeline document: frontmatter header + strict-YAML body narrowed
 * into the typed PipelineDefinition. Surfaces schema errors (missing fields,
 * out-of-range numbers); cross-reference checks live in doctor.
 */
export function validatePipeline(
  content: string,
  file: string,
): ValidationResult<PipelineDefinition> {
  const errors: ValidationError[] = [];
  const { frontmatter: fm, body } = parseFrontmatter(content);

  const description = typeof fm["description"] === "string" ? fm["description"] : "";
  if (!description.trim()) errors.push({ message: 'missing required field "description"', file, field: "description" });
  const version = fm["version"] !== undefined ? String(fm["version"]) : "";
  if (!version.trim()) errors.push({ message: 'missing required field "version"', file, field: "version" });
  const classifications = ((): string[] => {
    const v = fm["classifications"];
    if (Array.isArray(v)) return v.map((x) => String(x));
    return [];
  })();
  if (classifications.length === 0)
    errors.push({ message: 'missing required field "classifications"', file, field: "classifications" });

  const parsed = parsePipelineYaml(body, file);
  if (!parsed.ok) {
    errors.push({ message: `PARSE-ERROR (line ${parsed.error.line}): ${parsed.error.message}`, file });
    return { ok: false, errors };
  }
  const root = parsed.value;
  if (!isObj(root)) {
    errors.push({ message: "pipeline body must be a mapping with routing and branches", file });
    return { ok: false, errors };
  }

  // routing
  const routingNode = root["routing"];
  let routing: RoutingDefinition = { at: "", map: {} };
  if (!isObj(routingNode)) {
    errors.push({ message: 'missing or malformed "routing" block', file, field: "routing" });
  } else {
    const at = asStr(routingNode["at"]) ?? "";
    const mapNode = routingNode["map"];
    const map: Record<string, string> = {};
    if (isObj(mapNode)) for (const [k, v] of Object.entries(mapNode)) map[k] = asStr(v) ?? "";
    if (!at) errors.push({ message: 'routing requires "at" (a phase id)', file, field: "routing.at" });
    if (Object.keys(map).length === 0)
      errors.push({ message: 'routing requires a non-empty "map"', file, field: "routing.map" });
    routing = { at, map };
  }

  // branches
  const branchesNode = root["branches"];
  const branches: Record<string, BranchDefinition> = {};
  if (!isObj(branchesNode)) {
    errors.push({ message: 'missing or malformed "branches" block', file, field: "branches" });
  } else {
    for (const [bname, bnode] of Object.entries(branchesNode)) {
      if (!isObj(bnode)) {
        errors.push({ message: `branch "${bname}" must be a mapping`, file, field: `branches.${bname}` });
        continue;
      }
      const phases = parsePhases(bnode["phases"], bname, file, errors);
      const loops = parseLoops(bnode["loops"], bname, file, errors);
      const parallel = parseParallel(bnode["parallel"], bname, file, errors);
      const tiers = parseTiers(bnode["tiers"], bname, file, errors);
      branches[bname] = { phases, loops, parallel, tiers };
    }
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: { name: stem(file), description, version, classifications, routing, branches },
  };
}

function parsePhases(
  node: YamlNode | undefined,
  branch: string,
  file: string,
  errors: ValidationError[],
): PhaseDefinition[] {
  const out: PhaseDefinition[] = [];
  if (!isArr(node)) {
    errors.push({ message: `branch "${branch}" requires a "phases" sequence`, file, field: `branches.${branch}.phases` });
    return out;
  }
  for (const p of node) {
    if (!isObj(p)) continue;
    const id = asStr(p["id"]) ?? "";
    if (!id) {
      errors.push({ message: `a phase in branch "${branch}" is missing "id"`, file, field: `branches.${branch}.phases` });
      continue;
    }
    const agents: PhaseAgent[] = [];
    const agentsNode = p["agents"];
    if (isArr(agentsNode)) {
      for (const a of agentsNode) {
        if (typeof a === "string") {
          agents.push({ name: a });
        } else if (isObj(a)) {
          const name = asStr(a["name"]) ?? "";
          if (!name) continue;
          const pa: PhaseAgent = { name };
          if (a["builtin"] === true) pa.builtin = true;
          if (isObj(a["dispatch"])) {
            pa.dispatch = {
              invokeWhen: asStrArr((a["dispatch"] as { [k: string]: YamlNode })["invokeWhen"]),
              skipWhen: asStrArr((a["dispatch"] as { [k: string]: YamlNode })["skipWhen"]),
            };
          }
          agents.push(pa);
        }
      }
    }
    const phase: PhaseDefinition = { id, agents };
    const label = asStr(p["label"]);
    if (label) phase.label = label;
    out.push(phase);
  }
  return out;
}

function parseLoops(
  node: YamlNode | undefined,
  branch: string,
  file: string,
  errors: ValidationError[],
): LoopDefinition[] {
  const out: LoopDefinition[] = [];
  if (node === undefined) return out;
  if (!isArr(node)) {
    errors.push({ message: `branch "${branch}" "loops" must be a sequence`, file, field: `branches.${branch}.loops` });
    return out;
  }
  for (const l of node) {
    if (!isObj(l)) continue;
    const name = asStr(l["name"]) ?? "";
    const from = asStr(l["from"]) ?? "";
    const to = asStr(l["to"]) ?? "";
    const min = asNum(l["min"]) ?? 0;
    const max = asNum(l["max"]) ?? 0;
    const earlyExit = asStr(l["earlyExit"]);
    if (!name || !from || !to) {
      errors.push({ message: `a loop in branch "${branch}" needs name/from/to`, file, field: `branches.${branch}.loops` });
      continue;
    }
    if (max < 1 || max > MAX_LOOP_ITERATIONS) {
      errors.push({
        message: `loop "${name}" max must be 1..${MAX_LOOP_ITERATIONS} (got ${max})`,
        file,
        field: `branches.${branch}.loops.${name}.max`,
      });
    }
    if (min < 0 || min > max) {
      errors.push({
        message: `loop "${name}" min must be 0..max (got ${min})`,
        file,
        field: `branches.${branch}.loops.${name}.min`,
      });
    }
    const loop: LoopDefinition = { name, from, to, min, max };
    if (earlyExit) loop.earlyExit = earlyExit;
    out.push(loop);
  }
  return out;
}

function parseParallel(
  node: YamlNode | undefined,
  branch: string,
  file: string,
  errors: ValidationError[],
): ParallelDefinition {
  const def: ParallelDefinition = { maxConcurrent: 1, neverParallel: [] };
  if (node === undefined) return def;
  if (!isObj(node)) {
    errors.push({ message: `branch "${branch}" "parallel" must be a mapping`, file, field: `branches.${branch}.parallel` });
    return def;
  }
  const mc = asNum(node["maxConcurrent"]) ?? 1;
  if (mc < 1) {
    errors.push({ message: `parallel.maxConcurrent must be >= 1 (got ${mc})`, file, field: `branches.${branch}.parallel.maxConcurrent` });
  }
  def.maxConcurrent = Math.max(1, mc);
  const np = node["neverParallel"];
  if (isArr(np)) {
    for (const pair of np) {
      if (isArr(pair) && pair.length === 2) {
        def.neverParallel.push([String(pair[0]), String(pair[1])]);
      } else {
        errors.push({ message: `neverParallel entries must be two-element pairs`, file, field: `branches.${branch}.parallel.neverParallel` });
      }
    }
  }
  if (isObj(node["perPatternCaps"])) {
    const caps: Record<string, number> = {};
    for (const [k, v] of Object.entries(node["perPatternCaps"] as { [k: string]: YamlNode })) {
      const n = asNum(v);
      if (n !== undefined) caps[k] = n;
    }
    def.perPatternCaps = caps;
  }
  return def;
}

function parseTiers(
  node: YamlNode | undefined,
  branch: string,
  file: string,
  errors: ValidationError[],
): TierDefinition[] {
  const out: TierDefinition[] = [];
  if (node === undefined) return out;
  if (!isArr(node)) {
    errors.push({ message: `branch "${branch}" "tiers" must be a sequence`, file, field: `branches.${branch}.tiers` });
    return out;
  }
  for (const t of node) {
    if (!isObj(t)) continue;
    const name = asStr(t["name"]) ?? "";
    const phases = asStrArr(t["phases"]);
    if (!name) {
      errors.push({ message: `a tier in branch "${branch}" is missing "name"`, file, field: `branches.${branch}.tiers` });
      continue;
    }
    const tier: TierDefinition = { name, phases };
    if (isObj(t["iterationOverrides"])) {
      const ov: Record<string, { min?: number; max?: number }> = {};
      for (const [k, v] of Object.entries(t["iterationOverrides"] as { [k: string]: YamlNode })) {
        if (isObj(v)) {
          const entry: { min?: number; max?: number } = {};
          const mn = asNum(v["min"]);
          const mx = asNum(v["max"]);
          if (mn !== undefined) entry.min = mn;
          if (mx !== undefined) entry.max = mx;
          ov[k] = entry;
        }
      }
      tier.iterationOverrides = ov;
    }
    out.push(tier);
  }
  return out;
}
