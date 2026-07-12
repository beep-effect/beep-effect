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

Integration seam: consume `@chenglou/pretext` as a dependency, vendor it, or
rebuild effect-native — the same fork we faced with dockview, but the calculus
may differ (pretext is MIT, zero-dep, and its value is a *validated corpus*,
not just code).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump: the story, both scratch rambles, the dragon demo.
3. [`RESEARCH.md`](./RESEARCH.md) - pretext technical map, the isomorphism, the cost audit.

## Trail

- 2026-07-12: packet opened directly at research (capture + research landed
  same session). Firsthand reads: pretext README/thoughts/RESEARCH/AGENTS/
  measurement.ts; Explore-agent full technical map; dragon-reflow demo
  screenshotted live. Synthesis + divergence-cost audit written to
  RESEARCH.md; `docs/product/workspace-substrate.md` gained §4 "agents that
  can see" subsection and reframed §5 costs language the same day.
  ATLAS.md not yet updated (token budget); add the map line next session.
