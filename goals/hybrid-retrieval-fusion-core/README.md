# Hybrid Retrieval Fusion Core

## Status

Lifecycle: `paused`

**Paused by operator ruling (finish board, 2026-11-13).** Zero phases begun and overlaps the text-knowledge stack rebuild; nothing in flight. No lane is working on it; resume with `bun run beep goals set-status hybrid-retrieval-fusion-core active` when it is picked up. Decision: [`decisions/2026-11-13-finish-board-ruling-pause.md`](./decisions/2026-11-13-finish-board-ruling-pause.md).

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deliver a deterministic, fixture-driven hybrid retrieval seam that fuses
semantic, lexical FTS, literal, and optional graph ranks while preserving spans,
explaining every channel contribution, and remaining outside admission.

## Launch

```text
/goal follow the instructions in goals/hybrid-retrieval-fusion-core/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains normative.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact launcher.
2. [`SPEC.md`](./SPEC.md) - normative contract.
3. [`PLAN.md`](./PLAN.md) - active plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - migration and research provenance.
6. [`rag-retrieval-projection`](../../explorations/rag-retrieval-projection/README.md) - source exploration.

## Current Phase

P0 Symbol/topology audit and scorer migration parity baseline: confirm live
exports, exact package placement, and the prior-generation behavior/test matrix
before scaffolding implementation symbols.

## Latest Evidence

Not started.

## Notes

The vector projection, local encoder, clean-room evidence dedup, and citation
graph channel remain queued behind their independent gates. This packet owns
RRF policy; its output is candidate evidence and cannot bypass `ClaimGate`.
