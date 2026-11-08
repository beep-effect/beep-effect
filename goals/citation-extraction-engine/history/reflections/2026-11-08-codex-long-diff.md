---
goal: citation-extraction-engine
agent: codex
date: 2026-11-08
trigger: on-demand
confidence: high
findings:
  - category: implementation-improvement
    confidence: high
    instruction: Separate owned cleaned values from host-verified source manifestations in public workflow tests.
    explanation: Public clean returns native text and an owned value. The long-diff test host registers the actual output as a separate genuine source before annotation; it does not infer that clean minted a verified derived source.
  - category: implementation-improvement
    confidence: high
    instruction: Preserve both the complete independently captured output and the original membership predicate for a long-text replay.
    explanation: The exact output check catches misplaced changes outside the selected citation, while the original predicate preserves the source assertion across its newline boundary.
todos:
  - Continue remaining source/model/corpus cohorts without treating completion of one test file as capability parity.
  - Complete general retained protocols, all representation/fidelity laws, full safety/scaling and lifecycle evidence.
---

# Full original opinion through the public engine

Original raw text is cleaned by the actual captured plan. Only the actual result
is admitted by the fixture host as annotation input. Original caller coordinates
and wrapper strings are legitimate request data; independently captured output
is used solely for comparison. Existing Effect service composition, native
Unicode conversion, diff transport and operation admission do the work.
