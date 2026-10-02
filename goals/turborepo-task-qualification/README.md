# Turborepo task qualification

## Status

Lifecycle: `active`

Source: [ops/manifest.json](./ops/manifest.json).
Launched and in progress; see [PLAN.md](./PLAN.md) for resume
conditions and milestone dependencies.

## Mission

Make cache reuse an enforced, evidence-backed contract for each quality computation, reuse layer, environment profile and epoch.

## Launch

```text
/goal follow the instructions in goals/turborepo-task-qualification/GOAL.md
```

[GOAL.md](./GOAL.md) is the launcher; [SPEC.md](./SPEC.md) is normative.

## Read this first

1. [SPEC.md](./SPEC.md) and [PLAN.md](./PLAN.md).
2. [Source ledger](./research/SOURCES.md).
3. [Approved exploration](../../explorations/turborepo-quality-cache/README.md) and [program map](../../explorations/turborepo-quality-cache/MAP.md).
4. [Manifest](./ops/manifest.json), [friction ledger](./research/OPPORTUNITIES.md)
   and [history](./history/).

## Current phase

Final verification and closeout. The real signed pilot qualified in its named
private-loopback profile at frozen source `93a19425da`; the public adoption
handoff is published in PR #1389. Broad rollout remains adoption's responsibility.

The goal remains active until full local proof, final-head hosted checks, review
closure and same-PR lifecycle closeout pass. See the current checkpoint at the
top of [PLAN.md](./PLAN.md); dated checkpoints below it retain historical scope.

## Latest evidence

- [Signed qualification receipt](./research/current-signed-qualification.json):
  native stable/canary matrix, authenticated acceptance and operational promotion.
- [Adoption handoff](./research/adoption-handoff.md) and
  [checked artifact manifest](./research/adoption/manifest.json): complete
  executable/graph-only population, semantic families and invalidation rules.
- [Current acceptance audit](./research/acceptance-2026-10-02.md): requirements,
  evidence boundaries and remaining verification.
- [Closeout reflection](./history/reflections/2026-10-02-codex.md): lessons from
  implementation, native evidence and verification; final readiness is pending.

## Notes

P0/P1 can begin immediately when this goal is launched. Conformance and trust
may consume the early qualification contract without waiting for this entire
goal to close. P3 consumes a passing signed-fixture/lab boundary from those
siblings. Do not declare that dependency satisfied from a source-only review.
Continue local fixtures and discovery while remote proof is pending.
