import { Glob } from "bun";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { backupFile, backupStamp } from "../util/backup.ts";
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
  const base = join(templatesDir(), "base");

  // Overwrite mode still keeps a copy of everything it replaces.
  if (overwrite && existsSync(murmurDir)) {
    const stamp = backupStamp();
    const entries = await readdir(murmurDir, { recursive: true, withFileTypes: true });
    for (const e of entries.filter((entry) => entry.isFile())) {
      await backupFile(projectRoot, relative(projectRoot, join(e.parentPath, e.name)), stamp);
    }
    console.log(`init: backed up existing murmur/ under .murmur/backups/${stamp}/`);
  }

  // Note what already exists first, so base placeholders never count as the user's files.
  const facts = await analyzeStructural(projectRoot);
  const structural = renderStructuralSkills(facts);
  const isYours = (path: string): boolean => !overwrite && existsSync(join(murmurDir, path));
  const yours = new Set(structural.map((f) => f.path).filter(isYours));
  const toolsAreYours = isYours(join("skills", "project-tools", "SKILL.md"));
  const overviewIsYours = isYours(join("skills", "domain-overview", "SKILL.md"));

  // 1. Lay down the generic base library. Existing agents and skills are skipped.
  const copied = await copyDir(base, murmurDir, overwrite);

  // 2. Overlay codebase-derived structural skills & instructions, replacing the
  //    base placeholders but never a file that was already there.
  let written = 0;
  for (const f of structural) {
    if (yours.has(f.path)) {
      console.log(`init: kept your existing ${f.path}`);
      continue;
    }
    const dest = join(murmurDir, f.path);
    await Bun.write(dest, f.contents);
    written++;
  }

  // 3. If tools requested, discover and write project-tools skill
  if (opts.tools) {
    const tools = await discoverTools(projectRoot);
    if (tools.length > 0 && !toolsAreYours) {
      const dest = join(murmurDir, "skills", "project-tools", "SKILL.md");
      await Bun.write(dest, renderToolsSkill(tools));
      written++;
    }
  }

  // 4. Optional semantic enrichment pass via pluggable model provider
  if (opts.semantic && overviewIsYours) {
    console.log("init: kept your existing skills/domain-overview/SKILL.md");
  } else if (opts.semantic) {
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
