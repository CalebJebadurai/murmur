import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { validatePipeline } from "../src/schema/validate.ts";
import { loadIR } from "../src/schema/load.ts";
import { runDoctor } from "../src/commands/doctor.ts";

const MURMUR_DIR = join(import.meta.dir, "..", "murmur");
const FIXTURE = join(MURMUR_DIR, "pipelines", "architect.md");

async function fixtureContent(): Promise<string> {
  return Bun.file(FIXTURE).text();
}

describe("validatePipeline — dual-branch fixture", () => {
  test("loads both CODING and RESEARCH branches with routing, loops, tiers", async () => {
    const res = validatePipeline(await fixtureContent(), FIXTURE);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const p = res.value;
    expect(p.classifications).toEqual(["CODING", "RESEARCH", "HYBRID"]);
    expect(p.routing.at).toBe("0b");
    expect(p.routing.map["CODING"]).toBe("coding");
    expect(Object.keys(p.branches).sort()).toEqual(["coding", "research"]);
    const coding = p.branches["coding"]!;
    expect(coding.phases.map((ph) => ph.id)).toContain("5c");
    expect(coding.loops[0]!.max).toBe(3);
    expect(coding.parallel.neverParallel).toContainEqual(["critic", "planner"]);
    expect(coding.tiers.map((t) => t.name)).toEqual(["lightweight", "standard", "extended"]);
    const research = p.branches["research"]!;
    expect(research.phases.map((ph) => ph.id)).toContain("R5b");
    expect(research.loops[0]!.max).toBe(2);
  });
});

describe("runDoctor — pipeline integrity", () => {
  test("accepts the valid base IR including the pipeline", async () => {
    const report = await runDoctor(MURMUR_DIR);
    if (!report.ok) console.error(report.errors);
    expect(report.ok).toBe(true);
  });
});

describe("validatePipeline — malformed variants each error precisely", () => {
  const header = `---\ndescription: "x"\nversion: "1.0.0"\nclassifications: [CODING]\n---\n\n`;
  const wrap = (yaml: string): string => `${header}\`\`\`yaml\n${yaml}\n\`\`\`\n`;

  test("loop max of 4 exceeds the hard cap", () => {
    const yaml = `routing:\n  at: "1"\n  map:\n    CODING: c\nbranches:\n  c:\n    phases:\n      - id: "1"\n        agents:\n          - name: critic\n    loops:\n      - name: l\n        from: "1"\n        to: "1"\n        min: 1\n        max: 4\n    parallel:\n      maxConcurrent: 1\n      neverParallel: []\n    tiers: []`;
    const res = validatePipeline(wrap(yaml), "p.md");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.some((e) => e.message.includes("max must be"))).toBe(true);
  });

  test("missing classifications fails", () => {
    const noClass = `---\ndescription: "x"\nversion: "1.0.0"\n---\n\n\`\`\`yaml\nrouting:\n  at: "1"\n  map:\n    CODING: c\nbranches:\n  c:\n    phases:\n      - id: "1"\n        agents:\n          - name: critic\n    parallel:\n      maxConcurrent: 1\n      neverParallel: []\n    tiers: []\n\`\`\`\n`;
    const res = validatePipeline(noClass, "p.md");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.some((e) => e.field === "classifications")).toBe(true);
  });

  test("a syntactically broken body yields a PARSE-ERROR", () => {
    const res = validatePipeline(wrap("routing:\n\t at: x"), "p.md");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.some((e) => e.message.includes("PARSE-ERROR"))).toBe(true);
  });
});
