---
title: "Coverage runs write no gate record in this goal"
date: 2026-11-19
lane: "feat/gate-report-core"
reversal: "Have the coverage planner pass the gate reporter beside its own on the command line."
---

The coverage planner passes its own reporters on the command line, and a command-line reporter replaces the configured list, so the adapter does not run under the coverage commands. This goal leaves that as it is: a coverage run writes no record and the coverage gate keeps its own report. The spec sentence that expects the adapter under the Node coverage commands is narrowed to the five packages whose ordinary test script runs Vitest on Node. Putting the coverage gate on the contract is rollout work in `goals/gate-report-rollout`.
