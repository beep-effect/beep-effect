---
title: Bound quote relocation to one page of extraction drift
date: 2026-11-26
reversal: Search the entire paper for replacement evidence without a distance bound.
governs:
  - src/canary/Gold.ts#GOLD_ANCHOR_DRIFT_WINDOW
enforcedBy: []
---

Use a 2,000-character window for nearby exact and whitespace-folded quote anchors.
Reason: roughly a page of PDF extraction drift is tolerated without letting short evidence strings re-anchor across a paper.
Rejected: unbounded relocation, which can associate the proposed quote with unrelated distant evidence.
