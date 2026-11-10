---
title: "Monitor work split: the GitHub read-path goals own reads, cadence of the worker and budget; this goal keeps the residual"
date: 2026-11-09
reversal: "Move the residual monitor levers to github-state-worker by a decision in both packets."
---

Checked against the live checkout: #3032 (commit fda98a2c4bd) landed part of PERIL-03, a 90 s default poll (`MonitorLoop.ts:210`) and a rate-limit sleep (`MonitorRateLimit.ts`); state-aware back-off and a wake on a local ref change are not landed. `goals/github-state-worker` owns the monitor's GitHub reads (the monitor stops polling while a fresh snapshot exists; the worker's cycle cadence is its decision), `goals/github-budget-ledger` owns per-call-site attribution and the 15% reserve signal (so PERIL-03 slice 1 and the REST saving of the back-off are theirs), and `goals/yeet-monitor-app-identity` owns the monitor's identity. This goal keeps only the residual: PERIL-02 (one live monitor per PR per checkout, reuse on `monitor --until-ready --detach` keyed on normalized readiness argv, a dead runner skipped, the liveness gap at `ReadyGate.ts:565` fixed), the monitor loop's state-aware sleep with a wake on a local ref change (local CPU and notice lag, applied to snapshot reads and to the direct-read fallback), and the D16 budgeting rule in the yeet skill written against the ledger's reserve signal with no counter of its own. Rejected: claiming the snapshot worker's cadence or a second REST budget here.

Source: this packet's lever status check (git log fda98a2c4bd; the three goals' SPEC Objective, Non-Goals and Target Surfaces); exploration `explorations/ten-minute-certainty/DECISIONS.md` (D16, D27).
