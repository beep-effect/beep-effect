# Packet Convention Migration

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Repair forked packet streams, then migrate every legacy goal manifest onto the
canonical v2 convention with honest genesis events and fleet-wide integrity
reports.

## Launch

```text
/goal follow the instructions in goals/packet-convention-migration/GOAL.md
```

## Read This First

1. [`GOAL.md`](./GOAL.md) — compact execution launcher.
2. [`SPEC.md`](./SPEC.md) — normative contract and acceptance criteria.
3. [`DESIGN.md`](./DESIGN.md) — mutation boundaries and significant symbols.
4. [`PLAN.md`](./PLAN.md) — active phased plan.
5. [`ops/manifest.json`](./ops/manifest.json) — machine-readable routing.
6. [`research/SOURCES.md`](./research/SOURCES.md) — inherited evidence.

## Current Phase

P3 Yeet — implementation and fleet application are complete; drive the
single PR to merge-ready before the same-PR closeout flip.

## Latest Evidence

The fleet apply translated 65 manifests and seeded 65 honest one-event streams.
Its post-apply preview reports zero remaining translations, seeds, issues, or
fleet findings; all 66 opted-in streams pass `beep explore --check`. The full
repo-cli suite passes 2,328 tests.
