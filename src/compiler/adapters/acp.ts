import type {
  AgentDefinition,
  InstructionDefinition,
  PipelineDefinition,
  SkillDefinition,
  SubagentDefinition,
} from "../../schema/index.ts";
import { emitFrontmatterDoc, type YamlValue } from "../../util/yaml.ts";
import type {
  CompileContext,
  EmittedFile,
  RuntimeCompiler,
} from "../RuntimeCompiler.ts";

/**
 * Agent Client Protocol (ACP) adapter — emits protocol-level portability files:
 *  - .acp/manifest.json (protocol version, capabilities, registered agents, tools, pipelines)
 *  - .acp/agents/<name>.json (machine-readable agent definitions)
 *  - .acp/skills/<name>/SKILL.md (declarative knowledge packages)
 *  - .acp/instructions/<name>.json (rule specifications)
 *  - .acp/pipelines/<name>.json (orchestrated multi-phase workflows)
 *  - .acp/server.ts (self-contained JSON-RPC 2.0 stdio server runnable via bun or node)
 */
export class AcpAdapter implements RuntimeCompiler {
  readonly id = "acp";

  compileAgent(agent: AgentDefinition): EmittedFile[] {
    const data = {
      name: agent.name,
      description: agent.description,
      role: agent.role,
      tools: agent.tools,
      model: agent.model ?? [],
      skills: agent.skills,
      instructions: agent.instructions,
      dispatch: agent.dispatch
        ? {
            invokeWhen: agent.dispatch.invokeWhen,
            skipWhen: agent.dispatch.skipWhen,
            tasks: agent.dispatch.tasks,
          }
        : undefined,
      userInvocable: agent.userInvocable ?? true,
    };
    return [
      {
        path: `.acp/agents/${agent.name}.json`,
        contents: JSON.stringify(data, null, 2) + "\n",
      },
    ];
  }

  compileSubagent(sub: SubagentDefinition): EmittedFile[] {
    const data = {
      name: sub.name,
      description: sub.description,
      role: sub.role,
      tools: sub.tools,
      model: sub.model ?? [],
      skills: sub.skills,
      instructions: sub.instructions,
      dispatch: sub.dispatch
        ? {
            invokeWhen: sub.dispatch.invokeWhen,
            skipWhen: sub.dispatch.skipWhen,
            tasks: sub.dispatch.tasks,
          }
        : undefined,
      spawnTrigger: sub.spawn.trigger,
      userInvocable: sub.userInvocable ?? false,
    };
    return [
      {
        path: `.acp/agents/${sub.name}.json`,
        contents: JSON.stringify(data, null, 2) + "\n",
      },
    ];
  }

  compileSkill(skill: SkillDefinition): EmittedFile[] {
    const fm: Record<string, YamlValue> = {
      name: skill.name,
      description: skill.description,
    };
    const files: EmittedFile[] = [
      {
        path: `.acp/skills/${skill.name}/SKILL.md`,
        contents: emitFrontmatterDoc(fm, skill.body),
      },
    ];
    if (skill.assets) {
      for (const a of skill.assets) {
        files.push({
          path: `.acp/skills/${skill.name}/${a.relativePath}`,
          contents: a.contents ?? "",
        });
      }
    }
    return files;
  }

  compileInstruction(instruction: InstructionDefinition): EmittedFile[] {
    const data = {
      name: instruction.name,
      applyTo: instruction.applyTo,
      rules: instruction.rules,
      sections: instruction.sections,
    };
    return [
      {
        path: `.acp/instructions/${instruction.name}.json`,
        contents: JSON.stringify(data, null, 2) + "\n",
      },
    ];
  }

  compilePipeline(pipeline: PipelineDefinition): EmittedFile[] {
    return [
      {
        path: `.acp/pipelines/${pipeline.name}.json`,
        contents: JSON.stringify(pipeline, null, 2) + "\n",
      },
    ];
  }

  finalize(ctx: CompileContext): EmittedFile[] {
    const projectName = ctx.config.project?.name || "murmur";
    const projectDesc =
      ctx.config.project?.description || "Murmur ACP Agent Server";

    const allAgents = [
      ...ctx.ir.agents.map((a) => ({
        name: a.name,
        description: a.description,
        isSubagent: false,
        tools: a.tools,
        dispatch: a.dispatch,
      })),
      ...ctx.ir.subagents.map((s) => ({
        name: s.name,
        description: s.description,
        isSubagent: true,
        tools: s.tools,
        dispatch: s.dispatch,
      })),
    ];

    const allTools = ctx.ir.tools.map((t) => ({
      name: t.name,
      description: t.description,
      command: t.command,
      args: t.args,
      category: t.category,
    }));

    const manifest = {
      acpVersion: "2.0",
      protocol: "agent-client-protocol",
      server: {
        name: projectName,
        description: projectDesc,
        version: "2.0.0",
      },
      capabilities: {
        sessions: true,
        tools: true,
        prompts: true,
        streaming: true,
        cancel: true,
      },
      agents: allAgents,
      tools: allTools,
      skills: ctx.ir.skills.map((s) => ({ name: s.name, description: s.description })),
      instructions: ctx.ir.instructions.map((i) => ({
        name: i.name,
        applyTo: i.applyTo,
      })),
      pipelines: ctx.ir.pipelines.map((p) => ({
        name: p.name,
        description: p.description,
        branches: Object.keys(p.branches),
      })),
    };

    const serverScript = `#!/usr/bin/env bun
/**
 * Agent Client Protocol (ACP) JSON-RPC 2.0 stdio server
 * Generated by Murmuration (ACP adapter) for ${projectName}
 *
 * Conforms to https://agentclientprotocol.com/
 * Run via: bun .acp/server.ts  OR  node .acp/server.ts
 */

import { createInterface } from "node:readline";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: any;
};

type Session = {
  id: string;
  agent?: string;
  cwd?: string;
  createdAt: number;
  activeTurnId?: string | number | null;
};

const sessions = new Map<string, Session>();
let nextSessionId = 1;

function sendResponse(id: string | number | null | undefined, result: any): void {
  if (id === undefined || id === null) return;
  const msg = JSON.stringify({ jsonrpc: "2.0", id, result });
  process.stdout.write(msg + "\\n");
}

function sendError(id: string | number | null | undefined, code: number, message: string, data?: any): void {
  if (id === undefined || id === null) return;
  const msg = JSON.stringify({ jsonrpc: "2.0", id, error: { code, message, data } });
  process.stdout.write(msg + "\\n");
}

function sendNotification(method: string, params: any): void {
  const msg = JSON.stringify({ jsonrpc: "2.0", method, params });
  process.stdout.write(msg + "\\n");
}

export function handleRequest(req: JsonRpcRequest): void {
  const { id, method, params } = req;

  switch (method) {
    case "initialize": {
      sendResponse(id, {
        protocolVersion: "2.0",
        serverInfo: manifest.server,
        capabilities: manifest.capabilities,
        agents: manifest.agents.map((a: any) => ({
          name: a.name,
          description: a.description,
          isSubagent: a.isSubagent,
        })),
      });
      break;
    }

    case "tools/list": {
      sendResponse(id, {
        tools: manifest.tools,
      });
      break;
    }

    case "session/new": {
      const sessionId = \`sess_\${nextSessionId++}_\${Date.now()}\`;
      const requestedAgent = params?.agent || manifest.agents[0]?.name;
      const session: Session = {
        id: sessionId,
        agent: requestedAgent,
        cwd: params?.cwd || process.cwd(),
        createdAt: Date.now(),
      };
      sessions.set(sessionId, session);
      sendResponse(id, {
        sessionId,
        agent: requestedAgent,
      });
      break;
    }

    case "session/list": {
      const list = [...sessions.values()].map((s) => ({
        sessionId: s.id,
        agent: s.agent,
        cwd: s.cwd,
        createdAt: s.createdAt,
      }));
      sendResponse(id, { sessions: list });
      break;
    }

    case "session/prompt": {
      const sessionId = params?.sessionId;
      const session = sessionId ? sessions.get(sessionId) : undefined;
      if (!session) {
        sendError(id, -32602, \`Session "\${sessionId}" not found\`);
        break;
      }

      session.activeTurnId = id;
      const prompt = params?.prompt || "";
      const agentName = params?.agent || session.agent || "architect";

      // Send streaming update notification
      sendNotification("session/update", {
        sessionId,
        status: "processing",
        agent: agentName,
        message: \`Agent "\${agentName}" received prompt.\`,
      });

      // Formulate turn response
      sendResponse(id, {
        status: "completed",
        sessionId,
        agent: agentName,
        text: \`[ACP Turn Response for "\${agentName}"] Processed turn for prompt: "\${prompt}"\`,
      });
      session.activeTurnId = null;
      break;
    }

    case "session/cancel": {
      const sessionId = params?.sessionId;
      const session = sessionId ? sessions.get(sessionId) : undefined;
      if (session && session.activeTurnId) {
        sendNotification("session/update", {
          sessionId,
          status: "cancelled",
          message: "Turn cancelled by client.",
        });
        session.activeTurnId = null;
      }
      sendResponse(id, { cancelled: true });
      break;
    }

    case "$/cancel_request": {
      // Per ACP / LSP spec, $/cancel_request is a notification
      const cancelId = params?.id;
      for (const s of sessions.values()) {
        if (s.activeTurnId === cancelId) {
          s.activeTurnId = null;
        }
      }
      break;
    }

    default: {
      sendError(id, -32601, \`Method "\${method}" not found\`);
      break;
    }
  }
}

// Start stdio reader if executed directly
if (import.meta.main || process.argv[1]?.endsWith(".acp/server.ts")) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const req = JSON.parse(trimmed) as JsonRpcRequest;
      handleRequest(req);
    } catch (err) {
      sendError(null, -32700, "Parse error: invalid JSON");
    }
  });
}
`;

    return [
      {
        path: ".acp/manifest.json",
        contents: JSON.stringify(manifest, null, 2) + "\n",
      },
      {
        path: ".acp/server.ts",
        contents: serverScript,
      },
    ];
  }
}
