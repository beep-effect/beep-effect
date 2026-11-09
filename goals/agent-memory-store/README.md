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

P0 Design and grill — not started. First action: confirm or reverse the six
packet-decidable design items by decision file and route the package home.

## Latest Evidence

Packet opened 2026-11-09 from the merged decision entry (PR #2996, commit
1e0b8c107c0). No package code has changed.

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
