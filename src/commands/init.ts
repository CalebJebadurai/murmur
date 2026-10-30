import { Glob } from "bun";
import { join } from "node:path";
import { templatesDir } from "../util/templates.ts";
import { analyzeStructural, renderStructuralSkills } from "../analyzer/structural.ts";

import { discoverTools, renderToolsSkill } from "./tool.ts";

import { ProviderClient } from "../providers/client.ts";
import type { IProviderClient, ProviderName } from "../providers/types.ts";

export type InitMode = "merge" | "overwrite" | "cancel";

export type InitOptions = {
  /** Behavior when murmur/ already exists. Default "merge" (non-interactive safe). */
  mode?: InitMode;
  /** Discover and write project tools skill. */
  tools?: boolean;
  /** Enable semantic LLM-driven codebase analysis pass. */
  semantic?: boolean;
  /** Inference provider to use (default: "openrouter"). */
  provider?: ProviderName;
  /** Target model name or tier selector (default: auto). */
  model?: string;
  /** Injected provider client for testing. */
  client?: IProviderClient;
};

async function copyDir(from: string, to: string, overwrite: boolean): Promise<number> {
  let count = 0;
  const glob = new Glob("**/*");
  for await (const rel of glob.scan({ cwd: from, onlyFiles: true })) {
    const dest = join(to, rel);
    if (!overwrite && (await Bun.file(dest).exists())) continue;
    await Bun.write(dest, await Bun.file(join(from, rel)).text());
    count++;
  }
  return count;
}

/**
 * `murmr init` — deterministic structural pass + optional semantic enrichment.
 *
 * Copies the generic base library (agents, subagents, the subagent-authoring skill),
 * overlays codebase-derived structural skills/instructions, and optionally synthesizes
 * domain-specific semantic skills via OpenRouter/MeshAPI.
 */
export async function initCommand(
  projectRoot: string,
  opts: InitOptions = {},
): Promise<number> {
  const murmurDir = join(projectRoot, "murmur");
  const exists = await Bun.file(join(murmurDir, "agents", "master.md")).exists();
  const mode: InitMode = opts.mode ?? "merge";

  if (exists && mode === "cancel") {
    console.log("init cancelled: murmur/ already exists.");
    return 0;
  }
  const overwrite = mode === "overwrite";

  // 1. Lay down the generic base library.
  const base = join(templatesDir(), "base");
  const copied = await copyDir(base, murmurDir, overwrite);

  // 2. Overlay codebase-derived structural skills & instructions.
  //    These always reflect the current codebase, so they overwrite the base
  //    placeholders even in merge mode.
  const facts = await analyzeStructural(projectRoot);
  const structural = renderStructuralSkills(facts);
  let written = 0;
  for (const f of structural) {
    const dest = join(murmurDir, f.path);
    await Bun.write(dest, f.contents);
    written++;
  }

  // 3. If tools requested, discover and write project-tools skill
  if (opts.tools) {
    const tools = await discoverTools(projectRoot);
    if (tools.length > 0) {
      const dest = join(murmurDir, "skills", "project-tools", "SKILL.md");
      await Bun.write(dest, renderToolsSkill(tools));
      written++;
    }
  }

  // 4. Optional semantic enrichment pass via pluggable model provider
  if (opts.semantic) {
    try {
      const client =
        opts.client ??
        new ProviderClient({
          provider: opts.provider ?? "openrouter",
          defaultModel: opts.model,
        });

      const prompt = `Analyze this codebase and generate a domain-overview skill for AI agents working in this project.
Project Name: ${facts.projectName}
Package Manager: ${facts.packageManager}
Languages: ${facts.languages.join(", ")}
Top-level directories: ${facts.topLevelDirs.join(", ")}
Key Dependencies: ${facts.dependencies.slice(0, 15).join(", ")}
Scripts: ${Object.keys(facts.scripts).join(", ")}

Generate a SKILL.md file with YAML frontmatter:
---
name: domain-overview
description: High-level domain architectural overview and engineering conventions for ${facts.projectName}
---
# Domain Overview: ${facts.projectName}
`;
      console.log(
        `init: running semantic enrichment via ${opts.provider ?? "openrouter"}...`,
      );
      const resp = await client.complete({
        messages: [{ role: "user", content: prompt }],
        tier: "reasoning",
        model: opts.model,
      });

      if (resp.content) {
        let content = resp.content.trim();
        // Extract markdown if wrapped in ```markdown ... ```
        if (content.startsWith("```markdown")) {
          content = content.slice(11).replace(/```$/, "").trim();
        } else if (content.startsWith("```md")) {
          content = content.slice(5).replace(/```$/, "").trim();
        } else if (content.startsWith("```")) {
          content = content.slice(3).replace(/```$/, "").trim();
        }

        if (!content.startsWith("---")) {
          content = `---\nname: domain-overview\ndescription: Domain overview for ${facts.projectName}\n---\n\n${content}`;
        }

        const skillDest = join(murmurDir, "skills", "domain-overview", "SKILL.md");
        await Bun.write(skillDest, content);
        written++;
        console.log(
          `init: synthesized semantic skill domain-overview using ${resp.model} (${resp.tier} tier)`,
        );
      }
    } catch (err) {
      console.warn(
        `init: semantic pass failed (${err instanceof Error ? err.message : String(err)}); structural init retained.`,
      );
    }
  }

  console.log(
    `init: ${exists ? `${mode} into` : "created"} murmur/ — ${copied} base file(s), ${written} generated file(s).`,
  );
  if (!opts.semantic) {
    console.log(
      "For semantic enrichment, run `murmr init --semantic` or use host agent.",
    );
  }
  return 0;
}
