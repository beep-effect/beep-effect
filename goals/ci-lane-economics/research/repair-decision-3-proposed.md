# Hosted-queue repair decision — PROPOSED, unsigned — 2026-10-01

**Status: proposed, not implemented.** This file records the next repair the
window-3 verdict (`admission-week-3-p95.md`) points to. It authorizes nothing.
No shard, fleet, or workflow move happens until the operator signs a decision
here (or rejects it).

## Problem statement

Window 3 broke the repairs out from the load. Shard bodies held inside the
#1195 projection: repo-cli-1/2 had p95 748 s/735 s and unit-a/b had p95
636 s/627 s. On the quiet days (09-23/24) every gate cleared. From 09-25 the
operator's parallel agent lanes put 10–25× the usual run volume on `check.yml`
(58 distinct branches in one day; 44 `codex/effect-vitest-*` branches over
the week). Shard pickup p95 reached 23m58s, and on 09-27 its maximum was
59 minutes. `Test Unit` and `Lint` breach because their effective spans
include the wait for a free hosted runner. Re-splitting shards cannot fix
this; it adds jobs to the same queue.

## Options to decide between

| Option | What changes | Cost / rail | Expected effect | Risk |
| --- | --- | --- | --- | --- |
| A. Fan-out governor (agent side) | Agent orchestration caps concurrently CI-active PR branches (e.g. ≤ 8 heavy-matrix PRs in flight); further lanes hold their push or open as draft without CI until a slot frees. Lives in the yeet publish/admission path, not in workflows. | $0; no workflow or fleet change | Keeps the hosted pool under saturation. 09-28 (174 runs spread out) already passed at pickup 4m29s. | Slower throughput for bulk fan-outs, and it needs a sound slot signal (open PRs with queued `check.yml` jobs). |
| B. Burst shards to the fleet | Under queue pressure, route `Test Unit`/`Lint` shards to `beep-ec2-heavy` (e.g. a dispatch label or queue-depth gate). | Must fit the $100/mo projection and $200/mo ceiling (`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md`). Needs a fresh cost model at window-3 volume. | Removes the hosted queue from the critical path during bursts. | Fleet cost scales with agent fan-out; fork-PR, cache-write, IAM, egress, and teardown rails must stay intact. |
| C. Fewer jobs per run | Collapse redundant per-PR work during bursts, e.g. skip the Test Unit/Lint matrix on draft PRs and run it at `ready-for-review`, or path-filter docs-only pushes harder. | $0 | Fewer jobs compete for the pool. | Required checks must still report on every PR; skipped-as-success semantics must not weaken the gate. |
| D. Change the measure | Count only body time, or exclude burst days. | — | — | **Rejected.** The charter is "no required job waits 20 minutes"; queue time is the wait. |

## Recommendation for signing

Make A the primary move, with C as a cheap companion, and keep B in reserve
until A is measured. A attacks the cause (bursty agent fan-out), costs
nothing, and matches the 09-28 evidence. It also belongs to the
orchestration surface (`beep yeet`, agent-pool runbook) rather than to the
CI fleet. If a window under A still breaches pickup, sign B with a costed
burst model.

## Before signing

- Pick the slot limit from data: the maximum concurrent CI-active branches on
  the passing days (09-23, 09-24, 09-28) versus the breaching days. The census
  TSV's `runCreatedAt` and pickup rows give the concurrency curve.
- Decide where the governor reads state: `gh api` queued-job counts versus
  the yeet admission journal.
- Choose window 4 as the first complete half-open UTC week after the move
  merges.
