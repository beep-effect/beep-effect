# Effect Orchestration Patterns

## Status

Stage: `graduate`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Prove the repo's vendored Effect v4 workflow subsystem can provide durable,
restart-safe orchestration for the first malpractice-grade docketing consumer
without duplicating it, while extending official-source HTTP resilience through
the already-promoted `@beep/api-transport`.

## Sources & Provenance

The dated current capability inventory is in [`RESEARCH.md`](./RESEARCH.md).
The original gold corpus, licenses, external citations, and June research trail
remain in [`research/SOURCES.md`](./research/SOURCES.md) as provenance.

## Next Open Question

The immediate spike has graduated. Resume only when one of four demand triggers
fires: a measured failure survives limiter/retry/workflow/monitoring; a second
fan-out consumer proves congruent semantics; a runtime must select compatible
providers; or a second `ExecutionPlan` consumer proves matching LLM retry
semantics. See [`MAP.md`](./MAP.md).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) — machine state and open question.
2. [`DECISIONS.md`](./DECISIONS.md) — 2026-07-14 locked reframe and gated deferrals.
3. [`RESEARCH.md`](./RESEARCH.md) — refreshed workflow and transport inventories.
4. [`BRIEF.md`](./BRIEF.md) — ratified shaped pitch.
5. [`MAP.md`](./MAP.md) — first goal, demand gates, and consumer cross-links.
6. [`CAPTURE.md`](./CAPTURE.md) — append-only original dump.

## Trail

- 2026-07-14: BRIEF ratified as drafted; graduated only [`effect-v4-workflow-engine-spike`](../../goals/effect-v4-workflow-engine-spike/README.md); four candidates remain demand-gated and status stays active.
- 2026-07-14: research refreshed against v4 workflow + api-transport; reframe ratified; 4 decisions + 4 gated deferrals.
- 2026-06-29: research-complete — RESEARCH.md synthesized, codex gate-1 folded, DECISIONS pre-drafted.
- 2026-06-29: packet opened from gold-intake cluster 'Effect orchestration patterns (Schedule, Layer provider, bounded fan-out)' (8 nuggets).
