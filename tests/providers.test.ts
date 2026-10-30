import { describe, expect, it } from "bun:test";
import { ProviderClient } from "../src/providers/client.ts";

describe("ProviderClient", () => {
  it("classifies prompt tiers accurately", () => {
    const client = new ProviderClient({ apiKey: "test-key" });

    // Reasoning keywords
    expect(
      client.classifyTier("Please architect a recursive multi-agent synthesis engine")
    ).toBe("reasoning");

    expect(
      client.classifyTier("Perform a comprehensive security audit of our auth cookies")
    ).toBe("reasoning");

    // Fast keywords
    expect(client.classifyTier("scan and list files")).toBe("fast");
    expect(client.classifyTier("summarize structure")).toBe("fast");

    // Balanced default
    expect(client.classifyTier("format this function using standard camelCase")).toBe(
      "balanced"
    );
  });

  it("resolves models for auto and explicit selections", () => {
    const openrouter = new ProviderClient({ provider: "openrouter", apiKey: "test-key" });

    // Auto resolution
    expect(openrouter.resolveModel("auto", "fast")).toBe("google/gemini-2.5-flash");
    expect(openrouter.resolveModel("auto", "reasoning")).toBe(
      "anthropic/claude-3.7-sonnet"
    );

    // Explicit single model
    expect(openrouter.resolveModel("meta-llama/llama-3.3-70b-instruct", "fast")).toBe(
      "meta-llama/llama-3.3-70b-instruct"
    );

    // Model array
    const tierList = ["fast-model", "mid-model", "deep-reasoning-model"];
    expect(openrouter.resolveModel(tierList, "fast")).toBe("fast-model");
    expect(openrouter.resolveModel(tierList, "reasoning")).toBe("deep-reasoning-model");
  });

  it("executes completion with mocked fetch and proper headers", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    const mockFetch = async (input: unknown, init?: any) => {
      capturedUrl = String(input);
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = JSON.parse(String(init?.body || "{}"));

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "---\nname: test-skill\n---\n# Test Skill",
              },
            },
          ],
          model: capturedBody.model,
          usage: {
            prompt_tokens: 120,
            completion_tokens: 45,
            total_tokens: 165,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const client = new ProviderClient({
      provider: "openrouter",
      apiKey: "sk-or-test-mock-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const res = await client.complete({
      messages: [{ role: "user", content: "architect a resilient microservice" }],
    });

    expect(capturedUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(capturedHeaders["Authorization"]).toBe("Bearer sk-or-test-mock-key");
    expect(capturedHeaders["HTTP-Referer"]).toBe("https://murmuration.dev");
    expect(capturedBody.model).toBe("anthropic/claude-3.7-sonnet");
    expect(res.content).toContain("# Test Skill");
    expect(res.tier).toBe("reasoning");
    expect(res.usage?.totalTokens).toBe(165);
  });

  it("throws clear error with keychain command when key is missing", async () => {
    // Force empty key
    const client = new ProviderClient({
      provider: "openrouter",
      apiKey: "",
    });

    await expect(
      client.complete({
        messages: [{ role: "user", content: "hello" }],
      })
    ).rejects.toThrow("security add-generic-password");
  });
});
