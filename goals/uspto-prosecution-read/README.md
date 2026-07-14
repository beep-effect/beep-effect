# USPTO Prosecution Read

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deliver a known-application, provenance-bearing USPTO prosecution observation
and one deterministic generation mechanism for the four native vocabularies
needed by the patent-docketing spine and its maintenance-fee sibling.

## Launch

```text
/goal follow the instructions in goals/uspto-prosecution-read/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains normative.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact launcher.
2. [`SPEC.md`](./SPEC.md) - normative contract and dependency edges.
3. [`PLAN.md`](./PLAN.md) - four P0 spikes and phased execution.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited provenance.
6. [`uspto-patent-driver-depth`](../../explorations/uspto-patent-driver-depth/README.md) - source exploration.

## Current Phase

P0 Research: resolve the OA envelope, four-vocabulary retrieval, `PTMNFEE2`
layout/access unknowns, and authenticated ODP retry/header/idempotency behavior
before freezing the observation and transport contracts.

## Latest Evidence

Not started.

## Notes

`goals/uspto-ptmnfee2-ingest` depends on this packet's generation mechanism.
Sequential-per-key polling remains above the driver in the docketing workflow.
