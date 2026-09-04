import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rm, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { hookCommand, getHookScript, stripHookScript } from "../src/commands/hook.ts";

async function scratchGitRepo(): Promise<string> {
  const root = join(tmpdir(), `murmur-hook-${crypto.randomUUID()}`);
  await mkdir(join(root, ".git", "hooks"), { recursive: true });
  return root;
}

describe("murmr hook", () => {
  test("getHookScript generates script with shebang and marker block", () => {
    const script = getHookScript();
    expect(script).toContain("#!/usr/bin/env sh");
    expect(script).toContain("# --- MURMUR HOOK BEGIN ---");
    expect(script).toContain("# --- MURMUR HOOK END ---");
    expect(script).toContain("murmr doctor");
  });

  test("getHookScript preserves existing script content without duplicating", () => {
    const existing = "#!/bin/sh\necho 'pre-existing check'\n";
    const script = getHookScript(existing);
    expect(script).toContain("echo 'pre-existing check'");
    expect(script).toContain("# --- MURMUR HOOK BEGIN ---");

    // Calling it again on already hooked content updates/replaces the block without duplicating
    const double = getHookScript(script);
    const matches = double.match(/# --- MURMUR HOOK BEGIN ---/g);
    expect(matches?.length).toBe(1);
  });

  test("stripHookScript cleanly removes the murmur hook block", () => {
    const combined = "#!/bin/sh\necho 'other tool'\n\n# --- MURMUR HOOK BEGIN ---\nmurmr doctor\n# --- MURMUR HOOK END ---\n";
    const stripped = stripHookScript(combined);
    expect(stripped).toContain("echo 'other tool'");
    expect(stripped).not.toContain("MURMUR HOOK");
  });

  test("hook install, status, and uninstall cycle", async () => {
    const root = await scratchGitRepo();
    try {
      // 1. Initial status: not installed
      const statusBefore = await hookCommand(root, "status");
      expect(statusBefore).toBe(1);

      // 2. Install
      const installCode = await hookCommand(root, "install");
      expect(installCode).toBe(0);

      const hookFile = join(root, ".git", "hooks", "pre-commit");
      expect(await Bun.file(hookFile).exists()).toBe(true);
      const hookContent = await Bun.file(hookFile).text();
      expect(hookContent).toContain("# --- MURMUR HOOK BEGIN ---");

      // Verify executable permission
      const st = await stat(hookFile);
      expect((st.mode & 0o111) !== 0).toBe(true);

      // 3. Status: installed
      const statusInstalled = await hookCommand(root, "status");
      expect(statusInstalled).toBe(0);

      // 4. Uninstall
      const uninstallCode = await hookCommand(root, "uninstall");
      expect(uninstallCode).toBe(0);

      // Status after uninstall: not installed
      const statusAfter = await hookCommand(root, "status");
      expect(statusAfter).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("hook install refuses to run outside a git repository", async () => {
    const nonGitRoot = join(tmpdir(), `murmur-non-git-${crypto.randomUUID()}`);
    await mkdir(nonGitRoot, { recursive: true });
    try {
      const code = await hookCommand(nonGitRoot, "install");
      expect(code).toBe(1);
    } finally {
      await rm(nonGitRoot, { recursive: true, force: true });
    }
  });
});
