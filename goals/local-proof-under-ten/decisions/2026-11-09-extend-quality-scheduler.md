---
title: "Admission work extends the existing QualityScheduler; no second scheduler, queue or checker agent"
date: 2026-11-09
reversal: "Supersede with a new decision that names a different admission authority; no code to revert while the levers are unlanded."
---

Every admission change in this goal extends the existing `QualityScheduler` (`packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts`): the admission unit becomes a lane or a package, weights come from measured peaks, and final-check, package-verify and agent-shell heavy commands are admitted in small units. No second scheduler, queue, lock or "checker agent" is built, and one owner (this goal's scheduler slices) holds the one admission shape: the old YEET-03 is folded into SCHE-01 and SCHE-02 and credits no minutes. Rejected: a checker agent or single scheduling service (a second authority), and leaving admission alone (the deepest memory dip on 2026-11-09 happened with one admitted lease, so unadmitted work is the exposure).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D3).
