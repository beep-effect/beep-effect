---
title: "CI-job adapter: cancelled steps count as unhandled; a stepless job is a fault unless skipped or not started"
date: 2026-11-22
lane: "goals/ci-gate-reports-p3"
reversal: "Edit STEP_READINGS and jobItems in Ci/CiJobAdapter.ts"
---

`ciRunGateReport` (`Ci/CiJobAdapter.ts`) reads a run as gate `run`, each job a unit and each step an item. `success` passes, `failure` fails, `skipped` and `neutral` skip, a step with no conclusion has not finished and skips, and any other conclusion is a plain failure. `timed_out` fails with `failureKind` `timeout` and `cancelled` fails with `unhandled`, so both keep their own totals buckets: the gate-report model has no cancel kind, and `unhandled` (the run stopped the step, not an assertion) is the nearest. A job with no steps is never green. GitHub lists a job skipped by `if:`, or one not yet started, with `steps: []`: that job reads as one skipped item. Any other job with no steps gets one `FaultKey` item, counted as `errored`, even when GitHub calls it a success. A red job whose steps all passed gets the same fault item, so the report never reads green while the job is red.
