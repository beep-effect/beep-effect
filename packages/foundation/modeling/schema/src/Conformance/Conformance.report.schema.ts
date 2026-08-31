/**
 * Conformance issue and report models.
 *
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { Tuple } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { LiteralKit } from "../LiteralKit/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { RequirementStrength } from "./Conformance.invariant.schema.ts";
import { SpecificationReference } from "./Conformance.source.schema.ts";

const $I = $SchemaId.create("Conformance/report");

const ConformanceIssueKind = LiteralKit(["violation", "indeterminate"]);
const ConformancePathSegment = S.Union([S.String, S.Natural]).pipe(
  $I.annoteSchema("ConformancePathSegment", {
    description: "Property name or array index locating a conformance issue.",
  })
);

class ViolationIssue extends S.Class<ViolationIssue>($I`ViolationIssue`)(
  {
    kind: S.tag("violation"),
    invariantId: S.NonEmptyString,
    strength: RequirementStrength,
    path: S.Array(ConformancePathSegment).pipe(SchemaUtils.withEmptyArrayDefaults<string | number>()),
    message: S.NonEmptyString,
    reference: S.OptionFromOptionalKey(SpecificationReference).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ViolationIssue", {
    description: "Definite violation of a mechanically decidable conformance invariant.",
  })
) {}

class IndeterminateIssue extends S.Class<IndeterminateIssue>($I`IndeterminateIssue`)(
  {
    kind: S.tag("indeterminate"),
    invariantId: S.NonEmptyString,
    path: S.Array(ConformancePathSegment).pipe(SchemaUtils.withEmptyArrayDefaults<string | number>()),
    message: S.NonEmptyString,
    reason: S.NonEmptyString,
    reference: S.OptionFromOptionalKey(SpecificationReference).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("IndeterminateIssue", {
    description: "Invariant outcome that requires context or authority unavailable to the validator.",
  })
) {}

/**
 * Discriminated conformance finding separating definite violations from indeterminate outcomes.
 *
 * **Example** (Decode a violation)
 *
 * ```ts import.meta.vitest name="Decode a violation"
 * import { Result } from "effect"
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

const ConformingReportConsistency = S.makeFilter(hasUniqueReportIdentifiers, {
  identifier: $I`ConformingReportConsistency`,
  title: "Conforming report identifier consistency",
  description: "Profile and checked-invariant identifiers occur at most once.",
  message: "Expected unique profileIds and checkedInvariantIds",
});

const ConformingReportValue = ConformingReportFields.check(ConformingReportConsistency);

class ConformingReport extends S.Class<ConformingReport>($I`ConformingReport`)(
  ConformingReportValue,
  $I.annote("ConformingReport", {
    description: "Report asserting conformance for the declared checked-invariant set.",
  })
) {}

const NonConformingReportFields = S.Struct({
  status: S.tag("nonConforming"),
  ...commonReportFields,
  issues: S.NonEmptyArray(ViolationIssue),
  indeterminateIssues: S.Array(IndeterminateIssue).pipe(SchemaUtils.withEmptyArrayDefaults<IndeterminateIssue>()),
});

const NonConformingReportConsistency = S.makeFilter(
  (report: typeof NonConformingReportFields.Type) =>
    hasUniqueReportIdentifiers(report) &&
    allIssueIdentifiersWereChecked(report.checkedInvariantIds, report.issues) &&
    allIssueIdentifiersWereChecked(report.checkedInvariantIds, report.indeterminateIssues),
  {
    identifier: $I`NonConformingReportConsistency`,
    title: "Non-conforming report identifier consistency",
    description: "Profile and invariant identifiers are unique and every issue names a checked invariant.",
    message: "Expected unique report identifiers and issues drawn only from checkedInvariantIds",
  }
);

const NonConformingReportValue = NonConformingReportFields.check(NonConformingReportConsistency);

class NonConformingReport extends S.Class<NonConformingReport>($I`NonConformingReport`)(
  NonConformingReportValue,
  $I.annote("NonConformingReport", {
    description:
      "Report containing one or more definite invariant violations plus any independently indeterminate outcomes.",
  })
) {}

const IndeterminateReportFields = S.Struct({
  status: S.tag("indeterminate"),
  ...commonReportFields,
  issues: S.NonEmptyArray(IndeterminateIssue),
});

const IndeterminateReportConsistency = S.makeFilter(
  (report: typeof IndeterminateReportFields.Type) =>
    hasUniqueReportIdentifiers(report) && allIssueIdentifiersWereChecked(report.checkedInvariantIds, report.issues),
  {
    identifier: $I`IndeterminateReportConsistency`,
    title: "Indeterminate report identifier consistency",
    description: "Profile and invariant identifiers are unique and every issue names a checked invariant.",
    message: "Expected unique report identifiers and issues drawn only from checkedInvariantIds",
  }
);

const IndeterminateReportValue = IndeterminateReportFields.check(IndeterminateReportConsistency);

class IndeterminateReport extends S.Class<IndeterminateReport>($I`IndeterminateReport`)(
  IndeterminateReportValue,
  $I.annote("IndeterminateReport", {
    description: "Report containing outcomes that the available validator could not decide.",
  })
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
 * import { Result } from "effect"
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
