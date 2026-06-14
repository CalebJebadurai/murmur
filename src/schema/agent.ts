/**
 * AgentDefinition — a generic, codebase-agnostic agent.
 *
 * Agent bodies MUST contain zero project-specific facts; all domain knowledge is
 * referenced via `skills` and `instructions`. Identity is the filename stem.
 */
export type AgentDefinition = {
  /** Filename stem, e.g. "critic" for murmur/agents/critic.md */
  name: string;
  /** The "Use when: …" trigger string. */
  description: string;
  /** The generic prose body (Markdown, no project facts). */
  role: string;
  /** Neutral tool tags, mapped per-runtime by adapters. */
  tools: string[];
  /** Referenced skill names (must resolve to murmur/skills/*). */
  skills: string[];
  /** Referenced instruction names (must resolve to murmur/instructions/*). */
  instructions: string[];
  /** Dispatchable subagent names for runtimes that support a roster. */
  agents: string[];
  /** Optional preferred-model hints. */
  model?: string[];
  /** Whether a human can invoke this agent directly. */
  userInvocable?: boolean;
};
