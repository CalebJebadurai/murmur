import { describe, expect, test } from "bun:test";
import { parsePipelineYaml, extractYamlBlock } from "../src/util/pipelineYaml.ts";

const F = "test.md";

describe("strict pipeline-YAML reader — positive", () => {
  test("parses nested maps and block sequences of scalars", () => {
    const res = parsePipelineYaml(`a: 1\nb:\n  c: hello\n  d:\n    - x\n    - y\n`, F);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual({ a: 1, b: { c: "hello", d: ["x", "y"] } });
  });

  test("parses arrays-of-maps (the shape frontmatter cannot)", () => {
    const res = parsePipelineYaml(`items:\n  - name: a\n    n: 1\n  - name: b\n    n: 2\n`, F);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual({ items: [{ name: "a", n: 1 }, { name: "b", n: 2 }] });
  });

  test("parses inline scalar arrays and pairs", () => {
    const res = parsePipelineYaml(`phases: [a, b, c]\npairs:\n  - [x, y]\n`, F);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual({ phases: ["a", "b", "c"], pairs: [["x", "y"]] });
  });

  test("booleans, ints, quoted strings", () => {
    const res = parsePipelineYaml(`flag: true\nn: -3\ns: "0b"\n`, F);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual({ flag: true, n: -3, s: "0b" });
  });

  test("extractYamlBlock pulls the fenced block out of prose", () => {
    const block = extractYamlBlock("# Title\n\nprose here\n\n```yaml\na: 1\n```\n");
    expect(block).toBe("a: 1");
  });
});

describe("strict pipeline-YAML reader — fuzz/negative (must hard-error, never mis-parse)", () => {
  const bad: [string, string][] = [
    ["tabs", "a:\n\t- x\n"],
    ["anchors", "a: &anchor 1\n"],
    ["alias", "a: *ref\n"],
    ["flow map", "a: {x: 1}\n"],
    ["tag directive", "a: !!str 1\n"],
    ["document marker", "---\na: 1\n"],
    ["odd indentation", "a:\n   b: 1\n"],
    ["nested flow", "a: [[1, 2]]\n"],
    ["key without value or block", "a:\nb: 2\n"],
  ];
  for (const [label, src] of bad) {
    test(`rejects ${label} with a precise PARSE-ERROR`, () => {
      const res = parsePipelineYaml(src, F);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error.file).toBe(F);
      expect(typeof res.error.line).toBe("number");
      expect(res.error.message.length).toBeGreaterThan(0);
    });
  }

  test("never returns a wrong shape: result is either correct parse or error", () => {
    // property-ish: a value that looks like a map but has a stray scalar line
    const res = parsePipelineYaml(`a: 1\njust a bare line\n`, F);
    expect(res.ok).toBe(false);
  });
});
