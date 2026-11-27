---
title: Report only observed growth when telemetry baselines were evicted
date: 2026-11-26
reversal: Treat a missing pre-window baseline as zero or omit a zero-growth truncated series.
governs:
  - src/runtime/PrivacyReceipt.ts#summarizePracticeKgSpool
  - src/runtime/PrivacyReceipt.ts#gateRows
enforcedBy: []
---

For a process predating the window with no surviving pre-window point, use its earliest surviving sample as the baseline and mark its growth as a lower bound.
Include every counted non-spool tag and every truncated tag even if observed growth is zero; print the lower-bound marker rather than None for unknown history.
Rejected: zero baselines or omitted zero-growth rows, which turn evicted history into an exact count or false absence.
