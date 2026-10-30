import type { IRSet, PipelineDefinition } from "../schema/index.ts";
import type { ClassificationResult, MatchedAgent } from "../commands/classify.ts";
import { type JevClient, createJevClient } from "./client.ts";
import type { JevChoiceQuestion, JevNoulQuestion } from "./types.ts";

export type JevRouterOptions = {
  client?: JevClient;
  forceMock?: boolean;
};

/**
 * Classify a task and select an agent roster using TypeSafe AI Jev System One.
 * Evaluates intent and agent selection via typed non-autoregressive decision primitives.
 */
export async function classifyWithJev(
  query: string,
  ir: IRSet,
  opts?: JevRouterOptions,
): Promise<ClassificationResult> {
  const client = opts?.client ?? createJevClient({ forceMock: opts?.forceMock });

  const agentCriteria: Record<string, string> = {};
  for (const agent of ir.agents) {
    agentCriteria[agent.name] = agent.description;
  }
  for (const sub of ir.subagents) {
    agentCriteria[sub.name] = sub.description;
  }

  // 1. Prepare Jev Questions
  const intentQuestion: JevChoiceQuestion<"CODING" | "RESEARCH" | "HYBRID"> = {
    type: "choice",
    instructions: "Classify this software engineering or research query into CODING, RESEARCH, or HYBRID.",
    criteria: {
      CODING: "Software implementation, bug fixes, refactoring, building features, tests, API or database code",
      RESEARCH: "Literature review, academic research, market analysis, competitor analysis, policy or exploratory study",
      HYBRID: "Both strategic analysis/planning and immediate code implementation",
    },
  };

  const agentQuestion: JevChoiceQuestion = {
    type: "choice",
    instructions: "Select the most appropriate primary agent or specialist subagent for this task.",
    criteria: agentCriteria,
  };

  const safetyQuestion: JevNoulQuestion = {
    type: "noul",
    instructions: "Is this task safe to execute without irreversible data loss or destructive commands?",
    criteria: {
      true: "Safe developmental task: analyzing, writing code, running tests, or planning",
      false: "Destructive task: dropping databases, deleting repositories, or wiping configurations",
    },
  };

  const evalResponse = await client.evaluate({
    state: { query },
    questions: {
      intent: intentQuestion,
      primary_agent: agentQuestion,
      is_safe: safetyQuestion,
    },
  });

  const intentChoice = (evalResponse.answers["intent"]?.choice as "CODING" | "RESEARCH" | "HYBRID") ?? "CODING";
  const primaryAgent = evalResponse.answers["primary_agent"]?.choice ?? "implementer";
  const primaryConfidence = evalResponse.answers["primary_agent"]?.confidence ?? 0.88;

  // 2. Build matched agents list
  const matchedAgents: MatchedAgent[] = [];
  const primaryAgentDef =
    ir.agents.find((a) => a.name === primaryAgent) ?? ir.subagents.find((s) => s.name === primaryAgent);

  if (primaryAgentDef) {
    matchedAgents.push({
      name: primaryAgentDef.name,
      score: Math.min(1.0, primaryConfidence),
      description: primaryAgentDef.description,
      reason: `Selected by Jev System One (${Math.round(primaryConfidence * 100)}% confidence)`,
    });
  }

  // Supplement secondary candidates from IR
  for (const agent of ir.agents) {
    if (agent.name !== primaryAgent && matchedAgents.length < 3) {
      const qLower = query.toLowerCase();
      const aLower = agent.name.toLowerCase();
      if (qLower.includes(aLower) || agent.description.toLowerCase().split(/\W+/).some((w) => w.length > 4 && qLower.includes(w))) {
        matchedAgents.push({
          name: agent.name,
          score: 0.55,
          description: agent.description,
          reason: "Secondary domain keyword alignment",
        });
      }
    }
  }

  // 3. Match pipeline
  const pipeline = selectPipelineForClassification(intentChoice, ir.pipelines);

  return {
    query,
    classification: intentChoice,
    pipeline: pipeline
      ? {
          name: pipeline.name,
          branch: intentChoice === "RESEARCH" ? "research" : "coding",
          description: pipeline.description,
        }
      : undefined,
    matchedAgents,
    suggestedCommand: pipeline
      ? `murmr run ${pipeline.name} --branch ${intentChoice === "RESEARCH" ? "research" : "coding"} --classification ${intentChoice}`
      : `murmr run architect --classification ${intentChoice}`,
  };
}

function selectPipelineForClassification(
  classification: "CODING" | "RESEARCH" | "HYBRID",
  pipelines: PipelineDefinition[],
): PipelineDefinition | undefined {
  if (pipelines.length === 0) return undefined;
  // Look for pipeline with routing map or branches
  for (const p of pipelines) {
    if (classification === "RESEARCH" && (p.branches["research"] || p.routing.map["RESEARCH"])) {
      return p;
    }
    if (classification === "CODING" && (p.branches["coding"] || p.routing.map["CODING"])) {
      return p;
    }
  }
  return pipelines[0];
}
