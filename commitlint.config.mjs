export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "perf",
        "docs",
        "refactor",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
  },
};
