# Map — Patent Drafting Episode Ledger

Status: OPERATOR-RATIFIED 2026-08-13; rung 1 graduated.

## Candidate Goal

| Rung | Slug | Mission | Depends on | Capability boundary |
| --- | --- | --- | --- | --- |
| 1 | [`patent-drafting-episode-ledger`](../../goals/patent-drafting-episode-ledger/README.md) | Ship the law-owned append-only DraftingEpisode, replay fold, support-set promotion gate, seven-field answer annex, and rebuildable projection/fallback proof. | Live professional-runtime, verified-span, practice-KG, candor-gate, and retrieval SPEC contracts; no build-order block. | Reuse `RuntimeApprovalGate`, verified anchors, law-practice append-only persistence, `CandorGateVerdict.isBlocked`, and the existing claims batch. NET-NEW: event union/fold, support closure schema, annex, watermark rule, projection port. |

## Deferred Re-entry

| Candidate | Gate | Purpose |
| --- | --- | --- |
| `patent-drafting-public-uspto-benchmark` (not yet created) | Operator reopens this packet at `decompose` after the rung-1 fixture is stable and `uspto-prosecution-read` exposes a suitable public prosecution-history corpus. | Benchmark fixed versus learned routing and the hypothesis-only inference-event/anti-hub retrieval claims without using client material. |

## Sequencing

Operator sign-off covered the BRIEF and MAP, and rung 1 graduated on
2026-08-13. The public USPTO benchmark follows only after the public corpus and
rung-1 replay contract exist; it cannot hold the first rung open.

## First Vertical Slice

Replay one ordered drafting episode through a limitation-support decision,
refuse promotion law-side while one closure is unresolved, rebuild the
projection from deletion, and prove identical rows/answers plus an honest
seven-field annex and watermark-driven fallback report.

## Inherited Risks

- Provisional event arms must not masquerade as emitter-proven contracts.
- Support anchors must remain evidence, never verdict inputs.
- Retrieval ordering and the event-fixture order must be deterministic.
- Projection deletion/rebuild must preserve the authority boundary.
