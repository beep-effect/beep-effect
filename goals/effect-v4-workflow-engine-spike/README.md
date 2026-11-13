# Effect v4 Workflow Engine Spike

## Status

Lifecycle: `paused`

**Paused by operator ruling (finish board, 2026-11-13).** Its only value is gating docketing, which is not in flight; pause it until docketing needs durable workflows. No lane is working on it; resume with `bun run beep goals set-status effect-v4-workflow-engine-spike active` when it is picked up. Decision: [`decisions/2026-11-13-finish-board-ruling-pause.md`](./decisions/2026-11-13-finish-board-ruling-pause.md).

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Prove whether a persistence-backed Effect v4 `WorkflowEngine.makeUnsafe`
adapter can recover one representative workflow across a real process kill and
restart, then hand a documented pass/fail contract to the docketing consumer.

## Launch

```text
/goal follow the instructions in goals/effect-v4-workflow-engine-spike/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative durability and pass/fail contract.
3. [`PLAN.md`](./PLAN.md) - feasibility-first execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited implementation provenance.
6. [`history/`](./history/) - crash proof and handoff evidence, when present.
7. [`effect-orchestration-patterns`](../../explorations/effect-orchestration-patterns/README.md)
   - source exploration and ratified reframe.

## Current Phase

P0 Engine Feasibility Spike — select and justify the persistence store, map the
encoded engine contract to the 14-point durability checklist, and lock the
pass/fail evidence plan before implementation.

## Latest Evidence

Not started.

## Notes

- The workflow namespace is unstable; every Effect upgrade must rerun both the
  compile-time fixture and behavioral kill/restart proof.
- The result feeds `goals/law-docketing-reliability`; this packet does not build
  a product reminder workflow.

## Research corpus attachment (2026-10-06)

[Workflow boundary evidence](./research/RESEARCH-CORPUS-2026-10.md) records source-bound findings and bounded owner-intake candidates. Lifecycle and current execution phase are unchanged; the attachment is an async handoff, not owner consent or proof that an experiment ran.
