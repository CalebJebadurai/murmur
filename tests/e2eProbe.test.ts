import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { loadIR } from "../src/schema/load.ts";
import { runDoctor } from "../src/commands/doctor.ts";
import { getAdapter } from "../src/compiler/registry.ts";
import { compileTarget } from "../src/compiler/compile.ts";
import { runCommand } from "../src/commands/run.ts";
import { parseDocumentScores, scoreRubric, scoreCommand } from "../src/commands/score.ts";
import { classifyTask } from "../src/commands/classify.ts";
import { makeRemoteSandboxDispatcher } from "../src/commands/sandboxDispatch.ts";
import type { CompileContext } from "../src/compiler/RuntimeCompiler.ts";
import { DEFAULT_CONFIG } from "../src/schema/config.ts";

const ROOT_DIR = join(import.meta.dir, "..");
const MURMUR_DIR = join(ROOT_DIR, "murmur");

async function freshDir(name: string): Promise<string> {
  const dir = join(tmpdir(), `murmur-e2e-${name}-${crypto.randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

describe("v1.0 End-to-End Cross-Runtime Orchestration Probe", () => {
  test("validates schema, compiles across all 6 targets, and proves governed execution", async () => {
    // 1. Doctor & IR Loading
    const doctorReport = await runDoctor(MURMUR_DIR);
    expect(doctorReport.ok).toBe(true);

    const loaded = await loadIR(MURMUR_DIR);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const ir = loaded.value;
    expect(ir.agents.length).toBeGreaterThanOrEqual(10);
    expect(ir.pipelines.length).toBeGreaterThanOrEqual(1);

    const ctx: CompileContext = {
      config: {
        ...DEFAULT_CONFIG,
        project: { name: "murmur-e2e", description: "End-to-End Orchestration Probe" },
      },
      ir,
    };

    const outDir = await freshDir("compile-out");
    try {
      // 2. Multi-Target Compilation across all 6 runtimes
      const targets = ["copilot", "goose", "antigravity", "claude", "cursor", "acp"];
      const emittedByTarget: Record<string, string[]> = {};

      for (const t of targets) {
        const adapter = getAdapter(t);
        expect(adapter).toBeDefined();
        const res = await compileTarget(adapter!, ctx, outDir);
        expect(res.files.length).toBeGreaterThan(15);
        emittedByTarget[t] = res.files;
      }

      // Check key runtime files
      expect(emittedByTarget["copilot"]).toContain(".github/agents/master.agent.md");
      expect(emittedByTarget["goose"]).toContain("recipes/architect.yaml");
      expect(emittedByTarget["goose"]).toContain("AGENTS.md");
      expect(emittedByTarget["antigravity"]).toContain(".agents/plugins/murmur-e2e/plugin.json");
      expect(emittedByTarget["claude"]).toContain(".claude/agents/master.md");
      expect(emittedByTarget["claude"]).toContain("CLAUDE.md");
      expect(emittedByTarget["cursor"]).toContain(".cursor/agents/master.md");
      expect(emittedByTarget["acp"]).toContain(".acp/manifest.json");
      expect(emittedByTarget["acp"]).toContain(".acp/server.ts");

      // 3. ACP Protocol Server Verification
      const acpServerMod = await import(join(outDir, ".acp/server.ts"));
      expect(typeof acpServerMod.handleRequest).toBe("function");

      const acpMessages: any[] = [];
      const origWrite = process.stdout.write;
      process.stdout.write = ((chunk: any) => {
        acpMessages.push(JSON.parse(chunk.toString()));
        return true;
      }) as any;

      try {
        acpServerMod.handleRequest({ jsonrpc: "2.0", id: "init-1", method: "initialize" });
        const initResp = acpMessages[acpMessages.length - 1];
        expect(initResp.result.protocolVersion).toBe("2.0");
        expect(initResp.result.capabilities.sessions).toBe(true);

        acpServerMod.handleRequest({
          jsonrpc: "2.0",
          id: "sess-1",
          method: "session/new",
          params: { agent: "architect" },
        });
        const sessResp = acpMessages[acpMessages.length - 1];
        expect(sessResp.result.sessionId).toBeDefined();

        acpServerMod.handleRequest({
          jsonrpc: "2.0",
          id: "prompt-1",
          method: "session/prompt",
          params: { sessionId: sessResp.result.sessionId, prompt: "Design architecture" },
        });
        const promptResp = acpMessages[acpMessages.length - 1];
        expect(promptResp.result.status).toBe("completed");
      } finally {
        process.stdout.write = origWrite;
      }

      // 4. Governed Pipeline Execution with Worker Pool & Concurrency
      const runExit = await runCommand(ROOT_DIR, {
        pipeline: "architect",
        branch: "coding",
        tier: "lightweight",
        concurrency: 3,
        retries: 1,
        out: outDir,
        dryRun: false,
        dispatcher: async (agent, phase, iter) => ({
          agent,
          phase,
          iteration: iter,
          status: "SUCCESS",
          score: 4.8,
          note: "e2e simulated turn",
        }),
      });
      expect(runExit).toBe(0);

      const runLogPath = join(outDir, "RUN-LOG.md");
      const runLogContent = await Bun.file(runLogPath).text();
      expect(runLogContent).toContain("# RUN-LOG");
      expect(runLogContent).toContain("architect — coding");
      expect(runLogContent).toContain("prompt-engineer");
      expect(runLogContent).toContain("SUCCESS");

      // 5. Cloud Sandbox Remote Dispatcher Probe
      const mockFetch = (async (_url: string, init: any) => {
        const body = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              jsonrpc: "2.0",
              id: body.id,
              result: {
                status: "SUCCESS",
                score: 4.9,
                note: "dispatched to sandbox cloud runner",
              },
            }),
        };
      }) as any;

      const sandboxDispatcher = makeRemoteSandboxDispatcher({
        endpoint: "https://sandbox.internal/dispatch",
        token: "e2e-token",
        fetchFn: mockFetch,
      });

      const sandboxTurn = await sandboxDispatcher("critic", "Phase 3", 1);
      expect(sandboxTurn.status).toBe("SUCCESS");
      expect(sandboxTurn.score).toBe(4.9);
      expect(sandboxTurn.note).toBe("dispatched to sandbox cloud runner");

      // 6. Quantitative Rubric Scoring
      const sampleDoc = `
# Architecture Proposal

SCORE: Security = 5
SCORE: Performance = 4
SCORE: Approach Validity = 5
SCORE: Completeness = 5
SCORE: Feasibility = 5
SCORE: Risk Assessment = 4
SCORE: Test Coverage = 5
SCORE: Logical Soundness = 5
SCORE: Codebase Alignment = 5
`;
      const docPath = join(outDir, "proposal.md");
      await writeFile(docPath, sampleDoc);

      const parsedScores = parseDocumentScores(sampleDoc);
      const rubric = ir.rubrics.find((r) => r.name === "technical-scorecard");
      expect(rubric).toBeDefined();

      const scoreResult = scoreRubric(rubric!, parsedScores);
      expect(scoreResult.rubric).toBe("technical-scorecard");
      expect(scoreResult.earned).toBeGreaterThan(0);
      expect(scoreResult.pass).toBe(true);
      expect(scoreResult.dimensions.length).toBeGreaterThanOrEqual(5);

      // 7. Intelligent Selective Task Classification
      const codingClassification = classifyTask("refactor auth token expiration and database query", ir);
      expect(codingClassification.classification).toBe("CODING");
      expect(codingClassification.matchedAgents.length).toBeGreaterThan(0);

      const researchClassification = classifyTask("perform literature review on market trends", ir);
      expect(researchClassification.classification).toBe("RESEARCH");
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
