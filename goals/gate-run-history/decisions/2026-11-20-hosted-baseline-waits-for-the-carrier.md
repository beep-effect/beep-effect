---
title: "P1 to P3 ship first; the hosted-main baseline waits for the ci-gate-reports carrier"
date: 2026-11-20
lane: "goals/gate-run-history-lane"
reversal: "Hold the whole goal until the carrier exists and ship it as one pull request."
---

On 2026-11-20 goals/ci-gate-reports has not started, so no hosted report reaches a lane. Lane history, the labels that need only lane evidence, the delta, the queries and the quarantine reconciliation ship in a first pull request. Until the carrier exists the main baseline is absent, red-on-main is never emitted, introduced-on-lane rests on lane evidence, and the console says once that there is no main baseline. P4 and AC-H7 follow in a second pull request once ci-gate-reports uploads reports, and the goal closes with that one.
