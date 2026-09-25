# Repository freshness audit

## Status

Lifecycle: `paused`

Source: [ops/manifest.json](./ops/manifest.json)

This is an execution-capable campaign whose audit has not started. The current
delivery is its researched planning packet and docs-only PR. Publishing that
packet does not complete or activate the audit.

## Mission

Account for repository knowledge, verify its claims against explicit sources,
reconcile remote-derived skills without losing local adaptations, and prove
targeted repairs. This campaign extends the semantic coverage of
[knowledge-surface-automation](../knowledge-surface-automation/SPEC.md) and
inherits that initiative's ratified decisions. Its broader graph, bootstrap,
warehouse, and scheduling roadmap remains with that initiative.

## Launch and resume conditions

After the operator explicitly activates the audit, use:

```text
/goal follow the instructions in goals/knowledge-freshness-audit/GOAL.md
```

Activation opens P1 reporting and implementation of read-only audit tooling.
Mutation of audited content requires the corresponding concrete report and
recorded false-positive review. The separately authorized Jev experiment is
bounded to $5 during audit execution; no API trial belongs in P0.

## Reading order

1. [SPEC.md](./SPEC.md): normative scope, authority, and completion contract.
2. [PLAN.md](./PLAN.md): phases and execution sequence.
3. [GOAL.md](./GOAL.md): compact launcher.
4. [Sources](./research/SOURCES.md) and [census](./research/surface-census.md).
5. [Decisions](./research/decisions.md) and [record contracts](./research/evidence-contract.md).
6. [Acceptance matrix](./research/acceptance-matrix.md) and
   [delivery record](./history/packet-delivery.md).

## Current phase

P0 delivered this reviewed packet in [PR #1218](https://github.com/beep-effect/beep-effect/pull/1218).
The delivery history records the observed merge-ready checkpoint. P1-P5 remain
pending while the campaign is paused.
The first execution action is to refresh the census at a recorded Git revision
and check the parent initiative's current capabilities before adding tooling.

## Evidence

The baseline census at commit b007ddd5a0df7fab0c9fbabc4c9f1b434b5f6a98 contains
28,396 tracked entries. This is an inventory observation, not proof of freshness.
The [delivery record](./history/packet-delivery.md) separates validation receipts
from future audit acceptance.
