import { Confidence } from "@beep/epistemics/Confidence";
import { ExtractorConfidence } from "@beep/epistemics/EvidencePosition.schema";
import { $SemanticaId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { sha256TextSync } from "@/schema/Digest";
import { LedgerFailed } from "@/schema/Errors";
import { EvidenceBatch, EvidenceClaim, ExtractOutcome } from "@/schema/Evidence";
import { ClaimId, DocumentId } from "@/schema/Ids";

const $I = $SemanticaId.create("schema/LedgerEvidence");

/**
 * Raw scalar confidence kept from a `ledger-evidence/v1` row whose origin cannot be proved.
 *
 * **Details**
 *
 * The v1 extractor wrote `1` whenever a reading carried no confidence, so a
 * stored scalar may be fabricated. The projected claim carries an absent
 * `legacy-unknown` signal; this record keeps the stored number beside it.
 *
 * **Example** (Keep a legacy scalar beside its claim)
 *
 * ```ts
 * import { Confidence } from "@beep/epistemics/Confidence"
 * import { LegacyConfidenceImport } from "@/schema/LedgerEvidence"
 * import { ClaimId, DocumentId } from "@/schema/Ids"
 *
 * const legacy = LegacyConfidenceImport.make({
 *   claim: ClaimId.make("a".repeat(64)),
 *   document: DocumentId.make("b".repeat(64)),
 *   storedDigest: "c".repeat(64),
 *   rawConfidence: Confidence.make(1)
 * })
 * console.log(legacy.format) // "ledger-evidence/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegacyConfidenceImport extends S.Opaque<LegacyConfidenceImport, { readonly brand: unique symbol }>()(
  S.Struct({
    format: S.tag("ledger-evidence/v1"),
    claim: ClaimId,
    document: DocumentId,
    storedDigest: Sha256Hex,
    rawConfidence: Confidence,
  }).pipe(
    $I.annoteSchema("LegacyConfidenceImport", {
      description: "Stored v1 scalar confidence retained as raw metadata beside an absent legacy-unknown signal.",
    })
  )
) {}

/**
 * Versioned claims-table payload written by the ledger.
 *
 * **Example** (Wrap a claim for storage)
 *
 * ```ts
 * import { LedgerClaimPayload } from "@/schema/LedgerEvidence"
 *
 * console.log(LedgerClaimPayload.fields.format !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LedgerClaimPayload extends S.Opaque<LedgerClaimPayload, { readonly brand: unique symbol }>()(
  S.Struct({
    format: S.tag("ledger-evidence/v2"),
    claim: EvidenceClaim,
  }).pipe(
    $I.annoteSchema("LedgerClaimPayload", {
      description: "ledger-evidence/v2 claims-table payload carrying one claim with its confidence signal.",
    })
  )
) {}

/**
 * Versioned batches-table payload written by the ledger.
 *
 * **Example** (Wrap an extraction outcome for storage)
 *
 * ```ts
 * import { LedgerBatchPayload } from "@/schema/LedgerEvidence"
 *
 * console.log(LedgerBatchPayload.fields.outcome !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LedgerBatchPayload extends S.Opaque<LedgerBatchPayload, { readonly brand: unique symbol }>()(
  S.Struct({
    format: S.tag("ledger-evidence/v2"),
    outcome: ExtractOutcome,
  }).pipe(
    $I.annoteSchema("LedgerBatchPayload", {
      description: "ledger-evidence/v2 batches-table payload carrying one extraction outcome.",
    })
  )
) {}

const LedgerEvidenceV1Claim = S.Struct({ ...EvidenceClaim.fields, confidence: Confidence }).pipe(
  $I.annoteSchema("LedgerEvidenceV1Claim", {
    description: "Frozen ledger-evidence/v1 claim whose scalar confidence origin is unknown.",
  })
);

const LedgerEvidenceV1Batch = S.Struct({ ...EvidenceBatch.fields, claims: S.Array(LedgerEvidenceV1Claim) }).pipe(
  $I.annoteSchema("LedgerEvidenceV1Batch", {
    description: "Frozen ledger-evidence/v1 batch with nested v1 claims.",
  })
);

/**
 * Frozen `ledger-evidence/v1` batch payload codec, used only to read old rows.
 *
 * **Details**
 *
 * It decodes the untagged v1 extraction outcome exactly as it was stored.
 * Callers project it through {@link readStoredBatch}; nothing writes it.
 *
 * **Example** (Decode an old degraded outcome)
 *
 * ```ts
 * import { LedgerEvidenceV1Outcome } from "@/schema/LedgerEvidence"
 * import * as S from "effect/Schema"
 *
 * const outcome = S.decodeUnknownSync(LedgerEvidenceV1Outcome)({
 *   outcome: "Degraded",
 *   document: "0".repeat(64),
 *   lane: "hosted",
 *   kind: "provider-unavailable",
 *   detail: "Provider cache miss."
 * })
 * console.log(outcome.outcome) // "Degraded"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LedgerEvidenceV1Outcome = S.Union([
  S.Struct({ outcome: S.tag("Extracted"), batch: LedgerEvidenceV1Batch }),
  ExtractOutcome.cases.Degraded,
]).pipe(
  $I.annoteSchema("LedgerEvidenceV1Outcome", {
    description: "Frozen ledger-evidence/v1 extraction outcome read before projection to the current outcome.",
  })
);

/**
 * Digest and payload text of one stored claims or batches row.
 *
 * **Example** (Describe a stored row)
 *
 * ```ts
 * import { StoredEvidenceRow } from "@/schema/LedgerEvidence"
 *
 * const row = StoredEvidenceRow.make({ digest: "0".repeat(64), payload: "{}" })
 * console.log(row.payload) // "{}"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StoredEvidenceRow extends S.Opaque<StoredEvidenceRow, { readonly brand: unique symbol }>()(
  S.Struct({ digest: S.String, payload: S.String }).pipe(
    $I.annoteSchema("StoredEvidenceRow", {
      description: "Stored digest column and raw payload text of an immutable evidence row.",
    })
  )
) {}

/**
 * Current claim projection of a stored claims-table row.
 *
 * **Example** (Inspect the projection fields)
 *
 * ```ts
 * import { StoredClaim } from "@/schema/LedgerEvidence"
 *
 * console.log(StoredClaim.fields.legacy !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StoredClaim extends S.Opaque<StoredClaim, { readonly brand: unique symbol }>()(
  S.Struct({ claim: EvidenceClaim, legacy: S.Array(LegacyConfidenceImport) }).pipe(
    $I.annoteSchema("StoredClaim", {
      description: "Current claim read from a stored row with any retained v1 scalar confidence.",
    })
  )
) {}

/**
 * Current outcome projection of a stored batches-table row.
 *
 * **Example** (Inspect the projection fields)
 *
 * ```ts
 * import { StoredBatch } from "@/schema/LedgerEvidence"
 *
 * console.log(StoredBatch.fields.outcome !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StoredBatch extends S.Opaque<StoredBatch, { readonly brand: unique symbol }>()(
  S.Struct({ outcome: ExtractOutcome, legacy: S.Array(LegacyConfidenceImport) }).pipe(
    $I.annoteSchema("StoredBatch", {
      description: "Current extraction outcome read from a stored row with any retained v1 scalar confidences.",
    })
  )
) {}

const legacyUnknown = ExtractorConfidence.cases.Absent.make({ reason: "legacy-unknown" });

const digestMismatch = (): LedgerFailed =>
  LedgerFailed.make({
    message: "A stored evidence payload does not hash to its recorded digest.",
    reason: "digest-mismatch",
  });

const storedDecodeFailed = (): LedgerFailed =>
  LedgerFailed.make({ message: "A stored evidence payload did not decode.", reason: "decode-failed" });

const verifyRawDigest = (row: StoredEvidenceRow): Effect.Effect<Sha256Hex, LedgerFailed> => {
  const digest = sha256TextSync(row.payload);
  return Str.Equivalence(digest, row.digest) ? Effect.succeed(digest) : Effect.fail(digestMismatch());
};

const projectV1Claim = Effect.fn("LedgerEvidence.projectV1Claim")(function* (
  storedDigest: Sha256Hex,
  claim: typeof LedgerEvidenceV1Claim.Type
) {
  const current = yield* EvidenceClaim.makeEffect({ ...claim, confidence: legacyUnknown });
  const legacy = LegacyConfidenceImport.make({
    claim: claim.id,
    document: claim.document,
    storedDigest,
    rawConfidence: claim.confidence,
  });
  return StoredClaim.make({ claim: current, legacy: [legacy] });
});

const projectV1Outcome = Effect.fn("LedgerEvidence.projectV1Outcome")(function* (
  storedDigest: Sha256Hex,
  outcome: typeof LedgerEvidenceV1Outcome.Type
) {
  if (outcome.outcome === "Degraded") {
    return StoredBatch.make({ outcome, legacy: [] });
  }
  const claims = yield* Effect.forEach(outcome.batch.claims, (claim) => projectV1Claim(storedDigest, claim), {
    concurrency: 1,
  });
  const batch = yield* EvidenceBatch.makeEffect({ ...outcome.batch, claims: A.map(claims, (stored) => stored.claim) });
  const current = yield* ExtractOutcome.cases.Extracted.makeEffect({ outcome: "Extracted", batch });
  return StoredBatch.make({ outcome: current, legacy: A.flatMap(claims, (stored) => stored.legacy) });
});

const decodeClaimV2 = S.decodeEffect(S.fromJsonString(LedgerClaimPayload));
const decodeClaimV1 = S.decodeEffect(S.fromJsonString(LedgerEvidenceV1Claim));
const decodeBatchV2 = S.decodeEffect(S.fromJsonString(LedgerBatchPayload));
const decodeBatchV1 = S.decodeEffect(S.fromJsonString(LedgerEvidenceV1Outcome));

/**
 * Reads a stored claims row after verifying its raw payload digest.
 *
 * **Details**
 *
 * A `ledger-evidence/v2` payload decodes directly. A `ledger-evidence/v1`
 * payload projects to an absent `legacy-unknown` signal and keeps its stored
 * scalar as {@link LegacyConfidenceImport}. The stored bytes are never
 * re-encoded for comparison with the stored digest.
 *
 * **Example** (Refuse a row whose bytes changed)
 *
 * ```ts
 * import { readStoredClaim, StoredEvidenceRow } from "@/schema/LedgerEvidence"
 * import * as Effect from "effect/Effect"
 *
 * const program = readStoredClaim(StoredEvidenceRow.make({ digest: "0".repeat(64), payload: "{}" }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param row - Stored digest column and raw payload text.
 * @returns The current claim and any retained v1 scalar, or a `digest-mismatch` or `decode-failed` failure.
 * @category decoding
 * @since 0.0.0
 */
export const readStoredClaim = Effect.fn("LedgerEvidence.readStoredClaim")(function* (row: StoredEvidenceRow) {
  const storedDigest = yield* verifyRawDigest(row);
  return yield* decodeClaimV2(row.payload).pipe(
    Effect.map(({ claim }) => StoredClaim.make({ claim, legacy: [] })),
    Effect.catch(() => decodeClaimV1(row.payload).pipe(Effect.flatMap((claim) => projectV1Claim(storedDigest, claim)))),
    Effect.mapError(storedDecodeFailed)
  );
});

/**
 * Reads a stored batches row after verifying its raw payload digest.
 *
 * **Details**
 *
 * Nested v1 claims inside an extracted v1 outcome are projected one by one;
 * the batch and outcome are then rebuilt under the current schema checks.
 *
 * **Example** (Refuse a row whose bytes changed)
 *
 * ```ts
 * import { readStoredBatch, StoredEvidenceRow } from "@/schema/LedgerEvidence"
 * import * as Effect from "effect/Effect"
 *
 * const program = readStoredBatch(StoredEvidenceRow.make({ digest: "0".repeat(64), payload: "{}" }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param row - Stored digest column and raw payload text.
 * @returns The current outcome and retained v1 scalars, or a `digest-mismatch` or `decode-failed` failure.
 * @category decoding
 * @since 0.0.0
 */
export const readStoredBatch = Effect.fn("LedgerEvidence.readStoredBatch")(function* (row: StoredEvidenceRow) {
  const storedDigest = yield* verifyRawDigest(row);
  return yield* decodeBatchV2(row.payload).pipe(
    Effect.map(({ outcome }) => StoredBatch.make({ outcome, legacy: [] })),
    Effect.catch(() =>
      decodeBatchV1(row.payload).pipe(Effect.flatMap((outcome) => projectV1Outcome(storedDigest, outcome)))
    ),
    Effect.mapError(storedDecodeFailed)
  );
});
