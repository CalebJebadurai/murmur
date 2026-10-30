import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type ExperienceTier = "project" | "user" | "ecosystem";

export interface ExperienceRecord {
  tier: ExperienceTier;
  path: string;
  exists: boolean;
  content: string;
  lessons: string[];
}

export interface CascadingExperience {
  project: ExperienceRecord | null;
  user: ExperienceRecord | null;
  ecosystem: ExperienceRecord | null;
  allLessons: string[];
}

export interface ExperienceOptions {
  userHome?: string;
  ecosystemDir?: string;
}

/**
 * Parse lessons/sections from a markdown experience file.
 */
function extractLessons(content: string): string[] {
  if (!content) return [];
  const sections = content.split(/\n(?=## )/);
  return sections
    .map((s) => s.trim())
    .filter((s) => s.startsWith("## "));
}

/**
 * Load and resolve the 3-tier experience cascade:
 * 1. Project Tier: <projectRoot>/murmur/EXPERIENCE.md (Highest precedence)
 * 2. User Tier: ~/.murmur/experience.md (Personal conventions)
 * 3. Ecosystem Tier: <ecosystemDir>/experience.md or curated community packs
 */
export async function loadExperienceCascade(
  projectRoot: string,
  opts?: ExperienceOptions,
): Promise<CascadingExperience> {
  const home = opts?.userHome ?? homedir();

  // 1. Project Tier
  const projectPath = join(projectRoot, "murmur", "EXPERIENCE.md");
  let projectRecord: ExperienceRecord | null = null;
  if (existsSync(projectPath)) {
    const content = await readFile(projectPath, "utf8");
    projectRecord = {
      tier: "project",
      path: projectPath,
      exists: true,
      content,
      lessons: extractLessons(content),
    };
  }

  // 2. User Tier
  const userPath = join(home, ".murmur", "experience.md");
  let userRecord: ExperienceRecord | null = null;
  if (existsSync(userPath)) {
    const content = await readFile(userPath, "utf8");
    userRecord = {
      tier: "user",
      path: userPath,
      exists: true,
      content,
      lessons: extractLessons(content),
    };
  }

  // 3. Ecosystem Tier (optional)
  let ecosystemRecord: ExperienceRecord | null = null;
  if (opts?.ecosystemDir) {
    const ecoPath = join(opts.ecosystemDir, "experience.md");
    if (existsSync(ecoPath)) {
      const content = await readFile(ecoPath, "utf8");
      ecosystemRecord = {
        tier: "ecosystem",
        path: ecoPath,
        exists: true,
        content,
        lessons: extractLessons(content),
      };
    }
  }

  const allLessons: string[] = [
    ...(projectRecord?.lessons ?? []),
    ...(userRecord?.lessons ?? []),
    ...(ecosystemRecord?.lessons ?? []),
  ];

  return {
    project: projectRecord,
    user: userRecord,
    ecosystem: ecosystemRecord,
    allLessons,
  };
}

/**
 * Format cascading experience into a prompt context block.
 * Strict precedence: Project overrides User, User overrides Ecosystem.
 */
export function formatExperiencePrompt(cascade: CascadingExperience): string {
  const sections: string[] = [];

  if (cascade.project?.lessons.length) {
    sections.push(
      "### Project-Specific Experience (Overrides all higher tiers)\n" +
        cascade.project.lessons.slice(-5).join("\n\n")
    );
  }

  if (cascade.user?.lessons.length) {
    sections.push(
      "### User Personal Experience (Cross-repository preferences)\n" +
        cascade.user.lessons.slice(-3).join("\n\n")
    );
  }

  if (cascade.ecosystem?.lessons.length) {
    sections.push(
      "### Ecosystem Community Experience (General framework best practices)\n" +
        cascade.ecosystem.lessons.slice(-3).join("\n\n")
    );
  }

  if (sections.length === 0) {
    return "";
  }

  return (
    "# Active Experience Memory (Cascading Hierarchy)\n\n" +
    sections.join("\n\n")
  );
}

/**
 * Record a verified lesson learned into the chosen tier.
 */
export async function recordExperienceLesson(
  tier: "project" | "user",
  task: string,
  details: {
    candidate: string;
    score: number;
    lesson: string;
  },
  projectRoot: string,
  opts?: ExperienceOptions,
): Promise<string> {
  const home = opts?.userHome ?? homedir();
  const targetPath =
    tier === "project"
      ? join(projectRoot, "murmur", "EXPERIENCE.md")
      : join(home, ".murmur", "experience.md");

  const dir = dirname(targetPath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const entry = `\n## [${timestamp}] Task: ${task}\n- **Tier**: \`${tier}\`\n- **Adopted Harness Mutation**: \`${details.candidate}\`\n- **Probe Contrast Score**: ${details.score.toFixed(2)}\n- **Lesson**: ${details.lesson}\n`;

  let existing = "";
  if (existsSync(targetPath)) {
    existing = await readFile(targetPath, "utf8");
  } else {
    existing =
      tier === "project"
        ? "# Murmuration Project Experience Library\n\nPersistent harness evolution records generated by Google Harness² integration.\n"
        : "# Murmuration User Experience Library\n\nCross-project personal development conventions and lessons.\n";
  }

  await writeFile(targetPath, existing + entry, "utf8");
  return targetPath;
}
