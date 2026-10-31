import { evolveTask } from "../harness2/engine.ts";
import type { EvolveOptions } from "../harness2/types.ts";

/**
 * CLI command entry point: murmr evolve "<task description>"
 * Experimental: writes a template skill, instruction or subagent after structural checks.
 */
export async function evolveCommand(
  projectRoot: string,
  task: string,
  opts?: EvolveOptions,
): Promise<number> {
  try {
    console.log(`\n┌─ murmr evolve (experimental) ────────────────────────────────`);
    console.log(`│ Task : "${task}"`);
    console.log(`│ Mode : Template candidates with structural checks (k=${opts?.k ?? 3})`);
    console.log(`│ Note : Experimental. Candidates are not run against an agent.`);
    console.log(`└───────────────────────────────────────────────────────────────\n`);

    const result = await evolveTask(task, projectRoot, opts);

    if (opts?.json) {
      console.log(JSON.stringify(result, null, 2));
      return 0;
    }

    console.log(`✓ Proposed : ${result.candidatesProposed} candidate harness modification(s)`);
    console.log(`✓ Checked  : ${result.probesRun} candidate(s), structure only`);

    if (result.selectedCandidate) {
      console.log(`✓ Composed : ${result.selectedCandidate.kind} "${result.selectedCandidate.targetName}"`);
      if (result.composedFilePath) {
        console.log(`  File     : ${result.composedFilePath}`);
      }
    }

    console.log(`✓ Experience: ${result.experienceSummary}`);
    console.log(`✓ Doctor   : ${result.doctorPassed ? "PASSED (Valid IR)" : "WARNING: IR requires attention"}\n`);

    return result.doctorPassed ? 0 : 1;
  } catch (err) {
    console.error("Error executing murmr evolve:", err);
    return 1;
  }
}
