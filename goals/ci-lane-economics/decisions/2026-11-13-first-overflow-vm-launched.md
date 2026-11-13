---
title: "First overflow VM launched"
date: 2026-11-13
kind: checkpoint
lane: "docs/ci-overflow-first-launch"
reversal: "Delete this file and run goals decisions write; overflow itself is switched off with gh variable set BEEP_SHARD_OVERFLOW --body off"
---

The overflow pool launched its first VMs at 2026-11-13T20:36:42Z, 48 minutes after `BEEP_SHARD_OVERFLOW` went on, and every job it took passed.

- Run: Check 43502623814 (pull request, head `b6e833f1c2`, created 20:33:19Z). The route job sent all 24 Test Unit shards to `Test Unit (<shard>) / Overflow`.
- Result: 24 of 24 overflow jobs concluded `success`. Each ran on its own runner named `beep-ovf-<instance id>`.
- First VM: `i-0befcf82d46671a6c`, `r7a.2xlarge`, spot, launched 20:36:42Z. Its job, `Test Unit (repo-cli-3) / Overflow`, was queued at 20:36:36Z, started at 20:37:30Z and finished at 20:42:18Z.
- Scale-up log (`/aws/lambda/beep-ovf-scale-up`): `Created instance(s): i-0befcf82d46671a6c` at 20:36:42.876Z. 31 such lines between 20:36:42Z and 20:45:16Z, and no `PassRole`, `UnauthorizedOperation` or `ERROR` line. This is the proof that the `beep-ovf` entry in `beep-ci-fleet-boundary` v5 lets the scale-up role pass the runner role.
- Pickup wait (job queued to started) over the 24 jobs: shortest 54s, median about 4m00s, longest 6m50s. The last shard finished at 20:48:44Z, 15m25s after the run was created.
- Conditions: the heavy pool was in its 2 to 8 burst (from 20:27:07Z) and #3278 had merged at 20:35:50Z with a cold cache.

Two things to watch, neither changed here because a pool change inside window 5 would restart it:

- The pool launched about one VM every 30 seconds, so the 24th shard waited 6m50s for its runner. That is inside the 10-minute tripwire but it is most of the budget.
- 32 instances launched for 24 jobs. The eight extra launched between 20:43Z and 20:45Z and no other recent Check run had overflow jobs. Cause not yet read; check on the next overflow event.

All 32 instances are terminated. The switch stays on.
