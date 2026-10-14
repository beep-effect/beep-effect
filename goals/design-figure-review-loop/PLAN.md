# Design Figure Review Loop Plan

## Status

Status: `active` (P0 admission in progress, 2026-10-13)

Successor to [`goals/design-figure-generation`](../design-figure-generation/) (completed-retained
2026-10-06). Opened by the attorney's 2026-10-10 review of the eight draft sheets. `SPEC.md` is the
contract; this plan is the working order. Design order is the repo law: schema, then the
`Context.Service` contract, then the implementation.

Packet prose describes the drawing conventions the review asks for. The reviewer's wording, counts,
shape names, joint layouts and orientation of the live article stay in the corpus inventory
`<corpus>/ops/patent-drawing-pipeline/matter/round-2/review-1-inventory.md` (rows F1-F10); the packet names each request at convention level only
(SPEC Decision Log 2026-10-13).

## What the review said (figure → item)

| Id | Sheets | Request | Reading after evidence |
| --- | --- | --- | --- |
| F1 | 1, 2 | Pictorials as parallel (isometric) projections, oriented consistently with the other figures (inventory row F1) | Parallel projection at the isometric elevation (35.264°), one azimuth shared by both pictorials. No kernel change: a camera without `focus` is already orthographic. |
| F2 | all | A stated sans typeface and size for the sheet number (Arial-metric, 18 pt), centred under the top margin | Labels are stroked glyphs today; the PDF carries no font. |
| F3 | all | A stated serif typeface and size for the FIG label (Times New Roman-metric, 24 pt) | Same. |
| F4 | all | Surface shading on flat faces (37 CFR 1.84(m)) | The reviewed set was the unshaded one (PDF sha256 prefix 17e086a2). The shaded set hatched oblique faces but left square-on and lit faces blank (lit threshold 0.55). |
| F5 | 1, 2, 4 | Show the requested hidden fastening features (inventory row F5) | Reverses the predecessor SPEC Decision Log row of 2026-10-06 (those features left unclaimed). Live judge round 2 had raised it as P1. |
| F6 | 2, 4 | Show how the parts join where the reviewer marked (inventory row F6) | Joints between separate parts; a single fused part cannot show them. |
| F7 | all | Margins stated in inches per 37 CFR 1.84(g) | Today's effective margins (2.5/2.5/1.5/1.0 cm plus 3 mm safety) already exceed these; the ask is the sheet-number position and a declared standard. |
| F8 | 3, 4 | Plan orientation consistent with the other figures (inventory row F8) | A camera-up change on both plans (never a page rotation: the 1.84(m) light lives in the camera frame). |
| F9 | 1, 2 | Remove a seam line the reviewer marked (inventory row F9) | Expected to vanish once the features on either side are modelled coplanar in one part; else a model-space edge break. |
| F10 | 4 | Show joint, line-style and clearance details the reviewer marked (inventory row F10) | Separate parts with contact and clearance geometry. The requested line style needs the attorney's meaning: unclaimed (broken lines, 37 CFR 1.152) or hidden (not permitted for surfaces behind opaque material). |
| T1 | — | Intake of Outlook attachments by the repo driver | `@beep/m365` already has `listMessageAttachments` / `downloadMessageAttachment`; the deferral gate fired with #1456. |
| T2 | — | Turn attorney-annotated PDFs into a review inventory | This round's PDFs are flattened Illustrator exports with zero `/Annots`; ingest must raster-match pages to the sent set and read `pdftotext -bbox-layout` word boxes. |
| T3 | — | A review-round loop beside sign-off | Each round must record the sheet-set hash it reviewed; `beep drawings statement` must not print the approval line while required findings are open on that hash. |

## Phases

Phase ids match `ops/manifest.json`. Phases are lanes, not a strict sequence: Track A (attorney
deliverable) and Track B (tooling) run in parallel sibling lanes, Track C is docs.

| Phase | Track / PR | Items | Status | Goal | Exit criteria |
| --- | --- | --- | --- | --- | --- |
| P0 Admit | C / PR-A | all | in-progress | Admit this packet, reopen and re-graduate the exploration, predecessor pointers, widened D9. | `beep goals doctor` clean for the slug; semantic-delta clean; commit names the slug. |
| P1 Layout, margins, projection, plan facing | A / PR-B | F1, F7, F8 | in-progress (local commit; merges through P8) | Spec-carried sheet options, `cfr-strict` margins, isometric pictorials, plan facing. | package-verify green; synthetic golden byte-identical; new camera tests. |
| P2 Outlined label typefaces | A / PR-C | F2, F3 | in-progress (local commit; merges through P8) | Sans/serif outlined labels at stated point sizes, placed by ink box. | Composer sha256 golden; label-presence assertion on every sheet. |
| P3 Broken-line parts and multi-part fixture | A / PR-D | F5, F6, F10 | pending | `Part` line style, overlap guard, generic egg-crate fixture with hosted WASM tests. | Hosted tests cover halving slots, a through joint, a broken part. |
| P4 Opt-in contour shading | A / PR-E | F4 | pending | Lit-threshold probe first, then graded / surface-class shading as opt-ins. | Judge round on the probe; validator spacing rule. |
| P5 Mailbox intake | B / PR-F | T1 | pending | `beep drawings intake` on the app-only lane into the corpus root. | One read-only proof call; sha manifest per attachment. |
| P6 Review rounds from markup | B / PR-G | T2, T3 | pending | pdf-tools verbs, `ReviewRound` schemas, statement guard, judge claim-scope rule. | Statement refuses while required findings are open on the hash. |
| P7 Corpus remodel and round-2 render | A / corpus only | F1-F10 | pending | Durable spec generator under the corpus, two byte-stable renders, judge round, F9 zoom check. | Round-2 set validator clean; zero open required review findings or an attorney-accepted deferral. |
| P8 Yeet: PRs to mergeable | all | — | pending | Each PR-A..PR-G driven to mergeable through yeet. | `merge-ready: yes` per PR; zero unresolved threads. |
| P9 Close | C / PR-H | — | pending | Hash-only evidence, acceptance flips, reflection, `completed-retained`. | `beep lint reflection-artifacts` passes; manifest and README flipped. |

## Tracks and PRs

Every new field defaults to today's behaviour so
`packages/tooling/tool/cli/test/fixtures/drawings/synthetic-bracket.golden.json` stays
byte-identical until a deliberate re-record; the matter opts in through its corpus spec.

### Track C — PR-A docs(goals): admit the successor packet (P0)
- Reopen `explorations/patent-drawing-pipeline` at `decompose` (the `design-figure-intake` gate fired), add DECISIONS entries, graduate with `links.goals += design-figure-review-loop`.
- Create this packet (GOAL, README, SPEC, PLAN, ops/manifest, research/SOURCES, research/OPPORTUNITIES) with `relatedPackets` predecessor/successor links both ways; the predecessor gets one Decision Log pointer row and a fixed "Current Phase".
- Widen the agentic-cad D9 exception to mailbox intake into the corpus (agent-decided, flagged to the operator).
- Add the USPTO Guide sources (HathiTrust `osu.32437010555650` 1993, Examples 32-38 at A-4-77..A-4-89; `mdp.39015051563529` 2002; Google Books `iu5UAAAAMAAJ` 2002 PDF under the corpus `reference/`).

### Track A — PR-B feat(technical-drawing): spec-carried layout, strict margins, projection, plan facing (P1: F1, F7, F8)
- Schema: `MarginStandard = LiteralKit(["cfr-cm","cfr-strict"])`, `SheetMargins`, `marginsCm` as a `Fn` (strict = per-side max of the 1.84(g) cm and inch figures: 2.54/2.54/1.5875/1.0 cm; the validator floor stays `MARGINS_CM`, which strict sheets satisfy); `SheetOptions.margins`, `SheetOptions.labelGapMm`.
- Schema: `PictorialProjection = LiteralKit(["perspective","isometric"])` on `FigureSpec` (default perspective); `FigureSetSpec.pictorialAzimuthDeg`; `ElevationView = ViewName.pick([...])` and `FigureSetSpec.planFacing` (default `front` = today's up [0,1,0]; another elevation turns both plans together and keeps the mirror-omission proofs; the matter's choice is in the corpus inventory).
- Schema: `FigureSetSpec.sheet: Option<SheetOptions>` (spec wins over CLI flags); `RenderManifest.sheet` and `FigureRecord.camera` recorded (old manifests still decode).
- Contract: no new `Context.Service`; `FigureSet.render` and the `GeometryEngine` port are unchanged.
- Implementation: `cameraForView` isometric branch (eye from azimuth/elevation, up +Z, no focus), plan-up from `planFacing`, `sheetGeometry` reads `marginsCm`, labels anchored at margin + labelGap.
- Verify: package-verify @beep/technical-drawing; drawings-live golden untouched; new camera tests (isometric has no focus; both plans share up; strict sight values).

### Track A — PR-C feat(technical-drawing): outlined label typefaces (P2: F2, F3)
- Schema: `LabelTypeface = LiteralKit(["stroke","sans","serif"])`, `LabelStyle { typeface, sizePt, fontFile: Option<path> }` with a cap-height ≥ 0.32 cm check; `SheetOptions.sheetNumberLabel`, `SheetOptions.figureLabel` (none = today's stroke glyphs).
- Default glyph data: a vendored, generated Liberation Sans/Serif 2.1.5 subset (OFL-1.1; metric-compatible with Arial / Times New Roman; sans caps run about 4 % shorter than Arial). `fontFile` lets the matter outline real Arial/Times from an operator-supplied TTF at render time, never committed; the TTF sha256 goes in the manifest. The PDF stays font-free, so the predecessor's "outlined text" law and host independence hold.
- Placement by glyph-run ink box: sheet-number ink top at the top margin + labelGap, centred between the side margins; FIG label in its own bottom band.
- Verify: hosted composer sha256 golden; label-presence assertion for every sheet; drawings-live golden untouched.

### Track A — PR-D feat(occt, technical-drawing): broken-line parts and a generic multi-part fixture (P3: F10, F5, F6)
- Schema: `PartLineStyle = LiteralKit(["solid","broken"])` on `Part` (default solid; broken = unclaimed, visible edges only, never hatched, never hidden lines); `EdgeSet.broken`; `SheetOptions.brokenDashMm/brokenGapMm`; `FigureRecord.brokenSegments`.
- Kernel: parts partitioned by style into two compounds for HLR; `partOverlaps` guard in `summarize`.
- Fixture: a generic rectangular egg-crate (two plates with opposite halving slots, a cover plate joined through a slit, one broken part) with hosted WASM tests and a second drawings-live golden. Nothing shaped like the live article enters the repo.

### Track A — PR-E feat(occt): opt-in contour shading (P4: F4)
- Step 0, no code beyond spec-carried sheet options from PR-B: the matter spec sets `shadingLitThreshold: 1` (already allowed) and a probe render + judge round shows what remains.
- Schema: `ShadingStyle = LiteralKit(["uniform","graded"])`, `HatchAxis = LiteralKit(["longest-edge","surface-class"])`, `minFaceSpan`; mirrored on `SheetOptions`; `litThreshold` kept.
- Rules: a new shading-rules module in `@beep/occt` (surface class, aspect, tone bands, anchor edge on the shadow side, graded offsets) calibrated against Guide 2002 Example 16 and 1993 Examples 32-38; walls hatch along their extrusion axis in every view, hinged panels along their hinge; thin board edges and broken parts are never hatched; coverage counts in the manifest; validator rule for minimum shading-line spacing.

### Track A — corpus only: remodel and round-2 render (P7: all F items)
- A durable generator `<corpus>/ops/patent-drawing-pipeline/matter/work/review-1/build-spec.ts` (corpus, no repo imports) writes the live spec with the separate parts and joints the review asks for (inventory rows F5, F6, F9, F10); clearance sized from the sheet scale so contact edges read as one line and real gaps read as two.
- Render twice (byte-stable), validator clean, judge round on the new set with the reviewer-requests table; F9 checked on a zoomed raster; the F6 and F10 joint details checked against the inventory.

### Track B — PR-F feat(m365, repo-cli): `beep drawings intake` (P5: T1)
- Schema: `M365AppOnlyEnvSettings` + `loadM365AppOnlyEnv(prefix)` in the driver (rejects unresolved `op://` values); `OutlookItemRef` tagged union decoded from a pasted Outlook link or raw id (an `AAQk` id is a conversation: list its messages and pick the newest or `--pick`); `IntakeRecord` with per-attachment sha256, outcome LiteralKit, duplicateOf, and the message facts.
- Service: `DrawingIntake { pull }` over M365, FileSystem, Path (app-only lane); refuses any path outside the corpus root. Replaces the git-ignored throwaway script.
- Open item: which Entra registration's Exchange RBAC scope covers the attorney's mailbox; prove with one read-only call.

### Track B — PR-G feat(pdf-tools, repo-cli): review rounds from attorney markup (P6: T2, T3)
- pdf-tools verbs: `pageWords` (`pdftotext -bbox-layout`), `inkCoverage` (raster compare), `annotations` (for Acrobat-style rounds).
- Schema: `ReviewFindingId` scoped by sheet-set hash, `MarkupNote` (verbatim text + rect), `SheetMatch` (unique winner ≥ 0.98 coverage, else refuse), `FindingScope` (sheet | all-sheets merge), `Disposition` tagged union (spec-change | code-change | decision | clarify | decline), `ReviewRound` with `reviewedSheetSetSha256`, `DeliveryRecord` written when the outbox draft is created.
- Guards: `beep drawings statement` refuses while required findings are open on the same sheet-set hash; the judge pack takes `--review` and the judge prompt gains the claim-scope rule (claim questions go to the attorney, never an agent "unclaimed" ruling).

### Track C — PR-H docs(goals): evidence and closeout (P9)
- `history/review-round-<n>/evidence.json` (hashes and counts only), acceptance flips, reflection, `completed-retained`. Outbound round-2 mail goes through the outbox draft and is sent only after explicit approval in chat.

### Optional — PR-I ci: librsvg on hosted runners so drawings-live goldens run hosted (and fix the stale skip comment).

## Sequencing
PR-A first (docs, fast). PR-B then PR-C serially (both touch `Sheet.schemas.ts` / `Sheet.compose.ts`); PR-D and PR-E in their own lanes, rebased after PR-C; PR-F and PR-G in their own lanes (disjoint files). The corpus remodel starts at once against the lane build and does not wait for merges. The attorney questions went out on day 1 so answers land before the final render.

## Decisions recorded in SPEC (agent-decided, each with a reverse path)
1. Successor packet, not a reopen of the closed contract. 2. Defaults equal today; goldens move only in a deliberate re-record. 3. `cfr-strict` margins = per-side max of cm and inch; validator floor unchanged. 4. Labels outlined (vendored OFL subset by default, operator font file optional); PDFs stay font-free. 5. One orientation rule shared by the pictorials and the plans, consistent with the other figures (confirm with the attorney; the matter's choice is in the corpus inventory). 6. `shadingLitThreshold` 1 for the matter; graded/surface-class as opt-ins. 7. Broken lines mark unclaimed parts' visible edges only; hidden lines are never drawn. 8. The requested fastening features are shown (reverses the 2026-10-06 row). 9. The article is separate parts with contact geometry. 10. No changesets (private packages). 11. Review ids scoped by sheet-set hash; judge rounds restart per set.

## Questions only the attorney can answer
Sent 2026-10-13; the draft is `<corpus>/ops/patent-drawing-pipeline/matter/round-2/questions-draft.md`. Topics: the orientation reference and description wording; dashed = unclaimed or hidden; the joint and clearance details of rows F6, F9 and F10; metric-compatible outlines versus supplied Arial/Times files. Defaults in the Decision Log hold until answered.

## Execution Notes

- Preserve unrelated worktree changes; never commit client material (spec, geometry, photos, markup text, renders).
- `<corpus>` means `BEEP_OPPOLD_CORPUS_ROOT`; repo evidence is hashes and counts only.
- Heavy local commands run through `beep-heavy`; `bun run beep quality package-verify <pkg>` for every touched package.
- Planned commands are written `beep drawings intake` style (no `bun run` prefix) until they exist.
- Record friction receipts in `research/OPPORTUNITIES.md` as they happen.

## P9 Closeout Checklist

1. Write a closeout reflection via `/reflect` to `history/reflections/<YYYY-MM-DD>-<agent>.md`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase statuses + `initiative.status`.

## Verification Commands

```sh
test "$(wc -m < goals/design-figure-review-loop/GOAL.md)" -le 4000
jq . goals/design-figure-review-loop/ops/manifest.json
rg -n "design-figure-review-loop|GOAL.md|agentLaunchers|packetAnchorDocument" goals/design-figure-review-loop
git diff --check -- goals/design-figure-review-loop
bun run beep goals doctor
bun run beep explore atlas --check
bun run beep lint reflection-artifacts
```

## Progress log

- 2026-10-13 — P0: packet admitted in lane `drawings-review-1` (PR-A, local commit); exploration reopened at `decompose` and re-graduated; predecessor pointer rows added; agentic-cad D9 exception widened; attorney questions sent separately.

- 2026-10-13 — P1 (PR-B, local commit in `drawings-review-1`): `MarginStandard` (`cfr-cm`, `cfr-strict`), `SheetMargins`, `marginsCm`, `SheetOptions.margins` and `labelGapMm`; `PictorialProjection` on `FigureSpec`; `FigureSetSpec.pictorialAzimuthDeg`, `planFacing` (`ElevationView`) and `sheet`; `RenderManifest.sheet` and `FigureRecord.camera`; the render summary names the margin standard, a spec-supplied sheet, and each pictorial's projection. Every default reproduces the earlier output: the live lane re-rendered `synthetic-bracket` to the unchanged golden. The F1, F7 and F8 acceptance ticks wait for the round-2 render (P7), which opts in through the matter spec.
- 2026-10-13 — P2 (PR-C, local commit in `drawings-review-1`): `LabelTypeface` (`stroke`, `sans`, `serif`), `LabelStyle` (cap height at least 0.32 cm; an absolute `fontFile` only on outlined faces), `SheetOptions.sheetNumberLabel` / `figureLabel`, `RenderManifest.labelFonts`, and `DrawingError` reason `font`. Outlined labels are one filled `label-outlines` path placed by the ink box of the glyph run, each label in its own band; sheets without label styles keep their stroked `labels` path byte for byte. The vendored OFL-1.1 subset, its generator command and source hashes are in [`research/label-glyphs.md`](research/label-glyphs.md); the operator `fontFile` route outlines through the same code and records the file's sha256. F2 and F3 ticks wait for the round-2 render (P7).
- 2026-10-13 — Review fixes (lane `drawings-review-1`): the F-table, the matching SPEC acceptance and Decision Log rows, and the exploration's 2026-10-13 fastening-features decision now name requests at convention level; the reviewer's wording and matter readings moved to the corpus inventory. Glyph data and label faces are schemas (`LabelFace`, `SheetLabelFaces`, `labelCapHeightCm` as an `Fn`), so `lint:schema-first` passes for the package; the glyph generator is a committed package script with `generate:check`; the operator `fontFile` route has a hosted positive test (an in-test opentype.js font) and a two-face workstation drift test; an isometric pictorial without an azimuth looks along 45°.

## Current blockers

None for P0. Waiting, not blocking: the attorney's answers (defaults hold); the Entra registration whose RBAC scope covers the attorney's mailbox (PR-F open item).
