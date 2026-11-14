---
title: "Slice 5: live readiness monitor reused"
date: 2026-11-14
kind: checkpoint
lane: "fix/local-proof-monitor-reuse"
reversal: "Revert the slice 5 PR; monitor --until-ready --detach submits a new job every time again, and job records are unchanged."
---

Slice 5 lands PERIL-02 on `fix/local-proof-monitor-reuse`. `yeet monitor --until-ready --detach` now hands back a live readiness monitor for the same branch and readiness argv instead of submitting a second job: it prints the existing job (its JSON record with `--json`) and a stderr note ending `not re-submitted`. A job is live while it is submitted or running with no cancel request and its runner process is not provably dead; a record whose runner is gone is named and skipped. The runner check moved from `Handler.ts` into `ProofJobLauncher.ts` (`readyMonitorRunnerStatus`, `pickLiveReadyMonitor`, `findReusableReadyMonitor`), and publish and the CLI share it. No record or schema on disk changed.

The defect at the old `ReadyGate.ts:565`: after a flip, `yeet ready` named any `running` record as the monitor still watching the pull request without checking its runner, so an agent could be told to `job wait` on a job that had died without a finalizer. The hint now runs the same runner check and, when only a dead record exists, says no detached monitor is registered and how to submit one.

Decision files `ready-monitor-argv-key` and `ready-monitor-cli-reuse-scope` record the key and the matching scope. Gate evidence: `test/yeet-ready-monitor-reuse.test.ts` (17 cases, Node and Bun, with a fake registry, submit and runner probe) covers two identical submissions yielding one job, a publish-submitted monitor handed back to a later `--detach`, a stricter request submitting a new job, a dead runner skipped, a registry read failure, other modes bypassing the lookup, and the ready hint, whose dead-runner case fails against the old lookup. `test/yeet-command-wiring.test.ts` adds publish submitting a new monitor when the live one runs with a longer settle timeout. PERIL-03's back-off (slice 8) can start; its 7-day A/B stays open in the acceptance criteria.
