---
goal: citation-extraction-engine
agent: codex
date: 2026-11-08
trigger: on-demand
confidence: high
findings:
  - category: implementation-improvement
    confidence: high
    instruction: Preserve source lookup order and literal argument decisions independently when replaying aliases.
    explanation: U.S. and U. S. select equal frozen editions but only the literal U.S. factory argument receives scotus metadata; normalizing both decisions together would conceal a mismatch.
  - category: implementation-improvement
    confidence: high
    instruction: Keep immutable input capture separate from semantic expectations and general retained protocols.
    explanation: Capturing ordered edition references supplies construction inputs without borrowing expected model fields or hash outputs, while leaving source-text, mock-token and object-identity behavior unqualified.
todos:
  - Implement and qualify retained factory, token, resource and identity protocols against the full source contract.
  - Finish source/donor reconciliation and whole-engine fidelity, safety and lifecycle acceptance.
---

# Ordered aliases and literal metadata

The four known-page reporter assertions now use authenticated ordered lookup inputs,
source-derived explicit arguments, schema-owned semantic values and existing
production hash functions. The source lookup contains duplicate equal occurrences;
these remain in the capture even though the factory selects its first occurrence.
No new generic lookup, hash, worker or concurrency framework is introduced.

The first focused run caught an invalid unknown-court encoding in the new fixture.
The domain schema represents absence as null on the wire, so the fixture now uses
that existing representation. Both focused tests and package lint/types pass after
that correction. The previous default proof is refreshed from the same successful
rerun. This is finite proof, not completion of general factory or identity behavior.
