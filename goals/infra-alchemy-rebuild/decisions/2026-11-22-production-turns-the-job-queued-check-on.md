---
title: "Production turns the job-queued check on (reverses ruling A)"
date: 2026-11-22
lane: "fix/ci-runners-prod-job-queued-check"
reversal: "set jobQueuedCheck false for both pools in productionConfig and redeploy: six env-only rows, nothing migrated"
---

This reverses the "job-queued check stays off in production" paragraph of
`2026-11-22-ssm-fix-advanced-jit-tokens-no-relaunch-loop-dead-letter-without-a-redrive.md` (ruling A). The CI goals
driver ruled the reversal after the P5 step 4b deploy, and this record.

**The finding.** After 4b raised the caps (heavy 1 → 2, overflow 2 → 48), heavy-build held a steady in-flight backlog
(18 messages at the arm, 25 at 21:16Z) while GitHub showed no queued `beep-fleet-heavy` job. These are messages for jobs
that were already served. Scale-up's over-cap path leaves a message on the build queue with no log line, SQS redelivers
it after the visibility timeout, and with the check off nothing drops it, so every redelivery that finds a free slot
launches a runner for a job that no longer needs one. The 21:21Z reading had 8 launches since the update: 6 took a job,
1 was reaped idle and 1 was still waiting. The old Pulumi fleet showed the same mechanism at scale after 4a: about 234
stale messages relaunched idle Spot runners until the queue was purged. Each idle launch is bounded (the runner is reaped),
but it is a VM per stale message and it holds a cap slot a queued job could use.

**Why the original reason no longer holds.** Ruling A kept the check off because the live fleet's jobs API answered
"not queued" for jobs that were queued, and two of seven pickup probes sat queued for over 25 minutes. That live
predicate read every status except `queued` as "no runner needed". Since #3454, `isJobQueued` is false only for
`in_progress` and `completed` (`GitHubApp.layer.ts`, `isTakenJobStatus`): a lagging read shows an earlier state
(requested, waiting, pending), which still launches. The check stays fail-open on a GitHub error, and every status
other than `queued` is logged with the job, the status and the answer.

**The change.** `PoolSettings` gains a required `jobQueuedCheck`; `productionConfig` sets it `true` for both pools and
`toRunnerPool` passes it to the fleet. Personal stages inherit it through `personalConfig`. The deploy plan is six
env-only rows (`BEEP_RUNNER_CONFIG.pool.jobQueuedCheck` false → true on each pool's scale-up, scale-down and job-retry)
with identical bundles, and the test that pinned the check off now pins it on.

**How it is checked after the deploy.** Every scale-up "the job's status is not queued" line with `queued: false` names
a job whose status is `in_progress` or `completed` and whose `started_at` precedes the line. A `queued: false` line for any
other status, or before the job started, is a STOP and a rollback (set it back to `false`).
