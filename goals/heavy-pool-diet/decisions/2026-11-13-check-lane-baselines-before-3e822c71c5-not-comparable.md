---
title: "Check-lane baselines before 3e822c71c5 are not comparable (check once)"
date: 2026-11-13
kind: checkpoint
lane: "docs/check-lane-baseline-break"
reversal: "Delete this checkpoint; it records a fact about main and changes no behaviour."
---

declaration-only-builds PR 3 (#3242, "check once") merged at `3e822c71c5` (2026-11-13). The root Turbo `check` task now depends on the package's own `build` for declaration-only packages, and their `beep:check` runs the declaration-only build command instead of a separate no-emit check.

- Every `check` task hash misses once from that commit. The first run after merging main is cold and is not a regression.
- Build minutes now sit inside the check lane: Heavy / Check and Heavy / Build start together on separate VMs, so on a cold hash both compute the same build. A check-lane wall-time or runner-minute baseline recorded before that commit is not comparable with a reading after it. Re-take the baseline before reading an after-number.
- The cache-qualification and check-census baselines were re-recorded in that PR; a reading that compares against either must use the post-merge files.
- Measured by the owning goal on main at `d8326d55935` (182 packages, serial): own-source check 35.4 s, a warm unchanged build 19.7 s; the saving from checking once is 15.7 s serial.
- `TSRS_FAST` is a global Turbo input and part of the tsrs incremental state: record with each baseline whether it was set.
- Follow-up this makes possible, not scheduled here: folding Heavy / Build into Heavy / Check (one fewer fleet VM per run), a heavy-pool-diet slice.
