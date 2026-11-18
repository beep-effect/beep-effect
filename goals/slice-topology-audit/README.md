# Slice Topology Audit

## Status

Lifecycle: `superseded`

**Superseded on 2026-11-17 by [`goals/model-first-standard`](../model-first-standard/README.md)** (operator ruling, [`explorations/model-first-slices/DECISIONS.md`](../../explorations/model-first-slices/DECISIONS.md) D65). Do not resume this packet. That goal takes over the mission on the four-package slice shape (the doctrine amendment, the scaffolder and checkers under a baseline ratchet) and provides `architecture/slice-audit`. History: this packet was paused unstarted by the finish-board ruling of 2026-11-13 ([`decisions/2026-11-13-finish-board-ruling-pause.md`](./decisions/2026-11-13-finish-board-ruling-pause.md)).

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make the slice grammar mechanical: land the locked doctrine amendments, then ship beep architecture audit with a day-one baseline ratchet in a required check

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/slice-topology-audit/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — not started.

## Latest Evidence

Not started.

## Notes

- Graduated 2026-08-30 from [`explorations/v3-consistency-audit`](../../explorations/v3-consistency-audit/README.md) (16
  grill decisions + 2 operator addenda + 7 ratified sub-choices; nine
  DEFERRED rows ratify in P0). `SPEC.md` links the exploration's
  `DECISIONS.md` as binding; `BRIEF.md` carries the grammar block.
- Provides `architecture/slice-audit`; `goals/canonical-proof-reconciliation`
  requires it and must not start its codemods before the baseline exists.
- The capability check (2026-08-30) withdrew four NET-NEW marks: reuse
  `@beep/repo-utils` `resolveWorkspaceDirs`, `cli/src/internal/ratchet`,
  `CiLane.ts`'s registry, and `@beep/schema/Fn`'s construction for the
  `Contract` kit. See `research/SOURCES.md` §4.
