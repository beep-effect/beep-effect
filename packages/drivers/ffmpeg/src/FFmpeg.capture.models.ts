/**
 * Schema-first public models for capture-oriented FFmpeg operations:
 * timestamped frame extraction, clip cutting, GIF and contact-sheet
 * rendering, container metadata writing, and region luminance probing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FfmpegId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  ExtractFramesManifestSummary,
  FrameCount,
  FrameIndex,
  NonNegativeSeconds,
  PositiveFrameRate,
  SafeFramePrefix,
  VideoDimension,
  VideoProbe,
} from "./FFmpeg.models.ts";

const $I = $FfmpegId.create("FFmpeg.capture.models");

/**
 * Positive finite duration measured in seconds.
 *
 * **Example** (Making a PositiveSeconds value)
 *
 * ```ts
 * import { PositiveSeconds } from "@beep/ffmpeg"
 *
 * const seconds = PositiveSeconds.make(1.5)
 * console.log(seconds)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PositiveSeconds = S.Finite.check(
  S.isGreaterThan(0, {
    identifier: $I`PositiveSecondsGreaterThanZeroCheck`,
    title: "Positive Seconds Greater Than Zero",
    description: "Capture durations must be greater than zero seconds.",
    message: "Expected seconds greater than zero",
  })
).pipe(
  $I.annoteSchema("PositiveSeconds", {
    description: "Positive finite duration measured in seconds.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Positive finite duration measured in seconds.
 *
 * **Example** (Typing a PositiveSeconds value)
 *
 * ```ts
 * import { PositiveSeconds } from "@beep/ffmpeg"
 * import type { PositiveSeconds as PositiveSecondsValue } from "@beep/ffmpeg"
 *
 * const seconds: PositiveSecondsValue = PositiveSeconds.make(1.5)
 * console.log(seconds)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PositiveSeconds = typeof PositiveSeconds.Type;

/**
 * Non-negative integer file size measured in bytes.
 *
 * **Example** (Making a FileSizeBytes value)
 *
 * ```ts
 * import { FileSizeBytes } from "@beep/ffmpeg"
 *
 * const size = FileSizeBytes.make(1024)
 * console.log(size)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileSizeBytes = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`FileSizeBytesMinimumCheck`,
    title: "File Size Bytes Minimum",
    description: "File sizes are non-negative integer byte counts.",
    message: "Expected a non-negative file size in bytes",
  })
).pipe(
  $I.annoteSchema("FileSizeBytes", {
    description: "Non-negative integer file size measured in bytes.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Non-negative integer file size measured in bytes.
 *
 * **Example** (Typing a FileSizeBytes value)
 *
 * ```ts
 * import { FileSizeBytes } from "@beep/ffmpeg"
 * import type { FileSizeBytes as FileSizeBytesValue } from "@beep/ffmpeg"
 *
 * const size: FileSizeBytesValue = FileSizeBytes.make(1024)
 * console.log(size)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FileSizeBytes = typeof FileSizeBytes.Type;

/**
 * Positive integer tile-grid count for contact sheets.
 *
 * **Example** (Making a TileCount value)
 *
 * ```ts
 * import { TileCount } from "@beep/ffmpeg"
 *
 * const columns = TileCount.make(4)
 * console.log(columns)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TileCount = S.Int.check(
  S.isGreaterThanOrEqualTo(1, {
    identifier: $I`TileCountMinimumCheck`,
    title: "Tile Count Minimum",
    description: "Contact-sheet tile grids use positive integer column and row counts.",
    message: "Expected a positive tile count",
  })
).pipe(
  $I.annoteSchema("TileCount", {
    description: "Positive integer tile-grid count for contact sheets.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Positive integer tile-grid count for contact sheets.
 *
 * **Example** (Typing a TileCount value)
 *
 * ```ts
 * import { TileCount } from "@beep/ffmpeg"
 * import type { TileCount as TileCountValue } from "@beep/ffmpeg"
 *
 * const rows: TileCountValue = TileCount.make(4)
 * console.log(rows)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TileCount = typeof TileCount.Type;

/**
 * JPEG quantizer quality passed to ffmpeg as `-q:v` (1 best, 31 worst).
 *
 * **Example** (Making a JpegQuality value)
 *
 * ```ts
 * import { JpegQuality } from "@beep/ffmpeg"
 *
 * const quality = JpegQuality.make(5)
 * console.log(quality)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JpegQuality = S.Int.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(1, {
        identifier: $I`JpegQualityMinimumCheck`,
        title: "JPEG Quality Minimum",
        description: "ffmpeg -q:v quantizer values must be at least 1.",
        message: "Expected a -q:v quality of at least 1",
      }),
      S.isLessThanOrEqualTo(31, {
        identifier: $I`JpegQualityMaximumCheck`,
        title: "JPEG Quality Maximum",
        description: "ffmpeg -q:v quantizer values must not exceed 31.",
        message: "Expected a -q:v quality of at most 31",
      }),
    ],
    {
      identifier: $I`JpegQualityChecks`,
      title: "JPEG Quality",
      description: "Checks for ffmpeg -q:v quantizer values in the closed 1-31 range.",
    }
  )
).pipe(
  $I.annoteSchema("JpegQuality", {
    description: "JPEG quantizer quality in the closed 1-31 range (1 best, 31 worst).",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * JPEG quantizer quality passed to ffmpeg as `-q:v` (1 best, 31 worst).
 *
 * **Example** (Typing a JpegQuality value)
 *
 * ```ts
 * import { JpegQuality } from "@beep/ffmpeg"
 * import type { JpegQuality as JpegQualityValue } from "@beep/ffmpeg"
 *
 * const quality: JpegQualityValue = JpegQuality.make(5)
 * console.log(quality)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JpegQuality = typeof JpegQuality.Type;

/**
 * Non-negative integer pixel offset from a frame edge.
 *
 * **Example** (Making a PixelOffset value)
 *
 * ```ts
 * import { PixelOffset } from "@beep/ffmpeg"
 *
 * const x = PixelOffset.make(0)
 * console.log(x)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PixelOffset = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`PixelOffsetMinimumCheck`,
    title: "Pixel Offset Minimum",
    description: "Crop-region pixel offsets are non-negative integers.",
    message: "Expected a non-negative pixel offset",
  })
).pipe(
  $I.annoteSchema("PixelOffset", {
    description: "Non-negative integer pixel offset from a frame edge.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Non-negative integer pixel offset from a frame edge.
 *
 * **Example** (Typing a PixelOffset value)
 *
 * ```ts
 * import { PixelOffset } from "@beep/ffmpeg"
 * import type { PixelOffset as PixelOffsetValue } from "@beep/ffmpeg"
 *
 * const y: PixelOffsetValue = PixelOffset.make(0)
 * console.log(y)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PixelOffset = typeof PixelOffset.Type;

/**
 * Mean luma sample value in the closed 0-255 range.
 *
 * **Example** (Making a LumaValue value)
 *
 * ```ts
 * import { LumaValue } from "@beep/ffmpeg"
 *
 * const luma = LumaValue.make(128)
 * console.log(luma)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LumaValue = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`LumaValueMinimumCheck`,
        title: "Luma Value Minimum",
        description: "Mean luma values must be zero or greater.",
        message: "Expected a luma value of at least zero",
      }),
      S.isLessThanOrEqualTo(255, {
        identifier: $I`LumaValueMaximumCheck`,
        title: "Luma Value Maximum",
        description: "Mean luma values must not exceed 255.",
        message: "Expected a luma value of at most 255",
      }),
    ],
    {
      identifier: $I`LumaValueChecks`,
      title: "Luma Value",
      description: "Checks for mean luma values in the closed 0-255 range.",
    }
  )
).pipe(
  $I.annoteSchema("LumaValue", {
    description: "Mean luma sample value in the closed 0-255 range.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Mean luma sample value in the closed 0-255 range.
 *
 * **Example** (Typing a LumaValue value)
 *
 * ```ts
 * import { LumaValue } from "@beep/ffmpeg"
 * import type { LumaValue as LumaValueValue } from "@beep/ffmpeg"
 *
 * const luma: LumaValueValue = LumaValue.make(128)
 * console.log(luma)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LumaValue = typeof LumaValue.Type;

/**
 * Container metadata key accepted by the write-container-metadata operation.
 *
 * **Details**
 *
 * The pattern guard blocks `=`, whitespace, and other separator characters so
 * a key can never smuggle extra ffmpeg `-metadata` assignments.
 *
 * **Example** (Decoding a SafeMetadataKey)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SafeMetadataKey } from "@beep/ffmpeg"
 *
 * const key = S.decodeUnknownSync(SafeMetadataKey)("BEEP_QA_SESSION_ID")
 * console.log(key)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SafeMetadataKey = S.String.check(
  S.isPattern(/^[A-Za-z][A-Za-z0-9_]*$/, {
    identifier: $I`SafeMetadataKeyPatternCheck`,
    title: "Safe Metadata Key Pattern",
    description: "Container metadata keys must start with a letter and contain only letters, digits, and underscores.",
    message: "Expected a metadata key matching /^[A-Za-z][A-Za-z0-9_]*$/",
  })
).pipe(
  $I.annoteSchema("SafeMetadataKey", {
    description: "Container metadata key restricted to letters, digits, and underscores.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Container metadata key accepted by the write-container-metadata operation.
 *
 * **Example** (Typing a SafeMetadataKey)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SafeMetadataKey } from "@beep/ffmpeg"
 *
 * const key: SafeMetadataKey = S.decodeUnknownSync(SafeMetadataKey)("BEEP_QA_SESSION_ID")
 * console.log(key)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeMetadataKey = typeof SafeMetadataKey.Type;

/**
 * Dithering modes accepted by ffmpeg's `paletteuse` GIF filter.
 *
 * **Example** (Reading GifDither enum member)
 *
 * ```ts
 * import { GifDither } from "@beep/ffmpeg"
 *
 * console.log(GifDither.Enum.bayer)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GifDither = LiteralKit([
  "atkinson",
  "bayer",
  "burkes",
  "floyd_steinberg",
  "heckbert",
  "sierra2",
  "sierra2_4a",
  "sierra3",
]).pipe(
  $I.annoteSchema("GifDither", {
    description: "Dithering modes accepted by ffmpeg's paletteuse GIF filter.",
  })
);

/**
 * Dithering modes accepted by ffmpeg's `paletteuse` GIF filter.
 *
 * **Example** (Typing a GifDither value)
 *
 * ```ts
 * import { GifDither } from "@beep/ffmpeg"
 * import type { GifDither as GifDitherValue } from "@beep/ffmpeg"
 *
 * const dither: GifDitherValue = GifDither.Enum.bayer
 * console.log(dither)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GifDither = typeof GifDither.Type;

/**
 * Encoder presets available to the extract-clip operation.
 *
 * **Details**
 *
 * `h264` targets mp4 outputs; `vp9` targets webm outputs.
 *
 * **Example** (Reading ClipCodec enum member)
 *
 * ```ts
 * import { ClipCodec } from "@beep/ffmpeg"
 *
 * console.log(ClipCodec.Enum.h264)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClipCodec = LiteralKit(["h264", "vp9"]).pipe(
  $I.annoteSchema("ClipCodec", {
    description: "Encoder presets available to the extract-clip operation.",
  })
);

/**
 * Encoder presets available to the extract-clip operation.
 *
 * **Example** (Typing a ClipCodec value)
 *
 * ```ts
 * import { ClipCodec } from "@beep/ffmpeg"
 * import type { ClipCodec as ClipCodecValue } from "@beep/ffmpeg"
 *
 * const codec: ClipCodecValue = ClipCodec.Enum.vp9
 * console.log(codec)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClipCodec = typeof ClipCodec.Type;

/**
 * A single container metadata key/value assignment.
 *
 * **Details**
 *
 * Values are passed to ffmpeg as one argv element (`-metadata KEY=value`), so
 * they never pass through a shell; only the key needs the injection guard.
 *
 * **Example** (Making a MetadataPair)
 *
 * ```ts
 * import { MetadataPair } from "@beep/ffmpeg"
 *
 * const pair = MetadataPair.make({ key: "BEEP_QA_SESSION_ID", value: "session-42" })
 * console.log(pair)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MetadataPair extends S.Class<MetadataPair>($I`MetadataPair`)(
  {
    key: SafeMetadataKey.pipe(
      $I.annoteKey("MetadataPair.key", {
        description: "Pattern-guarded container metadata key.",
      })
    ),
    value: S.String.pipe(
      $I.annoteKey("MetadataPair.value", {
        description: "Container metadata value written verbatim.",
      })
    ),
  },
  $I.annote("MetadataPair", {
    description: "A single container metadata key/value assignment.",
  })
) {}

/**
 * Request to extract one frame at an exact timestamp.
 *
 * **Example** (Building ExtractFrameAtRequest)
 *
 * ```ts
 * import { ExtractFrameAtRequest } from "@beep/ffmpeg"
 *
 * const request = ExtractFrameAtRequest.make({
 *   outPath: "./frames/pointer-down.png",
 *   overwrite: false,
 *   timestampSeconds: 1.25,
 *   videoPath: "./capture.webm"
 * })
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFrameAtRequest extends S.Class<ExtractFrameAtRequest>($I`ExtractFrameAtRequest`)(
  {
    outPath: S.String.pipe(
      $I.annoteKey("ExtractFrameAtRequest.outPath", {
        description: "Destination path for the extracted PNG frame.",
      })
    ),
    overwrite: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false)),
      $I.annoteKey("ExtractFrameAtRequest.overwrite", {
        description: "Whether an existing frame output may be overwritten.",
      })
    ),
    timestampSeconds: NonNegativeSeconds.pipe(
      $I.annoteKey("ExtractFrameAtRequest.timestampSeconds", {
        description: "Timestamp in seconds passed as an input-side -ss seek before -i.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("ExtractFrameAtRequest.videoPath", {
        description: "Video file path to extract the frame from.",
      })
    ),
  },
  $I.annote("ExtractFrameAtRequest", {
    description: "Request to extract one frame at an exact timestamp.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ExtractFrameAtRequest);
}

/**
 * A frame extracted at a requested timestamp.
 *
 * **Example** (Making a TimestampedFrame)
 *
 * ```ts
 * import { TimestampedFrame } from "@beep/ffmpeg"
 *
 * const frame = TimestampedFrame.make({
 *   fileName: "capture_at_00000.png",
 *   index: 0,
 *   path: "./frames/capture_at_00000.png",
 *   relativePath: "capture_at_00000.png",
 *   requestedTimestampSeconds: 1.25
 * })
 * console.log(frame)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TimestampedFrame extends S.Class<TimestampedFrame>($I`TimestampedFrame`)(
  {
    fileName: S.String.pipe(
      $I.annoteKey("TimestampedFrame.fileName", {
        description: "Generated PNG file name for the extracted frame.",
      })
    ),
    index: FrameIndex.pipe(
      $I.annoteKey("TimestampedFrame.index", {
        description: "Zero-based position of the frame in the requested timestamp order.",
      })
    ),
    path: S.String.pipe(
      $I.annoteKey("TimestampedFrame.path", {
        description: "Absolute or caller-visible path to the committed PNG frame.",
      })
    ),
    relativePath: S.String.pipe(
      $I.annoteKey("TimestampedFrame.relativePath", {
        description: "Frame path relative to the output directory.",
      })
    ),
    requestedTimestampSeconds: NonNegativeSeconds.pipe(
      $I.annoteKey("TimestampedFrame.requestedTimestampSeconds", {
        description: "Timestamp in seconds the frame extraction was requested at.",
      })
    ),
  },
  $I.annote("TimestampedFrame", {
    description: "A frame extracted at a requested timestamp.",
  })
) {}

/**
 * Request to extract frames at an explicit list of timestamps.
 *
 * **Example** (Building ExtractFramesAtRequest)
 *
 * ```ts
 * import { ExtractFramesAtRequest } from "@beep/ffmpeg"
 * import * as O from "effect/Option"
 *
 * const request = ExtractFramesAtRequest.make({
 *   manifestPath: O.none(),
 *   maxWidth: O.some(960),
 *   outDir: "./frames",
 *   overwrite: false,
 *   prefix: O.none(),
 *   timestampsSeconds: [0.5, 1.25, 2],
 *   videoPath: "./capture.webm"
 * })
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesAtRequest extends S.Class<ExtractFramesAtRequest>($I`ExtractFramesAtRequest`)(
  {
    manifestPath: S.Option(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<string>())),
      S.withDecodingDefault(Effect.succeed(O.none<string>())),
      $I.annoteKey("ExtractFramesAtRequest.manifestPath", {
        description: "Optional manifest path; defaults inside the output directory when absent.",
      })
    ),
    maxWidth: S.Option(VideoDimension).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<VideoDimension>())),
      S.withDecodingDefault(Effect.succeed(O.none<VideoDimension>())),
      $I.annoteKey("ExtractFramesAtRequest.maxWidth", {
        description: "Optional maximum frame width in pixels; wider sources are scaled down, narrower ones untouched.",
      })
    ),
    outDir: S.String.pipe(
      $I.annoteKey("ExtractFramesAtRequest.outDir", {
        description: "Directory where extracted PNG frames and the manifest are written.",
      })
    ),
    overwrite: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false)),
      $I.annoteKey("ExtractFramesAtRequest.overwrite", {
        description: "Whether existing frame and manifest outputs may be overwritten.",
      })
    ),
    prefix: S.Option(SafeFramePrefix).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<SafeFramePrefix>())),
      S.withDecodingDefault(Effect.succeed(O.none<SafeFramePrefix>())),
      $I.annoteKey("ExtractFramesAtRequest.prefix", {
        description: "Optional safe filename prefix for generated PNG frames.",
      })
    ),
    timestampsSeconds: S.Array(NonNegativeSeconds)
      .check(
        S.isMinLength(1, {
          identifier: $I`ExtractFramesAtRequestTimestampsNonEmptyCheck`,
          title: "Extract Frames At Timestamps Non Empty",
          description: "Timestamped extraction requires at least one timestamp.",
          message: "Expected at least one timestamp",
        })
      )
      .pipe(
        $I.annoteKey("ExtractFramesAtRequest.timestampsSeconds", {
          description: "Timestamps in seconds to extract, one ffmpeg spawn per entry.",
        })
      ),
    videoPath: S.String.pipe(
      $I.annoteKey("ExtractFramesAtRequest.videoPath", {
        description: "Video file path to extract frames from.",
      })
    ),
  },
  $I.annote("ExtractFramesAtRequest", {
    description: "Request to extract frames at an explicit list of timestamps.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ExtractFramesAtRequest);
}

/**
 * Options recorded in an extract-frames-at manifest.
 *
 * **Example** (Making manifest options)
 *
 * ```ts
 * import { ExtractFramesAtManifestOptions } from "@beep/ffmpeg"
 *
 * const options = ExtractFramesAtManifestOptions.make({
 *   overwrite: false,
 *   prefix: "capture_at",
 *   timestampsSeconds: [0.5, 1.25]
 * })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesAtManifestOptions extends S.Class<ExtractFramesAtManifestOptions>(
  $I`ExtractFramesAtManifestOptions`
)(
  {
    overwrite: S.Boolean.pipe(
      $I.annoteKey("ExtractFramesAtManifestOptions.overwrite", {
        description: "Whether the extraction run allowed overwriting outputs.",
      })
    ),
    prefix: SafeFramePrefix.pipe(
      $I.annoteKey("ExtractFramesAtManifestOptions.prefix", {
        description: "Safe filename prefix used for generated PNG frames.",
      })
    ),
    timestampsSeconds: S.Array(NonNegativeSeconds).pipe(
      $I.annoteKey("ExtractFramesAtManifestOptions.timestampsSeconds", {
        description: "Requested timestamps in seconds recorded for reproducibility.",
      })
    ),
  },
  $I.annote("ExtractFramesAtManifestOptions", {
    description: "Options recorded in an extract-frames-at manifest.",
  })
) {}

/**
 * JSON manifest written by an extract-frames-at run.
 *
 * **Example** (Building extract-frames-at manifest)
 *
 * ```ts
 * import {
 *   ExtractFramesAtManifest,
 *   ExtractFramesAtManifestOptions,
 *   ExtractFramesManifestSummary,
 *   VideoProbe
 * } from "@beep/ffmpeg"
 *
 * const manifest = ExtractFramesAtManifest.make({
 *   frames: [],
 *   manifestPath: "./frames/extract-frames-at-manifest.json",
 *   options: ExtractFramesAtManifestOptions.make({
 *     overwrite: false,
 *     prefix: "capture_at",
 *     timestampsSeconds: []
 *   }),
 *   outputDirectory: "./frames",
 *   probe: VideoProbe.make({ videoPath: "./capture.webm" }),
 *   schemaVersion: "beep.ffmpeg.extract-frames-at.v1",
 *   sourceVideo: "./capture.webm",
 *   summary: ExtractFramesManifestSummary.make({ frameCount: 0 })
 * })
 * console.log(manifest)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesAtManifest extends S.Class<ExtractFramesAtManifest>($I`ExtractFramesAtManifest`)(
  {
    frames: S.Array(TimestampedFrame).pipe(
      $I.annoteKey("ExtractFramesAtManifest.frames", {
        description: "Committed timestamped frame records.",
      })
    ),
    manifestPath: S.String.pipe(
      $I.annoteKey("ExtractFramesAtManifest.manifestPath", {
        description: "Path where this manifest was written.",
      })
    ),
    options: ExtractFramesAtManifestOptions.pipe(
      $I.annoteKey("ExtractFramesAtManifest.options", {
        description: "Extraction options recorded for reproducibility.",
      })
    ),
    outputDirectory: S.String.pipe(
      $I.annoteKey("ExtractFramesAtManifest.outputDirectory", {
        description: "Directory containing the committed frame files.",
      })
    ),
    probe: VideoProbe.pipe(
      $I.annoteKey("ExtractFramesAtManifest.probe", {
        description: "Video metadata observed before extraction.",
      })
    ),
    schemaVersion: S.Literal("beep.ffmpeg.extract-frames-at.v1").pipe(
      $I.annoteKey("ExtractFramesAtManifest.schemaVersion", {
        description: "Manifest schema version literal.",
      })
    ),
    sourceVideo: S.String.pipe(
      $I.annoteKey("ExtractFramesAtManifest.sourceVideo", {
        description: "Resolved source video path used for extraction.",
      })
    ),
    summary: ExtractFramesManifestSummary.pipe(
      $I.annoteKey("ExtractFramesAtManifest.summary", {
        description: "Aggregate frame counts for the extraction run.",
      })
    ),
  },
  $I.annote("ExtractFramesAtManifest", {
    description: "JSON manifest written by a successful extract-frames-at run.",
  })
) {
  static readonly encodeEffect = S.encodeUnknownEffect(ExtractFramesAtManifest);
}

/**
 * Result returned after timestamped frames have been committed.
 *
 * **Example** (Making ExtractFramesAtResult)
 *
 * ```ts
 * import { ExtractFramesAtResult } from "@beep/ffmpeg"
 *
 * const result = ExtractFramesAtResult.make({
 *   frameCount: 0,
 *   frames: [],
 *   manifestPath: "./frames/extract-frames-at-manifest.json",
 *   outDir: "./frames",
 *   videoPath: "./capture.webm"
 * })
 * console.log(result)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesAtResult extends S.Class<ExtractFramesAtResult>($I`ExtractFramesAtResult`)(
  {
    frameCount: FrameCount.pipe(
      $I.annoteKey("ExtractFramesAtResult.frameCount", {
        description: "Number of committed PNG frames.",
      })
    ),
    frames: S.Array(TimestampedFrame).pipe(
      $I.annoteKey("ExtractFramesAtResult.frames", {
        description: "Committed timestamped frame records.",
      })
    ),
    manifestPath: S.String.pipe(
      $I.annoteKey("ExtractFramesAtResult.manifestPath", {
        description: "Path to the committed extract-frames-at manifest.",
      })
    ),
    outDir: S.String.pipe(
      $I.annoteKey("ExtractFramesAtResult.outDir", {
        description: "Directory containing the committed outputs.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("ExtractFramesAtResult.videoPath", {
        description: "Resolved source video path used for extraction.",
      })
    ),
  },
  $I.annote("ExtractFramesAtResult", {
    description: "Result returned after timestamped frames and manifest have been committed.",
  })
) {}

/**
 * Request to cut a re-encoded clip out of a video.
 *
 * **Details**
 *
 * Uses input-side `-ss` plus output `-t` (never `-to`) so clip timestamps
 * restart at zero. When `durationSeconds` is absent no `-t` is emitted and the
 * clip runs to the end of the source — the remux path duration-less recordings
 * depend on to preserve their full span.
 *
 * **Example** (Building ExtractClipRequest)
 *
 * ```ts
 * import { ExtractClipRequest } from "@beep/ffmpeg"
 * import * as O from "effect/Option"
 *
 * const request = ExtractClipRequest.make({
 *   codec: "h264",
 *   durationSeconds: O.some(2),
 *   outPath: "./clips/drag.mp4",
 *   overwrite: false,
 *   startSeconds: 1.5,
 *   videoPath: "./capture.webm"
 * })
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractClipRequest extends S.Class<ExtractClipRequest>($I`ExtractClipRequest`)(
  {
    codec: ClipCodec.pipe(
      SchemaUtils.withKeyDefaults(ClipCodec.Enum.h264),
      $I.annoteKey("ExtractClipRequest.codec", {
        description: "Encoder preset; h264 targets mp4 outputs, vp9 targets webm outputs.",
      })
    ),
    durationSeconds: S.Option(PositiveSeconds).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<PositiveSeconds>())),
      S.withDecodingDefault(Effect.succeed(O.none<PositiveSeconds>())),
      $I.annoteKey("ExtractClipRequest.durationSeconds", {
        description:
          "Optional clip duration in seconds passed as output-side -t; absent, the clip runs to the end of the source.",
      })
    ),
    outPath: S.String.pipe(
      $I.annoteKey("ExtractClipRequest.outPath", {
        description: "Destination path for the encoded clip.",
      })
    ),
    overwrite: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false)),
      $I.annoteKey("ExtractClipRequest.overwrite", {
        description: "Whether an existing clip output may be overwritten.",
      })
    ),
    startSeconds: NonNegativeSeconds.pipe(
      $I.annoteKey("ExtractClipRequest.startSeconds", {
        description: "Clip start in seconds passed as an input-side -ss seek before -i.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("ExtractClipRequest.videoPath", {
        description: "Video file path to cut the clip from.",
      })
    ),
  },
  $I.annote("ExtractClipRequest", {
    description: "Request to cut a re-encoded clip out of a video.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ExtractClipRequest);
}

/**
 * Result returned after a clip has been committed.
 *
 * **Example** (Making ExtractClipResult)
 *
 * ```ts
 * import { ExtractClipResult } from "@beep/ffmpeg"
 * import * as O from "effect/Option"
 *
 * const result = ExtractClipResult.make({
 *   durationSeconds: O.some(2),
 *   fileSizeBytes: 4096,
 *   outPath: "./clips/drag.mp4",
 *   startSeconds: 1.5,
 *   videoPath: "./capture.webm"
 * })
 * console.log(result)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractClipResult extends S.Class<ExtractClipResult>($I`ExtractClipResult`)(
  {
    durationSeconds: S.Option(PositiveSeconds).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<PositiveSeconds>())),
      S.withDecodingDefault(Effect.succeed(O.none<PositiveSeconds>())),
      $I.annoteKey("ExtractClipResult.durationSeconds", {
        description: "Requested clip duration in seconds, when the request carried one.",
      })
    ),
    fileSizeBytes: FileSizeBytes.pipe(
      $I.annoteKey("ExtractClipResult.fileSizeBytes", {
        description: "Size of the committed clip file in bytes.",
      })
    ),
    outPath: S.String.pipe(
      $I.annoteKey("ExtractClipResult.outPath", {
        description: "Path to the committed clip file.",
      })
    ),
    startSeconds: NonNegativeSeconds.pipe(
      $I.annoteKey("ExtractClipResult.startSeconds", {
        description: "Requested clip start in seconds.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("ExtractClipResult.videoPath", {
        description: "Resolved source video path the clip was cut from.",
      })
    ),
  },
  $I.annote("ExtractClipResult", {
    description: "Result returned after a clip has been committed.",
  })
) {}

/**
 * Request to render a palette-optimized GIF from a video window.
 *
 * **Example** (Building RenderGifRequest)
 *
 * ```ts
 * import { RenderGifRequest } from "@beep/ffmpeg"
 *
 * const request = RenderGifRequest.make({
 *   dither: "bayer",
 *   durationSeconds: 2,
 *   fps: 10,
 *   outPath: "./clips/drag.gif",
 *   overwrite: false,
 *   startSeconds: 1.5,
 *   videoPath: "./capture.webm",
 *   width: 640
 * })
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RenderGifRequest extends S.Class<RenderGifRequest>($I`RenderGifRequest`)(
  {
    dither: GifDither.pipe(
      SchemaUtils.withKeyDefaults(GifDither.Enum.bayer),
      $I.annoteKey("RenderGifRequest.dither", {
        description: "paletteuse dithering mode; bayer adds bayer_scale=5.",
      })
    ),
    durationSeconds: PositiveSeconds.pipe(
      $I.annoteKey("RenderGifRequest.durationSeconds", {
        description: "GIF window duration in seconds passed as output-side -t.",
      })
    ),
    fps: PositiveFrameRate.pipe(
      SchemaUtils.withKeyDefaults(10),
      $I.annoteKey("RenderGifRequest.fps", {
        description: "GIF frame rate applied by the fps video filter.",
      })
    ),
    outPath: S.String.pipe(
      $I.annoteKey("RenderGifRequest.outPath", {
        description: "Destination path for the rendered GIF.",
      })
    ),
    overwrite: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false)),
      $I.annoteKey("RenderGifRequest.overwrite", {
        description: "Whether an existing GIF output may be overwritten.",
      })
    ),
    startSeconds: NonNegativeSeconds.pipe(
      $I.annoteKey("RenderGifRequest.startSeconds", {
        description: "GIF window start in seconds passed as an input-side -ss seek before -i.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("RenderGifRequest.videoPath", {
        description: "Video file path to render the GIF from.",
      })
    ),
    width: VideoDimension.pipe(
      SchemaUtils.withKeyDefaults(640),
      $I.annoteKey("RenderGifRequest.width", {
        description: "GIF pixel width; height follows the source aspect ratio.",
      })
    ),
  },
  $I.annote("RenderGifRequest", {
    description: "Request to render a palette-optimized GIF from a video window.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(RenderGifRequest);
}

/**
 * Result returned after a GIF has been committed.
 *
 * **Details**
 *
 * The driver surfaces `fileSizeBytes` and never silently re-encodes; callers
 * own any downscale-and-retry budget decisions.
 *
 * **Example** (Making RenderGifResult)
 *
 * ```ts
 * import { RenderGifResult } from "@beep/ffmpeg"
 *
 * const result = RenderGifResult.make({
 *   fileSizeBytes: 350000,
 *   outPath: "./clips/drag.gif",
 *   videoPath: "./capture.webm"
 * })
 * console.log(result)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RenderGifResult extends S.Class<RenderGifResult>($I`RenderGifResult`)(
  {
    fileSizeBytes: FileSizeBytes.pipe(
      $I.annoteKey("RenderGifResult.fileSizeBytes", {
        description: "Size of the committed GIF file in bytes.",
      })
    ),
    outPath: S.String.pipe(
      $I.annoteKey("RenderGifResult.outPath", {
        description: "Path to the committed GIF file.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("RenderGifResult.videoPath", {
        description: "Resolved source video path the GIF was rendered from.",
      })
    ),
  },
  $I.annote("RenderGifResult", {
    description: "Result returned after a GIF has been committed.",
  })
) {}

/**
 * Request to render a tiled contact sheet spanning a whole video.
 *
 * **Details**
 *
 * Use a `.jpg` destination (the default recommendation) — JPEG keeps sheets
 * inside vision-judge payload budgets where PNG sheets have already failed.
 *
 * **Example** (Building contact sheet request)
 *
 * ```ts
 * import { RenderContactSheetRequest } from "@beep/ffmpeg"
 *
 * const request = RenderContactSheetRequest.make({
 *   columns: 4,
 *   outPath: "./sheets/capture.jpg",
 *   overwrite: false,
 *   quality: 5,
 *   rows: 4,
 *   tileWidth: 320,
 *   videoPath: "./capture.webm"
 * })
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RenderContactSheetRequest extends S.Class<RenderContactSheetRequest>($I`RenderContactSheetRequest`)(
  {
    columns: TileCount.pipe(
      SchemaUtils.withKeyDefaults(4),
      $I.annoteKey("RenderContactSheetRequest.columns", {
        description: "Number of tile columns in the sheet grid.",
      })
    ),
    outPath: S.String.pipe(
      $I.annoteKey("RenderContactSheetRequest.outPath", {
        description: "Destination path for the rendered sheet; prefer a .jpg extension.",
      })
    ),
    overwrite: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false)),
      $I.annoteKey("RenderContactSheetRequest.overwrite", {
        description: "Whether an existing sheet output may be overwritten.",
      })
    ),
    quality: JpegQuality.pipe(
      SchemaUtils.withKeyDefaults(5),
      $I.annoteKey("RenderContactSheetRequest.quality", {
        description: "JPEG quantizer passed as -q:v (1 best, 31 worst).",
      })
    ),
    rows: TileCount.pipe(
      SchemaUtils.withKeyDefaults(4),
      $I.annoteKey("RenderContactSheetRequest.rows", {
        description: "Number of tile rows in the sheet grid.",
      })
    ),
    tileWidth: VideoDimension.pipe(
      SchemaUtils.withKeyDefaults(320),
      $I.annoteKey("RenderContactSheetRequest.tileWidth", {
        description: "Pixel width of each tile; height follows the source aspect ratio.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("RenderContactSheetRequest.videoPath", {
        description: "Video file path to render the contact sheet from.",
      })
    ),
  },
  $I.annote("RenderContactSheetRequest", {
    description: "Request to render a tiled contact sheet spanning a whole video.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(RenderContactSheetRequest);
}

/**
 * Result returned after a contact sheet has been committed.
 *
 * **Example** (Making contact sheet result)
 *
 * ```ts
 * import { RenderContactSheetResult } from "@beep/ffmpeg"
 *
 * const result = RenderContactSheetResult.make({
 *   columns: 4,
 *   fileSizeBytes: 120000,
 *   outPath: "./sheets/capture.jpg",
 *   rows: 4,
 *   videoPath: "./capture.webm"
 * })
 * console.log(result)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RenderContactSheetResult extends S.Class<RenderContactSheetResult>($I`RenderContactSheetResult`)(
  {
    columns: TileCount.pipe(
      $I.annoteKey("RenderContactSheetResult.columns", {
        description: "Number of tile columns in the committed sheet.",
      })
    ),
    fileSizeBytes: FileSizeBytes.pipe(
      $I.annoteKey("RenderContactSheetResult.fileSizeBytes", {
        description: "Size of the committed sheet file in bytes.",
      })
    ),
    outPath: S.String.pipe(
      $I.annoteKey("RenderContactSheetResult.outPath", {
        description: "Path to the committed sheet file.",
      })
    ),
    rows: TileCount.pipe(
      $I.annoteKey("RenderContactSheetResult.rows", {
        description: "Number of tile rows in the committed sheet.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("RenderContactSheetResult.videoPath", {
        description: "Resolved source video path the sheet was rendered from.",
      })
    ),
  },
  $I.annote("RenderContactSheetResult", {
    description: "Result returned after a contact sheet has been committed.",
  })
) {}

/**
 * Request to remux a video with additional container metadata.
 *
 * **Details**
 *
 * Streams are copied (`-map 0 -c copy`); nothing is re-encoded. This is the
 * provenance channel for webm/mkv/mp4 artifacts where exiftool cannot write.
 *
 * **Example** (Building metadata write request)
 *
 * ```ts
 * import { MetadataPair, WriteContainerMetadataRequest } from "@beep/ffmpeg"
 *
 * const request = WriteContainerMetadataRequest.make({
 *   metadata: [MetadataPair.make({ key: "BEEP_QA_SESSION_ID", value: "session-42" })],
 *   outPath: "./tagged/capture.webm",
 *   overwrite: false,
 *   videoPath: "./capture.webm"
 * })
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WriteContainerMetadataRequest extends S.Class<WriteContainerMetadataRequest>(
  $I`WriteContainerMetadataRequest`
)(
  {
    metadata: S.Array(MetadataPair)
      .check(
        S.isMinLength(1, {
          identifier: $I`WriteContainerMetadataRequestMetadataNonEmptyCheck`,
          title: "Write Container Metadata Non Empty",
          description: "Metadata remuxing requires at least one key/value pair.",
          message: "Expected at least one metadata pair",
        })
      )
      .pipe(
        $I.annoteKey("WriteContainerMetadataRequest.metadata", {
          description: "Container metadata assignments applied during the remux.",
        })
      ),
    outPath: S.String.pipe(
      $I.annoteKey("WriteContainerMetadataRequest.outPath", {
        description: "Destination path for the remuxed video; mp4-family extensions add -movflags use_metadata_tags.",
      })
    ),
    overwrite: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false)),
      $I.annoteKey("WriteContainerMetadataRequest.overwrite", {
        description: "Whether an existing remux output may be overwritten.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("WriteContainerMetadataRequest.videoPath", {
        description: "Video file path to remux with metadata.",
      })
    ),
  },
  $I.annote("WriteContainerMetadataRequest", {
    description: "Request to remux a video with additional container metadata.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(WriteContainerMetadataRequest);
}

/**
 * Result returned after a metadata remux has been committed.
 *
 * **Example** (Making metadata write result)
 *
 * ```ts
 * import { WriteContainerMetadataResult } from "@beep/ffmpeg"
 *
 * const result = WriteContainerMetadataResult.make({
 *   fileSizeBytes: 25000,
 *   outPath: "./tagged/capture.webm",
 *   videoPath: "./capture.webm"
 * })
 * console.log(result)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WriteContainerMetadataResult extends S.Class<WriteContainerMetadataResult>(
  $I`WriteContainerMetadataResult`
)(
  {
    fileSizeBytes: FileSizeBytes.pipe(
      $I.annoteKey("WriteContainerMetadataResult.fileSizeBytes", {
        description: "Size of the committed remuxed file in bytes.",
      })
    ),
    outPath: S.String.pipe(
      $I.annoteKey("WriteContainerMetadataResult.outPath", {
        description: "Path to the committed remuxed file.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("WriteContainerMetadataResult.videoPath", {
        description: "Resolved source video path that was remuxed.",
      })
    ),
  },
  $I.annote("WriteContainerMetadataResult", {
    description: "Result returned after a metadata remux has been committed.",
  })
) {}

/**
 * Request to sample mean luma over a crop region of every frame.
 *
 * **Details**
 *
 * Backs sync-beacon detection: the capture pipeline flashes a corner region
 * and reads the per-frame luminance curve to align wall-clock and video time.
 *
 * **Example** (Building luminance probe request)
 *
 * ```ts
 * import { ProbeRegionLuminanceRequest } from "@beep/ffmpeg"
 *
 * const request = ProbeRegionLuminanceRequest.make({
 *   height: 128,
 *   videoPath: "./capture.webm",
 *   width: 128,
 *   x: 0,
 *   y: 0
 * })
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProbeRegionLuminanceRequest extends S.Class<ProbeRegionLuminanceRequest>($I`ProbeRegionLuminanceRequest`)(
  {
    height: VideoDimension.pipe(
      $I.annoteKey("ProbeRegionLuminanceRequest.height", {
        description: "Crop region height in pixels.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("ProbeRegionLuminanceRequest.videoPath", {
        description: "Video file path to sample luma from.",
      })
    ),
    width: VideoDimension.pipe(
      $I.annoteKey("ProbeRegionLuminanceRequest.width", {
        description: "Crop region width in pixels.",
      })
    ),
    x: PixelOffset.pipe(
      $I.annoteKey("ProbeRegionLuminanceRequest.x", {
        description: "Crop region left offset in pixels.",
      })
    ),
    y: PixelOffset.pipe(
      $I.annoteKey("ProbeRegionLuminanceRequest.y", {
        description: "Crop region top offset in pixels.",
      })
    ),
  },
  $I.annote("ProbeRegionLuminanceRequest", {
    description: "Request to sample mean luma over a crop region of every frame.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ProbeRegionLuminanceRequest);
}

/**
 * Mean luma of one frame's crop region.
 *
 * **Example** (Making a LuminanceSample)
 *
 * ```ts
 * import { LuminanceSample } from "@beep/ffmpeg"
 *
 * const sample = LuminanceSample.make({ frameIndex: 0, meanLuma: 70.35, ptsTimeSeconds: 0 })
 * console.log(sample)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LuminanceSample extends S.Class<LuminanceSample>($I`LuminanceSample`)(
  {
    frameIndex: FrameIndex.pipe(
      $I.annoteKey("LuminanceSample.frameIndex", {
        description: "Zero-based decoded frame index reported by the metadata filter.",
      })
    ),
    meanLuma: LumaValue.pipe(
      $I.annoteKey("LuminanceSample.meanLuma", {
        description: "signalstats YAVG mean luma of the cropped region.",
      })
    ),
    ptsTimeSeconds: NonNegativeSeconds.pipe(
      $I.annoteKey("LuminanceSample.ptsTimeSeconds", {
        description: "Presentation timestamp of the sampled frame in seconds.",
      })
    ),
  },
  $I.annote("LuminanceSample", {
    description: "Mean luma of one frame's crop region.",
  })
) {}

/**
 * Result returned after sampling region luminance across a video.
 *
 * **Example** (Making luminance probe result)
 *
 * ```ts
 * import { ProbeRegionLuminanceResult } from "@beep/ffmpeg"
 *
 * const result = ProbeRegionLuminanceResult.make({ samples: [], videoPath: "./capture.webm" })
 * console.log(result)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProbeRegionLuminanceResult extends S.Class<ProbeRegionLuminanceResult>($I`ProbeRegionLuminanceResult`)(
  {
    samples: S.Array(LuminanceSample).pipe(
      $I.annoteKey("ProbeRegionLuminanceResult.samples", {
        description: "Per-frame mean luma samples in decode order.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("ProbeRegionLuminanceResult.videoPath", {
        description: "Resolved source video path that was sampled.",
      })
    ),
  },
  $I.annote("ProbeRegionLuminanceResult", {
    description: "Result returned after sampling region luminance across a video.",
  })
) {}

/**
 * Decode an unknown value into an extract-frame-at request.
 *
 * **Example** (Decoding extract-frame-at request)
 *
 * ```ts
 * import { decodeExtractFrameAtRequest } from "@beep/ffmpeg"
 *
 * const effect = decodeExtractFrameAtRequest({
 *   outPath: "./frames/pointer-down.png",
 *   timestampSeconds: 1.25,
 *   videoPath: "./capture.webm"
 * })
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
// Unary by contract: no dual because input is unknown; options stays on ExtractFrameAtRequest.decodeEffect.
export const decodeExtractFrameAtRequest: (input: unknown) => Effect.Effect<ExtractFrameAtRequest, S.SchemaError> =
  ExtractFrameAtRequest.decodeEffect;

/**
 * Decode an unknown value into an extract-frames-at request.
 *
 * **Example** (Decoding extract-frames-at request)
 *
 * ```ts
 * import { decodeExtractFramesAtRequest } from "@beep/ffmpeg"
 *
 * const effect = decodeExtractFramesAtRequest({
 *   outDir: "./frames",
 *   timestampsSeconds: [0.5, 1.25],
 *   videoPath: "./capture.webm"
 * })
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
// Unary by contract: no dual because input is unknown; options stays on ExtractFramesAtRequest.decodeEffect.
export const decodeExtractFramesAtRequest: (input: unknown) => Effect.Effect<ExtractFramesAtRequest, S.SchemaError> =
  ExtractFramesAtRequest.decodeEffect;

/**
 * Decode an unknown value into an extract-clip request.
 *
 * **Example** (Decoding extract-clip request)
 *
 * ```ts
 * import { decodeExtractClipRequest } from "@beep/ffmpeg"
 *
 * const effect = decodeExtractClipRequest({
 *   outPath: "./clips/drag.mp4",
 *   startSeconds: 1.5,
 *   videoPath: "./capture.webm"
 * })
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
// Unary by contract: no dual because input is unknown; options stays on ExtractClipRequest.decodeEffect.
export const decodeExtractClipRequest: (input: unknown) => Effect.Effect<ExtractClipRequest, S.SchemaError> =
  ExtractClipRequest.decodeEffect;

/**
 * Decode an unknown value into a render-gif request.
 *
 * **Example** (Decoding render-gif request)
 *
 * ```ts
 * import { decodeRenderGifRequest } from "@beep/ffmpeg"
 *
 * const effect = decodeRenderGifRequest({
 *   durationSeconds: 2,
 *   outPath: "./clips/drag.gif",
 *   startSeconds: 1.5,
 *   videoPath: "./capture.webm"
 * })
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
// Unary by contract: no dual because input is unknown; options stays on RenderGifRequest.decodeEffect.
export const decodeRenderGifRequest: (input: unknown) => Effect.Effect<RenderGifRequest, S.SchemaError> =
  RenderGifRequest.decodeEffect;

/**
 * Decode an unknown value into a render-contact-sheet request.
 *
 * **Example** (Decoding contact-sheet request)
 *
 * ```ts
 * import { decodeRenderContactSheetRequest } from "@beep/ffmpeg"
 *
 * const effect = decodeRenderContactSheetRequest({
 *   outPath: "./sheets/capture.jpg",
 *   videoPath: "./capture.webm"
 * })
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
// Unary by contract: no dual because input is unknown; options stays on RenderContactSheetRequest.decodeEffect.
export const decodeRenderContactSheetRequest: (
  input: unknown
) => Effect.Effect<RenderContactSheetRequest, S.SchemaError> = RenderContactSheetRequest.decodeEffect;

/**
 * Decode an unknown value into a write-container-metadata request.
 *
 * **Example** (Decoding metadata write request)
 *
 * ```ts
 * import { decodeWriteContainerMetadataRequest } from "@beep/ffmpeg"
 *
 * const effect = decodeWriteContainerMetadataRequest({
 *   metadata: [{ key: "BEEP_QA_SESSION_ID", value: "session-42" }],
 *   outPath: "./tagged/capture.webm",
 *   videoPath: "./capture.webm"
 * })
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
// Unary by contract: no dual because input is unknown; options stays on WriteContainerMetadataRequest.decodeEffect.
export const decodeWriteContainerMetadataRequest: (
  input: unknown
) => Effect.Effect<WriteContainerMetadataRequest, S.SchemaError> = WriteContainerMetadataRequest.decodeEffect;

/**
 * Decode an unknown value into a probe-region-luminance request.
 *
 * **Example** (Decoding luminance probe request)
 *
 * ```ts
 * import { decodeProbeRegionLuminanceRequest } from "@beep/ffmpeg"
 *
 * const effect = decodeProbeRegionLuminanceRequest({
 *   height: 128,
 *   videoPath: "./capture.webm",
 *   width: 128,
 *   x: 0,
 *   y: 0
 * })
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
// Unary by contract: no dual because input is unknown; options stays on ProbeRegionLuminanceRequest.decodeEffect.
export const decodeProbeRegionLuminanceRequest: (
  input: unknown
) => Effect.Effect<ProbeRegionLuminanceRequest, S.SchemaError> = ProbeRegionLuminanceRequest.decodeEffect;

/**
 * Encode an extract-frames-at manifest into its JSON-safe shape.
 *
 * **Example** (Encoding extract-frames-at manifest)
 *
 * ```ts
 * import {
 *   encodeExtractFramesAtManifest,
 *   ExtractFramesAtManifest,
 *   ExtractFramesAtManifestOptions,
 *   ExtractFramesManifestSummary,
 *   VideoProbe
 * } from "@beep/ffmpeg"
 *
 * const encoded = encodeExtractFramesAtManifest(ExtractFramesAtManifest.make({
 *   frames: [],
 *   manifestPath: "./frames/extract-frames-at-manifest.json",
 *   options: ExtractFramesAtManifestOptions.make({
 *     overwrite: false,
 *     prefix: "capture_at",
 *     timestampsSeconds: []
 *   }),
 *   outputDirectory: "./frames",
 *   probe: VideoProbe.make({ videoPath: "./capture.webm" }),
 *   schemaVersion: "beep.ffmpeg.extract-frames-at.v1",
 *   sourceVideo: "./capture.webm",
 *   summary: ExtractFramesManifestSummary.make({ frameCount: 0 })
 * }))
 * console.log(encoded)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
// Unary by contract: no dual because input is unknown; options stays on ExtractFramesAtManifest.encodeEffect.
export const encodeExtractFramesAtManifest: (
  input: unknown
) => Effect.Effect<typeof ExtractFramesAtManifest.Encoded, S.SchemaError> = ExtractFramesAtManifest.encodeEffect;
