/** Publish scrubbing rules. */
export type PublishConfig = {
  /** Exact strings to redact (in addition to auto-detected repo name/paths). */
  denylist?: string[];
  /** Proprietary domain terms to redact. */
  domainTerms?: string[];
  /** Map of token -> placeholder (e.g. repo name -> "<REPO_NAME>"). */
  placeholders?: Record<string, string>;
  /** High-entropy / secret-shaped strings the user has confirmed are generic. */
  allowlist?: string[];
};

/** Project metadata. */
export type ProjectConfig = {
  name: string;
  description?: string;
};

/** The murmur.config.{ts,json} shape. */
export type MurmurConfig = {
  /** Enabled compile-target identifiers, e.g. ["copilot", "goose"]. */
  targets: string[];
  project: ProjectConfig;
  /** Adapter plugin file paths (v0.1.0: TS adapter files registered directly). */
  plugins?: string[];
  publish?: PublishConfig;
};

export const DEFAULT_CONFIG: MurmurConfig = {
  targets: ["copilot"],
  project: { name: "unnamed-project" },
  publish: {},
};
