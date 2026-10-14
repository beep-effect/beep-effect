/**
 * Review-round schemas for design-figure sheet sets: what was delivered (by
 * hash), the notes a reviewer left on the pages that came back, the findings
 * those notes become, and how each finding is disposed of.
 *
 * **Details**
 *
 * A review round is tied to the sheet set that was sent by its PDF hash
 * (`reviewedSheetSetSha256`) and the spec it was rendered from. A finding id
 * (`A<round>-<nn>`) is unique only inside its round; wherever an id leaves the
 * round's files it travels as a {@link ReviewFindingRef}
 * (`A<round>-<nn>@<sheet set>`). A review round is never an approval: approval
 * stays the `drawings sign` record keyed to the same hash.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Dpi, InkCoverage, PageNumber, PdfRect } from "@beep/pdf-tools";
import { RoundNumber } from "@beep/qa-capture";
import { LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import { A, O } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { DrawingQaLens, QaFindingOrdinal, QaSeverity } from "../Qa/Inventory.schemas.ts";

const $I = $RepoCliId.create("commands/Drawings/Drawings.review.schemas");

const optionalText = (description: string) =>
  S.OptionFromOptionalKey(S.NonEmptyString).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description })
  );

const optionalHash = (description: string) =>
  S.OptionFromOptionalKey(Sha256Hex).pipe(S.withConstructorDefault(Effect.succeedNone), S.annotateKey({ description }));

/**
 * One-based FIG. number of a sheet.
 *
 * **Example** (FIG. 3)
 *
 * ```ts
 * import { FigureNumber } from "@beep/repo-cli/commands/Drawings"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(FigureNumber)(3), S.is(FigureNumber)(0)) // true false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FigureNumber = S.Int.check(
  S.isGreaterThanOrEqualTo(1, {
    identifier: $I`FigureNumberCheck`,
    title: "Figure Number",
    description: "FIG. numbers start at 1.",
    message: "Expected a FIG. number of at least 1",
  })
).pipe(
  $I.annoteSchema("FigureNumber", {
    description: "One-based FIG. number of a sheet.",
  })
);

/**
 * Type for {@link FigureNumber}.
 *
 * **Example** (Annotate a figure)
 *
 * ```ts
 * import type { FigureNumber } from "@beep/repo-cli/commands/Drawings"
 *
 * const figure: FigureNumber = 2
 * console.log(figure)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type FigureNumber = typeof FigureNumber.Type;

/**
 * Branded `A<round>-<nn>` identifier of one attorney review finding.
 *
 * **Details**
 *
 * Unique inside one round's files only: rounds of other matters, and later
 * rounds that reuse a number, mint the same ids. Outside the round's files use
 * {@link ReviewFindingRef}. Judge ids (`R<round>-<nn>`) are a separate family.
 *
 * **Example** (Validate the id format)
 *
 * ```ts
 * import { ReviewFindingId } from "@beep/repo-cli/commands/Drawings"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ReviewFindingId)("A1-03"), S.is(ReviewFindingId)("R1-03")) // true false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReviewFindingId = S.TemplateLiteral(["A", RoundNumber, "-", QaFindingOrdinal]).pipe(
  S.brand("ReviewFindingId"),
  $I.annoteSchema("ReviewFindingId", {
    description: "Branded A<round>-<nn> identifier of one attorney review finding.",
  })
);

/**
 * Type for {@link ReviewFindingId}.
 *
 * **Example** (Make an id)
 *
 * ```ts
 * import { ReviewFindingId } from "@beep/repo-cli/commands/Drawings"
 * import type { ReviewFindingId as ReviewFindingIdValue } from "@beep/repo-cli/commands/Drawings"
 *
 * const id: ReviewFindingIdValue = ReviewFindingId.make("A2-01")
 * console.log(id)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ReviewFindingId = typeof ReviewFindingId.Type;

/**
 * Branded `A<round>-<nn>@<sheet set>` reference to one review finding: the
 * round-local id qualified by the first 12 hex digits of the reviewed sheet
 * set's hash.
 *
 * **Details**
 *
 * Status output, statement refusals, and the judge's reviewer-requests table
 * name findings by reference, so an id quoted in a Decision Log row, a PR, a
 * judge finding title, or a reply mail cannot be mistaken for the same id of
 * another round or matter.
 *
 * **Example** (Validate the reference format)
 *
 * ```ts
 * import { ReviewFindingRef } from "@beep/repo-cli/commands/Drawings"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ReviewFindingRef)("A1-03@0123456789ab"), S.is(ReviewFindingRef)("A1-03")) // true false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReviewFindingRef = S.String.check(
  S.isPattern(/^A[1-9][0-9]*-[0-9]{2}@[0-9a-f]{12}$/, {
    identifier: $I`ReviewFindingRefPatternCheck`,
    title: "Review Finding Ref Pattern",
    description: "A<round>-<nn>@ followed by the first 12 hex digits of the reviewed sheet-set hash.",
    message: "Expected A<round>-<nn>@<12 hex digits>",
  })
).pipe(
  S.brand("ReviewFindingRef"),
  $I.annoteSchema("ReviewFindingRef", {
    description: "Branded A<round>-<nn>@<sheet set> reference to one review finding outside its round's files.",
  })
);

/**
 * Type for {@link ReviewFindingRef}.
 *
 * **Example** (Make a reference)
 *
 * ```ts
 * import { ReviewFindingRef } from "@beep/repo-cli/commands/Drawings"
 * import type { ReviewFindingRef as ReviewFindingRefValue } from "@beep/repo-cli/commands/Drawings"
 *
 * const ref: ReviewFindingRefValue = ReviewFindingRef.make("A2-01@0123456789ab")
 * console.log(ref)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ReviewFindingRef = typeof ReviewFindingRef.Type;

const MarkupNoteOriginBase = LiteralKit(["annotation", "text-layer"]);

/**
 * Where a reviewer note was read from: a PDF annotation object (Acrobat-style
 * comments) or text drawn into the page itself (a flattened export).
 *
 * **Example** (Read the origins)
 *
 * ```ts
 * import { MarkupNoteOrigin } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(MarkupNoteOrigin.literals)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MarkupNoteOrigin = MarkupNoteOriginBase.pipe(
  $I.annoteSchema("MarkupNoteOrigin", {
    description: "Whether a reviewer note came from an annotation object or the page's own text layer.",
  }),
  SchemaUtils.withLiteralKitStatics(MarkupNoteOriginBase)
);

/**
 * Type for {@link MarkupNoteOrigin}.
 *
 * **Example** (Annotate an origin)
 *
 * ```ts
 * import type { MarkupNoteOrigin } from "@beep/repo-cli/commands/Drawings"
 *
 * const origin: MarkupNoteOrigin = "text-layer"
 * console.log(origin)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type MarkupNoteOrigin = typeof MarkupNoteOrigin.Type;

/**
 * A page of a reviewer's file, by file name and page.
 *
 * **Example** (Page 1 of Fig1.pdf)
 *
 * ```ts
 * import { ReviewPageRef } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(ReviewPageRef.make({ file: "Fig1.pdf", page: 1 }).file)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewPageRef extends S.Class<ReviewPageRef>($I`ReviewPageRef`)(
  {
    file: S.NonEmptyString.annotateKey({ description: "Base name of the reviewer's PDF." }),
    page: PageNumber.annotateKey({ description: "One-based page in that PDF." }),
  },
  $I.annote("ReviewPageRef", { description: "A reviewer PDF's base name and a page in it." })
) {}

/**
 * One note a reviewer left, kept verbatim.
 *
 * **Example** (A text-layer note)
 *
 * ```ts
 * import { MarkupNote, ReviewPageRef } from "@beep/repo-cli/commands/Drawings"
 * import { PdfRect } from "@beep/pdf-tools"
 *
 * const note = MarkupNote.make({
 *   text: "Make the box taller",
 *   rect: PdfRect.make({ xMin: 72, yMin: 80, xMax: 180, yMax: 94 }),
 *   origin: "text-layer",
 *   source: ReviewPageRef.make({ file: "Fig1.pdf", page: 1 })
 * })
 * console.log(note.text)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkupNote extends S.Class<MarkupNote>($I`MarkupNote`)(
  {
    text: S.NonEmptyString.annotateKey({ description: "The note exactly as extracted; never paraphrased." }),
    rect: PdfRect.annotateKey({ description: "Where the note sits, in points from the page's top-left corner." }),
    origin: MarkupNoteOrigin.annotateKey({ description: "Annotation object or page text layer." }),
    source: ReviewPageRef.annotateKey({ description: "Reviewer page the note was read from." }),
  },
  $I.annote("MarkupNote", { description: "A verbatim reviewer note with its rectangle, origin, and page." })
) {}

const SheetMatchBasisBase = LiteralKit(["ink-coverage", "operator"]);

/**
 * How a reviewer page was tied to a sheet: by raster ink coverage, or by an
 * operator's `--figure` when coverage could not decide.
 *
 * **Example** (Read the bases)
 *
 * ```ts
 * import { SheetMatchBasis } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(SheetMatchBasis.literals)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SheetMatchBasis = SheetMatchBasisBase.pipe(
  $I.annoteSchema("SheetMatchBasis", {
    description: "Whether a page-to-sheet match came from ink coverage or an operator override.",
  }),
  SchemaUtils.withLiteralKitStatics(SheetMatchBasisBase)
);

/**
 * Type for {@link SheetMatchBasis}.
 *
 * **Example** (Annotate a basis)
 *
 * ```ts
 * import type { SheetMatchBasis } from "@beep/repo-cli/commands/Drawings"
 *
 * const basis: SheetMatchBasis = "ink-coverage"
 * console.log(basis)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SheetMatchBasis = typeof SheetMatchBasis.Type;

/**
 * The sheet of the sent set a reviewer page was matched to.
 *
 * **Example** (Page 2 of the set, FIG. 2, fully covered)
 *
 * ```ts
 * import { SheetMatch } from "@beep/repo-cli/commands/Drawings"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const match = SheetMatch.make({
 *   sheetSetSha256: Sha256Hex.make("0".repeat(64)),
 *   figure: 2,
 *   page: 2,
 *   coverage: 1,
 *   basis: "ink-coverage"
 * })
 * console.log(match.figure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SheetMatch extends S.Class<SheetMatch>($I`SheetMatch`)(
  {
    sheetSetSha256: Sha256Hex.annotateKey({ description: "Hash of the sheet-set PDF the sheet belongs to." }),
    figure: FigureNumber.annotateKey({ description: "FIG. number of the matched sheet." }),
    page: PageNumber.annotateKey({ description: "Page of the sheet-set PDF that holds the sheet." }),
    coverage: S.Finite.annotateKey({ description: "Share of the sheet's ink the reviewer page covers." }),
    basis: SheetMatchBasis.annotateKey({ description: "Ink coverage, or an operator override." }),
  },
  $I.annote("SheetMatch", { description: "Sheet set, FIG., page, coverage, and basis of a page-to-sheet match." })
) {}

const FindingScopeBase = LiteralKit(["sheet", "all-sheets"]);

/**
 * Whether a finding applies to the sheets it names or to every sheet: notes
 * marked "(all sheets)", and notes repeated on every sheet of the set.
 *
 * **Example** (Read the scopes)
 *
 * ```ts
 * import { FindingScope } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(FindingScope.literals)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FindingScope = FindingScopeBase.pipe(
  $I.annoteSchema("FindingScope", { description: "The named sheets, or every sheet of the set." }),
  SchemaUtils.withLiteralKitStatics(FindingScopeBase)
);

/**
 * Type for {@link FindingScope}.
 *
 * **Example** (Annotate a scope)
 *
 * ```ts
 * import type { FindingScope } from "@beep/repo-cli/commands/Drawings"
 *
 * const scope: FindingScope = "all-sheets"
 * console.log(scope)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type FindingScope = typeof FindingScope.Type;

const ReviewFindingStatusBase = LiteralKit(["open", "planned", "resolved", "declined", "clarify"]);

/**
 * Where a review finding stands.
 *
 * **Details**
 *
 * `open` has no disposition yet; `planned` has a spec, code, or decision
 * change; `clarify` waits on the attorney; `declined` will not be done;
 * `resolved` is confirmed on a re-render.
 *
 * **Example** (Read the statuses)
 *
 * ```ts
 * import { ReviewFindingStatus } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(ReviewFindingStatus.literals)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReviewFindingStatus = ReviewFindingStatusBase.pipe(
  $I.annoteSchema("ReviewFindingStatus", { description: "Lifecycle state of one review finding." }),
  SchemaUtils.withLiteralKitStatics(ReviewFindingStatusBase)
);

/**
 * Type for {@link ReviewFindingStatus}.
 *
 * **Example** (Annotate a status)
 *
 * ```ts
 * import type { ReviewFindingStatus } from "@beep/repo-cli/commands/Drawings"
 *
 * const status: ReviewFindingStatus = "clarify"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ReviewFindingStatus = typeof ReviewFindingStatus.Type;

const DispositionKindBase = LiteralKit(["spec-change", "code-change", "decision", "clarify", "decline"]);

/**
 * Kinds of disposition a finding can receive.
 *
 * **Example** (Read the kinds)
 *
 * ```ts
 * import { DispositionKind } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(DispositionKind.literals.length) // 5
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DispositionKind = DispositionKindBase.pipe(
  $I.annoteSchema("DispositionKind", { description: "How a review finding is disposed of." }),
  SchemaUtils.withLiteralKitStatics(DispositionKindBase)
);

/**
 * Type for {@link DispositionKind}.
 *
 * **Example** (Annotate a kind)
 *
 * ```ts
 * import type { DispositionKind } from "@beep/repo-cli/commands/Drawings"
 *
 * const kind: DispositionKind = "decision"
 * console.log(kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DispositionKind = typeof DispositionKind.Type;

/**
 * How one finding is handled, tagged on `kind`: a spec change (a pointer into
 * the matter spec), a code change (a PR), a Decision Log row (and the row it
 * reverses), a question for the attorney, or a reasoned decline.
 *
 * **Example** (A spec change)
 *
 * ```ts
 * import { Disposition } from "@beep/repo-cli/commands/Drawings"
 *
 * const disposition = Disposition.cases["spec-change"].make({
 *   kind: "spec-change",
 *   pointer: "/sheet/margins",
 *   summary: "Raise the top margin to 1 in."
 * })
 * console.log(disposition.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Disposition = DispositionKind.toTaggedUnion("kind")({
  "spec-change": {
    pointer: S.NonEmptyString.annotateKey({ description: "Spec file and JSON pointer that changes." }),
    summary: S.NonEmptyString.annotateKey({ description: "What changes, in one line." }),
  },
  "code-change": {
    pr: S.NonEmptyString.annotateKey({ description: "PR (number or planned PR name) that makes the change." }),
    summary: S.NonEmptyString.annotateKey({ description: "What changes, in one line." }),
  },
  decision: {
    decisionRow: S.NonEmptyString.annotateKey({ description: "Decision Log row that records the call." }),
    reverses: optionalText("Earlier Decision Log row this one reverses, if any."),
  },
  clarify: {
    question: S.NonEmptyString.annotateKey({ description: "Question for the attorney." }),
  },
  decline: {
    reason: S.NonEmptyString.annotateKey({ description: "Why the request is not taken." }),
  },
}).pipe(
  $I.annoteSchema("Disposition", {
    description: "Spec change, code change, decision row, clarification question, or decline for one finding.",
  })
);

/**
 * Type for {@link Disposition}.
 *
 * **Example** (A clarification)
 *
 * ```ts
 * import { Disposition } from "@beep/repo-cli/commands/Drawings"
 *
 * const disposition: Disposition = Disposition.cases.clarify.make({ kind: "clarify", question: "Dashed or hidden?" })
 * console.log(disposition)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Disposition = typeof Disposition.Type;

const ScopeFigureCheck = S.makeFilter(
  (finding: { readonly scope: FindingScope; readonly figures: ReadonlyArray<number> }) =>
    finding.scope === "sheet" ? A.isReadonlyArrayNonEmpty(finding.figures) : A.isReadonlyArrayEmpty(finding.figures),
  {
    identifier: $I`ReviewFindingScopeFigureCheck`,
    title: "Review Finding Scope Figure",
    description: "A sheet finding names at least one FIG.; an all-sheets finding names none.",
    message: "Expected figures exactly when the scope is sheet",
  }
);

const StatusDispositionCheck = S.makeFilter(
  (finding: { readonly status: ReviewFindingStatus; readonly disposition: O.Option<unknown> }) =>
    finding.status === "open" || O.isSome(finding.disposition),
  {
    identifier: $I`ReviewFindingStatusDispositionCheck`,
    title: "Review Finding Status Disposition",
    description: "Only an open finding may lack a disposition.",
    message: "Expected a disposition on every finding that is not open",
  }
);

/**
 * One attorney review finding: the verbatim notes it comes from, where it
 * applies, and how it is handled.
 *
 * **Details**
 *
 * Ingest opens each finding at `P1` with no lens (an attorney request is
 * required until triaged); `drawings review plan` sets severity, lens, and
 * disposition from the dispositions file. One finding merges every note with
 * the same text, on one page or several, and lists the FIG.s it was read on.
 *
 * **Example** (An open sheet finding)
 *
 * ```ts
 * import { MarkupNote, ReviewFinding, ReviewFindingId, ReviewPageRef } from "@beep/repo-cli/commands/Drawings"
 * import { PdfRect } from "@beep/pdf-tools"
 * import * as O from "effect/Option"
 *
 * const finding = ReviewFinding.make({
 *   id: ReviewFindingId.make("A1-01"),
 *   severity: "P1",
 *   scope: "sheet",
 *   figures: [1],
 *   notes: [
 *     MarkupNote.make({
 *       text: "Make the box taller",
 *       rect: PdfRect.make({ xMin: 72, yMin: 80, xMax: 180, yMax: 94 }),
 *       origin: "text-layer",
 *       source: ReviewPageRef.make({ file: "Fig1.pdf", page: 1 })
 *     })
 *   ],
 *   status: "open"
 * })
 * console.log(finding.id, finding.figures, O.isNone(finding.disposition))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewFinding extends S.Class<ReviewFinding>($I`ReviewFinding`)(
  S.Struct({
    id: ReviewFindingId.annotateKey({ description: "A<round>-<nn>, in page then reading order." }),
    severity: QaSeverity.annotateKey({ description: "P0 and P1 are required; P2 is polish." }),
    lens: S.OptionFromOptionalKey(DrawingQaLens).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Drawing-rubric lens, set when the finding is planned." })
    ),
    scope: FindingScope.annotateKey({ description: "The named sheets, or every sheet." }),
    figures: S.Array(FigureNumber).annotateKey({
      description: "FIG.s a sheet finding applies to, ascending; empty for an all-sheets finding.",
    }),
    notes: S.NonEmptyArray(MarkupNote).annotateKey({ description: "Every note this finding merges, verbatim." }),
    status: ReviewFindingStatus.annotateKey({ description: "Where the finding stands." }),
    disposition: S.OptionFromOptionalKey(Disposition).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "How the finding is handled; absent while open." })
    ),
  }).check(ScopeFigureCheck, StatusDispositionCheck),
  $I.annote("ReviewFinding", {
    description: "Id, severity, lens, scope, figures, verbatim notes, status, and disposition of one review finding.",
  })
) {}

const ReviewRoundStatusBase = LiteralKit(["open", "ingested", "planned", "rendered", "verified", "replied", "closed"]);

/**
 * Where a review round stands.
 *
 * **Example** (Read the statuses)
 *
 * ```ts
 * import { ReviewRoundStatus } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(ReviewRoundStatus.literals[0]) // "open"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReviewRoundStatus = ReviewRoundStatusBase.pipe(
  $I.annoteSchema("ReviewRoundStatus", { description: "Lifecycle state of one review round." }),
  SchemaUtils.withLiteralKitStatics(ReviewRoundStatusBase)
);

/**
 * Type for {@link ReviewRoundStatus}.
 *
 * **Example** (Annotate a status)
 *
 * ```ts
 * import type { ReviewRoundStatus } from "@beep/repo-cli/commands/Drawings"
 *
 * const status: ReviewRoundStatus = "planned"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ReviewRoundStatus = typeof ReviewRoundStatus.Type;

/**
 * `round.json` of one review round: the sheet set reviewed (by hash), the
 * spec it was rendered from, and the hashes of every file the round has
 * produced so far.
 *
 * **Details**
 *
 * Every read of `intake.json`, `inventory.json`, and (once planned)
 * `dispositions.json` is checked against the hash recorded here, so a file
 * edited outside `beep drawings review` is refused rather than trusted.
 *
 * **Example** (A freshly opened round)
 *
 * ```ts
 * import { ReviewRound } from "@beep/repo-cli/commands/Drawings"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const round = ReviewRound.make({
 *   schemaVersion: "drawing-review-round/v1",
 *   round: 1,
 *   status: "open",
 *   reviewedSheetSetSha256: Sha256Hex.make("a".repeat(64))
 * })
 * console.log(round.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewRound extends S.Class<ReviewRound>($I`ReviewRound`)(
  {
    schemaVersion: S.Literal("drawing-review-round/v1").annotateKey({ description: "Schema version." }),
    round: RoundNumber.annotateKey({ description: "One-based review round." }),
    status: ReviewRoundStatus.annotateKey({ description: "Where the round stands." }),
    reviewedSheetSetSha256: Sha256Hex.annotateKey({ description: "Hash of the sheet-set PDF that was sent." }),
    reviewedSpecSha256: optionalHash("Hash of the spec the reviewed set was rendered from, from its manifest."),
    sentMessageId: optionalText("Graph id of the sent message that carried the set, when recorded."),
    intakeSha256: optionalHash("Hash of intake.json once pages are ingested."),
    inventorySha256: optionalHash("Hash of inventory.json as last written."),
    dispositionsSha256: optionalHash("Hash of dispositions.json once the round is planned."),
    renderedSheetSetSha256: optionalHash("Hash of the re-rendered sheet set that answers the round."),
    judgeInventorySha256: optionalHash("Hash of the judge inventory that checked the re-render."),
  },
  $I.annote("ReviewRound", {
    description:
      "Round number, status, reviewed sheet-set and spec hashes, and produced-file hashes of a review round.",
  })
) {}

/**
 * One reviewer page as ingested: its file and hash, the sheet it matched, and
 * the notes read from it.
 *
 * **Example** (A page with no notes)
 *
 * ```ts
 * import { ReviewedPage, SheetMatch } from "@beep/repo-cli/commands/Drawings"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const hash = Sha256Hex.make("b".repeat(64))
 * const page = ReviewedPage.make({
 *   file: "Fig1.pdf",
 *   pdfSha256: hash,
 *   page: 1,
 *   match: SheetMatch.make({ sheetSetSha256: hash, figure: 1, page: 1, coverage: 1, basis: "ink-coverage" }),
 *   notes: []
 * })
 * console.log(page.match.figure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewedPage extends S.Class<ReviewedPage>($I`ReviewedPage`)(
  {
    file: S.NonEmptyString.annotateKey({ description: "Base name of the reviewer's PDF." }),
    pdfSha256: Sha256Hex.annotateKey({ description: "Hash of the reviewer's PDF." }),
    page: PageNumber.annotateKey({ description: "One-based page in that PDF." }),
    match: SheetMatch.annotateKey({ description: "Sheet of the sent set the page was matched to." }),
    notes: S.Array(MarkupNote).annotateKey({ description: "Notes read from the page, top to bottom." }),
  },
  $I.annote("ReviewedPage", { description: "A reviewer page, its sheet match, and its notes." })
) {}

/**
 * `intake.json` of a review round: every reviewer page and what was read.
 *
 * **Example** (An empty intake)
 *
 * ```ts
 * import { ReviewIntake } from "@beep/repo-cli/commands/Drawings"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const intake = ReviewIntake.make({
 *   schemaVersion: "drawing-review-intake/v1",
 *   round: 1,
 *   reviewedSheetSetSha256: Sha256Hex.make("a".repeat(64)),
 *   pages: []
 * })
 * console.log(intake.pages.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewIntake extends S.Class<ReviewIntake>($I`ReviewIntake`)(
  {
    schemaVersion: S.Literal("drawing-review-intake/v1").annotateKey({ description: "Schema version." }),
    round: RoundNumber.annotateKey({ description: "One-based review round." }),
    reviewedSheetSetSha256: Sha256Hex.annotateKey({ description: "Hash of the sheet-set PDF that was sent." }),
    pages: S.Array(ReviewedPage).annotateKey({ description: "Every reviewer page, in file then page order." }),
  },
  $I.annote("ReviewIntake", { description: "The reviewer pages of one round and what was read from them." })
) {}

/**
 * `inventory.json` of a review round: the findings and their dispositions.
 *
 * **Example** (An empty inventory)
 *
 * ```ts
 * import { ReviewInventory } from "@beep/repo-cli/commands/Drawings"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const inventory = ReviewInventory.make({
 *   schemaVersion: "drawing-review-inventory/v1",
 *   round: 1,
 *   reviewedSheetSetSha256: Sha256Hex.make("a".repeat(64)),
 *   findings: []
 * })
 * console.log(inventory.findings.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewInventory extends S.Class<ReviewInventory>($I`ReviewInventory`)(
  {
    schemaVersion: S.Literal("drawing-review-inventory/v1").annotateKey({ description: "Schema version." }),
    round: RoundNumber.annotateKey({ description: "One-based review round." }),
    reviewedSheetSetSha256: Sha256Hex.annotateKey({ description: "Hash of the sheet-set PDF that was sent." }),
    findings: S.Array(ReviewFinding).annotateKey({ description: "Every finding, in id order." }),
  },
  $I.annote("ReviewInventory", { description: "The findings of one review round." })
) {}

/**
 * One row of a dispositions file: the triage of one finding.
 *
 * **Example** (Decline a request)
 *
 * ```ts
 * import { Disposition, DispositionEntry, ReviewFindingId } from "@beep/repo-cli/commands/Drawings"
 *
 * const entry = DispositionEntry.make({
 *   id: ReviewFindingId.make("A1-02"),
 *   severity: "P2",
 *   lens: "extraneous-detail",
 *   disposition: Disposition.cases.decline.make({ kind: "decline", reason: "Already drawn that way." })
 * })
 * console.log(entry.severity)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DispositionEntry extends S.Class<DispositionEntry>($I`DispositionEntry`)(
  {
    id: ReviewFindingId.annotateKey({ description: "Finding this row disposes of." }),
    severity: QaSeverity.annotateKey({ description: "Severity after triage." }),
    lens: DrawingQaLens.annotateKey({ description: "Drawing-rubric lens after triage." }),
    disposition: Disposition.annotateKey({ description: "How the finding is handled." }),
  },
  $I.annote("DispositionEntry", { description: "Severity, lens, and disposition of one finding." })
) {}

/**
 * `dispositions.json` of a review round: one entry for every finding.
 *
 * **Example** (An empty file)
 *
 * ```ts
 * import { ReviewDispositions } from "@beep/repo-cli/commands/Drawings"
 *
 * const file = ReviewDispositions.make({ schemaVersion: "drawing-review-dispositions/v1", round: 1, entries: [] })
 * console.log(file.entries.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewDispositions extends S.Class<ReviewDispositions>($I`ReviewDispositions`)(
  {
    schemaVersion: S.Literal("drawing-review-dispositions/v1").annotateKey({ description: "Schema version." }),
    round: RoundNumber.annotateKey({ description: "One-based review round." }),
    entries: S.Array(DispositionEntry).annotateKey({ description: "One entry per finding." }),
  },
  $I.annote("ReviewDispositions", { description: "The triage of every finding in one review round." })
) {}

/**
 * One attachment as the mailbox stored it.
 *
 * **Example** (The sheet-set PDF)
 *
 * ```ts
 * import { DeliveryAttachment } from "@beep/repo-cli/commands/Drawings"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * console.log(DeliveryAttachment.make({ name: "sheets.pdf", size: 2048, sha256: Sha256Hex.make("c".repeat(64)) }).name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeliveryAttachment extends S.Class<DeliveryAttachment>($I`DeliveryAttachment`)(
  {
    name: S.NonEmptyString.annotateKey({ description: "Attachment file name." }),
    size: S.Natural.annotateKey({ description: "Attachment size in bytes." }),
    sha256: Sha256Hex.annotateKey({ description: "Hash of the stored attachment bytes." }),
  },
  $I.annote("DeliveryAttachment", { description: "Name, size, and hash of one delivered attachment." })
) {}

/**
 * `delivery.json`: which sheet set, by hash, went out in which message.
 *
 * **Details**
 *
 * Written by `drawings deliver record` from the attachment facts an outbox
 * draft returns, or by hand. A review round opened with it names the sent
 * message and can only ingest pages against that set.
 *
 * **Example** (A recorded draft)
 *
 * ```ts
 * import { DeliveryAttachment, DeliveryRecord } from "@beep/repo-cli/commands/Drawings"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as O from "effect/Option"
 *
 * const hash = Sha256Hex.make("c".repeat(64))
 * const record = DeliveryRecord.make({
 *   schemaVersion: "drawing-delivery/v1",
 *   sheetSetSha256: hash,
 *   pdfSha256: hash,
 *   draftId: O.some("AAMk-draft"),
 *   attachments: [DeliveryAttachment.make({ name: "sheets.pdf", size: 2048, sha256: hash })],
 *   deliveredAt: "2026-10-13T12:00:00.000Z"
 * })
 * console.log(record.attachments.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeliveryRecord extends S.Class<DeliveryRecord>($I`DeliveryRecord`)(
  {
    schemaVersion: S.Literal("drawing-delivery/v1").annotateKey({ description: "Schema version." }),
    sheetSetSha256: Sha256Hex.annotateKey({ description: "Sheet-set hash recorded in the render manifest." }),
    pdfSha256: Sha256Hex.annotateKey({ description: "Hash of the sheet-set PDF re-read from disk at record time." }),
    draftId: optionalText("Outbox draft id, when the record came from a draft."),
    sentMessageId: optionalText("Graph id of the sent message, when known."),
    internetMessageId: optionalText("Internet Message-ID of the sent message, when known."),
    attachments: S.Array(DeliveryAttachment).annotateKey({ description: "Every attachment the message carried." }),
    deliveredAt: S.NonEmptyString.annotateKey({ description: "ISO-8601 time the record was written." }),
  },
  $I.annote("DeliveryRecord", {
    description: "Sheet-set hash, message ids, and attachment digests of one delivery to the reviewer.",
  })
) {}

/**
 * The attachment facts an outbox draft returns (`m365_outbox_create_draft`
 * or `m365_outbox_get_draft`); other fields are ignored.
 *
 * **Example** (A created draft)
 *
 * ```ts
 * import { DeliveryDraftFacts } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const facts = DeliveryDraftFacts.make({ draftId: O.some("AAMk-draft"), attachments: [] })
 * console.log(facts.attachments.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeliveryDraftFacts extends S.Class<DeliveryDraftFacts>($I`DeliveryDraftFacts`)(
  {
    draftId: optionalText("Outbox draft id."),
    attachments: S.Array(DeliveryAttachment).annotateKey({ description: "Attachments as the draft stores them." }),
  },
  $I.annote("DeliveryDraftFacts", { description: "Draft id and attachment digests returned by the outbox." })
) {}

/**
 * One sheet of the sent set scored against a reviewer page.
 *
 * **Example** (FIG. 1 fully covered)
 *
 * ```ts
 * import { SheetCandidate } from "@beep/repo-cli/commands/Drawings"
 * import { InkCoverage } from "@beep/pdf-tools"
 *
 * const candidate = SheetCandidate.make({
 *   figure: 1,
 *   page: 1,
 *   coverage: InkCoverage.make({ baseInkPixels: 900, coveredPixels: 900, markedInkPixels: 1100, coverage: 1 })
 * })
 * console.log(candidate.coverage.coverage)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SheetCandidate extends S.Class<SheetCandidate>($I`SheetCandidate`)(
  {
    figure: FigureNumber.annotateKey({ description: "FIG. number of the sheet." }),
    page: PageNumber.annotateKey({ description: "Page of the sheet-set PDF that holds the sheet." }),
    coverage: InkCoverage.annotateKey({ description: "How much of the sheet's ink the reviewer page covers." }),
  },
  $I.annote("SheetCandidate", { description: "One sheet of the sent set and its ink coverage by a reviewer page." })
) {}

/**
 * An operator's `--figure <file>[:<page>]=<FIG.>`: the sheet a reviewer page
 * shows when ink coverage cannot decide.
 *
 * **Example** (Page 1 of Fig4.pdf is FIG. 4)
 *
 * ```ts
 * import { FigureOverride } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(FigureOverride.make({ file: "Fig4.pdf", page: 1, figure: 4 }).figure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FigureOverride extends S.Class<FigureOverride>($I`FigureOverride`)(
  {
    file: S.NonEmptyString.annotateKey({ description: "Base name of the reviewer's PDF." }),
    page: PageNumber.annotateKey({ description: "Page in that PDF." }),
    figure: FigureNumber.annotateKey({ description: "FIG. the page shows." }),
  },
  $I.annote("FigureOverride", { description: "Operator-named sheet for one reviewer page." })
) {}

/**
 * Where a review round lives: `<matter>/review/round-<n>/` under the corpus
 * root. The matter directory must resolve inside the corpus root.
 *
 * **Example** (Round 1 of a matter)
 *
 * ```ts
 * import { ReviewRoundLocation } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(ReviewRoundLocation.make({ corpusRoot: "/corpus", matter: "matters/m-1", round: 1 }).round)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewRoundLocation extends S.Class<ReviewRoundLocation>($I`ReviewRoundLocation`)(
  {
    corpusRoot: S.NonEmptyString.annotateKey({ description: "Corpus root every round file must live under." }),
    matter: S.NonEmptyString.annotateKey({ description: "Matter directory, absolute or relative to the root." }),
    round: RoundNumber.annotateKey({ description: "One-based review round." }),
  },
  $I.annote("ReviewRoundLocation", { description: "Corpus root, matter directory, and round number." })
) {}

/**
 * Open a review round over the sheet set that was sent.
 *
 * **Example** (Open round 1 from a manifest)
 *
 * ```ts
 * import { ReviewOpenRequest, ReviewRoundLocation } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const request = ReviewOpenRequest.make({
 *   location: ReviewRoundLocation.make({ corpusRoot: "/corpus", matter: "m-1", round: 1 }),
 *   manifestPath: "/corpus/m-1/work/final/manifest.json",
 *   deliveryPath: O.none()
 * })
 * console.log(request.location.round)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewOpenRequest extends S.Class<ReviewOpenRequest>($I`ReviewOpenRequest`)(
  {
    location: ReviewRoundLocation.annotateKey({ description: "Round to open." }),
    manifestPath: S.NonEmptyString.annotateKey({ description: "Render manifest of the set that was sent." }),
    deliveryPath: S.Option(S.NonEmptyString).annotateKey({ description: "delivery.json of that send, if any." }),
  },
  $I.annote("ReviewOpenRequest", { description: "Round location, sent manifest, and optional delivery record." })
) {}

/**
 * Ingest the pages a reviewer sent back.
 *
 * **Details**
 *
 * Each page is matched to a sheet of the sent set by raster ink coverage at
 * `dpi` with `dilatePx` tolerance; `figureOverrides` name the sheet for pages
 * coverage cannot decide.
 *
 * **Example** (Two reviewer files at the defaults)
 *
 * ```ts
 * import { ReviewIngestRequest, ReviewRoundLocation } from "@beep/repo-cli/commands/Drawings"
 *
 * const request = ReviewIngestRequest.make({
 *   location: ReviewRoundLocation.make({ corpusRoot: "/corpus", matter: "m-1", round: 1 }),
 *   manifestPath: "/corpus/m-1/work/final/manifest.json",
 *   pdfPaths: ["/corpus/m-1/inputs/Fig1.pdf", "/corpus/m-1/inputs/Fig2.pdf"],
 *   figureOverrides: []
 * })
 * console.log(request.dpi, request.dilatePx) // 36 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewIngestRequest extends S.Class<ReviewIngestRequest>($I`ReviewIngestRequest`)(
  {
    location: ReviewRoundLocation.annotateKey({ description: "Round to ingest into." }),
    manifestPath: S.NonEmptyString.annotateKey({ description: "Render manifest of the set that was sent." }),
    pdfPaths: S.NonEmptyArray(S.NonEmptyString).annotateKey({ description: "Reviewer PDFs, under the corpus root." }),
    figureOverrides: S.Array(FigureOverride).annotateKey({ description: "Operator-named sheets for pages." }),
    dpi: Dpi.pipe(
      S.withConstructorDefault(Effect.succeed(36)),
      S.annotateKey({ description: "Raster resolution of the coverage comparison. Defaults to 36." })
    ),
    dilatePx: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(2)),
      S.annotateKey({ description: "Pixels the reviewer ink is grown by before comparing. Defaults to 2." })
    ),
  },
  $I.annote("ReviewIngestRequest", {
    description: "Round location, sent manifest, reviewer PDFs, overrides, and raster settings of an ingest.",
  })
) {}

/**
 * Plan a review round from a dispositions file.
 *
 * **Example** (Plan round 1)
 *
 * ```ts
 * import { ReviewPlanRequest, ReviewRoundLocation } from "@beep/repo-cli/commands/Drawings"
 *
 * const request = ReviewPlanRequest.make({
 *   location: ReviewRoundLocation.make({ corpusRoot: "/corpus", matter: "m-1", round: 1 }),
 *   dispositionsPath: "/corpus/m-1/review/round-1/dispositions.json"
 * })
 * console.log(request.dispositionsPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewPlanRequest extends S.Class<ReviewPlanRequest>($I`ReviewPlanRequest`)(
  {
    location: ReviewRoundLocation.annotateKey({ description: "Round to plan." }),
    dispositionsPath: S.NonEmptyString.annotateKey({ description: "dispositions.json with one entry per finding." }),
  },
  $I.annote("ReviewPlanRequest", { description: "Round location and dispositions file of a plan." })
) {}

/**
 * A review round as stored: its directory, `round.json`, and `intake.json` and
 * `inventory.json` once ingested.
 *
 * **Example** (A round before ingest)
 *
 * ```ts
 * import { ReviewRound, ReviewStatus } from "@beep/repo-cli/commands/Drawings"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as O from "effect/Option"
 *
 * const status = ReviewStatus.make({
 *   roundDir: "/corpus/m-1/review/round-1",
 *   round: ReviewRound.make({
 *     schemaVersion: "drawing-review-round/v1",
 *     round: 1,
 *     status: "open",
 *     reviewedSheetSetSha256: Sha256Hex.make("a".repeat(64))
 *   }),
 *   intake: O.none(),
 *   inventory: O.none()
 * })
 * console.log(status.round.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewStatus extends S.Class<ReviewStatus>($I`ReviewStatus`)(
  {
    roundDir: S.NonEmptyString.annotateKey({ description: "Directory of the round." }),
    round: ReviewRound.annotateKey({ description: "round.json." }),
    intake: S.Option(ReviewIntake).annotateKey({ description: "intake.json, once ingested." }),
    inventory: S.Option(ReviewInventory).annotateKey({ description: "inventory.json, once ingested." }),
  },
  $I.annote("ReviewStatus", { description: "Directory, round record, intake, and inventory of a review round." })
) {}

/**
 * Record a delivery from an outbox draft's attachment facts.
 *
 * **Example** (Record next to the manifest)
 *
 * ```ts
 * import { DeliverRequest } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const request = DeliverRequest.make({
 *   manifestPath: "/corpus/m-1/work/final/manifest.json",
 *   draftPath: "/corpus/m-1/outbox/draft.json",
 *   sentMessageId: O.none(),
 *   internetMessageId: O.none(),
 *   outPath: O.none()
 * })
 * console.log(request.draftPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeliverRequest extends S.Class<DeliverRequest>($I`DeliverRequest`)(
  {
    manifestPath: S.NonEmptyString.annotateKey({ description: "Render manifest of the set that was sent." }),
    draftPath: S.NonEmptyString.annotateKey({ description: "JSON the outbox returned for the draft." }),
    sentMessageId: S.Option(S.NonEmptyString).annotateKey({ description: "Graph id of the sent message." }),
    internetMessageId: S.Option(S.NonEmptyString).annotateKey({ description: "Internet Message-ID, if known." }),
    outPath: S.Option(S.NonEmptyString).annotateKey({
      description: "Where to write; defaults to delivery.json next to the manifest.",
    }),
  },
  $I.annote("DeliverRequest", { description: "Manifest, draft facts, message ids, and output of a delivery record." })
) {}

/**
 * A written delivery record and where it was written.
 *
 * **Example** (Reference the class)
 *
 * ```ts
 * import { DeliveryWritten } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(DeliveryWritten)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeliveryWritten extends S.Class<DeliveryWritten>($I`DeliveryWritten`)(
  {
    path: S.NonEmptyString.annotateKey({ description: "File the record was written to." }),
    record: DeliveryRecord.annotateKey({ description: "The record." }),
  },
  $I.annote("DeliveryWritten", { description: "Path and content of a written delivery record." })
) {}

/**
 * What the review rounds say about printing an approval statement for a set:
 * reasons to refuse, and warnings to print with the statement.
 *
 * **Example** (Nothing in the way)
 *
 * ```ts
 * import { ReviewGuardVerdict } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(ReviewGuardVerdict.make({ refusals: [], warnings: [] }).refusals.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewGuardVerdict extends S.Class<ReviewGuardVerdict>($I`ReviewGuardVerdict`)(
  {
    refusals: S.Array(S.String).annotateKey({ description: "Why the statement must not be printed." }),
    warnings: S.Array(S.String).annotateKey({ description: "What to print alongside the statement." }),
  },
  $I.annote("ReviewGuardVerdict", { description: "Refusals and warnings for an approval statement." })
) {}
