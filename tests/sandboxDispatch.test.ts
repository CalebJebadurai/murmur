import { describe, expect, test } from "bun:test";
import {
  isValidDockerImage,
  isValidRemoteUrl,
  makeDockerSandboxDispatcher,
  makeRemoteSandboxDispatcher,
  makeSandboxDispatcher,
} from "../src/commands/sandboxDispatch.ts";
import { runCommand } from "../src/commands/run.ts";
import { join } from "node:path";

const FIXTURES_DIR = join(import.meta.dir, "fixtures/valid-base");

describe("Cloud Sandbox Dispatcher — Security Validation", () => {
  test("isValidDockerImage validates image names correctly", () => {
    expect(isValidDockerImage("alpine")).toBe(true);
    expect(isValidDockerImage("alpine:latest")).toBe(true);
    expect(isValidDockerImage("ghcr.io/org/runner:v1.0")).toBe(true);
    expect(isValidDockerImage("my-registry:5000/sandbox:latest")).toBe(true);

    // Reject dangerous / injection characters
    expect(isValidDockerImage("alpine; rm -rf /")).toBe(false);
    expect(isValidDockerImage("image$(whoami)")).toBe(false);
    expect(isValidDockerImage("image`cat /etc/passwd`")).toBe(false);
    expect(isValidDockerImage("image..tag")).toBe(false);
    expect(isValidDockerImage("")).toBe(false);
  });

  test("isValidRemoteUrl validates HTTP/HTTPS endpoints", () => {
    expect(isValidRemoteUrl("http://localhost:8080/dispatch")).toBe(true);
    expect(isValidRemoteUrl("https://sandbox.cloud.internal/turn")).toBe(true);

    // Reject non-http
    expect(isValidRemoteUrl("file:///etc/passwd")).toBe(false);
    expect(isValidRemoteUrl("ftp://example.com")).toBe(false);
    expect(isValidRemoteUrl("not-a-url")).toBe(false);
  });
});

describe("Docker Sandbox Dispatcher", () => {
  test("constructs secure argv and parses score on success", async () => {
    let capturedArgv: string[] = [];

    const mockSpawn = ((argv: string[]) => {
      capturedArgv = argv;
      const stdoutStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              "Processing inside container...\nMURMUR_SCORE: 4.5\nMURMUR_EARLY_EXIT\n",
            ),
          );
          controller.close();
        },
      });
      return {
        stdout: stdoutStream,
        stderr: undefined,
        exited: Promise.resolve(0),
        kill: () => {},
      };
    }) as any;

    const dispatcher = makeDockerSandboxDispatcher({
      image: "murmr/sandbox:latest",
      projectRoot: "/tmp/project",
      env: { NODE_ENV: "production" },
      spawnFn: mockSpawn,
    });

    const result = await dispatcher("critic", "Phase 1", 1);

    expect(capturedArgv[0]).toBe("docker");
    expect(capturedArgv[1]).toBe("run");
    expect(capturedArgv).toContain("-v");
    expect(capturedArgv).toContain("/tmp/project:/workspace");
    expect(capturedArgv).toContain("-e");
    expect(capturedArgv).toContain("NODE_ENV=production");
    expect(capturedArgv).toContain("murmr/sandbox:latest");
    expect(capturedArgv).toContain("--agent");
    expect(capturedArgv).toContain("critic");

    expect(result.status).toBe("SUCCESS");
    expect(result.score).toBe(4.5);
    expect(result.earlyExit).toBe(true);
    expect(result.note).toContain("docker sandbox");
  });

  test("handles container exit failure gracefully as soft failure", async () => {
    const mockSpawn = (() => {
      const stdoutStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("Container out of memory\n"));
          controller.close();
        },
      });
      return {
        stdout: stdoutStream,
        stderr: undefined,
        exited: Promise.resolve(137),
        kill: () => {},
      };
    }) as any;

    const dispatcher = makeDockerSandboxDispatcher({
      image: "murmr/sandbox:latest",
      projectRoot: "/tmp/project",
      spawnFn: mockSpawn,
    });

    const result = await dispatcher("critic", "Phase 1", 1);
    expect(result.status).toBe("FAILED");
    expect(result.note).toContain("sandbox exited 137");
  });
});

describe("Remote HTTP Sandbox Dispatcher", () => {
  test("sends JSON-RPC payload with authorization and parses structured response", async () => {
    let capturedUrl = "";
    let capturedHeaders: any = {};
    let capturedBody: any = {};

    const mockFetch = (async (url: string, init: any) => {
      capturedUrl = url;
      capturedHeaders = init.headers;
      capturedBody = JSON.parse(init.body);

      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            jsonrpc: "2.0",
            id: capturedBody.id,
            result: {
              status: "SUCCESS",
              score: 5,
              earlyExit: false,
              note: "completed remotely on Cloud VM",
            },
          }),
      };
    }) as any;

    const dispatcher = makeRemoteSandboxDispatcher({
      endpoint: "https://sandbox.cloud.internal/agent-turn",
      token: "secret-token-123",
      fetchFn: mockFetch,
    });

    const result = await dispatcher("implementer", "Phase 5", 2);

    expect(capturedUrl).toBe("https://sandbox.cloud.internal/agent-turn");
    expect(capturedHeaders["Authorization"]).toBe("Bearer secret-token-123");
    expect(capturedBody.method).toBe("dispatch");
    expect(capturedBody.params.agent).toBe("implementer");

    expect(result.status).toBe("SUCCESS");
    expect(result.score).toBe(5);
    expect(result.note).toBe("completed remotely on Cloud VM");
  });

  test("handles remote HTTP 500 error gracefully as soft failure", async () => {
    const mockFetch = (async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    })) as any;

    const dispatcher = makeRemoteSandboxDispatcher({
      endpoint: "https://sandbox.cloud.internal/agent-turn",
      fetchFn: mockFetch,
    });

    const result = await dispatcher("analyst", "Phase 0", 1);
    expect(result.status).toBe("FAILED");
    expect(result.note).toContain("HTTP error: 500");
  });
});

describe("makeSandboxDispatcher factory", () => {
  test("creates docker dispatcher from config", () => {
    const dispatcher = makeSandboxDispatcher(
      {
        type: "docker",
        image: "custom/runner:1.0",
      },
      "/tmp/workspace",
    );
    expect(typeof dispatcher).toBe("function");
  });

  test("creates remote dispatcher from config", () => {
    const dispatcher = makeSandboxDispatcher(
      {
        type: "remote",
        endpoint: "http://localhost:9000/turn",
      },
      "/tmp/workspace",
    );
    expect(typeof dispatcher).toBe("function");
  });

  test("throws on invalid remote configuration missing endpoint", () => {
    expect(() =>
      makeSandboxDispatcher(
        {
          type: "remote",
        },
        "/tmp/workspace",
      ),
    ).toThrow('Remote sandbox requires "endpoint"');
  });
});
