import { $SemanticaId } from "@beep/identity/packages";
import { VerifiedTextAnchorError } from "@beep/provenance";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { DegradedKind } from "@/schema/Degraded";

const $I = $SemanticaId.create("schema/Errors");

const GoldUnavailableReason = LiteralKit([
  "invalid-selection",
  "manifest-invalid",
  "source-unavailable",
  "parse-degraded",
  "provider-failed",
  "model-output-invalid",
  "write-failed",
  "read-failed",
  "job-mismatch",
  "mixed-proposer",
  "digest-failed",
  "encoding-failed",
]).annotate(
  $I.annote("GoldUnavailableReason", {
    description: "Stable reason codes for failures in the gold-proposal workflow.",
  })
);

const ModelRevisionPinSetting = LiteralKit(["AI_ANTHROPIC_MODEL", "SEMANTICA_XAI_MODEL"]).annotate(
  $I.annote("ModelRevisionPinSetting", {
    description: "Configuration boundaries that must name an explicitly versioned hosted model.",
  })
);

/**
 * Reports that a requested source document cannot be listed or read.
 *
 * **Example** (Create a document failure)
 *
 * ```ts
 * import { DocumentUnavailable } from "@/schema/Errors"
 *
 * const error = DocumentUnavailable.make({ message: "Document is unavailable." })
 * console.log(error._tag) // "DocumentUnavailable"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DocumentUnavailable extends S.TaggedError<DocumentUnavailable>($I`DocumentUnavailable`)(
  "DocumentUnavailable",
  { message: S.NonEmptyString },
  $I.annoteError<DocumentUnavailable>("DocumentUnavailable", {
    description: "Expected source-document listing or read failure.",
  })
) {}

/**
 * Reports a parser boundary failure classified into the C0 degraded vocabulary.
 *
 * **Example** (Create an extraction failure)
 *
 * ```ts
 * import { ParserFailed } from "@/schema/Errors"
 *
 * const error = ParserFailed.make({ message: "PDF extraction failed.", kind: "extraction-failed" })
 * console.log(error.kind) // "extraction-failed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ParserFailed extends S.TaggedError<ParserFailed>($I`ParserFailed`)(
  "ParserFailed",
  { message: S.NonEmptyString, kind: DegradedKind },
  $I.annoteError<ParserFailed>("ParserFailed", {
    description: "Expected parser failure carrying its typed degraded classification.",
  })
) {}

/**
 * Wraps a shared provenance error when a candidate text anchor is rejected.
 *
 * **Example** (Inspect the cause field)
 *
 * ```ts
 * import { AnchorRejected } from "@/schema/Errors"
 *
 * console.log(AnchorRejected.fields.cause !== undefined) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AnchorRejected extends S.TaggedError<AnchorRejected>($I`AnchorRejected`)(
  "AnchorRejected",
  { message: S.NonEmptyString, cause: VerifiedTextAnchorError },
  $I.annoteError<AnchorRejected>("AnchorRejected", {
    description: "Expected canonical-text anchor rejection preserving the shared verification error.",
  })
) {}

/**
 * Reports a live provider failure or an offline provider-cache miss.
 *
 * **Example** (Create an offline cache miss)
 *
 * ```ts
 * import { ProviderUnavailable } from "@/schema/Errors"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const error = ProviderUnavailable.make({
 *   message: "Provider response is unavailable.",
 *   offline: true,
 *   cacheKey: Sha256Hex.make("0".repeat(64))
 * })
 * console.log(error.offline) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProviderUnavailable extends S.TaggedError<ProviderUnavailable>($I`ProviderUnavailable`)(
  "ProviderUnavailable",
  { message: S.NonEmptyString, offline: S.Boolean, cacheKey: Sha256Hex },
  $I.annoteError<ProviderUnavailable>("ProviderUnavailable", {
    description: "Expected provider unavailability, including content-addressed offline cache misses.",
  })
) {}

/**
 * Reports an invalid or conflicting immutable provider-cache entry.
 *
 * **Example** (Create a cache corruption error)
 *
 * ```ts
 * import { ProviderCacheCorrupt } from "@/schema/Errors"
 *
 * const error = ProviderCacheCorrupt.make({ message: "Cache digests disagree." })
 * console.log(error._tag) // "ProviderCacheCorrupt"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProviderCacheCorrupt extends S.TaggedError<ProviderCacheCorrupt>($I`ProviderCacheCorrupt`)(
  "ProviderCacheCorrupt",
  { message: S.NonEmptyString },
  $I.annoteError<ProviderCacheCorrupt>("ProviderCacheCorrupt", {
    description: "Expected provider-cache integrity or write-once conflict failure.",
  })
) {}

/**
 * Reports an append-only ledger operation failure with a stable reason.
 *
 * **Example** (Create a conflicting-row error)
 *
 * ```ts
 * import { LedgerFailed } from "@/schema/Errors"
 *
 * const error = LedgerFailed.make({ message: "Ledger row conflicts.", reason: "conflicting-row" })
 * console.log(error.reason) // "conflicting-row"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LedgerFailed extends S.TaggedError<LedgerFailed>($I`LedgerFailed`)(
  "LedgerFailed",
  { message: S.NonEmptyString, reason: S.NonEmptyString },
  $I.annoteError<LedgerFailed>("LedgerFailed", {
    description: "Expected append-only ledger failure carrying a stable machine-readable reason.",
  })
) {}

/**
 * Reports that required gold-v1 labels or their digest are unavailable.
 *
 * **Example** (Create a gold availability error)
 *
 * ```ts
 * import { GoldUnavailable } from "@/schema/Errors"
 *
 * const error = GoldUnavailable.make({
 *   message: "Gold labels use multiple proposers.",
 *   reason: "mixed-proposer"
 * })
 * console.log(error.reason) // "mixed-proposer"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GoldUnavailable extends S.TaggedError<GoldUnavailable>($I`GoldUnavailable`)(
  "GoldUnavailable",
  { message: S.NonEmptyString, reason: GoldUnavailableReason },
  $I.annoteError<GoldUnavailable>("GoldUnavailable", {
    description: "Expected gold-v1 workflow failure carrying a stable machine-readable reason.",
  })
) {}

/**
 * Refuses a hosted model identity whose configured id does not pin a revision.
 *
 * **Example** (Name the setting to pin)
 *
 * ```ts
 * import { ModelRevisionUnpinned } from "@/schema/Errors"
 *
 * const error = ModelRevisionUnpinned.make({
 *   message: "Configure an explicitly versioned model id.",
 *   model: "grok-4",
 *   setting: "SEMANTICA_XAI_MODEL"
 * })
 * console.log(error.setting) // "SEMANTICA_XAI_MODEL"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ModelRevisionUnpinned extends S.TaggedError<ModelRevisionUnpinned>($I`ModelRevisionUnpinned`)(
  "ModelRevisionUnpinned",
  { message: S.NonEmptyString, model: S.NonEmptyString, setting: ModelRevisionPinSetting },
  $I.annoteError<ModelRevisionUnpinned>("ModelRevisionUnpinned", {
    description: "Expected refusal when a live hosted model id does not expose an immutable revision.",
  })
) {}

/**
 * Reports that an evaluation report violates its schema refinements.
 *
 * **Example** (Create a report validation error)
 *
 * ```ts
 * import { ReportInvalid } from "@/schema/Errors"
 *
 * const error = ReportInvalid.make({ message: "Report digest is invalid." })
 * console.log(error._tag) // "ReportInvalid"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReportInvalid extends S.TaggedError<ReportInvalid>($I`ReportInvalid`)(
  "ReportInvalid",
  { message: S.NonEmptyString },
  $I.annoteError<ReportInvalid>("ReportInvalid", {
    description: "Expected failure raised when an evaluation report violates its schema invariants.",
  })
) {}
