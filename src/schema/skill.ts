/** A companion file/asset within a directory-structured skill. */
export type SkillAsset = {
  /** Relative path within the skill directory, e.g. "references/cheatsheet.md" or "scripts/lint.sh". */
  relativePath: string;
  /** Full filesystem path on disk. */
  absolutePath: string;
  /** Text contents of the asset, if loaded. */
  contents?: string;
};

export type SkillDefinition = {
  /** Filename stem or directory name. */
  name: string;
  /** Short description of what the skill teaches. */
  description: string;
  /** The knowledge payload (Markdown). */
  body: string;
  /** Companion assets for directory-structured skills (v1.0). */
  assets?: SkillAsset[];
};
