import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { validateSubagent } from "../src/schema/validate.ts";

const FIXTURES = join(import.meta.dir, "fixtures", "spawn");

/**
 * Phase D — spawn scenarios. In-runtime execution is out of scope for v0.1.0;
 * the assertion is that the master agent, following the subagent-authoring skill,
 * produces a valid, readable subagent definition that could be dispatched.
 */
describe("master-agent spawn scenarios", () => {
  for (const scenario of ["data-validator", "config-migrator"]) {
    test(`spawns a well-formed "${scenario}" subagent`, async () => {
      const file = join(FIXTURES, `${scenario}.md`);
      const content = await Bun.file(file).text();
      const res = validateSubagent(content, file);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      // A spawned specialist must carry a trigger, a restricted tool policy,
      // be dispatch-only, and reference its attached knowledge.
      expect(res.value.spawn.trigger.length).toBeGreaterThan(0);
      expect(res.value.spawn.toolPolicy.length).toBeGreaterThan(0);
      expect(res.value.userInvocable).toBe(false);
      expect(res.value.role.length).toBeGreaterThan(0);
    });
  }
});
