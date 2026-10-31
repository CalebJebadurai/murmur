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
import { watchCommand } from "./commands/watch.ts";
import { hookCommand, type HookAction } from "./commands/hook.ts";
import { toolCommand } from "./commands/tool.ts";
import { docsCommand } from "./commands/docs.ts";
import { evolveCommand } from "./commands/evolve.ts";
import type { HarnessTargetKind } from "./harness2/types.ts";
import type { ProviderName } from "./providers/types.ts";

const VERSION = "1.1.0"; // x-release-please-version

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
  init                       Generate murmur/ (structural or --semantic via model providers)
  add <kind> <name>          Scaffold an agent|subagent|skill|instruction|tool
  compile [--target <id>]    Compile murmur/ to a runtime (copilot, goose, agy, claude, cursor, codex, opencode, acp)
  watch [--target <id>]      Watch murmur/ for changes and recompile automatically
  hook <install|uninstall|status> Manage Git pre-commit verification hook
  tool [discover|list]       Auto-discover codebase tools and generate tool skills
  docs [--out <dir>] [--serve] Compile a browsable HTML documentation portal
  run <pipeline> [--tier T]  Walk a pipeline (deterministic); emits a RUN-LOG
  score <doc> --rubric <r>   Score a document against a rubric (arithmetic only)
  classify <task>            Classify a task and select an agent roster (--engine jev|heuristic)
  evolve <task> [--k <N>]    Experimental: add a template skill, instruction or subagent
  doctor [--fix]             Validate the murmur/ IR (auto-scaffold missing refs)
  list                       Inventory the murmur/ IR
  publish [--out <dir>]      Scrub codebase context into a shareable copy

Global options:
  --help                     Show help
  --version                  Show version

Examples:
  murmr init --tools
  murmr init --semantic --provider openrouter --model auto
  murmr compile --target agy
  murmr watch --target agy
  murmr hook install
  murmr tool discover --write
  murmr classify "refactor auth database queries"
  murmr doctor --fix
  murmr publish --dry-run --strict
`;

function isProviderName(value: unknown): value is ProviderName {
  return value === "openrouter" || value === "meshapi" || value === "custom";
}

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
      const semantic = flags["semantic"] === true;
      const provider = flags["provider"];
      if (provider !== undefined && !isProviderName(provider)) {
        console.error('Unknown --provider. Use "openrouter", "meshapi" or "custom".');
        return 1;
      }
      const model = typeof flags["model"] === "string" ? flags["model"] : undefined;
      return initCommand(root, {
        mode,
        tools: flags["tools"] === true,
        semantic,
        provider,
        model,
      });
    }
    case "add": {
      const kind = positionals[1] as AddKind | undefined;
      const name = positionals[2];
      if (!kind || !["agent", "subagent", "skill", "instruction", "tool"].includes(kind)) {
        console.error("Usage: murmr add <agent|subagent|skill|instruction|tool> <name>");
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
    case "watch":
      return watchCommand(root, {
        target: typeof flags["target"] === "string" ? flags["target"] : undefined,
        out: typeof flags["out"] === "string" ? flags["out"] : undefined,
        allowConfigExec: flags["allow-config-exec"] === true,
        once: flags["once"] === true,
      });
    case "hook": {
      const action = (positionals[1] as HookAction) || "install";
      return hookCommand(root, action);
    }
    case "tool": {
      const action = positionals[1] === "list" ? "list" : "discover";
      return toolCommand(root, action, {
        write: flags["write"] === true,
        json: flags["json"] === true,
      });
    }
    case "docs":
      return docsCommand(root, {
        out: typeof flags["out"] === "string" ? flags["out"] : undefined,
        serve: flags["serve"] === true,
        port: typeof flags["port"] === "string" ? parseInt(flags["port"], 10) : undefined,
      });
    case "run": {
      const pipeline = positionals[1];
      if (!pipeline) {
        console.error("Usage: murmr run <pipeline> [--tier <t>] [--branch <b>] [--concurrency <n>] [--retries <n>] [--dry-run]");
        return 1;
      }
      const concurrencyRaw = flags["concurrency"] ?? flags["c"];
      const concurrency = typeof concurrencyRaw === "string" ? parseInt(concurrencyRaw, 10) : typeof concurrencyRaw === "number" ? concurrencyRaw : undefined;
      const retriesRaw = flags["retries"];
      const retries = typeof retriesRaw === "string" ? parseInt(retriesRaw, 10) : typeof retriesRaw === "number" ? retriesRaw : undefined;
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
        concurrency: Number.isFinite(concurrency) ? concurrency : undefined,
        retries: Number.isFinite(retries) ? retries : undefined,
        sandbox: typeof flags["sandbox"] === "string" ? flags["sandbox"] : undefined,
        sandboxImage: typeof flags["sandbox-image"] === "string" ? flags["sandbox-image"] : undefined,
        sandboxUrl: typeof flags["sandbox-url"] === "string" ? flags["sandbox-url"] : undefined,
        sandboxToken: typeof flags["sandbox-token"] === "string" ? flags["sandbox-token"] : undefined,
        sandboxTimeoutMs: typeof flags["sandbox-timeout"] === "string" ? parseInt(flags["sandbox-timeout"], 10) : undefined,
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
        console.error('Usage: murmr classify "<task description>" [--engine jev|heuristic]');
        return 1;
      }
      const engine = flags["jev"] || flags["engine"] === "jev" ? "jev" : "heuristic";
      return classifyCommand(root, task, {
        json: flags["json"] === true,
        engine,
        forceMock: flags["mock"] === true,
      });
    }
    case "evolve": {
      const task = positionals.slice(1).join(" ");
      if (!task.trim()) {
        console.error('Usage: murmr evolve "<task description>" [--k <N>] [--kind skill|instruction|subagent] [--dry-run]');
        return 1;
      }
      const kRaw = flags["k"];
      const k = typeof kRaw === "string" ? parseInt(kRaw, 10) : typeof kRaw === "number" ? kRaw : 3;
      return evolveCommand(root, task, {
        k: Number.isFinite(k) ? k : 3,
        targetKind: typeof flags["kind"] === "string" ? (flags["kind"] as HarnessTargetKind) : undefined,
        dryRun: flags["dry-run"] === true,
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
