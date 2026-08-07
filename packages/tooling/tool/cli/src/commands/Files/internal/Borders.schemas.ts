/**
 * Border detection and cropping schemas for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { NonNegativePixelOffset, PositiveMediaDimension, RgbChannel } from "./Media.schemas.ts";

const $I = $RepoCliId.create("commands/Files/internal/Borders.schemas");

/**
 * Side of an image edge scanned for a solid border.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BorderSide } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(BorderSide)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BorderSide = LiteralKit(["top", "right", "bottom", "left"]).pipe(
  $I.annoteSchema("BorderSide", {
    description: "Image side scanned by the border detection operation.",
  })
);

/**
 * Side of an image edge scanned for a solid border.
 *
 * @category models
 * @since 0.0.0
 */
export type BorderSide = typeof BorderSide.Type;

/**
 * Classified border layout for an analyzed image.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BorderDetectionKind } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(BorderDetectionKind)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BorderDetectionKind = LiteralKit(["none", "canvas-edge", "pillarbox", "letterbox", "frame", "mixed"]).pipe(
  $I.annoteSchema("BorderDetectionKind", {
    description: "Detected solid-border layout for a dataset image.",
  })
);

/**
 * Classified border layout for an analyzed image.
 *
 * @category models
 * @since 0.0.0
 */
export type BorderDetectionKind = typeof BorderDetectionKind.Type;

/**
 * Reason a direct directory entry was skipped by `files detect-borders`.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectBordersSkippedReason } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectBordersSkippedReason)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DetectBordersSkippedReason = LiteralKit([
  "directory",
  "extensionless",
  "non-media",
  "symlink",
  "unsupported-image",
  "unreadable-image",
  "video",
]).pipe(
  $I.annoteSchema("DetectBordersSkippedReason", {
    description: "Reason a source entry was not analyzed for solid borders.",
  })
);

/**
 * Reason a direct directory entry was skipped by `files detect-borders`.
 *
 * @category models
 * @since 0.0.0
 */
export type DetectBordersSkippedReason = typeof DetectBordersSkippedReason.Type;

/**
 * Percentage threshold used by border detection options.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BorderDetectionPercentage } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(BorderDetectionPercentage)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BorderDetectionPercentage = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isGreaterThan(0, {
        identifier: $I`BorderDetectionPercentageGreaterThanZeroCheck`,
        title: "Border Detection Percentage Greater Than Zero",
        description: "Border detection percentages must be greater than zero.",
        message: "Expected a percentage greater than zero",
      }),
      S.isLessThanOrEqualTo(100, {
        identifier: $I`BorderDetectionPercentageLessThanOrEqualToOneHundredCheck`,
        title: "Border Detection Percentage Maximum",
        description: "Border detection percentages must not exceed 100.",
        message: "Expected a percentage no greater than 100",
      }),
    ],
    {
      identifier: $I`BorderDetectionPercentageChecks`,
      title: "Border Detection Percentage",
      description: "Checks for percentage thresholds accepted by border detection.",
    }
  )
).pipe(
  $I.annoteSchema("BorderDetectionPercentage", {
    description: "Percentage threshold between greater than zero and 100.",
  })
);

/**
 * Percentage threshold used by border detection options.
 *
 * @category models
 * @since 0.0.0
 */
export type BorderDetectionPercentage = typeof BorderDetectionPercentage.Type;

/**
 * Maximum scan percentage accepted by border detection.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BorderDetectionMaxScanPercentage } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(BorderDetectionMaxScanPercentage)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BorderDetectionMaxScanPercentage = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isGreaterThan(0, {
        identifier: $I`BorderDetectionMaxScanPercentageGreaterThanZeroCheck`,
        title: "Border Detection Max Scan Percentage Greater Than Zero",
        description: "The maximum scan percentage must be greater than zero.",
        message: "Expected a max scan percentage greater than zero",
      }),
      S.isLessThanOrEqualTo(50, {
        identifier: $I`BorderDetectionMaxScanPercentageLessThanOrEqualToFiftyCheck`,
        title: "Border Detection Max Scan Percentage Maximum",
        description: "The maximum scan percentage is capped at half of an image dimension.",
        message: "Expected a max scan percentage no greater than 50",
      }),
    ],
    {
      identifier: $I`BorderDetectionMaxScanPercentageChecks`,
      title: "Border Detection Max Scan Percentage",
      description: "Checks for maximum inward border scan percentage.",
    }
  )
).pipe(
  $I.annoteSchema("BorderDetectionMaxScanPercentage", {
    description: "Maximum percentage of each image dimension to scan inward from an edge.",
  })
);

/**
 * Maximum scan percentage accepted by border detection.
 *
 * @category models
 * @since 0.0.0
 */
export type BorderDetectionMaxScanPercentage = typeof BorderDetectionMaxScanPercentage.Type;

/**
 * RGB channel tolerance accepted by border detection.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BorderDetectionTolerance } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(BorderDetectionTolerance)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BorderDetectionTolerance = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`BorderDetectionToleranceGreaterThanOrEqualToZeroCheck`,
        title: "Border Detection Tolerance Minimum",
        description: "RGB tolerance must be zero or greater.",
        message: "Expected an RGB tolerance no less than zero",
      }),
      S.isLessThanOrEqualTo(255, {
        identifier: $I`BorderDetectionToleranceLessThanOrEqualToTwoHundredFiftyFiveCheck`,
        title: "Border Detection Tolerance Maximum",
        description: "RGB tolerance must fit inside one 8-bit color channel.",
        message: "Expected an RGB tolerance no greater than 255",
      }),
    ],
    {
      identifier: $I`BorderDetectionToleranceChecks`,
      title: "Border Detection Tolerance",
      description: "Checks for RGB channel tolerance accepted by border detection.",
    }
  )
).pipe(
  $I.annoteSchema("BorderDetectionTolerance", {
    description: "Maximum per-channel RGB distance accepted for near-solid border pixels.",
  })
);

/**
 * RGB channel tolerance accepted by border detection.
 *
 * @category models
 * @since 0.0.0
 */
export type BorderDetectionTolerance = typeof BorderDetectionTolerance.Type;

/**
 * Options used by the image border detection operation.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectBordersOptions } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectBordersOptions)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DetectBordersOptions extends S.Class<DetectBordersOptions>($I`DetectBordersOptions`)(
  {
    dir: S.String,
    json: S.Boolean,
    maxScanPct: BorderDetectionMaxScanPercentage,
    minSolidPct: BorderDetectionPercentage,
    minWidthPct: BorderDetectionPercentage,
    tolerance: BorderDetectionTolerance,
  },
  $I.annote("DetectBordersOptions", {
    description: "Validated options used by the solid-border detection operation.",
  })
) {}

/**
 * Options used by the image border cropping operation.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CropBordersOptions } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CropBordersOptions)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CropBordersOptions extends S.Class<CropBordersOptions>($I`CropBordersOptions`)(
  {
    dir: S.String,
    dryRun: S.Boolean,
    maxScanPct: BorderDetectionMaxScanPercentage,
    minSolidPct: BorderDetectionPercentage,
    minWidthPct: BorderDetectionPercentage,
    tolerance: BorderDetectionTolerance,
  },
  $I.annote("CropBordersOptions", {
    description: "Validated options used by the solid-border crop operation.",
  })
) {}

/**
 * RGB color sampled from a detected image border.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RgbColor } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(RgbColor)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RgbColor extends S.Class<RgbColor>($I`RgbColor`)(
  {
    b: RgbChannel,
    g: RgbChannel,
    r: RgbChannel,
  },
  $I.annote("RgbColor", {
    description: "RGB color sampled from an image border.",
  })
) {}

/**
 * Measurement for one scanned image side.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectBorderSideMeasurement } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectBorderSideMeasurement)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DetectBorderSideMeasurement extends S.Class<DetectBorderSideMeasurement>($I`DetectBorderSideMeasurement`)(
  {
    color: RgbColor,
    colorHex: S.String,
    matched: S.Boolean,
    score: S.Finite,
    side: BorderSide,
    widthPct: S.Finite,
    widthPx: S.Int,
  },
  $I.annote("DetectBorderSideMeasurement", {
    description: "Measured near-solid border width and sampled edge color for one image side.",
  })
) {}

/**
 * Image entry analyzed by `files detect-borders`.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectBordersEntry } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectBordersEntry)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DetectBordersEntry extends S.Class<DetectBordersEntry>($I`DetectBordersEntry`)(
  {
    borderCount: S.Int,
    classification: BorderDetectionKind,
    extension: S.String,
    hasBorder: S.Boolean,
    height: PositiveMediaDimension,
    sides: S.Array(DetectBorderSideMeasurement),
    sourceName: S.String,
    sourcePath: S.String,
    width: PositiveMediaDimension,
  },
  $I.annote("DetectBordersEntry", {
    description: "Image file analyzed for solid or near-solid canvas borders.",
  })
) {}

/**
 * Source entry skipped by image border detection.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectBordersSkippedEntry } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectBordersSkippedEntry)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DetectBordersSkippedEntry extends S.Class<DetectBordersSkippedEntry>($I`DetectBordersSkippedEntry`)(
  {
    extension: S.optionalKey(S.String),
    message: S.String,
    reason: DetectBordersSkippedReason,
    sourceName: S.String,
    sourcePath: S.String,
  },
  $I.annote("DetectBordersSkippedEntry", {
    description: "A direct source entry skipped by files detect-borders with a machine-readable reason.",
  })
) {}

/**
 * Summary counts for an image border detection run.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectBordersSummary } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectBordersSummary)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DetectBordersSummary extends S.Class<DetectBordersSummary>($I`DetectBordersSummary`)(
  {
    analyzedCount: S.Finite,
    borderedCount: S.Finite,
    directory: S.String,
    skippedCount: S.Finite,
    totalCount: S.Finite,
  },
  $I.annote("DetectBordersSummary", {
    description: "Summary counts returned by files detect-borders.",
  })
) {}

/**
 * JSON report emitted by an image border detection run.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DetectBordersReport } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(DetectBordersReport)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DetectBordersReport extends S.Class<DetectBordersReport>($I`DetectBordersReport`)(
  {
    directory: S.String,
    entries: S.Array(DetectBordersEntry),
    options: DetectBordersOptions,
    schemaVersion: S.Literal("beep.files.detect-borders.v1"),
    skipped: S.Array(DetectBordersSkippedEntry),
    summary: DetectBordersSummary,
  },
  $I.annote("DetectBordersReport", {
    description: "JSON-safe report of solid-border detection results.",
  })
) {}

/**
 * Planned crop for an image with detected solid borders.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CropBordersPlanEntry } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CropBordersPlanEntry)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CropBordersPlanEntry extends S.Class<CropBordersPlanEntry>($I`CropBordersPlanEntry`)(
  {
    borderCount: S.Int,
    classification: BorderDetectionKind,
    cropHeight: PositiveMediaDimension,
    cropLeft: NonNegativePixelOffset,
    cropTop: NonNegativePixelOffset,
    cropWidth: PositiveMediaDimension,
    extension: S.String,
    originalHeight: PositiveMediaDimension,
    originalWidth: PositiveMediaDimension,
    sides: S.Array(DetectBorderSideMeasurement),
    sourceName: S.String,
    sourcePath: S.String,
  },
  $I.annote("CropBordersPlanEntry", {
    description: "Image crop planned from detected near-solid border measurements.",
  })
) {}

/**
 * Planned border crop entries plus skipped file counts.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CropBordersPlan } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CropBordersPlan)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CropBordersPlan extends S.Class<CropBordersPlan>($I`CropBordersPlan`)(
  {
    analyzedCount: S.Finite,
    borderedCount: S.Finite,
    directory: S.String,
    entries: S.Array(CropBordersPlanEntry),
    skippedCount: S.Finite,
  },
  $I.annote("CropBordersPlan", {
    description: "Planned in-place crops for image files with detected near-solid borders.",
  })
) {}

/**
 * Summary returned by `cropBordersFiles`.
 *
 * **Example** (Schema accepts undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CropBordersSummary } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(CropBordersSummary)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CropBordersSummary extends S.Class<CropBordersSummary>($I`CropBordersSummary`)(
  {
    analyzedCount: S.Finite,
    borderedCount: S.Finite,
    croppedCount: S.Finite,
    directory: S.String,
    dryRun: S.Boolean,
    plannedCount: S.Finite,
    skippedCount: S.Finite,
  },
  $I.annote("CropBordersSummary", {
    description: "Summary counts returned by files crop-borders.",
  })
) {}

/**
 * Decode unknown border detection options.
 *
 * **Example** (Decode undefined options)
 *
 * ```ts
 * import { decodeDetectBordersOptions } from "@beep/repo-cli/commands/Files"
 *
 * const program = decodeDetectBordersOptions(undefined)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeDetectBordersOptions = S.decodeUnknownEffect(DetectBordersOptions);

/**
 * Decode unknown border cropping options.
 *
 * **Example** (Decode undefined options)
 *
 * ```ts
 * import { decodeCropBordersOptions } from "@beep/repo-cli/commands/Files"
 *
 * const program = decodeCropBordersOptions(undefined)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeCropBordersOptions = S.decodeUnknownEffect(CropBordersOptions);

/**
 * Encode a detect-borders report into its JSON-safe shape.
 *
 * **Example** (Assign encode function)
 *
 * ```ts
 * import { encodeDetectBordersReport } from "@beep/repo-cli/commands/Files"
 *
 * const encode: typeof encodeDetectBordersReport = encodeDetectBordersReport
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeDetectBordersReport = S.encodeUnknownEffect(DetectBordersReport);
