---
description: "Use when: planning, analyzing, or designing implementation strategies through a governed multi-phase pipeline with selective dispatch, scoring, and refinement loops."
agents:
  - analyst
  - architect
  - business-critic
  - critic
  - fact-checker
  - implementer
  - planner
  - prompt-engineer
  - research-critic
  - researcher
  - verifier
user-invocable: true
---

# architect — Orchestration Pipeline

> Use when: planning, analyzing, or designing implementation strategies through a governed multi-phase pipeline with selective dispatch, scoring, and refinement loops.

> **Note:** The phase, loop, and parallelism tables below are **advisory** —
> a host model interprets them. Deterministic enforcement of loop and
> concurrency caps happens only under `murmr run`.

## Routing

Classification occurs at phase **0b**:

- `CODING` → **coding** branch
- `RESEARCH` → **research** branch
- `HYBRID` → **coding** branch

## Branch: coding

### Phases

| Phase | Label | Agents |
|---|---|---|
| 0 | Prompt Refinement | prompt-engineer |
| 0b | Task Classification | architect |
| 1 | Research | Explore (builtin), analyst |
| 2 | Draft | architect |
| 3 | Critic-Planner Loop | critic, business-critic, planner |
| 4 | Final Output | architect |
| 5 | Implementation Report | implementer |
| 5b | Verification | verifier |
| 5c | Gap Resolution | implementer |

### Refinement loops

| Loop | From | To | Min | Max | Early exit |
|---|---|---|---|---|---|
| critic-planner | 3 | 3 | 1 | 3 | all dimensions >= 4, combined score non-decreasing |

### Parallelism (advisory)

- **Max concurrent:** 3
- **Never parallel:** `critic` ✕ `planner`

### Tiers

| Tier | Phase sequence |
|---|---|
| lightweight | 0 → 1 → 2 → 5 |
| standard | 0 → 0b → 1 → 2 → 3 → 4 → 5 → 5b |
| extended | 0 → 0b → 1 → 2 → 3 → 4 → 5 → 5b → 5c |

## Branch: research

### Phases

| Phase | Label | Agents |
|---|---|---|
| 0 | Prompt Refinement | prompt-engineer |
| R1 | Research and Evidence | researcher |
| R2 | Structure Drafting | planner |
| R3 | Research-Critic Loop | research-critic, planner |
| R4 | Final Structure | planner |
| R5 | Research Writing | researcher |
| R5b | Final Validation | research-critic, fact-checker |

### Refinement loops

| Loop | From | To | Min | Max | Early exit |
|---|---|---|---|---|---|
| research-critic-planner | R3 | R3 | 1 | 2 | all structure dimensions >= 4, no critical weaknesses |

### Parallelism (advisory)

- **Max concurrent:** 2
- **Never parallel:** `research-critic` ✕ `planner`

### Tiers

| Tier | Phase sequence |
|---|---|
| standard | 0 → R1 → R2 → R3 → R4 → R5 → R5b |
