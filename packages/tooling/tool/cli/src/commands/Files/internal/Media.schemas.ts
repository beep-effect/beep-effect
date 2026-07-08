/**
 * Shared media primitives and probe-boundary schemas for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Str } from "@beep/utils";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Files/internal/Media.schemas");

/**
 * Positive media dimension schema.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PositiveMediaDimension } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(PositiveMediaDimension)(undefined)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const PositiveMediaDimension = S.Int.check(
  S.makeFilterGroup(
    [
      S.isGreaterThan(0, {
        identifier: $I`PositiveMediaDimensionGreaterThanZeroCheck`,
        title: "Positive Media Dimension",
        description: "A media width or height must be greater than zero.",
        message: "Expected a positive media dimension",
      }),
    ],
    {
      identifier: $I`PositiveMediaDimensionChecks`,
      title: "Positive Media Dimension",
      description: "Checks for positive integer media dimensions.",
    }
  )
).pipe(
  $I.annoteSchema("PositiveMediaDimension", {
    description: "A positive integer width or height reported by a media probe.",
  })
);

/**
 * Positive media dimension value.
 *
 * @category models
 * @since 0.0.0
 */
export type PositiveMediaDimension = typeof PositiveMediaDimension.Type;

/**
 * SHA-256 hash recorded for normalized file bytes.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { FileSha256Hash } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(FileSha256Hash)(undefined)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const FileSha256Hash = S.String.check(
  S.isPattern(/^sha256:[a-f0-9]{64}$/, {
    identifier: $I`FileSha256HashPatternCheck`,
    title: "File SHA-256 Hash",
    description: "A file content hash must use the sha256:<64 lowercase hex digits> format.",
    message: "Expected a SHA-256 file hash",
  })
).pipe(
  $I.annoteSchema("FileSha256Hash", {
    description: "A SHA-256 digest for exact file-byte duplicate detection.",
  })
);

/**
 * SHA-256 hash recorded for normalized file bytes.
 *
 * @category models
 * @since 0.0.0
 */
export type FileSha256Hash = typeof FileSha256Hash.Type;

/**
 * Non-negative pixel offset schema.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonNegativePixelOffset } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(NonNegativePixelOffset)(undefined)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NonNegativePixelOffset = S.Int.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`NonNegativePixelOffsetGreaterThanOrEqualToZeroCheck`,
        title: "Non-negative Pixel Offset",
        description: "A crop offset must be greater than or equal to zero.",
        message: "Expected a non-negative pixel offset",
      }),
    ],
    {
      identifier: $I`NonNegativePixelOffsetChecks`,
      title: "Non-negative Pixel Offset",
      description: "Checks for non-negative integer pixel offsets.",
    }
  )
).pipe(
  $I.annoteSchema("NonNegativePixelOffset", {
    description: "A non-negative integer crop offset.",
  })
);

/**
 * Non-negative pixel offset value.
 *
 * @category models
 * @since 0.0.0
 */
export type NonNegativePixelOffset = typeof NonNegativePixelOffset.Type;

/**
 * Media kind schema for selected dataset files.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { MediaKind } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(MediaKind)(undefined)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const MediaKind = LiteralKit(["image", "video"]).pipe(
  $I.annoteSchema("MediaKind", {
    description: "The media probing strategy used for a selected file.",
  })
);

/**
 * Media kind for selected dataset files.
 *
 * @category models
 * @since 0.0.0
 */
export type MediaKind = typeof MediaKind.Type;

/**
 * Integer RGB channel value.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { RgbChannel } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(RgbChannel)(undefined)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const RgbChannel = S.Int.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`RgbChannelGreaterThanOrEqualToZeroCheck`,
        title: "RGB Channel Minimum",
        description: "RGB channel values must be zero or greater.",
        message: "Expected an RGB channel value no less than zero",
      }),
      S.isLessThanOrEqualTo(255, {
        identifier: $I`RgbChannelLessThanOrEqualToTwoHundredFiftyFiveCheck`,
        title: "RGB Channel Maximum",
        description: "RGB channel values must not exceed 255.",
        message: "Expected an RGB channel value no greater than 255",
      }),
    ],
    {
      identifier: $I`RgbChannelChecks`,
      title: "RGB Channel",
      description: "Checks for one 8-bit RGB channel.",
    }
  )
).pipe(
  $I.annoteSchema("RgbChannel", {
    description: "One integer 8-bit RGB channel value.",
  })
);

/**
 * Integer RGB channel value.
 *
 * @category models
 * @since 0.0.0
 */
export type RgbChannel = typeof RgbChannel.Type;

/**
 * Dimension metadata returned by `image-size`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ImageSizeMetadata } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ImageSizeMetadata)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ImageSizeMetadata extends S.Class<ImageSizeMetadata>($I`ImageSizeMetadata`)(
  {
    height: PositiveMediaDimension,
    orientation: S.optionalKey(S.Int),
    width: PositiveMediaDimension,
  },
  $I.annote("ImageSizeMetadata", {
    description: "Dimension metadata returned by the image-size package.",
  })
) {}

/**
 * Side-data entry returned by `ffprobe`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { FfprobeSideData } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(FfprobeSideData)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FfprobeSideData extends S.Class<FfprobeSideData>($I`FfprobeSideData`)(
  {
    rotation: S.optionalKey(S.Union([S.Finite, S.FiniteFromString])),
  },
  $I.annote("FfprobeSideData", {
    description: "Side-data entry returned by ffprobe for a video stream.",
  })
) {}

/**
 * Video stream metadata returned by `ffprobe`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { FfprobeStream } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(FfprobeStream)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FfprobeStream extends S.Class<FfprobeStream>($I`FfprobeStream`)(
  {
    height: PositiveMediaDimension,
    side_data_list: S.Array(FfprobeSideData).pipe(S.optionalKey),
    tags: S.optionalKey(S.Record(S.String, S.Unknown)),
    width: PositiveMediaDimension,
  },
  $I.annote("FfprobeStream", {
    description: "Video stream metadata returned by ffprobe.",
  })
) {}

/**
 * JSON document emitted by `ffprobe`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { FfprobeOutput } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(FfprobeOutput)(undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FfprobeOutput extends S.Class<FfprobeOutput>($I`FfprobeOutput`)(
  {
    streams: S.Array(FfprobeStream),
  },
  $I.annote("FfprobeOutput", {
    description: "JSON document emitted by ffprobe stream probing.",
  })
) {}

/**
 * Safe generated filename prefix schema.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { SafeFilePrefix } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(SafeFilePrefix)(undefined)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const SafeFilePrefix = S.NonEmptyString.check(
  S.makeFilterGroup(
    [
      S.makeFilter(P.not(Str.includes(".")), {
        identifier: $I`SafeFilePrefixNoDotCheck`,
        title: "Safe File Prefix Without Dot",
        description: "A file prefix that does not contain a dot.",
        message: "File prefix must not contain .",
      }),
      S.makeFilter(P.not(Str.includes("/")), {
        identifier: $I`SafeFilePrefixNoPosixSeparatorCheck`,
        title: "Safe File Prefix Without Posix Separator",
        description: "A file prefix that does not contain the POSIX path separator.",
        message: "File prefix must not contain /",
      }),
      S.makeFilter(P.not(Str.includes("\\")), {
        identifier: $I`SafeFilePrefixNoWindowsSeparatorCheck`,
        title: "Safe File Prefix Without Windows Separator",
        description: "A file prefix that does not contain the Windows path separator.",
        message: "File prefix must not contain \\",
      }),
      S.makeFilter(P.not(Str.includes("\0")), {
        identifier: $I`SafeFilePrefixNoNullByteCheck`,
        title: "Safe File Prefix Without Null Byte",
        description: "A file prefix that does not contain an embedded NUL byte.",
        message: "File prefix must not contain embedded NUL bytes",
      }),
    ],
    {
      identifier: $I`SafeFilePrefixChecks`,
      title: "Safe File Prefix",
      description: "Checks for a safe file-name stem used as a generated dataset prefix.",
    }
  )
).pipe(
  $I.annoteSchema("SafeFilePrefix", {
    description: "A non-empty generated file prefix without dots, separators, or embedded NUL bytes.",
  })
);

/**
 * Safe prefix accepted by `files sort-and-rename`.
 *
 * @category models
 * @since 0.0.0
 */
export type SafeFilePrefix = typeof SafeFilePrefix.Type;

/**
 * Width and height discovered for an image or video file.
 *
 * @example
 * ```ts
 * import { MediaDimensions } from "@beep/repo-cli/commands/Files/index"
 *
 * const dimensions = MediaDimensions.make({ height: 1024, width: 1536 })
 * console.log(dimensions.width)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MediaDimensions extends S.Class<MediaDimensions>($I`MediaDimensions`)(
  {
    height: PositiveMediaDimension,
    width: PositiveMediaDimension,
  },
  $I.annote("MediaDimensions", {
    description: "Pixel dimensions discovered from an image or video file.",
  })
) {}

/**
 * Decode unknown image-size metadata.
 *
 * @example
 * ```ts
 * import { decodeImageSizeMetadata } from "@beep/repo-cli/commands/Files"
 *
 * const program = decodeImageSizeMetadata(undefined)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeImageSizeMetadata = S.decodeUnknownEffect(ImageSizeMetadata);

/**
 * Decode an ffprobe JSON document.
 *
 * @example
 * ```ts
 * import { decodeFfprobeOutputJson } from "@beep/repo-cli/commands/Files"
 *
 * const program = decodeFfprobeOutputJson(undefined)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeFfprobeOutputJson = S.decodeUnknownEffect(S.fromJsonString(FfprobeOutput));

/**
 * Decode an unknown rotation value into an optional number.
 *
 * @example
 * ```ts
 * import { decodeRotationNumber } from "@beep/repo-cli/commands/Files"
 *
 * const program = decodeRotationNumber(undefined)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeRotationNumber = S.decodeUnknownOption(S.Union([S.Finite, S.FiniteFromString]));

/**
 * Decode an unknown safe filename prefix.
 *
 * @example
 * ```ts
 * import { decodeSafeFilePrefix } from "@beep/repo-cli/commands/Files"
 *
 * const program = decodeSafeFilePrefix(undefined)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeSafeFilePrefix = S.decodeUnknownEffect(SafeFilePrefix);
