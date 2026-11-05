# Alchemy Domain Adoption

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Replace the hand-rolled entity kit in `@beep/shared-domain/entity` (BaseEntity, AuditEntity, OrgEntity, EntityKit, EntityRef, ...) with `@alchemy.run/domain`, a more faithful DDD toolkit over Effect v4 (Model, Command, Event, Aggregate, View, Projection, Stream, Policy, Saga, External System, Api, Story). The operator has decided the change; this packet researches how to leverage the module fully, picks the first vertical slice that exercises the most of it, and graduates that slice as the first goal. Every `@beep/<slice>-domain` package follows later; `@beep/effect-drizzle` is replaced eventually.

## Next Open Question

None. Graduated 2026-11-05 into [`goals/alchemy-vault-sync-slice`](../../goals/alchemy-vault-sync-slice/README.md). Queued candidates (epistemic, DocketIntake, remaining slices, CRDT content values) stay in `MAP.md` as re-entry points.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-11-03: packet opened from operator dump; three research lanes launched; align round 1 started.
- 2026-11-03: three lane reports landed in `research/`; rounds 1–2 locked D1–D7 (Postgres platform, event streams authoritative, strangler, direct import, vault-sync first, Cluster workflow engine, single-writer cutover).
- 2026-11-05: `/teach` lesson on sync topologies (`$HOME/YeeBois/teach/local-first-sync/`) revised the local-first answer; D8 locked (offline intents + prediction, CRDTs scoped to content values later). Round 3 opened.
- 2026-11-05: rounds 3–4 locked D9–D17; BRIEF.md and MAP.md written; operator confirmed the shape; graduated into `goals/alchemy-vault-sync-slice`.
