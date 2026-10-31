/**
 * Murmur Model Provider Abstraction Types
 */

export type ProviderName = "openrouter" | "meshapi" | "custom";

export type ModelTier = "fast" | "balanced" | "reasoning";

export type ModelSelection = "auto" | string | string[];

export interface ProviderConfig {
  provider: ProviderName;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  fetchFn?: typeof fetch;
}

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ProviderRequest {
  messages: ProviderMessage[];
  model?: string;
  tier?: ModelTier;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ProviderResponse {
  content: string;
  model: string;
  provider: ProviderName;
  tier: ModelTier;
  usage?: ProviderUsage;
}

export interface IProviderClient {
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  classifyTier(prompt: string): ModelTier;
  resolveModel(selection: ModelSelection, tier: ModelTier): string;
}
