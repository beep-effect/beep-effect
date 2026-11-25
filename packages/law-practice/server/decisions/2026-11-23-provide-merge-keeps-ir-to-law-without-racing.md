---
title: Provide-merge keeps IrToLaw in the review-loop output without a sibling race
date: 2026-11-23
reversal: Satisfy IrToLaw with Layer.mergeAll beside the review loop instead of Layer.provideMerge.
governs:
  - src/Layer.ts#reviewLoopWithIrToLawProvidedAndKeptInOutput
  - src/Layer.ts#LawPracticeServerLive
enforcedBy: []
---

The review loop takes IrToLaw through Layer.provideMerge, so the dependency is satisfied and IrToLaw stays in the output. File processing supplies extracted source text, LangExtract supplies grounded source spans, and the in-memory law claim store supplies proposals and admissions to the review loop and the provenance traversal.

Reason: a sibling Layer.mergeAll would race the provider against the consumer.

Rejected: Layer.mergeAll of IrToLaw beside the review loop.
