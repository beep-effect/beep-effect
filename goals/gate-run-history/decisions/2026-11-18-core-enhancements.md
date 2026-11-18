---
title: "The fix-loop delta is computed here; core renders it"
date: 2026-11-18
lane: "explore/agent-verification-output"
reversal: "Remove the delta from the history service and the console slot"
---

Of the four enhancements the operator chose, this goal owns the fix-loop delta: a re-run on a lane reports fixed, still failing and new counts against the lane's previous run of the same gate and subject, over the units both runs checked. goals/gate-report-core renders the line from the history slot; a cache replay renders the same delta as the run it replays. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `core-enhancements`.
