---
title: "Slice 5b: capacity and host pressure on admission rows"
date: 2026-11-14
kind: checkpoint
lane: "feat/certainty-admission-pressure-fields"
reversal: "Delete this checkpoint so the previous checkpoint is the latest PLAN status note, and revert the slice-5b PR."
---

Slice 8 (PERIL-11 slice 2) merged as #3273 and slice 14 (MEAS-05 slice 1) as #3274. Slice 5b (SCHE-09 slice 2) is in review: admitted and v3 released rows carry an optional `pressure` stamp (capacity, active and queued tokens, MemAvailable, PSI some avg10 for cpu, memory and io, and unadmitted agent-runs.slice memory), written only while the admission protocol's new `pressure` key is on (`bun run beep quality scheduler protocol --pressure on`). `quality scheduler history` counts the stamped rows and `--json` lists them (decision `sche-09-pressure-stamps`). The key needs no reader census, because every revision ignores it and keeps the row's bytes, so it can go on once this slice merges. From then on local-proof-under-ten's scheduler levers (SCHE-01, SCHE-02, SCHE-04, SCHE-07) can read capacity at admit and release from the retained history. With 5b merged, both SCHE-09 PR slices have landed.
