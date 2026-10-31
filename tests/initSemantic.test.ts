import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initCommand } from "../src/commands/init.ts";
import { runDoctor } from "../src/commands/doctor.ts";
import type { IProviderClient, ProviderRequest, ProviderResponse } from "../src/providers/types.ts";

describe("initCommand --semantic", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "murmr-init-sem-"));
    // Create minimal mock package.json
    await Bun.write(
      join(tmp, "package.json"),
      JSON.stringify({
        name: "mock-microservice",
        version: "1.0.0",
        scripts: { test: "bun test", build: "bun build" },
        dependencies: { hono: "^4.0.0" },
      })
    );
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("performs semantic enrichment and synthesizes domain-overview skill", async () => {
    let capturedPrompt = "";

    const mockClient: IProviderClient = {
      async complete(req: ProviderRequest): Promise<ProviderResponse> {
        capturedPrompt = req.messages[0]?.content || "";
        return {
          content: `---
name: domain-overview
description: Domain architectural overview for mock-microservice
---
# Domain Overview: Mock Microservice

This service is a high-throughput API gateway built with Hono.
`,
          model: "anthropic/claude-3.7-sonnet",
          provider: "openrouter",
          tier: "reasoning",
        };
      },
      classifyTier() {
        return "reasoning";
      },
      resolveModel() {
        return "anthropic/claude-3.7-sonnet";
      },
    };

    const code = await initCommand(tmp, {
      semantic: true,
      client: mockClient,
    });

    expect(code).toBe(0);
    expect(capturedPrompt).toContain("mock-microservice");
    expect(capturedPrompt).toContain("hono");

    // Verify skill written
    const skillPath = join(tmp, "murmur", "skills", "domain-overview", "SKILL.md");
    expect(await Bun.file(skillPath).exists()).toBe(true);
    const content = await Bun.file(skillPath).text();
    expect(content).toContain("high-throughput API gateway built with Hono");

    // Verify IR passes doctor validation
    const report = await runDoctor(join(tmp, "murmur"));
    expect(report.ok).toBe(true);
    expect(report.errors.length).toBe(0);
  });
});
