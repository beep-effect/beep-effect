---
title: "Status prose is generated from ops/manifest.json; typed status fields carry a lifecycle guard"
date: 2026-11-09
lane: "goals/agent-memory-store-p0"
reversal: "Switch the Current Phase paragraph to a single-owner lock by decision file if manifest generation proves too coarse for a packet"
---

S14b: typed status fields resolve 10/10 with 0/14 wrong and need a lifecycle guard against backward moves (12/14 regress without it). The Current Phase paragraph and counters are projections of typed manifest fields (currentPhase, status enums), regenerated like the goals index and the decisions blocks, so no agent writes the paragraph and last-writer conflicts cannot arise. The admission path models status as LiteralKit fields with an ordered lifecycle and rejects backward transitions as typed findings. Rejected: a hand-written paragraph with a single-owner lock (adds an ownership rule to admission and lets text and manifest drift).
