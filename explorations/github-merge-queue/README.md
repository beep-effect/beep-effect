# GitHub Merge Queue

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `capture`
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

Is the capture complete? This packet is captured, not scheduled: the
time-to-certainty GOAL still forbids a merge queue before the recorded flip
condition (ship-velocity E8: `main` full-gauntlet success at or above 80% over
14 days, last measured at 65.4% on 2026-08-27). When the operator schedules
it, the grill opens on the four design questions in `CAPTURE.md`, and the
first research task is fixed: re-measure the flip condition on the live
`check.yml` push history and inventory every workflow that provides a
required `main` check, since each one must add the `merge_group` trigger or a
queued PR never reports.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger, pre-seeded with the on-disk sources and in-repo bricks.
4. `RESEARCH.md` - prior art + capability inventory (stage 1, not yet present).
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
