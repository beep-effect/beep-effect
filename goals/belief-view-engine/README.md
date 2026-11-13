# Belief View Engine

Lifecycle: `superseded`

**Closed by operator ruling (finish board, 2026-11-13).** It has sat unstarted at scaffold for three months, no lane is pulling it, and the text-knowledge stack rebuild probably redefines this layer. The packet is `superseded` without meeting its completion gate. To resume, run `bun run beep goals set-status belief-view-engine active` and re-graduate the next slice. Decision: [`decisions/2026-11-13-finish-board-ruling-close.md`](./decisions/2026-11-13-finish-board-ruling-close.md).

One working belief per contention set, on demand: BeliefContentionKey v1, the total selection-policy contract, the content-addressed BeliefViewRevision with digest-encoding v1, the same-policy typed delta, and the capped, indexed scope-wide EdgeAuthority read.

**Before the 2026-11-13 ruling: paused at scaffold (2026-08-17) as a queue goal.** Authored-but-not-started by
design: no program-lane slot was free at graduation. Resume when a lane slot
frees or the roadmap pulls it (`docs/ROADMAP.md` parked section).

## Launcher

```text
/goal follow the instructions in goals/belief-view-engine/GOAL.md
```

## Reading order

1. [`SPEC.md`](SPEC.md) — normative contract (seeded from the ratified,
   adversarially-amended MAP).
2. [`PLAN.md`](PLAN.md) — phases.
3. [`GOAL.md`](GOAL.md) — compact launcher.
4. [`research/SOURCES.md`](research/SOURCES.md) — provenance.

## Provenance

Graduated 2026-08-17 from
[`explorations/epistemic-belief-view-revision`](../../explorations/epistemic-belief-view-revision/README.md)
as its sole promised-now candidate, after an 8-lane adversarial review
(grok + codex) whose accepted findings are baked into `SPEC.md`.
