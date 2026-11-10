---
title: "No lever landed before graduation; #3007 and #3030 census changes stay with ci-lane-economics"
date: 2026-11-09
reversal: "Mark a lever landed by a superseding decision that names its commit; the goal then keeps only its scorecard measurement."
---

Checked at 6eb2e0588e2 and re-checked at c90929b1ff1 (after #3040, #3043 and #3046: #3043 added the two-worker Test Unit layout to the census, #3040 changed worker flags and #3046 job order, and none touched the jobs read): all eleven levers are open except MEAS-03, which is partly landed (economics already prints a terminations census, but terminated attempts still count as red). #3007 and #3030 changed `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts` only to teach the census new shard layouts and planned shard subsets; the jobs read is still `filter=all` (LaneTimings.ts:1059), so MEAS-04 stays open. Shard-layout upkeep in the census belongs to `goals/ci-lane-economics`, which edits it with every partition change; this goal does not claim it. Rejected: crediting MEAS-04 as partly landed (the 502 exposure it fixes is unchanged). Source: lever status table in this packet's `SPEC.md`.
