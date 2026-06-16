import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { makeHostDispatcher, parseScore } from "../src/commands/hostDispatch.ts";

const FAKE = join(import.meta.dir, "fixtures", "host", "fake-agent.ts");
const hostArgv = ["bun", FAKE];

describe("parseScore — only the documented contract, never prose", () => {
  test("parses a MURMUR_SCORE line", () => {
    expect(parseScore("blah\nMURMUR_SCORE: 42\nmore")).toBe(42);
  });
  test("ignores arbitrary numbers in prose", () => {
    expect(parseScore("the score is 5 out of 10")).toBeUndefined();
  });
});

describe("host dispatcher — Bun.spawn delegation (untrusted output)", () => {
  test("a successful turn returns SUCCESS and parses the score contract", async () => {
    const d = makeHostDispatcher({ argv: hostArgv });
    const r = await d("scorer", "3", 1);
    expect(r.status).toBe("SUCCESS");
    expect(r.score).toBe(7);
  });

  test("a non-zero host exit is a SOFT failure that still logs", async () => {
    const d = makeHostDispatcher({ argv: hostArgv });
    const r = await d("fail", "3", 1);
    expect(r.status).toBe("FAILED");
    expect(r.note).toContain("host exited");
  });

  test("oversized host output is rejected as a soft failure (size-limited)", async () => {
    const d = makeHostDispatcher({ argv: hostArgv });
    const r = await d("huge", "3", 1);
    expect(r.status).toBe("FAILED");
    expect(r.note).toContain("size limit");
  });

  test("a host early-exit signal is surfaced", async () => {
    const d = makeHostDispatcher({ argv: hostArgv });
    const r = await d("exiter", "3", 1);
    expect(r.earlyExit).toBe(true);
  });

  test("injection safety: shell metacharacters in the agent name are literal data", async () => {
    const d = makeHostDispatcher({ argv: hostArgv });
    // If argv were shell-concatenated, this would create a sentinel file.
    const sentinel = join(import.meta.dir, "fixtures", "host", "PWNED");
    const r = await d("x; touch " + sentinel, "1", 1);
    // The fake agent runs (unknown agent → default echo), no shell executed it.
    expect(r.status).toBe("SUCCESS");
    expect(existsSync(sentinel)).toBe(false);
  });

  test("a missing host binary is a soft failure, never a crash", async () => {
    const d = makeHostDispatcher({ argv: ["definitely-not-a-real-binary-xyz"] });
    const r = await d("critic", "3", 1);
    expect(r.status).toBe("FAILED");
  });
});
