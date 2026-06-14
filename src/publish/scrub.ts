import { homedir } from "node:os";
import type { PublishConfig } from "../schema/config.ts";
import { scanSecrets, type SecretFinding } from "./secrets.ts";

export type ScrubResult = {
  contents: string;
  replacements: number;
  secretFindings: SecretFinding[];
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Scrub one file's contents: replace the repo name, user-specific path prefixes,
 * configured denylist terms, domain terms, and PII with placeholders. Then run the
 * defense-in-depth secret scanner over the *result* to surface anything that survived.
 */
export function scrubText(
  contents: string,
  config: PublishConfig,
  repoName: string,
): ScrubResult {
  let out = contents;
  let replacements = 0;

  const replace = (pattern: RegExp, placeholder: string): void => {
    out = out.replace(pattern, () => {
      replacements++;
      return placeholder;
    });
  };

  // Repo name → <REPO_NAME>
  if (repoName) {
    replace(new RegExp(escapeRegExp(repoName), "g"), "<REPO_NAME>");
  }

  // User-specific absolute path prefixes → <PROJECT_ROOT>
  replace(/\/Users\/[^/\s"']+\/[^\s"')]*/g, "<PROJECT_ROOT>");
  replace(/\/home\/[^/\s"']+\/[^\s"')]*/g, "<PROJECT_ROOT>");
  const home = homedir();
  if (home) replace(new RegExp(escapeRegExp(home), "g"), "<HOME>");

  // Email PII → <EMAIL>
  replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<EMAIL>");

  // Configured denylist + domain terms
  for (const term of config.denylist ?? []) {
    if (term) replace(new RegExp(escapeRegExp(term), "g"), "<REDACTED>");
  }
  for (const term of config.domainTerms ?? []) {
    if (term) replace(new RegExp(escapeRegExp(term), "g"), "<DOMAIN_TERM>");
  }

  // Custom placeholders
  for (const [token, placeholder] of Object.entries(config.placeholders ?? {})) {
    if (token) replace(new RegExp(escapeRegExp(token), "g"), placeholder);
  }

  const secretFindings = scanSecrets(out, config.allowlist ?? []);
  return { contents: out, replacements, secretFindings };
}
