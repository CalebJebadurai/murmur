import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { validateRubric } from "../src/schema/validate.ts";
import { validateInstruction } from "../src/schema/validate.ts";
import {
  parseDocumentScores,
  scoreRubric,
} from "../src/commands/score.ts";
import type { RubricDefinition } from "../src/schema/index.ts";

const MURMUR_DIR = join(import.meta.dir, "..", "murmur");

const RUBRIC_DOC = (extra = ""): string => `---
description: test rubric
---

\`\`\`yaml
dimensions:
  - label: Security
    classification: MANDATORY
    scaleMax: 5
    weight: 1
  - label: Codebase Alignment
    classification: CONDITIONAL
    scaleMax: 5
    weight: 1
${extra}severityLevels: [critical, important, minor]
readinessGate: all mandatory dimensions >= 4
totalMax: 10
\`\`\`
`;

describe("validateRubric", () => {
  test("loads the base technical scorecard", async () => {
    const content = await Bun.file(join(MURMUR_DIR, "rubrics", "technical-scorecard.md")).text();
    const res = validateRubric(content, "technical-scorecard.md");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.dimensions.length).toBeGreaterThanOrEqual(9);
    expect(res.value.dimensions.some((d) => d.classification === "CONDITIONAL")).toBe(true);
  });
});

describe("scoreRubric — arithmetic only, conditional dimensions excluded", () => {
  function rubric(): RubricDefinition {
    const res = validateRubric(RUBRIC_DOC(), "r.md");
    if (!res.ok) throw new Error("rubric invalid");
    return res.value;
  }

  test("excludes a conditional N/A dimension from the denominator", () => {
    // Security=5; Codebase Alignment omitted (CONDITIONAL → N/A)
    const scores = parseDocumentScores("SCORE: Security = 5\n");
    const r = scoreRubric(rubric(), scores);
    expect(r.earned).toBe(5);
    expect(r.max).toBe(5); // denominator floats: only Security counted
    expect(r.pass).toBe(true);
  });

  test("includes a conditional dimension when scored", () => {
    const scores = parseDocumentScores("SCORE: Security = 4\nSCORE: Codebase Alignment = 3\n");
    const r = scoreRubric(rubric(), scores);
    expect(r.earned).toBe(7);
    expect(r.max).toBe(10);
  });

  test("fails the readiness gate when a mandatory dimension is below threshold", () => {
    const scores = parseDocumentScores("SCORE: Security = 2\n");
    const r = scoreRubric(rubric(), scores);
    expect(r.pass).toBe(false);
    expect(r.severityCounts["important"]).toBe(1);
  });

  test("parseDocumentScores ignores prose, reads only SCORE: lines", () => {
    const scores = parseDocumentScores("Security is great, maybe 9.\nSCORE: Security = 4\n");
    expect(scores.get("security")).toBe(4);
    expect(scores.size).toBe(1);
  });
});

describe("multi-rubric weighted aggregation (technical/business/social)", () => {
  test("combines weighted totals with a floating denominator", () => {
    // Simulate three rubrics' subtotals and aggregate as the architect RUN-LOG does.
    const technical = { earned: 41, max: 55, weight: 1 };
    const business = { earned: 32, max: 40, weight: 1 };
    const social = { earned: 32, max: 40, weight: 1, included: true };
    const members = [technical, business, social].filter((m) => !("included" in m) || m.included);
    const combinedEarned = members.reduce((a, m) => a + m.earned * m.weight, 0);
    const combinedMax = members.reduce((a, m) => a + m.max * m.weight, 0);
    expect(combinedEarned).toBe(105);
    expect(combinedMax).toBe(135);
    // social N/A → denominator floats to 95
    const without = [technical, business];
    expect(without.reduce((a, m) => a + m.max, 0)).toBe(95);
  });
});

describe("output-section contract", () => {
  test("an instruction with a sections block parses the ordered contract", () => {
    const instr = `---
applyTo: "**/*.md"
---

Documents must follow this section order.

\`\`\`yaml
sections:
  - name: Summary
    required: true
    order: 1
  - name: Details
    required: true
    order: 2
\`\`\`
`;
    const res = validateInstruction(instr, "out.md");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.sections?.length).toBe(2);
    expect(res.value.sections?.[0]!.name).toBe("Summary");
  });

  test("an instruction without sections still validates (backward compatible)", () => {
    const instr = `---\napplyTo: "**/*.ts"\n---\n\nJust rules, no sections.\n`;
    const res = validateInstruction(instr, "x.md");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.sections).toBeUndefined();
  });
});
