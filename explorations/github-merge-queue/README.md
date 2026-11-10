# GitHub Merge Queue

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `align`
Status: `active`
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

The operator scheduled the packet on 2026-11-09. Research is done and the
packet is at align. Four questions are open, in the order they unblock each
other:

1. **S11 under a queue.** A queue lands only green merge groups; S11 lets
   finals merge over failing required jobs. Does the queue end S11 on `main`,
   or does S11 stay and the packet die?
2. **The gate.** `main` reads 73.8% required-green over the last 14 days
   against the 80% bar, and the bar measures a symptom a queue would remove.
   Restate it as properties of the merge-group run (parity, wall time,
   false-ejection rate on a lab queue) and supersede the 2026-08-27 standards
   decision?
3. **Verdict placement.** `ten-minute-certainty` D7 already buys a hosted
   verdict for every `main` commit. Is the merge group that same run, moved in
   front of the merge?
4. **First slice.** One small goal now (parity, a lab-branch queue, the
   measurement) with activation gated, or more?

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger, pre-seeded with the on-disk sources and in-repo bricks.
4. [`RESEARCH.md`](./RESEARCH.md) - synthesis of the three lane reports under `research/`, plus the 2026-11-09 measurements (stage 1).
5. `DECISIONS.md` - grilling log (stage 2, not yet present).
6. `BRIEF.md` - shaped pitch (stage 3, not yet present).
7. `MAP.md` - decomposition (stage 4, not yet present).

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
