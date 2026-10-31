import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileCommand } from "../src/commands/compile.ts";
import { syncLibrary } from "../src/library/sync.ts";
import { loadIR } from "../src/schema/load.ts";
import { mergeBodies } from "../src/schema/inheritance.ts";

const write = (root: string, path: string, text: string) => Bun.write(join(root, path), text);

async function makeLibrary(lib: string): Promise<void> {
  await write(lib, "agents/human.md", "---\ndescription: base\nabstract: true\n---\nBe honest.\n\n## Style\n\nPlain.\n");
  await write(lib, "agents/critic.md", "---\ndescription: Use when reviewing.\nextends: human\nskills: [review-basics]\n---\nFind weaknesses.\n");
  await write(lib, "agents/financial-critic.md", "---\nextends: critic\ntraits: [cost-analysis]\n---\nFocus on cash flow.\n\n## Style\n\nUse numbers.\n");
  await write(lib, "agents/architect.md", "---\ndescription: Library architect.\n---\nLibrary plan.\n");
  await write(lib, "traits/cost-analysis.md", "---\nskills: [unit-economics]\n---\nCheck unit economics.\n");
  await write(lib, "skills/review-basics/SKILL.md", "---\nname: review-basics\ndescription: Review well.\n---\nBe specific.\n");
  await write(lib, "skills/review-basics/checklist.md", "A checklist\n");
  await write(lib, "skills/unit-economics/SKILL.md", "---\nname: unit-economics\ndescription: Costs.\n---\nCount costs.\n");
}

describe("mergeBodies", () => {
  test("replaces matching sections and ignores headings in code fences", () => {
    const merged = mergeBodies("Base.\n\n## A\n\nOld.\n\n## B\n\nKeep.", "Extra.\n\n## A\n\nNew.\n\n```\n## B\n```");
    expect(merged).toContain("New.");
    expect(merged).not.toContain("Old.");
    expect(merged).toContain("Keep.");
    expect(merged.indexOf("Base.")).toBeLessThan(merged.indexOf("Extra."));
  });
});

describe("inheritance", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "murmr-inherit-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("flattens extends and traits and drops abstract agents", async () => {
    await makeLibrary(root);
    const loaded = await loadIR(root);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const agent = loaded.value.agents.find((a) => a.name === "financial-critic")!;
    expect(agent.description).toBe("Use when reviewing.");
    expect(agent.role).toContain("Be honest.");
    expect(agent.role).toContain("Find weaknesses.");
    expect(agent.role).toContain("Check unit economics.");
    expect(agent.role).toContain("Use numbers.");
    expect(agent.role).not.toContain("Plain.");
    expect(agent.skills).toEqual(["review-basics", "unit-economics"]);
    expect(loaded.value.agents.some((a) => a.name === "human")).toBe(false);
  });

  test("reports cycles, unknown parents and unknown traits", async () => {
    await write(root, "agents/a.md", "---\nextends: b\n---\nA\n");
    await write(root, "agents/b.md", "---\nextends: a\n---\nB\n");
    await write(root, "agents/c.md", "---\nextends: missing\ntraits: [nope]\n---\nC\n");
    const loaded = await loadIR(root);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    const messages = loaded.errors.map((e) => e.message).join("\n");
    expect(messages).toContain("circular extends");
    expect(messages).toContain('unknown parent agent "missing"');
    expect(messages).toContain('unknown trait "nope"');
  });

  test("leaves agents without inheritance byte-identical", async () => {
    await write(root, "agents/plain.md", "---\ndescription: d\n---\n  Odd   spacing.\n\n\n\n## X\n");
    const loaded = await loadIR(root);
    if (!loaded.ok) throw new Error("load failed");
    expect(loaded.value.agents[0]!.role).toContain("Odd   spacing.\n\n\n\n## X");
  });
});

describe("library sync", () => {
  let root: string;
  let lib: string;
  const config = (use: Parameters<typeof syncLibrary>[1]["use"]) => ({ source: lib, use });

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "murmr-proj-"));
    lib = await mkdtemp(join(tmpdir(), "murmr-lib-"));
    await makeLibrary(lib);
    await write(root, "murmur/agents/analyst.md", "---\ndescription: Mine.\n---\nMy analyst.\n");
    await write(root, "murmur.config.json", JSON.stringify({ targets: ["claude"], project: { name: "x" } }));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(lib, { recursive: true, force: true });
  });

  test("imports only what is used, flattened, with dependencies", async () => {
    await syncLibrary(root, config(["financial-critic"]));
    const vendored = await readFile(join(root, "murmur/.library/agents/financial-critic.md"), "utf8");
    expect(vendored).toContain("Be honest.");
    expect(vendored).not.toContain("extends");
    expect(existsSync(join(root, "murmur/.library/agents/critic.md"))).toBe(false);
    expect(existsSync(join(root, "murmur/.library/agents/architect.md"))).toBe(false);
    expect(existsSync(join(root, "murmur/.library/skills/review-basics/checklist.md"))).toBe(true);
    expect(Object.keys(JSON.parse(await readFile(join(root, "murmur.lock.json"), "utf8")).files).length).toBe(4);

    const loaded = await loadIR(join(root, "murmur"));
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    expect(loaded.value.agents.map((a) => a.name).sort()).toEqual(["analyst", "financial-critic"]);
  });

  test("a local agent with the same name wins and is untouched", async () => {
    const mine = "---\ndescription: Mine.\n---\nMy architect.\n";
    await write(root, "murmur/agents/architect.md", mine);
    const result = await syncLibrary(root, config(["architect"]));

    expect(result.shadowed).toEqual(["agents/architect.md"]);
    expect(await readFile(join(root, "murmur/agents/architect.md"), "utf8")).toBe(mine);
    const loaded = await loadIR(join(root, "murmur"));
    if (!loaded.ok) throw new Error("load failed");
    expect(loaded.value.agents.find((a) => a.name === "architect")!.role).toContain("My architect.");
    expect(loaded.value.shadowed).toEqual(["agents/architect"]);
  });

  test("as keeps both versions side by side", async () => {
    await write(root, "murmur/agents/architect.md", "---\ndescription: Mine.\n---\nMy architect.\n");
    await syncLibrary(root, config([{ name: "architect", as: "library-architect" }]));
    const loaded = await loadIR(join(root, "murmur"));
    if (!loaded.ok) throw new Error("load failed");
    expect(loaded.value.agents.map((a) => a.name)).toContain("library-architect");
    expect(loaded.value.agents.map((a) => a.name)).toContain("architect");
  });

  test("a local agent can extend the library version of its own name", async () => {
    await write(root, "murmur/agents/architect.md", "---\nextends: library:architect\n---\nPlus my rules.\n");
    await syncLibrary(root, config(["architect"]));
    const loaded = await loadIR(join(root, "murmur"));
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
    const role = loaded.value.agents.find((a) => a.name === "architect")!.role;
    expect(role).toContain("Library plan.");
    expect(role).toContain("Plus my rules.");
  });

  test("hand edits to library copies stop the sync unless forced, with a backup", async () => {
    await syncLibrary(root, config(["architect"]));
    const copy = join(root, "murmur/.library/agents/architect.md");
    await writeFile(copy, "---\ndescription: edited\n---\nedited\n");

    expect(syncLibrary(root, config(["architect"]))).rejects.toThrow("edited by hand");
    expect(await readFile(copy, "utf8")).toContain("edited");

    await syncLibrary(root, config(["architect"]), { force: true });
    expect(await readFile(copy, "utf8")).toContain("Library plan.");
    const backups = await Array.fromAsync(new Bun.Glob("**/architect.md").scan({ cwd: join(root, ".murmur/backups"), dot: true }));
    expect(backups.length).toBe(1);
  });

  test("a failed sync changes nothing", async () => {
    await syncLibrary(root, config(["architect"]));
    const before = await readFile(join(root, "murmur.lock.json"), "utf8");
    expect(syncLibrary(root, config(["does-not-exist"]))).rejects.toThrow("not found in the library");
    expect(await readFile(join(root, "murmur.lock.json"), "utf8")).toBe(before);
    expect(existsSync(join(root, "murmur/.library/agents/architect.md"))).toBe(true);
  });

  test("rejects unsafe sources and names", async () => {
    expect(syncLibrary(root, { source: "ext::sh -c id", use: ["a"] })).rejects.toThrow("Unsupported library source");
    expect(syncLibrary(root, config(["../../etc/passwd"]))).rejects.toThrow();
    expect(syncLibrary(root, config([{ name: "architect", as: "../../evil" }]))).rejects.toThrow("Invalid name");
  });

  test("pins git libraries until --update", async () => {
    const run = (...args: string[]) => Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: lib });
    run("init", "-q", "-b", "main");
    run("add", ".");
    run("commit", "-qm", "one");
    const source = `file://${lib}#main`;
    const cacheDir = join(root, "cache");
    await syncLibrary(root, { source, use: ["architect"] }, { cacheDir });

    await write(lib, "agents/architect.md", "---\ndescription: Library architect.\n---\nVersion two.\n");
    run("commit", "-qam", "two");

    await syncLibrary(root, { source, use: ["architect"] }, { cacheDir });
    const copy = join(root, "murmur/.library/agents/architect.md");
    expect(await readFile(copy, "utf8")).toContain("Library plan.");

    await syncLibrary(root, { source, use: ["architect"] }, { cacheDir, update: true });
    expect(await readFile(copy, "utf8")).toContain("Version two.");
  });

  test("compiles library agents without needing the library", async () => {
    await syncLibrary(root, config(["financial-critic"]));
    await rm(lib, { recursive: true, force: true });
    expect(await compileCommand(root, {})).toBe(0);
    expect(await readFile(join(root, ".claude/agents/financial-critic.md"), "utf8")).toContain("Find weaknesses.");
    expect(existsSync(join(root, ".claude/agents/human.md"))).toBe(false);
  });
});
