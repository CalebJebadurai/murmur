import { join } from "node:path";
import { existsSync } from "node:fs";
import { loadIR } from "../schema/load.ts";

/** `murmr list` — inventory the IR definitions in murmur/. */
export async function listCommand(projectRoot: string): Promise<number> {
  const murmurDir = join(projectRoot, "murmur");
  if (!existsSync(join(murmurDir, "agents"))) {
    console.log('No murmur/ directory in this project. Run "murmr init" first.');
    return 0;
  }
  const loaded = await loadIR(murmurDir);
  if (!loaded.ok) {
    console.error("IR has validation errors; run `murmr doctor`.");
    return 1;
  }
  const ir = loaded.value;
  const section = (title: string, items: { name: string; description?: string }[]) => {
    console.log(`\n${title} (${items.length}):`);
    for (const it of items) {
      console.log(`  - ${it.name}${it.description ? ` — ${it.description}` : ""}`);
    }
  };
  section("Agents", ir.agents.map((a) => ({ name: a.name, description: a.description })));
  section("Subagents", ir.subagents.map((s) => ({ name: s.name, description: s.description })));
  section("Skills", ir.skills.map((s) => ({ name: s.name, description: s.description })));
  section("Instructions", ir.instructions.map((i) => ({ name: i.name, description: i.applyTo })));
  return 0;
}
