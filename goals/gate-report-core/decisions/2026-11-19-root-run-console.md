---
title: "A root test or check run prints one console from the package records"
date: 2026-11-19
lane: "feat/gate-report-wiring"
reversal: "Return the root steps to streaming their Turbo output."
---

The root unit test run and the root check run capture their Turbo step and print one console for the workspace: counts and duration summed from the package records, packages taken from the run summary. A cache hit's record is trusted; a miss's record must be newer than the run start. The repo-wide type smoke step still streams, and integration lanes are not aggregated because Turbo neither caches nor restores their records. The package test path runs the package test script with output captured, renders the fresh record, and records an errored run with the log excerpt when no record was written.
