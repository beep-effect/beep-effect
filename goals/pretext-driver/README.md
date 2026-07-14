# Pretext Driver (@beep/pretext)

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Outcome (2026-07-14)

Shipped as specced and merged: PR #391 (squash `1c0977ccad`, merged
2026-07-14) landed `@beep/pretext` at `packages/drivers/pretext` — pure root
(FontMetricsSnapshotV1 contracts, typed codecs, greedy layout helpers),
`/browser` capture with typed capability failures, fixture test layers,
centralized errors, zero product surface. Proofs at close: 20 vitest + 1
skipped (live canvas), docgen examples green, scratchpad full-circle proof
17/17 against the shipped surface. A full quality-review-fix-loop ran before
merge (crispen `f9598694f8`, panel fixes `35b9710c95`, round-2 clean).
Reflection:
[`history/reflections/2026-07-14-claude.md`](./history/reflections/2026-07-14-claude.md).

## Mission

Wrap `@chenglou/pretext` as the repo driver `@beep/pretext`: text
measurement as a typed, schema-first capability. Browser-safe pure root
(FontMetricsSnapshot contracts + pure layout helpers over decoded
snapshots), `@beep/pretext/browser` capture surface, fixture-backed test
layers so every consumer tests DOM-free, centralized typed technical
errors. Zero product surface — the driver alone.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/pretext-driver/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`research/SOURCES.md`](./research/SOURCES.md) - pointer set into the
   parent exploration and upstream.

## Provenance

Graduated 2026-07-13 from
[`explorations/computable-workspace-geometry`](../../explorations/computable-workspace-geometry/README.md)
(goal #1 of its MAP). The workspace-as-data canon this serves:
[`docs/product/workspace-substrate.md`](../../docs/product/workspace-substrate.md).
