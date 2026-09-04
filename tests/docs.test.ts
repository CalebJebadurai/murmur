import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { docsCommand, generateDocsHtml } from "../src/commands/docs.ts";
import { loadIR } from "../src/schema/load.ts";

const BASE_MURMUR = join(import.meta.dir, "..", "murmur");

async function scratchProject(): Promise<string> {
  const root = join(tmpdir(), `murmur-docs-${crypto.randomUUID()}`);
  const murmurDir = join(root, "murmur");
  const { $ } = await import("bun");
  await mkdir(murmurDir, { recursive: true });
  await $`cp -R ${BASE_MURMUR}/. ${murmurDir}`.quiet();
  return root;
}

describe("murmr docs", () => {
  test("generateDocsHtml produces self-contained HTML with IR entities", async () => {
    const loaded = await loadIR(BASE_MURMUR);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const html = generateDocsHtml("TestProject", loaded.value, "# RUN-LOG\nSample log");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("TestProject");
    expect(html).toContain("analyst");
    expect(html).toContain("architect");
    expect(html).toContain("build-system");
    expect(html).toContain("RUN-LOG");
  });

  test("docsCommand writes index.html to specified output directory", async () => {
    const root = await scratchProject();
    try {
      const code = await docsCommand(root, { out: "_custom_docs" });
      expect(code).toBe(0);
      const outHtml = join(root, "_custom_docs", "index.html");
      expect(await Bun.file(outHtml).exists()).toBe(true);
      const content = await Bun.file(outHtml).text();
      expect(content).toContain("Agent Architecture Portal");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("docsCommand serve starts dev server and serves portal", async () => {
    const root = await scratchProject();
    const ac = new AbortController();
    const testPort = 3890 + Math.floor(Math.random() * 500);

    try {
      const serverPromise = docsCommand(root, {
        serve: true,
        port: testPort,
        signal: ac.signal,
      });

      // Allow server a moment to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      const res = await fetch(`http://localhost:${testPort}`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("Agent Architecture Portal");

      ac.abort();
      const code = await serverPromise;
      expect(code).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
