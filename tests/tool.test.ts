import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { discoverTools, renderToolsSkill, toolCommand } from "../src/commands/tool.ts";
import { runDoctor } from "../src/commands/doctor.ts";

async function scratchProject(): Promise<string> {
  const root = join(tmpdir(), `murmur-tool-${crypto.randomUUID()}`);
  await mkdir(root, { recursive: true });
  return root;
}

describe("murmr tool auto-discovery", () => {
  test("discovers and categorizes package.json scripts", async () => {
    const root = await scratchProject();
    try {
      await Bun.write(
        join(root, "package.json"),
        JSON.stringify(
          {
            name: "test-app",
            scripts: {
              test: "bun test",
              lint: "eslint .",
              typecheck: "tsc --noEmit",
              build: "bun build ./src/index.ts",
              start: "bun run ./dist/index.js",
            },
          },
          null,
          2,
        ),
      );
      await Bun.write(join(root, "bun.lock"), "");

      const tools = await discoverTools(root);
      expect(tools.length).toBe(5);

      const testTool = tools.find((t) => t.name === "test");
      expect(testTool).toBeDefined();
      expect(testTool?.category).toBe("test");
      expect(testTool?.command).toBe("bun test");

      const typecheckTool = tools.find((t) => t.name === "typecheck");
      expect(typecheckTool).toBeDefined();
      expect(typecheckTool?.category).toBe("typecheck");

      const lintTool = tools.find((t) => t.name === "lint");
      expect(lintTool).toBeDefined();
      expect(lintTool?.category).toBe("lint");

      const buildTool = tools.find((t) => t.name === "build");
      expect(buildTool).toBeDefined();
      expect(buildTool?.category).toBe("build");

      const startTool = tools.find((t) => t.name === "start");
      expect(startTool).toBeDefined();
      expect(startTool?.category).toBe("dev");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("discovers Rust Cargo.toml tools", async () => {
    const root = await scratchProject();
    try {
      await Bun.write(
        join(root, "Cargo.toml"),
        `[package]\nname = "rust-app"\nversion = "0.1.0"\n`,
      );
      const tools = await discoverTools(root);
      expect(tools.some((t) => t.name === "cargo-test" && t.category === "test")).toBe(true);
      expect(tools.some((t) => t.name === "cargo-clippy" && t.category === "lint")).toBe(true);
      expect(tools.some((t) => t.name === "cargo-build" && t.category === "build")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("discovers Python pyproject.toml tools", async () => {
    const root = await scratchProject();
    try {
      await Bun.write(
        join(root, "pyproject.toml"),
        `[tool.pytest.ini_options]\naddopts = "-ra -q"\n[tool.ruff]\nline-length = 88\n[tool.mypy]\nstrict = true\n`,
      );
      const tools = await discoverTools(root);
      expect(tools.some((t) => t.name === "pytest" && t.category === "test")).toBe(true);
      expect(tools.some((t) => t.name === "ruff" && t.category === "lint")).toBe(true);
      expect(tools.some((t) => t.name === "mypy" && t.category === "typecheck")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("discovers Makefile targets", async () => {
    const root = await scratchProject();
    try {
      await Bun.write(
        join(root, "Makefile"),
        `test:\n\tpytest\n\nlint:\n\tflake8\n\nbuild:\n\tgo build\n`,
      );
      const tools = await discoverTools(root);
      expect(tools.some((t) => t.name === "test" && t.command === "make test")).toBe(true);
      expect(tools.some((t) => t.name === "lint" && t.command === "make lint")).toBe(true);
      expect(tools.some((t) => t.name === "build" && t.command === "make build")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("renderToolsSkill emits doctor-compliant markdown", async () => {
    const tools = [
      {
        name: "test",
        category: "test" as const,
        command: "bun test",
        description: "Run unit tests",
        source: "package.json",
      },
    ];
    const skillContent = renderToolsSkill(tools);
    expect(skillContent).toContain("name: project-tools");
    expect(skillContent).toContain("description:");
    expect(skillContent).toContain("`bun test`");
  });

  test("toolCommand supports --write and creates valid doctor IR", async () => {
    const root = await scratchProject();
    const murmurDir = join(root, "murmur");
    const { $ } = await import("bun");
    await mkdir(murmurDir, { recursive: true });
    const BASE_MURMUR = join(import.meta.dir, "..", "murmur");
    await $`cp -R ${BASE_MURMUR}/. ${murmurDir}`.quiet();

    try {
      await Bun.write(
        join(root, "package.json"),
        JSON.stringify({ name: "my-app", scripts: { test: "bun test" } }),
      );
      const code = await toolCommand(root, "discover", { write: true });
      expect(code).toBe(0);

      const skillPath = join(murmurDir, "skills", "project-tools", "SKILL.md");
      expect(await Bun.file(skillPath).exists()).toBe(true);

      const doctorReport = await runDoctor(murmurDir);
      expect(doctorReport.ok).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
