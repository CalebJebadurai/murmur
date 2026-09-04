import { join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { loadIR } from "../schema/load.ts";
import { loadConfig } from "../util/loadConfig.ts";
import type { IRSet } from "../schema/index.ts";

export type DocsOptions = {
  out?: string;
  serve?: boolean;
  port?: number;
  signal?: AbortSignal;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderSimpleMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        inCode = false;
        out.push(
          `<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeLines.join("\n"))}</code></pre>`,
        );
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("# ")) {
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith("- ")) {
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else if (line.trim() === "") {
      out.push("<br/>");
    } else {
      out.push(`<p>${escapeHtml(line)}</p>`);
    }
  }

  return out.join("\n");
}

export function generateDocsHtml(
  projectName: string,
  ir: IRSet,
  runLogContent?: string,
): string {
  const dataJson = JSON.stringify({
    projectName,
    ir,
    runLog: runLogContent ?? null,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(projectName)} — Agent Architecture Portal</title>
  <style>
    :root {
      --bg: #090d16;
      --sidebar-bg: #0d1322;
      --card-bg: #131b2e;
      --border: #1e293b;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.15);
      --success: #34d399;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    #sidebar {
      width: 320px;
      min-width: 320px;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    #sidebar-header {
      padding: 1.25rem 1rem;
      border-bottom: 1px solid var(--border);
    }
    #sidebar-header h1 {
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    #search-box {
      margin-top: 0.75rem;
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      color: #fff;
      padding: 0.45rem 0.75rem;
      border-radius: 6px;
      font-size: 0.85rem;
    }
    #search-box:focus { outline: none; border-color: var(--accent); }
    #nav {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem;
    }
    .nav-section-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin: 1rem 0.5rem 0.4rem;
    }
    .nav-item {
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.15s;
    }
    .nav-item:hover { background: rgba(255, 255, 255, 0.05); color: #fff; }
    .nav-item.active { background: var(--accent-glow); color: var(--accent); font-weight: 600; }
    .nav-badge { font-size: 0.7rem; background: var(--border); padding: 0.15rem 0.4rem; border-radius: 4px; color: var(--text-muted); }
    #main {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow-y: auto;
      padding: 2rem 3rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    h2.title { font-size: 1.5rem; margin-bottom: 0.5rem; color: #fff; }
    p.desc { font-size: 1rem; color: var(--text-muted); margin-bottom: 1rem; line-height: 1.5; }
    .tags { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .tag { font-size: 0.75rem; background: var(--bg); border: 1px solid var(--border); padding: 0.25rem 0.6rem; border-radius: 4px; font-family: var(--font-mono); }
    pre { background: #070a12; border: 1px solid var(--border); padding: 1rem; border-radius: 6px; overflow-x: auto; font-family: var(--font-mono); font-size: 0.85rem; margin: 1rem 0; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid var(--border); padding: 0.6rem 0.8rem; text-align: left; font-size: 0.85rem; }
    th { background: #0d1424; font-weight: 600; }
  </style>
</head>
<body>
  <div id="sidebar">
    <div id="sidebar-header">
      <h1>🐦‍⬛ ${escapeHtml(projectName)}</h1>
      <input type="text" id="search-box" placeholder="Filter agents, skills, tools..." oninput="filterNav(this.value)" />
    </div>
    <div id="nav">
      <!-- Generated via JS -->
    </div>
  </div>
  <div id="main">
    <div id="content">Select an item from the sidebar to view documentation.</div>
  </div>

  <script>
    const DATA = ${dataJson};
    let currentKey = "";

    function init() {
      renderNav();
      // Select first agent by default
      if (DATA.ir.agents.length > 0) {
        selectItem('agent', DATA.ir.agents[0].name);
      } else if (DATA.ir.pipelines.length > 0) {
        selectItem('pipeline', DATA.ir.pipelines[0].name);
      }
    }

    function renderNav(query = "") {
      const q = query.toLowerCase().trim();
      const nav = document.getElementById("nav");
      let html = "";

      const sections = [
        { key: "pipeline", title: "Pipelines", items: DATA.ir.pipelines },
        { key: "agent", title: "Agents", items: DATA.ir.agents },
        { key: "subagent", title: "Subagents", items: DATA.ir.subagents },
        { key: "skill", title: "Skills", items: DATA.ir.skills },
        { key: "instruction", title: "Instructions", items: DATA.ir.instructions },
        { key: "rubric", title: "Rubrics", items: DATA.ir.rubrics },
        { key: "tool", title: "Tools", items: DATA.ir.tools },
      ];

      for (const sec of sections) {
        const matches = sec.items.filter(it => !q || it.name.toLowerCase().includes(q) || (it.description && it.description.toLowerCase().includes(q)));
        if (matches.length > 0) {
          html += \`<div class="nav-section-title">\${sec.title}</div>\`;
          for (const m of matches) {
            const active = currentKey === \`\${sec.key}:\${m.name}\` ? "active" : "";
            html += \`<div class="nav-item \${active}" onclick="selectItem('\${sec.key}', '\${m.name}')">
              <span>\${m.name}</span>
              <span class="nav-badge">\${sec.key}</span>
            </div>\`;
          }
        }
      }

      if (DATA.runLog && (!q || "run-log".includes(q))) {
        html += \`<div class="nav-section-title">Execution</div>\`;
        const active = currentKey === "run-log" ? "active" : "";
        html += \`<div class="nav-item \${active}" onclick="selectRunLog()">
          <span>RUN-LOG</span>
          <span class="nav-badge">log</span>
        </div>\`;
      }

      nav.innerHTML = html;
    }

    function filterNav(val) {
      renderNav(val);
    }

    function selectItem(kind, name) {
      currentKey = \`\${kind}:\${name}\`;
      renderNav(document.getElementById("search-box").value);
      const content = document.getElementById("content");

      if (kind === "agent" || kind === "subagent") {
        const item = (kind === "agent" ? DATA.ir.agents : DATA.ir.subagents).find(x => x.name === name);
        if (!item) return;
        content.innerHTML = \`
          <div class="card">
            <h2 class="title">\${item.name}</h2>
            <p class="desc">\${item.description}</p>
            <div class="tags">
              <span class="tag">Kind: \${kind}</span>
              \${item.tools && item.tools.length ? \`<span class="tag">Tools: \${item.tools.join(', ')}</span>\` : ''}
              \${item.skills && item.skills.length ? \`<span class="tag">Skills: \${item.skills.join(', ')}</span>\` : ''}
            </div>
          </div>
          <div class="card">
            <h3>Role & Persona</h3>
            <pre>\${item.role}</pre>
          </div>
        \`;
      } else if (kind === "skill") {
        const item = DATA.ir.skills.find(x => x.name === name);
        if (!item) return;
        content.innerHTML = \`
          <div class="card">
            <h2 class="title">\${item.name}</h2>
            <p class="desc">\${item.description}</p>
            <div class="tags"><span class="tag">Type: Skill</span></div>
          </div>
          <div class="card">
            <h3>Skill Knowledge</h3>
            <pre>\${item.body}</pre>
          </div>
        \`;
      } else if (kind === "tool") {
        const item = DATA.ir.tools.find(x => x.name === name);
        if (!item) return;
        content.innerHTML = \`
          <div class="card">
            <h2 class="title">\${item.name}</h2>
            <p class="desc">\${item.description}</p>
            <div class="tags">
              <span class="tag">Category: \${item.category}</span>
              <span class="tag">Command: \${item.command}</span>
            </div>
          </div>
          <div class="card">
            <h3>Command Definition</h3>
            <pre>\${item.command} \${(item.args || []).join(' ')}</pre>
            \${item.body ? \`<pre>\${item.body}</pre>\` : ''}
          </div>
        \`;
      } else if (kind === "pipeline") {
        const item = DATA.ir.pipelines.find(x => x.name === name);
        if (!item) return;
        let branchesHtml = "";
        for (const [bName, bDef] of Object.entries(item.branches)) {
          branchesHtml += \`<h4>Branch: \${bName}</h4>\`;
          branchesHtml += \`<table>
            <thead><tr><th>Phase</th><th>Agents</th></tr></thead>
            <tbody>
              \${bDef.phases.map(p => \`<tr><td><strong>\${p.id}</strong></td><td>\${p.agents.map(a => a.name).join(', ')}</td></tr>\`).join('')}
            </tbody>
          </table>\`;
        }
        content.innerHTML = \`
          <div class="card">
            <h2 class="title">\${item.name}</h2>
            <p class="desc">\${item.description}</p>
          </div>
          <div class="card">
            <h3>Pipeline Architecture</h3>
            \${branchesHtml}
          </div>
        \`;
      } else if (kind === "rubric") {
        const item = DATA.ir.rubrics.find(x => x.name === name);
        if (!item) return;
        content.innerHTML = \`
          <div class="card">
            <h2 class="title">\${item.name}</h2>
            <p class="desc">Scorecard Rubric</p>
          </div>
          <div class="card">
            <h3>Rubric Definition</h3>
            <pre>\${item.raw}</pre>
          </div>
        \`;
      } else if (kind === "instruction") {
        const item = DATA.ir.instructions.find(x => x.name === name);
        if (!item) return;
        content.innerHTML = \`
          <div class="card">
            <h2 class="title">\${item.name}</h2>
            <p class="desc">Scoped Instruction</p>
            <div class="tags"><span class="tag">ApplyTo: \${item.applyTo}</span></div>
          </div>
          <div class="card">
            <h3>Rules</h3>
            <pre>\${item.rules}</pre>
          </div>
        \`;
      }
    }

    function selectRunLog() {
      currentKey = "run-log";
      renderNav();
      const content = document.getElementById("content");
      content.innerHTML = \`
        <div class="card">
          <h2 class="title">Execution RUN-LOG</h2>
          <p class="desc">Deterministic orchestration record</p>
        </div>
        <div class="card">
          <pre>\${DATA.runLog || "No RUN-LOG recorded yet."}</pre>
        </div>
      \`;
    }

    window.onload = init;
  </script>
</body>
</html>`;
}

/** `murmr docs [--out <dir>] [--serve] [--port <p>]` — documentation portal compiler. */
export async function docsCommand(
  projectRoot: string,
  opts: DocsOptions = {},
): Promise<number> {
  const murmurDir = join(projectRoot, "murmur");
  if (!existsSync(join(murmurDir, "agents"))) {
    console.error('No murmur/ directory found. Run "murmr init" first.');
    return 1;
  }

  const loaded = await loadIR(murmurDir);
  if (!loaded.ok) {
    console.error("Failed to load IR definitions.");
    return 1;
  }

  const config = await loadConfig(projectRoot);
  const projectName = config.project.name || "Murmur";

  let runLogContent: string | undefined;
  const runLogPath1 = join(projectRoot, "_architect", "RUN-LOG.md");
  const runLogPath2 = join(projectRoot, "RUN-LOG.md");
  if (existsSync(runLogPath1)) {
    runLogContent = await Bun.file(runLogPath1).text();
  } else if (existsSync(runLogPath2)) {
    runLogContent = await Bun.file(runLogPath2).text();
  }

  const html = generateDocsHtml(projectName, loaded.value, runLogContent);
  const outDir = join(projectRoot, opts.out ?? "_docs");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "index.html");
  await Bun.write(outPath, html);

  console.log(`docs: generated interactive portal at ${opts.out ?? "_docs"}/index.html`);

  if (opts.serve) {
    const port = opts.port ?? 3000;
    return new Promise<number>((resolve) => {
      const server = Bun.serve({
        port,
        fetch(_req) {
          return new Response(html, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        },
      });

      console.log(
        `docs: serving portal at http://localhost:${server.port} (Ctrl+C to stop)`,
      );

      if (opts.signal) {
        opts.signal.addEventListener("abort", () => {
          server.stop();
          resolve(0);
        });
      }

      const sigHandler = () => {
        console.log("\ndocs: stopping dev server...");
        server.stop();
        resolve(0);
      };

      if (!opts.signal && typeof process !== "undefined" && typeof process.on === "function") {
        process.once("SIGINT", sigHandler);
        process.once("SIGTERM", sigHandler);
      }
    });
  }

  return 0;
}
