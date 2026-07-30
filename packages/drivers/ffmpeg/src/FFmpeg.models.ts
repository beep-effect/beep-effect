/**
 * Schema-first public models for the native FFmpeg driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FfmpegId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $FfmpegId.create("FFmpeg.models");

/**
 * Positive frame extraction rate in frames per second.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PositiveFrameRate } from "@beep/ffmpeg"
 *
 * const fps = S.decodeUnknownSync(PositiveFrameRate)(1)
 * console.log(fps)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PositiveFrameRate = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isFinite({
        identifier: $I`PositiveFrameRateFiniteCheck`,
        title: "Positive Frame Rate Finite",
        description: "Frame extraction rates must be finite numbers.",
        message: "Expected a finite frame rate",
      }),
      S.isGreaterThan(0, {
        identifier: $I`PositiveFrameRateGreaterThanZeroCheck`,
        title: "Positive Frame Rate Greater Than Zero",
        description: "Frame extraction rates must be greater than zero.",
        message: "Expected a frame rate greater than zero",
      }),
    ],
    {
      identifier: $I`PositiveFrameRateChecks`,
      title: "Positive Frame Rate",
      description: "Checks for positive finite frame extraction rates.",
    }
  )
).pipe(
  $I.annoteSchema("PositiveFrameRate", {
    description: "Positive finite frame extraction rate in frames per second.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Positive frame extraction rate in frames per second.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PositiveFrameRate } from "@beep/ffmpeg"
 *
 * const fps: PositiveFrameRate = S.decodeUnknownSync(PositiveFrameRate)(1)
 * console.log(fps)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PositiveFrameRate = typeof PositiveFrameRate.Type;

/**
 * Positive timeout value in milliseconds.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PositiveMilliseconds } from "@beep/ffmpeg"
 *
 * const timeout = S.decodeUnknownSync(PositiveMilliseconds)(2000)
 * console.log(timeout)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PositiveMilliseconds = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isFinite({
        identifier: $I`PositiveMillisecondsFiniteCheck`,
        title: "Positive Milliseconds Finite",
        description: "Timeout milliseconds must be finite numbers.",
        message: "Expected finite milliseconds",
      }),
      S.isGreaterThan(0, {
        identifier: $I`PositiveMillisecondsGreaterThanZeroCheck`,
        title: "Positive Milliseconds Greater Than Zero",
        description: "Timeout milliseconds must be greater than zero.",
        message: "Expected milliseconds greater than zero",
      }),
    ],
    {
      identifier: $I`PositiveMillisecondsChecks`,
      title: "Positive Milliseconds",
      description: "Checks for positive finite timeout milliseconds.",
    }
  )
).pipe(
  $I.annoteSchema("PositiveMilliseconds", {
    description: "Positive finite timeout value in milliseconds.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Positive timeout value in milliseconds.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PositiveMilliseconds } from "@beep/ffmpeg"
 *
 * const timeout: PositiveMilliseconds = S.decodeUnknownSync(PositiveMilliseconds)(2000)
 * console.log(timeout)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PositiveMilliseconds = typeof PositiveMilliseconds.Type;

/**
 * File-name prefix accepted for generated frame outputs.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { SafeFramePrefix } from "@beep/ffmpeg"
 *
 * const prefix = S.decodeUnknownSync(SafeFramePrefix)("clip_frame")
 * console.log(prefix)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SafeFramePrefix = S.String.check(
  S.makeFilterGroup(
    [
      S.isMinLength(1, {
        identifier: $I`SafeFramePrefixNonEmptyCheck`,
        title: "Safe Frame Prefix Non Empty",
        description: "Frame filename prefixes must not be empty.",
        message: "Expected a non-empty frame prefix",
      }),
      S.isPattern(/^[^/\\\0]+$/, {
        identifier: $I`SafeFramePrefixNoPathSeparatorsCheck`,
        title: "Safe Frame Prefix Without Path Separators",
        description: "Frame filename prefixes must not contain path separators or NUL bytes.",
        message: "Expected a frame prefix without path separators or NUL bytes",
      }),
    ],
    {
      identifier: $I`SafeFramePrefixChecks`,
      title: "Safe Frame Prefix",
      description: "Checks for frame prefixes that stay within the selected output directory.",
    }
  )
).pipe(
  $I.annoteSchema("SafeFramePrefix", {
    description: "Frame filename prefix that cannot escape the output directory.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Safe frame filename prefix.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { SafeFramePrefix } from "@beep/ffmpeg"
 *
 * const prefix: SafeFramePrefix = S.decodeUnknownSync(SafeFramePrefix)("clip_frame")
 * console.log(prefix)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeFramePrefix = typeof SafeFramePrefix.Type;

/**
 * Non-negative finite duration measured in seconds.
 *
 * @example
 * ```ts
 * import { NonNegativeSeconds } from "@beep/ffmpeg"
 *
 * const seconds = NonNegativeSeconds.make(3)
 * console.log(seconds)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NonNegativeSeconds = S.Finite.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`NonNegativeSecondsMinimumCheck`,
    title: "Non Negative Seconds Minimum",
    description: "Video durations must be zero or greater.",
    message: "Expected non-negative seconds",
  })
).pipe(
  $I.annoteSchema("NonNegativeSeconds", {
    description: "Non-negative finite duration measured in seconds.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Non-negative finite duration measured in seconds.
 *
 * @example
 * ```ts
 * import { NonNegativeSeconds } from "@beep/ffmpeg"
 * import type { NonNegativeSeconds as NonNegativeSecondsValue } from "@beep/ffmpeg"
 *
 * const seconds: NonNegativeSecondsValue = NonNegativeSeconds.make(3)
 * console.log(seconds)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NonNegativeSeconds = typeof NonNegativeSeconds.Type;

/**
 * Zero-based frame index.
 *
 * @example
 * ```ts
 * import { FrameIndex } from "@beep/ffmpeg"
 *
 * const index = FrameIndex.make(0)
 * console.log(index)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FrameIndex = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`FrameIndexMinimumCheck`,
    title: "Frame Index Minimum",
    description: "Generated frame indexes are zero-based non-negative integers.",
    message: "Expected a non-negative frame index",
  })
).pipe(
  $I.annoteSchema("FrameIndex", {
    description: "Zero-based non-negative integer frame index.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Zero-based frame index.
 *
 * @example
 * ```ts
 * import { FrameIndex } from "@beep/ffmpeg"
 * import type { FrameIndex as FrameIndexValue } from "@beep/ffmpeg"
 *
 * const index: FrameIndexValue = FrameIndex.make(0)
 * console.log(index)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FrameIndex = typeof FrameIndex.Type;

/**
 * Non-negative integer frame count.
 *
 * @example
 * ```ts
 * import { FrameCount } from "@beep/ffmpeg"
 *
 * const count = FrameCount.make(2)
 * console.log(count)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FrameCount = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`FrameCountMinimumCheck`,
    title: "Frame Count Minimum",
    description: "Frame counts are non-negative integers.",
    message: "Expected a non-negative frame count",
  })
).pipe(
  $I.annoteSchema("FrameCount", {
    description: "Non-negative integer frame count.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Non-negative integer frame count.
 *
 * @example
 * ```ts
 * import { FrameCount } from "@beep/ffmpeg"
 * import type { FrameCount as FrameCountValue } from "@beep/ffmpeg"
 *
 * const count: FrameCountValue = FrameCount.make(2)
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FrameCount = typeof FrameCount.Type;

/**
 * Positive integer pixel dimension.
 *
 * @example
 * ```ts
 * import { VideoDimension } from "@beep/ffmpeg"
 *
 * const width = VideoDimension.make(1920)
 * console.log(width)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VideoDimension = S.Int.check(
  S.isGreaterThanOrEqualTo(1, {
    identifier: $I`VideoDimensionMinimumCheck`,
    title: "Video Dimension Minimum",
    description: "Video dimensions are positive integer pixel counts.",
    message: "Expected a positive integer pixel dimension",
  })
).pipe(
  $I.annoteSchema("VideoDimension", {
    description: "Positive integer pixel dimension.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Positive integer pixel dimension.
 *
 * @example
 * ```ts
 * import { VideoDimension } from "@beep/ffmpeg"
 * import type { VideoDimension as VideoDimensionValue } from "@beep/ffmpeg"
 *
 * const width: VideoDimensionValue = VideoDimension.make(1920)
 * console.log(width)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VideoDimension = typeof VideoDimension.Type;

/**
 * FFmpeg progress percent in the closed 0-100 range.
 *
 * @example
 * ```ts
 * import { FFmpegProgressPercent } from "@beep/ffmpeg"
 *
 * const percent = FFmpegProgressPercent.make(50)
 * console.log(percent)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FFmpegProgressPercent = S.Finite.check(
  S.makeFilterGroup(
    [
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`FFmpegProgressPercentMinimumCheck`,
        title: "FFmpeg Progress Percent Minimum",
        description: "FFmpeg progress percentages must be zero or greater.",
        message: "Expected progress percent to be at least zero",
      }),
      S.isLessThanOrEqualTo(100, {
        identifier: $I`FFmpegProgressPercentMaximumCheck`,
        title: "FFmpeg Progress Percent Maximum",
        description: "FFmpeg progress percentages must not exceed 100.",
        message: "Expected progress percent to be at most 100",
      }),
    ],
    {
      identifier: $I`FFmpegProgressPercentChecks`,
      title: "FFmpeg Progress Percent",
      description: "Checks for FFmpeg progress percentages in the closed 0-100 range.",
    }
  )
).pipe(
  $I.annoteSchema("FFmpegProgressPercent", {
    description: "Progress percentage in the closed 0-100 range.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * FFmpeg progress percent in the closed 0-100 range.
 *
 * @example
 * ```ts
 * import { FFmpegProgressPercent } from "@beep/ffmpeg"
 * import type { FFmpegProgressPercent as FFmpegProgressPercentValue } from "@beep/ffmpeg"
 *
 * const percent: FFmpegProgressPercentValue = FFmpegProgressPercent.make(50)
 * console.log(percent)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FFmpegProgressPercent = typeof FFmpegProgressPercent.Type;

/**
 * Minimum filename padding width used for generated frame numbers.
 *
 * @example
 * ```ts
 * import { FrameFilenamePadding } from "@beep/ffmpeg"
 *
 * const padding = FrameFilenamePadding.make(5)
 * console.log(padding)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FrameFilenamePadding = S.Int.check(
  S.isGreaterThanOrEqualTo(1, {
    identifier: $I`FrameFilenamePaddingMinimumCheck`,
    title: "Frame Filename Padding Minimum",
    description: "Frame filename padding widths must be positive integers.",
    message: "Expected a positive frame filename padding width",
  })
).pipe(
  $I.annoteSchema("FrameFilenamePadding", {
    description: "Positive integer filename padding width used for generated frame numbers.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Minimum filename padding width used for generated frame numbers.
 *
 * @example
 * ```ts
 * import { FrameFilenamePadding } from "@beep/ffmpeg"
 * import type { FrameFilenamePadding as FrameFilenamePaddingValue } from "@beep/ffmpeg"
 *
 * const padding: FrameFilenamePaddingValue = FrameFilenamePadding.make(5)
 * console.log(padding)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FrameFilenamePadding = typeof FrameFilenamePadding.Type;

/**
 * Runtime path overrides for the native FFmpeg binaries.
 *
 * @example
 * ```ts
 * import { FFmpegConfigInput } from "@beep/ffmpeg"
 *
 * const config = FFmpegConfigInput.make({ ffmpegPath: "ffmpeg", ffprobePath: "ffprobe" })
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FFmpegConfigInput extends S.Class<FFmpegConfigInput>($I`FFmpegConfigInput`)(
  {
    ffmpegPath: S.String.pipe(
      SchemaUtils.withKeyDefaults("ffmpeg"),
      $I.annoteKey("FFmpegConfigInput.ffmpegPath", {
        description: "Executable path or command name used for ffmpeg.",
      })
    ),
    ffprobePath: S.String.pipe(
      SchemaUtils.withKeyDefaults("ffprobe"),
      $I.annoteKey("FFmpegConfigInput.ffprobePath", {
        description: "Executable path or command name used for ffprobe.",
      })
    ),
    forceKillAfterMillis: PositiveMilliseconds.pipe(
      SchemaUtils.withKeyDefaults(2000),
      $I.annoteKey("FFmpegConfigInput.forceKillAfterMillis", {
        description: "Timeout in milliseconds before an interrupted native process is force-killed.",
      })
    ),
  },
  $I.annote("FFmpegConfigInput", {
    description: "Optional runtime path overrides for native FFmpeg binaries.",
  })
) {}

/**
 * Resolved runtime configuration for the native FFmpeg driver.
 *
 * @example
 * ```ts
 * import { FFmpegConfig } from "@beep/ffmpeg"
 *
 * const config = FFmpegConfig.make({
 *   ffmpegPath: "ffmpeg",
 *   ffprobePath: "ffprobe",
 *   forceKillAfterMillis: 2000
 * })
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FFmpegConfig extends S.Class<FFmpegConfig>($I`FFmpegConfig`)(
  {
    ffmpegPath: S.String.pipe(
      $I.annoteKey("FFmpegConfig.ffmpegPath", {
        description: "Resolved executable path or command name used for ffmpeg.",
      })
    ),
    ffprobePath: S.String.pipe(
      $I.annoteKey("FFmpegConfig.ffprobePath", {
        description: "Resolved executable path or command name used for ffprobe.",
      })
    ),
    forceKillAfterMillis: PositiveMilliseconds.pipe(
      $I.annoteKey("FFmpegConfig.forceKillAfterMillis", {
        description: "Resolved timeout in milliseconds before an interrupted native process is force-killed.",
      })
    ),
  },
  $I.annote("FFmpegConfig", {
    description: "Resolved runtime configuration for native FFmpeg command execution.",
  })
) {}

/**
 * Request to probe a video's first video stream.
 *
 * @example
 * ```ts
 * import { ProbeVideoRequest } from "@beep/ffmpeg"
 *
 * const request = ProbeVideoRequest.make({ videoPath: "./clip.mp4" })
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProbeVideoRequest extends S.Class<ProbeVideoRequest>($I`ProbeVideoRequest`)(
  {
    videoPath: S.String.pipe(
      $I.annoteKey("ProbeVideoRequest.videoPath", {
        description: "Video file path to inspect with ffprobe.",
      })
    ),
  },
  $I.annote("ProbeVideoRequest", {
    description: "Request to probe a video's first video stream.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ProbeVideoRequest);
}

/**
 * Video metadata extracted from ffprobe.
 *
 * @example
 * ```ts
 * import { VideoProbe } from "@beep/ffmpeg"
 * import * as O from "effect/Option"
 *
 * const probe = VideoProbe.make({ videoPath: "./clip.mp4", durationSeconds: O.some(3) })
 * console.log(probe)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VideoProbe extends S.Class<VideoProbe>($I`VideoProbe`)(
  {
    videoPath: S.String.pipe(
      $I.annoteKey("VideoProbe.videoPath", {
        description: "Resolved video file path that was probed.",
      })
    ),
    durationSeconds: S.OptionFromOptionalKey(NonNegativeSeconds).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("VideoProbe.durationSeconds", {
        description: "Detected non-negative duration in seconds, when ffprobe reported one.",
      })
    ),
    fps: S.OptionFromOptionalKey(PositiveFrameRate).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("VideoProbe.fps", {
        description: "Detected positive frame rate, when ffprobe reported one.",
      })
    ),
    frameCount: S.OptionFromOptionalKey(FrameCount).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("VideoProbe.frameCount", {
        description: "Detected non-negative frame count, when ffprobe reported one.",
      })
    ),
    height: S.OptionFromOptionalKey(VideoDimension).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("VideoProbe.height", {
        description: "Detected positive video height in pixels, when ffprobe reported one.",
      })
    ),
    rFrameRate: S.OptionFromOptionalKey(PositiveFrameRate).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("VideoProbe.rFrameRate", {
        description: "Detected real base frame rate (ffprobe r_frame_rate), when ffprobe reported one.",
      })
    ),
    startTimeSeconds: S.OptionFromOptionalKey(S.Finite).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("VideoProbe.startTimeSeconds", {
        description: "Detected stream or container start time in seconds, when ffprobe reported one.",
      })
    ),
    width: S.OptionFromOptionalKey(VideoDimension).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("VideoProbe.width", {
        description: "Detected positive video width in pixels, when ffprobe reported one.",
      })
    ),
  },
  $I.annote("VideoProbe", {
    description: "Video metadata extracted from the first ffprobe video stream.",
  })
) {}

/**
 * Request to extract PNG frames from a video.
 *
 * @example
 * ```ts
 * import { ExtractFramesRequest } from "@beep/ffmpeg"
 * import * as O from "effect/Option"
 *
 * const request = ExtractFramesRequest.make({
 *   fps: 1,
 *   manifestPath: O.none(),
 *   outDir: "./frames",
 *   overwrite: false,
 *   prefix: O.none(),
 *   videoPath: "./clip.mp4"
 * })
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesRequest extends S.Class<ExtractFramesRequest>($I`ExtractFramesRequest`)(
  {
    fps: PositiveFrameRate.pipe(
      $I.annoteKey("ExtractFramesRequest.fps", {
        description: "Positive frame extraction rate in frames per second.",
      })
    ),
    manifestPath: S.Option(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<string>())),
      S.withDecodingDefault(Effect.succeed(O.none<string>())),
      $I.annoteKey("ExtractFramesRequest.manifestPath", {
        description: "Optional manifest path; defaults inside the output directory when absent.",
      })
    ),
    outDir: S.String.pipe(
      $I.annoteKey("ExtractFramesRequest.outDir", {
        description: "Directory where extracted PNG frames and the manifest are written.",
      })
    ),
    overwrite: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false)),
      $I.annoteKey("ExtractFramesRequest.overwrite", {
        description: "Whether existing frame and manifest outputs may be overwritten.",
      })
    ),
    prefix: S.Option(SafeFramePrefix).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<SafeFramePrefix>())),
      S.withDecodingDefault(Effect.succeed(O.none<SafeFramePrefix>())),
      $I.annoteKey("ExtractFramesRequest.prefix", {
        description: "Optional safe filename prefix for generated PNG frames.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("ExtractFramesRequest.videoPath", {
        description: "Video file path to extract frames from.",
      })
    ),
  },
  $I.annote("ExtractFramesRequest", {
    description: "Request to extract PNG frames from a video at a fixed frame rate.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ExtractFramesRequest);
}

/**
 * A frame written by an extract-frames run.
 *
 * @example
 * ```ts
 * import { ExtractedFrame } from "@beep/ffmpeg"
 *
 * const frame = ExtractedFrame.make({
 *   fileName: "clip_frame_00000.png",
 *   index: 0,
 *   path: "./frames/clip_frame_00000.png",
 *   relativePath: "clip_frame_00000.png"
 * })
 * console.log(frame)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractedFrame extends S.Class<ExtractedFrame>($I`ExtractedFrame`)(
  {
    fileName: S.String.pipe(
      $I.annoteKey("ExtractedFrame.fileName", {
        description: "Generated PNG file name for the extracted frame.",
      })
    ),
    index: FrameIndex.pipe(
      $I.annoteKey("ExtractedFrame.index", {
        description: "Zero-based frame index in the committed output order.",
      })
    ),
    path: S.String.pipe(
      $I.annoteKey("ExtractedFrame.path", {
        description: "Absolute or caller-visible path to the committed PNG frame.",
      })
    ),
    relativePath: S.String.pipe(
      $I.annoteKey("ExtractedFrame.relativePath", {
        description: "Frame path relative to the output directory.",
      })
    ),
  },
  $I.annote("ExtractedFrame", {
    description: "A PNG frame written by an extract-frames run.",
  })
) {}

/**
 * Options recorded in an extract-frames manifest.
 *
 * @example
 * ```ts
 * import { ExtractFramesManifestOptions } from "@beep/ffmpeg"
 *
 * const options = ExtractFramesManifestOptions.make({ fps: 1, overwrite: false, prefix: "clip_frame" })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesManifestOptions extends S.Class<ExtractFramesManifestOptions>(
  $I`ExtractFramesManifestOptions`
)(
  {
    fps: PositiveFrameRate.pipe(
      $I.annoteKey("ExtractFramesManifestOptions.fps", {
        description: "Frame extraction rate recorded in the manifest.",
      })
    ),
    overwrite: S.Boolean.pipe(
      $I.annoteKey("ExtractFramesManifestOptions.overwrite", {
        description: "Whether the extraction run allowed overwriting outputs.",
      })
    ),
    prefix: SafeFramePrefix.pipe(
      $I.annoteKey("ExtractFramesManifestOptions.prefix", {
        description: "Safe filename prefix used for generated PNG frames.",
      })
    ),
  },
  $I.annote("ExtractFramesManifestOptions", {
    description: "Options recorded in an extract-frames manifest.",
  })
) {}

/**
 * Summary recorded in an extract-frames manifest.
 *
 * @example
 * ```ts
 * import { ExtractFramesManifestSummary } from "@beep/ffmpeg"
 *
 * const summary = ExtractFramesManifestSummary.make({ frameCount: 3 })
 * console.log(summary)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesManifestSummary extends S.Class<ExtractFramesManifestSummary>(
  $I`ExtractFramesManifestSummary`
)(
  {
    frameCount: FrameCount.pipe(
      $I.annoteKey("ExtractFramesManifestSummary.frameCount", {
        description: "Number of committed frame records in the manifest.",
      })
    ),
  },
  $I.annote("ExtractFramesManifestSummary", {
    description: "Summary recorded in an extract-frames manifest.",
  })
) {}

/**
 * JSON manifest written by an extract-frames run.
 *
 * @example
 * ```ts
 * import { ExtractFramesManifest, ExtractFramesManifestOptions, ExtractFramesManifestSummary, VideoProbe } from "@beep/ffmpeg"
 *
 * const manifest = ExtractFramesManifest.make({
 *   frames: [],
 *   manifestPath: "./frames/extract-frames-manifest.json",
 *   options: ExtractFramesManifestOptions.make({ fps: 1, overwrite: false, prefix: "clip_frame" }),
 *   outputDirectory: "./frames",
 *   probe: VideoProbe.make({ videoPath: "./clip.mp4" }),
 *   schemaVersion: "beep.ffmpeg.extract-frames.v1",
 *   sourceVideo: "./clip.mp4",
 *   summary: ExtractFramesManifestSummary.make({ frameCount: 0 })
 * })
 * console.log(manifest)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesManifest extends S.Class<ExtractFramesManifest>($I`ExtractFramesManifest`)(
  {
    frames: S.Array(ExtractedFrame).pipe(
      $I.annoteKey("ExtractFramesManifest.frames", {
        description: "Committed extracted frame records.",
      })
    ),
    manifestPath: S.String.pipe(
      $I.annoteKey("ExtractFramesManifest.manifestPath", {
        description: "Path where this manifest was written.",
      })
    ),
    options: ExtractFramesManifestOptions.pipe(
      $I.annoteKey("ExtractFramesManifest.options", {
        description: "Extraction options recorded for reproducibility.",
      })
    ),
    outputDirectory: S.String.pipe(
      $I.annoteKey("ExtractFramesManifest.outputDirectory", {
        description: "Directory containing the committed frame files.",
      })
    ),
    probe: VideoProbe.pipe(
      $I.annoteKey("ExtractFramesManifest.probe", {
        description: "Video metadata observed before extraction.",
      })
    ),
    schemaVersion: S.Literal("beep.ffmpeg.extract-frames.v1").pipe(
      $I.annoteKey("ExtractFramesManifest.schemaVersion", {
        description: "Manifest schema version literal.",
      })
    ),
    sourceVideo: S.String.pipe(
      $I.annoteKey("ExtractFramesManifest.sourceVideo", {
        description: "Resolved source video path used for extraction.",
      })
    ),
    summary: ExtractFramesManifestSummary.pipe(
      $I.annoteKey("ExtractFramesManifest.summary", {
        description: "Aggregate frame counts for the extraction run.",
      })
    ),
  },
  $I.annote("ExtractFramesManifest", {
    description: "JSON manifest written by a successful extract-frames run.",
  })
) {
  static readonly encodeEffect = S.encodeUnknownEffect(ExtractFramesManifest);
}

/**
 * Result returned after frames have been committed.
 *
 * @example
 * ```ts
 * import { ExtractFramesResult } from "@beep/ffmpeg"
 *
 * const result = ExtractFramesResult.make({
 *   frameCount: 0,
 *   frames: [],
 *   manifestPath: "./frames/extract-frames-manifest.json",
 *   outDir: "./frames",
 *   videoPath: "./clip.mp4"
 * })
 * console.log(result)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesResult extends S.Class<ExtractFramesResult>($I`ExtractFramesResult`)(
  {
    frameCount: FrameCount.pipe(
      $I.annoteKey("ExtractFramesResult.frameCount", {
        description: "Number of committed PNG frames.",
      })
    ),
    frames: S.Array(ExtractedFrame).pipe(
      $I.annoteKey("ExtractFramesResult.frames", {
        description: "Committed extracted frame records.",
      })
    ),
    manifestPath: S.String.pipe(
      $I.annoteKey("ExtractFramesResult.manifestPath", {
        description: "Path to the committed extract-frames manifest.",
      })
    ),
    outDir: S.String.pipe(
      $I.annoteKey("ExtractFramesResult.outDir", {
        description: "Directory containing the committed outputs.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("ExtractFramesResult.videoPath", {
        description: "Resolved source video path used for extraction.",
      })
    ),
  },
  $I.annote("ExtractFramesResult", {
    description: "Result returned after frames and manifest have been committed.",
  })
) {}

/**
 * Event emitted when extract-frames starts.
 *
 * @example
 * ```ts
 * import { FFmpegStartedEvent } from "@beep/ffmpeg"
 *
 * const event = FFmpegStartedEvent.make({
 *   args: [],
 *   command: "ffmpeg",
 *   kind: "started",
 *   outDir: "./frames",
 *   videoPath: "./clip.mp4"
 * })
 * console.log(event)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class FFmpegStartedEvent extends S.Class<FFmpegStartedEvent>($I`FFmpegStartedEvent`)(
  {
    args: S.Array(S.String).pipe(
      $I.annoteKey("FFmpegStartedEvent.args", {
        description: "Arguments passed to the native ffmpeg command.",
      })
    ),
    command: S.String.pipe(
      $I.annoteKey("FFmpegStartedEvent.command", {
        description: "Native ffmpeg executable path or command name.",
      })
    ),
    kind: S.tag("started").pipe(
      $I.annoteKey("FFmpegStartedEvent.kind", {
        description: "Discriminator for extraction start events.",
      })
    ),
    outDir: S.String.pipe(
      $I.annoteKey("FFmpegStartedEvent.outDir", {
        description: "Output directory selected for frame extraction.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("FFmpegStartedEvent.videoPath", {
        description: "Resolved source video path used for extraction.",
      })
    ),
  },
  $I.annote("FFmpegStartedEvent", {
    description: "Event emitted before the ffmpeg extraction process starts.",
  })
) {}

/**
 * Event emitted when ffmpeg reports extraction progress.
 *
 * @example
 * ```ts
 * import { FFmpegProgressEvent } from "@beep/ffmpeg"
 * import * as O from "effect/Option"
 *
 * const event = FFmpegProgressEvent.make({
 *   frameCount: 1,
 *   kind: "progress",
 *   outTimeSeconds: O.none(),
 *   percent: 50,
 *   progress: "continue",
 *   speed: O.none()
 * })
 * console.log(event)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class FFmpegProgressEvent extends S.Class<FFmpegProgressEvent>($I`FFmpegProgressEvent`)(
  {
    frameCount: FrameCount.pipe(
      $I.annoteKey("FFmpegProgressEvent.frameCount", {
        description: "Frame count reported by ffmpeg progress output.",
      })
    ),
    kind: S.tag("progress").pipe(
      $I.annoteKey("FFmpegProgressEvent.kind", {
        description: "Discriminator for extraction progress events.",
      })
    ),
    outTimeSeconds: S.OptionFromOptionalKey(NonNegativeSeconds).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegProgressEvent.outTimeSeconds", {
        description: "Output timestamp in seconds, when ffmpeg reported one.",
      })
    ),
    percent: FFmpegProgressPercent.pipe(
      $I.annoteKey("FFmpegProgressEvent.percent", {
        description: "Progress percentage clamped into the closed 0-100 range.",
      })
    ),
    progress: S.String.pipe(
      $I.annoteKey("FFmpegProgressEvent.progress", {
        description: "Raw ffmpeg progress marker for this block.",
      })
    ),
    speed: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegProgressEvent.speed", {
        description: "Raw ffmpeg speed text, when ffmpeg reported one.",
      })
    ),
  },
  $I.annote("FFmpegProgressEvent", {
    description: "Event emitted when ffmpeg reports extraction progress.",
  })
) {}

/**
 * Event emitted after frames and manifest are committed.
 *
 * @example
 * ```ts
 * import { FFmpegCompletedEvent } from "@beep/ffmpeg"
 *
 * const event = FFmpegCompletedEvent.make({
 *   frameCount: 1,
 *   kind: "completed",
 *   manifestPath: "./frames/extract-frames-manifest.json",
 *   outDir: "./frames"
 * })
 * console.log(event)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class FFmpegCompletedEvent extends S.Class<FFmpegCompletedEvent>($I`FFmpegCompletedEvent`)(
  {
    frameCount: FrameCount.pipe(
      $I.annoteKey("FFmpegCompletedEvent.frameCount", {
        description: "Number of committed PNG frames.",
      })
    ),
    kind: S.tag("completed").pipe(
      $I.annoteKey("FFmpegCompletedEvent.kind", {
        description: "Discriminator for extraction completion events.",
      })
    ),
    manifestPath: S.String.pipe(
      $I.annoteKey("FFmpegCompletedEvent.manifestPath", {
        description: "Path to the committed extract-frames manifest.",
      })
    ),
    outDir: S.String.pipe(
      $I.annoteKey("FFmpegCompletedEvent.outDir", {
        description: "Directory containing committed outputs.",
      })
    ),
  },
  $I.annote("FFmpegCompletedEvent", {
    description: "Event emitted after frames and manifest are committed.",
  })
) {}

/**
 * Structured events emitted by extract-frames.
 *
 * @example
 * ```ts
 * import type { FFmpegEvent } from "@beep/ffmpeg"
 *
 * const log = (event: FFmpegEvent) => event.kind
 * console.log(log)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const FFmpegEvent = S.Union([FFmpegStartedEvent, FFmpegProgressEvent, FFmpegCompletedEvent]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("FFmpegEvent", {
    description: "Structured events emitted by extract-frames.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Structured events emitted by extract-frames.
 *
 * @example
 * ```ts
 * import type { FFmpegEvent } from "@beep/ffmpeg"
 *
 * const eventKind = (event: FFmpegEvent) => event.kind
 * console.log(eventKind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export type FFmpegEvent = typeof FFmpegEvent.Type;

/**
 * Decode an unknown value into an extract-frames request.
 *
 * @example
 * ```ts
 * import { decodeExtractFramesRequest } from "@beep/ffmpeg"
 *
 * const effect = decodeExtractFramesRequest({ fps: 1, outDir: "./frames", videoPath: "./clip.mp4" })
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeExtractFramesRequest = ExtractFramesRequest.decodeEffect;

/**
 * Decode an unknown value into a probe request.
 *
 * @example
 * ```ts
 * import { decodeProbeVideoRequest } from "@beep/ffmpeg"
 *
 * const effect = decodeProbeVideoRequest({ videoPath: "./clip.mp4" })
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeProbeVideoRequest = ProbeVideoRequest.decodeEffect;

/**
 * Encode an extract-frames manifest into its JSON-safe shape.
 *
 * @example
 * ```ts
 * import { encodeExtractFramesManifest, ExtractFramesManifest, ExtractFramesManifestOptions, ExtractFramesManifestSummary, VideoProbe } from "@beep/ffmpeg"
 *
 * const encoded = encodeExtractFramesManifest(ExtractFramesManifest.make({
 *   frames: [],
 *   manifestPath: "./frames/extract-frames-manifest.json",
 *   options: ExtractFramesManifestOptions.make({ fps: 1, overwrite: false, prefix: "clip_frame" }),
 *   outputDirectory: "./frames",
 *   probe: VideoProbe.make({ videoPath: "./clip.mp4" }),
 *   schemaVersion: "beep.ffmpeg.extract-frames.v1",
 *   sourceVideo: "./clip.mp4",
 *   summary: ExtractFramesManifestSummary.make({ frameCount: 0 })
 * }))
 * console.log(encoded)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeExtractFramesManifest = ExtractFramesManifest.encodeEffect;
