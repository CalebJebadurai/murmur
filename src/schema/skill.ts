/**
 * SkillDefinition — a self-contained knowledge package.
 *
 * Skills are where ALL codebase-specific content legitimately lives. v0.1.0
 * restricts skills to a single flat `SKILL.md`; the `assets` field is reserved.
 */
export type SkillDefinition = {
  /** Filename stem or directory name. */
  name: string;
  /** Short description of what the skill teaches. */
  description: string;
  /** The knowledge payload (Markdown). */
  body: string;
  /** Reserved for directory-structured skills with assets (v1.0). */
  assets?: string[];
};
