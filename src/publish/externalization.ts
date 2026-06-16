import { Glob } from "bun";
import { join } from "node:path";

export type ExternalizationReport = {
  ok: boolean;
  /** Per-file leak findings in agent bodies. */
  leaks: { file: string; pattern: string; sample: string }[];
  /** Share of project terms that live in skills/instructions vs agents. */
  externalizedRatio: number;
};

/**
 * Knowledge-externalization scanner — the framework's hard gate.
 *
 * Asserts that generic agent bodies (murmur/agents/*) contain ZERO codebase-specific
 * facts: absolute user paths, the repo name, or configured domain terms. Separately
 * reports the share of project-specific terms that appear in skills/instructions.
 */
export async function scanExternalization(
  murmurDir: string,
  opts: { repoName?: string; domainTerms?: string[] } = {},
): Promise<ExternalizationReport> {
  const leakPatterns: { pattern: string; re: RegExp }[] = [
    { pattern: "absolute-user-path", re: /\/Users\/[^/\s]+\//g },
    { pattern: "home-path", re: /\/home\/[^/\s]+\//g },
  ];
  if (opts.repoName) {
    leakPatterns.push({
      pattern: "repo-name",
      re: new RegExp(opts.repoName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
    });
  }
  for (const term of opts.domainTerms ?? []) {
    leakPatterns.push({
      pattern: `domain-term:${term}`,
      re: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
    });
  }

  const leaks: ExternalizationReport["leaks"] = [];
  const agentGlob = new Glob("{agents,subagents,pipelines}/**/*.md");
  for await (const rel of agentGlob.scan({ cwd: murmurDir, onlyFiles: true })) {
    const text = await Bun.file(join(murmurDir, rel)).text();
    for (const { pattern, re } of leakPatterns) {
      const m = text.match(re);
      if (m) leaks.push({ file: `murmur/${rel}`, pattern, sample: m[0] });
    }
  }

  // Externalization ratio over the configured domain terms.
  let inKnowledge = 0;
  let total = 0;
  const knowledgeGlob = new Glob("{skills,instructions}/**/*.md");
  let knowledgeText = "";
  for await (const rel of knowledgeGlob.scan({ cwd: murmurDir, onlyFiles: true })) {
    knowledgeText += await Bun.file(join(murmurDir, rel)).text();
  }
  let agentText = "";
  for await (const rel of new Glob("{agents,subagents}/**/*.md").scan({
    cwd: murmurDir,
    onlyFiles: true,
  })) {
    agentText += await Bun.file(join(murmurDir, rel)).text();
  }
  for (const term of opts.domainTerms ?? []) {
    const inK = knowledgeText.includes(term);
    const inA = agentText.includes(term);
    if (inK || inA) {
      total++;
      if (inK && !inA) inKnowledge++;
    }
  }
  const externalizedRatio = total === 0 ? 1 : inKnowledge / total;

  return { ok: leaks.length === 0, leaks, externalizedRatio };
}
