import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadIR } from "../src/schema/load.ts";
import { classifyTask } from "../src/commands/classify.ts";

const BASE_MURMUR = join(import.meta.dir, "..", "murmur");

describe("task classifier", () => {
  test("classifies a software engineering task as CODING", async () => {
    const loaded = await loadIR(BASE_MURMUR);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const result = classifyTask(
      "refactor database query pipeline and write test coverage",
      loaded.value,
    );

    expect(result.classification).toBe("CODING");
    expect(result.pipeline).toBeDefined();
    expect(result.pipeline?.branch).toBe("coding");
    expect(result.suggestedCommand).toContain("branch coding");
    expect(result.matchedAgents.length).toBeGreaterThan(0);
    const agentNames = result.matchedAgents.map((a) => a.name);
    expect(
      agentNames.includes("analyst") ||
        agentNames.includes("implementer") ||
        agentNames.includes("critic"),
    ).toBe(true);
  });

  test("classifies an academic/market task as RESEARCH", async () => {
    const loaded = await loadIR(BASE_MURMUR);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const result = classifyTask(
      "conduct literature review and academic market analysis for clean energy",
      loaded.value,
    );

    expect(result.classification).toBe("RESEARCH");
    expect(result.pipeline).toBeDefined();
    expect(result.pipeline?.branch).toBe("research");
    expect(result.suggestedCommand).toContain("branch research");
    const agentNames = result.matchedAgents.map((a) => a.name);
    expect(
      agentNames.includes("researcher") ||
        agentNames.includes("research-critic") ||
        agentNames.includes("analyst"),
    ).toBe(true);
  });

  test("returns valid matched agent scores between 0 and 1", async () => {
    const loaded = await loadIR(BASE_MURMUR);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const result = classifyTask("debug compiler build failure", loaded.value);
    for (const a of result.matchedAgents) {
      expect(a.score).toBeGreaterThan(0);
      expect(a.score).toBeLessThanOrEqual(1.0);
      expect(a.description).toBeDefined();
    }
  });

  test("classifyCommand runs cleanly and supports JSON mode", async () => {
    const { classifyCommand } = await import("../src/commands/classify.ts");
    const projectRoot = join(import.meta.dir, "..");
    const exitCode = await classifyCommand(
      projectRoot,
      "investigate performance bottleneck and fix it",
      { json: true },
    );
    expect(exitCode).toBe(0);
  });
});
