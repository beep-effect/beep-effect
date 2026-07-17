# Graph 3D View

## Status

Lifecycle: `completed-retained` (closed 2026-07-16; shipped via the
`feat/graph-3d-view` PR)

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

Closed. All phases completed 2026-07-16; closeout reflection at
[`history/reflections/2026-07-16-claude.md`](./history/reflections/2026-07-16-claude.md).
[`research/DESIGN.md`](./research/DESIGN.md) (v2, revised against the codex
adversarial critique in [`research/DESIGN-REVIEW.md`](./research/DESIGN-REVIEW.md))
decides stack (custom instanced three.js driver, `@beep/graph-3d` with
`/browser` subpath), placement, projection contract, worker force layout +
Brandes betweenness, canvas-sprite labels, selection transaction, fixed dark
grammar, and toggle UX.

## Latest Evidence

- **P2 WebKitGTK acceptance (2026-07-16):** the `?graph3d-spike` surface in
  professional-desktop read **60.0 fps at 2,500 nodes / 5,000 edges / 90
  labels on WebKitGTK 2.52.5** (system webkit2gtk-4.1 MiniBrowser — the engine
  Tauri links on this machine). Chromium spike: 56–60 fps with a 20×
  full-update stress pass at avg 6.3 ms / worst 11.5 ms.
- **P2 toggle integration test green** (`packages/ontology/client/test/browser`,
  `bun run test:browser`): cosmos mounts by default, the toggle swaps to the
  3D renderer and back, selection + projection updates flow through the
  bridge with no errors. Cosmos driver diff vs main: empty. Known limitation
  recorded: full-document browser QA is blocked by the pre-existing
  chat-only dev-token wiring; the integration test covers that seam instead.
- **P1 FPS probe (dev machine):** the `Drivers/Graph3D` Storybook FPS-probe
  story reads a sustained **60.0 fps at 2,500 nodes / 5,000 edges** (headless
  Chromium, unmasked AMD Radeon AI PRO R9700). Six-behavior + selection-dimming
  stories verified headless, zero page errors; storybook story-tests 3/3 green.
- **P1 `@vitest/browser` suite green (5/5):** mount/node-count, select-dim +
  clear, `onNodeSelect` echo suppression, idempotent destroy + StrictMode
  double-mount, update-replaces-and-resets-selection
  (`packages/drivers/graph-3d/test/browser`, `bun run test:browser`).
- **P0 benchmark** (committed at `scratchpad/graph-3d-bench/`): 2,500 nodes at
  59.3–60.0 avg fps (vsync-capped) at both 5,000 and 12,500 edges; pick
  ≤2.2 ms; full attribute rewrite 2.5–14 ms; clean destroy + double-remount.

## Notes

- Clean-room / reference-only is binding: the visual spec in `research/` is prose
  parameters extracted from the proprietary bundle; no bundle/AGPL code may be
  copied. `rg` audit is an acceptance criterion.
- 2.5k is a benchmark obligation, not a research-proven given — the InfraNodus
  reference only ever displays ~150 nodes. Record the proven ceiling.
- cosmos 2D stays default and must not regress (it also serves the 100k spike).
- Label importance = betweenness centrality (data-confirmed).
