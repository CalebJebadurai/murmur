import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { loadIR } from "../src/schema/load.ts";
import { getAdapter } from "../src/compiler/registry.ts";
import { compileTarget } from "../src/compiler/compile.ts";
import type { CompileContext } from "../src/compiler/RuntimeCompiler.ts";
import { DEFAULT_CONFIG } from "../src/schema/index.ts";

const MURMUR_DIR = join(import.meta.dir, "..", "murmur");

async function freshOut(): Promise<string> {
  return join(tmpdir(), `murmur-acp-test-${crypto.randomUUID()}`);
}

describe("ACP adapter golden output", () => {
  test("emits .acp/manifest.json, agents, skills, and server.ts", async () => {
    const res = await loadIR(MURMUR_DIR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const ctx: CompileContext = {
      config: {
        ...DEFAULT_CONFIG,
        project: { name: "murmur-test", description: "Test project for ACP" },
      },
      ir: res.value,
    };

    const out = await freshOut();
    try {
      const adapter = getAdapter("acp");
      expect(adapter).toBeDefined();
      await compileTarget(adapter!, ctx, out);

      // Verify manifest.json
      const manifestFile = Bun.file(join(out, ".acp/manifest.json"));
      expect(await manifestFile.exists()).toBe(true);
      const manifest = await manifestFile.json();
      expect(manifest.acpVersion).toBe("2.0");
      expect(manifest.protocol).toBe("agent-client-protocol");
      expect(manifest.server.name).toBe("murmur-test");
      expect(manifest.capabilities.sessions).toBe(true);
      expect(manifest.capabilities.tools).toBe(true);
      expect(manifest.agents.length).toBeGreaterThan(0);
      expect(Array.isArray(manifest.tools)).toBe(true);

      // Verify agent JSON
      const archFile = Bun.file(join(out, ".acp/agents/architect.json"));
      expect(await archFile.exists()).toBe(true);
      const arch = await archFile.json();
      expect(arch.name).toBe("architect");
      expect(arch.role).toContain("Architect");
      expect(arch.userInvocable).toBe(true);
      expect(arch.dispatch).toBeDefined();
      expect(Array.isArray(arch.dispatch.invokeWhen)).toBe(true);

      // Verify subagent JSON
      const subFile = Bun.file(join(out, ".acp/agents/example-specialist.json"));
      expect(await subFile.exists()).toBe(true);
      const sub = await subFile.json();
      expect(sub.name).toBe("example-specialist");
      expect(sub.userInvocable).toBe(false);
      expect(sub.spawnTrigger).toBeDefined();

      // Verify skill
      const skillFile = Bun.file(join(out, ".acp/skills/build-system/SKILL.md"));
      expect(await skillFile.exists()).toBe(true);
      const skillText = await skillFile.text();
      expect(skillText).toContain("name: build-system");

      // Verify pipeline
      const pipelineFile = Bun.file(join(out, ".acp/pipelines/architect.json"));
      expect(await pipelineFile.exists()).toBe(true);
      const pipeline = await pipelineFile.json();
      expect(pipeline.name).toBe("architect");
      expect(pipeline.branches.coding).toBeDefined();

      // Verify server.ts
      const serverFile = Bun.file(join(out, ".acp/server.ts"));
      expect(await serverFile.exists()).toBe(true);
      const serverText = await serverFile.text();
      expect(serverText).toContain("Agent Client Protocol");
      expect(serverText).toContain("handleRequest");
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  test("ACP server module handles standard JSON-RPC requests correctly", async () => {
    // Dynamically test the server implementation logic
    const res = await loadIR(MURMUR_DIR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const ctx: CompileContext = {
      config: {
        ...DEFAULT_CONFIG,
        project: { name: "acp-rpc-test", description: "JSON-RPC test" },
      },
      ir: res.value,
    };

    const out = await freshOut();
    try {
      const adapter = getAdapter("acp");
      await compileTarget(adapter!, ctx, out);

      // Import the emitted server module
      const serverPath = join(out, ".acp/server.ts");
      const serverMod = await import(serverPath);
      expect(typeof serverMod.handleRequest).toBe("function");

      // Intercept stdout writes
      const writes: string[] = [];
      const origWrite = process.stdout.write;
      process.stdout.write = ((chunk: any) => {
        writes.push(chunk.toString());
        return true;
      }) as any;

      try {
        // 1. Test initialize
        serverMod.handleRequest({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
        });
        const initResp = JSON.parse(writes[writes.length - 1]!);
        expect(initResp.id).toBe(1);
        expect(initResp.result.protocolVersion).toBe("2.0");
        expect(initResp.result.capabilities.sessions).toBe(true);

        // 2. Test tools/list
        serverMod.handleRequest({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
        });
        const toolsResp = JSON.parse(writes[writes.length - 1]!);
        expect(toolsResp.id).toBe(2);
        expect(Array.isArray(toolsResp.result.tools)).toBe(true);

        // 3. Test session/new
        serverMod.handleRequest({
          jsonrpc: "2.0",
          id: 3,
          method: "session/new",
          params: { agent: "architect" },
        });
        const sessResp = JSON.parse(writes[writes.length - 1]!);
        expect(sessResp.id).toBe(3);
        expect(sessResp.result.sessionId).toBeDefined();
        const sessionId = sessResp.result.sessionId;

        // 4. Test session/prompt
        serverMod.handleRequest({
          jsonrpc: "2.0",
          id: 4,
          method: "session/prompt",
          params: { sessionId, prompt: "Create a database schema" },
        });
        // Should emit notification and response
        const promptResp = JSON.parse(writes[writes.length - 1]!);
        expect(promptResp.id).toBe(4);
        expect(promptResp.result.status).toBe("completed");

        // 5. Test session/cancel
        serverMod.handleRequest({
          jsonrpc: "2.0",
          id: 5,
          method: "session/cancel",
          params: { sessionId },
        });
        const cancelResp = JSON.parse(writes[writes.length - 1]!);
        expect(cancelResp.id).toBe(5);
        expect(cancelResp.result.cancelled).toBe(true);
      } finally {
        process.stdout.write = origWrite;
      }
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});
