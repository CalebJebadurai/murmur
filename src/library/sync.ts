import { existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { hashContents } from "../compiler/ownership.ts";
import type { AgentDefinition, IRSet, SubagentDefinition } from "../schema/index.ts";
import type { LibraryConfig, LibraryItem } from "../schema/config.ts";
import { loadIR } from "../schema/load.ts";
import { backupFile, backupStamp } from "../util/backup.ts";
import { emitFrontmatterDoc, type YamlValue } from "../util/yaml.ts";

export const LOCK_FILE = "murmur.lock.json";
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type LibraryLock = {
  version: 1;
  source: string;
  commit: string | null;
  files: Record<string, string>;
};

export type SyncOptions = {
  /** Move to the newest commit of the configured ref. */
  update?: boolean;
  /** Replace hand-edited vendored files after backing them up. */
  force?: boolean;
  /** Overrides ~/.murmur/cache/library. */
  cacheDir?: string;
};

export type SyncResult = {
  commit: string | null;
  files: string[];
  /** Definitions where the project's own version wins. */
  shadowed: string[];
};

type Kind = "agents" | "subagents" | "skills" | "instructions" | "traits";

function git(args: string[], cwd?: string): string {
  const run = Bun.spawnSync(["git", ...args], {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (run.exitCode !== 0) {
    throw new Error(`git ${args[0]} failed: ${run.stderr.toString().trim()}`);
  }
  return run.stdout.toString().trim();
}

function isLocalPath(location: string): boolean {
  return /^(\.{1,2}\/|\/|~\/)/.test(location);
}

/** Accept only transports that cannot run commands (this rejects git's `ext::`). */
function gitUrl(location: string): string {
  if (/^github\.com\/[^/\s]+\/[^/\s]+$/.test(location)) return `https://${location}.git`;
  if (/^(https:\/\/|ssh:\/\/|file:\/\/|git@)/.test(location)) return location;
  throw new Error(`Unsupported library source "${location}". Use a path, https, ssh or git@ URL.`);
}

async function fetchSource(
  source: string,
  root: string,
  lock: LibraryLock | null,
  opts: SyncOptions,
): Promise<{ dir: string; commit: string | null }> {
  const [location = "", ref] = source.split("#");

  if (isLocalPath(location)) {
    const dir = location.startsWith("~/")
      ? join(homedir(), location.slice(2))
      : isAbsolute(location)
        ? location
        : resolve(root, location);
    if (!existsSync(dir)) throw new Error(`Library path not found: ${dir}`);
    const commit = existsSync(join(dir, ".git")) ? git(["rev-parse", "HEAD"], dir) : null;
    return { dir, commit };
  }

  const url = gitUrl(location);
  const cacheRoot = opts.cacheDir ?? join(homedir(), ".murmur", "cache", "library");
  const dir = join(cacheRoot, hashContents(url).slice(0, 16));
  if (existsSync(join(dir, ".git"))) {
    git(["fetch", "--quiet", "--tags", "--force", "origin"], dir);
  } else {
    await mkdir(cacheRoot, { recursive: true });
    git(["clone", "--quiet", "--", url, dir]);
  }

  const pinned = !opts.update && lock?.source === source ? lock.commit : null;
  const candidates = pinned ? [pinned] : ref ? [`origin/${ref}`, ref] : ["origin/HEAD"];
  let commit: string | undefined;
  for (const candidate of candidates) {
    try {
      commit = git(["rev-parse", "--verify", `${candidate}^{commit}`], dir);
      break;
    } catch {
      // Try the next spelling of the ref.
    }
  }
  if (!commit) throw new Error(`Could not find "${ref ?? "HEAD"}" in ${url}`);
  git(["checkout", "--quiet", "--detach", commit], dir);
  return { dir, commit };
}

function agentDocument(agent: AgentDefinition | SubagentDefinition): string {
  const fm: Record<string, YamlValue> = { description: agent.description };
  if (agent.tools.length) fm["tools"] = agent.tools;
  if (agent.skills.length) fm["skills"] = agent.skills;
  if (agent.instructions.length) fm["instructions"] = agent.instructions;
  if (agent.agents.length) fm["agents"] = agent.agents;
  if (agent.model) fm["model"] = agent.model;
  if (agent.userInvocable !== undefined) fm["user-invocable"] = agent.userInvocable;
  if (agent.dispatch) {
    fm["dispatch"] = {
      "invoke-when": agent.dispatch.invokeWhen,
      "skip-when": agent.dispatch.skipWhen,
      tasks: agent.dispatch.tasks,
    };
  }
  if ("spawn" in agent) {
    fm["spawn-trigger"] = agent.spawn.trigger;
    if (agent.spawn.attachSkills.length) fm["attach-skills"] = agent.spawn.attachSkills;
    if (agent.spawn.attachInstructions.length) {
      fm["attach-instructions"] = agent.spawn.attachInstructions;
    }
    if (agent.spawn.toolPolicy.length) fm["tool-policy"] = agent.spawn.toolPolicy;
  }
  return emitFrontmatterDoc(fm, agent.role);
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)));
}

/** Find which kind a `use` entry names. "skills/foo" picks a kind explicitly. */
function findKind(ir: IRSet, rawName: string): { kind: Kind; name: string } {
  const slash = rawName.indexOf("/");
  const wanted = slash === -1 ? null : rawName.slice(0, slash);
  const name = slash === -1 ? rawName : rawName.slice(slash + 1);
  if (!SAFE_NAME.test(name)) throw new Error(`Invalid library name "${rawName}"`);

  const has: Record<Kind, boolean> = {
    agents: ir.agents.some((a) => a.name === name),
    subagents: ir.subagents.some((a) => a.name === name),
    skills: ir.skills.some((s) => s.name === name),
    instructions: ir.instructions.some((i) => i.name === name),
    traits: (ir.traits ?? []).some((t) => t.name === name),
  };
  const kinds = (Object.keys(has) as Kind[]).filter((k) => has[k] && (!wanted || k === wanted));
  if (kinds.length === 0) throw new Error(`"${rawName}" was not found in the library`);
  if (kinds.length > 1) {
    throw new Error(`"${name}" is ambiguous (${kinds.join(", ")}). Write "${kinds[0]}/${name}".`);
  }
  return { kind: kinds[0]!, name };
}

async function collect(
  ir: IRSet,
  libDir: string,
  use: LibraryItem[],
): Promise<Map<string, Uint8Array | string>> {
  const out = new Map<string, Uint8Array | string>();
  const seen = new Set<string>();

  const addAgent = async (agent: AgentDefinition | SubagentDefinition, kind: Kind, as: string) => {
    const path = `${kind}/${as}.md`;
    if (out.has(path)) return;
    out.set(path, agentDocument(agent));
    for (const s of agent.skills) await add(`skills/${s}`);
    for (const i of agent.instructions) await add(`instructions/${i}`);
    for (const a of agent.agents) await add(a);
    if ("spawn" in agent) {
      for (const s of agent.spawn.attachSkills) await add(`skills/${s}`);
      for (const i of agent.spawn.attachInstructions) await add(`instructions/${i}`);
    }
  };

  const add = async (rawName: string, as?: string): Promise<void> => {
    if (seen.has(`${rawName}>${as ?? ""}`)) return;
    seen.add(`${rawName}>${as ?? ""}`);
    const { kind, name } = findKind(ir, rawName);
    if (as && kind !== "agents" && kind !== "subagents") {
      throw new Error(`"as" only works for agents and subagents, not ${kind}.`);
    }
    if (kind === "agents") {
      return addAgent(ir.agents.find((a) => a.name === name)!, kind, as ?? name);
    }
    if (kind === "subagents") {
      return addAgent(ir.subagents.find((a) => a.name === name)!, kind, as ?? name);
    }
    if (kind === "skills" && existsSync(join(libDir, "skills", name, "SKILL.md"))) {
      const dir = join(libDir, "skills", name);
      for (const rel of await listFiles(dir)) {
        out.set(`skills/${name}/${rel}`, await Bun.file(join(dir, rel)).bytes());
      }
      return;
    }
    const path = `${kind}/${name}.md`;
    const file = Bun.file(join(libDir, path));
    if (!(await file.exists())) throw new Error(`Library file not found: ${path}`);
    out.set(path, await file.bytes());
  };

  for (const item of use) {
    if (typeof item === "string") await add(item);
    else {
      if (item.as && !SAFE_NAME.test(item.as)) throw new Error(`Invalid name "${item.as}"`);
      await add(item.name, item.as);
    }
  }
  return out;
}

export async function readLock(root: string): Promise<LibraryLock | null> {
  const file = Bun.file(join(root, LOCK_FILE));
  return (await file.exists()) ? ((await file.json()) as LibraryLock) : null;
}

/**
 * Copy the definitions a project uses into murmur/.library/ and pin them in the lockfile.
 * Everything is prepared in memory first, and only murmur/.library/ is written, so the
 * project's own agents and skills are never touched.
 */
export async function syncLibrary(
  root: string,
  config: LibraryConfig,
  opts: SyncOptions = {},
): Promise<SyncResult> {
  const lock = await readLock(root);
  const libraryRoot = join("murmur", ".library");

  const edited: string[] = [];
  for (const [path, hash] of Object.entries(lock?.files ?? {})) {
    const file = Bun.file(join(root, libraryRoot, path));
    if ((await file.exists()) && hashContents(await file.bytes()) !== hash) edited.push(path);
  }
  if (edited.length && !opts.force) {
    throw new Error(
      `These library copies were edited by hand: ${edited.join(", ")}. ` +
        "Move your changes to murmur/, or pass --force to replace them (a backup is kept).",
    );
  }

  const { dir, commit } = await fetchSource(config.source, root, lock, opts);
  const libDir = existsSync(join(dir, "murmur", "agents")) ? join(dir, "murmur") : dir;
  const loaded = await loadIR(libDir);
  if (!loaded.ok) {
    const detail = loaded.errors.map((e) => `${e.file}: ${e.message}`).join("; ");
    throw new Error(`The library has errors: ${detail}`);
  }
  const files = await collect(loaded.value, libDir, config.use);

  const stamp = backupStamp();
  for (const path of edited) await backupFile(root, join(libraryRoot, path), stamp);
  for (const path of Object.keys(lock?.files ?? {})) {
    await rm(join(root, libraryRoot, path), { force: true });
  }

  const hashes: Record<string, string> = {};
  const shadowed: string[] = [];
  for (const path of [...files.keys()].sort()) {
    const contents = files.get(path)!;
    const dest = join(root, libraryRoot, path);
    await mkdir(dirname(dest), { recursive: true });
    await Bun.write(dest, contents);
    hashes[path] = hashContents(contents);
    const top = path.startsWith("skills/") ? path.split("/").slice(0, 2).join("/") : path;
    const localPath = join(root, "murmur", top);
    const localSkill = join(root, "murmur", `${top}.md`);
    if ((existsSync(localPath) || existsSync(localSkill)) && !shadowed.includes(top)) {
      shadowed.push(top);
    }
  }

  const next: LibraryLock = { version: 1, source: config.source, commit, files: hashes };
  await Bun.write(join(root, LOCK_FILE), `${JSON.stringify(next, null, 2)}\n`);
  return { commit, files: Object.keys(hashes), shadowed };
}
