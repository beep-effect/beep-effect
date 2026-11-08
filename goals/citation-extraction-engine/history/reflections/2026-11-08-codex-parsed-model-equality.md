---
goal: citation-extraction-engine
agent: codex
date: 2026-11-08
trigger: on-demand
confidence: high
findings:
  - category: implementation-improvement
    confidence: high
    instruction: Execute the source model's equality predicate rather than substituting structural schema equality.
    explanation: Nominative citations retain extra parsed groups but compare equal through CitationBase hash delegation. The replay uses the existing exact hash primitive and original independently captured integer operands.
  - category: implementation-improvement
    confidence: high
    instruction: Resolve selected edition spellings from the authenticated owner using actual parsed references.
    explanation: Copying the original reporter or edition guess into hash input would bypass public parsing and trusted artifact lookup; actual selected references now drive both stages.
todos:
  - Recompute remaining factory-built, resource-wrapper and identity-backed model comparison/hash cohorts.
  - Qualify general retained protocols, all laws and exhaustive safety/accounting/lifecycle evidence.
---

# Hash-based equality from parsed models

The two tax-court parser invocations remain distinct even though their raw text
matches. Native integer values remain BigInt throughout comparison. The test
observes known-page citation hashes and does not manufacture object identities
or infer resource-wrapper and general method-trace behavior from those results.
