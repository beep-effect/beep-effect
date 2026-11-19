---
title: "A marked later Vitest run folds into the record of the run before it"
date: 2026-11-19
lane: "feat/gate-report-wiring"
pullRequest: 3419
reversal: "Remove the mark from the four scripts and the fold from the adapter; the last run's record wins again."
---

Four packages chain two Vitest runs in one test script, and the second run overwrote the test record with only its own files. A later run is now marked with BEEP_GATE_CONTINUES=1 in the script and folds into the existing record through a pure merge in the model: units and items deduplicated by key, totals recounted from the items, durations summed, the first run's id and start kept; the log appends. A run without the mark replaces the record and clears the sidecar that names the run a chain may extend, so a chain never folds into a record left by a cache restore or an earlier invocation. An inferred session key was measured and rejected: the parent process differs between the two runs of one chained script, and the coverage orchestrator runs each Vitest command without a shell. A guard test requires the mark on every later run of a chained script.
