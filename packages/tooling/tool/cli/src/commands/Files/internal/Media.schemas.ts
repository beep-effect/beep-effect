/**
 * Shared media primitives and probe-boundary schemas for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import { Str } from "@beep/utils";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";
import type * as O from "effect/Option";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Files/internal/Media.schemas");

/**
 * Positive media dimension schema.
 *
 * **Example** (Check schema with undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PositiveMediaDimension } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(PositiveMediaDimension)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PositiveMediaDimension = S.Int.check(
  S.makeFilterGroup(
    [
      S.isGreaterThan(
        0,
        $I.annote("PositiveMediaDimensionGreaterThanZeroCheck", {
          title: "Positive Media Dimension",
          description: "A media width or height must be greater than zero.",
          message: "Expected a positive media dimension",
        })
      ),
    ],
    $I.annote("PositiveMediaDimensionChecks", {
      title: "Positive Media Dimension",
      description: "Checks for positive integer media dimensions.",
    })
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
 * **Details**
 *
 * The shared `Sha256PrefixedDigest` grammar from `@beep/schema`: `sha256:`
 * followed by 64 lowercase hexadecimal digits.
 *
 * **Example** (Accept only the lowercase prefixed form)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FileSha256Hash } from "@beep/repo-cli/commands/Files"
 *
 * const hex = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *
 * console.log(S.is(FileSha256Hash)(`sha256:${hex}`)) // true
 * console.log(S.is(FileSha256Hash)(`SHA256:${hex}`)) // false
 * console.log(S.is(FileSha256Hash)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileSha256Hash = Sha256PrefixedDigest.pipe(
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
 * **Example** (Check schema with undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonNegativePixelOffset } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(NonNegativePixelOffset)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NonNegativePixelOffset = S.Int.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(
        0,
        $I.annote("NonNegativePixelOffsetGreaterThanOrEqualToZeroCheck", {
          title: "Non-negative Pixel Offset",
          description: "A crop offset must be greater than or equal to zero.",
          message: "Expected a non-negative pixel offset",
        })
      ),
    ],
    $I.annote("NonNegativePixelOffsetChecks", {
      title: "Non-negative Pixel Offset",
      description: "Checks for non-negative integer pixel offsets.",
    })
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
 * **Example** (Check schema with undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MediaKind } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(MediaKind)(undefined)
 * ```
 *
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
 * **Example** (Check schema with undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RgbChannel } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(RgbChannel)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RgbChannel = S.Int.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(
        0,
        $I.annote("RgbChannelGreaterThanOrEqualToZeroCheck", {
          title: "RGB Channel Minimum",
          description: "RGB channel values must be zero or greater.",
          message: "Expected an RGB channel value no less than zero",
        })
      ),
      S.isLessThanOrEqualTo(
        255,
        $I.annote("RgbChannelLessThanOrEqualToTwoHundredFiftyFiveCheck", {
          title: "RGB Channel Maximum",
          description: "RGB channel values must not exceed 255.",
          message: "Expected an RGB channel value no greater than 255",
        })
      ),
    ],
    $I.annote("RgbChannelChecks", {
      title: "RGB Channel",
      description: "Checks for one 8-bit RGB channel.",
    })
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
 * **Example** (Check schema with undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ImageSizeMetadata } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(ImageSizeMetadata)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImageSizeMetadata extends S.Opaque<ImageSizeMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    height: PositiveMediaDimension,
    orientation: S.optionalKey(S.Int),
    width: PositiveMediaDimension,
  }).pipe(
    $I.annoteSchema("ImageSizeMetadata", {
      description: "Dimension metadata returned by the image-size package.",
    })
  )
) {}

/**
 * Side-data entry returned by `ffprobe`.
 *
 * **Example** (Check schema with undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FfprobeSideData } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(FfprobeSideData)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FfprobeSideData extends S.Opaque<FfprobeSideData, { readonly brand: unique symbol }>()(
  S.Struct({
    rotation: S.optionalKey(S.Union([S.Finite, S.FiniteFromString])),
  }).pipe(
    $I.annoteSchema("FfprobeSideData", {
      description: "Side-data entry returned by ffprobe for a video stream.",
    })
  )
) {}

/**
 * Video stream metadata returned by `ffprobe`.
 *
 * **Example** (Check schema with undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FfprobeStream } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(FfprobeStream)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FfprobeStream extends S.Opaque<FfprobeStream, { readonly brand: unique symbol }>()(
  S.Struct({
    height: PositiveMediaDimension,
    side_data_list: S.Array(FfprobeSideData).pipe(S.optionalKey),
    tags: S.optionalKey(S.Record(S.String, S.Unknown)),
    width: PositiveMediaDimension,
  }).pipe(
    $I.annoteSchema("FfprobeStream", {
      description: "Video stream metadata returned by ffprobe.",
    })
  )
) {}

/**
 * JSON document emitted by `ffprobe`.
 *
 * **Example** (Check schema with undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FfprobeOutput } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(FfprobeOutput)(undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FfprobeOutput extends S.Opaque<FfprobeOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    streams: S.Array(FfprobeStream),
  }).pipe(
    $I.annoteSchema("FfprobeOutput", {
      description: "JSON document emitted by ffprobe stream probing.",
    })
  )
) {}

/**
 * Safe generated filename prefix schema.
 *
 * **Example** (Check schema with undefined)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SafeFilePrefix } from "@beep/repo-cli/commands/Files"
 *
 * const acceptsUndefined = S.is(SafeFilePrefix)(undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SafeFilePrefix = S.NonEmptyString.check(
  S.makeFilterGroup(
    [
      S.makeFilter(
        P.not(Str.includes(".")),
        $I.annote("SafeFilePrefixNoDotCheck", {
          title: "Safe File Prefix Without Dot",
          description: "A file prefix that does not contain a dot.",
          message: "File prefix must not contain .",
        })
      ),
      S.makeFilter(
        P.not(Str.includes("/")),
        $I.annote("SafeFilePrefixNoPosixSeparatorCheck", {
          title: "Safe File Prefix Without Posix Separator",
          description: "A file prefix that does not contain the POSIX path separator.",
          message: "File prefix must not contain /",
        })
      ),
      S.makeFilter(
        P.not(Str.includes("\\")),
        $I.annote("SafeFilePrefixNoWindowsSeparatorCheck", {
          title: "Safe File Prefix Without Windows Separator",
          description: "A file prefix that does not contain the Windows path separator.",
          message: "File prefix must not contain \\",
        })
      ),
      S.makeFilter(
        P.not(Str.includes("\0")),
        $I.annote("SafeFilePrefixNoNullByteCheck", {
          title: "Safe File Prefix Without Null Byte",
          description: "A file prefix that does not contain an embedded NUL byte.",
          message: "File prefix must not contain embedded NUL bytes",
        })
      ),
    ],
    $I.annote("SafeFilePrefixChecks", {
      title: "Safe File Prefix",
      description: "Checks for a safe file-name stem used as a generated dataset prefix.",
    })
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
 * **Example** (Make media dimensions)
 *
 * ```ts
 * import { MediaDimensions } from "@beep/repo-cli/commands/Files/index"
 *
 * const dimensions = MediaDimensions.make({ height: 1024, width: 1536 })
 * console.log(dimensions.width)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MediaDimensions extends S.Opaque<MediaDimensions, { readonly brand: unique symbol }>()(
  S.Struct({
    height: PositiveMediaDimension,
    width: PositiveMediaDimension,
  }).pipe(
    $I.annoteSchema("MediaDimensions", {
      description: "Pixel dimensions discovered from an image or video file.",
    })
  )
) {}

/**
 * Decode unknown image-size metadata.
 *
 * **Example** (Decode undefined image metadata)
 *
 * ```ts
 * import { decodeImageSizeMetadata } from "@beep/repo-cli/commands/Files"
 *
 * const program = decodeImageSizeMetadata(undefined)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeImageSizeMetadata: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<ImageSizeMetadata, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<ImageSizeMetadata, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(ImageSizeMetadata));

/**
 * Decode an ffprobe JSON document.
 *
 * **Example** (Decode undefined ffprobe JSON)
 *
 * ```ts
 * import { decodeFfprobeOutputJson } from "@beep/repo-cli/commands/Files"
 *
 * const program = decodeFfprobeOutputJson(undefined)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeFfprobeOutputJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<FfprobeOutput, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<FfprobeOutput, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(FfprobeOutput)));

/**
 * Decode an unknown rotation value into an optional number.
 *
 * **Example** (Decode undefined rotation)
 *
 * ```ts
 * import { decodeRotationNumber } from "@beep/repo-cli/commands/Files"
 *
 * const program = decodeRotationNumber(undefined)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeRotationNumber: {
  (options?: AST.ParseOptions): (input: unknown) => O.Option<number>;
  (input: unknown, options?: AST.ParseOptions): O.Option<number>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownOption(S.Union([S.Finite, S.FiniteFromString])));

/**
 * Decode an unknown safe filename prefix.
 *
 * **Example** (Decode undefined file prefix)
 *
 * ```ts
 * import { decodeSafeFilePrefix } from "@beep/repo-cli/commands/Files"
 *
 * const program = decodeSafeFilePrefix(undefined)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeSafeFilePrefix: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<SafeFilePrefix, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<SafeFilePrefix, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(SafeFilePrefix));
