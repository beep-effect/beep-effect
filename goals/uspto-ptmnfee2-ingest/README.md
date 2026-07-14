# USPTO PTMNFEE2 Ingest

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Discover and checksum-pin the weekly cumulative `PTMNFEE2` release, parse it by
validated full replacement into typed native maintenance events, and ship an
attributed network-free fixture and refresh manifest.

## Launch

```text
/goal follow the instructions in goals/uspto-ptmnfee2-ingest/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains normative.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact launcher.
2. [`SPEC.md`](./SPEC.md) - normative full-replace and provenance contract.
3. [`PLAN.md`](./PLAN.md) - P0 unknowns and phased execution.
4. [`ops/manifest.json`](./ops/manifest.json) - dependencies and routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited source ledger.
6. [`uspto-prosecution-read`](../uspto-prosecution-read/README.md) - shared generator dependency.

## Current Phase

P0 Research: capture the authorized current release, exact 2026 layout and
members, complete code list, sizes, rate/access behavior, and replacement
invariants before freezing parser or manifest schemas.

## Latest Evidence

Not started.

## Notes

This packet feeds the patent spine's maintenance-fee acceptance case. Scheduling
remains in `goals/law-docketing-reliability`; legal interpretation remains in
law practice.
