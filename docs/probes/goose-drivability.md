# Goose-Drivability Spike (v0.2.0)

Gate for v0.2d. Decides whether `murmur run` can drive a host agent CLI per
agent-turn (murmur orchestrates, enforces caps) or only invoke a whole recipe
once (host orchestrates, murmur enforces nothing).

## Methodology (reproducible)

Within a single session, with an installed + authenticated `goose` (or `claude`) CLI:

1. Compile the dual-branch `architect` pipeline: `murmur compile --target goose`.
2. Feed the emitted `recipes/architect.yaml` to `goose run` and observe whether a
   single invocation yields capturable, parseable output (exit code, stdout, files).
3. Attempt the per-turn model: `Bun.spawn` the host CLI once per phase agent and
   capture each turn's output as structured text.
4. Record whether per-turn driving yields parseable results suitable for the
   score-emission contract. Repeat three times to rule out flakiness.

Use an argv array for every spawn (no shell string) — the spike validates the
safe spawn shape that v0.2d depends on.

## Result

| Host CLI | Per-turn drivable | Parseable output | Decision | Date |
|---|---|---|---|---|
| goose | not yet probed | not yet probed | pending | 2026-06-16 |
| claude | not yet probed | not yet probed | pending | 2026-06-16 |

**Status: PENDING.** No host agent CLI was available in the implementation
environment, so the spike has not been executed.

## Consequence (gating rule)

- Until a **positive** per-turn drivability result is recorded above, `murmur run`
  ships in **deterministic-skeleton + compile-and-instruct** form only: it walks the
  pipeline offline, counts loops, enforces parallelism bookkeeping, and emits a
  RUN-LOG, but the `--allow-run` host-CLI delegation (v0.2d) is treated as
  **experimental/unproven** and defaults to the compile-and-instruct degradation.
- goose pipeline output remains **advisory-only** for loops and parallel caps
  regardless of the spike outcome (goose recipes cannot express them natively).
- A positive result green-lights promoting the v0.2d spawn path from experimental
  to supported for that CLI.
