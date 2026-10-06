# Turborepo task qualification

## Status

Lifecycle: `completed-retained`

Source: [ops/manifest.json](./ops/manifest.json).
Implementation and pilot acceptance are recorded in [PLAN.md](./PLAN.md).
PR #1389 is merged and accepted. The [October 6 recovery audit](./research/recovery-audit-2026-10-06.md)
records the accepted ordering exception and remaining private-evidence limits.

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

The implementation and named private-profile pilot are complete. PR #1389
merged on October 2, and the operator accepted the documented exception that
final verification finished after the external merge. The implementation lane
was retired. Broad rollout remains adoption's responsibility.

The October 6 audit recovered hash-matching native evidence and reproduced the
adoption bundle. The original proof archive and private acceptance/trust stores
remain unavailable; see the [recovery audit](./research/recovery-audit-2026-10-06.md)
for exactly what can and cannot be independently revalidated.

## Latest evidence

- [Recovery audit and accepted chronology](./research/recovery-audit-2026-10-06.md):
  final merge identity, operator exception, recovered evidence and missing originals.

- [Signed qualification receipt](./research/current-signed-qualification.json):
  native stable/canary matrix, authenticated acceptance and operational promotion.
- [Adoption handoff](./research/adoption-handoff.md) and
  [checked artifact manifest](./research/adoption/manifest.json): complete
  executable/graph-only population, semantic families and invalidation rules.
- [Pre-final-publication acceptance audit](./research/acceptance-2026-10-02.md): requirements,
  evidence boundaries and final publication gates.
- [Closeout reflection](./history/reflections/2026-10-02-codex.md): lessons from
  implementation, native evidence and verification.
- [Quality closeout receipt](./research/quality-closeout-466ec.json): full local
  proof, exact-head hosted readiness and original artifact hashes.

## Notes

P0/P1 can begin immediately when this goal is launched. Conformance and trust
may consume the early qualification contract without waiting for this entire
goal to close. P3 consumes a passing signed-fixture/lab boundary from those
siblings. Do not declare that dependency satisfied from a source-only review.
Continue local fixtures and discovery while remote proof is pending.
