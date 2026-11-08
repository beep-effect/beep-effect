---
goal: citation-extraction-engine
agent: codex
date: 2026-11-08
trigger: on-demand
confidence: high
findings:
  - category: implementation-improvement
    confidence: high
    instruction: Derive replacement positions from actual verified extraction and compare them separately with captured caller arguments.
    explanation: Original annotation expectations alone did not prove upstream cleaning and parsing; the full workflow now recomputes these stages before checking the final independent output.
  - category: implementation-improvement
    confidence: high
    instruction: Preserve safety failures when adapting a captured callback through existing Effect services.
    explanation: Mapping every native Unicode failure to invalid callback output would erase enclosing budget refusal; the replay now reuses the production annotation failure translator.
todos:
  - Execute the full original annotation cohorts under hosted integration.
  - Qualify general retained callbacks and Unicode lowering separately from the finite original ASCII example.
---

# Original caller data and independent output proof

Captured before/after text is legitimate source input. Captured annotation
positions must not substitute for the extraction stage that originally produced
them. The new replay derives positions from actual verified mentions, compares
those arguments with the original capture, and then checks the independent final
rendered text. It reuses the configured engine, native worker transport and
captured Effect annotation service. A finite callback example remains explicitly
scoped and does not settle general callback or Unicode fidelity obligations.
