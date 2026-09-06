import type { Dispatcher, TurnResult } from "./run.ts";
import { parseScore } from "./hostDispatch.ts";
import type { SandboxConfig } from "../schema/config.ts";

/** Max bytes of sandbox output before treating it as oversized. */
const MAX_OUTPUT_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 60000;

export type DockerSandboxOptions = {
  image: string;
  projectRoot: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  spawnFn?: typeof Bun.spawn;
};

export type RemoteSandboxOptions = {
  endpoint: string;
  token?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
};

/**
 * Validate image string to prevent shell or flag injection attacks.
 */
export function isValidDockerImage(image: string): boolean {
  if (!image || typeof image !== "string") return false;
  // Standard Docker image tag pattern: name/repo:tag@digest
  return /^[a-zA-Z0-9][a-zA-Z0-9_./:-]*$/.test(image) && !image.includes("..");
}

/**
 * Validate remote sandbox URL.
 */
export function isValidRemoteUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Build a Dispatcher that delegates each agent turn to a Docker container sandbox.
 */
export function makeDockerSandboxDispatcher(opts: DockerSandboxOptions): Dispatcher {
  const spawn = opts.spawnFn ?? Bun.spawn;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!isValidDockerImage(opts.image)) {
    throw new Error(`Invalid or insecure Docker image name: "${opts.image}"`);
  }

  return async (agent, phase, iteration): Promise<TurnResult> => {
    const prompt = `Run agent "${agent}" for pipeline phase "${phase}" (iteration ${iteration}).`;
    const envArgs: string[] = [];
    if (opts.env) {
      for (const [k, v] of Object.entries(opts.env)) {
        envArgs.push("-e", `${k}=${v}`);
      }
    }

    const argv = [
      "docker",
      "run",
      "--rm",
      "-i",
      "-v",
      `${opts.projectRoot}:/workspace`,
      "-w",
      "/workspace",
      ...envArgs,
      opts.image,
      "--agent",
      agent,
      "--prompt",
      prompt,
    ];

    try {
      const proc = spawn(argv, { stdout: "pipe", stderr: "pipe", stdin: "ignore" });

      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        try {
          proc.kill();
        } catch {
          /* ignore */
        }
      }, timeoutMs);

      const raw = await readCapped(proc.stdout, MAX_OUTPUT_BYTES);
      const exit = await proc.exited;
      clearTimeout(timer);

      if (timedOut) {
        return {
          agent,
          phase,
          iteration,
          status: "FAILED",
          note: `sandbox timed out after ${timeoutMs}ms`,
        };
      }

      if (raw.oversized) {
        return {
          agent,
          phase,
          iteration,
          status: "FAILED",
          note: "sandbox output exceeded size limit (untrusted; discarded)",
        };
      }

      if (exit !== 0) {
        return {
          agent,
          phase,
          iteration,
          status: "FAILED",
          note: `sandbox exited ${exit}`,
        };
      }

      const score = parseScore(raw.text);
      const earlyExit = /MURMUR_EARLY_EXIT\b/.test(raw.text);
      const result: TurnResult = {
        agent,
        phase,
        iteration,
        status: "SUCCESS",
        note: `docker sandbox (${opts.image})`,
      };
      if (score !== undefined) result.score = score;
      if (earlyExit) result.earlyExit = true;
      return result;
    } catch (err) {
      return {
        agent,
        phase,
        iteration,
        status: "FAILED",
        note: `docker sandbox spawn failed: ${(err as Error).message}`,
      };
    }
  };
}

/**
 * Build a Dispatcher that delegates each agent turn to a remote HTTP/JSON-RPC sandbox.
 */
export function makeRemoteSandboxDispatcher(opts: RemoteSandboxOptions): Dispatcher {
  const fetchImpl = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!isValidRemoteUrl(opts.endpoint)) {
    throw new Error(`Invalid remote sandbox URL: "${opts.endpoint}"`);
  }

  return async (agent, phase, iteration): Promise<TurnResult> => {
    const prompt = `Run agent "${agent}" for pipeline phase "${phase}" (iteration ${iteration}).`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain",
    };
    if (opts.token) {
      headers["Authorization"] = `Bearer ${opts.token}`;
    }

    const payload = {
      jsonrpc: "2.0",
      id: `${agent}-${phase}-${iteration}`,
      method: "dispatch",
      params: {
        agent,
        phase,
        iteration,
        prompt,
      },
    };

    try {
      const resp = await fetchImpl(opts.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        return {
          agent,
          phase,
          iteration,
          status: "FAILED",
          note: `remote sandbox HTTP error: ${resp.status} ${resp.statusText}`,
        };
      }

      const text = await resp.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(text);
      } catch {
        // Fallback to text parsing
      }

      if (resJson && resJson.result) {
        const r = resJson.result;
        return {
          agent,
          phase,
          iteration,
          status: r.status === "FAILED" ? "FAILED" : "SUCCESS",
          score: typeof r.score === "number" ? r.score : undefined,
          earlyExit: Boolean(r.earlyExit),
          note: r.note || "remote sandbox turn",
        };
      }

      const score = parseScore(text);
      const earlyExit = /MURMUR_EARLY_EXIT\b/.test(text);
      const result: TurnResult = {
        agent,
        phase,
        iteration,
        status: "SUCCESS",
        note: "remote sandbox turn",
      };
      if (score !== undefined) result.score = score;
      if (earlyExit) result.earlyExit = true;
      return result;
    } catch (err: any) {
      clearTimeout(timer);
      const isTimeout = err?.name === "AbortError" || controller.signal.aborted;
      return {
        agent,
        phase,
        iteration,
        status: "FAILED",
        note: isTimeout
          ? `remote sandbox timed out after ${timeoutMs}ms`
          : `remote sandbox request failed: ${(err as Error).message}`,
      };
    }
  };
}

/**
 * High-level sandbox dispatcher resolver based on SandboxConfig.
 */
export function makeSandboxDispatcher(
  config: SandboxConfig,
  projectRoot: string,
  opts?: {
    spawnFn?: typeof Bun.spawn;
    fetchFn?: typeof fetch;
  },
): Dispatcher {
  switch (config.type) {
    case "docker": {
      const image = config.image || "murmr/sandbox:latest";
      return makeDockerSandboxDispatcher({
        image,
        projectRoot,
        timeoutMs: config.timeoutMs,
        env: config.env,
        spawnFn: opts?.spawnFn,
      });
    }
    case "remote": {
      if (!config.endpoint) {
        throw new Error('Remote sandbox requires "endpoint" in configuration');
      }
      return makeRemoteSandboxDispatcher({
        endpoint: config.endpoint,
        token: config.token,
        timeoutMs: config.timeoutMs,
        fetchFn: opts?.fetchFn,
      });
    }
    case "process":
    default: {
      throw new Error(`Unsupported sandbox type: "${config.type}"`);
    }
  }
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
