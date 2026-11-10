# GitHub Merge Queue

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Time-to-certainty item B9. A GitHub merge queue moves the operator's authority
from "merge" to "enqueue": required checks run on merge-group commits (up to
the build-concurrency limit at once), and the queue merges them in queue
order on green. B8 heavy-check admission (ruling
56, B8-7) reserved the `merge-group` admission source and ruled the queue
itself captured, not scheduled, pending an `/explore` grill.

## Next Open Question

None is open. The packet graduated on 2026-11-09 with one goal,
[`goals/merge-queue-lab`](../../goals/merge-queue-lab/README.md), and four
gated candidates in [`MAP.md`](./MAP.md). It reopens at `decompose` when a
gate fires:

| Candidate | Gate |
| --- | --- |
| `merge-group-parity` | `merge-queue-lab` ends in go, and `ten-minute-certainty`'s `route-soundness-repair`, `heavy-pool-diet` and `hosted-setup-tax` have merged |
| `yeet-queue-states` | `merge-queue-lab` ends in go, and `goals/github-state-worker` is completed |
| `merge-queue-activation` | the activation gate holds (parity, p90 wall time at or under 15 minutes, false ejections at or under 5% over 100 entries), parity and Yeet states are completed, and `ten-minute-certainty`'s throughput layout for `main` has landed |
| `pr-head-slimming` | the queue has been live on `main` for 14 days with ejection causes recorded |

A park or kill verdict from the lab ends the packet instead.

Owed outside this packet: `explorations/ten-minute-certainty/MAP.md` still
lists "Per-SHA main groups" and "Merge queue, stacked PRs" as separate gated
candidates behind the 80% bar. Under the `verdict-placement` and
`gate-restatement` rulings they are one candidate with the gate above; that
packet's owner rewrites the rows. `explorations/stacked-pr-adoption` cites the
same 80% bar for its own stacks-reopen gate and keeps it until it is reopened.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`BRIEF.md`](./BRIEF.md) - the shaped pitch: problem, appetite, sketch, rabbit holes, no-gos.
3. [`DECISIONS.md`](./DECISIONS.md) - the operator rulings of 2026-11-09 and the agent-decided entries.
4. [`MAP.md`](./MAP.md) - the graduated goal, the gated candidates and their gates.
5. [`RESEARCH.md`](./RESEARCH.md) - synthesis of the three lane reports under `research/`, plus the 2026-11-09 measurements.
6. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.
7. [`CAPTURE.md`](./CAPTURE.md) - the 2026-09-16 raw dump. Its "GitHub facts" and acceptance criteria are superseded by the files above.

## Trail

- 2026-09-16: packet opened as the B9 capture promised by the B8 brief (PR C).
  Captured the problem (heavy runner queue depth, merge-to-enqueue authority,
  ruling 56 capture-not-schedule), the GitHub merge-queue facts verified
  against docs.github.com the same day, the four design questions to grill,
  the acceptance criteria, and the standing no-go on a global `concurrency`
  group. This PR is docs-only by construction and doubles as the acceptance
  probe for the B8 heavy-admission docs-only filter. Nothing is scheduled;
  capture stays open until the operator signals the dump is done.
- 2026-11-09: operator scheduled the packet; capture closed. Re-read the flip
  condition on live `check.yml` history: 746 merges in 14.2 days (53 a day),
  70% of `main` runs cancelled, 73.8% of tested runs with all 15 required
  contexts green, 62.8% in the second week. Three research lanes wrote
  `research/github-semantics.md`, `research/repo-inventory.md` and
  `research/prior-work.md`; `RESEARCH.md` synthesizes them. Findings that
  reshape the packet: GitHub never batches CI across queue entries; one full
  run now peaks near the hosted job ceiling, so the queue builds one entry at
  a time; S11 and a queue cannot both govern `main`; and
  `ten-minute-certainty` D7 already pays for a verdict on every `main` commit,
  which is the same spend a merge group makes before the merge. Stage moved
  capture to research to align in one session.
- 2026-11-09: aligned, shaped, decomposed and graduated in the same session.
  Two grill rounds and one shape review, all logged in `DECISIONS.md`: a queue
  replaces S11 at activation; the activation gate is restated on the
  merge-group run and the 2026-08-27 standards decision is superseded; the
  merge group is `ten-minute-certainty` D7's per-commit verdict placed before
  the merge; pull-request head proof stays unchanged at activation; the lab
  runs now and parity waits for `ten-minute-certainty`'s route-soundness and
  job-removal goals. Definition of ready: brief complete, no open blocking
  question (cache writer and Spot-eviction handling are DEFERRED with reasons),
  map names five candidates, every component cites a brick or is marked
  NET-NEW. Graduated `goals/merge-queue-lab`; four candidates stay gated.
