---
description: "Use when: planning, analyzing, or designing implementation strategies through a governed multi-phase pipeline with selective dispatch, scoring, and refinement loops."
version: "1.0.0"
classifications: [CODING, RESEARCH, HYBRID]
---

# Architect Pipeline

This pipeline round-trips the architect orchestration: a classification gate at
phase 0b routes to a CODING branch or a RESEARCH branch, each with its own phases,
loops, parallelism caps, and tiers. All structured data below is the strict YAML
subset parsed by the pipeline-body reader.

```yaml
routing:
  at: "0b"
  map:
    CODING: coding
    RESEARCH: research
    HYBRID: coding
branches:
  coding:
    phases:
      - id: "0"
        label: Prompt Refinement
        agents:
          - name: prompt-engineer
            dispatch:
              invokeWhen:
                - prompt is ambiguous, multi-faceted, or underspecified
              skipWhen:
                - prompt is already precise and well-scoped
      - id: "0b"
        label: Task Classification
        agents:
          - name: architect
      - id: "1"
        label: Research
        agents:
          - name: Explore
            builtin: true
            dispatch:
              invokeWhen:
                - task involves existing codebase changes
              skipWhen:
                - greenfield project or pure research
          - name: analyst
            dispatch:
              invokeWhen:
                - task requires deep codebase architecture understanding
              skipWhen:
                - simple feature or non-code task
      - id: "2"
        label: Draft
        agents:
          - name: architect
      - id: "3"
        label: Critic-Planner Loop
        agents:
          - name: critic
          - name: business-critic
            dispatch:
              invokeWhen:
                - task has revenue, cost, or market implications
              skipWhen:
                - pure internal refactor
          - name: planner
      - id: "4"
        label: Final Output
        agents:
          - name: architect
      - id: "5"
        label: Implementation Report
        agents:
          - name: implementer
      - id: "5b"
        label: Verification
        agents:
          - name: verifier
      - id: "5c"
        label: Gap Resolution
        agents:
          - name: implementer
    loops:
      - name: critic-planner
        from: "3"
        to: "3"
        min: 1
        max: 3
        earlyExit: all dimensions >= 4, combined score non-decreasing
    parallel:
      maxConcurrent: 3
      neverParallel:
        - [critic, planner]
      perPatternCaps:
        explore: 3
    tiers:
      - name: lightweight
        phases: ["0", "1", "2", "5"]
      - name: standard
        phases: ["0", "0b", "1", "2", "3", "4", "5", "5b"]
      - name: extended
        phases: ["0", "0b", "1", "2", "3", "4", "5", "5b", "5c"]
        iterationOverrides:
          critic-planner:
            min: 2
            max: 3
  research:
    phases:
      - id: "0"
        label: Prompt Refinement
        agents:
          - name: prompt-engineer
      - id: "R1"
        label: Research and Evidence
        agents:
          - name: researcher
      - id: "R2"
        label: Structure Drafting
        agents:
          - name: planner
      - id: "R3"
        label: Research-Critic Loop
        agents:
          - name: research-critic
          - name: planner
      - id: "R4"
        label: Final Structure
        agents:
          - name: planner
      - id: "R5"
        label: Research Writing
        agents:
          - name: researcher
      - id: "R5b"
        label: Final Validation
        agents:
          - name: research-critic
          - name: fact-checker
    loops:
      - name: research-critic-planner
        from: "R3"
        to: "R3"
        min: 1
        max: 2
        earlyExit: all structure dimensions >= 4, no critical weaknesses
    parallel:
      maxConcurrent: 2
      neverParallel:
        - [research-critic, planner]
    tiers:
      - name: standard
        phases: ["0", "R1", "R2", "R3", "R4", "R5", "R5b"]
```
