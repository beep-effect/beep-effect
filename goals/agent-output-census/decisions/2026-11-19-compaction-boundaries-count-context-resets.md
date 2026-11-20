---
title: "Compaction boundaries count context resets inside the window"
date: 2026-11-19
lane: "goals/agent-output-census-library"
reversal: "Count compact_boundary system records only and accept that a context resumed from a summary is not counted."
---

The audit's figure of 104 boundaries came from a count that did not survive; neither the scripts nor the summary hold it. The census counts what its carried-cost flush honours: every compact_boundary system record, and a compacted summary that does not immediately follow another marker (a boundary record or another summary), inside the window. Consecutive summaries with nothing between them are one reset. That is 113 on the reproduction run (72 compact_boundary records plus 41 summaries that open a resumed context). The flush rule itself is the reference's: carried char-turns over all Claude tool output match within 0.01% (16.730B against 16.729B).
