import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { loadIR } from "../src/schema/load.ts";
import {
  proposeCandidates,
  probeCandidate,
  composeHarness,
  evolveTask,
} from "../src/harness2/engine.ts";
import { evolveCommand } from "../src/commands/evolve.ts";

describe("Experimental evolve engine", () => {
  let root: string;
  let murmurDir: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "murmr-evolve-"));
    murmurDir = join(root, "murmur");
    await cp(join(process.cwd(), "murmur"), murmurDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

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

  test("probeCandidate scores structure the same for every candidate kind", async () => {
    const loaded = await loadIR(murmurDir);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const task = "add a job queue";
    const probes = await Promise.all(
      proposeCandidates(task, loaded.value, 3).map((c) => probeCandidate(c, task)),
    );
    expect(new Set(probes.map((p) => p.score)).size).toBe(1);
    expect(probes[0]!.outputSummary).toContain("Behavior not tested");
  });

  test("evolveTask writes only into the given project and honors targetKind", async () => {
    const res = await evolveTask("add a job queue", root, { k: 3, targetKind: "instruction" });
    expect(res.selectedCandidate?.kind).toBe("instruction");
    expect(res.composedFilePath?.startsWith(root)).toBe(true);
    const experience = await readFile(join(murmurDir, "EXPERIENCE.md"), "utf8");
    expect(experience).toContain("not tested");
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
    expect(res.experienceSummary).toContain("behavior not tested");
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
