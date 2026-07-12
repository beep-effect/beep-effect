# Computable layout — layout-as-unit-tests, first proof

The smallest end-to-end turn of the loop described in
[`explorations/computable-workspace-geometry/`](../../explorations/computable-workspace-geometry/README.md):

1. **Oracle capture** (impure, once): a live Chrome 150 session measured word
   widths via `OffscreenCanvas.measureText` *and* the DOM's own wrap counts
   via a hidden div, at three container widths. Checked in as
   [`fixture.json`](./fixture.json) — the metrics are a *value*.
2. **Pure layout** ([`layout.ts`](./layout.ts)): a 20-line greedy breaker over
   the cached widths. No DOM, no canvas, no browser.
3. **The test** ([`computable-layout.test.ts`](./computable-layout.test.ts)):
   the arithmetic must reproduce the browser's own line counts exactly
   (200px→3, 320px→2, 480px→2). Layout correctness asserted in CI as math.

Run: `bun test scratchpad/computable-layout` (bun-test scratchpad exemption,
same as `scratchpad/dockview`).

## What this proves / doesn't

- **Proves**: the pipeline — browser-as-oracle → checked-in metrics value →
  layout as an allocation-free pure function, assertable anywhere. This is
  the same shape as pretext's `prepare()`/`layout()` split and the dock
  kernel's geometry projection; the fixture is per-engine (Chrome 150/Linux),
  which is the honest scope of "what does the user see".
- **Doesn't**: real segmentation, glue/kinsoku, punctuation merge, bidi,
  emoji correction, engine profiles — that is pretext's job
  (`~/YeeBois/dev/pretext`, MIT, 7680/7680 vs three browsers). The
  integration-seam question (consume vs vendor vs rebuild) is open in the
  exploration packet; this proof is seam-agnostic.

Next steps live in the packet's `ops/manifest.json` open questions.
