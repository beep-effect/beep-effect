---
title: Delimiter detection keeps papaparse's rule, its trailing empty record included
date: 2026-11-22
reversal: Score candidates by another heuristic, or drop the empty record papaparse counts after a final line break.
governs:
  - src/internal/sniff.ts#sniffDelimiter
  - src/internal/sniff.ts#widthsWith
  - src/internal/sniff.ts#PREVIEW_LIMITS_WIDEST_SO_ONLY_THE_SAMPLE_BOUNDS
  - src/internal/sniff.ts#splitsIntoTwoOrMoreOnAverage
  - src/internal/sniff.ts#moreConsistentThenWiderThenEarlier
enforcedBy: []
---

For each candidate in order, the sample's first ten records are read and scored by width consistency (the sum of width changes between consecutive records) and average width. The most consistent candidate averaging above 1.99 wins, ties go to the wider, then the earlier.

A sample ending with a line break counts one more, empty record after it, as papaparse's preview does, so a two-record file read alone falls back to a comma. Files the app read through papaparse keep the delimiter they had.

The preview reads under the widest caps, not the read's: a cap the first records pass would otherwise stop the right candidate's preview and hand the read to a delimiter that might pass no cap. The read that follows enforces the read's caps; `SNIFF_WINDOW` bounds the sample.

Rejected: a "correct" sniff without the trailing empty record, and previewing under the read's caps.
