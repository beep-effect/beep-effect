# Local-First Projection Sync

## Status

Stage: `graduate`
Status: `graduated` — gated candidates remain as re-entry points.

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Accepted authority records need restart-safe projection dispatch, while the
desktop needs a fast but disposable signal to re-query. The durable work belongs
in repo-native persistence and Effect's workflow primitives; live UI freshness
must remain a weaker hint.

## Next Open Question

None. Reopen at `decompose` only when a gated candidate trigger fires: live
multi-connection topology for desktop fan-out, a second projector-family
owner, or graph projection approval after SSPL review.

## Graduated Goal

- [`goals/projection-dispatch-core`](../../goals/projection-dispatch-core/) —
  first accepted-record projection cycle; blocked by
  [`goals/effect-v4-workflow-engine-spike`](../../goals/effect-v4-workflow-engine-spike/).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state and goal link.
2. [`DECISIONS.md`](./DECISIONS.md) - seven locked decisions and deferred gates.
3. [`BRIEF.md`](./BRIEF.md) - shaped two-plane pitch and proposed appetite.
4. [`MAP.md`](./MAP.md) - graduated goal, gates, sequencing, and capability check.
5. [`RESEARCH.md`](./RESEARCH.md) - research plus the 2026-07-14 amendment.
6. [`research/SOURCES.md`](./research/SOURCES.md) - primary provenance ledger.
7. [`CAPTURE.md`](./CAPTURE.md) - append-only source dump.

## Sources & Provenance

[`research/SOURCES.md`](./research/SOURCES.md) retains the gold-intake donor,
external landscape, live repo bricks, and the unresolved TalentScore
license-of-record conflict. TalentScore remains clean-room/reference-only until
that conflict is reconciled.

## Trail

- 2026-08-13: packet closed `graduated`; multi-window delivery, a second
  projector-family owner, or an approved graph projection after SSPL review
  reopens the packet at `decompose` under the repository convention.

- 2026-07-14: post-align shape/decompose/graduate — locked Q1–Q7 and fan-out, drafted the two-plane brief/map, graduated `projection-dispatch-core`, and kept the packet active for gated candidates.
- 2026-07-14: research amendment — accounted for live Effect v4 `DurableQueue`, current epistemic/desktop capabilities, and superseded the v3-era in-memory hub premise.
- 2026-06-30: provenance backfill — added research/SOURCES.md and flagged the TalentScore license conflict.
- 2026-06-29: research-complete — synthesized RESEARCH.md, folded the codex gate, and pre-drafted Q1–Q7.
- 2026-06-29: packet opened from gold-intake cluster "Local-first projection sync (EventStreamHub)".
