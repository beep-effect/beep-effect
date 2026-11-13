# Agent Memory Store

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Build the agent memory store the 2026-11-09 memory-architecture decision licenses: a set-union log of immutable node events as sole authority, Markdown memory files and indexes as projections, store-side admission with no CRDT on agent write paths, prevalence as an observation log.

The design was settled before this packet opened. Three deep-research reports
were reconciled on 2026-11-08 and tested the same day by nine pre-registered
spikes over this repository's `goals/**` history, the operator's auto-memory
notes and twenty session transcripts; five of the nine killed a candidate
feature on their pre-registered clause, the S14b follow-up killed a sixth, and
each kill simplified the design. The surviving design was
grilled against the memory-architecture standard on 2026-11-09 and landed as
the decision-log entry this packet builds (PR #2996). `SPEC.md` is normative.

No source exploration in this repository: the exploration ran machine-locally
and its scoreboard and spike plan are imported under `research/`. The
graduated [`agent-memory-tiers-bitemporal-edges`](../../explorations/agent-memory-tiers-bitemporal-edges/README.md)
exploration supplied the bitemporal framing the taxonomy's Layer 2 split rests
on.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/agent-memory-store/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth: objective, relationships
   to the decision log and the text-knowledge rebuild, non-goals, the entry's
   three fixed rulings and six design items P0 confirms, acceptance criteria AC-1 to AC-9 with
   their spike numbers, the verification matrix.
3. [`PLAN.md`](./PLAN.md) - active execution plan: design, five build phases,
   yeet, close, with observable exit criteria.
4. [`decisions/`](./decisions/) - one file per decision, projected into
   `SPEC.md` and `PLAN.md`.
5. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing; its
   `researchReports` array is generated from `research/` by
   `bun run beep goals manifest --write`, never hand-edited.
6. [`research/2026-11-08-validation-scoreboard.md`](./research/2026-11-08-validation-scoreboard.md) -
   the nine spike verdicts, deciding numbers, the design after Day 2 (v3), and
   the grilled decision entry's six changes.
7. [`research/2026-11-07-validation-spike-plan.md`](./research/2026-11-07-validation-spike-plan.md) -
   the pre-registered pass and kill clauses each spike was judged against.
8. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.

## Current Phase

P2 Admission — in progress. P1 completed in PR #3058 (merged as 6fc960063d4):
the live `MemoryLog`, the Markdown node partition with its reparse check and
the live `MarkdownProjector`. P2 builds op capture against the exported base,
live store-side admission (per-node compare-and-set at row and list-item
granularity, the whole-node three-way merge, held writes as log events with
both texts, per-op admission, typed status fields with the lifecycle guard)
and the capture-admit-export write path (`admitEdits`, `writeEdits`).

## Latest Evidence

2026-11-13, P2 lane, on the adversarial concurrent-edit fixture this lane
built (15 declared strata, 57 clusters, 118 writes per run over 14 files of
the frozen goals sample): AC-2 green, 0 of 100 seeded runs with a silent loss
and 1,000 of 1,000 contested nodes held with both texts. AC-3 measured and
open: structural floor 912/11,800 writes; resolver-needed 1,912/11,800 and
per-op landing 12,178/15,600 (78.1%), which this upper-bound fixture cannot
compare with the S14b bars (26/279, 95%); status conflicts 1,000 with 0 held
and 0 wrong; 744 of 744 backward moves rejected. The numbers are in the
2026-11-13 checkpoint in `PLAN.md`; the fixture design is decision
`p2-adversarial-fixture-is-seeded-contention-strata`.

2026-11-13, P2 lane, on the comparable replay: this repository's goals
history at 3f0261b37a0 replayed as concurrent writers (decision
`p2-ac3-history-replay-construction`; 118 clusters, 275 writes, 3,364
operations). Zero silent loss in history order and three seeded orders.
History order: structural floor 11/275; resolver-needed 40/275 against
26/279 (40 x 279 = 11,160 above 26 x 275 = 7,150), not met; per-op landing
3,267/3,364 (97.1%), met; typed status 0 held and 0 wrong. The
resolver-needed ratio is judged at P5's exit, after the `## Current Phase`
owner rule lands (decision `ac3-resolver-needed-bar-is-judged-in-p5`), so
AC-3's box stays open; the held-write breakdown is in the 2026-11-13 AC-3
checkpoint in `PLAN.md`.

## Notes

- The S14b lesson governs every new bar: set held-write bars on the
  resolver-needed count, not the CAS-fail count, and check the structural
  conflict floor first.
- The memory store has no revision history today: S7 had to take all 54
  superseded fixtures from git-tracked goals, and 75 memory blocks say
  "superseded" inline yet read as current. P1's log is what gives notes a past.
- Real two-sided concurrent merges were 2 of 70 in this repository's own
  history; the admission design is sized for held conflicts, not for merge
  throughput.
