import { Glob } from "bun";
import { join } from "node:path";

export type StructuralFacts = {
  projectName: string;
  packageManager: string;
  scripts: Record<string, string>;
  dependencies: string[];
  hasTsconfig: boolean;
  testRunner: string;
  ciFiles: string[];
  topLevelDirs: string[];
  languages: string[];
};

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    if (!(await Bun.file(path).exists())) return null;
    return JSON.parse(await Bun.file(path).text());
  } catch {
    return null;
  }
}

async function detectPackageManager(root: string): Promise<string> {
  if (await Bun.file(join(root, "bun.lockb")).exists()) return "bun";
  if (await Bun.file(join(root, "bun.lock")).exists()) return "bun";
  if (await Bun.file(join(root, "pnpm-lock.yaml")).exists()) return "pnpm";
  if (await Bun.file(join(root, "yarn.lock")).exists()) return "yarn";
  if (await Bun.file(join(root, "package-lock.json")).exists()) return "npm";
  return "unknown";
}

async function detectTestRunner(
  root: string,
  scripts: Record<string, string>,
  deps: string[],
): Promise<string> {
  const t = scripts["test"] ?? "";
  if (t.includes("bun test")) return "bun:test";
  if (deps.includes("vitest") || (await Bun.file(join(root, "vitest.config.ts")).exists()))
    return "vitest";
  if (deps.includes("jest")) return "jest";
  if (t.includes("bun test")) return "bun:test";
  return "unknown";
}

async function topLevelDirs(root: string): Promise<string[]> {
  const out: string[] = [];
  const glob = new Glob("*");
  for await (const entry of glob.scan({ cwd: root, onlyFiles: false })) {
    if (
      ["node_modules", ".git", "dist", "build", ".murmur"].includes(entry) ||
      entry.startsWith(".")
    )
      continue;
    out.push(entry);
  }
  return out.sort();
}

async function detectLanguages(root: string): Promise<string[]> {
  const langs = new Set<string>();
  const checks: [string, string][] = [
    ["**/*.ts", "TypeScript"],
    ["**/*.tsx", "TypeScript"],
    ["**/*.js", "JavaScript"],
    ["**/*.py", "Python"],
    ["**/*.go", "Go"],
    ["**/*.rs", "Rust"],
  ];
  for (const [pattern, lang] of checks) {
    const glob = new Glob(pattern);
    for await (const _ of glob.scan({ cwd: root, onlyFiles: true, dot: false })) {
      langs.add(lang);
      break;
    }
  }
  return [...langs];
}

/** Pure static analysis — no LLM, no network. */
export async function analyzeStructural(root: string): Promise<StructuralFacts> {
  const pkg = (await readJson(join(root, "package.json"))) ?? {};
  const scripts = (pkg["scripts"] as Record<string, string>) ?? {};
  const deps = [
    ...Object.keys((pkg["dependencies"] as Record<string, string>) ?? {}),
    ...Object.keys((pkg["devDependencies"] as Record<string, string>) ?? {}),
  ];
  const packageManager = await detectPackageManager(root);
  const testRunner = await detectTestRunner(root, scripts, deps);
  const ciFiles: string[] = [];
  const ciGlob = new Glob(".github/workflows/*.{yml,yaml}");
  for await (const f of ciGlob.scan({ cwd: root, onlyFiles: true })) ciFiles.push(f);

  return {
    projectName: (pkg["name"] as string) ?? "unnamed-project",
    packageManager,
    scripts,
    dependencies: deps,
    hasTsconfig: await Bun.file(join(root, "tsconfig.json")).exists(),
    testRunner,
    ciFiles: ciFiles.sort(),
    topLevelDirs: await topLevelDirs(root),
    languages: await detectLanguages(root),
  };
}

/** Render the structural facts into skill and instruction markdown bodies. */
export function renderStructuralSkills(
  facts: StructuralFacts,
): { path: string; contents: string }[] {
  const files: { path: string; contents: string }[] = [];

  files.push({
    path: "skills/project-structure/SKILL.md",
    contents: `---
name: project-structure
description: Directory layout and module map of ${facts.projectName}.
---

# Project Structure

- **Top-level directories:** ${facts.topLevelDirs.join(", ") || "(none detected)"}
- **Languages:** ${facts.languages.join(", ") || "(unknown)"}
- **TypeScript config present:** ${facts.hasTsconfig ? "yes" : "no"}
`,
  });

  const scriptLines = Object.entries(facts.scripts)
    .map(([k, v]) => `- \`${k}\`: \`${v}\``)
    .join("\n");
  files.push({
    path: "skills/build-system/SKILL.md",
    contents: `---
name: build-system
description: How ${facts.projectName} is built, tested, and run.
---

# Build System

- **Package manager:** ${facts.packageManager}
- **Scripts:**
${scriptLines || "- (none)"}
`,
  });

  files.push({
    path: "skills/test-conventions/SKILL.md",
    contents: `---
name: test-conventions
description: Test runner and conventions for ${facts.projectName}.
---

# Test Conventions

- **Test runner:** ${facts.testRunner}
- **CI workflows:** ${facts.ciFiles.join(", ") || "(none detected)"}
`,
  });

  if (facts.languages.includes("TypeScript")) {
    files.push({
      path: "instructions/typescript-conventions.md",
      contents: `---
applyTo: "**/*.ts"
---

# TypeScript Conventions

Generated from static analysis of ${facts.projectName}.

- Package manager: ${facts.packageManager}.
- Use the project's existing import and module style.
`,
    });
  }

  return files;
}
