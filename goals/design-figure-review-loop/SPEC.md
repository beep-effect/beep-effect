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
- Sheet PDFs stay font-free: labels are outlined glyph paths. The default outlines come from a
  vendored OFL-1.1 Liberation subset; an operator-supplied font file is read at render time, never
  committed, and its sha256 goes in the manifest.
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

- [ ] F1 — both pictorials render as isometric parallel projections from one shared azimuth, oriented by the agreed reference (corpus inventory row F1).
- [ ] F2 — every sheet number is outlined at 18 pt in the sans face (or a supplied Arial file), centred between the side margins just below the top margin.
- [ ] F3 — every FIG label is outlined at 24 pt in the serif face (or a supplied Times New Roman file).
- [ ] F4 — flat faces turned toward the viewer carry surface shading, lit faces included; a judge round on the probe render is ingested.
- [ ] F5 — the requested hidden fastening features are shown where the reviewer marked (corpus inventory row F5).
- [ ] F6 — each joint the reviewer marked shows how the parts meet, as the attorney confirms (corpus inventory row F6).
- [ ] F7 — sheets compose to `cfr-strict` margins (1 in / 1 in / 5/8 in / 3/8 in or more) and the manifest records the standard.
- [ ] F8 — both plan views take the agreed orientation by camera, never by page rotation (corpus inventory row F8).
- [ ] F9 — the seam line the reviewer marked is gone, checked on a zoomed raster (corpus inventory row F9).
- [ ] F10 — the joint, line-style and clearance details the reviewer marked are shown, in the line style the attorney names (corpus inventory row F10).
- [ ] The round-2 set renders byte-identically twice, passes `beep drawings validate`, and has zero open required review findings or an attorney-accepted deferral for each open one.

Tooling (review loop):

- [ ] T1 — `beep drawings intake` pulls a message's attachments (from a message id, an Outlook link, or a conversation id) into the corpus root with a per-attachment sha256 record, refuses paths outside it, and replaces the throwaway script.
- [ ] T2 — attorney markup PDFs (flattened, no `/Annots`) ingest into a schema-valid review round: each page matched to its sheet by a unique ink-coverage winner or refused, notes carried verbatim with their rectangles under the corpus root.
- [ ] T3 — each review round records the sheet-set hash it reviewed; `beep drawings statement` refuses while required findings are open on that hash; the judge prompt routes claim-scope findings to the attorney as questions.

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
| 2026-10-13 | Attorney questions sent 2026-10-13; the defaults above hold until answered. | Claim scope and wording belong to the attorney; work continues on defaults. | Each answer that differs becomes a spec change and a new row here. |
| 2026-10-13 | The agentic-cad D9 exception is widened to read-only mailbox intake into the corpus root for this packet (Exception Ledger); flagged to the operator asynchronously. | T1 needs the app-only mailbox lane on the workstation; the data already lands under the corpus root. | Remove the widening from agentic-cad SPEC and this ledger; intake falls back to the operator saving attachments by hand. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| agentic-cad D9, widened (client-data processing only on the attorney's machine) | The predecessor's scope (`beep drawings` over one matter's drawing inputs and outputs under `BEEP_OPPOLD_CORPUS_ROOT`) plus `beep drawings intake`: read-only app-only mailbox reads of the matter's request and review messages, attachments written only under the corpus root; nothing in git | Agent-decided 2026-10-13 under the autonomy charter; operator flagged | The corpus home already lives on this workstation; the attorney reviews and signs off every sheet set (Model Rule 5.3 supervision) | The pipeline ships on the attorney's machine (agentic-cad P7 / gated `design-figure-desktop`), or the operator reverses the widening |
