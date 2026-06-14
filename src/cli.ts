#!/usr/bin/env bun
import { compileCommand } from "./commands/compile.ts";
import { doctorCommand } from "./commands/doctor.ts";
import { listCommand } from "./commands/list.ts";
import { initCommand, type InitMode } from "./commands/init.ts";
import { addCommand, type AddKind } from "./commands/add.ts";
import { publishCommand } from "./commands/publish.ts";

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

const USAGE = `murmur ${VERSION} — tool-agnostic multi-agent framework

Usage: murmur <command> [options]

Commands:
  init                       Generate murmur/ from the codebase (structural pass)
  add <kind> <name>          Scaffold an agent|subagent|skill|instruction
  compile [--target <id>]    Compile murmur/ to a runtime (copilot, goose)
  doctor                     Validate the murmur/ IR
  list                       Inventory the murmur/ IR
  publish [--out <dir>]      Scrub codebase context into a shareable copy

Global options:
  --help                     Show help
  --version                  Show version

Examples:
  murmur init
  murmur compile --target copilot
  murmur publish --dry-run --strict
`;

async function main(): Promise<number> {
  const { positionals, flags } = parseArgs(Bun.argv.slice(2));
  const cmd = positionals[0];
  const root = process.cwd();

  if (flags["version"]) {
    console.log(VERSION);
    return 0;
  }
  if (!cmd || flags["help"] || cmd === "help") {
    console.log(USAGE);
    return cmd ? 0 : 1;
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
        console.error("Usage: murmur add <agent|subagent|skill|instruction> <name>");
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
    case "doctor":
      return doctorCommand(root);
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
      console.error(`Unknown command "${cmd}". Run \`murmur --help\`.`);
      return 1;
  }
}

main().then((code) => process.exit(code));
