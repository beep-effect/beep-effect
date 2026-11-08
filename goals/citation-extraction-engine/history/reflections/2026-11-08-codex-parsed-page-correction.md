---
goal: citation-extraction-engine
agent: codex
date: 2026-11-08
trigger: on-demand
confidence: high
findings:
  - category: implementation-improvement
    confidence: high
    instruction: Build downstream correction requests from actual parsed components and verified matched text.
    explanation: Injecting original normalized model fields into the correction service would bypass parsing. The replay instead uses the public extraction result and its selected edition and primary verified anchor, while source models remain independent expectations.
  - category: implementation-improvement
    confidence: high
    instruction: Preserve absent keys and explicit None when adapting schema-owned model components to native method inputs.
    explanation: Domain components encode explicit None as Option.none and retain absent keys separately. The new adapter preserves both states, including the no-page law example, rather than flattening them before correction.
todos:
  - Qualify original full-citation presentation and remaining model comparison/hash/mutation cohorts.
  - Complete general representation/fidelity laws, all source/donor accounting and whole-engine safety/lifecycle evidence.
---

# Parsing before native correction

The existing correction service remains the algorithm authority. The test adapter
converts actual Option-valued groups to native Unicode and uses actual verified
source text. An authenticated frozen-edition owner resolves the actual selected
edition reference. These finite method-result comparisons do not establish
universal object protocols or formatting laws and do not add a public formatter.
