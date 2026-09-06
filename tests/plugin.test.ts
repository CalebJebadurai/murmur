import { describe, expect, test, afterEach } from "bun:test";
import { join } from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  discoverInstalledPlugins,
  getAdapter,
  loadPluginAdapter,
  registerAdapter,
  resolveAdapters,
  unregisterAdapter,
} from "../src/compiler/registry.ts";
import { defineAdapter } from "../src/compiler/plugin.ts";
import type { RuntimeCompiler } from "../src/compiler/RuntimeCompiler.ts";
import { DEFAULT_CONFIG } from "../src/schema/config.ts";

async function freshDir(): Promise<string> {
  const dir = join(tmpdir(), `murmur-plugin-test-${crypto.randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

describe("Plugin discovery & registration", () => {
  afterEach(() => {
    unregisterAdapter("test-custom");
    unregisterAdapter("mock-adapter");
  });

  test("defineAdapter validates adapter interface strictly", () => {
    expect(() => defineAdapter(null as any)).toThrow();
    expect(() => defineAdapter({ id: "" } as any)).toThrow();
    expect(() => defineAdapter({ id: "valid" } as any)).toThrow('must implement "compileAgent"');

    const valid: RuntimeCompiler = {
      id: "mock-adapter",
      compileAgent: () => [],
      compileSubagent: () => [],
      compileSkill: () => [],
      compileInstruction: () => [],
    };
    expect(defineAdapter(valid)).toBe(valid);
  });

  test("discoverInstalledPlugins finds murmr-plugin-* in package.json", async () => {
    const dir = await freshDir();
    try {
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          name: "test-repo",
          dependencies: {
            "murmr-plugin-zed": "^1.0.0",
            "@org/murmr-plugin-fleet": "^0.2.0",
            typescript: "^5.0.0",
          },
          devDependencies: {
            "murmr-plugin-dev": "^0.1.0",
            lefthook: "^1.0.0",
          },
        }),
      );

      const discovered = await discoverInstalledPlugins(dir);
      expect(discovered.sort()).toEqual(
        ["murmr-plugin-zed", "@org/murmr-plugin-fleet", "murmr-plugin-dev"].sort(),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("loadPluginAdapter dynamically loads and registers a custom adapter", async () => {
    const dir = await freshDir();
    try {
      const pluginFile = join(dir, "custom-plugin.ts");
      await writeFile(
        pluginFile,
        `
import { defineAdapter } from "${join(import.meta.dir, "../src/compiler/plugin.ts")}";

export default defineAdapter({
  id: "test-custom",
  compileAgent(agent) {
    return [{ path: ".custom/" + agent.name + ".txt", contents: agent.role }];
  },
  compileSubagent: () => [],
  compileSkill: () => [],
  compileInstruction: () => [],
});
`,
      );

      const loaded = await loadPluginAdapter(pluginFile, dir, { allowConfigExec: true });
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe("test-custom");

      const registered = getAdapter("test-custom");
      expect(registered).toBeDefined();
      expect(registered?.id).toBe("test-custom");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("resolveAdapters loads configured plugins with code execution permissions", async () => {
    const dir = await freshDir();
    try {
      const pluginFile = join(dir, "my-plugin.ts");
      await writeFile(
        pluginFile,
        `
export default {
  id: "mock-adapter",
  compileAgent: () => [],
  compileSubagent: () => [],
  compileSkill: () => [],
  compileInstruction: () => [],
};
`,
      );

      const config = {
        ...DEFAULT_CONFIG,
        plugins: [pluginFile],
      };

      // When allowConfigExec is false, it refuses
      await expect(
        resolveAdapters(config, dir, { allowConfigExec: false }),
      ).rejects.toThrow("Refusing to execute plugin");

      // When allowConfigExec is true, it registers
      await resolveAdapters(config, dir, { allowConfigExec: true });
      expect(getAdapter("mock-adapter")).toBeDefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
