# Tracked-Changes Ingest Wedge

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Prove and ship tracked-changes-aware OOXML-to-canonical ingest, with the U4
fixture spike as a P0 kill-gate and an explicit structural-representation
fallback.

## Launch

```text
/goal follow the instructions in goals/tracked-changes-ingest-wedge/GOAL.md
```

## Read This First

1. [`GOAL.md`](./GOAL.md)
2. [`SPEC.md`](./SPEC.md)
3. [`PLAN.md`](./PLAN.md)
4. [`ops/manifest.json`](./ops/manifest.json)
5. [`research/SOURCES.md`](./research/SOURCES.md)
6. [Source exploration](../../explorations/harvey-lab-firm-knowledge/README.md)

## Current Phase

P0 kill-gate: run the U4 OOXML/Pandoc/Md fixture spike and decide whether
semantic preservation is viable or the structural fallback must be used.

## Latest Evidence

Scaffolded 2026-08-13 from the operator-ratified BRIEF and MAP.

## Notes

Synthetic C&H fixtures come first. Any later real OIP diligence data room is
on-device only and excluded from telemetry and remote evaluation.
