/**
 * Unified Model Provider Client for OpenRouter, MeshAPI, and custom inference gateways.
 */

import { getSecret } from "../util/keychain.ts";
import type {
  IProviderClient,
  ModelSelection,
  ModelTier,
  ProviderConfig,
  ProviderName,
  ProviderRequest,
  ProviderResponse,
} from "./types.ts";

const DEFAULT_ENDPOINTS: Record<ProviderName, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  meshapi: "https://api.meshapi.ai/v1",
  custom: "http://localhost:11434/v1",
};

const DEFAULT_TIER_MODELS: Record<ProviderName, Record<ModelTier, string>> = {
  openrouter: {
    fast: "google/gemini-2.5-flash",
    balanced: "anthropic/claude-3.5-haiku",
    reasoning: "anthropic/claude-3.7-sonnet",
  },
  meshapi: {
    fast: "mesh/gemini-flash",
    balanced: "mesh/claude-haiku",
    reasoning: "mesh/claude-sonnet",
  },
  custom: {
    fast: "llama3.2:1b",
    balanced: "llama3.2:3b",
    reasoning: "qwen2.5-coder:7b",
  },
};

export class ProviderClient implements IProviderClient {
  private provider: ProviderName;
  private apiKey: string | null;
  private baseUrl: string;
  private fetchFn: typeof fetch;

  constructor(config?: Partial<ProviderConfig>) {
    this.provider = config?.provider ?? "openrouter";
    this.baseUrl = config?.baseUrl ?? DEFAULT_ENDPOINTS[this.provider];
    this.fetchFn = config?.fetchFn ?? fetch;

    // An explicit key, even an empty one, skips env and Keychain lookup.
    if (config?.apiKey !== undefined) {
      this.apiKey = config.apiKey;
    } else {
      const keyName =
        this.provider === "openrouter"
          ? "OPENROUTER_API_KEY"
          : this.provider === "meshapi"
          ? "MESHAPI_API_KEY"
          : "CUSTOM_API_KEY";
      this.apiKey = getSecret(keyName);
    }
  }

  /**
   * Classify prompt complexity into an appropriate model tier.
   */
  classifyTier(prompt: string): ModelTier {
    const lower = prompt.toLowerCase();
    const length = prompt.length;

    // High complexity keywords or long context prompts
    const reasoningKeywords = [
      "architect",
      "synthesize",
      "evaluate",
      "security audit",
      "critical critique",
      "invariant",
      "refactor architecture",
      "harness",
    ];

    if (
      length > 2500 ||
      reasoningKeywords.some((kw) => lower.includes(kw))
    ) {
      return "reasoning";
    }

    // Fast scanning keywords
    const fastKeywords = [
      "scan",
      "list",
      "summarize structure",
      "extract exports",
      "classify",
      "tokens",
    ];

    if (length < 800 && fastKeywords.some((kw) => lower.includes(kw))) {
      return "fast";
    }

    return "balanced";
  }

  /**
   * Resolve model name based on selection and tier.
   */
  resolveModel(selection: ModelSelection, tier: ModelTier): string {
    if (typeof selection === "string" && selection !== "auto") {
      return selection;
    }

    if (Array.isArray(selection) && selection.length > 0) {
      if (tier === "fast") return selection[0]!;
      if (tier === "reasoning") return selection[selection.length - 1]!;
      return selection[Math.floor(selection.length / 2)]!;
    }

    // "auto" mode
    return DEFAULT_TIER_MODELS[this.provider][tier];
  }

  /**
   * Execute chat completion.
   */
  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    if (!this.apiKey) {
      const keyName =
        this.provider === "openrouter" ? "OPENROUTER_API_KEY" : "MESHAPI_API_KEY";
      const serviceName =
        this.provider === "openrouter" ? "openrouter-api-key" : "meshapi-api-key";

      throw new Error(
        `Missing API key for ${this.provider}. Set ${keyName} or store in Keychain:\n` +
          `security add-generic-password -a "$USER" -s "${serviceName}" -w "<YOUR_KEY>" -U`
      );
    }

    const lastMsg = request.messages[request.messages.length - 1];
    const tier =
      request.tier ?? (lastMsg ? this.classifyTier(lastMsg.content) : "balanced");

    const model = request.model ?? this.resolveModel("auto", tier);

    const payload = {
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 4096,
    };

    const res = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://murmuration.dev",
        "X-Title": "Murmur CLI",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      throw new Error(`Provider ${this.provider} HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    return {
      content,
      model: data.model ?? model,
      provider: this.provider,
      tier,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }
}
