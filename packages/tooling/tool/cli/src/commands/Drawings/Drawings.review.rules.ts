/**
 * Pure review-round rules: match a reviewer page to a sheet of the sent set,
 * read the notes a reviewer left, merge repeated notes, number the findings,
 * apply dispositions, and decide whether an approval may be printed or
 * recorded.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, Str } from "@beep/utils";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import { isRequiredSeverity } from "../Qa/Inventory.schemas.ts";
import {
  Disposition,
  FigureOverride,
  MarkupNote,
  ReviewFinding,
  ReviewFindingId,
  ReviewFindingRef,
  ReviewGuardVerdict,
  SheetMatch,
} from "./Drawings.review.schemas.ts";
import type { PdfAnnotation, TextBlock } from "@beep/pdf-tools";
import type { Sha256Hex } from "@beep/schema";
import type {
  DispositionEntry,
  ReviewedPage,
  ReviewFindingStatus,
  ReviewPageRef,
  ReviewRound,
  SheetCandidate,
} from "./Drawings.review.schemas.ts";

/**
 * Least share of a sheet's ink a reviewer page must cover to match it.
 *
 * **Example** (Read the threshold)
 *
 * ```ts
 * import { MATCH_MIN_COVERAGE } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(MATCH_MIN_COVERAGE) // 0.98
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MATCH_MIN_COVERAGE = 0.98;

/**
 * How far the winner's covered ink must lead the runner-up's, as a share of
 * the winner's: a sparse sheet whose strokes all sit on a denser sheet also
 * reaches full coverage, so the denser match must win clearly.
 *
 * **Example** (Read the margin)
 *
 * ```ts
 * import { MATCH_MARGIN } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(MATCH_MARGIN) // 0.1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MATCH_MARGIN = 0.1;

/**
 * Least share of the reviewer page's own ink the matched sheet must account
 * for: a page from another set can contain every stroke of a sparse sheet
 * while being a different drawing.
 *
 * **Example** (Read the share)
 *
 * ```ts
 * import { MATCH_MIN_PAGE_SHARE } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(MATCH_MIN_PAGE_SHARE) // 0.2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MATCH_MIN_PAGE_SHARE = 0.2;

const ALL_SHEETS_MARK = /\(\s*all\s+sheets\s*\)/i;
const WHITESPACE = /\s+/g;
const OVERRIDE = /^(.+?)(?::(\d+))?=(\d+)$/;
const IGNORED_ANNOTATIONS = HashSet.fromIterable(["Link", "Popup"]);

const fixed = (value: number): string => value.toFixed(3);

const byCoveredDescending = Order.flip(
  Order.mapInput(Order.Number, (candidate: SheetCandidate) => candidate.coverage.coveredPixels)
);

const byCoverageDescending = Order.flip(
  Order.mapInput(Order.Number, (candidate: SheetCandidate) => candidate.coverage.coverage)
);

const pageShare = (candidate: SheetCandidate): number =>
  candidate.coverage.markedInkPixels === 0 ? 0 : candidate.coverage.coveredPixels / candidate.coverage.markedInkPixels;

/**
 * Tie one reviewer page to one sheet of the sent set.
 *
 * **Details**
 *
 * With an override the named FIG. wins outright. Otherwise the sheets
 * reaching {@link MATCH_MIN_COVERAGE} are ranked by covered ink: the leader
 * must beat the runner-up by {@link MATCH_MARGIN} and account for
 * {@link MATCH_MIN_PAGE_SHARE} of the page's ink, or the page is refused.
 *
 * **Example** (One clear winner)
 *
 * ```ts
 * import { matchSheet, SheetCandidate } from "@beep/repo-cli/commands/Drawings"
 * import { InkCoverage } from "@beep/pdf-tools"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 *
 * const result = matchSheet({
 *   sheetSetSha256: Sha256Hex.make("a".repeat(64)),
 *   candidates: [
 *     SheetCandidate.make({
 *       figure: 1,
 *       page: 1,
 *       coverage: InkCoverage.make({ baseInkPixels: 900, coveredPixels: 900, markedInkPixels: 1000, coverage: 1 })
 *     })
 *   ],
 *   override: O.none()
 * })
 * console.log(Result.isSuccess(result)) // true
 * ```
 *
 * @param input - Sheet-set hash, every sheet's coverage, and an optional operator FIG.
 * @returns The match, or why the page cannot be tied to one sheet.
 * @category utilities
 * @since 0.0.0
 */
export const matchSheet = (input: {
  readonly sheetSetSha256: Sha256Hex;
  readonly candidates: ReadonlyArray<SheetCandidate>;
  readonly override: O.Option<number>;
}): Result.Result<SheetMatch, string> => {
  const make = (candidate: SheetCandidate, basis: SheetMatch["basis"]) =>
    SheetMatch.make({
      sheetSetSha256: input.sheetSetSha256,
      figure: candidate.figure,
      page: candidate.page,
      coverage: candidate.coverage.coverage,
      basis,
    });
  if (O.isSome(input.override)) {
    const figure = input.override.value;
    return pipe(
      A.findFirst(input.candidates, (candidate) => candidate.figure === figure),
      O.match({
        onNone: () => Result.fail(`FIG. ${figure} is not a sheet of the sent set`),
        onSome: (candidate) => Result.succeed(make(candidate, "operator")),
      })
    );
  }
  const qualifiers = pipe(
    input.candidates,
    A.filter((candidate) => candidate.coverage.coverage >= MATCH_MIN_COVERAGE),
    A.sort(byCoveredDescending)
  );
  const best = pipe(
    A.sort(input.candidates, byCoverageDescending),
    A.head,
    O.match({
      onNone: () => "the sent set has no sheets",
      onSome: (candidate) => `best is FIG. ${candidate.figure} at ${fixed(candidate.coverage.coverage)}`,
    })
  );
  const [winner, runnerUp] = qualifiers;
  if (winner === undefined) {
    return Result.fail(`no sheet reaches ${MATCH_MIN_COVERAGE} ink coverage (${best})`);
  }
  if (runnerUp !== undefined && runnerUp.coverage.coveredPixels > (1 - MATCH_MARGIN) * winner.coverage.coveredPixels) {
    return Result.fail(
      `FIG. ${winner.figure} and FIG. ${runnerUp.figure} both reach ${MATCH_MIN_COVERAGE} coverage with nearly the same ink (${winner.coverage.coveredPixels} and ${runnerUp.coverage.coveredPixels} pixels)`
    );
  }
  if (pageShare(winner) < MATCH_MIN_PAGE_SHARE) {
    return Result.fail(
      `FIG. ${winner.figure} reaches ${fixed(winner.coverage.coverage)} coverage but accounts for only ${fixed(pageShare(winner))} of the page's ink; the page may show a sheet that was not sent`
    );
  }
  return Result.succeed(make(winner, "ink-coverage"));
};

/**
 * Parse an operator's `--figure <file>[:<page>]=<FIG.>`; the page defaults to 1.
 *
 * **Example** (Page 2 of a two-page file)
 *
 * ```ts
 * import { parseFigureOverride } from "@beep/repo-cli/commands/Drawings"
 * import * as Result from "effect/Result"
 *
 * console.log(Result.isSuccess(parseFigureOverride("Fig3.pdf:2=4"))) // true
 * ```
 *
 * @param text - The flag value.
 * @returns The override, or why the value is malformed.
 * @category utilities
 * @since 0.0.0
 */
export const parseFigureOverride = (text: string): Result.Result<FigureOverride, string> => {
  const match = OVERRIDE.exec(Str.trim(text));
  const file = match?.[1];
  const figure = Number(match?.[3] ?? "0");
  const page = Number(match?.[2] ?? "1");
  return file === undefined || figure < 1 || page < 1
    ? Result.fail(`"${text}" is not <file>[:<page>]=<FIG.> with a FIG. and page of at least 1`)
    : Result.succeed(FigureOverride.make({ file, page, figure }));
};

const normalize = (text: string): string => Str.toLowerCase(Str.trim(text.replace(WHITESPACE, " ")));

/**
 * Whether a note says it applies to every sheet ("(all sheets)").
 *
 * **Example** (Detect the marker)
 *
 * ```ts
 * import { isAllSheetsNote } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(isAllSheetsNote("Margins 1 in (All Sheets)")) // true
 * ```
 *
 * @param text - Text of one reviewer note, as extracted.
 * @returns True when the text carries the marker.
 * @category utilities
 * @since 0.0.0
 */
export const isAllSheetsNote = (text: string): boolean => ALL_SHEETS_MARK.test(text);

const readingOrder = Order.combine(
  Order.mapInput(Order.Number, (note: MarkupNote) => note.rect.yMin),
  Order.mapInput(Order.Number, (note: MarkupNote) => note.rect.xMin)
);

/**
 * The notes drawn into a reviewer page: every text block that is not also on
 * the sheet it matched, kept verbatim, top to bottom.
 *
 * **Example** (One added block)
 *
 * ```ts
 * import { ReviewPageRef, textLayerNotes } from "@beep/repo-cli/commands/Drawings"
 * import { PdfRect, TextBlock } from "@beep/pdf-tools"
 *
 * const rect = PdfRect.make({ xMin: 72, yMin: 80, xMax: 180, yMax: 94 })
 * const notes = textLayerNotes({
 *   pageBlocks: [TextBlock.make({ text: "FIG. 1", rect }), TextBlock.make({ text: "Make it taller", rect })],
 *   baseBlocks: [TextBlock.make({ text: "FIG. 1", rect })],
 *   source: ReviewPageRef.make({ file: "Fig1.pdf", page: 1 })
 * })
 * console.log(notes.map((note) => note.text)) // ["Make it taller"]
 * ```
 *
 * @param input - The reviewer page's blocks, the sheet's blocks, and the page.
 * @returns The added blocks as text-layer notes.
 * @category utilities
 * @since 0.0.0
 */
export const textLayerNotes = (input: {
  readonly pageBlocks: ReadonlyArray<TextBlock>;
  readonly baseBlocks: ReadonlyArray<TextBlock>;
  readonly source: ReviewPageRef;
}): ReadonlyArray<MarkupNote> => {
  const onSheet = HashSet.fromIterable(A.map(input.baseBlocks, (block) => normalize(block.text)));
  return pipe(
    input.pageBlocks,
    A.filter((block) => Str.isNonEmpty(normalize(block.text)) && !HashSet.has(onSheet, normalize(block.text))),
    A.map((block) =>
      MarkupNote.make({ text: block.text, rect: block.rect, origin: "text-layer", source: input.source })
    ),
    A.sort(readingOrder)
  );
};

/**
 * The comments a reviewer attached to one page as annotation objects; links,
 * popups, and annotations without text are skipped.
 *
 * **Example** (No annotations)
 *
 * ```ts
 * import { annotationNotes, ReviewPageRef } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(annotationNotes({ annotations: [], source: ReviewPageRef.make({ file: "Fig1.pdf", page: 1 }) }).length)
 * ```
 *
 * @param input - Every annotation of the file and the page to read.
 * @returns The page's comments as annotation notes.
 * @category utilities
 * @since 0.0.0
 */
export const annotationNotes = (input: {
  readonly annotations: ReadonlyArray<PdfAnnotation>;
  readonly source: ReviewPageRef;
}): ReadonlyArray<MarkupNote> =>
  pipe(
    input.annotations,
    A.filter(
      (annotation) => annotation.page === input.source.page && !HashSet.has(IGNORED_ANNOTATIONS, annotation.subtype)
    ),
    A.map((annotation) =>
      pipe(
        annotation.contents,
        O.filter((text) => Str.isNonEmpty(Str.trim(text))),
        O.map((text) => MarkupNote.make({ text, rect: annotation.rect, origin: "annotation", source: input.source }))
      )
    ),
    A.getSomes,
    A.sort(readingOrder)
  );

type FindingDraft = {
  readonly marked: boolean;
  readonly figures: ReadonlyArray<number>;
  readonly notes: A.NonEmptyReadonlyArray<MarkupNote>;
};

type DraftState = {
  readonly drafts: ReadonlyArray<FindingDraft>;
  readonly byText: HashMap.HashMap<string, number>;
};

// Every note with the same normalised text joins one draft, wherever it sits.
const addNote = (state: DraftState, entry: { readonly figure: number; readonly note: MarkupNote }): DraftState => {
  const key = normalize(entry.note.text);
  return pipe(
    HashMap.get(state.byText, key),
    O.match({
      onNone: () => ({
        drafts: A.append(state.drafts, {
          marked: isAllSheetsNote(entry.note.text),
          figures: [entry.figure],
          notes: [entry.note],
        }),
        byText: HashMap.set(state.byText, key, A.length(state.drafts)),
      }),
      onSome: (index) => ({
        ...state,
        drafts: pipe(
          A.modify(state.drafts, index, (draft) => ({
            ...draft,
            figures: A.contains(draft.figures, entry.figure) ? draft.figures : A.append(draft.figures, entry.figure),
            notes: A.append(draft.notes, entry.note),
          })),
          O.getOrElse(() => state.drafts)
        ),
      }),
    })
  );
};

const MAX_FINDINGS = 99;

// A draft covers every sheet when it is marked "(all sheets)" or was read on
// every sheet of a set of two or more.
const coversEverySheet = (draft: FindingDraft, sheets: ReadonlyArray<number>): boolean =>
  draft.marked || (A.length(sheets) > 1 && A.every(sheets, (sheet) => A.contains(draft.figures, sheet)));

/**
 * Turn ingested pages into numbered findings: one per distinct note text,
 * however many pages, or places on one page, repeat it.
 *
 * **Details**
 *
 * Notes are compared by whitespace- and case-normalised text and kept
 * verbatim. A note marked "(all sheets)", or read on every sheet of the sent
 * set, becomes one `all-sheets` finding; any other note becomes a `sheet`
 * finding that lists the FIG.s it was read on. Findings open at `P1` with no
 * lens or disposition: an attorney request is required until it is triaged.
 * Ids run `A<round>-01` upward in the order each text first appears (page,
 * then reading order).
 *
 * **Example** (No pages)
 *
 * ```ts
 * import { buildFindings } from "@beep/repo-cli/commands/Drawings"
 * import * as Result from "effect/Result"
 *
 * console.log(Result.getOrElse(buildFindings({ round: 1, sheets: [1, 2], pages: [] }), () => []).length) // 0
 * ```
 *
 * @param input - Round number, the FIG.s of the sent set, and the ingested pages.
 * @returns The findings, or a refusal when they would overflow the two-digit ids.
 * @category utilities
 * @since 0.0.0
 */
export const buildFindings = (input: {
  readonly round: number;
  readonly sheets: ReadonlyArray<number>;
  readonly pages: ReadonlyArray<ReviewedPage>;
}): Result.Result<ReadonlyArray<ReviewFinding>, string> => {
  const entries = A.flatMap(input.pages, (page) => A.map(page.notes, (note) => ({ figure: page.match.figure, note })));
  const { drafts } = A.reduce(entries, { drafts: [], byText: HashMap.empty() } as DraftState, addNote);
  if (A.length(drafts) > MAX_FINDINGS) {
    return Result.fail(`${A.length(drafts)} findings exceed the ${MAX_FINDINGS} a round can number`);
  }
  return Result.succeed(
    A.map(drafts, (draft, index) => {
      const every = coversEverySheet(draft, input.sheets);
      return ReviewFinding.make({
        id: ReviewFindingId.make(`A${input.round}-${`${index + 1}`.padStart(2, "0")}`),
        severity: "P1",
        scope: every ? "all-sheets" : "sheet",
        figures: every ? [] : A.sort(draft.figures, Order.Number),
        notes: draft.notes,
        status: "open",
      });
    })
  );
};

/**
 * Qualify a round-local finding id with the reviewed sheet set, for every use
 * outside the round's files.
 *
 * **Example** (Qualify A1-03)
 *
 * ```ts
 * import { ReviewFindingId, reviewFindingRef } from "@beep/repo-cli/commands/Drawings"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { pipe } from "effect/Function"
 *
 * const set = Sha256Hex.make("a".repeat(64))
 * console.log(reviewFindingRef(ReviewFindingId.make("A1-03"), set)) // "A1-03@aaaaaaaaaaaa"
 * console.log(pipe(ReviewFindingId.make("A1-04"), reviewFindingRef(set))) // "A1-04@aaaaaaaaaaaa"
 * ```
 *
 * @param id - The finding id inside its round.
 * @param sheetSetSha256 - Hash of the sheet set the round reviewed.
 * @returns `A<round>-<nn>@<first 12 hex digits of the hash>`.
 * @category utilities
 * @since 0.0.0
 */
export const reviewFindingRef: {
  (sheetSetSha256: Sha256Hex): (id: ReviewFindingId) => ReviewFindingRef;
  (id: ReviewFindingId, sheetSetSha256: Sha256Hex): ReviewFindingRef;
} = dual(
  2,
  (id: ReviewFindingId, sheetSetSha256: Sha256Hex): ReviewFindingRef =>
    ReviewFindingRef.make(`${id}@${sheetSetSha256.slice(0, 12)}`)
);

const planned = (): ReviewFindingStatus => "planned";

const statusFor: (disposition: Disposition) => ReviewFindingStatus = Disposition.match({
  "spec-change": planned,
  "code-change": planned,
  decision: planned,
  clarify: (): ReviewFindingStatus => "clarify",
  decline: (): ReviewFindingStatus => "declined",
});

/**
 * Apply a dispositions file to a round's findings.
 *
 * **Details**
 *
 * Every finding needs exactly one entry and every entry must name a finding;
 * otherwise nothing is applied. A finding already `resolved` stays resolved.
 *
 * **Example** (Nothing to plan)
 *
 * ```ts
 * import { applyDispositions } from "@beep/repo-cli/commands/Drawings"
 * import * as Result from "effect/Result"
 *
 * console.log(Result.isSuccess(applyDispositions({ findings: [], entries: [] }))) // true
 * ```
 *
 * @param input - The round's findings and the dispositions file's entries.
 * @returns The planned findings, or the ids that are missing, unknown, or repeated.
 * @category utilities
 * @since 0.0.0
 */
export const applyDispositions = (input: {
  readonly findings: ReadonlyArray<ReviewFinding>;
  readonly entries: ReadonlyArray<DispositionEntry>;
}): Result.Result<ReadonlyArray<ReviewFinding>, string> => {
  const known = HashSet.fromIterable(A.map(input.findings, (finding) => finding.id));
  const byId = HashMap.fromIterable(A.map(input.entries, (entry) => [entry.id, entry] as const));
  const counts = A.reduce(input.entries, HashMap.empty<string, number>(), (seen, entry) =>
    HashMap.set(seen, entry.id, O.getOrElse(HashMap.get(seen, entry.id), () => 0) + 1)
  );
  const repeated = pipe(
    A.fromIterable(counts),
    A.filter(([, count]) => count > 1),
    A.map(([id]) => id)
  );
  const problems = [
    ...pipe(
      input.findings,
      A.filter((finding) => !HashMap.has(byId, finding.id)),
      A.map((finding) => `${finding.id} has no disposition`)
    ),
    ...pipe(
      input.entries,
      A.filter((entry) => !HashSet.has(known, entry.id)),
      A.map((entry) => `${entry.id} is not a finding of this round`)
    ),
    ...A.map(repeated, (id) => `${id} is disposed of more than once`),
  ];
  if (A.isReadonlyArrayNonEmpty(problems)) {
    return Result.fail(A.join(problems, "\n"));
  }
  return Result.succeed(
    A.map(input.findings, (finding) =>
      pipe(
        HashMap.get(byId, finding.id),
        O.match({
          onNone: () => finding,
          onSome: (entry) =>
            ReviewFinding.make({
              ...finding,
              severity: entry.severity,
              lens: O.some(entry.lens),
              disposition: O.some(entry.disposition),
              status: finding.status === "resolved" ? "resolved" : statusFor(entry.disposition),
            }),
        })
      )
    )
  );
};

/**
 * Required (P0, P1) findings that are neither resolved nor declined.
 *
 * **Example** (No findings)
 *
 * ```ts
 * import { openRequiredFindings } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(openRequiredFindings([]).length) // 0
 * ```
 *
 * @param findings - A round's findings.
 * @returns The findings still blocking sign-off.
 * @category utilities
 * @since 0.0.0
 */
export const openRequiredFindings = (findings: ReadonlyArray<ReviewFinding>): ReadonlyArray<ReviewFinding> =>
  A.filter(
    findings,
    (finding) => isRequiredSeverity(finding.severity) && finding.status !== "resolved" && finding.status !== "declined"
  );

/**
 * Decide whether an approval for a sheet set may be printed (`statement`) or
 * recorded (`sign`).
 *
 * **Details**
 *
 * Every round of the matter counts, whatever set it reviewed: a round with
 * open required findings refuses, and so does a round that has not been
 * ingested, because unknown findings are not zero findings. Rendering another
 * set, a shaded twin of the reviewed spec included, never clears a round;
 * only resolving or declining its findings does. The refusal names how the
 * target relates to the reviewed set: the same set, another render of the
 * same spec, or another set of the matter.
 *
 * **Example** (No rounds)
 *
 * ```ts
 * import { statementGuard } from "@beep/repo-cli/commands/Drawings"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as O from "effect/Option"
 *
 * const verdict = statementGuard({ sheetSetSha256: Sha256Hex.make("a".repeat(64)), specSha256: O.none(), rounds: [] })
 * console.log(verdict.refusals.length) // 0
 * ```
 *
 * @param input - The target set's hash and spec hash, and every round of the matter with its findings.
 * @returns The refusals (warnings stay empty; the service adds its own).
 * @category utilities
 * @since 0.0.0
 */
export const statementGuard = (input: {
  readonly sheetSetSha256: Sha256Hex;
  readonly specSha256: O.Option<Sha256Hex>;
  readonly rounds: ReadonlyArray<{
    readonly round: ReviewRound;
    readonly findings: O.Option<ReadonlyArray<ReviewFinding>>;
  }>;
}): ReviewGuardVerdict => {
  const refs = (round: ReviewRound, findings: ReadonlyArray<ReviewFinding>) =>
    A.join(
      A.map(findings, (finding) => reviewFindingRef(finding.id, round.reviewedSheetSetSha256)),
      ", "
    );
  const where = (round: ReviewRound): string => {
    const set = round.reviewedSheetSetSha256.slice(0, 12);
    if (round.reviewedSheetSetSha256 === input.sheetSetSha256) {
      return "this sheet set";
    }
    const sameSpec = O.isSome(input.specSha256) && O.contains(round.reviewedSpecSha256, input.specSha256.value);
    return sameSpec
      ? `sheet set ${set}, rendered from this set's spec`
      : `sheet set ${set}, another set of this matter`;
  };
  const refusals = A.map(input.rounds, ({ round, findings }) =>
    O.match(findings, {
      onNone: () =>
        O.some(
          `review round ${round.round} on ${where(round)} has not been ingested; its findings are unknown, not zero`
        ),
      onSome: (all) => {
        const open = openRequiredFindings(all);
        return A.isReadonlyArrayEmpty(open)
          ? O.none<string>()
          : O.some(
              `review round ${round.round} has ${A.length(open)} open required finding(s) on ${where(round)}: ${refs(round, open)}`
            );
      },
    })
  );
  return ReviewGuardVerdict.make({ refusals: A.getSomes(refusals), warnings: [] });
};

const cell = (text: string): string => text.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

const dispositionText: (disposition: Disposition) => string = Disposition.match({
  "spec-change": ({ pointer, summary }) => `spec change at ${pointer}: ${summary}`,
  "code-change": ({ pr, summary }) => `code change in ${pr}: ${summary}`,
  decision: ({ decisionRow, reverses }) =>
    `decision ${decisionRow}${O.match(reverses, { onNone: () => "", onSome: (row) => ` (reverses ${row})` })}`,
  clarify: ({ question }) => `asked the attorney: ${question}`,
  decline: ({ reason }) => `declined: ${reason}`,
});

const requestText = (finding: ReviewFinding): string =>
  pipe(
    finding.notes,
    A.map((note) => note.text),
    A.dedupeWith((left, right) => normalize(left) === normalize(right)),
    A.join(" / ")
  );

/**
 * FIG.s a finding applies to, for one table cell or status line: "all", or
 * the listed numbers.
 *
 * **Example** (Two sheets)
 *
 * ```ts
 * import { findingFigures } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(findingFigures({ scope: "sheet", figures: [2, 5] })) // "2, 5"
 * ```
 *
 * @param finding - The finding's scope and figures.
 * @returns "all", or the FIG. numbers joined by commas.
 * @category utilities
 * @since 0.0.0
 */
export const findingFigures = (finding: Pick<ReviewFinding, "scope" | "figures">): string =>
  finding.scope === "all-sheets"
    ? "all"
    : A.join(
        A.map(finding.figures, (figure) => `${figure}`),
        ", "
      );

/**
 * The reviewer-requests section a judge pack carries when it checks a
 * re-render against a review round: one row per finding, verbatim, each
 * named by its {@link ReviewFindingRef}.
 *
 * **Example** (An empty round)
 *
 * ```ts
 * import { reviewerRequestsSection } from "@beep/repo-cli/commands/Drawings"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * console.log(reviewerRequestsSection({ round: 1, sheetSetSha256: Sha256Hex.make("a".repeat(64)), findings: [] }))
 * ```
 *
 * @param input - Round number, reviewed set hash, and the round's findings.
 * @returns Markdown: a heading, the judge's instructions, and the table.
 * @category utilities
 * @since 0.0.0
 */
export const reviewerRequestsSection = (input: {
  readonly round: number;
  readonly sheetSetSha256: Sha256Hex;
  readonly findings: ReadonlyArray<ReviewFinding>;
}): string =>
  [
    `### Reviewer requests (review round ${input.round}, on sheet set ${input.sheetSetSha256.slice(0, 12)})`,
    "",
    "The attorney marked up an earlier set with the requests below. Check each one on these sheets.",
    "A request these sheets still do not meet is a finding whose title starts with the request id (the whole `A<round>-<nn>@<set>` value).",
    "A request that turns on what the design claims is a question for the attorney, never your ruling.",
    "",
    "| Id | FIG. | Request (verbatim) | Disposition |",
    "| --- | --- | --- | --- |",
    ...A.map(
      input.findings,
      (finding) =>
        `| ${reviewFindingRef(finding.id, input.sheetSetSha256)} | ${findingFigures(finding)} | ${cell(requestText(finding))} | ${cell(
          O.match(finding.disposition, { onNone: () => "not planned yet", onSome: dispositionText })
        )} |`
    ),
  ].join("\n");
