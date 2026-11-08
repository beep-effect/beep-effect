---
goal: citation-extraction-engine
agent: codex
date: 2026-11-08
trigger: on-demand
confidence: high
findings:
  - category: implementation-improvement
    confidence: high
    instruction: Attribute shared typed safety failures at the existing captured timing boundary instead of remapping them independently in each helper.
    explanation: Court, repr and dump share the same operation contract; regressions proved that correcting court alone left rendering allocation errors attributed to extraction.
  - category: implementation-improvement
    confidence: high
    instruction: Preserve unrelated error identity and successful results when normalizing a closed safety error.
    explanation: The timing adapter now schema-recognizes only CitationSafetyLimitExceeded; generic controls retain an unrelated Error object by identity.
  - category: implementation-improvement
    confidence: high
    instruction: Choose control inputs that reach the intended allocation boundary without first violating a smaller representation ceiling.
    explanation: The rendering control now permits individual Unicode fragments while forcing cumulative shared-budget refusal.
todos:
  - Continue unqualified source/parser/resolver/backend and retained-object behavior.
  - Complete exhaustive accounting, fidelity, native identity/deployment, safety/scaling and lifecycle acceptance.
---

# Reuse the shared Effect timing adapter

The correction composes existing Effect error mapping, timeout and Clock services.
It removes a duplicate court-specific catch while retaining selected durations and
limits. Twenty focused tests preserve source corpora, actual debug workflows and
controlled failure contracts. This closes a specific safety composition defect;
it does not establish exhaustive target parity or universal timing-law acceptance.
