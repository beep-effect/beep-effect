/**
 * Explicit per-record structural inspection outcomes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { PosInt } from "../../internal/PosInt.ts";
import { AntecedentFinding } from "./AntecedentFinding.model.ts";
import { ClaimDecompositionError } from "./ClaimElement.errors.ts";
import { ClaimInputCollection, ClaimInputQualification, ClaimInputRecord } from "./ClaimElement.input.model.ts";
import { ClaimElementTree } from "./ClaimElement.tree.model.ts";

const $I = $LawPracticeDomainId.create("values/ClaimElement/ClaimElement.inspection.model");
const outcomeKind = LiteralKit(["decomposed", "decomposition-failed", "unchecked"]).pipe(
  $I.annoteSchema("ClaimInputDecompositionKind", {
    description:
      "A context-ready record produced a tree, failed decomposition, or remained unchecked for explicit input/context reasons.",
  })
);

/**
 * Structural inspection of one original source record, retaining all unknowns.
 *
 * **Details**
 * A tree does not mean that substantive antecedent checks succeeded. An
 * unchecked record preserves its extraction, normalization or ancestry reason.
 *
 * **Example** (Recognize unchecked input)
 *
 * ```ts
 * import { ClaimInputDecomposition } from "@beep/law-practice-domain/values/ClaimElement"
 * console.log(ClaimInputDecomposition.guards.unchecked({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimInputDecomposition = outcomeKind
  .toTaggedUnion("status")({
    decomposed: { qualification: ClaimInputQualification.cases["context-ready"], tree: ClaimElementTree },
    "decomposition-failed": {
      qualification: ClaimInputQualification.cases["context-ready"],
      cause: ClaimDecompositionError,
    },
    unchecked: {
      qualification: S.Union([
        ClaimInputQualification.cases["context-unavailable"],
        ClaimInputQualification.cases["extraction-failed"],
        ClaimInputQualification.cases["normalization-failed"],
      ]),
    },
  })
  .pipe(
    $I.annoteSchema("ClaimInputDecomposition", {
      description:
        "One result per original record; valid independent siblings can decompose without pretending a sparse set is PatentClaims.",
    })
  );

/**
 * Runtime per-record structural inspection type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimInputDecomposition = typeof ClaimInputDecomposition.Type;

const coverageIssueKind = LiteralKit([
  "record-unavailable",
  "ancestor-unavailable",
  "global-index-incomplete",
  "policy-uncovered",
]).pipe(
  $I.annoteSchema("ClaimInputCoverageIssueKind", {
    description: "Limits on checking a preserved record, independent of substantive antecedent allegations.",
  })
);

/**
 * Explicit reason an inspection cannot establish complete coverage.
 *
 * **Example** (Recognize incomplete source coverage)
 * ```ts
 * import { ClaimInputCoverageIssue } from "@beep/law-practice-domain/values/ClaimElement"
 * console.log(ClaimInputCoverageIssue.guards["global-index-incomplete"]({ kind: "global-index-incomplete" })) // true
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const ClaimInputCoverageIssue = coverageIssueKind
  .toTaggedUnion("kind")({
    "record-unavailable": {},
    "ancestor-unavailable": { parentClaimNumber: PosInt },
    "global-index-incomplete": {},
    "policy-uncovered": {},
  })
  .pipe(
    $I.annoteSchema("ClaimInputCoverageIssue", {
      description: "Record failure, unavailable ancestry, incomplete global search, or an unsupported policy pattern.",
    })
  );

/**
 * Runtime coverage-issue type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimInputCoverageIssue = typeof ClaimInputCoverageIssue.Type;

const inspectionStatus = LiteralKit(["complete", "partial", "unchecked"]).pipe(
  $I.annoteSchema("ClaimInputInspectionStatus", {
    description: "Complete rule coverage, explicitly partial coverage, or no substantive check of this record.",
  })
);

/**
 * Advisory policy outcome of one original source record.
 *
 * **Details**
 * Partial and unchecked outcomes never establish a clean claim, even when
 * no substantive finding is emitted. The decomposition retains the record,
 * its literal identity and every extraction/normalization failure.
 *
 * **Example** (Recognize unchecked inspection)
 * ```ts
 * import { ClaimInputInspection } from "@beep/law-practice-domain/values/ClaimElement"
 * console.log(ClaimInputInspection.guards.unchecked({})) // false
 * ```
 * @category models
 * @since 0.0.0
 */
export const ClaimInputInspection = inspectionStatus
  .toTaggedUnion("status")({
    complete: { decomposition: ClaimInputDecomposition.cases.decomposed, findings: S.Array(AntecedentFinding) },
    partial: {
      decomposition: ClaimInputDecomposition.cases.decomposed,
      findings: S.Array(AntecedentFinding),
      coverage: S.NonEmptyArray(ClaimInputCoverageIssue),
    },
    unchecked: { decomposition: ClaimInputDecomposition, coverage: S.NonEmptyArray(ClaimInputCoverageIssue) },
  })
  .pipe(
    $I.annoteSchema("ClaimInputInspection", {
      description:
        "Source-bound checking status with explicit uncertainty; unchecked records have no substantive verdict.",
    })
  );

/**
 * Runtime per-record policy outcome.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimInputInspection = typeof ClaimInputInspection.Type;

const equivalentRecord = S.toEquivalence(ClaimInputRecord);
// Preserve named decoded/encoded types in declarations instead of expanding
// every nested tagged-union case into the report's Opaque base type.
const inspectionRecord: S.Codec<ClaimInputInspection, typeof ClaimInputInspection.Encoded> = ClaimInputInspection;

/**
 * Complete source ledger and advisory inspection outcomes, including zero usable claims.
 *
 * **Example** (Inspect report fields)
 * ```ts
 * import { ClaimInputInspectionReport } from "@beep/law-practice-domain/values/ClaimElement"
 * console.log(Object.keys(ClaimInputInspectionReport.fields)) // ["input", "indexStatus", "records"]
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClaimInputInspectionReport extends S.Opaque<
  ClaimInputInspectionReport,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    input: ClaimInputCollection,
    indexStatus: S.Literals(["complete", "incomplete"]),
    records: S.NonEmptyArray(inspectionRecord),
  })
    .check(
      S.makeFilter(
        ({ input, indexStatus, records }) =>
          records.length === input.records.length &&
          (indexStatus === "complete") ===
            A.every(
              records,
              (result) => result.decomposition.status === "decomposed" && result.status !== "unchecked"
            ) &&
          A.every(
            A.zip(records, input.records),
            ([result, source]) =>
              equivalentRecord(result.decomposition.qualification.record, source) &&
              (result.status !== "complete" ||
                (indexStatus === "complete" &&
                  A.every(result.findings, (finding) => finding.kind !== "pattern-not-covered")))
          ),
        $I.annote("ClaimInputInspectionLedgerCheck", {
          title: "Preserved source inspection ledger",
          description:
            "Every source record has one outcome in source order; complete outcomes require complete index and rule coverage.",
          message: "Retain every original record and never label incomplete coverage as complete.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("ClaimInputInspectionReport", {
        description:
          "The unchanged source collection, global index completeness, and one explicit inspection outcome per record.",
      })
    )
) {}
