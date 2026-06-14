import { Glob } from "bun";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../util/loadConfig.ts";
import { scrubText } from "../publish/scrub.ts";
import type { SecretFinding } from "../publish/secrets.ts";

export type PublishOptions = {
  out?: string;
  dryRun?: boolean;
  strict?: boolean;
  allowConfigExec?: boolean;
};

/**
 * `murmur publish` — defense-in-depth context stripping.
 *
 * Reads murmur/ and writes a scrubbed copy to a SEPARATE directory (never mutates
 * the source). `--dry-run` writes nothing and shows the scrub summary. `--strict`
 * fails if any high-entropy or known-secret-pattern string survives in the output.
 */
export async function publishCommand(
  projectRoot: string,
  opts: PublishOptions,
): Promise<number> {
  const murmurDir = join(projectRoot, "murmur");
  if (!existsSync(join(murmurDir, "agents"))) {
    console.error('No murmur/ directory found. Run "murmur init" first.');
    return 1;
  }
  const outDir = join(projectRoot, opts.out ?? "murmur-clean");
  if (!opts.dryRun && outDir.startsWith(murmurDir)) {
    console.error("Output directory must be separate from the murmur/ source.");
    return 1;
  }

  const config = await loadConfig(projectRoot, { allowConfigExec: opts.allowConfigExec });
  const repoName = config.project.name;

  let totalReplacements = 0;
  let fileCount = 0;
  const survivors: { file: string; findings: SecretFinding[] }[] = [];

  const glob = new Glob("**/*");
  for await (const rel of glob.scan({ cwd: murmurDir, onlyFiles: true })) {
    const src = await Bun.file(join(murmurDir, rel)).text();
    const result = scrubText(src, config.publish ?? {}, repoName);
    totalReplacements += result.replacements;
    fileCount++;
    if (result.secretFindings.length) {
      survivors.push({ file: `murmur/${rel}`, findings: result.secretFindings });
    }
    if (!opts.dryRun) {
      await Bun.write(join(outDir, rel), result.contents);
    }
  }

  console.log(
    `publish: ${opts.dryRun ? "(dry-run) " : ""}${fileCount} file(s), ${totalReplacements} replacement(s)` +
      `${opts.dryRun ? "" : ` -> ${opts.out ?? "murmur-clean"}/`}`,
  );

  if (survivors.length) {
    console.error(`publish: ${survivors.length} file(s) with surviving secret-shaped strings:`);
    for (const s of survivors) {
      for (const f of s.findings) {
        console.error(`  ${s.file}: [${f.rule}] ${f.match.slice(0, 12)}…`);
      }
    }
    if (opts.strict) {
      console.error("publish: --strict failing due to surviving secrets.");
      return 1;
    }
    console.error("publish: WARNING — review these before sharing (defense-in-depth, not a guarantee).");
  }

  console.log("publish: scrubbing is defense-in-depth; you own final verification.");
  return 0;
}
