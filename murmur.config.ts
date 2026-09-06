import type { MurmurConfig } from "./src/schema/config.ts";

const config: MurmurConfig = {
  targets: ["copilot", "goose", "antigravity", "claude", "cursor"],
  project: {
    name: "murmur",
    description: "Murmuration's own dogfooded agent pack.",
  },
  publish: {
    domainTerms: [],
    placeholders: {},
    allowlist: [],
  },
};

export default config;
