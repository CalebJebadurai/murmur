import { Glob } from "bun";
import { join } from "node:path";
import { templatesDir } from "../util/templates.ts";
import { analyzeStructural, renderStructuralSkills } from "../analyzer/structural.ts";

import { discoverTools, renderToolsSkill } from "./tool.ts";

export type InitMode = "merge" | "overwrite" | "cancel";

export type InitOptions = {
  /** Behavior when murmur/ already exists. Default "merge" (non-interactive safe). */
  mode?: InitMode;
  /** Discover and write project tools skill. */
  tools?: boolean;
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
 * `murmr init` — deterministic structural pass.
 *
 * Copies the generic base library (agents, subagents, the subagent-authoring skill),
 * then overlays codebase-derived structural skills/instructions. No LLM, no network.
 * The semantic pass is a separate agent-invoked step (templates/agents/murmur-init.md).
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

  console.log(
    `init: ${exists ? `${mode} into` : "created"} murmur/ — ${copied} base file(s), ${written} structural file(s).`,
  );
  console.log(
    "For semantic enrichment, run the `murmur-init` agent inside your host agent (Copilot/Claude/goose).",
  );
  return 0;
}
