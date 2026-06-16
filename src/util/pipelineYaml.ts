/**
 * Strict, minimal YAML-subset reader for pipeline and rubric document BODIES.
 *
 * The hand-written `parseFrontmatter` reader (util/frontmatter.ts) cannot ingest
 * arrays-of-maps and *silently mis-parses* anything outside its subset. Pipelines
 * and rubrics are inherently nested arrays-of-maps, so their structured data lives
 * in the Markdown body and is parsed here instead.
 *
 * This reader is deliberately NOT a general YAML engine. It accepts a closed,
 * documented subset and HARD-ERRORS (never silently mis-parses) on anything else:
 *   - two-space-indented block mappings
 *   - block sequences of scalars (`- value`)
 *   - block sequences of mappings (`- key: value` + indented continuation)
 *   - scalar values: strings (bare or quoted), integers, booleans
 *
 * Rejected with a precise file+line PARSE-ERROR: tabs, flow maps/sequences
 * (`{a: 1}` / `[a, b]`), anchors/aliases (`&`/`*`), tag directives (`!!`),
 * document markers (`---`/`...`), and inconsistent indentation.
 */

export type YamlNode =
  | string
  | number
  | boolean
  | YamlNode[]
  | { [key: string]: YamlNode };

export type ParseResult =
  | { ok: true; value: YamlNode }
  | { ok: false; error: { message: string; file: string; line: number } };

const INDENT = 2;

type Line = { raw: string; indent: number; content: string; n: number };

function fail(file: string, line: number, message: string): ParseResult {
  return { ok: false, error: { file, line, message } };
}

/** Tokenize into significant lines, rejecting tabs and document markers up front. */
function tokenize(
  body: string,
  file: string,
): { ok: true; lines: Line[] } | { ok: false; error: ParseResult } {
  const out: Line[] = [];
  const rawLines = body.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]!;
    const n = i + 1;
    if (raw.includes("\t")) {
      return { ok: false, error: fail(file, n, "tabs are not allowed (use two-space indentation)") };
    }
    const trimmedRight = raw.replace(/\s+$/, "");
    const noComment = stripComment(trimmedRight);
    if (noComment.trim() === "") continue;
    if (/^(---|\.\.\.)\s*$/.test(noComment.trim())) {
      return { ok: false, error: fail(file, n, "document markers (--- / ...) are not allowed in a pipeline body") };
    }
    const indentMatch = noComment.match(/^( *)/);
    const indent = indentMatch ? indentMatch[1]!.length : 0;
    if (indent % INDENT !== 0) {
      return { ok: false, error: fail(file, n, `indentation must be a multiple of ${INDENT} spaces`) };
    }
    out.push({ raw, indent, content: noComment.slice(indent), n });
  }
  return { ok: true, lines: out };
}

/** Strip a trailing ` # comment` not inside quotes. */
function stripComment(s: string): string {
  let inS = false;
  let inD = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'" && !inD) inS = !inS;
    else if (ch === '"' && !inS) inD = !inD;
    else if (ch === "#" && !inS && !inD && (i === 0 || s[i - 1] === " ")) {
      return s.slice(0, i);
    }
  }
  return s;
}

function rejectsFlow(value: string): boolean {
  const t = value.trim();
  return t.startsWith("{") || t.startsWith("&") || t.startsWith("*") || t.startsWith("!!");
}

/** Split an inline `[a, b, c]` array on top-level commas, respecting quotes. */
function parseInlineArray(
  file: string,
  n: number,
  raw: string,
): { ok: true; value: YamlNode } | { ok: false; error: ParseResult } {
  const inner = raw.trim().slice(1, -1).trim();
  if (inner === "") return { ok: true, value: [] };
  const parts: string[] = [];
  let cur = "";
  let inS = false;
  let inD = false;
  for (const ch of inner) {
    if (ch === "'" && !inD) { inS = !inS; cur += ch; }
    else if (ch === '"' && !inS) { inD = !inD; cur += ch; }
    else if (ch === "," && !inS && !inD) { parts.push(cur); cur = ""; }
    else if ((ch === "[" || ch === "{") && !inS && !inD) {
      return { ok: false, error: fail(file, n, "nested flow collections are not allowed") };
    } else cur += ch;
  }
  if (cur.trim() !== "") parts.push(cur);
  const arr: YamlNode[] = [];
  for (const p of parts) {
    const sc = parseScalar(file, n, p);
    if (!sc.ok) return sc;
    arr.push(sc.value);
  }
  return { ok: true, value: arr };
}

function parseScalar(file: string, n: number, raw: string): { ok: true; value: YamlNode } | { ok: false; error: ParseResult } {
  const t = raw.trim();
  if (t.startsWith("[") && t.endsWith("]")) {
    return parseInlineArray(file, n, t);
  }
  if (rejectsFlow(t)) {
    return { ok: false, error: fail(file, n, `flow/anchor/tag syntax is not allowed: "${t}"`) };
  }
  if (t === "true") return { ok: true, value: true };
  if (t === "false") return { ok: true, value: false };
  if (/^-?\d+$/.test(t)) return { ok: true, value: Number(t) };
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return { ok: true, value: t.slice(1, -1) };
  }
  return { ok: true, value: t };
}

/**
 * Parse a block (mapping or sequence) whose lines all share `baseIndent`.
 * Returns the parsed node and consumes lines via the shared cursor object.
 */
function parseBlock(
  lines: Line[],
  cursor: { i: number },
  baseIndent: number,
  file: string,
): { ok: true; value: YamlNode } | { ok: false; error: ParseResult } {
  const first = lines[cursor.i]!;
  const isSeq = first.content.startsWith("- ") || first.content === "-";

  if (isSeq) {
    const arr: YamlNode[] = [];
    while (cursor.i < lines.length) {
      const line = lines[cursor.i]!;
      if (line.indent < baseIndent) break;
      if (line.indent > baseIndent) {
        return { ok: false, error: fail(file, line.n, "unexpected indentation inside a sequence") };
      }
      if (!(line.content.startsWith("- ") || line.content === "-")) {
        return { ok: false, error: fail(file, line.n, "expected a sequence item ('- ...') at this indentation") };
      }
      const after = line.content === "-" ? "" : line.content.slice(2);
      if (after.includes(":") && !isQuotedScalar(after)) {
        // sequence of mappings: rewrite this line as the first map key at baseIndent+2
        const res = parseSeqMapItem(lines, cursor, baseIndent, file);
        if (!res.ok) return res;
        arr.push(res.value);
      } else if (after.trim() === "") {
        return { ok: false, error: fail(file, line.n, "empty sequence items are not allowed") };
      } else {
        const sc = parseScalar(file, line.n, after);
        if (!sc.ok) return sc;
        arr.push(sc.value);
        cursor.i++;
      }
    }
    return { ok: true, value: arr };
  }

  // mapping
  const map: { [key: string]: YamlNode } = {};
  while (cursor.i < lines.length) {
    const line = lines[cursor.i]!;
    if (line.indent < baseIndent) break;
    if (line.indent > baseIndent) {
      return { ok: false, error: fail(file, line.n, "unexpected indentation inside a mapping") };
    }
    if (line.content.startsWith("- ")) break;
    const colon = findColon(line.content);
    if (colon === -1) {
      return { ok: false, error: fail(file, line.n, `expected "key: value" mapping at this indentation`) };
    }
    const key = line.content.slice(0, colon).trim();
    const rest = line.content.slice(colon + 1).trim();
    if (key === "") return { ok: false, error: fail(file, line.n, "empty mapping key") };
    if (rest === "") {
      // nested block
      cursor.i++;
      if (cursor.i >= lines.length || lines[cursor.i]!.indent <= baseIndent) {
        return { ok: false, error: fail(file, line.n, `key "${key}" has no value or nested block`) };
      }
      const childIndent = lines[cursor.i]!.indent;
      if (childIndent !== baseIndent + INDENT) {
        return { ok: false, error: fail(file, lines[cursor.i]!.n, "nested block must be indented exactly two more spaces") };
      }
      const child = parseBlock(lines, cursor, childIndent, file);
      if (!child.ok) return child;
      map[key] = child.value;
    } else {
      const sc = parseScalar(file, line.n, rest);
      if (!sc.ok) return sc;
      map[key] = sc.value;
      cursor.i++;
    }
  }
  return { ok: true, value: map };
}

/** Parse one `- key: value` sequence-of-mappings item (and its continuation lines). */
function parseSeqMapItem(
  lines: Line[],
  cursor: { i: number },
  baseIndent: number,
  file: string,
): { ok: true; value: YamlNode } | { ok: false; error: ParseResult } {
  const line = lines[cursor.i]!;
  const after = line.content.slice(2); // strip "- "
  const colon = findColon(after);
  if (colon === -1) {
    return { ok: false, error: fail(file, line.n, "expected 'key: value' after '-'") };
  }
  // Synthesize a virtual mapping block: first key from this line, rest from
  // continuation lines indented at baseIndent + 2.
  const map: { [key: string]: YamlNode } = {};
  const firstKey = after.slice(0, colon).trim();
  const firstRest = after.slice(colon + 1).trim();
  const itemIndent = baseIndent + INDENT;

  const consumeValue = (key: string, rest: string, atLineN: number): ParseResult | null => {
    if (rest === "") {
      cursor.i++;
      if (cursor.i >= lines.length || lines[cursor.i]!.indent <= baseIndent + 1) {
        return fail(file, atLineN, `key "${key}" has no value or nested block`);
      }
      const childIndent = lines[cursor.i]!.indent;
      const child = parseBlock(lines, cursor, childIndent, file);
      if (!child.ok) return child.error;
      map[key] = child.value;
    } else {
      const sc = parseScalar(file, atLineN, rest);
      if (!sc.ok) return sc.error;
      map[key] = sc.value;
      cursor.i++;
    }
    return null;
  };

  const e1 = consumeValue(firstKey, firstRest, line.n);
  if (e1) return { ok: false, error: e1 };

  // continuation: same item, keys at itemIndent
  while (cursor.i < lines.length) {
    const cont = lines[cursor.i]!;
    if (cont.indent !== itemIndent) break;
    if (cont.content.startsWith("- ")) break;
    const colon2 = findColon(cont.content);
    if (colon2 === -1) {
      return { ok: false, error: fail(file, cont.n, "expected 'key: value' in mapping item") };
    }
    const k = cont.content.slice(0, colon2).trim();
    const r = cont.content.slice(colon2 + 1).trim();
    const e = consumeValue(k, r, cont.n);
    if (e) return { ok: false, error: e };
  }
  return { ok: true, value: map };
}

function isQuotedScalar(s: string): boolean {
  const t = s.trim();
  return (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"));
}

/** Find the first `:` that separates a mapping key from its value (skips quotes). */
function findColon(s: string): number {
  let inS = false;
  let inD = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'" && !inD) inS = !inS;
    else if (ch === '"' && !inS) inD = !inD;
    else if (ch === ":" && !inS && !inD) {
      if (i + 1 >= s.length || s[i + 1] === " ") return i;
    }
  }
  return -1;
}

/**
 * Extract the first fenced ```yaml block from a Markdown body. Pipelines and
 * rubrics keep prose in the body and put their structured data in one such block.
 * Returns the block contents (without fences) or null if there is none.
 */
export function extractYamlBlock(body: string): string | null {
  const normalized = body.replace(/\r\n/g, "\n");
  const m = normalized.match(/```ya?ml\n([\s\S]*?)\n```/);
  return m ? m[1]! : null;
}

/**
 * Parse a pipeline/rubric document body (the text after the frontmatter block)
 * as the strict YAML subset. Returns the parsed node tree or a precise error.
 */
export function parsePipelineYaml(body: string, file: string): ParseResult {
  const block = extractYamlBlock(body);
  const source = block ?? body;
  const tok = tokenize(source, file);
  if (!tok.ok) return tok.error;
  if (tok.lines.length === 0) return { ok: true, value: {} };
  const cursor = { i: 0 };
  const res = parseBlock(tok.lines, cursor, tok.lines[0]!.indent, file);
  if (!res.ok) return res.error;
  if (cursor.i < tok.lines.length) {
    return fail(file, tok.lines[cursor.i]!.n, "unexpected content after the top-level block");
  }
  return { ok: true, value: res.value };
}
