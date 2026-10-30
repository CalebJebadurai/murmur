import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { loadIR } from "../src/schema/load.ts";
import {
  proposeCandidates,
  probeCandidate,
  composeHarness,
  evolveTask,
} from "../src/harness2/engine.ts";
import { evolveCommand } from "../src/commands/evolve.ts";

describe("Google Harness² Recursive Evolution Engine", () => {
  const root = process.cwd();
  const murmurDir = join(root, "murmur");

  test("proposeCandidates generates k distinct harness mutations", async () => {
    const loaded = await loadIR(murmurDir);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const candidates = proposeCandidates("integrate Redis caching layer", loaded.value, 3);
    expect(candidates.length).toBe(3);

    const kinds = candidates.map((c) => c.kind);
    expect(kinds).toContain("skill");
    expect(kinds).toContain("instruction");
    expect(kinds).toContain("subagent");
  });

  test("probeCandidate returns valid score and trace", async () => {
    const loaded = await loadIR(murmurDir);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const candidates = proposeCandidates("build GraphQL federation gateway", loaded.value, 2);
    const probe = await probeCandidate(candidates[0]!, "build GraphQL federation gateway");

    expect(probe.success).toBe(true);
    expect(probe.score).toBeGreaterThan(0.6);
    expect(probe.outputSummary).toContain("candidate");
  });

  test("composeHarness in dryRun mode returns candidate without modifying disk", async () => {
    const loaded = await loadIR(murmurDir);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const candidates = proposeCandidates("optimize database pool", loaded.value, 2);
    const probes = await Promise.all(candidates.map((c) => probeCandidate(c, "optimize database pool")));

    const res = await composeHarness("optimize database pool", candidates, probes, murmurDir, true);
    expect(res.selectedCandidate).toBeDefined();
    expect(res.writtenPath).toBeUndefined();
    expect(res.experience).toContain("Adopted");
  });

  test("evolveTask dryRun completes full Propose-Probe-Compose loop", async () => {
    const res = await evolveTask("integrate WebSockets for real-time notifications", root, {
      k: 3,
      dryRun: true,
    });

    expect(res.candidatesProposed).toBe(3);
    expect(res.probesRun).toBe(3);
    expect(res.selectedCandidate).toBeDefined();
    expect(res.experienceSummary).toContain("Adopted");
    expect(res.doctorPassed).toBe(true);
  });

  test("evolveCommand executes cleanly with dry-run and json flags", async () => {
    const exitCode = await evolveCommand(root, "add distributed rate limiter", {
      k: 2,
      dryRun: true,
      json: true,
    });
    expect(exitCode).toBe(0);
  });
});
