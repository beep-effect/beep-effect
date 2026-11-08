---
goal: citation-extraction-engine
agent: codex
date: 2026-11-08
trigger: on-demand
confidence: high
findings:
  - category: implementation-improvement
    confidence: high
    instruction: Exercise an existing owned protocol before adding another source-object abstraction.
    explanation: CitationResourceObjects already supplies live semantic reads, exact hashes, equality and lifecycle ownership; the original Resource assertions now use it directly.
  - category: implementation-improvement
    confidence: high
    instruction: Strengthen existing proof without counting the same canonical event twice.
    explanation: The fourth persistent Resource assertion moves from a direct integer projection to an actual owned handle; the previous binding is removed and the complete total grows only by the two new comparison assertions.
todos:
  - Finish arbitrary retained host/model/token protocols and production missing-page identity allocation.
  - Complete exhaustive source/donor reconciliation, representation laws, safety/scaling and lifecycle acceptance.
---

# Existing ownership and stronger source evidence

The original Resource comparison is a finite known-page hash-based equality. Its
nested source citations are reconstructed from independent source arguments and
frozen edition choices, then compared before any expected hash is read. Existing
Effect service provision and acquireUseRelease compose the real registry with its
semantic and artifact owners. Detached semantic IDs avoid creating false source
occurrences for test-factory objects with fabricated token positions.

No new resource registry, generic object framework or lifecycle primitive is
introduced. Passing this scene does not settle arbitrary host objects, missing-page
identities, reflected comparison, source token mutation or the full goal.
