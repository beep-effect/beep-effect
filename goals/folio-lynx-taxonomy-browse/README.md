# FOLIO and Lynx Taxonomy Browse

## Status

Lifecycle: `paused`

**Paused by operator ruling (finish board, 2026-11-13).** Its only activity was routed research-intake findings; it isn't on the critical path and nothing is in flight. No lane is working on it; resume with `bun run beep goals set-status folio-lynx-taxonomy-browse active` when it is picked up. Decision: [`decisions/2026-11-13-finish-board-ruling-pause.md`](./decisions/2026-11-13-finish-board-ruling-pause.md).

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Convert vetted FOLIO and Lynx slices through one TaxonomySeed path and add
read-only taxonomy navigation to the existing ontology toolkit.

## Launch

```text
/goal follow the instructions in goals/folio-lynx-taxonomy-browse/GOAL.md
```

## Current Phase

P0 Research: pin the FOLIO release/slice and require the Lynx-owned
`lkg.ttl` artifact license/vetting record.

## Read This First

Read GOAL, SPEC, PLAN, manifest, SOURCES, both source exploration packets, and
repo instructions.
