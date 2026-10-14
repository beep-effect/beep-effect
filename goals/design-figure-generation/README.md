# Design Figure Generation

## Status

Lifecycle: `completed-retained`

Latest evidence: the live matter's unshaded and shaded sheet sets pass the validator; hashes in [`history/live-matter/evidence.json`](./history/live-matter/evidence.json). Reflection: [`history/reflections/2026-10-06-claude.md`](./history/reflections/2026-10-06-claude.md).

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Turn a measured matter spec into eight USPTO design-patent figures from one
parametric solid: hidden-line views, 37 CFR 1.84 sheets, a validator, a
vision-judge rubric, and a recorded attorney sign-off, operated as
`bun run beep drawings render` and its sibling commands on the developer workstation.

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
8. [`../design-figure-review-loop/`](../design-figure-review-loop/) - successor: the attorney's round-1 review and the review loop.

## Current Phase

Closed (`completed-retained`, 2026-10-06). The attorney reviewed the live sheets on 2026-10-10;
that review, the round-2 render, mailbox intake and review rounds are carried by the successor
[`goals/design-figure-review-loop`](../design-figure-review-loop/). Do not reopen this packet for
them.

## Latest Evidence

- 2026-10-05 — `research/p1-perspective-hlr-spike.md`: perspective HLR
  through the opencascade.js `HLRAlgo_Projector(gp_Ax2, focus)` binding.
- 2026-10-05 — synthetic bracket: 8 sheets, two consecutive renders share
  sheet-set sha256, validator clean; margin / gray / PDF 1.7 negatives
  flagged (`packages/tooling/tool/cli/test/drawings-live.test.ts`).
- 2026-10-06 — `research/p3-shading-spike.md`: straight-line shading built on
  the model's faces and hidden by the same HLR pass; `--shade` renders the
  synthetic set byte-stably and validator-clean.

## Notes

- Real matter material (spec, photos, CAD code, renders, PDFs, sign-off
  events) lives only under `BEEP_OPPOLD_CORPUS_ROOT`
  as a configured external corpus root; the repo carries a synthetic fixture article.
- Shared bricks with agentic-cad are owned by whichever packet lands them
  first (`packages/drivers/*` per its D7); never duplicated.
- The live matter was modelled from the request sketch with nominal proportions (SPEC Decision
  Log 2026-10-06); caliper measurement was ruled unnecessary because the description states the
  design is scale-independent.
