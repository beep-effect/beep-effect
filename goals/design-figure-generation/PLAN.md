# Design Figure Generation Plan

## Status

Status: `complete`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Deep-research sweep + align grill (exploration). | `explorations/patent-drawing-pipeline/{RESEARCH,DECISIONS,BRIEF,MAP}.md` exist. |
| P1 Spike: perspective HLR via replicad | complete | Throwaway Bun script: opencascade.js + replicad, box + wedge, orthographic and perspective projected visible edges to SVG. | Result note in `research/`; kernel route for perspective figures fixed. |
| P2 Slice 1: unshaded sheets for the live matter | complete | Schemas (`ModelSpec`, `FigureSetSpec`, view LiteralKit, omission claims), `GeometryEngine`/`PdfBackend` ports, `FigureSet` service (compose, validate, manifest), `@beep/occt` + `@beep/pdf-tools` drivers, `beep drawings render` / `validate`, synthetic fixture + goldens — DONE 2026-10-05; the live matter spec under the corpus root is OPEN (article unmeasured). | Acceptance items 2–4. |
| P3 Slice 2: shading, judge rubric, sign-off | complete | `ShadingEngine` (face-exposure hatching through HLR), QA judge drawing rubric, `beep drawings judge` / `sign`, sign-off event schema. | Acceptance item 5. |
| P4 Yeet: PR to mergeable | complete | Publish through yeet; required checks green; threads answered and resolved. | `merge-ready: yes`; zero unresolved review threads. |
| P5 Close | complete | Closeout reflection; packet state flipped. | Reflection passes `beep lint reflection-artifacts`; README/manifest updated. |

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
- 2026-10-06 — P3 sign-off done: `beep drawings statement` prints the line to request; `beep drawings sign email|pdf` records `approval.json` next to the manifest only when the approver's own artifact carries the statement verbatim on a line above any reply/forward boundary (email: `from` and `sender` equal the approver, plain-text `uniqueBody` via the new `@beep/m365` `getMessageAuthoredText`; PDF: the initialed page under the corpus root, operator-attested delivery). The PDF on disk is re-hashed against the manifest first. Refusals covered: no hash, rejection/question quoting the hash, statement only below a reply/forward boundary, statement only on a non-initialed page, PDF outside the corpus root, wrong sender, edited PDF. - 2026-10-06 — P3 judge done: `beep drawings judge` builds a round pack (sheet PNGs, reference photos, drawing-rubric prompt); `judge-ingest` admits only a schema-valid `qa-inventory/v1` with drawing lenses and in-pack evidence. Two synthetic rounds were run (`history/judge-synthetic/`): round 1 found 2 P2s; R1-02 was fixed (minimum pitch 1.2 mm), and R1-01/R2-01 (cylindrical shading) is a carried follow-up. Decisions are in SPEC "Decision Log". #1439 is final for code; the live-matter render remains.
- 2026-10-06 — Live matter done: inputs saved under the corpus root by the operator; spec modelled from the sketch (nominal proportions, ruling in the SPEC Decision Log); unshaded and shaded sets render byte-identically twice and pass the validator; two live judge rounds ingested as schema-valid inventories. Hashes in `history/live-matter/evidence.json`. The live render exposed two `@beep/occt` defects, fixed with regression tests: seam edges between coplanar faces after a fuse, and hatch lines crowding on foreshortened faces.
- 2026-10-06 — P5 Close: reflection `history/reflections/2026-10-06-claude.md`; manifest and README flipped to `completed-retained`.

## Current blockers

None. The attorney sign-off on the live shaded set is an operating step outside this packet: run `beep drawings statement`, then `beep drawings sign` on the reply.
