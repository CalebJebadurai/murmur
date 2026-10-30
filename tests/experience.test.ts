import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  formatExperiencePrompt,
  loadExperienceCascade,
  recordExperienceLesson,
} from "../src/harness2/experience.ts";

describe("3-Tier Experience Cascading Engine", () => {
  let projectRoot: string;
  let userHome: string;
  let ecosystemDir: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "murmr-exp-proj-"));
    userHome = await mkdtemp(join(tmpdir(), "murmr-exp-home-"));
    ecosystemDir = await mkdtemp(join(tmpdir(), "murmr-exp-eco-"));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(userHome, { recursive: true, force: true });
    await rm(ecosystemDir, { recursive: true, force: true });
  });

  it("handles empty initial state gracefully", async () => {
    const cascade = await loadExperienceCascade(projectRoot, {
      userHome,
      ecosystemDir,
    });

    expect(cascade.project).toBeNull();
    expect(cascade.user).toBeNull();
    expect(cascade.ecosystem).toBeNull();
    expect(cascade.allLessons.length).toBe(0);

    const prompt = formatExperiencePrompt(cascade);
    expect(prompt).toBe("");
  });

  it("records and loads lessons across project and user tiers", async () => {
    // Record to project tier
    await recordExperienceLesson(
      "project",
      "optimize sql query joins",
      {
        candidate: "skill:sql-optimizer",
        score: 0.95,
        lesson: "Always index foreign keys before running bulk table joins.",
      },
      projectRoot,
      { userHome }
    );

    // Record to user tier
    await recordExperienceLesson(
      "user",
      "prefer typescript strict mode",
      {
        candidate: "instruction:strict-ts",
        score: 0.88,
        lesson: "Never use any types; always use unknown with type guards.",
      },
      projectRoot,
      { userHome }
    );

    // Seed ecosystem tier
    await Bun.write(
      join(ecosystemDir, "experience.md"),
      `# Ecosystem Experience\n\n## [2026-01-01] Task: ecosystem conventions\n- **Lesson**: Standardize on Bun and ESLint flat config.\n`
    );

    const cascade = await loadExperienceCascade(projectRoot, {
      userHome,
      ecosystemDir,
    });

    expect(cascade.project).not.toBeNull();
    expect(cascade.user).not.toBeNull();
    expect(cascade.ecosystem).not.toBeNull();
    expect(cascade.allLessons.length).toBe(3);

    const prompt = formatExperiencePrompt(cascade);
    expect(prompt).toContain("# Active Experience Memory (Cascading Hierarchy)");
    expect(prompt).toContain("Project-Specific Experience (Overrides all higher tiers)");
    expect(prompt).toContain("User Personal Experience (Cross-repository preferences)");
    expect(prompt).toContain("Ecosystem Community Experience (General framework best practices)");

    // Precedence: Project text appears before User text, User appears before Ecosystem
    const projIdx = prompt.indexOf("Always index foreign keys");
    const userIdx = prompt.indexOf("Never use any types");
    const ecoIdx = prompt.indexOf("Standardize on Bun");

    expect(projIdx).toBeGreaterThanOrEqual(0);
    expect(userIdx).toBeGreaterThan(projIdx);
    expect(ecoIdx).toBeGreaterThan(userIdx);
  });
});
