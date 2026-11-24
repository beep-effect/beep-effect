/**
 * Poor-candidate archival schemas for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { MediaDimensions, PositiveMediaDimension } from "./Media.schemas.ts";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Files/internal/ArchivePoorCandidates.schemas");

/**
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CandidateAssessmentProfile } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CandidateAssessmentProfile)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CandidateAssessmentProfile = LiteralKit(["character-lora"]).pipe(
  $I.annoteSchema("CandidateAssessmentProfile", {
    description: "Dataset-quality assessment profile for files archive-poor-candidates.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type CandidateAssessmentProfile = typeof CandidateAssessmentProfile.Type;

/**
 * Candidate-quality decision produced by `files archive-poor-candidates`.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CandidateAssessmentDecision } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CandidateAssessmentDecision)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CandidateAssessmentDecision = LiteralKit(["archive", "keep"]).pipe(
  $I.annoteSchema("CandidateAssessmentDecision", {
    description: "Whether an assessed image should be kept in place or archived as a poor candidate.",
  })
);

/**
 * Candidate-quality decision produced by `files archive-poor-candidates`.
 *
 * @category models
 * @since 0.0.0
 */
export type CandidateAssessmentDecision = typeof CandidateAssessmentDecision.Type;

/**
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CandidateAssessmentReason } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CandidateAssessmentReason)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CandidateAssessmentReason = LiteralKit([
  "extreme-aspect-ratio",
  "short-edge-too-small",
  "upscale-too-large",
]).pipe(
  $I.annoteSchema("CandidateAssessmentReason", {
    description: "Machine-readable hard-threshold reason for archiving a poor image candidate.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type CandidateAssessmentReason = typeof CandidateAssessmentReason.Type;

/**
 * Reason a direct directory entry was skipped by `files archive-poor-candidates`.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArchivePoorCandidatesSkippedReason } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ArchivePoorCandidatesSkippedReason)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArchivePoorCandidatesSkippedReason = LiteralKit([
  "directory",
  "extensionless",
  "non-media",
  "symlink",
  "unsupported-image",
  "unreadable-image",
  "video",
]).pipe(
  $I.annoteSchema("ArchivePoorCandidatesSkippedReason", {
    description: "Reason a source entry was not assessed for candidate-quality archival.",
  })
);

/**
 * Reason a direct directory entry was skipped by `files archive-poor-candidates`.
 *
 * @category models
 * @since 0.0.0
 */
export type ArchivePoorCandidatesSkippedReason = typeof ArchivePoorCandidatesSkippedReason.Type;

/**
 * Numeric threshold ratio used by candidate-quality triage.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CandidateRatioThreshold } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CandidateRatioThreshold)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CandidateRatioThreshold = S.Finite.check(
  S.isGreaterThanOrEqualTo(
    1,
    $I.annote("CandidateRatioThresholdGreaterThanOrEqualToOneCheck", {
      title: "Candidate Ratio Threshold",
      description: "Candidate assessment ratio thresholds must be at least one.",
      message: "Expected a ratio threshold greater than or equal to one",
    })
  )
).pipe(
  $I.annoteSchema("CandidateRatioThreshold", {
    description: "A ratio threshold greater than or equal to one.",
  })
);

/**
 * Numeric threshold ratio used by candidate-quality triage.
 *
 * @category models
 * @since 0.0.0
 */
export type CandidateRatioThreshold = typeof CandidateRatioThreshold.Type;

/**
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArchivePoorCandidatesOptions } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ArchivePoorCandidatesOptions)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesOptions extends S.Opaque<
  ArchivePoorCandidatesOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    archiveDir: S.String,
    dir: S.String,
    dryRun: S.Boolean,
    manifest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    maxAspect: CandidateRatioThreshold,
    maxUpscale: CandidateRatioThreshold,
    minShortEdge: PositiveMediaDimension,
    overwrite: S.Boolean,
    profile: CandidateAssessmentProfile,
    sidecars: S.String.pipe(S.withConstructorDefault(Effect.succeed("txt"))),
    targetResolution: PositiveMediaDimension,
  }).pipe(
    $I.annoteSchema("ArchivePoorCandidatesOptions", {
      description: "Validated options used by files archive-poor-candidates.",
    })
  )
) {}

/**
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArchivePoorCandidatesManifestOptions } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ArchivePoorCandidatesManifestOptions)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesManifestOptions extends S.Opaque<
  ArchivePoorCandidatesManifestOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    maxAspect: CandidateRatioThreshold,
    maxUpscale: CandidateRatioThreshold,
    minShortEdge: PositiveMediaDimension,
    overwrite: S.Boolean,
    profile: CandidateAssessmentProfile,
    sidecars: S.Array(S.String),
    targetResolution: PositiveMediaDimension,
  }).pipe(
    $I.annoteSchema("ArchivePoorCandidatesManifestOptions", {
      description: "JSON-safe options recorded by files archive-poor-candidates.",
    })
  )
) {}

/**
 * Derived image metrics used for candidate-quality triage.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CandidateAssessmentMetrics } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CandidateAssessmentMetrics)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateAssessmentMetrics extends S.Opaque<
  CandidateAssessmentMetrics,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    aspectRatio: S.Finite,
    pixelArea: S.Int,
    shortEdge: PositiveMediaDimension,
    upscaleToTarget: S.Finite,
  }).pipe(
    $I.annoteSchema("CandidateAssessmentMetrics", {
      description: "Resolution-derived metrics used to classify image training-data candidates.",
    })
  )
) {}

/**
 * Caption or metadata sidecar moved with an archived image.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArchivedSidecarEntry } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ArchivedSidecarEntry)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchivedSidecarEntry extends S.Opaque<ArchivedSidecarEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    archivePath: S.String,
    archiveRelativePath: S.String,
    extension: S.String,
    sourcePath: S.String,
    sourceRelativePath: S.String,
  }).pipe(
    $I.annoteSchema("ArchivedSidecarEntry", {
      description: "A same-stem sidecar file moved with an archived poor image candidate.",
    })
  )
) {}

/**
 * Assessed image candidate with an archive or keep decision.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArchivePoorCandidatesEntry } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ArchivePoorCandidatesEntry)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesEntry extends S.Opaque<
  ArchivePoorCandidatesEntry,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    archiveName: S.optionalKey(S.String),
    archivePath: S.optionalKey(S.String),
    archiveRelativePath: S.optionalKey(S.String),
    decision: CandidateAssessmentDecision,
    dimensions: MediaDimensions,
    extension: S.String,
    metrics: CandidateAssessmentMetrics,
    reasons: S.Array(CandidateAssessmentReason),
    sidecars: S.Array(ArchivedSidecarEntry),
    sourceName: S.String,
    sourcePath: S.String,
    sourceRelativePath: S.String,
    sourceSizeBytes: S.String,
  }).pipe(
    $I.annoteSchema("ArchivePoorCandidatesEntry", {
      description: "Image candidate assessed by files archive-poor-candidates.",
    })
  )
) {}

/**
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArchivePoorCandidatesSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ArchivePoorCandidatesSkippedEntry)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesSkippedEntry extends S.Opaque<
  ArchivePoorCandidatesSkippedEntry,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    extension: S.optionalKey(S.String),
    message: S.String,
    reason: ArchivePoorCandidatesSkippedReason,
    sourceName: S.String,
    sourcePath: S.String,
  }).pipe(
    $I.annoteSchema("ArchivePoorCandidatesSkippedEntry", {
      description: "A direct source entry skipped by files archive-poor-candidates with a machine-readable reason.",
    })
  )
) {}

/**
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArchivePoorCandidatesPlan } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ArchivePoorCandidatesPlan)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesPlan extends S.Opaque<ArchivePoorCandidatesPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    archiveDirectory: S.String,
    entries: S.Array(ArchivePoorCandidatesEntry),
    manifestPath: S.String,
    options: ArchivePoorCandidatesManifestOptions,
    skipped: S.Array(ArchivePoorCandidatesSkippedEntry),
    sourceDirectory: S.String,
  }).pipe(
    $I.annoteSchema("ArchivePoorCandidatesPlan", {
      description: "Planned image candidate archival entries plus skipped source entries.",
    })
  )
) {}

/**
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArchivePoorCandidatesSummary } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ArchivePoorCandidatesSummary)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesSummary extends S.Opaque<
  ArchivePoorCandidatesSummary,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    archivedCount: S.Finite,
    archiveDirectory: S.String,
    assessedCount: S.Finite,
    directory: S.String,
    dryRun: S.Boolean,
    keptCount: S.Finite,
    manifestPath: S.String,
    manifestWritten: S.Boolean,
    movedSidecarCount: S.Finite,
    skippedCount: S.Finite,
  }).pipe(
    $I.annoteSchema("ArchivePoorCandidatesSummary", {
      description: "Summary counts returned by files archive-poor-candidates.",
    })
  )
) {}

/**
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArchivePoorCandidatesManifestSummary } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ArchivePoorCandidatesManifestSummary)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesManifestSummary extends S.Opaque<
  ArchivePoorCandidatesManifestSummary,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    archivedCount: S.Finite,
    assessedCount: S.Finite,
    keptCount: S.Finite,
    movedSidecarCount: S.Finite,
    skippedCount: S.Finite,
  }).pipe(
    $I.annoteSchema("ArchivePoorCandidatesManifestSummary", {
      description: "JSON-safe summary counts recorded by files archive-poor-candidates.",
    })
  )
) {}

/**
 * Manifest written by a successful poor-candidate archive run.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArchivePoorCandidatesManifest } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ArchivePoorCandidatesManifest)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchivePoorCandidatesManifest extends S.Opaque<
  ArchivePoorCandidatesManifest,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    archiveDirectory: S.String,
    entries: S.Array(ArchivePoorCandidatesEntry),
    manifestPath: S.String,
    options: ArchivePoorCandidatesManifestOptions,
    schemaVersion: S.tag("beep.files.archive-poor-candidates.v1"),
    skipped: S.Array(ArchivePoorCandidatesSkippedEntry),
    sourceDirectory: S.String,
    summary: ArchivePoorCandidatesManifestSummary,
  }).pipe(
    $I.annoteSchema("ArchivePoorCandidatesManifest", {
      description: "JSON manifest of image candidates archived by files archive-poor-candidates.",
    })
  )
) {}

/**
 * Decode unknown poor-candidate archive options.
 *
 * **Example** (Decode undefined options)
 *
 * ```ts
 * import { decodeArchivePoorCandidatesOptions } from "@beep/repo-cli/commands/Files"
 *
 * const program = decodeArchivePoorCandidatesOptions(undefined)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeArchivePoorCandidatesOptions: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<ArchivePoorCandidatesOptions, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<ArchivePoorCandidatesOptions, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(ArchivePoorCandidatesOptions));

/**
 * Encode a poor-candidate archive manifest into its JSON-safe shape.
 *
 * **Example** (Encode manifest type alias)
 *
 * ```ts
 * import { encodeArchivePoorCandidatesManifest } from "@beep/repo-cli/commands/Files"
 *
 * const encode: typeof encodeArchivePoorCandidatesManifest = encodeArchivePoorCandidatesManifest
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeArchivePoorCandidatesManifest: {
  (
    options?: AST.ParseOptions
  ): (input: unknown) => Effect.Effect<typeof ArchivePoorCandidatesManifest.Encoded, S.SchemaError>;
  (
    input: unknown,
    options?: AST.ParseOptions
  ): Effect.Effect<typeof ArchivePoorCandidatesManifest.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(ArchivePoorCandidatesManifest));
