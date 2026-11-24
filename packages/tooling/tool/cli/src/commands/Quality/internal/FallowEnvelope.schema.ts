/**
 * Shared Fallow report-envelope schema.
 *
 * Single source of truth for the Fallow report envelope wire shape so the
 * envelope producer (`FallowQuality.command.ts`) and the Yeet advisory consumer
 * (`FallowFeedback.ts`) decode and encode the same codec. Any field added here
 * is visible on both sides, eliminating silent drift between producer and
 * consumer.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const $I = $RepoCliId.create("commands/Quality/internal/FallowEnvelope");

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const FallowFeatureFamily = LiteralKit([
  "audit",
  "dead-code",
  "health",
  "boundaries",
  "flags",
  "security",
  "fix-preview",
]).pipe(
  $I.annoteSchema("FallowFeatureFamily", {
    description: "Fallow feature family implemented by the quality wrapper.",
  })
);

/**
 * Decoded Fallow feature family value.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export type FallowFeature = typeof FallowFeatureFamily.Type;

/**
 * Return the fixed envelope filename for a Fallow feature and execution mode.
 *
 * **Example** (Resolve a check-mode envelope filename)
 *
 * ```ts
 * import { fallowEnvelopeFileName } from "@beep/repo-cli/commands/Quality/internal/FallowEnvelope.schema"
 *
 * console.log(fallowEnvelopeFileName("audit", false))
 * // "audit.check.json"
 * ```
 *
 * @param feature - The Fallow feature family the envelope belongs to.
 * @param advisory - Whether the envelope was produced in advisory mode.
 * @returns The fixed envelope filename for the feature and mode.
 * @category utilities
 * @since 0.0.0
 */
export const fallowEnvelopeFileName: {
  (advisory: boolean): (feature: FallowFeature) => string;
  (feature: FallowFeature, advisory: boolean): string;
} = dual(
  2,
  (feature: FallowFeature, advisory: boolean): string => `${feature}.${advisory ? "advisory" : "check"}.json`
);

/**
 * Attribution kind retained by repo-cli Fallow envelopes.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const FindingAttributionKind = LiteralKit(["introduced", "inherited-adjacent", "not-applicable"]).pipe(
  $I.annoteSchema("FallowFindingAttributionKind", {
    description: "Attribution kind retained by repo-cli Fallow envelopes.",
  })
);

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const FallowEnvelopeStatus = LiteralKit([
  "ok",
  "tool-failed",
  "invalid-json",
  "invalid-report",
  "base-resolution-failed",
]).pipe(
  $I.annoteSchema("FallowEnvelopeStatus", {
    description: "Status discriminator for Fallow quality envelopes.",
  })
);

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const FallowFailureEnvelopeStatus = LiteralKit([
  "tool-failed",
  "invalid-json",
  "invalid-report",
  "base-resolution-failed",
]).pipe(
  $I.annoteSchema("FallowFailureEnvelopeStatus", {
    description: "Failure status discriminator for Fallow quality envelopes.",
  })
);

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const PositiveExitStatus = S.Int.pipe(S.brand("PositiveExitStatus"))
  .check(
    S.isGreaterThan(0, {
      message: "Expected a positive process exit status",
      description: "A positive process exit status",
    })
  )
  .pipe(
    $I.annoteSchema("PositiveExitStatus", {
      description: "Positive process exit status used by failure Fallow envelopes.",
    })
  );

/**
 * Equivalence over Fallow finding attribution kinds.
 *
 * @internal
 * @category equivalence
 * @since 0.0.0
 */
export const sameAttributionKind: {
  (that: typeof FindingAttributionKind.Type): (self: typeof FindingAttributionKind.Type) => boolean;
  (self: typeof FindingAttributionKind.Type, that: typeof FindingAttributionKind.Type): boolean;
} = dual(2, S.toEquivalence(FindingAttributionKind));

/**
 * Equivalence over Fallow envelope status discriminators.
 *
 * @internal
 * @category equivalence
 * @since 0.0.0
 */
export const sameEnvelopeStatus: {
  (that: typeof FallowEnvelopeStatus.Type): (self: typeof FallowEnvelopeStatus.Type) => boolean;
  (self: typeof FallowEnvelopeStatus.Type, that: typeof FallowEnvelopeStatus.Type): boolean;
} = dual(2, S.toEquivalence(FallowEnvelopeStatus));

/**
 * Equivalence over Fallow feature families.
 *
 * @internal
 * @category equivalence
 * @since 0.0.0
 */
export const sameFeatureFamily: {
  (that: FallowFeature): (self: FallowFeature) => boolean;
  (self: FallowFeature, that: FallowFeature): boolean;
} = dual(2, S.toEquivalence(FallowFeatureFamily));

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FindingAttributionSummary extends S.Opaque<FindingAttributionSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    introduced: S.Natural,
    inheritedAdjacent: S.Natural,
    notApplicable: S.Natural,
  }).pipe(
    $I.annoteSchema("FindingAttributionSummary", {
      description: "Count summary for normalized Fallow finding attribution.",
    })
  )
) {}

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FallowReportFinding extends S.Opaque<FallowReportFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    featureFamily: FallowFeatureFamily,
    attribution: FindingAttributionKind,
    parser: S.String,
    subCategory: S.String,
    blocking: S.Boolean,
    sourceRef: S.String,
  }).pipe(
    $I.annoteSchema("FallowReportFinding", {
      description: "Normalized Fallow finding inside the repo-cli report envelope.",
    })
  )
) {}

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FallowReportPayload extends S.Opaque<FallowReportPayload, { readonly brand: unique symbol }>()(
  S.Struct({
    findingCount: S.Natural,
    findings: S.Array(FallowReportFinding),
  }).pipe(
    $I.annoteSchema("FallowReportPayload", {
      description: "Normalized report payload carried by successful Fallow envelopes.",
    })
  )
) {}

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const FallowAttributionKinds = S.NonEmptyArray(FindingAttributionKind).pipe(
  $I.annoteSchema("FallowAttributionKinds", {
    description: "Non-empty attribution-kind list emitted by Fallow report envelopes.",
  })
);

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export type FallowAttributionKinds = typeof FallowAttributionKinds.Type;

/**
 * Common metadata required on every Fallow report envelope variant.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const FallowReportBaseFields = {
  schemaVersion: S.tag("fallow-report-envelope/v1"),
  toolVersion: S.String,
  command: S.String,
  subcommand: FallowFeatureFamily,
  baseRef: S.String,
  generatedAt: S.String,
  advisory: S.Boolean,
  dirtyWorktree: S.Boolean,
  reportPath: S.String,
  rawOutputRef: S.String,
  attributionKinds: FallowAttributionKinds,
  findingAttributionSummary: FindingAttributionSummary,
};

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FallowReportOk extends S.Opaque<FallowReportOk, { readonly brand: unique symbol }>()(
  S.Struct({
    ...FallowReportBaseFields,
    status: S.tag("ok"),
    exitStatus: S.Natural,
    report: FallowReportPayload,
  }).pipe(
    $I.annoteSchema("FallowReportOk", {
      description: "Successful Fallow envelope. The raw tool exit status is preserved separately.",
    })
  )
) {}

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FallowReportToolFailed extends S.Opaque<FallowReportToolFailed, { readonly brand: unique symbol }>()(
  S.Struct({
    ...FallowReportBaseFields,
    status: S.tag("tool-failed"),
    exitStatus: PositiveExitStatus,
    stderrExcerpt: S.String,
  }).pipe(
    $I.annoteSchema("FallowReportToolFailed", {
      description: "Fallow envelope emitted when the tool failed without decodable JSON.",
    })
  )
) {}

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FallowReportInvalidJson extends S.Opaque<FallowReportInvalidJson, { readonly brand: unique symbol }>()(
  S.Struct({
    ...FallowReportBaseFields,
    status: S.tag("invalid-json"),
    exitStatus: S.Natural,
    stderrExcerpt: S.String,
  }).pipe(
    $I.annoteSchema("FallowReportInvalidJson", {
      description: "Fallow envelope emitted when the tool succeeded but emitted invalid JSON.",
    })
  )
) {}

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FallowReportInvalidReport extends S.Opaque<FallowReportInvalidReport, { readonly brand: unique symbol }>()(
  S.Struct({
    ...FallowReportBaseFields,
    status: S.tag("invalid-report"),
    exitStatus: S.Natural,
    stderrExcerpt: S.String,
  }).pipe(
    $I.annoteSchema("FallowReportInvalidReport", {
      description: "Fallow envelope emitted when JSON decodes but does not match the expected feature report shape.",
    })
  )
) {}

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FallowReportBaseResolutionFailed extends S.Opaque<
  FallowReportBaseResolutionFailed,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...FallowReportBaseFields,
    status: S.tag("base-resolution-failed"),
    exitStatus: PositiveExitStatus,
    stderrExcerpt: S.String,
  }).pipe(
    $I.annoteSchema("FallowReportBaseResolutionFailed", {
      description: "Fallow envelope emitted when a diff-aware base ref cannot be resolved.",
    })
  )
) {}

/**
 * Failure variant union for Fallow report envelopes.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export type FallowFailureEnvelope =
  | FallowReportToolFailed
  | FallowReportInvalidJson
  | FallowReportInvalidReport
  | FallowReportBaseResolutionFailed;

/**
 * @internal
 * @returns Schema union for decoded Fallow report envelopes.
 * @category schema
 * @since 0.0.0
 */
export const FallowReportEnvelope = FallowEnvelopeStatus.mapMembers(
  Tuple.evolve([
    () => FallowReportOk,
    () => FallowReportToolFailed,
    () => FallowReportInvalidJson,
    () => FallowReportInvalidReport,
    () => FallowReportBaseResolutionFailed,
  ])
).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("FallowReportEnvelope", {
    description: "Internal decoded Fallow report envelope discriminated by status.",
  })
);

/**
 * @internal
 * @category schema
 * @since 0.0.0
 */
export type FallowReportEnvelope = typeof FallowReportEnvelope.Type;
