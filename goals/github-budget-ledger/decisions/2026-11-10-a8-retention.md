---
title: "A8 Retention: 72 h raw rows, 256 MiB cap, 35-day rollups"
date: 2026-11-10
reversal: "Change the constants."
---

Raw rows are kept 72 h with a 256 MiB cap, and rollups 35 days. An hour is rolled up complete at H+1h+15min once a later anchor exists, or incomplete at H+3h otherwise. Incomplete rollups are rewritten while their raw rows still exist.

Resolves SPEC ambiguity A8 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
