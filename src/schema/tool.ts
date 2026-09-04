import { basename } from "node:path";
import { asStringArray, parseFrontmatter } from "../util/frontmatter.ts";
import type { ValidationError, ValidationResult } from "./types.ts";

export type ToolDefinition = {
  name: string;
  description: string;
  command: string;
  args: string[];
  category: string;
  env: Record<string, string>;
  sourceFile: string;
  body: string;
};

function stem(file: string): string {
  return basename(file).replace(/\.(md|markdown)$/i, "");
}

export function validateTool(
  content: string,
  file: string,
): ValidationResult<ToolDefinition> {
  const errors: ValidationError[] = [];
  const { frontmatter: fm, body } = parseFrontmatter(content);

  const name =
    typeof fm["name"] === "string" && fm["name"].trim() !== ""
      ? fm["name"].trim()
      : stem(file);

  const description =
    typeof fm["description"] === "string" && fm["description"].trim() !== ""
      ? fm["description"].trim()
      : "";
  if (!description) {
    errors.push({
      message: 'missing or empty required field "description"',
      file,
      field: "description",
    });
  }

  const command =
    typeof fm["command"] === "string" && fm["command"].trim() !== ""
      ? fm["command"].trim()
      : "";
  if (!command) {
    errors.push({
      message: 'missing or empty required field "command"',
      file,
      field: "command",
    });
  }

  const category =
    typeof fm["category"] === "string" && fm["category"].trim() !== ""
      ? fm["category"].trim()
      : "custom";

  const args = asStringArray(fm["args"]);

  const env: Record<string, string> = {};
  if (Array.isArray(fm["env"])) {
    for (const item of fm["env"]) {
      if (typeof item === "string") {
        const idx = item.indexOf("=");
        if (idx !== -1) {
          env[item.slice(0, idx).trim()] = item.slice(idx + 1).trim();
        }
      }
    }
  } else if (typeof fm["env"] === "object" && fm["env"] !== null) {
    for (const [k, v] of Object.entries(fm["env"])) {
      if (typeof v === "string") env[k] = v;
    }
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      description,
      command,
      args,
      category,
      env,
      sourceFile: file,
      body,
    },
  };
}
