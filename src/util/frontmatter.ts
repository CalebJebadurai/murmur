/**
 * Minimal YAML frontmatter parser — zero dependencies.
 *
 * Supports the subset the Murmuration IR needs:
 *  - scalar strings (bare or quoted), numbers, booleans
 *  - inline arrays: [a, b, c]
 *  - block arrays:
 *      key:
 *        - item
 *        - item
 *
 * It is intentionally NOT a full YAML implementation. Anything outside this
 * subset is rejected by the validator rather than silently mis-parsed.
 */

export type FrontmatterValue = string | number | boolean | FrontmatterValue[];
export type Frontmatter = Record<string, FrontmatterValue>;

export type ParsedDocument = {
  frontmatter: Frontmatter;
  body: string;
};

function stripQuotes(raw: string): string {
  const t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

function parseScalar(raw: string): FrontmatterValue {
  const t = raw.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t !== "" && !Number.isNaN(Number(t)) && /^-?\d+(\.\d+)?$/.test(t)) {
    return Number(t);
  }
  return stripQuotes(t);
}

function parseInlineArray(raw: string): FrontmatterValue[] {
  const inner = raw.trim().slice(1, -1).trim();
  if (inner === "") return [];
  // naive split on commas not inside quotes
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = "";
  for (const ch of inner) {
    if (quote) {
      if (ch === quote) quote = null;
      cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === "[") {
      depth++;
      cur += ch;
    } else if (ch === "]") {
      depth--;
      cur += ch;
    } else if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== "") parts.push(cur);
  return parts.map((p) => parseScalar(p));
}

/**
 * Parse a Markdown document with optional `---` YAML frontmatter.
 * Returns the frontmatter map and the remaining body.
 */
export function parseFrontmatter(content: string): ParsedDocument {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { frontmatter: {}, body: normalized };
  }
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) {
    return { frontmatter: {}, body: normalized };
  }
  const fmBlock = normalized.slice(4, end);
  // body starts after the closing fence line
  const afterFence = normalized.indexOf("\n", end + 1);
  const body = afterFence === -1 ? "" : normalized.slice(afterFence + 1);

  const fm: Frontmatter = {};
  const lines = fmBlock.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "" || line.trim().startsWith("#")) {
      i++;
      continue;
    }
    const colon = line.indexOf(":");
    if (colon === -1) {
      i++;
      continue;
    }
    const key = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).trim();

    if (rest === "") {
      // possible block array
      const items: FrontmatterValue[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j] ?? "";
        const m = next.match(/^\s*-\s+(.*)$/);
        if (!m) break;
        items.push(parseScalar(m[1] ?? ""));
        j++;
      }
      fm[key] = items;
      i = j;
      continue;
    }

    if (rest.startsWith("[")) {
      fm[key] = parseInlineArray(rest);
    } else {
      fm[key] = parseScalar(rest);
    }
    i++;
  }

  return { frontmatter: fm, body: body.trimStart() };
}

/** Coerce a frontmatter value to a string array (tolerant of scalars and unknown values). */
export function asStringArray(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [String(v)];
}

