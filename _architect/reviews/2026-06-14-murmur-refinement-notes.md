# Refinement Notes — Murmuration Multi-Agent Framework

## Iteration 1

### Refinement Summary
The plan was strengthened so its load-bearing mechanisms (analyzer invocation, subagent spawning, publish scrubbing) are concretely specified rather than aspirational, and the validation-target pair and differentiation claims were corrected for honesty.

### Business-Social Tensions Resolved
No business-social tensions existed (social-critic N/A); business feedback on differentiation honesty was folded into the v0.1.0-vs-v1.0 differentiator split.

### Resolved Critical Weaknesses
The analyzer-invocation, master-agent hot-load, and publish-scrubber mechanisms were each re-architected with explicit contracts, probes, and defense-in-depth framing.

### Resolved Important Issues
Validation targets were changed to Copilot + goose and the differentiation story was split into shipped-reality and aspirational-roadmap claims.

### Acknowledged Minor Issues
Executable-config sandboxing, structural-only init criteria, and entropy-based scrubber testing were incorporated where they intersected the critical fixes.

### Remaining Open Questions
Whether goose's recipe paradigm forces IR changes that Copilot did not, and the empirical hot-load result per runtime, remain pending the Phase A.5 probe.
