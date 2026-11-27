---
title: the per-PR property lane runs a fixed fast-check seed at a 400-run floor
date: 2026-11-26
reversal: Let fast-check pick a seed and its 100-run default on pull requests.
governs:
  - src/commands/Ci/CiLane.ts#DEFAULT_PROPERTY_LANE_SEED
  - src/commands/Ci/CiLane.ts#DEFAULT_PROPERTY_LANE_RUNS
enforcedBy: []
---

A fixed fast-check seed makes the lane deterministic, so a local `beep ci lane property` and the CI Property Laws lane, which runs the same command, test identical inputs and a local green predicts a CI green; the nightly sweep passes a new seed every run, for breadth.
Runs and seed are read as floors of fixed constants: a blank `--runs ""` would reach the lane as `BEEP_FC_NUM_RUNS=""`, which the parsers treat as absent (fast-check's 100-run default), and a blank `--seed ""` would drop determinism, so blank input normalizes back to the floor.

Rejected: a random per-run seed on pull requests, whose local green no longer predicts CI.
