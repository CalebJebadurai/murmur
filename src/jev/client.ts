import { getSecret } from "../util/keychain.ts";
import type {
  JevChoiceQuestion,
  JevDecisionAnswer,
  JevDecisionsRequest,
  JevDecisionsResponse,
  JevNoulQuestion,
  JevScoreQuestion,
} from "./types.ts";

export interface JevClient {
  evaluate(request: JevDecisionsRequest): Promise<JevDecisionsResponse>;
  classifyChoice<T extends string>(
    state: Record<string, unknown>,
    question: JevChoiceQuestion<T>,
  ): Promise<{ choice: T; confidence: number }>;
  evaluateNoul(
    state: Record<string, unknown>,
    question: JevNoulQuestion,
  ): Promise<{ result: boolean; probability: number }>;
  evaluateScore(
    state: Record<string, unknown>,
    question: JevScoreQuestion,
  ): Promise<{ score: number; confidence: number }>;
}

export class OpenRouterJevClient implements JevClient {
  private apiKey: string;
  private endpoint: string;
  private model: string;

  constructor(apiKey: string, endpoint = "https://openrouter.ai/api/alpha/decisions", model = "typesafe/jev-1.13") {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.model = model;
  }

  async evaluate(request: JevDecisionsRequest): Promise<JevDecisionsResponse> {
    const start = performance.now();
    const payload = {
      model: request.model ?? this.model,
      state: request.state,
      questions: request.questions,
    };

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Jev Decisions API error HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as { answers: Record<string, JevDecisionAnswer> };
    const latencyMs = Math.round(performance.now() - start);

    return {
      answers: data.answers ?? {},
      latencyMs,
    };
  }

  async classifyChoice<T extends string>(
    state: Record<string, unknown>,
    question: JevChoiceQuestion<T>,
  ): Promise<{ choice: T; confidence: number }> {
    const res = await this.evaluate({
      state,
      questions: { target: question },
    });
    const ans = res.answers["target"];
    const choice = (ans?.choice as T) ?? (Object.keys(question.criteria)[0] as T);
    const confidence = ans?.confidence ?? 0.85;
    return { choice, confidence };
  }

  async evaluateNoul(
    state: Record<string, unknown>,
    question: JevNoulQuestion,
  ): Promise<{ result: boolean; probability: number }> {
    const res = await this.evaluate({
      state,
      questions: { target: question },
    });
    const ans = res.answers["target"];
    const prob = typeof ans?.noul === "number" ? ans.noul : 0.5;
    return { result: prob >= 0.5, probability: prob };
  }

  async evaluateScore(
    state: Record<string, unknown>,
    question: JevScoreQuestion,
  ): Promise<{ score: number; confidence: number }> {
    const res = await this.evaluate({
      state,
      questions: { target: question },
    });
    const ans = res.answers["target"];
    const score = typeof ans?.score === "number" ? ans.score : 2.0;
    const confidence = ans?.confidence ?? 0.9;
    return { score, confidence };
  }
}

/**
 * Deterministic, zero-network mock client for offline development and unit tests.
 * Performs fast semantic keyword scoring that matches the Jev API contracts.
 */
export class MockJevClient implements JevClient {
  async evaluate(request: JevDecisionsRequest): Promise<JevDecisionsResponse> {
    const answers: Record<string, JevDecisionAnswer> = {};

    for (const [key, q] of Object.entries(request.questions)) {
      if (q.type === "choice") {
        const queryText = String(request.state.query ?? "").toLowerCase();
        let bestKey = Object.keys(q.criteria)[0]!;
        let bestMatches = -1;

        const queryWords = queryText.split(/\W+/).filter((w) => w.length > 2);
        for (const [optKey, optDesc] of Object.entries(q.criteria)) {
          const descTokens = (optDesc as string).toLowerCase().split(/\W+/).filter((w) => w.length > 2);
          let matches = 0;
          for (const qWord of queryWords) {
            for (const dToken of descTokens) {
              if (qWord === dToken || qWord.startsWith(dToken) || dToken.startsWith(qWord)) {
                matches += 2;
              }
            }
            if (qWord === optKey.toLowerCase() || optKey.toLowerCase().startsWith(qWord)) {
              matches += 4;
            }
          }
          if (matches > bestMatches) {
            bestMatches = matches;
            bestKey = optKey;
          }
        }

        answers[key] = {
          choice: bestKey,
          confidence: bestMatches > 0 ? 0.94 : 0.72,
        };
      } else if (q.type === "noul") {
        const queryText = String(request.state.query ?? "").toLowerCase();
        const isTrue = queryText.includes("clean") || queryText.includes("safe") || !queryText.includes("corrupt");
        answers[key] = {
          noul: isTrue ? 0.92 : 0.08,
          confidence: 0.95,
        };
      } else if (q.type === "score") {
        answers[key] = {
          score: 2.2,
          confidence: 0.88,
        };
      }
    }

    return { answers, latencyMs: 2 };
  }

  async classifyChoice<T extends string>(
    state: Record<string, unknown>,
    question: JevChoiceQuestion<T>,
  ): Promise<{ choice: T; confidence: number }> {
    const res = await this.evaluate({
      state,
      questions: { target: question },
    });
    return {
      choice: res.answers["target"]?.choice as T,
      confidence: res.answers["target"]?.confidence ?? 0.9,
    };
  }

  async evaluateNoul(
    state: Record<string, unknown>,
    question: JevNoulQuestion,
  ): Promise<{ result: boolean; probability: number }> {
    const res = await this.evaluate({
      state,
      questions: { target: question },
    });
    const prob = res.answers["target"]?.noul ?? 0.5;
    return { result: prob >= 0.5, probability: prob };
  }

  async evaluateScore(
    state: Record<string, unknown>,
    question: JevScoreQuestion,
  ): Promise<{ score: number; confidence: number }> {
    const res = await this.evaluate({
      state,
      questions: { target: question },
    });
    return {
      score: res.answers["target"]?.score ?? 2.0,
      confidence: res.answers["target"]?.confidence ?? 0.85,
    };
  }
}

/**
 * Factory function to instantiate the Jev client:
 * 1. Checks OPENROUTER_API_KEY / TYPESAFE_API_KEY in Keychain or env.
 * 2. Uses MockJevClient only when forceMock is true; a missing key is an error.
 */
export function createJevClient(opts?: { forceMock?: boolean; apiKey?: string }): JevClient {
  if (opts?.forceMock) {
    return new MockJevClient();
  }

  const key = opts?.apiKey ?? getSecret("OPENROUTER_API_KEY") ?? getSecret("TYPESAFE_API_KEY");
  if (key) {
    return new OpenRouterJevClient(key);
  }

  throw new Error(
    "No Jev API key found. Set OPENROUTER_API_KEY or TYPESAFE_API_KEY, or pass --mock for offline test output.",
  );
}
