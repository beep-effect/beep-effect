/**
 * Image normalization schemas for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FileSha256Hash, MediaDimensions, PositiveMediaDimension } from "./Media.schemas.js";

const $I = $RepoCliId.create("commands/Files/internal/Normalize.schemas");

/**
 * CLI image format accepted by `files normalize`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NormalizeImageFormatInput } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(NormalizeImageFormatInput)(undefined)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NormalizeImageFormatInput = LiteralKit(["png", "jpg", "jpeg", "webp"]).pipe(
  $I.annoteSchema("NormalizeImageFormatInput", {
    description: "Image output format accepted by the normalize command.",
  })
);

/**
 * CLI image format accepted by `files normalize`.
 *
 * @category models
 * @since 0.0.0
 */
export type NormalizeImageFormatInput = typeof NormalizeImageFormatInput.Type;

/**
 * Canonical image output format emitted by `files normalize`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NormalizeImageFormat } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(NormalizeImageFormat)(undefined)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NormalizeImageFormat = LiteralKit(["png", "jpg", "webp"]).pipe(
  $I.annoteSchema("NormalizeImageFormat", {
    description: "Canonical image output format emitted by the normalize command.",
  })
);

/**
 * Canonical image output format emitted by `files normalize`.
 *
 * @category models
 * @since 0.0.0
 */
export type NormalizeImageFormat = typeof NormalizeImageFormat.Type;

/**
 * Reason a direct directory entry was skipped by `files normalize`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NormalizeSkippedReason } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(NormalizeSkippedReason)(undefined)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NormalizeSkippedReason = LiteralKit([
  "duplicate",
  "directory",
  "extensionless",
  "non-media",
  "symlink",
  "unsupported-image",
  "video",
]).pipe(
  $I.annoteSchema("NormalizeSkippedReason", {
    description: "Reason a source entry was not selected for image normalization.",
  })
);

/**
 * Reason a direct directory entry was skipped by `files normalize`.
 *
 * @category models
 * @since 0.0.0
 */
export type NormalizeSkippedReason = typeof NormalizeSkippedReason.Type;

/**
 * Options used by the image normalization operation.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NormalizeFilesOptions } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(NormalizeFilesOptions)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizeFilesOptions extends S.Class<NormalizeFilesOptions>($I`NormalizeFilesOptions`)(
  {
    dedupe: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    dir: S.String,
    dryRun: S.Boolean,
    format: NormalizeImageFormat,
    manifest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    maxLongEdge: S.Option(PositiveMediaDimension).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<PositiveMediaDimension>()))
    ),
    moveDuplicatesTo: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    outDir: S.String,
    overwrite: S.Boolean,
  },
  $I.annote("NormalizeFilesOptions", {
    description: "Validated options used by the image normalization operation.",
  })
) {}

/**
 * Manifest options recorded for an image normalization run.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NormalizeManifestOptions } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(NormalizeManifestOptions)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizeManifestOptions extends S.Class<NormalizeManifestOptions>($I`NormalizeManifestOptions`)(
  {
    dedupe: S.Boolean,
    format: NormalizeImageFormat,
    maxLongEdge: S.optionalKey(PositiveMediaDimension),
    moveDuplicatesTo: S.optionalKey(S.String),
    overwrite: S.Boolean,
  },
  $I.annote("NormalizeManifestOptions", {
    description: "JSON-safe options recorded in the normalize manifest.",
  })
) {}

/**
 * Planned source-to-output image transform.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NormalizePlanEntry } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(NormalizePlanEntry)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizePlanEntry extends S.Class<NormalizePlanEntry>($I`NormalizePlanEntry`)(
  {
    format: NormalizeImageFormat,
    inputDimensions: MediaDimensions,
    outputDimensions: MediaDimensions,
    outputName: S.String,
    outputHash: S.optionalKey(FileSha256Hash),
    outputPath: S.String,
    outputRelativePath: S.String,
    outputSizeBytes: S.optionalKey(S.String),
    resized: S.Boolean,
    sourceExtension: S.String,
    sourceName: S.String,
    sourcePath: S.String,
    sourceRelativePath: S.String,
    sourceSizeBytes: S.String,
  },
  $I.annote("NormalizePlanEntry", {
    description: "A source-to-output image transform planned by files normalize.",
  })
) {}

/**
 * Source entry skipped by image normalization.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NormalizeSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(NormalizeSkippedEntry)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizeSkippedEntry extends S.Class<NormalizeSkippedEntry>($I`NormalizeSkippedEntry`)(
  {
    duplicateOfOutputRelativePath: S.optionalKey(S.String),
    duplicateOfSourceRelativePath: S.optionalKey(S.String),
    duplicateMovedPath: S.optionalKey(S.String),
    duplicateMovedRelativePath: S.optionalKey(S.String),
    extension: S.optionalKey(S.String),
    message: S.String,
    outputHash: S.optionalKey(FileSha256Hash),
    reason: NormalizeSkippedReason,
    sourceName: S.String,
    sourcePath: S.String,
  },
  $I.annote("NormalizeSkippedEntry", {
    description: "A direct source entry skipped by files normalize with a machine-readable reason.",
  })
) {}

/**
 * Planned image normalization run.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NormalizePlan } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(NormalizePlan)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizePlan extends S.Class<NormalizePlan>($I`NormalizePlan`)(
  {
    duplicateDirectory: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    entries: S.Array(NormalizePlanEntry),
    manifestPath: S.String,
    options: NormalizeManifestOptions,
    outputDirectory: S.String,
    skipped: S.Array(NormalizeSkippedEntry),
    sourceDirectory: S.String,
  },
  $I.annote("NormalizePlan", {
    description: "Planned image normalization entries plus skipped source entries.",
  })
) {}

/**
 * Summary counts for an image normalization run.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NormalizeSummary } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(NormalizeSummary)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizeSummary extends S.Class<NormalizeSummary>($I`NormalizeSummary`)(
  {
    directory: S.String,
    duplicateCount: S.Finite,
    dryRun: S.Boolean,
    format: NormalizeImageFormat,
    manifestPath: S.String,
    manifestWritten: S.Boolean,
    maxLongEdge: S.Option(PositiveMediaDimension).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<PositiveMediaDimension>()))
    ),
    movedDuplicateCount: S.Finite,
    normalizedCount: S.Finite,
    outputDirectory: S.String,
    plannedCount: S.Finite,
    resizedCount: S.Finite,
    skippedCount: S.Finite,
  },
  $I.annote("NormalizeSummary", {
    description: "Summary counts returned by files normalize.",
  })
) {}

/**
 * JSON-safe summary recorded in an image normalization manifest.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NormalizeManifestSummary } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(NormalizeManifestSummary)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizeManifestSummary extends S.Class<NormalizeManifestSummary>($I`NormalizeManifestSummary`)(
  {
    duplicateCount: S.Finite,
    movedDuplicateCount: S.Finite,
    normalizedCount: S.Finite,
    plannedCount: S.Finite,
    resizedCount: S.Finite,
    skippedCount: S.Finite,
  },
  $I.annote("NormalizeManifestSummary", {
    description: "JSON-safe summary counts recorded by files normalize.",
  })
) {}

/**
 * Manifest written by a successful image normalization run.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NormalizeManifest } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(NormalizeManifest)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NormalizeManifest extends S.Class<NormalizeManifest>($I`NormalizeManifest`)(
  {
    entries: S.Array(NormalizePlanEntry),
    manifestPath: S.String,
    options: NormalizeManifestOptions,
    outputDirectory: S.String,
    schemaVersion: S.Literal("beep.files.normalize.v1"),
    skipped: S.Array(NormalizeSkippedEntry),
    sourceDirectory: S.String,
    summary: NormalizeManifestSummary,
  },
  $I.annote("NormalizeManifest", {
    description: "JSON manifest of source-to-output transforms produced by files normalize.",
  })
) {}

/**
 * Decode an unknown maximum long-edge value.
 *
 * @example
 * ```ts
 * import { decodeNormalizeMaxLongEdge } from "@beep/repo-cli/commands/Files"
 *
 * const program = decodeNormalizeMaxLongEdge(undefined)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeNormalizeMaxLongEdge = S.decodeUnknownEffect(PositiveMediaDimension);

/**
 * Encode a normalize manifest into its JSON-safe shape.
 *
 * @example
 * ```ts
 * import { encodeNormalizeManifest } from "@beep/repo-cli/commands/Files"
 *
 * const encode: typeof encodeNormalizeManifest = encodeNormalizeManifest
 * ```
 * @category encoding
 * @since 0.0.0
 */
export const encodeNormalizeManifest = S.encodeUnknownEffect(NormalizeManifest);
