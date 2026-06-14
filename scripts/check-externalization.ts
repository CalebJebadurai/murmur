#!/usr/bin/env bun
/**
 * CI gate: fail if any generic agent body contains codebase-specific facts.
 */
import { join } from "node:path";
import { scanExternalization } from "../src/publish/externalization.ts";

const murmurDir = join(import.meta.dir, "..", "murmur");
// Note: we do NOT pass repoName here. "murmur" is the framework's own structural
// directory keyword (agents legitimately reference murmur/subagents/), not a leaked
// project fact. The absolute-path and domain-term checks are the meaningful gate for
// a generic base library. Downstream user projects DO pass their repoName.
const report = await scanExternalization(murmurDir);

if (!report.ok) {
  console.error("Externalization gate FAILED — agent bodies contain project facts:");
  for (const leak of report.leaks) {
    console.error(`  ${leak.file} [${leak.pattern}]: ${leak.sample}`);
  }
  process.exit(1);
}
console.log("Externalization gate passed: no project facts in agent bodies.");
process.exit(0);
