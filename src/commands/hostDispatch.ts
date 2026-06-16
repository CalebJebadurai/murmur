import type { Dispatcher, TurnResult } from "./run.ts";

/** Max bytes of host stdout we will read before treating output as oversized. */
const MAX_OUTPUT_BYTES = 256 * 1024;

export type HostCommand = {
  /** The base argv, e.g. ["claude"] or ["goose", "run"]. NEVER a shell string. */
  argv: string[];
};

/**
 * Build a Dispatcher that delegates each agent turn to a host CLI via Bun.spawn.
 *
 * SECURITY (this is net-new code-execution surface, gated by --allow-run):
 *  - spawn uses an ARGV ARRAY, never a shell string, so pipeline-derived text
 *    cannot inject a command (OWASP A03).
 *  - the agent name and a prompt are passed as SEPARATE argv elements.
 *  - captured stdout is UNTRUSTED: size-limited, never eval'd, never re-shelled.
 *  - any failure is a SOFT failure (status FAILED) that still logs — one bad turn
 *    never aborts the run.
 *
 * The optional score-emission contract: if the host prints a line
 * `MURMUR_SCORE: <number>`, we parse that single number; anything else is unscored.
 */
export function makeHostDispatcher(host: HostCommand): Dispatcher {
  return async (agent, phase, iteration): Promise<TurnResult> => {
    const prompt = `Run agent "${agent}" for pipeline phase "${phase}" (iteration ${iteration}).`;
    // argv array — no shell interpolation is possible.
    const argv = [...host.argv, "--agent", agent, "--prompt", prompt];
    try {
      const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
      const raw = await readCapped(proc.stdout, MAX_OUTPUT_BYTES);
      const exit = await proc.exited;
      if (raw.oversized) {
        return { agent, phase, iteration, status: "FAILED", note: "host output exceeded size limit (untrusted; discarded)" };
      }
      if (exit !== 0) {
        return { agent, phase, iteration, status: "FAILED", note: `host exited ${exit}` };
      }
      const score = parseScore(raw.text);
      const earlyExit = /MURMUR_EARLY_EXIT\b/.test(raw.text);
      const result: TurnResult = { agent, phase, iteration, status: "SUCCESS", note: "host turn" };
      if (score !== undefined) result.score = score;
      if (earlyExit) result.earlyExit = true;
      return result;
    } catch (err) {
      // spawn failure (e.g. command not found) is a soft failure.
      return { agent, phase, iteration, status: "FAILED", note: `spawn failed: ${(err as Error).message}` };
    }
  };
}

async function readCapped(
  stream: ReadableStream<Uint8Array> | undefined,
  limit: number,
): Promise<{ text: string; oversized: boolean }> {
  if (!stream) return { text: "", oversized: false };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let oversized = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > limit) {
        oversized = true;
        break;
      }
      chunks.push(value);
    }
  }
  try {
    await reader.cancel();
  } catch {
    /* ignore */
  }
  if (oversized) return { text: "", oversized: true };
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return { text: new TextDecoder().decode(buf), oversized: false };
}

/** Parse the single documented score contract line. Never parses arbitrary prose. */
export function parseScore(text: string): number | undefined {
  const m = text.match(/^\s*MURMUR_SCORE:\s*(-?\d+(?:\.\d+)?)\s*$/m);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}
