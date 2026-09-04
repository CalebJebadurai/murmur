import { join } from "node:path";
import { loadIR } from "../schema/load.ts";
import type { IRSet, PipelineDefinition, SubagentDefinition } from "../schema/index.ts";

export type MatchedAgent = {
  name: string;
  score: number;
  description: string;
  reason?: string;
};

export type ClassificationResult = {
  query: string;
  classification: "CODING" | "RESEARCH" | "HYBRID";
  pipeline?: {
    name: string;
    branch: string;
    description: string;
  };
  matchedAgents: MatchedAgent[];
  suggestedCommand: string;
};

export type ClassifyOptions = {
  json?: boolean;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "he",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "that",
  "the",
  "to",
  "was",
  "were",
  "will",
  "with",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

const CODING_SIGNALS = new Set([
  "code",
  "coding",
  "implement",
  "implementation",
  "refactor",
  "refactoring",
  "bug",
  "fix",
  "debug",
  "test",
  "testing",
  "tests",
  "api",
  "endpoint",
  "database",
  "schema",
  "function",
  "build",
  "compiler",
  "class",
  "module",
  "deploy",
  "git",
  "backend",
  "frontend",
  "ui",
  "ux",
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
]);

const RESEARCH_SIGNALS = new Set([
  "research",
  "paper",
  "papers",
  "literature",
  "study",
  "studies",
  "academic",
  "citation",
  "citations",
  "market",
  "competitor",
  "policy",
  "review",
  "thesis",
  "survey",
  "explore",
  "history",
  "trends",
  "landscape",
  "ethics",
  "social",
]);

const AGENT_INTENT_MAP: Record<string, string[]> = {
  implementer: [
    "implement",
    "implementation",
    "code",
    "coding",
    "write",
    "build",
    "refactor",
    "refactoring",
    "fix",
    "feature",
    "change",
    "create",
  ],
  verifier: [
    "verify",
    "verification",
    "test",
    "testing",
    "tests",
    "coverage",
    "check",
    "validate",
    "validation",
    "audit",
    "ensure",
  ],
  analyst: [
    "analyze",
    "analysis",
    "research",
    "investigate",
    "investigation",
    "explore",
    "architecture",
    "understand",
    "database",
    "query",
    "queries",
    "deep",
  ],
  critic: [
    "review",
    "critique",
    "critic",
    "evaluate",
    "evaluation",
    "assess",
    "assessment",
    "judge",
    "risk",
  ],
  planner: [
    "plan",
    "planning",
    "roadmap",
    "synthesize",
    "strategy",
    "structure",
  ],
  researcher: [
    "research",
    "paper",
    "literature",
    "market",
    "survey",
    "trends",
    "academic",
  ],
  "research-critic": [
    "academic",
    "paper",
    "methodology",
    "literature",
    "source",
  ],
  "prompt-engineer": ["prompt", "refine", "brief", "clarify"],
};

/**
 * Classify a task prompt and match it to pipelines, branches, and agents.
 */
export function classifyTask(query: string, ir: IRSet): ClassificationResult {
  const tokens = tokenize(query);
  const tokenSet = new Set(tokens);

  let codingScore = 0;
  let researchScore = 0;

  for (const t of tokens) {
    if (CODING_SIGNALS.has(t)) codingScore++;
    if (RESEARCH_SIGNALS.has(t)) researchScore++;
  }

  let classification: "CODING" | "RESEARCH" | "HYBRID" = "CODING";
  if (researchScore > 0 && codingScore === 0) {
    classification = "RESEARCH";
  } else if (codingScore > 0 && researchScore > 0) {
    classification = "HYBRID";
  }

  // Find candidate pipeline
  const pipelineDef: PipelineDefinition | undefined =
    ir.pipelines.find((p) => p.classifications?.includes(classification)) ||
    ir.pipelines[0];

  let pipelineInfo:
    | { name: string; branch: string; description: string }
    | undefined = undefined;

  if (pipelineDef) {
    const branchName =
      pipelineDef.routing.map[classification] ||
      Object.keys(pipelineDef.branches)[0] ||
      "default";
    pipelineInfo = {
      name: pipelineDef.name,
      branch: branchName,
      description: pipelineDef.description,
    };
  }

  // Score all agents & subagents
  const allAgents = [...ir.agents, ...ir.subagents];
  const matchedAgents: MatchedAgent[] = [];

  for (const agent of allAgents) {
    let score = 0;
    const reasons: string[] = [];

    // Name match
    const nameTokens = tokenize(agent.name);
    for (const nt of nameTokens) {
      if (tokenSet.has(nt)) {
        score += 3.0;
        reasons.push(`matches agent name "${agent.name}"`);
      }
    }

    // Description match
    const descTokens = tokenize(agent.description);
    let descHits = 0;
    for (const dt of descTokens) {
      if (tokenSet.has(dt)) {
        descHits++;
        score += 1.5;
      }
    }
    if (descHits > 0) {
      reasons.push(`${descHits} keyword hit(s) in description`);
    }

    // Subagent spawn-trigger match
    const sub = agent as Partial<SubagentDefinition>;
    if (sub.spawn?.trigger) {
      const trigTokens = tokenize(sub.spawn.trigger);
      let trigHits = 0;
      for (const tt of trigTokens) {
        if (tokenSet.has(tt)) {
          trigHits++;
          score += 2.0;
        }
      }
      if (trigHits > 0) {
        reasons.push(`${trigHits} match(es) with spawn trigger`);
      }
    }

    // Domain capability intent match
    const intents = AGENT_INTENT_MAP[agent.name];
    if (intents) {
      let intentHits = 0;
      for (const intent of intents) {
        if (tokenSet.has(intent)) {
          intentHits++;
          score += 2.5;
        }
      }
      if (intentHits > 0) {
        reasons.push(`${intentHits} domain intent match(es)`);
      }
    }

    // Check pipeline branch dispatch rules if in selected branch
    if (pipelineDef && pipelineInfo) {
      const branch = pipelineDef.branches[pipelineInfo.branch];
      if (branch) {
        for (const phase of branch.phases) {
          const phaseAgent = phase.agents.find((pa) => pa.name === agent.name);
          if (phaseAgent?.dispatch) {
            for (const invokeRule of phaseAgent.dispatch.invokeWhen) {
              const ruleTokens = tokenize(invokeRule);
              if (ruleTokens.some((rt) => tokenSet.has(rt))) {
                score += 2.5;
                reasons.push(`matches dispatch condition: "${invokeRule}"`);
              }
            }
            for (const skipRule of phaseAgent.dispatch.skipWhen) {
              const ruleTokens = tokenize(skipRule);
              if (ruleTokens.some((rt) => tokenSet.has(rt))) {
                score -= 2.0;
              }
            }
          }
        }
      }
    }

    if (score > 0) {
      matchedAgents.push({
        name: agent.name,
        score: Math.min(1.0, Math.round((score / 10) * 100) / 100),
        description: agent.description,
        reason: reasons[0],
      });
    }
  }

  // Sort descending by score
  matchedAgents.sort((a, b) => b.score - a.score);

  const topAgents = matchedAgents.slice(0, 5);

  let suggestedCommand = "murmr list";
  if (pipelineInfo) {
    suggestedCommand = `murmr run ${pipelineInfo.name} --branch ${pipelineInfo.branch} --classification ${classification}`;
  }

  return {
    query,
    classification,
    pipeline: pipelineInfo,
    matchedAgents: topAgents,
    suggestedCommand,
  };
}

/** CLI entry: murmr classify "<task>" */
export async function classifyCommand(
  projectRoot: string,
  query: string,
  opts?: ClassifyOptions,
): Promise<number> {
  const murmurDir = join(projectRoot, "murmur");
  const loaded = await loadIR(murmurDir);
  if (!loaded.ok) {
    console.error("Failed to load murmur IR. Run `murmr doctor`.");
    return 1;
  }

  const result = classifyTask(query, loaded.value);

  if (opts?.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  console.log(`Task: "${result.query}"\n`);
  console.log(`Classification: ${result.classification}`);

  if (result.pipeline) {
    console.log(
      `Recommended Pipeline: ${result.pipeline.name} (branch: ${result.pipeline.branch})`,
    );
    console.log(`  ${result.pipeline.description}\n`);
  }

  console.log("Matched Agent Roster:");
  if (result.matchedAgents.length === 0) {
    console.log("  (No specific specialist matched; use general orchestrator)");
  } else {
    for (const [idx, a] of result.matchedAgents.entries()) {
      const matchPct = Math.round(a.score * 100);
      console.log(`  ${idx + 1}. ${a.name} [relevance: ${matchPct}%]`);
      console.log(`     ${a.description}`);
      if (a.reason) console.log(`     ↳ ${a.reason}`);
    }
  }

  console.log(`\nSuggested Command:\n  ${result.suggestedCommand}`);
  return 0;
}
