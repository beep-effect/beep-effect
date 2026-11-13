# Tracked-Changes Ingest Wedge

## Status

Lifecycle: `paused`

**Paused by operator ruling (finish board, 2026-11-13).** Product-relevant but unstarted; nothing in flight, so park until text-knowledge foundation direction settles. No lane is working on it; resume with `bun run beep goals set-status tracked-changes-ingest-wedge active` when it is picked up. Decision: [`decisions/2026-11-13-finish-board-ruling-pause.md`](./decisions/2026-11-13-finish-board-ruling-pause.md).

Its blocker goals/effect-native-legal-eval was closed by the same ruling; resuming this packet must first decide whether to re-open that packet or drop the dependency.

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
kept out of the repo and out of telemetry. Provider choice stays a
configuration decision.
