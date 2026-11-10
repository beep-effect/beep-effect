---
title: "Reserve priority moves to goal 2"
date: 2026-11-10
lane: "feat/github-budget-ledger"
pullRequest: 3068
reversal: "Restore a priority-aware admits(priority) on ReserveSignal with a production caller and the goal 1 test"
---

Hosted Fallow dead-code on #3068 flagged ReserveSignal.belowReserve and admits as unused: only tests called them, and goal 1 deliberately has no reserve-enforcing caller (SPEC non-goal: this goal publishes the signal, github-state-worker makes the worker obey it). The members were removed and consumers read ReserveState via ReserveState.match. The goal 1 acceptance criterion no longer asks for an interactive/merge-critical admission test; github-state-worker's SPEC already owns that rule (merge-critical head-pinned re-read and operator-direct commands may go to 1) and its test, at the first real consumer.
