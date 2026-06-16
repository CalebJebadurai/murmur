---
name: technical-scorecard
description: Generic technical review scorecard for evaluating an implementation plan.
---

# Technical Scorecard

A generic, project-fact-free technical review rubric. Critics emit one
`SCORE: <dimension> = <n>` line per dimension; `murmur score` computes the
weighted total deterministically.

```yaml
dimensions:
  - label: Security
    classification: MANDATORY
    scaleMax: 5
    weight: 1
  - label: Performance
    classification: MANDATORY
    scaleMax: 5
    weight: 1
  - label: Approach Validity
    classification: MANDATORY
    scaleMax: 5
    weight: 1
  - label: Completeness
    classification: MANDATORY
    scaleMax: 5
    weight: 1
  - label: Feasibility
    classification: MANDATORY
    scaleMax: 5
    weight: 1
  - label: Risk Assessment
    classification: MANDATORY
    scaleMax: 5
    weight: 1
  - label: Test Coverage
    classification: MANDATORY
    scaleMax: 5
    weight: 1
  - label: Logical Soundness
    classification: MANDATORY
    scaleMax: 5
    weight: 1
  - label: Codebase Alignment
    classification: CONDITIONAL
    naWhen: the task is greenfield or non-code
    scaleMax: 5
    weight: 1
severityLevels: [critical, important, minor]
readinessGate: all mandatory dimensions >= 4
totalMax: 45
```
