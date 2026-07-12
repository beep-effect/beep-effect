# Computable Workspace Geometry — pretext × dock kernel × blocks

## Status

Stage: `research`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Text measurement was the last thing on the web that forced the DOM to be a
layout *oracle* instead of a *projection target*. Cheng Lou's
[pretext](https://github.com/chenglou/pretext) deletes that fact — text layout
becomes pure arithmetic over cached widths. Composed with the dock kernel
(space = pure function of schema) and blocks (content = schema), the entire
workspace render becomes computable headlessly: every panel box, block height,
and line break from data. Agents gain *sight*.

## Next Open Question

Ratify Q1 in [`DECISIONS.md`](./DECISIONS.md): the seam recommendation
(consume/wrap pretext, schema-wrap the boundary only — the corpus is the
asset, not the architecture) is written with full rationale and revisit
triggers, awaiting Ben's yes/no. Then Q2: grow the draft
`FontMetricsSnapshot` into the real versioned contract.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump: the story, both scratch rambles, the dragon demo.
3. [`RESEARCH.md`](./RESEARCH.md) - pretext technical map, the isomorphism, the cost audit.

## Trail

- 2026-07-12 (overtime): per-group minimums landed in the kernel —
  `GroupMinimumLookup` + `requiredExtent` (sum along axis + gap, max across
  axes; kernel 72/72, adapter 17/17) — and the **full-circle proof** landed:
  `scratchpad/computable-layout/full-circle.test.ts` imports the real kernel
  and proves metrics → naturalWidth → minimum lookup → `project()` →
  guaranteed one-line render, with the starvation counter-case. §5 of the
  substrate doc synced ("unwritten pure math" → partially written). Also
  fixed pre-existing `describe.concurrent` race in adapter Floating suite.
- 2026-07-12 (finale): TWO promotions from proof to matter. (1) The dock
  kernel itself gained `GeometryOptions.minGroupExtent` — per-split-local
  minimum-extent clamp in the pure geometry projection (feasible → both
  sides guaranteed; infeasible → proportional; default 0 behavior-identical;
  kernel 69/69, tsgo+biome clean) — first WHAT-IS-LEFT constraint item
  partially retired by exploration math. (2) Q2 v1 landed:
  `FontMetricsV1.schema.ts` versioned envelope + `EngineProfile`
  (computable-layout 13/13). Next session: ratify Q1 seam, then per-group
  minimum maps in geometry (feeding naturalWidth-style metrics), then v2
  contract residue.

- 2026-07-12 (later, same session — the genesis context's last 7%): first
  proof LANDED at [`scratchpad/computable-layout`](../../scratchpad/computable-layout/README.md) —
  live-Chrome oracle fixture (canvas widths + DOM wrap counts), 20-line pure
  greedy breaker, 8/8 under `bun test`: arithmetic reproduces the browser's
  own line counts at all three widths, AND the metrics cache round-trips
  through a first-draft effect `FontMetricsSnapshot` codec
  ([`FontMetrics.schema.ts`](../../scratchpad/computable-layout/FontMetrics.schema.ts)) —
  "shippable sight" is now typed matter, not prose. `DECISIONS.md` pre-seeded:
  Q1 seam recommendation written (consume/wrap; corpus-is-the-asset
  rationale; revisit triggers), Q3 partially closed by the proof.
  ATLAS.md entry added. Q3 residue: next consumer (virtualization vs
  shrinkwrap vs dock constraints).

- 2026-07-12: packet opened directly at research (capture + research landed
  same session). Firsthand reads: pretext README/thoughts/RESEARCH/AGENTS/
  measurement.ts; Explore-agent full technical map; dragon-reflow demo
  screenshotted live. Synthesis + divergence-cost audit written to
  RESEARCH.md; `docs/product/workspace-substrate.md` gained §4 "agents that
  can see" subsection and reframed §5 costs language the same day.
  ATLAS.md not yet updated (token budget); add the map line next session.
