# Design Figure Generation Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Deep-research sweep + align grill (exploration). | `explorations/patent-drawing-pipeline/{RESEARCH,DECISIONS,BRIEF,MAP}.md` exist. |
| P1 Spike: perspective HLR via replicad | complete | Throwaway Bun script: opencascade.js + replicad, box + wedge, orthographic and perspective projected visible edges to SVG. | Result note in `research/`; kernel route for perspective figures fixed. |
| P2 Slice 1: unshaded sheets for the live matter | in-progress | Schemas (`ModelSpec`, `FigureSetSpec`, view LiteralKit, omission claims), `GeometryEngine`/`PdfBackend` ports, `FigureSet` service (compose, validate, manifest), `@beep/occt` + `@beep/pdf-tools` drivers, `beep drawings render` / `validate`, synthetic fixture + goldens — DONE 2026-10-05; the live matter spec under the corpus root is OPEN (article unmeasured). | Acceptance items 2–4. |
| P3 Slice 2: shading, judge rubric, sign-off | in-progress | `ShadingEngine` (face-exposure hatching through HLR), QA judge drawing rubric, `beep drawings judge` / `sign`, sign-off event schema. | Acceptance item 5. |
| P4 Yeet: PR to mergeable | pending | Publish through yeet; required checks green; threads answered and resolved. | `merge-ready: yes`; zero unresolved review threads. |
| P5 Close | pending | Closeout reflection; packet state flipped. | Reflection passes `beep lint reflection-artifacts`; README/manifest updated. |

Slices may ship as separate PRs; P4 then repeats per slice and the packet closes after the last.

## P5 Closeout Checklist

1. Write a closeout reflection via `/reflect` to `history/reflections/<YYYY-MM-DD>-<agent>.md`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase statuses + `initiative.status`.

## Execution Notes

- Measure the real article (calipers) and resolve the description-vs-sketch base-geometry disagreement before writing `spec.json`.
- Shared bricks with agentic-cad: check `packages/drivers/` for an OCCT/replicad or compositor package before creating one; whichever packet lands it owns it.
- Claude drafts the CAD code from the spec inside a verify-and-repair loop (render → compare to photos → fix); a human checks every parameter.
- Keep the live matter's spec, code, renders, and sign-off under `BEEP_OPPOLD_CORPUS_ROOT`; commit only hashes of the validator report as evidence.
- Record friction receipts in `research/OPPORTUNITIES.md` as they happen.

## Verification Commands

```sh
test "$(wc -m < goals/design-figure-generation/GOAL.md)" -le 4000
jq . goals/design-figure-generation/ops/manifest.json
rg -n "design-figure-generation|GOAL.md|agentLaunchers|packetAnchorDocument" goals/design-figure-generation
git diff --check -- goals/design-figure-generation
bun run beep lint reflection-artifacts
```

## Progress log

- 2026-10-05 — P1 done: `research/p1-perspective-hlr-spike.md` (perspective HLR works in-process; no build123d fallback). P2 code done on the synthetic fixture: eight sheets, byte-identical across two runs, validator zero findings, negatives (margin, gray, PDF 1.7) each flagged; live test `packages/tooling/tool/cli/test/drawings-live.test.ts` skips where librsvg/poppler are absent. Target Surfaces amended (see SPEC Amendments).

- 2026-10-06 — P3 shading done (`research/p3-shading-spike.md`): `beep drawings render --shade` hatches planar faces by exposure to the 1.84(m) light through the same HLR pass; faces seen square-on stay unshaded (lit threshold 0.55), so plans and elevations remain line drawings and the perspectives carry the contour. Synthetic shaded set: byte-stable across two runs, validator clean, unshaded goldens unchanged. Judge rubric and sign-off remain.

## Current blockers

- Photos and sketch sheet from the request are not yet saved under the corpus root (manual Outlook download).
- The article has not been measured.
