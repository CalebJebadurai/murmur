/**
 * Minimal YAML emitter — zero dependencies.
 *
 * Emits the subset needed to write Copilot frontmatter and goose recipes:
 * nested maps, arrays of scalars, arrays of maps, and scalar strings/numbers/booleans.
 */

export type YamlValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | YamlValue[]
  | { [key: string]: YamlValue };

function needsQuoting(s: string): boolean {
  if (s === "") return true;
  if (/^[\s]|[\s]$/.test(s)) return true;
  // characters that have YAML meaning at the start or anywhere
  if (/[:#\[\]{}>|*&!%@`"']/.test(s)) return true;
  if (/^(true|false|null|yes|no|~)$/i.test(s)) return true;
  if (/^-?\d+(\.\d+)?$/.test(s)) return true;
  if (s.includes("\n")) return true;
  return false;
}

function emitScalar(v: string | number | boolean): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (needsQuoting(v)) {
    if (v.includes("\n")) {
      // block scalar
      const indented = v
        .split("\n")
        .map((l) => (l === "" ? "" : `  ${l}`))
        .join("\n");
      return `|\n${indented}`;
    }
    return JSON.stringify(v);
  }
  return v;
}

function isPlainObject(v: YamlValue): v is { [key: string]: YamlValue } {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v)
  );
}

function emit(value: YamlValue, indent: number): string {
  const pad = "  ".repeat(indent);

  if (value === null || value === undefined) return "";

  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    return value
      .map((item) => {
        if (isPlainObject(item)) {
          // Emit map entries, the first on the dash line and the rest indented.
          const entries = Object.entries(item).filter(
            ([, v]) => v !== undefined && v !== null,
          );
          const lines = entries.map(([k, v], idx) => {
            const prefix = idx === 0 ? `${pad}- ` : `${pad}  `;
            if (isPlainObject(v) || Array.isArray(v)) {
              const nested = emit(v, indent + 1);
              return `${prefix}${k}:\n${nested}`;
            }
            return `${prefix}${k}: ${emitScalar(v as string | number | boolean)}`;
          });
          return lines.join("\n");
        }
        return `${pad}- ${emitScalar(item as string | number | boolean)}`;
      })
      .join("\n");
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value).filter(
      ([, v]) => v !== undefined && v !== null,
    );
    return entries
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          if (v.length === 0) return `${pad}${k}: []`;
          if (v.every((x) => !isPlainObject(x) && !Array.isArray(x))) {
            const items = v
              .map((x) => `${pad}  - ${emitScalar(x as string | number | boolean)}`)
              .join("\n");
            return `${pad}${k}:\n${items}`;
          }
          // array of maps: delegate to the array branch at one deeper indent
          return `${pad}${k}:\n${emit(v, indent + 1)}`;
        }
        if (isPlainObject(v)) {
          const nested = emit(v, indent + 1);
          return `${pad}${k}:\n${nested}`;
        }
        return `${pad}${k}: ${emitScalar(v as string | number | boolean)}`;
      })
      .join("\n");
  }

  return `${pad}${emitScalar(value)}`;
}

/** Emit a YAML document (no leading/trailing fences). */
export function emitYaml(value: YamlValue): string {
  return emit(value, 0);
}

/** Emit a frontmatter block delimited by `---` fences, followed by a body. */
export function emitFrontmatterDoc(
  frontmatter: { [key: string]: YamlValue },
  body: string,
): string {
  const fm = emitYaml(frontmatter);
  return `---\n${fm}\n---\n\n${body.trimStart()}\n`;
}
