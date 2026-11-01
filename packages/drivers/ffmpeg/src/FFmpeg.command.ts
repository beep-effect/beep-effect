/**
 * Pure command planning and frame naming for the native FFmpeg driver.
 *
 * **Details**
 *
 * This module converts validated technical options into argument vectors.
 * Process ownership, filesystem staging and media execution remain in the service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FfmpegId } from "@beep/identity/packages";
import { Fn } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import { ClipCodec, GifDither, JpegQuality, MetadataPair, TileCount } from "./FFmpeg.capture.models.ts";
import { FrameFilenamePadding, FrameIndex, SafeFramePrefix, VideoDimension } from "./FFmpeg.models.ts";
import type { ProbeVideoRequest } from "./FFmpeg.models.ts";

const $I = $FfmpegId.create("FFmpeg.command");

/**
 * Options for formatting one generated PNG frame filename.
 *
 * **Example** (Make filename options)
 *
 * ```ts
 * import { FormatFrameFileNameOptions } from "@beep/ffmpeg"
 *
 * const options = FormatFrameFileNameOptions.make({ index: 0, padding: 5, prefix: "clip_frame" })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FormatFrameFileNameOptions extends S.Opaque<
  FormatFrameFileNameOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    index: FrameIndex.pipe(
      $I.annoteKey("FormatFrameFileNameOptions.index", {
        description: "Zero-based frame index to render into the filename.",
      })
    ),
    padding: FrameFilenamePadding.pipe(
      $I.annoteKey("FormatFrameFileNameOptions.padding", {
        description: "Minimum width used when zero-padding the frame index.",
      })
    ),
    prefix: SafeFramePrefix.pipe(
      $I.annoteKey("FormatFrameFileNameOptions.prefix", {
        description: "Safe filename prefix placed before the padded frame index.",
      })
    ),
  }).pipe(
    $I.annoteSchema("FormatFrameFileNameOptions", {
      description: "Options for formatting one generated PNG frame filename.",
    })
  )
) {}

const FormatFrameFileName = Fn({
  input: FormatFrameFileNameOptions,
  output: S.String,
}).pipe(
  $I.annoteSchema("FormatFrameFileName", {
    description: "Schema-backed formatter for generated PNG frame filenames.",
  })
);

/**
 * Format a generated PNG frame filename.
 *
 * **Example** (Format padded frame name)
 *
 * ```ts
 * import { FormatFrameFileNameOptions, formatFrameFileName } from "@beep/ffmpeg"
 *
 * const name = formatFrameFileName(FormatFrameFileNameOptions.make({ index: 0, padding: 5, prefix: "clip_frame" }))
 * console.log(name)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const formatFrameFileName: (options: FormatFrameFileNameOptions) => string = FormatFrameFileName.implementSync(
  (options) => `${options.prefix}_${pipe(`${options.index}`, Str.padStart(options.padding, "0"))}.png`
);

/**
 * Build ffprobe arguments for the video-probe operation.
 *
 * **Example** (Build probe video args)
 *
 * ```ts
 * import { buildFfprobeArgs, ProbeVideoRequest } from "@beep/ffmpeg"
 *
 * const args = buildFfprobeArgs(ProbeVideoRequest.make({ videoPath: "./clip.mp4" }))
 * console.log(args)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const buildFfprobeArgs = (request: ProbeVideoRequest): ReadonlyArray<string> => [
  "-v",
  "error",
  "-select_streams",
  "v:0",
  "-show_entries",
  "stream=width,height,avg_frame_rate,r_frame_rate,duration,nb_frames,start_time",
  "-show_entries",
  "format=duration,start_time",
  "-of",
  "json",
  request.videoPath,
];

/**
 * Options for building native ffmpeg frame extraction arguments.
 *
 * **Example** (Make extract frames options)
 *
 * ```ts
 * import { BuildExtractFramesArgsOptions } from "@beep/ffmpeg"
 *
 * const options = BuildExtractFramesArgsOptions.make({
 *   fps: "1",
 *   outputPattern: "./frames/frame_%05d.png",
 *   videoPath: "./clip.mp4"
 * })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildExtractFramesArgsOptions extends S.Opaque<
  BuildExtractFramesArgsOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    fps: S.String.pipe(
      $I.annoteKey("BuildExtractFramesArgsOptions.fps", {
        description: "Frame-rate text passed to ffmpeg's fps video filter.",
      })
    ),
    outputPattern: S.String.pipe(
      $I.annoteKey("BuildExtractFramesArgsOptions.outputPattern", {
        description: "ffmpeg image2 output pattern for generated PNG frames.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("BuildExtractFramesArgsOptions.videoPath", {
        description: "Input video path passed to the native ffmpeg command.",
      })
    ),
  }).pipe(
    $I.annoteSchema("BuildExtractFramesArgsOptions", {
      description: "Options for building native ffmpeg frame extraction arguments.",
    })
  )
) {}

const BuildExtractFramesArgs = Fn({
  input: BuildExtractFramesArgsOptions,
  output: S.Array(S.String),
}).pipe(
  $I.annoteSchema("BuildExtractFramesArgs", {
    description: "Schema-backed builder for native ffmpeg frame extraction arguments.",
  })
);

/**
 * Build ffmpeg arguments for extracting PNG frames.
 *
 * **Example** (Build extract frames args)
 *
 * ```ts
 * import { BuildExtractFramesArgsOptions, buildExtractFramesArgs } from "@beep/ffmpeg"
 *
 * const args = buildExtractFramesArgs(BuildExtractFramesArgsOptions.make({
 *   fps: "1",
 *   outputPattern: "./frames/frame_%05d.png",
 *   videoPath: "./clip.mp4",
 * }))
 * console.log(args)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const buildExtractFramesArgs: (options: BuildExtractFramesArgsOptions) => ReadonlyArray<string> =
  BuildExtractFramesArgs.implementSync((options) => [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    options.videoPath,
    "-vf",
    `fps=${options.fps}`,
    "-start_number",
    "0",
    "-progress",
    "pipe:1",
    "-nostats",
    "-f",
    "image2",
    options.outputPattern,
  ]);

/**
 * Options for building single-frame timestamp extraction arguments.
 *
 * **Example** (Make frame-at options)
 *
 * ```ts
 * import { BuildExtractFrameAtArgsOptions } from "@beep/ffmpeg"
 *
 * const options = BuildExtractFrameAtArgsOptions.make({
 *   outputPath: "./frames/pointer-down.png",
 *   timestamp: "1.25",
 *   videoPath: "./capture.webm"
 * })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildExtractFrameAtArgsOptions extends S.Opaque<
  BuildExtractFrameAtArgsOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    maxWidth: S.OptionFromOptionalKey(VideoDimension).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("BuildExtractFrameAtArgsOptions.maxWidth", {
        description:
          "Optional maximum output width in pixels applied via a scale filter; absent, frames keep the source resolution.",
      })
    ),
    outputPath: S.String.pipe(
      $I.annoteKey("BuildExtractFrameAtArgsOptions.outputPath", {
        description: "Destination path for the single extracted PNG frame.",
      })
    ),
    timestamp: S.String.pipe(
      $I.annoteKey("BuildExtractFrameAtArgsOptions.timestamp", {
        description: "Timestamp text (seconds) passed as an input-side -ss seek before -i.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("BuildExtractFrameAtArgsOptions.videoPath", {
        description: "Input video path passed to the native ffmpeg command.",
      })
    ),
  }).pipe(
    $I.annoteSchema("BuildExtractFrameAtArgsOptions", {
      description: "Options for building single-frame timestamp extraction arguments.",
    })
  )
) {}

const BuildExtractFrameAtArgs = Fn({
  input: BuildExtractFrameAtArgsOptions,
  output: S.Array(S.String),
}).pipe(
  $I.annoteSchema("BuildExtractFrameAtArgs", {
    description: "Schema-backed builder for single-frame timestamp extraction arguments.",
  })
);

/**
 * Build ffmpeg arguments for extracting one frame at an exact timestamp.
 *
 * **Details**
 *
 * Uses input-side `-ss` before `-i` (keyframe seek plus decode-discard) with
 * `-frames:v 1`, which is both fast and frame-accurate. A `maxWidth` bound
 * adds a `scale` filter that shrinks wider sources while leaving narrower
 * ones untouched, keeping strip frames inside downstream byte budgets.
 *
 * **Example** (Build single-frame args)
 *
 * ```ts
 * import { buildExtractFrameAtArgs } from "@beep/ffmpeg"
 *
 * const args = buildExtractFrameAtArgs({
 *   outputPath: "./frames/pointer-down.png",
 *   timestamp: "1.25",
 *   videoPath: "./capture.webm",
 * })
 * console.log(args)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const buildExtractFrameAtArgs: (
  options: (typeof BuildExtractFrameAtArgsOptions)["Encoded"]
) => ReadonlyArray<string> = BuildExtractFrameAtArgs.implementSync((options) => [
  "-hide_banner",
  "-nostdin",
  "-y",
  "-ss",
  options.timestamp,
  "-i",
  options.videoPath,
  "-frames:v",
  "1",
  ...O.match(options.maxWidth, {
    onNone: (): ReadonlyArray<string> => [],
    onSome: (maxWidth): ReadonlyArray<string> => ["-vf", `scale='min(iw,${maxWidth})':-2`],
  }),
  "-update",
  "1",
  options.outputPath,
]);

const clipCodecArgs: Record<ClipCodec, ReadonlyArray<string>> = {
  h264: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart"],
  vp9: ["-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-row-mt", "1"],
};

/**
 * Options for building clip extraction arguments.
 *
 * **Example** (Make extract clip options)
 *
 * ```ts
 * import { BuildExtractClipArgsOptions } from "@beep/ffmpeg"
 * import * as O from "effect/Option"
 *
 * const options = BuildExtractClipArgsOptions.make({
 *   codec: "h264",
 *   duration: O.some("2"),
 *   outputPath: "./clips/drag.mp4",
 *   start: "1.5",
 *   videoPath: "./capture.webm"
 * })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildExtractClipArgsOptions extends S.Opaque<
  BuildExtractClipArgsOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    codec: ClipCodec.pipe(
      $I.annoteKey("BuildExtractClipArgsOptions.codec", {
        description: "Encoder preset selecting the codec argument block.",
      })
    ),
    duration: S.OptionFromOptionalKey(S.String).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      $I.annoteKey("BuildExtractClipArgsOptions.duration", {
        description: "Optional duration text (seconds) passed as output-side -t (never -to); absent, no -t is emitted.",
      })
    ),
    outputPath: S.String.pipe(
      $I.annoteKey("BuildExtractClipArgsOptions.outputPath", {
        description: "Destination path for the encoded clip.",
      })
    ),
    start: S.String.pipe(
      $I.annoteKey("BuildExtractClipArgsOptions.start", {
        description: "Start text (seconds) passed as an input-side -ss seek before -i.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("BuildExtractClipArgsOptions.videoPath", {
        description: "Input video path passed to the native ffmpeg command.",
      })
    ),
  }).pipe(
    $I.annoteSchema("BuildExtractClipArgsOptions", {
      description: "Options for building clip extraction arguments.",
    })
  )
) {}

const BuildExtractClipArgs = Fn({
  input: BuildExtractClipArgsOptions,
  output: S.Array(S.String),
}).pipe(
  $I.annoteSchema("BuildExtractClipArgs", {
    description: "Schema-backed builder for clip extraction arguments.",
  })
);

/**
 * Build ffmpeg arguments for cutting a re-encoded clip.
 *
 * **Details**
 *
 * Input-side `-ss` plus output `-t` (never `-to`) so the clip's timestamps
 * restart at zero — downstream frame extraction depends on that reset. When no
 * duration is supplied `-t` is omitted and the clip runs to the source end.
 *
 * **Example** (Build extract clip args)
 *
 * ```ts
 * import { buildExtractClipArgs } from "@beep/ffmpeg"
 *
 * const args = buildExtractClipArgs({
 *   codec: "h264",
 *   duration: "2",
 *   outputPath: "./clips/drag.mp4",
 *   start: "1.5",
 *   videoPath: "./capture.webm",
 * })
 * console.log(args)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const buildExtractClipArgs: (options: (typeof BuildExtractClipArgsOptions)["Encoded"]) => ReadonlyArray<string> =
  BuildExtractClipArgs.implementSync((options) => [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-ss",
    options.start,
    "-i",
    options.videoPath,
    ...O.match(options.duration, {
      onNone: (): ReadonlyArray<string> => [],
      onSome: (duration): ReadonlyArray<string> => ["-t", duration],
    }),
    ...clipCodecArgs[options.codec],
    options.outputPath,
  ]);

const gifDitherFragment = (dither: GifDither): string =>
  dither === GifDither.Enum.bayer ? "dither=bayer:bayer_scale=5" : `dither=${dither}`;

/**
 * Options for building palette-optimized GIF rendering arguments.
 *
 * **Example** (Make render GIF options)
 *
 * ```ts
 * import { BuildRenderGifArgsOptions } from "@beep/ffmpeg"
 *
 * const options = BuildRenderGifArgsOptions.make({
 *   dither: "bayer",
 *   duration: "2",
 *   fps: "10",
 *   outputPath: "./clips/drag.gif",
 *   start: "1.5",
 *   videoPath: "./capture.webm",
 *   width: 640
 * })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildRenderGifArgsOptions extends S.Opaque<BuildRenderGifArgsOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    dither: GifDither.pipe(
      $I.annoteKey("BuildRenderGifArgsOptions.dither", {
        description: "paletteuse dithering mode; bayer adds bayer_scale=5.",
      })
    ),
    duration: S.String.pipe(
      $I.annoteKey("BuildRenderGifArgsOptions.duration", {
        description: "Duration text (seconds) passed as output-side -t.",
      })
    ),
    fps: S.String.pipe(
      $I.annoteKey("BuildRenderGifArgsOptions.fps", {
        description: "Frame-rate text passed to ffmpeg's fps video filter.",
      })
    ),
    outputPath: S.String.pipe(
      $I.annoteKey("BuildRenderGifArgsOptions.outputPath", {
        description: "Destination path for the rendered GIF.",
      })
    ),
    start: S.String.pipe(
      $I.annoteKey("BuildRenderGifArgsOptions.start", {
        description: "Start text (seconds) passed as an input-side -ss seek before -i.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("BuildRenderGifArgsOptions.videoPath", {
        description: "Input video path passed to the native ffmpeg command.",
      })
    ),
    width: VideoDimension.pipe(
      $I.annoteKey("BuildRenderGifArgsOptions.width", {
        description: "GIF pixel width scaled with lanczos; height follows the aspect ratio.",
      })
    ),
  }).pipe(
    $I.annoteSchema("BuildRenderGifArgsOptions", {
      description: "Options for building palette-optimized GIF rendering arguments.",
    })
  )
) {}

const BuildRenderGifArgs = Fn({
  input: BuildRenderGifArgsOptions,
  output: S.Array(S.String),
}).pipe(
  $I.annoteSchema("BuildRenderGifArgs", {
    description: "Schema-backed builder for palette-optimized GIF rendering arguments.",
  })
);

/**
 * Build ffmpeg arguments for rendering a palette-optimized GIF.
 *
 * **Details**
 *
 * Single-command two-pass palette flow: `palettegen=stats_mode=diff` feeds
 * `paletteuse` inside one `-filter_complex` graph.
 *
 * **Example** (Build palette GIF args)
 *
 * ```ts
 * import { BuildRenderGifArgsOptions, buildRenderGifArgs } from "@beep/ffmpeg"
 *
 * const args = buildRenderGifArgs(BuildRenderGifArgsOptions.make({
 *   dither: "bayer",
 *   duration: "2",
 *   fps: "10",
 *   outputPath: "./clips/drag.gif",
 *   start: "1.5",
 *   videoPath: "./capture.webm",
 *   width: 640,
 * }))
 * console.log(args)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const buildRenderGifArgs: (options: BuildRenderGifArgsOptions) => ReadonlyArray<string> =
  BuildRenderGifArgs.implementSync((options) => [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-ss",
    options.start,
    "-i",
    options.videoPath,
    "-t",
    options.duration,
    "-filter_complex",
    `[0:v] fps=${options.fps},scale=${options.width}:-1:flags=lanczos,split [a][b];[a] palettegen=stats_mode=diff [p];[b][p] paletteuse=${gifDitherFragment(options.dither)}`,
    "-f",
    "gif",
    options.outputPath,
  ]);

/**
 * Options for building contact-sheet rendering arguments.
 *
 * **Example** (Make contact sheet options)
 *
 * ```ts
 * import { BuildRenderContactSheetArgsOptions } from "@beep/ffmpeg"
 *
 * const options = BuildRenderContactSheetArgsOptions.make({
 *   columns: 4,
 *   fps: "8",
 *   outputPath: "./sheets/capture.jpg",
 *   quality: 5,
 *   rows: 4,
 *   tileWidth: 320,
 *   videoPath: "./capture.webm"
 * })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildRenderContactSheetArgsOptions extends S.Opaque<
  BuildRenderContactSheetArgsOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    columns: TileCount.pipe(
      $I.annoteKey("BuildRenderContactSheetArgsOptions.columns", {
        description: "Number of tile columns in the sheet grid.",
      })
    ),
    fps: S.String.pipe(
      $I.annoteKey("BuildRenderContactSheetArgsOptions.fps", {
        description: "Frame-rate text (cols*rows spread across the duration) for the fps filter.",
      })
    ),
    outputPath: S.String.pipe(
      $I.annoteKey("BuildRenderContactSheetArgsOptions.outputPath", {
        description: "Destination path for the rendered sheet.",
      })
    ),
    quality: JpegQuality.pipe(
      $I.annoteKey("BuildRenderContactSheetArgsOptions.quality", {
        description: "JPEG quantizer passed as -q:v.",
      })
    ),
    rows: TileCount.pipe(
      $I.annoteKey("BuildRenderContactSheetArgsOptions.rows", {
        description: "Number of tile rows in the sheet grid.",
      })
    ),
    tileWidth: VideoDimension.pipe(
      $I.annoteKey("BuildRenderContactSheetArgsOptions.tileWidth", {
        description: "Pixel width of each tile; height follows the aspect ratio.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("BuildRenderContactSheetArgsOptions.videoPath", {
        description: "Input video path passed to the native ffmpeg command.",
      })
    ),
  }).pipe(
    $I.annoteSchema("BuildRenderContactSheetArgsOptions", {
      description: "Options for building contact-sheet rendering arguments.",
    })
  )
) {}

const BuildRenderContactSheetArgs = Fn({
  input: BuildRenderContactSheetArgsOptions,
  output: S.Array(S.String),
}).pipe(
  $I.annoteSchema("BuildRenderContactSheetArgs", {
    description: "Schema-backed builder for contact-sheet rendering arguments.",
  })
);

/**
 * Build ffmpeg arguments for rendering a tiled contact sheet.
 *
 * **Example** (Build contact sheet args)
 *
 * ```ts
 * import { BuildRenderContactSheetArgsOptions, buildRenderContactSheetArgs } from "@beep/ffmpeg"
 *
 * const args = buildRenderContactSheetArgs(BuildRenderContactSheetArgsOptions.make({
 *   columns: 4,
 *   fps: "8",
 *   outputPath: "./sheets/capture.jpg",
 *   quality: 5,
 *   rows: 4,
 *   tileWidth: 320,
 *   videoPath: "./capture.webm",
 * }))
 * console.log(args)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const buildRenderContactSheetArgs: (options: BuildRenderContactSheetArgsOptions) => ReadonlyArray<string> =
  BuildRenderContactSheetArgs.implementSync((options) => [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    options.videoPath,
    "-vf",
    `fps=${options.fps},scale=${options.tileWidth}:-1,tile=${options.columns}x${options.rows}`,
    "-frames:v",
    "1",
    "-q:v",
    `${options.quality}`,
    options.outputPath,
  ]);

/**
 * Options for building container metadata remux arguments.
 *
 * **Example** (Make metadata remux options)
 *
 * ```ts
 * import { BuildWriteContainerMetadataArgsOptions, MetadataPair } from "@beep/ffmpeg"
 *
 * const options = BuildWriteContainerMetadataArgsOptions.make({
 *   metadata: [MetadataPair.make({ key: "BEEP_QA_SESSION_ID", value: "session-42" })],
 *   outputPath: "./tagged/capture.webm",
 *   useMetadataTags: false,
 *   videoPath: "./capture.webm"
 * })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildWriteContainerMetadataArgsOptions extends S.Opaque<
  BuildWriteContainerMetadataArgsOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    metadata: S.Array(MetadataPair).pipe(
      $I.annoteKey("BuildWriteContainerMetadataArgsOptions.metadata", {
        description: "Container metadata assignments emitted as -metadata KEY=value pairs.",
      })
    ),
    outputPath: S.String.pipe(
      $I.annoteKey("BuildWriteContainerMetadataArgsOptions.outputPath", {
        description: "Destination path for the remuxed video.",
      })
    ),
    useMetadataTags: S.Boolean.pipe(
      $I.annoteKey("BuildWriteContainerMetadataArgsOptions.useMetadataTags", {
        description: "Whether to append -movflags use_metadata_tags (mp4-family outputs only).",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("BuildWriteContainerMetadataArgsOptions.videoPath", {
        description: "Input video path passed to the native ffmpeg command.",
      })
    ),
  }).pipe(
    $I.annoteSchema("BuildWriteContainerMetadataArgsOptions", {
      description: "Options for building container metadata remux arguments.",
    })
  )
) {}

const BuildWriteContainerMetadataArgs = Fn({
  input: BuildWriteContainerMetadataArgsOptions,
  output: S.Array(S.String),
}).pipe(
  $I.annoteSchema("BuildWriteContainerMetadataArgs", {
    description: "Schema-backed builder for container metadata remux arguments.",
  })
);

/**
 * Build ffmpeg arguments for a metadata-writing remux.
 *
 * **Details**
 *
 * Streams are copied verbatim (`-map 0 -c copy`); each pair becomes a single
 * `-metadata KEY=value` argv element so values never pass through a shell.
 *
 * **Example** (Build metadata remux args)
 *
 * ```ts
 * import { BuildWriteContainerMetadataArgsOptions, buildWriteContainerMetadataArgs, MetadataPair } from "@beep/ffmpeg"
 *
 * const args = buildWriteContainerMetadataArgs(BuildWriteContainerMetadataArgsOptions.make({
 *   metadata: [MetadataPair.make({ key: "BEEP_QA_SESSION_ID", value: "session-42" })],
 *   outputPath: "./tagged/capture.webm",
 *   useMetadataTags: false,
 *   videoPath: "./capture.webm",
 * }))
 * console.log(args)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const buildWriteContainerMetadataArgs: (
  options: BuildWriteContainerMetadataArgsOptions
) => ReadonlyArray<string> = BuildWriteContainerMetadataArgs.implementSync((options) => [
  "-hide_banner",
  "-nostdin",
  "-y",
  "-i",
  options.videoPath,
  "-map",
  "0",
  "-c",
  "copy",
  ...A.flatMap(options.metadata, (pair) => ["-metadata", `${pair.key}=${pair.value}`]),
  ...(options.useMetadataTags ? ["-movflags", "use_metadata_tags"] : []),
  options.outputPath,
]);

/**
 * Options for building region luminance probe arguments.
 *
 * **Example** (Make luminance probe options)
 *
 * ```ts
 * import { BuildProbeRegionLuminanceArgsOptions } from "@beep/ffmpeg"
 *
 * const options = BuildProbeRegionLuminanceArgsOptions.make({
 *   height: 128,
 *   videoPath: "./capture.webm",
 *   width: 128,
 *   x: 0,
 *   y: 0
 * })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BuildProbeRegionLuminanceArgsOptions extends S.Opaque<
  BuildProbeRegionLuminanceArgsOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    height: VideoDimension.pipe(
      $I.annoteKey("BuildProbeRegionLuminanceArgsOptions.height", {
        description: "Crop region height in pixels.",
      })
    ),
    videoPath: S.String.pipe(
      $I.annoteKey("BuildProbeRegionLuminanceArgsOptions.videoPath", {
        description: "Input video path passed to the native ffmpeg command.",
      })
    ),
    width: VideoDimension.pipe(
      $I.annoteKey("BuildProbeRegionLuminanceArgsOptions.width", {
        description: "Crop region width in pixels.",
      })
    ),
    x: S.Int.pipe(
      $I.annoteKey("BuildProbeRegionLuminanceArgsOptions.x", {
        description: "Crop region left offset in pixels.",
      })
    ),
    y: S.Int.pipe(
      $I.annoteKey("BuildProbeRegionLuminanceArgsOptions.y", {
        description: "Crop region top offset in pixels.",
      })
    ),
  }).pipe(
    $I.annoteSchema("BuildProbeRegionLuminanceArgsOptions", {
      description: "Options for building region luminance probe arguments.",
    })
  )
) {}

const BuildProbeRegionLuminanceArgs = Fn({
  input: BuildProbeRegionLuminanceArgsOptions,
  output: S.Array(S.String),
}).pipe(
  $I.annoteSchema("BuildProbeRegionLuminanceArgs", {
    description: "Schema-backed builder for region luminance probe arguments.",
  })
);

/**
 * Build ffmpeg arguments for the signalstats region luminance probe.
 *
 * **Details**
 *
 * Crops the region, runs `signalstats`, and prints per-frame
 * `lavfi.signalstats.YAVG` metadata to stdout while discarding video output
 * through the null muxer.
 *
 * **Example** (Build luminance probe args)
 *
 * ```ts
 * import { BuildProbeRegionLuminanceArgsOptions, buildProbeRegionLuminanceArgs } from "@beep/ffmpeg"
 *
 * const args = buildProbeRegionLuminanceArgs(BuildProbeRegionLuminanceArgsOptions.make({
 *   height: 128,
 *   videoPath: "./capture.webm",
 *   width: 128,
 *   x: 0,
 *   y: 0,
 * }))
 * console.log(args)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const buildProbeRegionLuminanceArgs: (options: BuildProbeRegionLuminanceArgsOptions) => ReadonlyArray<string> =
  BuildProbeRegionLuminanceArgs.implementSync((options) => [
    "-hide_banner",
    "-nostdin",
    "-nostats",
    "-i",
    options.videoPath,
    "-vf",
    `crop=${options.width}:${options.height}:${options.x}:${options.y},signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-`,
    "-f",
    "null",
    "-",
  ]);
