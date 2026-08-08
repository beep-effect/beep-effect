/**
 * Face detection schemas for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FaceDetection, FaceDetectionConfidence, FaceDetectionPercentage } from "@beep/face-detection";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { PositiveMediaDimension } from "./Media.schemas.ts";

const $I = $RepoCliId.create("commands/Files/internal/DetectFaces.schemas");

/**
 * Reason a direct directory entry was skipped by `files detect-faces`.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectFacesSkippedReason } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectFacesSkippedReason)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DetectFacesSkippedReason = LiteralKit([
  "detection-failed",
  "directory",
  "extensionless",
  "non-media",
  "symlink",
  "unreadable-image",
  "unsupported-image",
  "video",
]).pipe(
  $I.annoteSchema("DetectFacesSkippedReason", {
    description: "Reason a source entry was not selected for face detection.",
  })
);

/**
 * Reason a direct directory entry was skipped by `files detect-faces`.
 *
 * @category models
 * @since 0.0.0
 */
export type DetectFacesSkippedReason = typeof DetectFacesSkippedReason.Type;

/**
 * Triage flag emitted by `files detect-faces`.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectFacesFlag } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectFacesFlag)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DetectFacesFlag = LiteralKit([
  "face-at-edge",
  "face-too-small",
  "has-face",
  "multiple-faces",
  "no-face",
]).pipe(
  $I.annoteSchema("DetectFacesFlag", {
    description: "Machine-readable face triage flag emitted for an analyzed image.",
  })
);

/**
 * Triage flag emitted by `files detect-faces`.
 *
 * @category models
 * @since 0.0.0
 */
export type DetectFacesFlag = typeof DetectFacesFlag.Type;

/**
 * Options used by the image face detection operation.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectFacesOptions } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectFacesOptions)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DetectFacesOptions extends S.Class<DetectFacesOptions>($I`DetectFacesOptions`)(
  {
    dir: S.String,
    edgeMarginPct: FaceDetectionPercentage,
    json: S.Boolean,
    manifest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    minConfidence: FaceDetectionConfidence,
    minFaceAreaPct: FaceDetectionPercentage,
    modelPath: S.String,
    moveNoFaceTo: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  },
  $I.annote("DetectFacesOptions", {
    description: "Validated options used by the face detection operation.",
  })
) {}

/**
 * JSON-safe options recorded by the image face detection report.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectFacesReportOptions } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectFacesReportOptions)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DetectFacesReportOptions extends S.Class<DetectFacesReportOptions>($I`DetectFacesReportOptions`)(
  {
    edgeMarginPct: FaceDetectionPercentage,
    json: S.Boolean,
    manifest: S.optionalKey(S.String),
    minConfidence: FaceDetectionConfidence,
    minFaceAreaPct: FaceDetectionPercentage,
    modelPath: S.String,
    moveNoFaceTo: S.optionalKey(S.String),
  },
  $I.annote("DetectFacesReportOptions", {
    description: "JSON-safe options recorded by files detect-faces.",
  })
) {}

/**
 * Image entry analyzed by `files detect-faces`.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectFacesEntry } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectFacesEntry)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DetectFacesEntry extends S.Class<DetectFacesEntry>($I`DetectFacesEntry`)(
  {
    extension: S.String,
    faceCount: S.Int,
    faces: S.Array(FaceDetection),
    flags: S.Array(DetectFacesFlag),
    hasFace: S.Boolean,
    height: PositiveMediaDimension,
    movedNoFaceName: S.optionalKey(S.String),
    movedNoFacePath: S.optionalKey(S.String),
    movedNoFaceRelativePath: S.optionalKey(S.String),
    primaryFace: S.optionalKey(FaceDetection),
    primaryFaceAreaPct: S.optionalKey(S.Finite),
    sourceName: S.String,
    sourcePath: S.String,
    width: PositiveMediaDimension,
  },
  $I.annote("DetectFacesEntry", {
    description: "Image file analyzed for detectable human faces.",
  })
) {}

/**
 * Source entry skipped by image face detection.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectFacesSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectFacesSkippedEntry)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DetectFacesSkippedEntry extends S.Class<DetectFacesSkippedEntry>($I`DetectFacesSkippedEntry`)(
  {
    extension: S.optionalKey(S.String),
    message: S.String,
    reason: DetectFacesSkippedReason,
    sourceName: S.String,
    sourcePath: S.String,
  },
  $I.annote("DetectFacesSkippedEntry", {
    description: "A direct source entry skipped by files detect-faces with a machine-readable reason.",
  })
) {}

/**
 * Summary counts for an image face detection run.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectFacesSummary } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectFacesSummary)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DetectFacesSummary extends S.Class<DetectFacesSummary>($I`DetectFacesSummary`)(
  {
    analyzedCount: S.Finite,
    directory: S.String,
    faceImageCount: S.Finite,
    movedNoFaceCount: S.Finite,
    noFaceImageCount: S.Finite,
    reviewImageCount: S.Finite,
    skippedCount: S.Finite,
    totalCount: S.Finite,
  },
  $I.annote("DetectFacesSummary", {
    description: "Summary counts returned by files detect-faces.",
  })
) {}

/**
 * JSON report emitted by an image face detection run.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectFacesReport } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectFacesReport)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DetectFacesReport extends S.Class<DetectFacesReport>($I`DetectFacesReport`)(
  {
    directory: S.String,
    entries: S.Array(DetectFacesEntry),
    manifestPath: S.String,
    manifestWritten: S.Boolean,
    options: DetectFacesReportOptions,
    schemaVersion: S.Literal("beep.files.detect-faces.v1"),
    skipped: S.Array(DetectFacesSkippedEntry),
    summary: DetectFacesSummary,
  },
  $I.annote("DetectFacesReport", {
    description: "JSON-safe report of face detection results.",
  })
) {}

/**
 * Decode face detection options from unknown input.
 *
 * **Example** (Decode undefined options)
 *
 * ```ts
 * import { decodeDetectFacesOptions } from "@beep/repo-cli/commands/Files"
 *
 * const program = decodeDetectFacesOptions(undefined)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeDetectFacesOptions = S.decodeUnknownEffect(DetectFacesOptions);

/**
 * Encode a face detection report into its JSON-safe shape.
 *
 * **Example** (Assign encode function)
 *
 * ```ts
 * import { encodeDetectFacesReport } from "@beep/repo-cli/commands/Files"
 *
 * const encode: typeof encodeDetectFacesReport = encodeDetectFacesReport
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeDetectFacesReport = S.encodeUnknownEffect(DetectFacesReport);
