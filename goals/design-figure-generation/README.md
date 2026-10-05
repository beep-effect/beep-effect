# Design Figure Generation

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Turn a measured matter spec into eight USPTO design-patent figures from one
parametric solid: hidden-line views, 37 CFR 1.84 sheets, a validator, a
vision-judge rubric, and a recorded attorney sign-off, operated as
`bun run beep drawings …` on the developer workstation.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/design-figure-generation/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger (inherited from the exploration).
6. [`../../explorations/patent-drawing-pipeline/`](../../explorations/patent-drawing-pipeline/) - source exploration: BRIEF, DECISIONS, MAP.
7. [`../agentic-cad-patent-tooling/`](../agentic-cad-patent-tooling/) - sibling goal owning the OCCT driver, 1.84 compositor (P5), and CAD domain.

## Current Phase

P2 — slice 1. P1 passed: perspective hidden-line removal works in Bun through
the WASM `HLRAlgo_Projector(CS, focus)` overload, so no build123d fallback is
needed. Next concrete action: schema first (`Matter`, `ModelSpec`, `Figure`,
view-name `LiteralKit`), then the `GeometryEngine`/`ProjectionEngine`
contracts, then the replicad driver package via `bun run beep create-package`.
Blocked for the live matter until the article is measured and its photos sit
under the corpus root; the synthetic fixture is not blocked.

## Latest Evidence

[`research/p1-perspective-hlr-spike.md`](./research/p1-perspective-hlr-spike.md) (2026-10-05).

## Notes

- Real matter material (spec, photos, CAD code, renders, PDFs, sign-off
  events) lives only under `BEEP_OPPOLD_CORPUS_ROOT`
  (`~/data-home/oppold-corpus`); the repo carries a synthetic fixture article.
- Shared bricks with agentic-cad are owned by whichever packet lands them
  first (`packages/drivers/*` per its D7); never duplicated.
- The live matter's description and sketch disagree on a base-geometry
  detail; measure the article before modelling.
