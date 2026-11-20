---
title: "The flake quarantine reads the check logs"
date: 2026-11-19
lane: "feat/gate-report-wiring"
reversal: "Have the check gate echo compiler output into the Turbo stream again."
---

Once a package check prints the gate console, the Turbo stream no longer carries the raw compiler lines the no-location TS2589 detector reads, and detection on the root check run stopped. Before detection, each failed check task's raw log is appended to the lane output with the task prefix Turbo uses. The quarantine judges the same bounded attempt as before; its waves, reruns and artifact are unchanged, and its existing tests pass unchanged.
