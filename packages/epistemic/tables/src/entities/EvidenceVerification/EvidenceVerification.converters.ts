/**
 * Epistemic EvidenceVerification row converters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { EvidenceVerification } from "@beep/epistemic-domain/entities/EvidenceVerification";
import { EvidenceSpan } from "@beep/epistemic-domain/values/EvidenceSpan";
import { DateTime, Result, SchemaIssue } from "effect";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { Evidence } from "@beep/epistemic-domain/entities/Evidence";
import type { Table } from "./EvidenceVerification.table.ts";

/**
 * Selected epistemic EvidenceVerification row.
 *
 * @example
 * ```ts
 * import type { EvidenceVerificationRow } from "@beep/epistemic-tables/entities/EvidenceVerification"
 *
 * const rows: ReadonlyArray<EvidenceVerificationRow> = []
 * console.log(rows.length)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type EvidenceVerificationRow = typeof Table.$inferSelect;

/**
 * Insertable epistemic EvidenceVerification row.
 *
 * @example
 * ```ts
 * import type { EvidenceVerificationInsert } from "@beep/epistemic-tables/entities/EvidenceVerification"
 *
 * const inserts: ReadonlyArray<EvidenceVerificationInsert> = []
 * console.log(inserts.length)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type EvidenceVerificationInsert = typeof Table.$inferInsert;

const encodeEvidenceVerification = S.encodeResult(EvidenceVerification);
const decodeEvidenceVerificationRow = S.decodeUnknownResult(EvidenceVerification);

const validateManifestationKey = (
  verification: EvidenceVerification
): Result.Result<EvidenceVerification, S.SchemaError> =>
  Result.flatMap(verification.hasValidManifestationKey(), (isValid) =>
    isValid
      ? Result.succeed(verification)
      : Result.fail(
          new S.SchemaError(
            new SchemaIssue.InvalidValue({
              message: "Evidence-verification manifestation key does not seal the persisted payload.",
            })
          )
        )
  );

const validateEvidenceAssociation = (
  verification: EvidenceVerification,
  evidence: Evidence
): Result.Result<EvidenceVerification, S.SchemaError> =>
  Eq.equals(verification.orgId, evidence.orgId) &&
  Eq.equals(verification.evidenceId, evidence.id) &&
  !DateTime.isLessThan(verification.createdAt, evidence.createdAt) &&
  EvidenceSpan.matchesAnchor(evidence.span, verification.verifiedAnchor.anchor)
    ? Result.succeed(verification)
    : Result.fail(
        new S.SchemaError(
          new SchemaIssue.InvalidValue({
            message:
              "Evidence-verification association must match the referenced organization, evidence id, and span, and cannot predate the evidence.",
          })
        )
      );

/**
 * Convert an EvidenceVerification entity into an insert row after proving its
 * organization, evidence id, transaction time, and verified anchor match the
 * referenced evidence.
 *
 * The database-managed serial id is omitted so inserts use the table sequence.
 *
 * @example
 * ```ts
 * import { toEvidenceVerificationInsert } from "@beep/epistemic-tables/entities/EvidenceVerification"
 *
 * console.log(typeof toEvidenceVerificationInsert)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toEvidenceVerificationInsert: {
  (verification: EvidenceVerification, evidence: Evidence): Result.Result<EvidenceVerificationInsert, S.SchemaError>;
  (
    evidence: Evidence
  ): (verification: EvidenceVerification) => Result.Result<EvidenceVerificationInsert, S.SchemaError>;
} = dual(2, (verification: EvidenceVerification, evidence: Evidence) =>
  Result.map(
    Result.flatMap(
      Result.flatMap(validateEvidenceAssociation(verification, evidence), validateManifestationKey),
      encodeEvidenceVerification
    ),
    (encoded): EvidenceVerificationInsert => {
      const { id: _id, ...insert } = encoded;
      return insert;
    }
  )
);

/**
 * Convert a selected row into an EvidenceVerification entity.
 *
 * @example
 * ```ts
 * import { fromEvidenceVerificationRow } from "@beep/epistemic-tables/entities/EvidenceVerification"
 *
 * console.log(typeof fromEvidenceVerificationRow)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromEvidenceVerificationRow = (row: unknown): Result.Result<EvidenceVerification, S.SchemaError> =>
  Result.flatMap(decodeEvidenceVerificationRow(row), validateManifestationKey);
