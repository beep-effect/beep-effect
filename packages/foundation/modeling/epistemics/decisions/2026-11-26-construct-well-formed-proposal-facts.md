---
title: The proposal fact arbitrary constructs well-formed JSON instead of filtering the checked fact schema
date: 2026-11-26
reversal: Generate facts with Arbitrary.schema(ContradictionProposalFact) and drop wellFormedProposalFactText and wellFormedProposalFactObject.
governs:
  - src/Contradiction/Contradiction.model.ts#wellFormedProposalFactText
  - src/Contradiction/Contradiction.model.ts#makeContradictionVocabulary
enforcedBy: []
---

An unpaired surrogate is the one thing generated JSON holds that the fact check refuses, so the fact arbitrary replaces each one with U+FFFD, as String.prototype.toWellFormed does, instead of discarding the sample. The S.is(ContradictionProposalFact) filter stays as the last word on the size bounds.
Reason: deriving the fact from its checked schema discarded about a quarter of the samples, which exhausted properties that nest several facts; the candidate-content sampler ran out on seed 433213354620349.
Rejected: Arbitrary.schema of the checked ContradictionProposalFact schema.
