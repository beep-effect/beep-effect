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
