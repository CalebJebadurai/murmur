import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { validateTool } from "../src/schema/tool.ts";
import { loadIR } from "../src/schema/load.ts";
import { addCommand } from "../src/commands/add.ts";
import { AntigravityAdapter } from "../src/compiler/adapters/antigravity.ts";
import { ClaudeAdapter } from "../src/compiler/adapters/claude.ts";
import { DEFAULT_CONFIG } from "../src/schema/config.ts";

const BASE_MURMUR = join(import.meta.dir, "..", "murmur");

async function scratchMurmur(): Promise<string> {
  const root = join(tmpdir(), `murmur-toolschema-${crypto.randomUUID()}`);
  const { $ } = await import("bun");
  await mkdir(root, { recursive: true });
  await $`cp -R ${BASE_MURMUR}/. ${root}`.quiet();
  return root;
}

describe("Tool IR schema & validation", () => {
  test("validates a well-formed tool definition", () => {
    const raw = `---
name: sample-runner
description: Runs sample commands
command: bun run sample
args: ["--flag"]
category: test
env: ["NODE_ENV=test"]
---

# Sample Runner
Documentation body.
`;
    const res = validateTool(raw, "tools/sample-runner.md");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.name).toBe("sample-runner");
      expect(res.value.command).toBe("bun run sample");
      expect(res.value.args).toEqual(["--flag"]);
      expect(res.value.category).toBe("test");
      expect(res.value.env).toEqual({ NODE_ENV: "test" });
      expect(res.value.body).toContain("Sample Runner");
    }
  });

  test("rejects tool missing description or command", () => {
    const noDesc = `---
command: bun test
---
`;
    const resDesc = validateTool(noDesc, "tools/no-desc.md");
    expect(resDesc.ok).toBe(false);

    const noCmd = `---
description: Missing command
---
`;
    const resCmd = validateTool(noCmd, "tools/no-cmd.md");
    expect(resCmd.ok).toBe(false);
  });

  test("addCommand scaffolds a new tool definition", async () => {
    const root = await scratchMurmur();
    try {
      const code = await addCommand(root, "tool", "db-migrate");
      expect(code).toBe(0);
      const toolFile = join(root, "murmur", "tools", "db-migrate.md");
      expect(await Bun.file(toolFile).exists()).toBe(true);
      const content = await Bun.file(toolFile).text();
      expect(content).toContain("name: db-migrate");
      expect(content).toContain("command:");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("loadIR loads tool definitions into set.tools", async () => {
    const root = await scratchMurmur();
    try {
      await mkdir(join(root, "tools"), { recursive: true });
      await Bun.write(
        join(root, "tools", "my-tool.md"),
        `---
name: my-tool
description: A custom tool
command: bun run tool
---
# Tool Doc
`,
      );
      const loaded = await loadIR(root);
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(loaded.value.tools.some((t) => t.name === "my-tool")).toBe(true);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("adapters emit mcp_config.json when tools are present", () => {
    const ctx = {
      config: DEFAULT_CONFIG,
      ir: {
        agents: [],
        subagents: [],
        skills: [],
        instructions: [],
        pipelines: [],
        rubrics: [],
        tools: [
          {
            name: "unit-test",
            description: "Run unit tests",
            command: "bun test",
            args: ["--coverage"],
            category: "test",
            env: { CI: "true" },
            sourceFile: "tools/unit-test.md",
            body: "",
          },
        ],
      },
    };

    const agy = new AntigravityAdapter();
    const agyFiles = agy.finalize(ctx);
    const agyMcp = agyFiles.find((f) => f.path.endsWith("mcp_config.json"));
    expect(agyMcp).toBeDefined();
    expect(agyMcp?.contents).toContain("unit-test");
    expect(agyMcp?.contents).toContain("bun test");

    const claude = new ClaudeAdapter();
    const claudeFiles = claude.finalize(ctx);
    const claudeMcp = claudeFiles.find((f) => f.path.endsWith("mcp_config.json"));
    expect(claudeMcp).toBeDefined();
    expect(claudeMcp?.contents).toContain("unit-test");
  });
});
