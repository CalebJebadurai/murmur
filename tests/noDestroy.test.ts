import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileCommand } from "../src/commands/compile.ts";
import { initCommand } from "../src/commands/init.ts";
import { toolCommand } from "../src/commands/tool.ts";
import { evolveTask } from "../src/harness2/engine.ts";

const MY_AGENT = "---\nname: architect\n---\nMy own architect. Do not replace me.\n";

describe("Murmur never destroys existing files", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "murmr-safe-"));
    await cp(join(process.cwd(), "murmur"), join(root, "murmur"), { recursive: true });
    await Bun.write(
      join(root, "murmur.config.json"),
      JSON.stringify({ targets: ["claude", "codex"], project: { name: "demo" } }),
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("compile keeps an agent file it did not write", async () => {
    const mine = join(root, ".claude/agents/architect.md");
    await Bun.write(mine, MY_AGENT);
    expect(await compileCommand(root, {})).toBe(0);
    expect(await readFile(mine, "utf8")).toBe(MY_AGENT);
    expect(existsSync(join(root, ".claude/agents/critic.md"))).toBe(true);
  });

  test("compile keeps a user's AGENTS.md and later updates only its own files", async () => {
    await Bun.write(join(root, "AGENTS.md"), "# My notes\n");
    await compileCommand(root, {});
    await compileCommand(root, {});
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe("# My notes\n");
  });

  test("compile updates its own files but keeps hand edits to them", async () => {
    await compileCommand(root, {});
    const edited = join(root, ".claude/agents/critic.md");
    await Bun.write(edited, "hand edit\n");

    const source = join(root, "murmur/agents/analyst.md");
    await Bun.write(source, `${await readFile(source, "utf8")}\nNew line.\n`);
    await compileCommand(root, {});

    expect(await readFile(edited, "utf8")).toBe("hand edit\n");
    expect(await readFile(join(root, ".claude/agents/analyst.md"), "utf8")).toContain("New line.");
  });

  test("--replace always keeps a backup", async () => {
    const mine = join(root, ".claude/agents/architect.md");
    await Bun.write(mine, MY_AGENT);
    await compileCommand(root, { replace: true });
    expect(await readFile(mine, "utf8")).not.toBe(MY_AGENT);

    const stamp = (await Array.fromAsync(new Bun.Glob("*").scan({
      cwd: join(root, ".murmur/backups"),
      onlyFiles: false,
    })))[0]!;
    const backup = join(root, ".murmur/backups", stamp, ".claude/agents/architect.md");
    expect(await readFile(backup, "utf8")).toBe(MY_AGENT);
    expect(await readFile(join(root, ".murmur/.gitignore"), "utf8")).toContain("backups/");
  });

  test("an agent keeps its name when a pipeline shares it, on every compile", async () => {
    const mine = "---\ndescription: Mine\n---\nMy architect.\n";
    await Bun.write(join(root, "murmur/agents/architect.md"), mine);
    for (let run = 0; run < 3; run++) {
      await compileCommand(root, {});
      expect(await readFile(join(root, ".claude/agents/architect.md"), "utf8")).toContain("My architect.");
      expect(await readFile(join(root, ".codex/agents/architect.toml"), "utf8")).toContain("My architect.");
    }
    expect(existsSync(join(root, ".claude/agents/architect-pipeline.md"))).toBe(true);
  });

  test("never writes through a symlink, even with --replace", async () => {
    const outside = await mkdtemp(join(tmpdir(), "murmr-outside-"));
    await Bun.write(join(outside, "critic.md"), "VICTIM\n");
    await symlink(outside, join(root, ".claude"));
    await mkdir(join(outside, "agents"), { recursive: true });
    await Bun.write(join(outside, "agents/critic.md"), "VICTIM\n");

    await compileCommand(root, { replace: true });

    expect(await readFile(join(outside, "agents/critic.md"), "utf8")).toBe("VICTIM\n");
    expect(existsSync(join(outside, "agents/analyst.md"))).toBe(false);
    await rm(outside, { recursive: true, force: true });
  });

  test("a corrupt manifest keeps files instead of failing or overwriting", async () => {
    await compileCommand(root, {});
    await Bun.write(join(root, ".murmur/manifest.json"), "{broken");
    await Bun.write(join(root, ".claude/agents/critic.md"), "Mine\n");
    expect(await compileCommand(root, {})).toBe(0);
    expect(await readFile(join(root, ".claude/agents/critic.md"), "utf8")).toBe("Mine\n");
  });

  test("init keeps existing agents and skills in merge mode", async () => {
    const agent = join(root, "murmur/agents/architect.md");
    const skill = join(root, "murmur/skills/build-system/SKILL.md");
    await Bun.write(agent, "---\ndescription: Mine\n---\nMine\n");
    await Bun.write(skill, "---\nname: build-system\ndescription: Mine\n---\nMine\n");

    expect(await initCommand(root)).toBe(0);
    expect(await readFile(agent, "utf8")).toContain("Mine");
    expect(await readFile(skill, "utf8")).toContain("Mine");
  });

  test("init overwrite mode backs up first", async () => {
    const agent = join(root, "murmur/agents/architect.md");
    await Bun.write(agent, "---\ndescription: Mine\n---\nMine\n");
    await initCommand(root, { mode: "overwrite" });

    const matches = await Array.fromAsync(
      new Bun.Glob("*/murmur/agents/architect.md").scan({ cwd: join(root, ".murmur/backups") }),
    );
    expect(matches.length).toBe(1);
  });

  test("tool discover --write keeps a backup of a changed skill", async () => {
    await Bun.write(join(root, "package.json"), JSON.stringify({ scripts: { test: "bun test" } }));
    const skill = join(root, "murmur/skills/project-tools/SKILL.md");
    await Bun.write(skill, "---\nname: project-tools\ndescription: Mine\n---\nMine\n");
    await toolCommand(root, "discover", { write: true });

    const matches = await Array.fromAsync(
      new Bun.Glob("*/murmur/skills/project-tools/SKILL.md").scan({
        cwd: join(root, ".murmur/backups"),
      }),
    );
    expect(matches.length).toBe(1);
  });

  test("evolve refuses to overwrite a skill", async () => {
    const skill = join(root, "murmur/skills/skill-add-queue/SKILL.md");
    await Bun.write(skill, "---\nname: skill-add-queue\ndescription: Mine\n---\nMine\n");
    expect(evolveTask("add queue", root, { k: 1 })).rejects.toThrow("Refusing to overwrite");
    expect(await readFile(skill, "utf8")).toContain("Mine");
  });
});
