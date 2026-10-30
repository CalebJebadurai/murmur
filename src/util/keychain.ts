import { execSync } from "node:child_process";

/**
 * Service name mapping for macOS Keychain items.
 */
const DEFAULT_SERVICE_MAPPING: Record<string, string> = {
  OPENROUTER_API_KEY: "openrouter-api-key",
  MESHAPI_API_KEY: "meshapi-api-key",
  TYPESAFE_API_KEY: "typesafe-api-key",
  GEMINI_API_KEY: "gemini-api-key",
  ANTHROPIC_API_KEY: "anthropic-api-key",
  OPENAI_API_KEY: "openai-api-key",
};

/**
 * Resolve a secret from process.env or macOS Keychain without exposing plaintext in history.
 */
export function getSecret(keyName: string, serviceName?: string): string | null {
  // 1. Process environment variable
  const envVal = process.env[keyName]?.trim();
  if (envVal) {
    return envVal;
  }

  // 2. macOS Keychain retrieval
  if (process.platform === "darwin") {
    const service = serviceName ?? DEFAULT_SERVICE_MAPPING[keyName] ?? keyName.toLowerCase().replace(/_/g, "-");
    const user = process.env.USER || "";

    if (user) {
      try {
        const cmd = `/usr/bin/security find-generic-password -a "${user}" -s "${service}" -w`;
        const res = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
        if (res.trim()) return res.trim();
      } catch {
        // Fallback without user flag
      }
    }

    try {
      const cmd = `/usr/bin/security find-generic-password -s "${service}" -w`;
      const res = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      if (res.trim()) return res.trim();
    } catch {
      // Ignored
    }
  }

  return null;
}
