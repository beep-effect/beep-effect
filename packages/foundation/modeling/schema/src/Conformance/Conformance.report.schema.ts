/**
 * Conformance issue and report models.
 *
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { $SchemaId } from "../internal/SchemaId.ts";
import { LiteralKit } from "../LiteralKit/index.ts";
import { RequirementStrength } from "./Conformance.invariant.schema.ts";
import { SpecificationReference } from "./Conformance.source.schema.ts";

const $I = $SchemaId.create("Conformance/report");

const ConformanceIssueKind = LiteralKit(["violation", "indeterminate"]);
const ConformancePathSegment = S.Union([S.String, S.Natural]).pipe(
  $I.annoteSchema("ConformancePathSegment", {
    description: "Property name or array index locating a conformance issue.",
  })
);

const violationIssuePathDefault = A.empty<string | number>();
/**
 * Definite violation of a mechanically decidable conformance invariant.
 *
 * **Example** (Report a heading level that skips a step)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { Issue, ViolationIssue } from "@beep/schema/Conformance"
 *
 * const issue = ViolationIssue.make({
 *   invariantId: "md.heading.no-skipped-levels",
 *   strength: "should",
 *   path: ["children", 4],
 *   message: "Heading jumps from level 1 to level 3."
 * })
 *
 * console.log(Issue.guards.violation(issue)) // => true
 * console.log(O.isNone(issue.reference)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ViolationIssue extends S.Opaque<ViolationIssue, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("violation"),
    invariantId: S.NonEmptyString,
    strength: RequirementStrength,
    path: S.Array(ConformancePathSegment).pipe(
      S.withConstructorDefault(Effect.succeed(violationIssuePathDefault)),
      S.withDecodingDefaultType(Effect.succeed(violationIssuePathDefault))
    ),
    message: S.NonEmptyString,
    reference: S.OptionFromOptionalKey(SpecificationReference).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("ViolationIssue", {
      description: "Definite violation of a mechanically decidable conformance invariant.",
    })
  )
) {}

const indeterminateIssuePathDefault = A.empty<string | number>();
/**
 * Invariant outcome that requires context or authority unavailable to the validator.
 *
 * **Example** (Report an invariant that needs the whole document)
 *
 * ```ts
 * import { IndeterminateIssue } from "@beep/schema/Conformance"
 *
 * const issue = IndeterminateIssue.make({
 *   invariantId: "md.link.reference-defined",
 *   message: "Cannot tell whether [spec] resolves.",
 *   reason: "Link reference definitions live outside the checked node."
 * })
 *
 * console.log(issue.path) // => []
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IndeterminateIssue extends S.Opaque<IndeterminateIssue, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("indeterminate"),
    invariantId: S.NonEmptyString,
    path: S.Array(ConformancePathSegment).pipe(
      S.withConstructorDefault(Effect.succeed(indeterminateIssuePathDefault)),
      S.withDecodingDefaultType(Effect.succeed(indeterminateIssuePathDefault))
    ),
    message: S.NonEmptyString,
    reason: S.NonEmptyString,
    reference: S.OptionFromOptionalKey(SpecificationReference).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("IndeterminateIssue", {
      description: "Invariant outcome that requires context or authority unavailable to the validator.",
    })
  )
) {}

/**
 * Discriminated conformance finding separating definite violations from indeterminate outcomes.
 *
 * **Example** (Decode a violation)
 *
 * ```ts import.meta.vitest name="Decode a violation"
 * import * as Result from "effect/Result";
 * import * as S from "effect/Schema"
 * import { Issue } from "@beep/schema/Conformance"
 *
 * const result = S.decodeUnknownResult(Issue)({
 *   kind: "violation",
 *   invariantId: "html.heading.no-heading-descendants",
 *   strength: "mustNot",
 *   path: ["children", 0],
 *   message: "A heading cannot contain another heading."
 * })
 *
 * Result.isSuccess(result) // => true
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const ConformanceIssue = ConformanceIssueKind.mapMembers(
  Tuple.evolve([() => ViolationIssue, () => IndeterminateIssue])
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("ConformanceIssue", {
    description: "Discriminated conformance finding separating violations from indeterminate outcomes.",
  })
);

/**
 * Runtime finding represented by {@link ConformanceIssue}.
 *
 * @see {@link ConformanceIssue} for constructors and exhaustive matching.
 * @category diagnostics
 * @since 0.0.0
 */
export type ConformanceIssue = typeof ConformanceIssue.Type;

const ConformanceReportStatus = LiteralKit(["conforming", "nonConforming", "indeterminate"]);

const commonReportFields = {
  profileIds: S.NonEmptyArray(S.NonEmptyString),
  checkedInvariantIds: S.NonEmptyArray(S.NonEmptyString),
};

const hasUniqueReportIdentifiers = (report: {
  readonly profileIds: ReadonlyArray<string>;
  readonly checkedInvariantIds: ReadonlyArray<string>;
}): boolean =>
  A.dedupe(report.profileIds).length === report.profileIds.length &&
  A.dedupe(report.checkedInvariantIds).length === report.checkedInvariantIds.length;

const allIssueIdentifiersWereChecked = (
  checkedInvariantIds: ReadonlyArray<string>,
  issues: ReadonlyArray<{ readonly invariantId: string }>
): boolean => A.every(issues, ({ invariantId }) => A.contains(checkedInvariantIds, invariantId));

const ConformingReportFields = S.Struct({
  status: S.tag("conforming"),
  ...commonReportFields,
});

const ConformingReportConsistency = S.makeFilter(
  hasUniqueReportIdentifiers,
  $I.annote("ConformingReportConsistency", {
    title: "Conforming report identifier consistency",
    description: "Profile and checked-invariant identifiers occur at most once.",
    message: "Expected unique profileIds and checkedInvariantIds",
  })
);

const ConformingReportValue = ConformingReportFields.check(ConformingReportConsistency);

/**
 * Report asserting conformance for the declared checked-invariant set.
 *
 * **Example** (Record a clean run against one profile)
 *
 * ```ts
 * import { ConformingReport, Report } from "@beep/schema/Conformance"
 *
 * const report = ConformingReport.make({
 *   profileIds: ["commonmark-0.31.2"],
 *   checkedInvariantIds: ["md.heading.no-skipped-levels", "md.list.consistent-markers"]
 * })
 *
 * console.log(Report.guards.conforming(report)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConformingReport extends S.Opaque<ConformingReport, { readonly brand: unique symbol }>()(
  ConformingReportValue.pipe(
    $I.annoteSchema("ConformingReport", {
      description: "Report asserting conformance for the declared checked-invariant set.",
    })
  )
) {}

const nonConformingReportFieldsIndeterminateIssuesDefault = A.empty<IndeterminateIssue>();
const NonConformingReportFields = S.Struct({
  status: S.tag("nonConforming"),
  ...commonReportFields,
  issues: S.NonEmptyArray(ViolationIssue),
  indeterminateIssues: S.Array(IndeterminateIssue).pipe(
    S.withConstructorDefault(Effect.succeed(nonConformingReportFieldsIndeterminateIssuesDefault)),
    S.withDecodingDefaultType(Effect.succeed(nonConformingReportFieldsIndeterminateIssuesDefault))
  ),
});

const NonConformingReportConsistency = S.makeFilter(
  (report: typeof NonConformingReportFields.Type) =>
    hasUniqueReportIdentifiers(report) &&
    allIssueIdentifiersWereChecked(report.checkedInvariantIds, report.issues) &&
    allIssueIdentifiersWereChecked(report.checkedInvariantIds, report.indeterminateIssues),
  $I.annote("NonConformingReportConsistency", {
    title: "Non-conforming report identifier consistency",
    description: "Profile and invariant identifiers are unique and every issue names a checked invariant.",
    message: "Expected unique report identifiers and issues drawn only from checkedInvariantIds",
  })
);

const NonConformingReportValue = NonConformingReportFields.check(NonConformingReportConsistency);

/**
 * Report containing one or more definite invariant violations plus any independently indeterminate outcomes.
 *
 * **Example** (Record a run with one definite violation)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonConformingReport } from "@beep/schema/Conformance"
 *
 * const report = S.decodeUnknownSync(NonConformingReport)({
 *   status: "nonConforming",
 *   profileIds: ["commonmark-0.31.2"],
 *   checkedInvariantIds: ["md.heading.no-skipped-levels"],
 *   issues: [{
 *     kind: "violation",
 *     invariantId: "md.heading.no-skipped-levels",
 *     strength: "should",
 *     path: ["children", 4],
 *     message: "Heading jumps from level 1 to level 3."
 *   }]
 * })
 *
 * console.log(report.issues.length) // => 1
 * console.log(report.indeterminateIssues.length) // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NonConformingReport extends S.Opaque<NonConformingReport, { readonly brand: unique symbol }>()(
  NonConformingReportValue.pipe(
    $I.annoteSchema("NonConformingReport", {
      description:
        "Report containing one or more definite invariant violations plus any independently indeterminate outcomes.",
    })
  )
) {}

const IndeterminateReportFields = S.Struct({
  status: S.tag("indeterminate"),
  ...commonReportFields,
  issues: S.NonEmptyArray(IndeterminateIssue),
});

const IndeterminateReportConsistency = S.makeFilter(
  (report: typeof IndeterminateReportFields.Type) =>
    hasUniqueReportIdentifiers(report) && allIssueIdentifiersWereChecked(report.checkedInvariantIds, report.issues),
  $I.annote("IndeterminateReportConsistency", {
    title: "Indeterminate report identifier consistency",
    description: "Profile and invariant identifiers are unique and every issue names a checked invariant.",
    message: "Expected unique report identifiers and issues drawn only from checkedInvariantIds",
  })
);

const IndeterminateReportValue = IndeterminateReportFields.check(IndeterminateReportConsistency);

/**
 * Report containing outcomes that the available validator could not decide.
 *
 * **Example** (Reject an issue for an invariant that was never checked)
 *
 * ```ts
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 * import { IndeterminateReport } from "@beep/schema/Conformance"
 *
 * const decode = S.decodeUnknownExit(IndeterminateReport)
 * const issue = { kind: "indeterminate", invariantId: "md.link.reference-defined", path: [], message: "Unresolved [spec].", reason: "Needs the whole document." }
 *
 * console.log(Exit.isSuccess(decode({ status: "indeterminate", profileIds: ["gfm-0.29"], checkedInvariantIds: ["md.link.reference-defined"], issues: [issue] }))) // => true
 * console.log(Exit.isSuccess(decode({ status: "indeterminate", profileIds: ["gfm-0.29"], checkedInvariantIds: ["md.heading.no-skipped-levels"], issues: [issue] }))) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IndeterminateReport extends S.Opaque<IndeterminateReport, { readonly brand: unique symbol }>()(
  IndeterminateReportValue.pipe(
    $I.annoteSchema("IndeterminateReport", {
      description: "Report containing outcomes that the available validator could not decide.",
    })
  )
) {}

/**
 * Exhaustive conformance result whose status determines whether issues may occur.
 *
 * **Details**
 *
 * A conforming report has no issue field. Non-conforming reports require at
 * least one definite violation and may additionally retain indeterminate
 * outcomes. Indeterminate reports require at least one indeterminate finding
 * and contain no definite violation. Profile and checked-invariant identifiers
 * are unique, and every issue must name an identifier in
 * `checkedInvariantIds`.
 *
 * **Example** (Decode a conforming report)
 *
 * ```ts import.meta.vitest name="Decode a conforming report"
 * import * as Result from "effect/Result";
 * import * as S from "effect/Schema"
 * import { Report } from "@beep/schema/Conformance"
 *
 * const result = S.decodeUnknownResult(Report)({
 *   status: "conforming",
 *   profileIds: ["commonmark"],
 *   checkedInvariantIds: ["commonmark.heading.level"]
 * })
 *
 * Result.isSuccess(result) // => true
 * ```
 *
 * @invariant Status controls issue kinds, identifiers are unique, and every issue names a checked invariant.
 * @category diagnostics
 * @since 0.0.0
 */
export const ConformanceReport = ConformanceReportStatus.mapMembers(
  Tuple.evolve([() => ConformingReport, () => NonConformingReport, () => IndeterminateReport])
).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("ConformanceReport", {
    description: "Exhaustive conformance result whose status determines whether issues may occur.",
  })
);

/**
 * Runtime result represented by {@link ConformanceReport}.
 *
 * @see {@link ConformanceReport} for constructors and exhaustive matching.
 * @category diagnostics
 * @since 0.0.0
 */
export type ConformanceReport = typeof ConformanceReport.Type;
