---
title: "A coverage skip decides before the noop shortcut"
date: 2026-11-13
lane: "fix/final-check-coverage-goal-readers"
reversal: "Evaluate the noop arm before skipFor in runGate and printGatePlan, and probe whenever the coverage gate is requested."
---

An operator `--skip coverage=<reason>`, a compute-profile deferral and a route skip, which is everything `skipFor` returns, are evaluated before the in-process coverage probe. The probe runs only when `skipFor(run, "coverage")` is None. A skipped coverage gate therefore stays `skipped` with its own reason in the receipt and in the PR-body naming rule, and never turns into a `passed` noop.
