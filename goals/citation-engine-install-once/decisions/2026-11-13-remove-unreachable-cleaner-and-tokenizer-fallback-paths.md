---
title: "Remove unreachable cleaner parent-budget fallback paths"
date: 2026-11-13
lane: "feat/citation-invocation-binding"
pullRequest: 3265
reversal: "Restore the cleaner parent Option wrappers and parentless fallbacks."
---

The invocation always supplies a parent budget, so CleanerPipeline no longer wraps it in Some or retains parentless fallbacks. Its charge loop now iterates typed charge values directly; the issued-ledger check still refuses forged, reused and absent entries. Behavioral tests cover live local ceilings, cumulative request capacity, unchanged empty text and unknown steps. No coverage floor changes.
