# Design Figure Review Loop Spec

## Objective

The attorney's round-1 review of the live matter's eight sheets is answered by a round-2 sheet set
that meets every markup item (F1-F10) or carries an attorney-accepted deferral, rendered by the
`beep drawings` pipeline from spec values whose defaults reproduce today's output byte for byte.
Beside it, the pipeline gains a review loop (T1-T3): `beep drawings intake` pulls a request's
Outlook attachments into the corpus root with a sha256 manifest, attorney markup PDFs become a
review round keyed to the sheet-set hash they reviewed, and `beep drawings statement` refuses to
print the approval line while required findings are open on that hash.

## Non-Goals

- A reopen of `goals/design-figure-generation`; its contract and evidence stay as they are.
- Image-model figure generation, raster tracing, or the photo-to-DXF on-ramp (narrowed
  `design-figure-intake` candidate in the exploration MAP).
- A desktop-app surface (gated `design-figure-desktop`).
- Sending mail without explicit approval in chat; agent-ruled claim scope.
- Committing font files, real article geometry, photos, markup text, crops or renders.
- Utility-patent numeral grammar (agentic-cad P5).

## Source Hierarchy

1. The attorney's 2026-10-10 review (markup on the eight round-1 sheets, held under
   `BEEP_OPPOLD_CORPUS_ROOT`) and the operator's 2026-10-13 request that opened this packet (two
   tracks in parallel: the round-2 deliverable and the intake/review tooling).
2. `AGENTS.md`, `CLAUDE.md`, and required skills (schema-first-development,
   effect-first-development, yeet, browser-qa-loop for the judge).
3. `standards/ARCHITECTURE.md`; 37 CFR 1.84 and 1.152; MPEP 1503.02;
   `goals/agentic-cad-patent-tooling/SPEC.md` D6-D9 with the widened D9 exception (Exception
   Ledger); the predecessor SPEC's constraints, which stay in force unless this packet's Decision
   Log reverses one.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. `research/`, `ops/`, `history/`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/foundation/capability/technical-drawing` — sheet margins, projection, plan facing,
  label styles, part line style, review-round and delivery schemas.
- `packages/drivers/occt` — isometric camera path, broken-line compounds, overlap guard, opt-in
  contour shading rules.
- `packages/drivers/pdf-tools` — word boxes, ink coverage, annotation reads.
- `packages/drivers/m365` — app-only env loader and Outlook item reference decoding.
- `packages/tooling/tool/cli/src/commands/Drawings/` — `beep drawings intake`, review ingest,
  the statement guard; `packages/tooling/tool/cli/src/commands/Qa/` and
  `.claude/skills/browser-qa-loop/resources/drawing-judge-prompt.md` — the claim-scope rule.
- Generic synthetic fixtures under the owning packages' `test/` directories.
- Docs: this packet, `explorations/patent-drawing-pipeline`, the predecessor's pointer rows, the
  agentic-cad D9 exception.

## Constraints

- Design order: schema → `Context.Service` contract → implementation. Effect v4 only (APIs checked
  against the installed `effect` d.ts); `LiteralKit` for literal unions; `HashMap`/`HashSet`, never
  `Map`/`Set`; JSDoc with titled **Example** sections; new role files through
  `bun run beep architecture`.
- Every new field defaults to today's behaviour; `synthetic-bracket.golden.json` stays
  byte-identical until a deliberate re-record recorded in the Decision Log.
- The matter's labels are real text: the sheet number in Arial and the FIG label in Times New
  Roman, embedded in each sheet PDF from the Microsoft core fonts installed on the render host
  through a pinned fontconfig (attorney ruling 2026-10-14, reversing decision 4). Font files are
  never committed; each one's sha256 goes in the manifest. The outlined route stays the default for
  every other spec: a vendored OFL-1.1 Liberation subset, or an operator-supplied font file read at
  render time.
- Broken lines (37 CFR 1.152) mark visible edges of unclaimed parts only; hidden lines are never
  drawn; unclaimed parts are never shaded.
- A review round is never a sign-off. The predecessor's sign-off rules (verbatim approval line,
  attorney-authored artifact, sheet-set hash) are unchanged.
- Claim-scope questions go to the attorney as questions; an agent never rules a feature
  unclaimed.
- Client material (spec, geometry, photos, markup text, crops, renders, mail bodies) lives only
  under `BEEP_OPPOLD_CORPUS_ROOT`; repo fixtures are generic; repo evidence is hashes and counts.
  Packet prose names drawing conventions, not the live article's counts, shapes or joint layout.
- Mailbox reads use the app-only lane and write only inside the corpus root. Outbound mail goes
  through an outbox draft and is sent only after explicit approval in chat.
- Planned commands are written as `beep drawings intake` (no `bun run` prefix, no ellipsis) until
  they exist.

## Acceptance Criteria

Attorney deliverable (round 2):

- [ ] F1 — both pictorials render as isometric parallel projections from one shared azimuth, oriented by the reference the attorney confirmed on 2026-10-14 (corpus inventory row F1).
- [ ] F2 — every sheet number is set at 18 pt in Arial as embedded text (2026-10-14 ruling), centred between the side margins just below the top margin.
- [ ] F3 — every FIG label is set at 24 pt in Times New Roman as embedded text (2026-10-14 ruling).
- [ ] F4 — flat faces turned toward the viewer carry surface shading, lit faces included; a judge round on the probe render is ingested.
- [ ] F5 — the requested hidden fastening features are shown where the reviewer marked, in broken lines (unclaimed) in every view where they appear (corpus inventory row F5; 2026-10-14 ruling).
- [ ] F6 — each joint the reviewer marked shows how the parts meet as the attorney ruled on 2026-10-14: the lap overlap at the stated width, each tab flush in its slot with the tab-in-slot edge in the heavier line class, and nominal but distinctive corner gaps, pictorials included (corpus inventory row F6).
- [ ] F7 — sheets compose to `cfr-strict` margins (1 in / 1 in / 5/8 in / 3/8 in or more) and the manifest records the standard.
- [ ] F8 — both plan views take the orientation the attorney confirmed on 2026-10-14 by camera, never by page rotation (corpus inventory row F8).
- [ ] F9 — the seam line the reviewer marked is gone, checked on a zoomed raster (corpus inventory row F9).
- [ ] F10 — the joint, line-style and clearance details the reviewer marked are shown; the dashed style the reviewer asked for is the broken line for unclaimed matter (2026-10-14 ruling; corpus inventory row F10).
- [ ] Q7 — the open bottom-edge question (which part's bottom edge is drawn uncut in a bottom view) is answered and applied, or the attorney accepts a deferral.
- [ ] The round-2 set renders byte-identically twice, passes `beep drawings validate`, and has zero open required review findings or an attorney-accepted deferral for each open one.

Tooling (review loop):

- [ ] T1 — `beep drawings intake` pulls a message's attachments (from a message id, an Outlook link, or a conversation id) into the corpus root with a per-attachment sha256 record, refuses paths outside it, and replaces the throwaway script.
- [ ] T2 — attorney markup PDFs (flattened, no `/Annots`) ingest into a schema-valid review round: each page matched to its sheet by a unique ink-coverage winner or refused, notes carried verbatim with their rectangles under the corpus root.
- [ ] T3 — each review round records the sheet-set hash it reviewed; `beep drawings statement` refuses while required findings are open on that hash; the judge prompt routes claim-scope findings to the attorney as questions.

Tooling (attorney rulings of 2026-10-14):

- [ ] L1 — a text-embedding label route sets labels as real text in a named font resolved from the render host through a pinned fontconfig, records each font file's sha256 in the manifest, and a validator rule fails a sheet whose sheet number or FIG label is missing as extractable text in its named font; the outlined route stays the default and the synthetic golden is unchanged.
- [ ] E1 — an edge-emphasis line class draws chosen edges (the tab-in-slot edge) heavier than ordinary visible edges; off by default, synthetic golden unchanged.
- [ ] C1 — a corrugation overlay draws a dashed, unclaimed corrugation profile on chosen exposed board edges; never shaded, off by default, synthetic golden unchanged.

Always:

- [ ] `synthetic-bracket.golden.json` is unchanged by every PR that does not record a deliberate re-record.
- [ ] `bun run beep quality package-verify <pkg>` passes for every touched package.
- [ ] No client material in the repository; no unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/design-figure-review-loop/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/design-figure-review-loop/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/design-figure-review-loop` | Passes |
| Packet doctor | `bun run beep goals doctor` | No finding for this slug |
| Exploration projection | `bun run beep explore atlas --check` | Passes |
| Planned commands and paths | `bun run beep knowledge semantic-delta` | No introduced findings |
| Default output unchanged | drawings-live golden on the synthetic fixture | Byte-identical unless a re-record is logged |
| Package handoff | `bun run beep quality package-verify <pkg>` per touched package | Green |
| Round-2 set | `beep drawings validate` on the corpus set, two renders | Zero findings; same sheet-set hash |
| Review loop | negative tests: statement with open findings, ambiguous sheet match, path outside the corpus | Each refused |
| Reflection | `bun run beep lint reflection-artifacts` | Passes at P9 |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the operator.
- The same blocker repeats after reasonable investigation.
- Any step would commit client material to the repository.
- A filing-bound send would go out before a question it depends on is answered: hold that send and
  keep building the rest.

Scope growth, destructive side effects and policy calls are not stops: decide them and record each
in the Decision Log.

## Amendments

| Date | Change | Owner | Rationale |
| --- | --- | --- | --- |
| 2026-10-14 | Constraint "Sheet PDFs stay font-free" replaced by the embedded-text rule for the matter; acceptance F1-F3, F5, F6, F8, F10 reworded to the 2026-10-14 rulings; Q7, L1, E1 and C1 added. | Agent, relaying the attorney | The attorney's answers to the round-1 questions. |
| 2026-10-13 | The pre-admission PLAN draft was generalised at admission: counts, shape names and joint layouts of the live article were replaced with drawing-convention wording. | Agent (autonomy charter) | The repo is public and the design is unfiled; the corpus holds the specifics. |

## Decision Log

Recorded under the operator autonomy charter (AGENTS.md "Autonomy"): decide, record the reason and
how to reverse, keep going.

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-13 | A successor packet carries the round-1 response; `design-figure-generation` stays `completed-retained`. | Its contract and evidence are closed and merged (#1439); the review adds new scope (projection, labels, parts, review loop). | Fold this packet into the predecessor and flip it back to `active`. |
| 2026-10-13 | Every new field defaults to today's behaviour; goldens move only in a deliberate, logged re-record. | Keeps each PR reviewable and the synthetic golden a regression proof. | Change a default and re-record the golden in the same PR. |
| 2026-10-13 | `cfr-strict` margins are the per-side maximum of the 37 CFR 1.84(g) cm and inch figures; the validator floor stays the cm figures. | Strict sheets satisfy both; standalone validation keeps its floor. | Drop `cfr-strict` or move the validator floor to the strict values. |
| 2026-10-13 | Labels are outlined glyphs: a vendored OFL-1.1 Liberation Sans/Serif subset by default, an operator-supplied font file optional; PDFs stay font-free. | Keeps the predecessor's outlined-text law and host independence; Arial and Times New Roman are not redistributable. | Embed fonts instead and lift the font-free validator rule. |
| 2026-10-13 | One orientation rule shared by the pictorials and the plans, consistent with the other figures, pending the attorney's confirmation; the matter's choice is in the corpus inventory. | The markup ties both requests to the same reference figures. | Set a different azimuth or plan facing in the matter spec. |
| 2026-10-13 | The matter spec sets `shadingLitThreshold` 1; graded and surface-class shading arrive as opt-ins after a probe. | The reviewed set was unshaded; threshold 1 already shades every face toward the camera. | Restore the 0.55 threshold or drop the opt-ins. |
| 2026-10-13 | Broken lines mark unclaimed parts' visible edges only; hidden lines are never drawn. | 37 CFR 1.152 and MPEP 1503.02 use broken lines for unclaimed matter. | Add a hidden-line style if the attorney asks for it and the rules allow it. |
| 2026-10-13 | The requested fastening features are shown. This fully reverses the predecessor's 2026-10-06 "left out as unclaimed" row. | The attorney asked for them (F5); live judge round 2 had raised their absence as P1. | Mark those parts broken or drop them from the matter spec. |
| 2026-10-13 | The article is modelled as separate parts with contact and clearance geometry. | The joint details of F6 and F10 cannot be shown on one fused body. | Fuse the parts again in the matter spec. |
| 2026-10-13 | No changesets. | The touched packages are private at 0.0.0 and `.changeset/config.json` does not version private packages. | Add changesets if a package goes public. |
| 2026-10-13 | Packet docs name review requests at convention level only; the reviewer's wording and the matter-specific readings live in the corpus inventory `<corpus>/ops/patent-drawing-pipeline/matter/round-2/review-1-inventory.md`. | The repo is public and the design is unfiled; a P1 review finding showed the admitted F-table carried markup wording. | None: matter detail never returns to the repo. |
| 2026-10-13 | An isometric pictorial without a set azimuth looks along 45°, not the perspective's 39.8° bearing. | At 45° (mod 90°) the model's X, Y and Z axes foreshorten equally; 39.8° gave a trimetric view labelled isometric. Isometric is opt-in, so no golden moves. | Default the isometric azimuth back to the perspective bearing. |
| 2026-10-13 | The label glyph generator is a committed package script with a `generate:check`, plus a workstation-gated drift test through the `fontFile` route. | A generator kept only in a git-ignored lane directory dies with the lane, so the committed outlines could not be re-derived. | Drop the script and keep only the recipe in `research/label-glyphs.md`. |
| 2026-10-13 | Review finding ids are scoped by sheet-set hash; judge rounds restart per set. | Ids collided across fixtures (R2-01 meant two different findings). | Return to plain round-local ids. |
| 2026-10-13 | Attorney questions drafted 2026-10-13 and sent 2026-10-14 about 01:44Z; the attorney answered at 02:09Z (rows of 2026-10-14 below). The defaults above held until then. | Claim scope and wording belong to the attorney; work continued on defaults. | Each answer that differs becomes a spec change and a new row here. |
| 2026-10-13 | The agentic-cad D9 exception is widened to read-only mailbox intake into the corpus root for this packet (Exception Ledger); flagged to the operator asynchronously. | T1 needs the app-only mailbox lane on the workstation; the data already lands under the corpus root. | Remove the widening from agentic-cad SPEC and this ledger; intake falls back to the operator saving attachments by hand. |
| 2026-10-14 | Attorney ruling, relayed: the shared orientation rule is confirmed. The point the left elevation faces is centred in both pictorials and sits at the page bottom of both plans. Figure descriptions are left to the attorney. | Confirms the 2026-10-13 orientation row (decision 5); the matter values live in the corpus spec. | Set a different azimuth or plan facing in the matter spec on a later ruling. |
| 2026-10-14 | Attorney ruling, relayed: the fastening tabs are unclaimed and are drawn in broken lines in every view where they appear. The dashed style asked for in F10 means unclaimed, not hidden. | Confirms decision 7 (broken lines mark unclaimed visible edges, hidden lines never drawn) and decision 8 (the features are shown); reverses nothing. | Mark the tabs solid in the matter spec if the attorney later claims them. |
| 2026-10-14 | Attorney ruling, relayed: the lap overlap is modelled at the width the attorney stated (value in the corpus answers file). | F6 asked to show the overlap; the attorney named its width. | Change the overlap width in the corpus spec generator. |
| 2026-10-14 | Attorney ruling, relayed: each tab sits flush in its slot (no clearance gap), and the tab-in-slot edge is drawn in a heavier line class than ordinary visible edges; no separate slit-lip line. New tooling: an edge-emphasis line class, follow-up PR-L (P7b). | A flush contact draws as one line, so the heavier weight is what shows the tab inside the slot. Overrides decision 9's clearance sizing for this joint only. | Drop the emphasis class from the matter spec and restore the clearance gap. |
| 2026-10-14 | Attorney ruling, relayed: the corner gaps stay nominal but distinctive enough to show which panel rests on which and that the tabs land in slots, and they are shown in the pictorials too. | The attorney asked for the gaps in every view where they appear. | Close the gaps or limit them to the plans in the corpus spec generator. |
| 2026-10-14 | Attorney ruling, relayed: labels are embedded as real text in Arial (sheet number) and Times New Roman (FIG label). Reverses decision 4 (outlined labels, font-free PDFs) and, for this packet's matter, the predecessor's outlined-text law (Exception Ledger). Needs the Microsoft core fonts on the render host (never committed), a text-embedding label route with a pinned fontconfig, and a validator rule for label presence as text: follow-up PR-K (P7a). | The attorney declined outlines and asked for the named fonts as text. | Switch the matter's label styles back to the outline route (merged in #1644), which keeps the PDFs font-free. |
| 2026-10-14 | Attorney ruling, relayed: the board thickness is modelled at the attorney's stated nominal (value in the corpus answers file). | The attorney gave the dimension the remodel lacked. | Change the thickness in the corpus spec generator. |
| 2026-10-14 | Attorney ruling, relayed: exposed board edges in the bottom views carry a dashed corrugation overlay drawn as unclaimed matter. Whether it goes on every visible board edge or only some of them is still to be confirmed with the attorney. New tooling: a corrugation overlay, follow-up PR-L (P7b). | The attorney asked for it where the tooling can draw it; broken lines keep it out of the claim. | Remove the overlay from the matter spec; the tooling stays off by default. |
| 2026-10-14 | Open: which part's bottom edge is drawn uncut in one bottom view waits for the attorney's reply to an example picture. The current model holds; the filing-bound send waits for the answer (Stop Conditions). | The attorney did not follow the question and asked for a picture, which was sent. | Replace this row with the ruling once it arrives. |
| 2026-10-14 | Packet prose for the 2026-10-14 answers stays at drawing-convention level; the attorney's wording, values and figure numbers live in `<corpus>/ops/patent-drawing-pipeline/matter/round-2/attorney-answers-2026-10-14.md`. | The repo is public and the design is unfiled. | None: matter detail never returns to the repo. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| agentic-cad D9, widened (client-data processing only on the attorney's machine) | The predecessor's scope (`beep drawings` over one matter's drawing inputs and outputs under `BEEP_OPPOLD_CORPUS_ROOT`) plus `beep drawings intake`: read-only app-only mailbox reads of the matter's request and review messages, attachments written only under the corpus root; nothing in git | Agent-decided 2026-10-13 under the autonomy charter; operator flagged | The corpus home already lives on this workstation; the attorney reviews and signs off every sheet set (Model Rule 5.3 supervision) | The pipeline ships on the attorney's machine (agentic-cad P7 / gated `design-figure-desktop`), or the operator reverses the widening |
| Predecessor outlined-text law (labels as outlined glyphs, sheet PDFs font-free) | This packet's live-matter sheets embed Arial and Times New Roman as text; every other spec and the synthetic fixtures stay outlined | Attorney ruling 2026-10-14, relayed by the agent | The attorney asked for the named fonts as real text | The attorney returns to outlines, or the predecessor's law is amended to allow embedded text |
