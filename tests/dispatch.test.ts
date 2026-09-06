import { describe, expect, test } from "bun:test";
import { validateAgent, validateSubagent } from "../src/schema/validate.ts";

describe("Agent dispatch schema validation", () => {
  test("parses nested dispatch block with invoke-when, skip-when, and tasks", () => {
    const raw = `---
description: "Use when: reviewing data methodology and statistical rigor."
tools: [read, search]
skills: []
instructions: []
agents: []
dispatch:
  invoke-when:
    - "statistical claims are evaluated"
    - "data science methodology is reviewed"
  skip-when:
    - "pure documentation or markdown formatting"
  tasks: [data, ml, statistics]
---

# Data Critic — Statistical Reviewer

Generic data critic.
`;
    const res = validateAgent(raw, "murmur/agents/data-critic.md");
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.dispatch).toBeDefined();
    expect(res.value.dispatch?.invokeWhen).toEqual([
      "statistical claims are evaluated",
      "data science methodology is reviewed",
    ]);
    expect(res.value.dispatch?.skipWhen).toEqual([
      "pure documentation or markdown formatting",
    ]);
    expect(res.value.dispatch?.tasks).toEqual(["data", "ml", "statistics"]);
  });

  test("parses flat invoke-when and skip-when keys", () => {
    const raw = `---
description: "Use when: analyzing accessibility and social welfare."
invoke-when:
  - "accessibility or WCAG compliance is evaluated"
skip-when:
  - "internal compiler optimization"
tasks: [accessibility, ethics]
---

# Social Critic

Evaluates social equity and accessibility.
`;
    const res = validateAgent(raw, "murmur/agents/social-critic.md");
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.dispatch).toBeDefined();
    expect(res.value.dispatch?.invokeWhen).toEqual([
      "accessibility or WCAG compliance is evaluated",
    ]);
    expect(res.value.dispatch?.skipWhen).toEqual([
      "internal compiler optimization",
    ]);
    expect(res.value.dispatch?.tasks).toEqual(["accessibility", "ethics"]);
  });

  test("returns undefined dispatch when no dispatch fields are specified", () => {
    const raw = `---
description: "Use when: simple agent."
---

# Simple Agent

Generic agent.
`;
    const res = validateAgent(raw, "murmur/agents/simple.md");
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.dispatch).toBeUndefined();
  });

  test("subagents correctly inherit and parse dispatch rules", () => {
    const raw = `---
description: "Use when: specialist is required."
spawn-trigger: "when specialist is needed"
dispatch:
  invoke-when: ["specialist task"]
  skip-when: ["general task"]
  tasks: [specialist]
---

# Specialist

Specialist subagent.
`;
    const res = validateSubagent(raw, "murmur/subagents/specialist.md");
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.dispatch).toBeDefined();
    expect(res.value.dispatch?.invokeWhen).toEqual(["specialist task"]);
    expect(res.value.dispatch?.skipWhen).toEqual(["general task"]);
    expect(res.value.dispatch?.tasks).toEqual(["specialist"]);
  });
});
