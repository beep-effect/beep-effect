# Graph 3D View

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship an InfraNodus-style React 3D knowledge-graph renderer (dark force-directed
3D, community colors, betweenness-proportional distance-faded labels that solve
2D label overlap, curved edges, selection dimming) on our existing
cosmos/ontology rendering stack, integrated into the ontology workbench behind a
2D/3D toggle with cosmos 2D as the default. Target ~2,500 interactive nodes.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/graph-3d-view/GOAL.md
```

`GOAL.md` is the compact launcher (with the binding Fable/codex routing).
`SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher + routing law.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - phases + per-task actor routing.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - clean-room visual spec + integration ledger
   (frozen, reference-only). Start with `bundle-static-analysis.md` (parameter
   spec), `integration-constraints.md` (in-repo seams), `library-landscape-3d.md`
   (stack candidates), `label-anti-overlap.md` (the declutter mechanism).
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P2 Workbench integration — in progress. P0 design gate and P1 generic
component completed 2026-07-16. [`research/DESIGN.md`](./research/DESIGN.md)
(v2, revised against the codex adversarial critique in
[`research/DESIGN-REVIEW.md`](./research/DESIGN-REVIEW.md)) decides stack
(custom instanced three.js driver, `@beep/graph-3d` with `/browser` subpath),
placement, projection contract, worker force layout + Brandes betweenness,
canvas-sprite labels, selection transaction, fixed dark grammar, and toggle UX.

## Latest Evidence

- **P1 FPS probe (2026-07-16, dev machine):** the `Drivers/Graph3D` Storybook
  FPS-probe story reads a sustained **60.0 fps at 2,500 nodes / 5,000 edges**
  (headless Chromium, unmasked AMD Radeon AI PRO R9700, 1280×800). Six-behavior
  story + selection-dimming story verified rendering headless with zero page
  errors; storybook story-tests 3/3 green.
- **P1 `@vitest/browser` suite green (5/5):** mount/node-count, select-dim +
  clear, `onNodeSelect` echo suppression, idempotent destroy + StrictMode
  double-mount, update-replaces-and-resets-selection
  (`packages/drivers/graph-3d/test/browser`, `bun run test:browser`).
- **P0 benchmark** (committed at `scratchpad/graph-3d-bench/`): 2,500 nodes at
  59.3–60.0 avg fps (vsync-capped) at both 5,000 and 12,500 edges; pick
  ≤2.2 ms; full attribute rewrite 2.5–14 ms; clean destroy + double-remount.
  Dev-machine results — the WebKitGTK run at P2 remains the acceptance gate.

## Notes

- Clean-room / reference-only is binding: the visual spec in `research/` is prose
  parameters extracted from the proprietary bundle; no bundle/AGPL code may be
  copied. `rg` audit is an acceptance criterion.
- 2.5k is a benchmark obligation, not a research-proven given — the InfraNodus
  reference only ever displays ~150 nodes. Record the proven ceiling.
- cosmos 2D stays default and must not regress (it also serves the 100k spike).
- Label importance = betweenness centrality (data-confirmed).
