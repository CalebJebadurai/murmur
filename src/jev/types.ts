/**
 * Type definitions for TypeSafe AI Jev System One Decisions API.
 * Jev is a non-autoregressive, strongly typed decision engine.
 */

export type JevChoiceQuestion<T extends string = string> = {
  type: "choice";
  instructions: string;
  criteria: Record<T, string>;
};

export type JevScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[]; // Ordered rubric scale e.g. [bad, acceptable, excellent]
};

export type JevNoulQuestion = {
  type: "noul";
  instructions: string;
  criteria: {
    true: string;
    false: string;
  };
};

export type JevQuestion = JevChoiceQuestion | JevScoreQuestion | JevNoulQuestion;

export type JevDecisionsRequest = {
  model?: string; // Default: "typesafe/jev-1.13"
  state: Record<string, unknown>;
  questions: Record<string, JevQuestion>;
};

export type JevDecisionAnswer = {
  choice?: string;
  score?: number;
  noul?: number; // 0.0 to 1.0 probability
  confidence?: number;
  reason?: string;
};

export type JevDecisionsResponse = {
  answers: Record<string, JevDecisionAnswer>;
  latencyMs?: number;
};
