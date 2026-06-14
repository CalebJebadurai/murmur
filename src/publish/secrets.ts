/**
 * Secret scanning — defense-in-depth, not a guarantee.
 *
 * Combines known-pattern detection (gitleaks-style) with a Shannon-entropy
 * heuristic to flag high-entropy, secret-shaped strings that no denylist would name.
 */

export type SecretFinding = {
  match: string;
  rule: string;
};

const PATTERN_RULES: { rule: string; re: RegExp }[] = [
  { rule: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { rule: "github-pat-fine", re: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/g },
  { rule: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { rule: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { rule: "openai-key", re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { rule: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { rule: "private-key-block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
];

/** Shannon entropy (bits per char) of a string. */
export function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

const TOKEN_RE = /[A-Za-z0-9+/_-]{20,}/g;
const ENTROPY_THRESHOLD = 4.0; // bits/char; high-entropy blobs exceed this

/**
 * Scan text for secret-shaped strings. `allowlist` strings the user has confirmed
 * are generic are excluded from findings.
 */
export function scanSecrets(text: string, allowlist: string[] = []): SecretFinding[] {
  const allow = new Set(allowlist);
  const findings: SecretFinding[] = [];
  const seen = new Set<string>();

  for (const { rule, re } of PATTERN_RULES) {
    for (const m of text.matchAll(re)) {
      const match = m[0];
      if (allow.has(match) || seen.has(match)) continue;
      seen.add(match);
      findings.push({ match, rule });
    }
  }

  for (const m of text.matchAll(TOKEN_RE)) {
    const token = m[0];
    if (allow.has(token) || seen.has(token)) continue;
    if (shannonEntropy(token) >= ENTROPY_THRESHOLD) {
      seen.add(token);
      findings.push({ match: token, rule: "high-entropy" });
    }
  }

  return findings;
}
