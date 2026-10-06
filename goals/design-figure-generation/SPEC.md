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
   `07-non-slice-families.md`; `goals/agentic-cad-patent-tooling/SPEC.md` D6–D9, including its
   scoped D9 exception for this goal (see Exception Ledger).
4. This `SPEC.md`, which carries the exploration's eight decisions
   (`explorations/patent-drawing-pipeline/DECISIONS.md`) as its contract; a
   decision that conflicts with a higher source is reopened, not followed.
5. `PLAN.md`.
6. `GOAL.md`.
7. `research/`, `ops/`, `history/`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

Amended 2026-10-05 (operator decision, see Amendments): the pipeline is a
product-neutral foundation capability, not law-practice slice code, because
`standards/ARCHITECTURE.md` forbids `packages/tooling/*` from depending on a
product slice and the operator command lives in the tooling CLI.

- `packages/drivers/occt` (`@beep/occt`) — replicad / opencascade.js solid construction and exact hidden-line projection, orthographic and perspective (shared with agentic-cad per its D7).
- `packages/drivers/pdf-tools` (`@beep/pdf-tools`) — `rsvg-convert` and poppler `pdftoppm` wrappers in the `@beep/ffmpeg` shape (`effect/process`), pdf-lib page merge at a pinned version and date, structure inspection, non-anti-aliased raster metrics.
- `packages/foundation/capability/technical-drawing` (`@beep/technical-drawing`) — `ModelSpec`, `FigureSetSpec`, view-name `LiteralKit`, omission claims, sheet rules and composition, validator findings, render manifest, and (slice 2) the approval record keyed to the sheet-set hash, behind a `GeometryEngine` port and a `PdfBackend` port.
- `packages/law-practice/domain` — only Matter-bound meaning, when a slice flow needs it (slice 1 touches no law-practice package).
- `packages/tooling/tool/cli/src/commands/Drawings/` — `render`, `validate` (slice 1); `judge`, `sign` (slice 2); the port adapters over the two drivers live here.
- `packages/tooling/tool/cli/src/commands/Qa/` — drawing rubric extension of the qa-inventory/v1 judge.
- `packages/drivers/m365` — a dedicated read-only verb for sign-off verification (slice 2; no intake). Graph returns `uniqueBody` only when it is explicitly `$select`ed, and `getMessage` (`M365.service.ts`) sends no query parameters, so the new verb requests `messages/{id}?$select=uniqueBody,from,sender,internetMessageId,receivedDateTime` and decodes its own response schema. Graph returns `uniqueBody` as HTML by default, so the verb also sends `Prefer: outlook.body-content-type="text"` (the driver's request builder sets only the bearer token today) and refuses any response whose `uniqueBody.contentType` is not `text`; the whole-line match is defined over that plain text only, never over stripped HTML. `getMessage` and the `GraphMessage` schema stay untouched, because `GraphMessage` is also the success schema of the `@beep/m365-mcp` read tool (`M365Tools.ts`) and `$select` would shrink that payload.
- Synthetic fixture article under `packages/foundation/capability/technical-drawing/test/fixtures/`; golden SVG hashes and the live end-to-end test under `packages/tooling/tool/cli/test/` (the adapters live there). PDF bytes depend on the installed cairo, so the PDF golden is two-run equality, not a committed hash.

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
- Attorney sign-off is a recorded event (who, when, sheet-set hash) — the 37 CFR 11.18(b) / 89 FR 25614 "reasonable inquiry". `--by` is descriptive metadata, never proof. The event must carry a `confirmation` reference to an artifact the attorney authored, and `drawings sign` refuses to write the event unless all of these hold: (1) the artifact contains, on a line of its own, the verbatim approval statement the CLI prints for that sheet set, `I approve design-figure sheet set <sheet-set-hash> for filing.`; (2) for an email confirmation, the message is read through `@beep/m365`, its `from` and `sender` addresses equal the attorney address recorded in the matter spec, and the approval line appears in the attorney-authored portion (Graph `uniqueBody`, fetched by the dedicated `$select` read named in Target Surfaces), never only in the quoted thread; a response without a plain-text `uniqueBody` fails closed and the check never falls back to `body` or to tag-stripping; (3) for a PDF confirmation, the file lives under the corpus root, the approval line is matched only on the page the attorney initialed (the operator names that page; a sheet-set or request page that merely reprints the statement does not count), and the operator attests in the event that the attorney delivered it. The approval statement must not be sent to the attorney pre-filled in the request body. A hash or approval line that appears only in quoted text, or in a rejection, question, or forward, is refused; the match is whole-line and verbatim, so the check never interprets prose. The event stores the artifact locator, its content hash, and the matched sender alongside the sheet-set hash.

## Acceptance Criteria

- [ ] P1 spike result recorded in `research/`: perspective HLR via replicad works, or the build123d fallback is wired for perspective figures.
- [ ] `beep drawings render` on the synthetic fixture produces eight sheets whose hashes match committed goldens on two consecutive runs.
- [ ] `beep drawings validate` returns zero findings on those sheets and non-zero findings on a deliberately broken fixture (margin, gray pixel, PDF 1.7).
- [ ] The live matter's eight unshaded sheets render from a spec under the corpus root and pass the validator (evidence: validator report hash in `history/`, no sheets committed).
- [ ] Slice 2: shaded sheets pass the validator; the judge rubric produces a schema-valid qa-inventory; a sign-off event is written and re-read, and `drawings sign` refuses both a confirmation artifact without the sheet-set hash and one that quotes the hash without the verbatim approval line, such as a rejection; a rejection reply or plain forward that quotes a request containing the statement, so the line appears only below the reply/forward boundary; a PDF whose statement is not on the initialed page; and a reply whose sender is not the recorded attorney (negative tests); plus one positive fixture, a recorded attorney reply shape that decodes a non-empty text `uniqueBody` and passes.
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

## Amendments

| Date | Change | Owner | Rationale |
| --- | --- | --- | --- |
| 2026-10-05 | Target Surfaces: pipeline schemas/services move from `packages/law-practice/*` to the new `@beep/technical-drawing` foundation capability; law-practice keeps only Matter-bound meaning | Operator (asked in session, answered "foundation/capability package") | `standards/ARCHITECTURE.md` (source 3) outranks this spec (source 4): tooling packages never depend on product slices, and no tooling package does today; a ledgered exception and a non-`beep` command were the rejected alternatives |

## Decision Log

Recorded under the operator autonomy charter (AGENTS.md "Autonomy", PR #1448; relayed by the
orchestrator 2026-10-06): decide, record the reason and how to reverse, keep going.

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-06 | PR #1439 is final for the code of both slices and flips ready once its head is green apart from inherited reds. | Every code criterion is met on the synthetic fixture: eight sheets, byte-stable across two runs; validator negatives; shaded sheets clean; judge inventory schema-valid; sign-off written and re-read; all six refusal cases plus the recorded-reply positive. The live-matter render produces no repository diff beyond a validator-report hash, so holding the code back does not advance it. | `gh pr ready 1439 --undo` before merge; after merge, a follow-up PR. |
| 2026-10-06 | The live matter's sheets stay the goal's open acceptance item, delivered later as an operational step: spec, renders, and sign-off under `BEEP_OPPOLD_CORPUS_ROOT`, plus one small PR adding the validator-report hash to `history/`. | The inputs are physical (caliper dimensions, photos saved under the corpus root) and cannot be produced by an agent. Inventing dimensions would make the figures wrong and the filing defective. | None needed; the item closes when the inputs arrive. |
| 2026-10-06 | Shading covers planar faces only. Cylindrical-face shading is a tracked follow-up; drawing-judge round 2 finding R2-01 (P2) is carried rather than fixed. | The exploration decision scopes the generator to planar faces. The charter stops review loops after round 2, with P2 findings becoming follow-ups. The vendor shading-only pass remains the filing fallback for curved articles. | Implement cylinder hatching in `@beep/occt` `internal/shading.ts` and re-run the judge. |
| 2026-10-06 | Default minimum shading pitch is 1.2 mm, not 0.8 mm. | Drawing-judge round 1 finding R1-02 (P2): at 0.8 mm the largest dark face approached a solid tone, and it would close up at two-thirds reduction. Round 2 confirmed the fix. | `SheetOptions.shadingMinPitchMm` default; the goldens' `shadedSegments` move with it. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| agentic-cad D9 (client-data processing only on the attorney's machine) | `beep drawings` runs on the developer workstation over one matter's drawing inputs and outputs under `BEEP_OPPOLD_CORPUS_ROOT`; nothing else, nothing in git | Operator (decision 2026-10-05, `explorations/patent-drawing-pipeline/DECISIONS.md`) | The corpus home already lives on this workstation and the desktop release lane has never run; the attorney reviews and signs off every sheet set (Model Rule 5.3 supervision) | The pipeline ships on the attorney's machine (agentic-cad P7 / gated `design-figure-desktop`) |
