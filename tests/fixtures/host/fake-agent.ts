#!/usr/bin/env bun
/**
 * Fake host agent CLI for testing the run driver's Bun.spawn delegation.
 * Behavior is driven by the --agent value so tests can exercise each path.
 */
const args = Bun.argv.slice(2);
let agent = "";
let prompt = "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--agent") agent = args[++i] ?? "";
  else if (args[i] === "--prompt") prompt = args[++i] ?? "";
}

switch (agent) {
  case "fail":
    process.stderr.write("boom\n");
    process.exit(2);
    break;
  case "huge":
    process.stdout.write("x".repeat(512 * 1024));
    process.exit(0);
    break;
  case "scorer":
    process.stdout.write("some reasoning...\nMURMUR_SCORE: 7\n");
    process.exit(0);
    break;
  case "exiter":
    process.stdout.write("MURMUR_EARLY_EXIT\n");
    process.exit(0);
    break;
  default:
    // Echo the prompt back verbatim — used to prove argv-array injection safety:
    // shell metacharacters in the agent/prompt are treated as literal data.
    process.stdout.write(`ran ${agent}: ${prompt}\n`);
    process.exit(0);
}
