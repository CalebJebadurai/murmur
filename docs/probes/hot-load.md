# Runtime Hot-Load Capability Probe

The master agent's dynamic subagent spawning has two dispatch paths. Which one is
safe depends on whether a runtime **hot-loads** an agent definition written mid-session
and lets it be dispatched in the same session. This must be measured, not assumed.

## Methodology (reproducible)

Within a single host-runtime session:

1. Have the agent write a uniquely-named subagent definition to the runtime's
   discovery location (e.g. `.github/agents/probe-<uuid>.agent.md` for Copilot).
2. Immediately attempt to dispatch it by name via the runtime's subagent mechanism
   (`agent/runSubagent` for Copilot).
3. Record whether the dispatch resolves the just-written agent or fails to find it.
4. Repeat three times to rule out timing flakiness.

Distinguish "not hot-loaded" from "needs a manual refresh" and record which.

## Results

| Runtime      | Hot-load | Refresh required | Spawn path selected     | Date       | Notes |
|--------------|----------|------------------|-------------------------|------------|-------|
| copilot      | unknown  | unknown          | ephemeral-persona (safe default) | 2026-06-15 | Probe not yet executed in a live session; treat as no-hot-load until measured. |
| goose        | unknown  | unknown          | ephemeral-persona (safe default) | 2026-06-15 | Pending access to a goose runtime. |

## Gating rule

- A positive (hot-load) result selects the **file-writing** spawn path.
- Any other result (negative, refresh-required, or untested) selects the
  **in-context ephemeral-persona** path.
- No spawning feature ships assuming hot-load on an unproven runtime.
