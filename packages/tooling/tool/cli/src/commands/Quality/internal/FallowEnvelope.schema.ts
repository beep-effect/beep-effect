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
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { Tuple } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Quality/internal/FallowEnvelope");

/**
 * Fallow feature family implemented by the quality wrapper.
 *
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
export const fallowEnvelopeFileName = (feature: FallowFeature, advisory: boolean): string =>
  `${feature}.${advisory ? "advisory" : "check"}.json`;

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
 * Status discriminator for Fallow quality envelopes.
 *
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
 * Failure status discriminator for Fallow quality envelopes.
 *
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
 * Positive process exit status used by failure Fallow envelopes.
 *
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
export const sameAttributionKind = S.toEquivalence(FindingAttributionKind);

/**
 * Equivalence over Fallow envelope status discriminators.
 *
 * @internal
 * @category equivalence
 * @since 0.0.0
 */
export const sameEnvelopeStatus = S.toEquivalence(FallowEnvelopeStatus);

/**
 * Equivalence over Fallow feature families.
 *
 * @internal
 * @category equivalence
 * @since 0.0.0
 */
export const sameFeatureFamily = S.toEquivalence(FallowFeatureFamily);

/**
 * Count summary for normalized Fallow finding attribution.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FindingAttributionSummary extends S.Class<FindingAttributionSummary>($I`FindingAttributionSummary`)(
  {
    introduced: NonNegativeInt,
    inheritedAdjacent: NonNegativeInt,
    notApplicable: NonNegativeInt,
  },
  $I.annote("FindingAttributionSummary", {
    description: "Count summary for normalized Fallow finding attribution.",
  })
) {}

/**
 * Normalized Fallow finding inside the repo-cli report envelope.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FallowReportFinding extends S.Class<FallowReportFinding>($I`FallowReportFinding`)(
  {
    id: S.String,
    featureFamily: FallowFeatureFamily,
    attribution: FindingAttributionKind,
    parser: S.String,
    subCategory: S.String,
    blocking: S.Boolean,
    sourceRef: S.String,
  },
  $I.annote("FallowReportFinding", {
    description: "Normalized Fallow finding inside the repo-cli report envelope.",
  })
) {}

/**
 * Normalized report payload carried by successful Fallow envelopes.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FallowReportPayload extends S.Class<FallowReportPayload>($I`FallowReportPayload`)(
  {
    findingCount: NonNegativeInt,
    findings: S.Array(FallowReportFinding),
  },
  $I.annote("FallowReportPayload", {
    description: "Normalized report payload carried by successful Fallow envelopes.",
  })
) {}

/**
 * Non-empty attribution-kind list emitted by Fallow report envelopes.
 *
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
 * Decoded non-empty attribution-kind list emitted by Fallow report envelopes.
 *
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
  schemaVersion: S.Literal("fallow-report-envelope/v1"),
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
 * Successful Fallow envelope. The raw tool exit status is preserved separately.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FallowReportOk extends S.Class<FallowReportOk>($I`FallowReportOk`)(
  {
    ...FallowReportBaseFields,
    status: S.Literal("ok"),
    exitStatus: NonNegativeInt,
    report: FallowReportPayload,
  },
  $I.annote("FallowReportOk", {
    description: "Successful Fallow envelope. The raw tool exit status is preserved separately.",
  })
) {}

/**
 * Fallow envelope emitted when the tool failed without decodable JSON.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FallowReportToolFailed extends S.Class<FallowReportToolFailed>($I`FallowReportToolFailed`)(
  {
    ...FallowReportBaseFields,
    status: S.Literal("tool-failed"),
    exitStatus: PositiveExitStatus,
    stderrExcerpt: S.String,
  },
  $I.annote("FallowReportToolFailed", {
    description: "Fallow envelope emitted when the tool failed without decodable JSON.",
  })
) {}

/**
 * Fallow envelope emitted when the tool succeeded but emitted invalid JSON.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FallowReportInvalidJson extends S.Class<FallowReportInvalidJson>($I`FallowReportInvalidJson`)(
  {
    ...FallowReportBaseFields,
    status: S.Literal("invalid-json"),
    exitStatus: NonNegativeInt,
    stderrExcerpt: S.String,
  },
  $I.annote("FallowReportInvalidJson", {
    description: "Fallow envelope emitted when the tool succeeded but emitted invalid JSON.",
  })
) {}

/**
 * Fallow envelope emitted when JSON decodes but does not match the expected feature report shape.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FallowReportInvalidReport extends S.Class<FallowReportInvalidReport>($I`FallowReportInvalidReport`)(
  {
    ...FallowReportBaseFields,
    status: S.Literal("invalid-report"),
    exitStatus: NonNegativeInt,
    stderrExcerpt: S.String,
  },
  $I.annote("FallowReportInvalidReport", {
    description: "Fallow envelope emitted when JSON decodes but does not match the expected feature report shape.",
  })
) {}

/**
 * Fallow envelope emitted when a diff-aware base ref cannot be resolved.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export class FallowReportBaseResolutionFailed extends S.Class<FallowReportBaseResolutionFailed>(
  $I`FallowReportBaseResolutionFailed`
)(
  {
    ...FallowReportBaseFields,
    status: S.Literal("base-resolution-failed"),
    exitStatus: PositiveExitStatus,
    stderrExcerpt: S.String,
  },
  $I.annote("FallowReportBaseResolutionFailed", {
    description: "Fallow envelope emitted when a diff-aware base ref cannot be resolved.",
  })
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
 * Internal decoded Fallow report envelope discriminated by status.
 *
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
 * Decoded Fallow report envelope value.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export type FallowReportEnvelope = typeof FallowReportEnvelope.Type;
