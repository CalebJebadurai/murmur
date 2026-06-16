import { join } from "node:path";
import { existsSync } from "node:fs";
import { loadIR } from "../schema/load.ts";
import type { RubricDefinition } from "../schema/index.ts";

export type ScoreOptions = {
  document: string;
  rubric: string;
  out?: string;
};

export type DimensionScore = {
  label: string;
  score: number | null; // null = N/A (excluded from denominator)
  weight: number;
  scaleMax: number;
};

export type RubricScore = {
  rubric: string;
  dimensions: DimensionScore[];
  earned: number;
  max: number;
  severityCounts: Record<string, number>;
  pass: boolean;
};

/**
 * Parse per-dimension scores from a document. The documented contract is one line
 * per dimension: `SCORE: <dimension label> = <n>` (or `= N/A`). This is pure
 * extraction of numbers the host already assigned — never prose interpretation.
 */
export function parseDocumentScores(text: string): Map<string, number | null> {
  const out = new Map<string, number | null>();
  const re = /^\s*SCORE:\s*(.+?)\s*=\s*(N\/A|-?\d+(?:\.\d+)?)\s*$/gim;
  for (const m of text.matchAll(re)) {
    const label = m[1]!.trim();
    const raw = m[2]!;
    out.set(label.toLowerCase(), raw.toUpperCase() === "N/A" ? null : Number(raw));
  }
  return out;
}

/** Compute a single rubric's weighted score from parsed document scores. */
export function scoreRubric(
  rubric: RubricDefinition,
  scores: Map<string, number | null>,
): RubricScore {
  const dims: DimensionScore[] = [];
  let earned = 0;
  let max = 0;
  for (const d of rubric.dimensions) {
    const provided = scores.get(d.label.toLowerCase());
    // CONDITIONAL dimensions with no score (or explicit N/A) are excluded.
    const isNA = provided === null || (provided === undefined && d.classification === "CONDITIONAL");
    if (isNA) {
      dims.push({ label: d.label, score: null, weight: d.weight, scaleMax: d.scaleMax });
      continue;
    }
    const s = provided ?? 0;
    dims.push({ label: d.label, score: s, weight: d.weight, scaleMax: d.scaleMax });
    earned += s * d.weight;
    max += d.scaleMax * d.weight;
  }
  // Readiness gate: "all mandatory dimensions >= N" (default N=4).
  const gateN = Number(rubric.readinessGate.match(/>=\s*(\d+)/)?.[1] ?? 4);
  const pass = rubric.dimensions.every((d) => {
    if (d.classification !== "MANDATORY") return true;
    const s = scores.get(d.label.toLowerCase());
    return typeof s === "number" && s >= gateN;
  });
  const severityCounts: Record<string, number> = {};
  for (const dim of dims) {
    if (dim.score !== null && dim.score < gateN) {
      const sev = dim.score <= 1 ? "critical" : dim.score <= 2 ? "important" : "minor";
      severityCounts[sev] = (severityCounts[sev] ?? 0) + 1;
    }
  }
  return { rubric: rubric.name, dimensions: dims, earned, max, severityCounts, pass };
}

/** `murmur score <document> --rubric <name>` — deterministic arithmetic. */
export async function scoreCommand(projectRoot: string, opts: ScoreOptions): Promise<number> {
  const murmurDir = join(projectRoot, "murmur");
  if (!existsSync(join(murmurDir, "rubrics"))) {
    console.error('No murmur/rubrics/ directory found. Add a rubric first.');
    return 1;
  }
  const loaded = await loadIR(murmurDir);
  if (!loaded.ok) {
    console.error("IR has validation errors; run `murmur doctor`.");
    return 1;
  }
  const rubric = loaded.value.rubrics.find((r) => r.name === opts.rubric);
  if (!rubric) {
    const avail = loaded.value.rubrics.map((r) => r.name).join(", ") || "(none)";
    console.error(`Unknown rubric "${opts.rubric}". Available: ${avail}.`);
    return 1;
  }
  const docPath = join(projectRoot, opts.document);
  if (!existsSync(docPath)) {
    console.error(`Document not found: ${opts.document}`);
    return 1;
  }
  const scores = parseDocumentScores(await Bun.file(docPath).text());
  if (scores.size === 0) {
    console.log(`score: no machine-readable SCORE: lines found in ${opts.document} — unscored.`);
    return 0;
  }
  const result = scoreRubric(rubric, scores);
  console.log(`score: ${opts.document} against rubric "${rubric.name}"`);
  console.log(`  total: ${result.earned} / ${result.max}`);
  const sev = Object.entries(result.severityCounts).map(([k, v]) => `${v} ${k}`).join(", ") || "none";
  console.log(`  below-gate: ${sev}`);
  console.log(`  readiness: ${result.pass ? "PASS" : "FAIL"} (${rubric.readinessGate})`);
  return 0;
}
