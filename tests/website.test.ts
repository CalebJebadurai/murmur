import { describe, expect, it } from "bun:test";
import { join } from "node:path";

describe("Murmuration Public Web Foundry", () => {
  const root = process.cwd();
  const webDir = join(root, "website");

  it("contains all deployment and asset files", async () => {
    const htmlExists = await Bun.file(join(webDir, "index.html")).exists();
    const cssExists = await Bun.file(join(webDir, "style.css")).exists();
    const jsExists = await Bun.file(join(webDir, "app.js")).exists();
    const vercelExists = await Bun.file(join(webDir, "vercel.json")).exists();
    const pkgExists = await Bun.file(join(webDir, "package.json")).exists();

    expect(htmlExists).toBe(true);
    expect(cssExists).toBe(true);
    expect(jsExists).toBe(true);
    expect(vercelExists).toBe(true);
    expect(pkgExists).toBe(true);
  });

  it("contains interactive compiler targets and key feature sections in index.html", async () => {
    const html = await Bun.file(join(webDir, "index.html")).text();

    expect(html).toContain("Universal Multi-Agent Specification");
    expect(html).toContain("One Source. Every Coding Agent.");
    expect(html).toContain("bun install -g murmr");
    expect(html).not.toContain("-g murmuration");
    expect(html).toContain("data-target=\"copilot\"");
    expect(html).toContain("data-target=\"claude\"");
    expect(html).toContain("data-target=\"agy\"");
    expect(html).toContain("data-target=\"goose\"");
    expect(html).toContain("data-target=\"cursor\"");
    expect(html).toContain("data-target=\"acp\"");
    expect(html).toContain("id=\"starlingCanvas\"");
    expect(html).toContain("id=\"pipeline\"");
    expect(html).toContain("id=\"cascade\"");
    expect(html).toContain("id=\"workflow\"");
    expect(html).toContain("data-target=\"codex\"");
    expect(html).toContain("data-target=\"opencode\"");
    expect(html).not.toMatch(/10ms|Harness²|LLM Tokens/);
    expect(html).toContain("Why Engineering Teams Standardize on Murmur");
  });

  it("verifies interactive flocking and syntax engine in app.js", async () => {
    const js = await Bun.file(join(webDir, "app.js")).text();
    expect(js).not.toMatch(/Sub-10ms|Harness²|latencyMs/);
    expect(js).toContain("StarlingBoid");
    expect(js).toContain("SOURCE_DOCS");
    expect(js).toContain("TARGET_OUTPUTS");
    expect(js).toContain("renderCodeWithGutter");
    expect(js).toContain("prefers-reduced-motion");
    expect(js).toContain("IntersectionObserver");
  });

  it("validates vercel.json format", async () => {
    const raw = await Bun.file(join(webDir, "vercel.json")).text();
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(2);
    expect(parsed.name).toBe("murmuration-web");
    expect(parsed.cleanUrls).toBe(true);
  });
});
