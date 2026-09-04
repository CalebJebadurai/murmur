#!/usr/bin/env bun
import { compileCommand } from "./commands/compile.ts";
import { doctorCommand } from "./commands/doctor.ts";
import { listCommand } from "./commands/list.ts";
import { initCommand, type InitMode } from "./commands/init.ts";
import { addCommand, type AddKind } from "./commands/add.ts";
import { publishCommand } from "./commands/publish.ts";
import { runCommand } from "./commands/run.ts";
import { scoreCommand } from "./commands/score.ts";
import { classifyCommand } from "./commands/classify.ts";

const VERSION = "0.1.0";

type Flags = { positionals: string[]; flags: Record<string, string | boolean> };

function parseArgs(argv: string[]): Flags {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

const USAGE = `murmr ${VERSION} — tool-agnostic multi-agent framework

Usage: murmr <command> [options]        (alias: mrmr)

Commands:
  init                       Generate murmur/ from the codebase (structural pass)
  add <kind> <name>          Scaffold an agent|subagent|skill|instruction
  compile [--target <id>]    Compile murmur/ to a runtime (copilot, goose, agy, claude, cursor)
  run <pipeline> [--tier T]  Walk a pipeline (deterministic); emits a RUN-LOG
  score <doc> --rubric <r>   Score a document against a rubric (arithmetic only)
  classify <task>            Classify a task and select an agent roster
  doctor [--fix]             Validate the murmur/ IR (auto-scaffold missing refs)
  list                       Inventory the murmur/ IR
  publish [--out <dir>]      Scrub codebase context into a shareable copy

Global options:
  --help                     Show help
  --version                  Show version

Examples:
  murmr init
  murmr compile --target agy
  murmr classify "refactor auth database queries"
  murmr doctor --fix
  murmr publish --dry-run --strict
`;

async function main(): Promise<number> {
  const { positionals, flags } = parseArgs(Bun.argv.slice(2));
  const cmd = positionals[0];
  const root = process.cwd();

  if (flags["version"]) {
    console.log(VERSION);
    return 0;
  }
  if (flags["help"] || cmd === "help") {
    console.log(USAGE);
    return 0;
  }
  if (!cmd) {
    console.log(USAGE);
    return 1;
  }

  switch (cmd) {
    case "init": {
      const mode = (flags["mode"] as InitMode) ?? undefined;
      return initCommand(root, { mode });
    }
    case "add": {
      const kind = positionals[1] as AddKind | undefined;
      const name = positionals[2];
      if (!kind || !["agent", "subagent", "skill", "instruction"].includes(kind)) {
        console.error("Usage: murmr add <agent|subagent|skill|instruction> <name>");
        return 1;
      }
      return addCommand(root, kind, name ?? "");
    }
    case "compile":
      return compileCommand(root, {
        target: typeof flags["target"] === "string" ? flags["target"] : undefined,
        out: typeof flags["out"] === "string" ? flags["out"] : undefined,
        allowConfigExec: flags["allow-config-exec"] === true,
      });
    case "run": {
      const pipeline = positionals[1];
      if (!pipeline) {
        console.error("Usage: murmr run <pipeline> [--tier <t>] [--branch <b>] [--dry-run]");
        return 1;
      }
      return runCommand(root, {
        pipeline,
        tier: typeof flags["tier"] === "string" ? flags["tier"] : undefined,
        branch: typeof flags["branch"] === "string" ? flags["branch"] : undefined,
        classification:
          typeof flags["classification"] === "string" ? flags["classification"] : undefined,
        dryRun: flags["dry-run"] === true,
        allowRun: flags["allow-run"] === true,
        allowConfigExec: flags["allow-config-exec"] === true,
        out: typeof flags["out"] === "string" ? flags["out"] : undefined,
      });
    }
    case "doctor":
      return doctorCommand(root, { fix: flags["fix"] === true });
    case "score": {
      const document = positionals[1];
      const rubric = typeof flags["rubric"] === "string" ? flags["rubric"] : undefined;
      if (!document || !rubric) {
        console.error("Usage: murmr score <document> --rubric <name>");
        return 1;
      }
      return scoreCommand(root, {
        document,
        rubric,
        out: typeof flags["out"] === "string" ? flags["out"] : undefined,
      });
    }
    case "classify": {
      const task = positionals.slice(1).join(" ");
      if (!task.trim()) {
        console.error('Usage: murmr classify "<task description>"');
        return 1;
      }
      return classifyCommand(root, task, {
        json: flags["json"] === true,
      });
    }
    case "list":
      return listCommand(root);
    case "publish":
      return publishCommand(root, {
        out: typeof flags["out"] === "string" ? flags["out"] : undefined,
        dryRun: flags["dry-run"] === true,
        strict: flags["strict"] === true,
        allowConfigExec: flags["allow-config-exec"] === true,
      });
    default:
      console.error(`Unknown command "${cmd}". Run \`murmr --help\`.`);
      return 1;
  }
}

main().then((code) => process.exit(code));
