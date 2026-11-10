---
title: "A7 Reserve: Unknown admits background callers"
date: 2026-11-10
reversal: "Make `Unknown` refuse background calls (goal 2 may)."
---

An `Unknown` reserve admits background callers. The threshold is `ceil(0.15 x limit)`. A reading counts for 10 minutes; after its reset the state is `Unknown{window-reset}`. The github-headroom parcel shows the reserve state the signal computed, never its own.

Resolves SPEC ambiguity A7 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
