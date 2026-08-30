# Packet Convention Migration

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Repair forked packet streams, then migrate every legacy goal manifest onto the
canonical v2 convention with honest genesis events and fleet-wide integrity
reports.

## Retained Regression Entry Point

```text
/goal follow the instructions in goals/packet-convention-migration/GOAL.md
```

## Read This First

1. [`GOAL.md`](./GOAL.md) — retained closeout and read-only regression guidance.
2. [`SPEC.md`](./SPEC.md) — normative contract and acceptance criteria.
3. [`DESIGN.md`](./DESIGN.md) — mutation boundaries and significant symbols.
4. [`PLAN.md`](./PLAN.md) — terminal execution and recovery record.
5. [`ops/manifest.json`](./ops/manifest.json) — machine-readable routing.
6. [`research/SOURCES.md`](./research/SOURCES.md) — inherited evidence.

## Current Phase

Closed through the operator-authorized D27 recovery exception. Implementation
shipped in PR #855, but that PR merged before the same-PR P4 reflection and
state flip and did not retain a strict final-head Yeet closeout. The recovery
PR restored the canonical empty-preview proof, recorded the historical gap,
and carried this packet to `completed-retained`.

## Latest Evidence

PR #855 merged the fork-repair applier, convention translator, fleet lint, and
genesis seeder at implementation head
`94c7966fa18c5482b6445b5f0ead558822ba866e`. The migration translated 65
manifests, seeded 65 honest streams, and reported no remaining translations,
seeds, issues, or fleet findings. All 17 review threads were resolved.

The implementation PR is not described as exact-head merge-ready: its final
wave had failures in Fallow Advisory Envelopes and Vercel, while Greptile ended
without a score. D27 authorized the separate recovery PR that repaired and
re-proved the canonical empty preview, supplied the required Codex reflection,
and reconciled the goal and parent exploration. Current main already superseded
the historical Fallow hotspot through commit `2ce7525d5a`.
