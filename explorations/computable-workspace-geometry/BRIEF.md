# Brief — Computable Workspace Geometry

Stage 3 (shape) artifact. Problem, appetite, sketch, rabbit holes, no-gos.
Decisions feeding this brief are in [`DECISIONS.md`](./DECISIONS.md) (Q1
RATIFIED 2026-07-13: consume/wrap pretext as driver `@beep/pretext`).

## Problem

The workspace-as-data thesis (docs/product/workspace-substrate.md) is proven
in scratchpad but has no importable surface. Text measurement is the last
DOM-oracle dependency in the stack: without a driver, every consumer that
needs a text height (thread virtualization, bubble shrinkwrap, content-aware
dock minimums, layout-as-unit-tests) either re-invents measurement or reaches
back into the browser. The proofs exist (`scratchpad/computable-layout`,
15/15; kernel constraint system consuming pure minimums, 75/75); the missing
piece is the repo-lawful package that makes "shippable sight" a dependency
any package can declare.

## Appetite

One goal packet: the driver alone. No product surface, no app wiring, no
consumer migration. If driver scope starts pulling in consumer work, cut the
consumer, not the driver's proof quality.

## Sketch

`packages/drivers/pretext` → `@beep/pretext`, wrapping the npm package
`@chenglou/pretext` (catalog dependency):

- **Root entrypoint (browser-safe pure surface):** schema contracts
  (`FontMetricsSnapshot` v1 envelope + `EngineProfile`, promoted from
  `scratchpad/computable-layout/FontMetricsV1.schema.ts`), decode/encode
  services, and pure helpers over a decoded snapshot (line counts, heights,
  natural width). No canvas, no DOM, no pretext import at root if pretext's
  pure paths cannot be tree-shaken from its impure ones.
- **`@beep/pretext/browser` (impure capture surface):** typed services over
  `prepare`/`prepareWithSegments`/`layout*` APIs, engine-profile detection,
  snapshot capture (measure → encode → `FontMetricsSnapshot`). Requires
  `Intl.Segmenter` + Canvas 2D; typed error when absent.
- **Test layers:** fixture-backed metrics (the checked-in Chrome/150 capture
  as first fixture) so every consumer tests DOM-free — the thesis expressed
  as testing doctrine.
- **Typed errors:** centralized technical errors per driver law
  (measurement-unavailable, unsupported-font, decode failures).

## Rabbit holes (constraints when graduated)

- Engine-profile drift: pretext UA-sniffs and diverges per engine by design;
  never promise cross-machine determinism — snapshots are per-engine values.
- `system-ui` is unsupported for accuracy on macOS (upstream ledger); the
  driver should reject or warn, not silently mis-measure.
- No server-side backend upstream yet; do not build one — the snapshot value
  IS the server-side story.
- Greedy first-fit only; no justification/Knuth-Plass claims.
- Emoji correction and rich-inline exist upstream; wrap only what goal-1
  consumers need — rich-inline stays out until a consumer demands it.

## No-gos (non-goals when graduated)

- No rebuild or fork of pretext internals (corpus is the asset; revisit
  triggers recorded in DECISIONS.md).
- No product surface in this packet (thread renderer, chat, dock adapter
  wiring are later goals).
- No cross-machine determinism claims anywhere in API docs.
- No block-flow engine ambitions on rich-inline.
