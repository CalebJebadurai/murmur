import { describe, expect, test } from "bun:test";
import { parseFrontmatter, asStringArray } from "../src/util/frontmatter.ts";
import { emitFrontmatterDoc, emitYaml } from "../src/util/yaml.ts";

describe("frontmatter parser", () => {
  test("parses scalars, booleans, inline and block arrays", () => {
    const doc = `---
description: "Use when: testing"
user-invocable: true
tools: [read, search]
skills:
  - alpha
  - beta
---

# Body

Hello.`;
    const { frontmatter: fm, body } = parseFrontmatter(doc);
    expect(fm["description"]).toBe("Use when: testing");
    expect(fm["user-invocable"]).toBe(true);
    expect(asStringArray(fm["tools"])).toEqual(["read", "search"]);
    expect(asStringArray(fm["skills"])).toEqual(["alpha", "beta"]);
    expect(body.startsWith("# Body")).toBe(true);
  });

  test("handles missing frontmatter", () => {
    const { frontmatter, body } = parseFrontmatter("# No frontmatter\n");
    expect(Object.keys(frontmatter)).toHaveLength(0);
    expect(body).toContain("No frontmatter");
  });
});

describe("yaml round-trip", () => {
  test("emit then parse preserves a frontmatter doc", () => {
    const out = emitFrontmatterDoc(
      { description: "Use when: x", tools: ["read", "edit"], "user-invocable": false },
      "# Title\n\nbody",
    );
    const { frontmatter: fm } = parseFrontmatter(out);
    expect(fm["description"]).toBe("Use when: x");
    expect(asStringArray(fm["tools"])).toEqual(["read", "edit"]);
    expect(fm["user-invocable"]).toBe(false);
  });

  test("emits nested maps and arrays of maps (goose recipe shape)", () => {
    const yaml = emitYaml({
      version: "1.0.0",
      title: "demo",
      sub_recipes: [
        { name: "a", path: "recipes/a.yaml" },
        { name: "b", path: "recipes/b.yaml" },
      ],
      settings: { goose_model: "sonnet" },
    });
    expect(yaml).toContain("version: 1.0.0");
    expect(yaml).toContain("sub_recipes:");
    expect(yaml).toContain("- name: a");
    expect(yaml).toContain("settings:");
    expect(yaml).toContain("  goose_model: sonnet");
  });
});
