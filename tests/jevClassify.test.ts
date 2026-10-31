import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadIR } from "../src/schema/load.ts";
import { classifyWithJev } from "../src/jev/router.ts";
import { classifyCommand } from "../src/commands/classify.ts";

describe("Murmuration Jev Router & Classification", () => {
  const root = process.cwd();
  const murmurDir = join(root, "murmur");

  test("classifyWithJev classifies coding tasks with selected specialist", async () => {
    const loaded = await loadIR(murmurDir);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const res = await classifyWithJev("implement a new database connection pooling service", loaded.value, {
      forceMock: true,
    });

    expect(res.classification).toBe("CODING");
    expect(res.matchedAgents.length).toBeGreaterThan(0);
    expect(res.matchedAgents[0]!.score).toBeGreaterThan(0.7);
    expect(res.suggestedCommand).toContain("murmr run");
  });

  test("classifyWithJev classifies research tasks", async () => {
    const loaded = await loadIR(murmurDir);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const res = await classifyWithJev("conduct an academic literature review on LLM reasoning", loaded.value, {
      forceMock: true,
    });

    expect(res.classification).toBe("RESEARCH");
    expect(res.pipeline?.branch).toBe("research");
  });

  test("classifyCommand executes cleanly in Jev engine mode with JSON flag", async () => {
    const exitCode = await classifyCommand(root, "fix connection leak", {
      engine: "jev",
      forceMock: true,
      json: true,
    });
    expect(exitCode).toBe(0);
  });
});
