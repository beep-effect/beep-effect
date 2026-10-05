# Design Figure Generation Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Deep-research sweep + align grill (exploration). | `explorations/patent-drawing-pipeline/{RESEARCH,DECISIONS,BRIEF,MAP}.md` exist. |
| P1 Spike: perspective HLR via replicad | pending | Throwaway Bun script: opencascade.js + replicad, box + wedge, orthographic and perspective projected visible edges to SVG. | Result note in `research/`; kernel route for perspective figures fixed. |
| P2 Slice 1: unshaded sheets for the live matter | pending | Schemas (`Matter`, `ModelSpec`, `Figure`, view LiteralKit), `GeometryEngine`/`ProjectionEngine`/`SheetComposer`/`DrawingSheetValidator` contracts, replicad + pdf-tool drivers, `beep drawings render` / `validate`, synthetic fixture + goldens, then the live matter spec under the corpus root. | Acceptance items 2–4. |
| P3 Slice 2: shading, judge rubric, sign-off | pending | `ShadingEngine` (face-exposure hatching through HLR), QA judge drawing rubric, `beep drawings judge` / `sign`, sign-off event schema. | Acceptance item 5. |
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

## Current blockers

- Photos and sketch sheet from the request are not yet saved under the corpus root (manual Outlook download).
- The article has not been measured.
