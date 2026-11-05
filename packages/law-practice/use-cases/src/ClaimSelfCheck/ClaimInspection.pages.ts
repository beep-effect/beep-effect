/**
 * Stateless, source-bound delivery pages for local claim inspection.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  ClaimInputCollection,
  ClaimInputInspection,
  ClaimInputRecord,
} from "@beep/law-practice-domain/values/ClaimElement";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("ClaimSelfCheck/ClaimInspection.pages");
const equivalentRecord = S.toEquivalence(ClaimInputRecord);
const inspectionRecord: S.Codec<ClaimInputInspection, typeof ClaimInputInspection.Encoded> = ClaimInputInspection;

/**
 * Resume position bound to the caller's immutable source-version key.
 * **Details**
 * The handler rejects positions outside the supplied ledger. A cursor is not a
 * server-side session or authorization token; callers must repeat the exact ledger.
 * **Example** (Construct a continuation)
 * ```ts
 * import { ClaimInspectionCursor } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * console.log(ClaimInspectionCursor.make({ sourceKey: "version-1", nextSourceOrdinal: 2 }).nextSourceOrdinal) // 2
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClaimInspectionCursor extends S.Opaque<ClaimInspectionCursor, { readonly brand: unique symbol }>()(
  S.Struct({ sourceKey: S.NonEmptyString, nextSourceOrdinal: S.Int }).pipe(
    $I.annoteSchema("ClaimInspectionCursor", {
      description:
        "Source-version key and requested next source position, validated against the ledger by the handler.",
    })
  )
) {}

/**
 * Complete unchanged ledger and optional stateless continuation position.
 * **Example** (Inspect request fields)
 * ```ts
 * import { ClaimInspectionPageRequest } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * console.log(Object.keys(ClaimInspectionPageRequest.fields)) // ["input", "cursor"]
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClaimInspectionPageRequest extends S.Opaque<
  ClaimInspectionPageRequest,
  { readonly brand: unique symbol }
>()(
  S.Struct({ input: ClaimInputCollection, cursor: S.optionalKey(ClaimInspectionCursor) }).pipe(
    $I.annoteSchema("ClaimInspectionPageRequest", {
      description: "Repeat the entire original input on every page request; never drop or renumber records.",
    })
  )
) {}

/**
 * Whole-source coverage counts, independent of which records fit this page.
 * **Example** (Inspect summary fields)
 * ```ts
 * import { ClaimInspectionSummary } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * console.log(Object.keys(ClaimInspectionSummary.fields)) // ["complete", "partial", "unchecked"]
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClaimInspectionSummary extends S.Opaque<ClaimInspectionSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    complete: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    partial: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    unchecked: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  }).pipe(
    $I.annoteSchema("ClaimInspectionSummary", {
      description: "Counts of complete, partial and unchecked outcomes across the entire original source ledger.",
    })
  )
) {}

/**
 * Inclusive one-based source range in this page, plus the whole ledger length.
 * **Example** (Construct a range)
 * ```ts
 * import { ClaimInspectionPageRange } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * console.log(ClaimInspectionPageRange.make({ startSourceOrdinal: 1, endSourceOrdinal: 2, totalRecords: 3 }).totalRecords) // 3
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClaimInspectionPageRange extends S.Opaque<ClaimInspectionPageRange, { readonly brand: unique symbol }>()(
  S.Struct({
    startSourceOrdinal: S.Int.check(S.isGreaterThan(0)),
    endSourceOrdinal: S.Int.check(S.isGreaterThan(0)),
    totalRecords: S.Int.check(S.isGreaterThan(0)),
  }).pipe(
    $I.annoteSchema("ClaimInspectionPageRange", {
      description: "Inclusive contiguous source positions delivered on this page and total source records.",
    })
  )
) {}

const pageFields = S.Struct({
  input: ClaimInputCollection,
  indexStatus: S.Literals(["complete", "incomplete"]),
  summary: ClaimInspectionSummary,
  records: S.NonEmptyArray(inspectionRecord),
  range: ClaimInspectionPageRange,
  deliveryStatus: S.Literals(["complete", "incomplete"]),
  nextCursor: S.OptionFromNullOr(ClaimInspectionCursor),
}).pipe(
  $I.annoteSchema("ClaimInspectionPageFields", {
    description: "Source ledger, whole-source summary and contiguous delivery metadata before cross-field validation.",
  })
);
type PageFields = typeof pageFields.Type;

const validRange = ({ input, records, range }: PageFields) =>
  range.totalRecords === input.records.length &&
  range.startSourceOrdinal <= range.endSourceOrdinal &&
  range.endSourceOrdinal <= range.totalRecords &&
  records.length === range.endSourceOrdinal - range.startSourceOrdinal + 1;
const validSummary = ({ indexStatus, summary, records, range }: PageFields) =>
  summary.complete + summary.partial + summary.unchecked === range.totalRecords &&
  (indexStatus === "complete") === (summary.unchecked === 0) &&
  (indexStatus !== "incomplete" || summary.complete === 0) &&
  A.countBy(records, (record) => record.status === "complete") <= summary.complete &&
  A.countBy(records, (record) => record.status === "partial") <= summary.partial &&
  A.countBy(records, (record) => record.status === "unchecked") <= summary.unchecked;
const validRecords = ({ input, indexStatus, records, range }: PageFields) =>
  A.every(records, (result, index) => {
    const ordinal = range.startSourceOrdinal + index;
    const sameSource = O.exists(A.get(input.records, ordinal - 1), (source) =>
      equivalentRecord(result.decomposition.qualification.record, source)
    );
    const completeCoverage =
      result.status !== "complete" ||
      (indexStatus === "complete" && A.every(result.findings, (finding) => finding.kind !== "pattern-not-covered"));
    return result.decomposition.qualification.record.sourceOrdinal === ordinal && sameSource && completeCoverage;
  });
const validContinuation = ({ input, range, deliveryStatus, nextCursor }: PageFields) =>
  O.match(nextCursor, {
    onNone: () => range.endSourceOrdinal === range.totalRecords && deliveryStatus === "complete",
    onSome: (cursor) =>
      range.endSourceOrdinal < range.totalRecords &&
      deliveryStatus === "incomplete" &&
      cursor.sourceKey === input.sourceKey &&
      cursor.nextSourceOrdinal === range.endSourceOrdinal + 1,
  });

/**
 * Bounded inspection delivery with a full ledger and explicit remaining coverage.
 * **Details**
 * Delivery is incomplete whenever a next cursor is present. Even a final page
 * cannot establish a clean source when whole-source partial or unchecked counts
 * are nonzero. Findings and coverage remain attached to their original records.
 * **Example** (Inspect delivery fields)
 * ```ts
 * import { ClaimInspectionPage } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * console.log(Object.keys(ClaimInspectionPage.fields)) // ["input", "indexStatus", "summary", "records", "range", "deliveryStatus", "nextCursor"]
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClaimInspectionPage extends S.Opaque<ClaimInspectionPage, { readonly brand: unique symbol }>()(
  pageFields
    .check(
      S.makeFilter(
        (page) => validRange(page) && validSummary(page) && validRecords(page) && validContinuation(page),
        $I.annote("ClaimInspectionPageLedgerCheck", {
          title: "Source-bound contiguous inspection delivery",
          description:
            "The page preserves contiguous original records, consistent whole-source counts and an exact source-bound continuation, with explicit incomplete delivery.",
          message: "Retain exact source records and consistent summary, range and continuation coverage.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("ClaimInspectionPage", {
        description:
          "One bounded delivery page; the entire input is retained and all outcomes remain retrievable through source-bound cursors.",
      })
    )
) {}
