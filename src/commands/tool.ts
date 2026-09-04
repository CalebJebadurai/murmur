import { join } from "node:path";
import { existsSync } from "node:fs";

export type ToolCategory = "test" | "lint" | "typecheck" | "build" | "dev" | "package" | "other";

export type DiscoveredTool = {
  name: string;
  category: ToolCategory;
  command: string;
  description: string;
  source: string;
};

export type ToolOptions = {
  write?: boolean;
  json?: boolean;
};

async function readJsonSafe(path: string): Promise<Record<string, unknown> | null> {
  try {
    if (!existsSync(path)) return null;
    const text = await Bun.file(path).text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function detectRunner(root: string): Promise<string> {
  if (existsSync(join(root, "bun.lock")) || existsSync(join(root, "bun.lockb"))) return "bun";
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  if (existsSync(join(root, "package-lock.json"))) return "npm";
  return "npm";
}

function categorizeScript(name: string, cmd: string): { category: ToolCategory; desc: string } {
  const n = name.toLowerCase();
  const c = cmd.toLowerCase();

  if (n === "test" || n.startsWith("test:") || c.includes("bun test") || c.includes("vitest") || c.includes("jest") || c.includes("mocha")) {
    return { category: "test", desc: "Run test suite" };
  }
  if (n.includes("typecheck") || n === "check" || c.includes("tsc --noemit") || c.includes("tsc -p") || c.includes("pyright") || c.includes("mypy")) {
    return { category: "typecheck", desc: "Type check codebase" };
  }
  if (n.includes("lint") || n.includes("format") || c.includes("eslint") || c.includes("biome") || c.includes("prettier") || c.includes("ruff")) {
    return { category: "lint", desc: "Static analysis & formatting" };
  }
  if (n === "build" || n.startsWith("build:") || c.includes("bun build") || c.includes("vite build") || c.includes("tsup") || c.includes("webpack")) {
    return { category: "build", desc: "Compile production assets" };
  }
  if (n === "dev" || n === "start" || n === "serve") {
    return { category: "dev", desc: "Start local development server" };
  }
  if (n === "publish" || n.includes("release") || n === "pack") {
    return { category: "package", desc: "Package or publish distribution" };
  }
  return { category: "other", desc: `Run script "${name}"` };
}

export async function discoverTools(projectRoot: string): Promise<DiscoveredTool[]> {
  const tools: DiscoveredTool[] = [];
  const runner = await detectRunner(projectRoot);

  // 1. Node / Bun package.json
  const pkgPath = join(projectRoot, "package.json");
  const pkg = await readJsonSafe(pkgPath);
  if (pkg && typeof pkg["scripts"] === "object" && pkg["scripts"] !== null) {
    const scripts = pkg["scripts"] as Record<string, string>;
    for (const [name, scriptCmd] of Object.entries(scripts)) {
      const { category, desc } = categorizeScript(name, scriptCmd);
      let runCmd: string;
      if (runner === "bun") {
        runCmd = name === "test" && scriptCmd.startsWith("bun test") ? "bun test" : `bun run ${name}`;
      } else if (runner === "pnpm") {
        runCmd = name === "test" ? "pnpm test" : `pnpm ${name}`;
      } else if (runner === "yarn") {
        runCmd = `yarn ${name}`;
      } else {
        runCmd = name === "test" ? "npm test" : `npm run ${name}`;
      }

      tools.push({
        name,
        category,
        command: runCmd,
        description: desc,
        source: "package.json (scripts)",
      });
    }
  }

  // 2. Rust Cargo.toml
  const cargoPath = join(projectRoot, "Cargo.toml");
  if (existsSync(cargoPath)) {
    tools.push({
      name: "cargo-test",
      category: "test",
      command: "cargo test",
      description: "Run Rust unit and integration tests",
      source: "Cargo.toml",
    });
    tools.push({
      name: "cargo-clippy",
      category: "lint",
      command: "cargo clippy -- -D warnings",
      description: "Rust linter and idiom validator",
      source: "Cargo.toml",
    });
    tools.push({
      name: "cargo-check",
      category: "typecheck",
      command: "cargo check",
      description: "Fast type and compilation verification",
      source: "Cargo.toml",
    });
    tools.push({
      name: "cargo-build",
      category: "build",
      command: "cargo build --release",
      description: "Compile release binary",
      source: "Cargo.toml",
    });
  }

  // 3. Python pyproject.toml / requirements.txt
  const pyprojectPath = join(projectRoot, "pyproject.toml");
  const reqsPath = join(projectRoot, "requirements.txt");
  if (existsSync(pyprojectPath) || existsSync(reqsPath)) {
    let pyContent = "";
    if (existsSync(pyprojectPath)) pyContent += await Bun.file(pyprojectPath).text();
    if (existsSync(reqsPath)) pyContent += await Bun.file(reqsPath).text();

    if (pyContent.includes("pytest") || existsSync(join(projectRoot, "pytest.ini"))) {
      tools.push({
        name: "pytest",
        category: "test",
        command: "pytest",
        description: "Run Python test suite",
        source: "Python configuration",
      });
    }
    if (pyContent.includes("ruff")) {
      tools.push({
        name: "ruff",
        category: "lint",
        command: "ruff check .",
        description: "Fast Python linter",
        source: "pyproject.toml",
      });
    }
    if (pyContent.includes("mypy")) {
      tools.push({
        name: "mypy",
        category: "typecheck",
        command: "mypy .",
        description: "Static type checker for Python",
        source: "pyproject.toml",
      });
    }
  }

  // 4. Go go.mod
  const goModPath = join(projectRoot, "go.mod");
  if (existsSync(goModPath)) {
    tools.push({
      name: "go-test",
      category: "test",
      command: "go test ./...",
      description: "Run Go test suite",
      source: "go.mod",
    });
    tools.push({
      name: "go-lint",
      category: "lint",
      command: "golangci-lint run",
      description: "Go static analysis linter",
      source: "go.mod",
    });
    tools.push({
      name: "go-build",
      category: "build",
      command: "go build ./...",
      description: "Compile Go packages",
      source: "go.mod",
    });
  }

  // 5. Makefile
  const makefilePath = join(projectRoot, "Makefile");
  if (existsSync(makefilePath)) {
    const content = await Bun.file(makefilePath).text();
    const targetMatches = content.matchAll(/^([a-zA-Z0-9_-]+):/gm);
    const existingNames = new Set(tools.map((t) => t.name));
    for (const match of targetMatches) {
      const target = match[1];
      if (!target || target.startsWith(".") || target === "help") continue;
      if (["test", "lint", "build", "check", "clean"].includes(target) && !existingNames.has(target)) {
        tools.push({
          name: target,
          category: target === "test" ? "test" : target === "lint" ? "lint" : target === "check" ? "typecheck" : "build",
          command: `make ${target}`,
          description: `Run Makefile target "${target}"`,
          source: "Makefile",
        });
      }
    }
  }

  return tools;
}

export function renderToolsSkill(tools: DiscoveredTool[]): string {
  const rows = tools
    .map((t) => `| \`${t.name}\` | \`${t.category}\` | \`${t.command}\` | ${t.description} | ${t.source} |`)
    .join("\n");

  return `---
name: project-tools
description: Discovered operational development tools and scripts for agent execution.
---

# Project Tools

These operational commands have been verified and discovered from the repository structure:

| Tool | Category | Command | Description | Source |
|---|---|---|---|---|
${rows || "| (none) | | | | |"}

## Usage Guidelines
- Agents should invoke these exact commands when testing, linting, typechecking, or building the codebase.
- Prefer existing project scripts over raw third-party tool invocations.
`;
}

/** `murmr tool <discover|list> [--write] [--json]` — auto-discover and scaffold tools. */
export async function toolCommand(
  projectRoot: string,
  action: "discover" | "list" = "discover",
  opts: ToolOptions = {},
): Promise<number> {
  const tools = await discoverTools(projectRoot);

  if (opts.json) {
    console.log(JSON.stringify({ count: tools.length, tools }, null, 2));
    return 0;
  }

  if (tools.length === 0) {
    console.log("tool: no standard development tools or scripts detected in this project.");
    return 0;
  }

  console.log(`tool: discovered ${tools.length} project tool(s):\n`);
  const maxName = Math.max(...tools.map((t) => t.name.length), 4);
  const maxCat = Math.max(...tools.map((t) => t.category.length), 8);

  for (const t of tools) {
    const padName = t.name.padEnd(maxName);
    const padCat = `[${t.category}]`.padEnd(maxCat + 2);
    console.log(`  ${padCat} ${padName} -> ${t.command} (${t.source})`);
  }

  if (opts.write) {
    const murmurDir = join(projectRoot, "murmur");
    if (!existsSync(murmurDir)) {
      console.error('Cannot write skill: no murmur/ directory found. Run "murmr init" first.');
      return 1;
    }
    const skillDir = join(murmurDir, "skills", "project-tools");
    const skillPath = join(skillDir, "SKILL.md");
    await Bun.write(skillPath, renderToolsSkill(tools));
    console.log(`\ntool: wrote skill definition to murmur/skills/project-tools/SKILL.md`);
  }

  return 0;
}
