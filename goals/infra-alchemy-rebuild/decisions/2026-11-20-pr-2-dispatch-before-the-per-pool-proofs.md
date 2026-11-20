---
title: "PR 2 dispatch before the per-pool proofs"
date: 2026-11-20
lane: "docs/infra-alchemy-p5-dispatch-order"
reversal: "restore the proofs-before-PR-2 order; re-proof each pool after the PR 2 dispatch"
---

The CI goals driver (the successor driver, 2026-11-20 02:10Z) ruled the order of the remaining P5 cutover steps:
the PR 2 dispatch, which deploys the handler identity leaves (#3431) and the r7a.2xlarge removal (#3430) to the
CiRunners stack, now goes before the per-pool proofs.

New order: PR 2 dispatch, then the operator adds the new-fleet repository webhook, then the heavy proof, the
overflow proof, BEEP_SHARD_OVERFLOW off, step 4a, step 4b, the post-4a pin bump, BEEP_SHARD_OVERFLOW on, the green
day, step 6b and the drain.

Conditions on the dispatch:

- A plan_only on the then-current main must show exactly 11 function rows `changes code (bundle hash, inferred)`.
  Exactly six of them (scale-up, job-retry and scale-down of both pools) also carry env, and that env diff is
  only r7a.2xlarge leaving the instance-type list. Each #3423 reconcile row is named; every other row is noop.
  Any other row stops it. If main moves before the dispatch word, a fresh plan_only on the new main is required.
- It waits for the driver's explicit word after the plan clears, and not before the heavy burst ends
  (03:54:14Z, 2026-11-20). CI_RUNNERS_ROUTINE_ARMED is set for that one dispatch only.
- Its proof is CloudTrail: GetPolicy on the webhook function's URL permission and no RemovePermission or
  AddPermission. Without that proof, step 4a does not go.
