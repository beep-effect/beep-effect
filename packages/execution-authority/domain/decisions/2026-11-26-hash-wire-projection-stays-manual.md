---
title: Record hash inputs are hand-written wire projections
date: 2026-11-26
reversal: Derive each hash input by encoding the record schema with the hash field omitted (S.omit plus encode).
governs:
  - src/entities/ExecutionRecord/ExecutionRecord.model.ts#encodeDecisionContent
  - src/entities/ExecutionRecord/ExecutionRecord.model.ts#encodeOutcomeContent
enforcedBy: []
---

The canonical wire form hashed for a decision or outcome record is a hand-written projection of its content, field by field. The decision record schema is a tagged union over the verdict, and the hash input must stay byte-stable whatever happens to the schema's encoding plumbing, because every stored chain is verified against it.

Rejected: deriving the projection from the record schema via `S.omit` and the schema encoder, which ties the sealed bytes to schema encoding details and to how omit treats a tagged union.
