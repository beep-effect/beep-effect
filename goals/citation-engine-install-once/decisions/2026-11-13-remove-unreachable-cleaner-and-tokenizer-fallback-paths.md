---
title: "Remove unreachable cleaner and tokenizer fallback paths"
date: 2026-11-13
lane: "feat/citation-invocation-binding"
pullRequest: 3265
reversal: "Restore the parent Option wrappers and tokenizer duplicate selection and missing-id refusals."
---

The invocation always supplies a parent budget, so CleanerPipeline no longer wraps it in Some or retains parentless fallbacks. Its charge loop now iterates typed charge values directly; the issued-ledger check still refuses forged, reused and absent entries. Tokenizer ordering is built from the same privately owned installed rows as the ID map, and its set-work counter already bounds every selection. The second selected-count check and typed missing-ID configuration mapper cannot be reached through caller input. Remove the duplicate guard and treat a missing private ID as an invariant defect. Restore behavioral coverage for live local ceilings, cumulative request capacity, required reference-budget installation refusal, configuration-copy ownership, and closed public-engine admission. No coverage floor changes.
