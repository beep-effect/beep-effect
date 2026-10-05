# Design Figure Generation Spec

## Objective

A developer runs `bun run beep drawings render --spec <spec.json> --out <dir>`
and receives a set of Letter (or A4) PDF sheets, one figure per sheet, for a
design-patent application: top and bottom perspective, top and bottom plan,
front, rear, left and right elevations, all projected from one parametric
B-rep solid built from the spec; `bun run beep drawings validate` proves the
sheets satisfy 37 CFR 1.84 and the Patent Center PDF rules; `beep drawings
judge` runs the existing QA vision judge with a drawing rubric; `beep
drawings sign` records the attorney's sign-off keyed to the sheet-set hash.
Slice 1 ships unshaded figures for the live matter; slice 2 adds 37 CFR 1.152
surface shading, the judge rubric, and the sign-off event.

## Non-Goals

- Image-model figure generation of any kind (diffusion, image-to-3D, raster tracing).
- Photos→CAD on-ramp and email/attachment intake (gated candidates in the exploration MAP).
- A desktop-app surface or Windows packaging (agentic-cad P7; gated candidate).
- Utility-patent reference-numeral grammar (agentic-cad P5 owns it).
- A sheet-metal fold feature; tabs are rotated solids, score lines are grooves or added edges.
- Replacing the illustrator for freeform/organic articles.
- Real article geometry, photos, or renders in the repository.

## Source Hierarchy

1. User objective that created this packet (the 2026-10-05 drawing request).
2. `AGENTS.md`, `CLAUDE.md`, and required skills (effect-first-development,
   schema-first-development, yeet).
3. `standards/ARCHITECTURE.md`, `standards/architecture/03-driver-boundaries.md`,
   `07-non-slice-families.md`; `goals/agentic-cad-patent-tooling/SPEC.md` D6–D8.
4. This `SPEC.md`, which carries the exploration's eight decisions
   (`explorations/patent-drawing-pipeline/DECISIONS.md`) as its contract; a
   decision that conflicts with a higher source is reopened, not followed.
5. `PLAN.md`.
6. `GOAL.md`.
7. `research/`, `ops/`, `history/`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/drivers/<occt-or-replicad>` — geometry kernel + HLR wrapper (shared with agentic-cad; create via `bun run beep create-package`).
- `packages/drivers/<pdf-tools>` — `rsvg-convert` / `qpdf` / `pdftoppm` wrappers in the `@beep/ffmpeg` shape (`effect/process`).
- `packages/law-practice/domain` (+ `use-cases`, `server`) — `Matter`, `ModelSpec`, `Figure`, view-name `LiteralKit`, validator findings, sign-off event; pipeline service composition.
- `packages/tooling/tool/cli/src/commands/Drawings/` — `render`, `validate`, `judge`, `sign`.
- `packages/tooling/tool/cli/src/commands/Qa/` — drawing rubric extension of the qa-inventory/v1 judge.
- Synthetic fixture article + golden sheets under the owning package's `test/`.

## Constraints

- Design order: schema → `Context.Service` contract → implementation. Effect v4 only; `effect/process` for subprocesses; `LiteralKit` for the view domain; `HashMap`/`HashSet` never `Map`/`Set`.
- Kernel: replicad over opencascade.js in-process; build123d (pixi-pinned) only behind the same service contract as a fallback for figures the spike cannot produce.
- Each figure carries its own description sentence; the 1:1 FIG↔description rule is a decode-time invariant. Omission statements ("rear identical to front") are typed claims proven by render diff.
- Sheets: A4 or Letter, all alike; margins ≥ top 2.5 cm, left 2.5 cm, right 1.5 cm, bottom 1.0 cm; no frame; pure black uniform-width strokes; text ≥ 0.32 cm, outlined; "FIG. n" consecutive from 1; "n/N" top centre; no hidden lines, no reference numerals, no solid black, stipple and line shading never on one face.
- PDF 1.1–1.6, fonts embedded, no layers/annotations/encryption, rasters ≥ 300 dpi. Validator has a structural tier and a raster tier (300 and 600 dpi ink bounding box vs. margins; B/W only).
- Raster-tier colour rule: render with anti-aliasing disabled (`pdftoppm -aa no -aaVector no`, or the pdfjs equivalent) so vector edges land as pure black or white; then every pixel must have zero chroma and a luminance of exactly 0 or 255. Any other pixel is a finding. A gray stroke, a gray fill, or an embedded grayscale image survives a non-anti-aliased render as gray and fails; a black vector stroke cannot produce gray and passes. The pure-B/W rule is therefore defined on the non-anti-aliased render only; the anti-aliased 300 dpi render is used for the ink-bounding-box margin measurement, never for colour.
- Reproducibility: outlined text, rounded/sorted SVG coordinates, PDF dates stripped or from `SOURCE_DATE_EPOCH`, seeded jitter, WASM pinned by hash, pixi lockfile committed; `manifest.json` records spec, toolchain, per-figure, and PDF hashes plus the validator report.
- Licensing: MuPDF.js (AGPL) is never linked; opencascade.js (LGPL) is linked, not vendored; ported code carries attribution per `research/SOURCES.md`.
- Data: real matter inputs/outputs only under `BEEP_OPPOLD_CORPUS_ROOT`; the repo holds a synthetic fixture.
- Attorney sign-off is a recorded event (who, when, sheet-set hash) — the 37 CFR 11.18(b) / 89 FR 25614 "reasonable inquiry". `--by` is descriptive metadata, never proof. The event must carry a `confirmation` reference to an artifact the attorney authored — an email reply identified by Internet Message-ID, or an initialed PDF stored under the corpus root — and `drawings sign` refuses to write the event unless that artifact contains, on a line of its own, the exact approval statement the CLI prints for that sheet set: `I approve design-figure sheet set <sheet-set-hash> for filing.` A hash quoted in any other sentence (a question, a rejection, a forwarded thread) is not approval and is refused; the match is the whole line, verbatim, so the check never interprets prose. The event stores the artifact's locator and its own content hash alongside the sheet-set hash.

## Acceptance Criteria

- [ ] P1 spike result recorded in `research/`: perspective HLR via replicad works, or the build123d fallback is wired for perspective figures.
- [ ] `beep drawings render` on the synthetic fixture produces eight sheets whose hashes match committed goldens on two consecutive runs.
- [ ] `beep drawings validate` returns zero findings on those sheets and non-zero findings on a deliberately broken fixture (margin, gray pixel, PDF 1.7).
- [ ] The live matter's eight unshaded sheets render from a spec under the corpus root and pass the validator (evidence: validator report hash in `history/`, no sheets committed).
- [ ] Slice 2: shaded sheets pass the validator; the judge rubric produces a schema-valid qa-inventory; a sign-off event is written and re-read, and `drawings sign` refuses both a confirmation artifact without the sheet-set hash and one that quotes the hash without the verbatim approval line, such as a rejection (negative tests).
- [ ] `bun run beep quality package-verify` passes for every touched package.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/design-figure-generation/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/design-figure-generation/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/design-figure-generation` | Passes |
| Golden sheets | package test on the synthetic fixture | Hashes stable across two runs |
| Validator negative cases | package test with broken fixtures | Each defect reported |
| Package handoff | `bun run beep quality package-verify <pkg>` per touched package | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Passes at P5 |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy approval not named in this spec.
- The same blocker repeats after reasonable investigation.
- Any step would commit real article geometry, photos, or renders to the repo.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
