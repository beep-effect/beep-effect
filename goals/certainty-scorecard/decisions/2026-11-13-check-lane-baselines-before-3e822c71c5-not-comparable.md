---
title: "Check-lane baselines before 3e822c71c5 are not comparable (check once)"
date: 2026-11-13
kind: checkpoint
lane: "fix/certainty-meas-03-terminations"
reversal: "Delete this checkpoint; it records a fact about main and changes no behaviour."
---

#3242 merged at 3e822c71c5 (2026-11-13). The root Turbo `check` task now depends on the package's own `build` for declaration-only packages, and their `beep:check` runs the declaration-only build command. Every `check` hash misses once, and the first cold run is not a regression. Build minutes now sit inside the check lane (Heavy / Check and Heavy / Build start together on separate VMs and both compute the build on a cold hash), so a check-lane wall-time or runner-minute baseline from before that commit is not comparable, and the first certified nightly must be taken after it. The cache-qualification and check-census baselines were re-recorded in that PR. `TSRS_FAST` is a global Turbo input and part of tsrs incremental state, so each baseline records whether it was set.
