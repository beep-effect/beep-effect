---
title: The thread transcript view is rederived per streaming block, so its expensive and validating work lives elsewhere
date: 2026-11-26
reversal: Compute sibling turn ids inside the transcript view atom and model ThreadTranscriptView as an S.Class built with make.
governs:
  - src/chat/ui/Thread.atoms.ts#threadSiblingTurnIdsAtoms
  - src/chat/ui/Thread.atoms.ts#ThreadTranscriptView
enforcedBy: []
---

The transcript view atom recomputes on every streaming block. The sibling-turn scan is quadratic in the timeline and depends on nothing but the timeline, so it owns its own atom family; streaming writes do not drag the walk along behind them.
ThreadTranscriptView is a plain interface: every field is already schema-validated upstream, and an `S.Class` `make` on each block would revalidate a hot path for no new invariant.
Rejected: one atom deriving siblings with the rest of the view (the quadratic walk reruns per block); an `S.Class` view (per-block revalidation).
