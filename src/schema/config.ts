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

/** Cloud sandbox runner configuration. */
export type SandboxConfig = {
  /** Sandbox provider type: "docker" | "remote" | "process" */
  type: "docker" | "remote" | "process";
  /** Docker image name when type is "docker" (e.g. "murmr/sandbox:latest"). */
  image?: string;
  /** Remote HTTP URL when type is "remote" (e.g. "https://sandbox.example.com/dispatch"). */
  endpoint?: string;
  /** Bearer token for remote authorization. */
  token?: string;
  /** Turn execution timeout in ms (default: 60000). */
  timeoutMs?: number;
  /** Environment variables passed into sandbox execution. */
  env?: Record<string, string>;
};

/** Run-driver host-CLI configuration. */
export type RunConfig = {
  /** Base argv for the host agent CLI, e.g. ["goose", "run"]. NEVER a shell string. */
  host?: string[];
  /** Optional cloud sandbox runner configuration. */
  sandbox?: SandboxConfig;
};

/** The murmur.config.{ts,json} shape. */
export type MurmurConfig = {
  /** Enabled compile-target identifiers, e.g. ["copilot", "goose"]. */
  targets: string[];
  project: ProjectConfig;
  /** Adapter plugin file paths (v0.1.0: TS adapter files registered directly). */
  plugins?: string[];
  publish?: PublishConfig;
  run?: RunConfig;
};

export const DEFAULT_CONFIG: MurmurConfig = {
  targets: ["copilot"],
  project: { name: "unnamed-project" },
  publish: {},
};
