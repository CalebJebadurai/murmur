import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { scrubText } from "../src/publish/scrub.ts";
import { scanSecrets, shannonEntropy } from "../src/publish/secrets.ts";
import { loadConfig } from "../src/util/loadConfig.ts";

describe("scrubText", () => {
  test("replaces repo name, paths, email, domain terms with placeholders", () => {
    const input = `Project test-project lives at /Users/alice/projects/test-project.
Contact alice@example.com about the proprietary-feature module.`;
    const res = scrubText(
      input,
      { domainTerms: ["proprietary-feature"] },
      "test-project",
    );
    expect(res.contents).toContain("<REPO_NAME>");
    expect(res.contents).toContain("<PROJECT_ROOT>");
    expect(res.contents).toContain("<EMAIL>");
    expect(res.contents).toContain("<DOMAIN_TERM>");
    expect(res.contents).not.toContain("test-project");
    expect(res.contents).not.toContain("alice@example.com");
    expect(res.contents).not.toContain("proprietary-feature");
  });

  test("false-negative coverage: flags an unlisted high-entropy secret", () => {
    // a secret-shaped string in no denylist
    const secret = "AKIAIOSFODNN7EXAMPLE";
    const ghToken = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
    const input = `token here: ${ghToken}\naws: ${secret}`;
    const res = scrubText(input, {}, "irrelevant-repo");
    const rules = res.secretFindings.map((f) => f.rule);
    expect(rules).toContain("github-token");
    expect(rules).toContain("aws-access-key");
  });

  test("allowlist suppresses a confirmed-generic high-entropy string", () => {
    const blob = "abcdefABCDEF0123456789xyzXYZ987654321longentropystring";
    const withAllow = scanSecrets(blob, [blob]);
    expect(withAllow.find((f) => f.match === blob)).toBeUndefined();
  });

  test("shannonEntropy is higher for random blobs than for words", () => {
    expect(shannonEntropy("aaaaaaaa")).toBeLessThan(
      shannonEntropy("aB3xZ9qP1mK7"),
    );
  });
});

describe("constrained config loader (security)", () => {
  test("refuses to execute murmur.config.ts without --allow-config-exec", async () => {
    const root = join(tmpdir(), `murmur-cfg-${crypto.randomUUID()}`);
    await mkdir(root, { recursive: true });
    try {
      await Bun.write(
        join(root, "murmur.config.ts"),
        `globalThis.__PWNED__ = true;\nexport default { targets: ["copilot"], project: { name: "x" } };\n`,
      );
      await expect(loadConfig(root, {})).rejects.toThrow(/Refusing to execute/);
      // the code must not have run
      expect((globalThis as Record<string, unknown>)["__PWNED__"]).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("prefers murmur.config.json without executing code", async () => {
    const root = join(tmpdir(), `murmur-cfg-${crypto.randomUUID()}`);
    await mkdir(root, { recursive: true });
    try {
      await Bun.write(
        join(root, "murmur.config.json"),
        JSON.stringify({ targets: ["goose"], project: { name: "json-proj" } }),
      );
      const cfg = await loadConfig(root, {});
      expect(cfg.targets).toEqual(["goose"]);
      expect(cfg.project.name).toBe("json-proj");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
