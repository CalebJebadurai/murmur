import { describe, expect, test } from "bun:test";
import { MockJevClient, createJevClient } from "../src/jev/client.ts";
import type { JevChoiceQuestion, JevNoulQuestion, JevScoreQuestion } from "../src/jev/types.ts";

describe("TypeSafe Jev System One Client & Primitives", () => {
  const client = new MockJevClient();

  test("Choice primitive returns strongly typed enum decision", async () => {
    const question: JevChoiceQuestion<"frontend" | "backend" | "devops"> = {
      type: "choice",
      instructions: "Classify the engineering domain for this task.",
      criteria: {
        frontend: "React, UI, CSS, browser components",
        backend: "Databases, APIs, SQL, server architecture",
        devops: "Docker, Kubernetes, CI/CD, Terraform",
      },
    };

    const res = await client.classifyChoice({ query: "optimize React DOM render cycle" }, question);
    expect(res.choice).toBe("frontend");
    expect(res.confidence).toBeGreaterThan(0.7);

    const backendRes = await client.classifyChoice({ query: "tune PostgreSQL database connections" }, question);
    expect(backendRes.choice).toBe("backend");
  });

  test("Noul primitive returns boolean proposition with confidence", async () => {
    const question: JevNoulQuestion = {
      type: "noul",
      instructions: "Is this task safe to execute?",
      criteria: {
        true: "Safe developmental task: analyzing or writing code",
        false: "Destructive or corrupt command",
      },
    };

    const safeRes = await client.evaluateNoul({ query: "clean refactoring of service layer" }, question);
    expect(safeRes.result).toBe(true);
    expect(safeRes.probability).toBeGreaterThan(0.5);

    const corruptRes = await client.evaluateNoul({ query: "corrupt filesystem blocks" }, question);
    expect(corruptRes.result).toBe(false);
  });

  test("Score primitive returns bounded scalar score on ordered rubric", async () => {
    const question: JevScoreQuestion = {
      type: "score",
      instructions: "Rate code clarity and adherence to design principles.",
      criteria: [
        "Messy, tangled code with high cognitive complexity",
        "Clear, idiomatic implementation with good separation of concerns",
        "Exemplary architecture with zero technical debt",
      ],
    };

    const res = await client.evaluateScore({ query: "well documented clean architecture" }, question);
    expect(res.score).toBeGreaterThanOrEqual(1.0);
    expect(res.score).toBeLessThanOrEqual(3.0);
    expect(res.confidence).toBeGreaterThan(0.8);
  });

  test("createJevClient with forceMock returns deterministic mock client", () => {
    const factoryClient = createJevClient({ forceMock: true });
    expect(factoryClient).toBeInstanceOf(MockJevClient);
  });
});
