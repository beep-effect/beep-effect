/**
 * Native FFmpeg process driver service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import { $FfmpegId } from "@beep/identity/packages";
import { Fn, SchemaUtils } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A, O, Str, thunkEmptyStr } from "@beep/utils";
import { Context, Effect, FileSystem, HashSet, Layer, Number as N, Order, Path, pipe, Ref, Stream } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import {
  ClipCodec,
  ExtractClipRequest,
  ExtractClipResult,
  ExtractFrameAtRequest,
  ExtractFramesAtManifest,
  ExtractFramesAtManifestOptions,
  ExtractFramesAtRequest,
  ExtractFramesAtResult,
  FileSizeBytes,
  GifDither,
  JpegQuality,
  LumaValue,
  LuminanceSample,
  MetadataPair,
  ProbeRegionLuminanceRequest,
  ProbeRegionLuminanceResult,
  RenderContactSheetRequest,
  RenderContactSheetResult,
  RenderGifRequest,
  RenderGifResult,
  TileCount,
  TimestampedFrame,
  WriteContainerMetadataRequest,
  WriteContainerMetadataResult,
} from "./FFmpeg.capture.models.ts";
import { FFmpegError, ProcessExitCode } from "./FFmpeg.errors.ts";
import {
  ExtractedFrame,
  ExtractFramesManifest,
  ExtractFramesManifestOptions,
  ExtractFramesManifestSummary,
  ExtractFramesRequest,
  ExtractFramesResult,
  FFmpegCompletedEvent,
  FFmpegConfig,
  FFmpegConfigInput,
  FFmpegProgressEvent,
  FFmpegProgressPercent,
  FFmpegStartedEvent,
  FrameCount,
  FrameFilenamePadding,
  FrameIndex,
  NonNegativeSeconds,
  PositiveFrameRate,
  ProbeVideoRequest,
  SafeFramePrefix,
  VideoDimension,
  VideoProbe,
} from "./FFmpeg.models.ts";
import type * as PlatformError from "effect/PlatformError";
import type { FFmpegEvent } from "./FFmpeg.models.ts";

const $I = $FfmpegId.create("FFmpeg.service");
const encodeJson = UnknownFromJsonString.encodeUnknownEffect;
const NumberOrString = S.Union([S.Finite, S.String]);
type FFmpegConfigInputOptions = (typeof FFmpegConfigInput)["~type.make.in"];

class FfprobeStream extends S.Class<FfprobeStream>($I`FfprobeStream`)(
  {
    avg_frame_rate: S.OptionFromOptionalKey(NumberOrString).pipe(SchemaUtils.withNoneDefault),
    duration: S.OptionFromOptionalKey(NumberOrString).pipe(SchemaUtils.withNoneDefault),
    height: S.OptionFromOptionalKey(VideoDimension).pipe(SchemaUtils.withNoneDefault),
    nb_frames: S.OptionFromOptionalKey(NumberOrString).pipe(SchemaUtils.withNoneDefault),
    r_frame_rate: S.OptionFromOptionalKey(NumberOrString).pipe(SchemaUtils.withNoneDefault),
    start_time: S.OptionFromOptionalKey(NumberOrString).pipe(SchemaUtils.withNoneDefault),
    width: S.OptionFromOptionalKey(VideoDimension).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("FfprobeStream", {
    description: "Internal ffprobe stream payload.",
  })
) {}

class FfprobeFormat extends S.Class<FfprobeFormat>($I`FfprobeFormat`)(
  {
    duration: S.OptionFromOptionalKey(NumberOrString).pipe(SchemaUtils.withNoneDefault),
    start_time: S.OptionFromOptionalKey(NumberOrString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("FfprobeFormat", {
    description: "Internal ffprobe format payload.",
  })
) {}

class FfprobeOutput extends S.Class<FfprobeOutput>($I`FfprobeOutput`)(
  {
    format: S.OptionFromOptionalKey(FfprobeFormat).pipe(SchemaUtils.withNoneDefault),
    streams: S.Array(FfprobeStream),
  },
  $I.annote("FfprobeOutput", {
    description: "Internal ffprobe JSON payload.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(FfprobeOutput));
}

/**
 * Effectful sink for structured FFmpeg events.
 *
 * **Example** (Void effect sink)
 *
 * ```ts
 * import type { FFmpegEventSink } from "@beep/ffmpeg"
 * import { Effect } from "effect"
 *
 * const sink: FFmpegEventSink = () => Effect.void
 * console.log(sink)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export type FFmpegEventSink = (event: FFmpegEvent) => Effect.Effect<void>;

/**
 * Runtime shape exposed by the {@link FFmpeg} service.
 *
 * **Example** (Stub service shape)
 *
 * ```ts
 * import type { FFmpegShape } from "@beep/ffmpeg"
 * import { Effect } from "effect"
 *
 * const service: FFmpegShape = {
 *   extractClip: () => Effect.die("not implemented"),
 *   extractFrameAt: () => Effect.die("not implemented"),
 *   extractFrames: () => Effect.die("not implemented"),
 *   extractFramesAt: () => Effect.die("not implemented"),
 *   probeRegionLuminance: () => Effect.die("not implemented"),
 *   probeVideo: () => Effect.die("not implemented"),
 *   renderContactSheet: () => Effect.die("not implemented"),
 *   renderGif: () => Effect.die("not implemented"),
 *   writeContainerMetadata: () => Effect.die("not implemented")
 * }
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface FFmpegShape {
  readonly extractClip: (request: ExtractClipRequest) => Effect.Effect<ExtractClipResult, FFmpegError>;
  readonly extractFrameAt: (request: ExtractFrameAtRequest) => Effect.Effect<TimestampedFrame, FFmpegError>;
  readonly extractFrames: (
    request: ExtractFramesRequest,
    onEvent?: FFmpegEventSink | undefined
  ) => Effect.Effect<ExtractFramesResult, FFmpegError>;
  readonly extractFramesAt: (request: ExtractFramesAtRequest) => Effect.Effect<ExtractFramesAtResult, FFmpegError>;
  readonly probeRegionLuminance: (
    request: ProbeRegionLuminanceRequest
  ) => Effect.Effect<ProbeRegionLuminanceResult, FFmpegError>;
  readonly probeVideo: (request: ProbeVideoRequest) => Effect.Effect<VideoProbe, FFmpegError>;
  readonly renderContactSheet: (
    request: RenderContactSheetRequest
  ) => Effect.Effect<RenderContactSheetResult, FFmpegError>;
  readonly renderGif: (request: RenderGifRequest) => Effect.Effect<RenderGifResult, FFmpegError>;
  readonly writeContainerMetadata: (
    request: WriteContainerMetadataRequest
  ) => Effect.Effect<WriteContainerMetadataResult, FFmpegError>;
}

class ProcessResult extends S.Class<ProcessResult>($I`ProcessResult`)(
  {
    exitCode: ProcessExitCode,
    stderr: S.String,
    stdout: S.String,
  },
  $I.annote("ProcessResult", {
    description: "Result of a process execution.",
  })
) {}

class ExtractContext extends S.Class<ExtractContext>($I`ExtractContext`)(
  {
    expectedFrameCount: FrameCount,
    fpsText: S.String,
    manifestPath: S.String,
    outDir: S.String,
    padding: FrameFilenamePadding,
    prefix: SafeFramePrefix,
    probe: VideoProbe,
    request: ExtractFramesRequest,
    videoPath: S.String,
  },
  $I.annote("ExtractContext", {
    description: "Context for extracting frames from a video.",
  })
) {}

class TempFrame extends S.Class<TempFrame>($I`TempFrame`)(
  {
    index: FrameIndex,
    path: S.String,
  },
  $I.annote("TempFrame", {
    description: "Temporary frame information.",
  })
) {}

/**
 * Planned file-system move for a staged extracted frame.
 *
 * **Example** (Make planned frame commit)
 *
 * ```ts
 * import { PlannedFrameCommit } from "@beep/ffmpeg"
 *
 * const commit = PlannedFrameCommit.make({
 *   fileName: "frame-000001.png",
 *   index: 1,
 *   relativePath: "frame-000001.png",
 *   sourcePath: "/tmp/ffmpeg/frame-000001.png",
 *   targetPath: "./frames/frame-000001.png"
 * })
 * console.log(commit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlannedFrameCommit extends S.Class<PlannedFrameCommit>($I`PlannedFrameCommit`)(
  {
    fileName: S.String,
    index: FrameIndex,
    relativePath: S.String,
    sourcePath: S.String,
    targetPath: S.String,
  },
  $I.annote("PlannedFrameCommit", {
    description: "Planned frame commit information.",
  })
) {}

/**
 * Buffered ffmpeg progress output accumulated while parsing progress blocks.
 *
 * **Example** (Make progress state)
 *
 * ```ts
 * import { ProgressState } from "@beep/ffmpeg"
 *
 * const state = ProgressState.make({
 *   block: { frame: "1", progress: "continue" },
 *   buffer: "",
 *   stdout: "frame=1\nprogress=continue\n"
 * })
 * console.log(state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProgressState extends S.Class<ProgressState>($I`ProgressState`)(
  {
    block: S.Record(S.String, S.String),
    buffer: S.String,
    stdout: S.String,
  },
  $I.annote("ProgressState", {
    description: "Progress state information during frame extraction.",
  })
) {}

const defaultConfig = (input?: FFmpegConfigInputOptions | undefined): FFmpegConfig =>
  FFmpegConfig.make(FFmpegConfigInput.make(input ?? {}));

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- ffmpeg owns stream-to-text collection so output errors remain driver-local
const collectText = <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<string, E> =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(thunkEmptyStr, (acc, chunk) => `${acc}${chunk}`)
  );

const parseNumber = (value: unknown): O.Option<number> => {
  if (P.isNumber(value)) {
    return Number.isFinite(value) ? O.some(value) : O.none();
  }
  if (P.isString(value)) {
    return pipe(
      N.parse(value),
      O.filter((number) => Number.isFinite(number))
    );
  }
  return O.none();
};

const rationalToNumber = (value: unknown): O.Option<number> => {
  if (!P.isString(value) || !Str.includes("/")(value)) {
    return parseNumber(value);
  }

  const parts = Str.split("/")(value);
  const numerator = pipe(A.get(parts, 0), O.flatMap(parseNumber));
  const denominator = pipe(A.get(parts, 1), O.flatMap(parseNumber));

  return O.flatMap(numerator, (left) =>
    O.flatMap(denominator, (right) => (right === 0 ? O.none() : O.some(left / right)))
  );
};

const parseNonNegativeSeconds = (value: unknown): O.Option<NonNegativeSeconds> =>
  pipe(parseNumber(value), O.flatMap(NonNegativeSeconds.decodeUnknownOption));

const parsePositiveFrameRate = (value: unknown): O.Option<PositiveFrameRate> =>
  pipe(rationalToNumber(value), O.flatMap(PositiveFrameRate.decodeUnknownOption));

const parseFrameCount = (value: unknown): O.Option<FrameCount> =>
  pipe(parseNumber(value), O.flatMap(FrameCount.decodeUnknownOption));

const probeFromOutput = (videoPath: string, output: FfprobeOutput): VideoProbe => {
  const stream = A.get(output.streams, 0);
  const formatDuration = pipe(
    output.format,
    O.flatMap((format) => format.duration),
    O.flatMap(parseNonNegativeSeconds)
  );
  const width = pipe(
    stream,
    O.flatMap((value) => value.width)
  );
  const height = pipe(
    stream,
    O.flatMap((value) => value.height)
  );
  const streamDuration = pipe(
    stream,
    O.flatMap((value) => value.duration),
    O.flatMap(parseNonNegativeSeconds)
  );
  const durationSeconds = O.orElse(streamDuration, () => formatDuration);
  const fps = pipe(
    stream,
    O.flatMap((value) => O.orElse(value.avg_frame_rate, () => value.r_frame_rate)),
    O.flatMap(parsePositiveFrameRate)
  );
  const frameCount = pipe(
    stream,
    O.flatMap((value) => value.nb_frames),
    O.flatMap(parseFrameCount)
  );
  const rFrameRate = pipe(
    stream,
    O.flatMap((value) => value.r_frame_rate),
    O.flatMap(parsePositiveFrameRate)
  );
  const streamStartTime = pipe(
    stream,
    O.flatMap((value) => value.start_time),
    O.flatMap(parseNumber)
  );
  const formatStartTime = pipe(
    output.format,
    O.flatMap((format) => format.start_time),
    O.flatMap(parseNumber)
  );
  const startTimeSeconds = O.orElse(streamStartTime, () => formatStartTime);

  return VideoProbe.make({
    videoPath,
    durationSeconds,
    fps,
    frameCount,
    height,
    rFrameRate,
    startTimeSeconds,
    width,
  });
};

const expectedFrameCount = (probe: VideoProbe, fps: number): number =>
  Math.max(
    0,
    Math.ceil(
      pipe(
        probe.durationSeconds,
        O.getOrElse(() => 0)
      ) * fps
    )
  );

const digitCount = (value: number): number => `${Math.max(0, Math.trunc(value))}`.length;

const paddingForCount = (count: number): FrameFilenamePadding =>
  FrameFilenamePadding.make(Math.max(5, digitCount(Math.max(0, count - 1))));

const formatFps = (fps: number): string => `${fps}`;

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
export class FormatFrameFileNameOptions extends S.Class<FormatFrameFileNameOptions>($I`FormatFrameFileNameOptions`)(
  {
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
  },
  $I.annote("FormatFrameFileNameOptions", {
    description: "Options for formatting one generated PNG frame filename.",
  })
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
 * import { formatFrameFileName } from "@beep/ffmpeg"
 *
 * const name = formatFrameFileName({ index: 0, padding: 5, prefix: "clip_frame" })
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
export class BuildExtractFramesArgsOptions extends S.Class<BuildExtractFramesArgsOptions>(
  $I`BuildExtractFramesArgsOptions`
)(
  {
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
  },
  $I.annote("BuildExtractFramesArgsOptions", {
    description: "Options for building native ffmpeg frame extraction arguments.",
  })
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
 * import { buildExtractFramesArgs } from "@beep/ffmpeg"
 *
 * const args = buildExtractFramesArgs({
 *   fps: "1",
 *   outputPattern: "./frames/frame_%05d.png",
 *   videoPath: "./clip.mp4",
 * })
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
export class BuildExtractFrameAtArgsOptions extends S.Class<BuildExtractFrameAtArgsOptions>(
  $I`BuildExtractFrameAtArgsOptions`
)(
  {
    maxWidth: S.OptionFromOptionalKey(VideoDimension).pipe(
      SchemaUtils.withNoneDefault,
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
  },
  $I.annote("BuildExtractFrameAtArgsOptions", {
    description: "Options for building single-frame timestamp extraction arguments.",
  })
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
export class BuildExtractClipArgsOptions extends S.Class<BuildExtractClipArgsOptions>($I`BuildExtractClipArgsOptions`)(
  {
    codec: ClipCodec.pipe(
      $I.annoteKey("BuildExtractClipArgsOptions.codec", {
        description: "Encoder preset selecting the codec argument block.",
      })
    ),
    duration: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
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
  },
  $I.annote("BuildExtractClipArgsOptions", {
    description: "Options for building clip extraction arguments.",
  })
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
export class BuildRenderGifArgsOptions extends S.Class<BuildRenderGifArgsOptions>($I`BuildRenderGifArgsOptions`)(
  {
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
  },
  $I.annote("BuildRenderGifArgsOptions", {
    description: "Options for building palette-optimized GIF rendering arguments.",
  })
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
 * import { buildRenderGifArgs } from "@beep/ffmpeg"
 *
 * const args = buildRenderGifArgs({
 *   dither: "bayer",
 *   duration: "2",
 *   fps: "10",
 *   outputPath: "./clips/drag.gif",
 *   start: "1.5",
 *   videoPath: "./capture.webm",
 *   width: 640,
 * })
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
export class BuildRenderContactSheetArgsOptions extends S.Class<BuildRenderContactSheetArgsOptions>(
  $I`BuildRenderContactSheetArgsOptions`
)(
  {
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
  },
  $I.annote("BuildRenderContactSheetArgsOptions", {
    description: "Options for building contact-sheet rendering arguments.",
  })
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
 * import { buildRenderContactSheetArgs } from "@beep/ffmpeg"
 *
 * const args = buildRenderContactSheetArgs({
 *   columns: 4,
 *   fps: "8",
 *   outputPath: "./sheets/capture.jpg",
 *   quality: 5,
 *   rows: 4,
 *   tileWidth: 320,
 *   videoPath: "./capture.webm",
 * })
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
export class BuildWriteContainerMetadataArgsOptions extends S.Class<BuildWriteContainerMetadataArgsOptions>(
  $I`BuildWriteContainerMetadataArgsOptions`
)(
  {
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
  },
  $I.annote("BuildWriteContainerMetadataArgsOptions", {
    description: "Options for building container metadata remux arguments.",
  })
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
 * import { buildWriteContainerMetadataArgs, MetadataPair } from "@beep/ffmpeg"
 *
 * const args = buildWriteContainerMetadataArgs({
 *   metadata: [MetadataPair.make({ key: "BEEP_QA_SESSION_ID", value: "session-42" })],
 *   outputPath: "./tagged/capture.webm",
 *   useMetadataTags: false,
 *   videoPath: "./capture.webm",
 * })
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
export class BuildProbeRegionLuminanceArgsOptions extends S.Class<BuildProbeRegionLuminanceArgsOptions>(
  $I`BuildProbeRegionLuminanceArgsOptions`
)(
  {
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
  },
  $I.annote("BuildProbeRegionLuminanceArgsOptions", {
    description: "Options for building region luminance probe arguments.",
  })
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
 * import { buildProbeRegionLuminanceArgs } from "@beep/ffmpeg"
 *
 * const args = buildProbeRegionLuminanceArgs({
 *   height: 128,
 *   videoPath: "./capture.webm",
 *   width: 128,
 *   x: 0,
 *   y: 0,
 * })
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

const runProcess = (
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
  command: ChildProcess.Command,
  operation: string,
  message: string
): Effect.Effect<ProcessResult, FFmpegError> =>
  Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(command);
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [collectText(handle.stdout), collectText(handle.stderr), handle.exitCode],
        { concurrency: "unbounded" }
      );
      return { exitCode, stderr, stdout };
    })
  ).pipe(Effect.mapError((cause) => FFmpegError.fromUnknown(operation, message, { cause })));

const parseProgressEvent = (
  block: Readonly<Record<string, string>>,
  expected: number,
  progress: string
): O.Option<FFmpegProgressEvent> => {
  const frameCount = pipe(O.fromUndefinedOr(block.frame), O.flatMap(parseFrameCount));
  if (O.isNone(frameCount)) {
    return O.none();
  }

  const outTimeSeconds = pipe(
    O.fromUndefinedOr(block.out_time_ms ?? block.out_time_us),
    O.flatMap(parseNumber),
    O.map((value) => value / 1_000_000),
    O.flatMap(NonNegativeSeconds.decodeUnknownOption)
  );
  const percent = FFmpegProgressPercent.make(
    expected <= 0 ? 0 : Math.min(100, Math.max(0, (frameCount.value / expected) * 100))
  );

  return O.some(
    FFmpegProgressEvent.make({
      frameCount: frameCount.value,
      kind: "progress",
      outTimeSeconds,
      percent,
      progress,
      speed: O.fromUndefinedOr(block.speed),
    })
  );
};

const consumeProgressLine = (
  state: ProgressState,
  line: string,
  expected: number
): readonly [ProgressState, O.Option<FFmpegProgressEvent>] => {
  const separatorIndex = Str.indexOf("=")(line);
  if (O.isNone(separatorIndex) || separatorIndex.value < 1) {
    return [state, O.none()];
  }

  const key = Str.slice(0, separatorIndex.value)(line);
  const value = Str.slice(separatorIndex.value + 1)(line);

  if (key === "progress") {
    return [
      {
        ...state,
        block: {},
      },
      parseProgressEvent(state.block, expected, value),
    ];
  }

  return [
    {
      ...state,
      block: R.set(state.block, key, value),
    },
    O.none(),
  ];
};

const emitEvent = (sink: FFmpegEventSink | undefined, event: FFmpegEvent): Effect.Effect<void> =>
  sink === undefined ? Effect.void : sink(event);

const collectProgressText = Effect.fn("FFmpeg.collectProgressText")(function* (
  stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>,
  expected: number,
  sink: FFmpegEventSink | undefined
): Effect.fn.Return<string, PlatformError.PlatformError> {
  const state = yield* Ref.make<ProgressState>({
    block: {},
    buffer: "",
    stdout: "",
  });

  yield* stream.pipe(
    Stream.decodeText(),
    Stream.runForEach(
      Effect.fnUntraced(function* (chunk) {
        const current = yield* Ref.get(state);
        const combined = `${current.buffer}${chunk}`;
        const hasTrailingLineBreak = Str.endsWith("\n")(combined);
        const lines = Str.split(/\r?\n/)(combined);
        const completeLines = hasTrailingLineBreak ? lines : A.dropRight(lines, 1);
        const buffer = hasTrailingLineBreak ? "" : pipe(A.last(lines), O.getOrElse(thunkEmptyStr));
        let nextState: ProgressState = {
          ...current,
          buffer,
          stdout: `${current.stdout}${chunk}`,
        };

        for (const line of completeLines) {
          const [updated, event] = consumeProgressLine(nextState, line, expected);
          nextState = updated;
          if (O.isSome(event)) {
            yield* emitEvent(sink, event.value);
          }
        }

        yield* Ref.set(state, nextState);
      })
    )
  );

  return (yield* Ref.get(state)).stdout;
});

const runExtractProcess = (
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
  command: ChildProcess.Command,
  expected: number,
  sink: FFmpegEventSink | undefined
): Effect.Effect<ProcessResult, FFmpegError> =>
  Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(command);
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [collectProgressText(handle.stdout, expected, sink), collectText(handle.stderr), handle.exitCode],
        { concurrency: "unbounded" }
      );
      return { exitCode, stderr, stdout };
    })
  ).pipe(
    Effect.mapError((cause) =>
      FFmpegError.fromUnknown("extractFrames", "Failed to run ffmpeg. Install ffmpeg or configure ffmpegPath.", {
        cause,
      })
    )
  );

const ensureFile = Effect.fn("FFmpeg.ensureFile")(function* (
  fs: FileSystem.FileSystem,
  filePath: string,
  label: string,
  operation = "extractFrames"
): Effect.fn.Return<void, FFmpegError> {
  const stat = yield* fs
    .stat(filePath)
    .pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown(operation, `Failed to stat ${label}: "${filePath}"`, { cause })
      )
    );
  if (stat.type !== "File") {
    return yield* FFmpegError.make({
      message: `Expected ${label} to be a file: "${filePath}"`,
      operation,
    });
  }
});

const ensureDirectory = Effect.fn("FFmpeg.ensureDirectory")(function* (
  fs: FileSystem.FileSystem,
  dirPath: string,
  label: string,
  operation = "extractFrames"
): Effect.fn.Return<void, FFmpegError> {
  const exists = yield* fs
    .exists(dirPath)
    .pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown(operation, `Failed to inspect ${label}: "${dirPath}"`, { cause })
      )
    );
  if (!exists) {
    yield* fs
      .makeDirectory(dirPath, { recursive: true })
      .pipe(
        Effect.mapError((cause) =>
          FFmpegError.fromUnknown(operation, `Failed to create ${label}: "${dirPath}"`, { cause })
        )
      );
    return;
  }

  const stat = yield* fs
    .stat(dirPath)
    .pipe(
      Effect.mapError((cause) => FFmpegError.fromUnknown(operation, `Failed to stat ${label}: "${dirPath}"`, { cause }))
    );
  if (stat.type !== "Directory") {
    return yield* FFmpegError.make({
      message: `Expected ${label} to be a directory: "${dirPath}"`,
      operation,
    });
  }
});

const preflightWritable = Effect.fn("FFmpeg.preflightWritable")(function* (
  fs: FileSystem.FileSystem,
  filePath: string,
  overwrite: boolean,
  label: string,
  operation = "extractFrames"
): Effect.fn.Return<void, FFmpegError> {
  const exists = yield* fs
    .exists(filePath)
    .pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown(operation, `Failed to inspect ${label}: "${filePath}"`, { cause })
      )
    );
  if (exists && !overwrite) {
    return yield* FFmpegError.make({
      message: `Refusing to overwrite existing ${label}: "${filePath}"`,
      operation,
    });
  }
});

const makeExtractContext = Effect.fn("FFmpeg.makeExtractContext")(function* (
  path: Path.Path,
  request: ExtractFramesRequest,
  probe: VideoProbe
) {
  const videoPath = path.resolve(request.videoPath);
  const outDir = path.resolve(request.outDir);
  const sourceExtension = path.extname(videoPath);
  const sourceStem = path.basename(videoPath, sourceExtension) || "video";
  const defaultPrefix = SafeFramePrefix.decodeUnknownSync(`${sourceStem}_frame`);
  const prefix = pipe(
    request.prefix,
    O.getOrElse(() => defaultPrefix)
  );
  const manifestPath = pipe(
    request.manifestPath,
    O.match({
      onNone: () => path.join(outDir, "extract-frames-manifest.json"),
      onSome: (value) => path.resolve(value),
    })
  );
  const count = expectedFrameCount(probe, request.fps);
  const padding = paddingForCount(count);
  const fpsText = formatFps(request.fps);

  return ExtractContext.make({
    expectedFrameCount: count,
    fpsText,
    manifestPath,
    outDir,
    padding,
    prefix,
    probe,
    request,
    videoPath,
  });
});

const readTempFrames = Effect.fn("FFmpeg.readTempFrames")(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  tempDir: string,
  prefix: string
) {
  const names = yield* fs
    .readDirectory(tempDir)
    .pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown("extractFrames", `Failed to read temporary frame directory: "${tempDir}"`, { cause })
      )
    );
  const tempPrefix = `${prefix}_`;
  let frames = A.empty<TempFrame>();

  for (const name of names) {
    if (!Str.endsWith(".png")(name) || !Str.startsWith(tempPrefix)(name)) {
      continue;
    }

    const digits = Str.slice(tempPrefix.length, -4)(name);
    const index = pipe(N.parse(digits), O.flatMap(FrameIndex.decodeUnknownOption));

    if (O.isSome(index)) {
      frames = A.append(
        frames,
        TempFrame.make({
          index: index.value,
          path: path.join(tempDir, name),
        })
      );
    }
  }

  frames = A.sort(
    frames,
    Order.mapInput(Order.Number, (frame: TempFrame) => frame.index)
  );

  if (A.length(frames) === 0) {
    return yield* FFmpegError.make({
      message: "ffmpeg completed without producing any PNG frames.",
      operation: "extractFrames",
    });
  }

  return frames;
});

const makeManifest = (context: ExtractContext, frames: ReadonlyArray<ExtractedFrame>): ExtractFramesManifest =>
  ExtractFramesManifest.make({
    frames,
    manifestPath: context.manifestPath,
    options: ExtractFramesManifestOptions.make({
      fps: context.request.fps,
      overwrite: context.request.overwrite,
      prefix: context.prefix,
    }),
    outputDirectory: context.outDir,
    probe: context.probe,
    schemaVersion: "beep.ffmpeg.extract-frames.v1",
    sourceVideo: context.videoPath,
    summary: ExtractFramesManifestSummary.make({
      frameCount: A.length(frames),
    }),
  });

const renderManifest = Effect.fn("FFmpeg.renderManifest")(function* (
  manifestPath: string,
  manifest: ExtractFramesManifest
) {
  const encoded = yield* ExtractFramesManifest.encodeEffect(manifest).pipe(
    Effect.mapError((cause) =>
      // shared driver boundary idiom; no in-family home; future foundation capability candidate.
      // fallow-ignore-next-line code-duplication -- shared driver boundary idiom; no in-family home, future foundation capability candidate
      FFmpegError.fromUnknown("extractFrames", `Failed to encode extract-frames manifest: "${manifestPath}"`, { cause })
    )
  );

  return yield* encodeJson(encoded).pipe(
    Effect.map((json) => `${json}\n`),
    Effect.mapError((cause) =>
      FFmpegError.fromUnknown("extractFrames", `Failed to render extract-frames manifest: "${manifestPath}"`, {
        cause,
      })
    )
  );
});

const commitFrames = Effect.fn("FFmpeg.commitFrames")(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  context: ExtractContext,
  tempDir: string,
  tempFrames: ReadonlyArray<TempFrame>
) {
  const finalPadding = paddingForCount(Math.max(context.expectedFrameCount, A.length(tempFrames)));
  let planned = A.empty<PlannedFrameCommit>();
  let committed = A.empty<ExtractedFrame>();

  for (const tempFrame of tempFrames) {
    const position = A.length(planned);
    const fileName = formatFrameFileName({ index: position, padding: finalPadding, prefix: context.prefix });
    const targetPath = path.join(context.outDir, fileName);
    planned = A.append(
      planned,
      PlannedFrameCommit.make({
        fileName,
        index: position,
        relativePath: path.relative(context.outDir, targetPath),
        sourcePath: tempFrame.path,
        targetPath,
      })
    );
  }

  for (const frame of planned) {
    yield* preflightWritable(fs, frame.targetPath, context.request.overwrite, "frame output");
  }

  for (const frame of planned) {
    if (context.request.overwrite) {
      yield* fs.remove(frame.targetPath, { force: true }).pipe(Effect.ignore);
    }
    yield* fs
      .rename(frame.sourcePath, frame.targetPath)
      .pipe(
        Effect.mapError((cause) =>
          FFmpegError.fromUnknown("extractFrames", `Failed to commit frame output: "${frame.targetPath}"`, { cause })
        )
      );
    committed = A.append(
      committed,
      ExtractedFrame.make({
        fileName: frame.fileName,
        index: frame.index,
        path: frame.targetPath,
        relativePath: frame.relativePath,
      })
    );
  }

  const manifest = makeManifest(context, committed);
  const manifestContent = yield* renderManifest(context.manifestPath, manifest);
  const tempManifestPath = path.join(tempDir, "extract-frames-manifest.json");
  yield* fs
    .writeFileString(tempManifestPath, manifestContent)
    .pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown("extractFrames", `Failed to write temporary manifest: "${tempManifestPath}"`, { cause })
      )
    );
  // shared driver boundary idiom; no in-family home; future foundation capability candidate.
  // fallow-ignore-next-line code-duplication -- shared driver boundary idiom; no in-family home, future foundation capability candidate
  if (context.request.overwrite) {
    yield* fs.remove(context.manifestPath, { force: true }).pipe(Effect.ignore);
  }
  yield* fs
    .rename(tempManifestPath, context.manifestPath)
    .pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown("extractFrames", `Failed to commit manifest: "${context.manifestPath}"`, { cause })
      )
    );

  return committed;
});

const frameLinePattern = /^frame:(\d+)\s+pts:\S+\s+pts_time:([-+.\dEe]+)/;
const yavgLinePattern = /^lavfi\.signalstats\.YAVG=([-+.\dEe]+)/;

type PendingLuminanceFrame = {
  readonly frameIndex: FrameIndex;
  readonly ptsTimeSeconds: NonNegativeSeconds;
};

const pendingFrameFromMatch = (match: RegExpMatchArray): O.Option<PendingLuminanceFrame> =>
  O.flatMap(
    pipe(O.fromUndefinedOr(match[1]), O.flatMap(parseNumber), O.flatMap(FrameIndex.decodeUnknownOption)),
    (frameIndex) =>
      pipe(
        O.fromUndefinedOr(match[2]),
        O.flatMap(parseNumber),
        O.flatMap(NonNegativeSeconds.decodeUnknownOption),
        O.map((ptsTimeSeconds) => ({ frameIndex, ptsTimeSeconds }))
      )
  );

const lumaSampleFromMatch = (match: RegExpMatchArray, pending: PendingLuminanceFrame): O.Option<LuminanceSample> =>
  pipe(
    O.fromUndefinedOr(match[1]),
    O.flatMap(parseNumber),
    O.map((value) => Math.min(255, Math.max(0, value))),
    O.flatMap(LumaValue.decodeUnknownOption),
    O.map((meanLuma) =>
      LuminanceSample.make({
        frameIndex: pending.frameIndex,
        meanLuma,
        ptsTimeSeconds: pending.ptsTimeSeconds,
      })
    )
  );

const parseLuminanceSamples = (stdout: string): ReadonlyArray<LuminanceSample> => {
  const lines = Str.split(/\r?\n/)(stdout);
  let pending = O.none<PendingLuminanceFrame>();
  let samples = A.empty<LuminanceSample>();

  for (const line of lines) {
    const frameMatch = pipe(line, Str.match(frameLinePattern));
    if (O.isSome(frameMatch)) {
      pending = pendingFrameFromMatch(frameMatch.value);
      continue;
    }

    const yavgMatch = pipe(line, Str.match(yavgLinePattern));
    if (O.isSome(yavgMatch) && O.isSome(pending)) {
      samples = pipe(
        lumaSampleFromMatch(yavgMatch.value, pending.value),
        O.match({ onNone: () => samples, onSome: (sample) => A.append(samples, sample) })
      );
      pending = O.none();
    }
  }

  return samples;
};

const withStagingDirectory = <A2>(
  fs: FileSystem.FileSystem,
  directory: string,
  operation: string,
  use: (tempDir: string) => Effect.Effect<A2, FFmpegError>
): Effect.Effect<A2, FFmpegError> =>
  Effect.acquireUseRelease(
    fs.makeTempDirectory({ directory, prefix: `.beep-ffmpeg-${operation}-` }).pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown(operation, `Failed to create temporary staging directory in "${directory}".`, {
          cause,
        })
      )
    ),
    use,
    (tempDir) => fs.remove(tempDir, { recursive: true, force: true }).pipe(Effect.ignore)
  );

const useMetadataTagsExtensions = HashSet.make(".m4v", ".mov", ".mp4");

const shouldUseMetadataTags = (extension: string): boolean =>
  HashSet.has(useMetadataTagsExtensions, Str.toLowerCase(extension));

class ExtractAtContext extends S.Class<ExtractAtContext>($I`ExtractAtContext`)(
  {
    manifestPath: S.String,
    outDir: S.String,
    overwrite: S.Boolean,
    padding: FrameFilenamePadding,
    prefix: SafeFramePrefix,
    probe: VideoProbe,
    timestampsSeconds: S.Array(NonNegativeSeconds),
    videoPath: S.String,
  },
  $I.annote("ExtractAtContext", {
    description: "Context for extracting timestamped frames from a video.",
  })
) {}

class StagedTimestampedFrame extends S.Class<StagedTimestampedFrame>($I`StagedTimestampedFrame`)(
  {
    fileName: S.String,
    index: FrameIndex,
    tempPath: S.String,
    timestampSeconds: NonNegativeSeconds,
  },
  $I.annote("StagedTimestampedFrame", {
    description: "Staged timestamped frame information.",
  })
) {}

const makeFramesAtManifest = (
  context: ExtractAtContext,
  frames: ReadonlyArray<TimestampedFrame>
): ExtractFramesAtManifest =>
  ExtractFramesAtManifest.make({
    frames,
    manifestPath: context.manifestPath,
    options: ExtractFramesAtManifestOptions.make({
      overwrite: context.overwrite,
      prefix: context.prefix,
      timestampsSeconds: context.timestampsSeconds,
    }),
    outputDirectory: context.outDir,
    probe: context.probe,
    schemaVersion: "beep.ffmpeg.extract-frames-at.v1",
    sourceVideo: context.videoPath,
    summary: ExtractFramesManifestSummary.make({
      frameCount: A.length(frames),
    }),
  });

const renderFramesAtManifest = Effect.fn("FFmpeg.renderFramesAtManifest")(function* (
  manifestPath: string,
  manifest: ExtractFramesAtManifest
) {
  const encoded = yield* ExtractFramesAtManifest.encodeEffect(manifest).pipe(
    Effect.mapError((cause) =>
      FFmpegError.fromUnknown("extractFramesAt", `Failed to encode extract-frames-at manifest: "${manifestPath}"`, {
        cause,
      })
    )
  );

  return yield* encodeJson(encoded).pipe(
    Effect.map((json) => `${json}\n`),
    Effect.mapError((cause) =>
      FFmpegError.fromUnknown("extractFramesAt", `Failed to render extract-frames-at manifest: "${manifestPath}"`, {
        cause,
      })
    )
  );
});

const commitTimestampedFrames = Effect.fn("FFmpeg.commitTimestampedFrames")(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  context: ExtractAtContext,
  tempDir: string,
  staged: ReadonlyArray<StagedTimestampedFrame>
) {
  for (const frame of staged) {
    yield* preflightWritable(
      fs,
      path.join(context.outDir, frame.fileName),
      context.overwrite,
      "frame output",
      "extractFramesAt"
    );
  }

  let committed = A.empty<TimestampedFrame>();
  for (const frame of staged) {
    const targetPath = path.join(context.outDir, frame.fileName);
    if (context.overwrite) {
      yield* fs.remove(targetPath, { force: true }).pipe(Effect.ignore);
    }
    yield* fs
      .rename(frame.tempPath, targetPath)
      .pipe(
        Effect.mapError((cause) =>
          FFmpegError.fromUnknown("extractFramesAt", `Failed to commit frame output: "${targetPath}"`, { cause })
        )
      );
    committed = A.append(
      committed,
      TimestampedFrame.make({
        fileName: frame.fileName,
        index: frame.index,
        path: targetPath,
        relativePath: path.relative(context.outDir, targetPath),
        requestedTimestampSeconds: frame.timestampSeconds,
      })
    );
  }

  const manifest = makeFramesAtManifest(context, committed);
  const manifestContent = yield* renderFramesAtManifest(context.manifestPath, manifest);
  const tempManifestPath = path.join(tempDir, "extract-frames-at-manifest.json");
  yield* fs.writeFileString(tempManifestPath, manifestContent).pipe(
    Effect.mapError((cause) =>
      FFmpegError.fromUnknown("extractFramesAt", `Failed to write temporary manifest: "${tempManifestPath}"`, {
        cause,
      })
    )
  );
  if (context.overwrite) {
    yield* fs.remove(context.manifestPath, { force: true }).pipe(Effect.ignore);
  }
  yield* fs
    .rename(tempManifestPath, context.manifestPath)
    .pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown("extractFramesAt", `Failed to commit manifest: "${context.manifestPath}"`, { cause })
      )
    );

  return committed;
});

const makeService = Effect.fn("FFmpeg.make")(function* (configInput?: FFmpegConfigInputOptions | undefined) {
  const config = defaultConfig(configInput);
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const makeCommand = (command: string, args: ReadonlyArray<string>): ChildProcess.Command =>
    ChildProcess.make(command, args, {
      forceKillAfter: `${config.forceKillAfterMillis} millis`,
      stdin: "ignore",
      stderr: "pipe",
      stdout: "pipe",
    });

  const probeVideo = Effect.fn("FFmpeg.probeVideo")(function* (rawRequest: ProbeVideoRequest) {
    const request = yield* ProbeVideoRequest.decodeEffect(rawRequest).pipe(
      Effect.mapError((cause) => FFmpegError.fromUnknown("probeVideo", "Invalid probe video request.", { cause }))
    );
    const videoPath = path.resolve(request.videoPath);
    yield* ensureFile(fs, videoPath, "video input", "probeVideo");
    const args = buildFfprobeArgs(ProbeVideoRequest.make({ videoPath }));
    const command = ChildProcess.make(config.ffprobePath, args, {
      forceKillAfter: `${config.forceKillAfterMillis} millis`,
      stdin: "ignore",
      stderr: "pipe",
      stdout: "pipe",
    });
    const result = yield* runProcess(
      spawner,
      command,
      "probeVideo",
      "Failed to run ffprobe. Install ffprobe or configure ffprobePath."
    );

    if (result.exitCode !== 0) {
      return yield* FFmpegError.make({
        command: O.some(config.ffprobePath),
        exitCode: O.some(result.exitCode),
        message: `ffprobe could not read video metadata for "${videoPath}".`,
        operation: "probeVideo",
        stderr: O.some(Str.trim(result.stderr)),
        stdout: O.some(Str.trim(result.stdout)),
      });
    }

    const output = yield* FfprobeOutput.decodeJsonEffect(result.stdout).pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown("probeVideo", `Failed to decode ffprobe JSON for "${videoPath}".`, {
          cause,
          command: config.ffprobePath,
          stdout: result.stdout,
        })
      )
    );
    return probeFromOutput(videoPath, output);
  });

  const extractFrames = Effect.fn("FFmpeg.extractFrames")(function* (
    rawRequest: ExtractFramesRequest,
    onEvent?: FFmpegEventSink | undefined
  ) {
    const request = yield* ExtractFramesRequest.decodeEffect(rawRequest).pipe(
      Effect.mapError((cause) => FFmpegError.fromUnknown("extractFrames", "Invalid extract-frames request.", { cause }))
    );
    const videoPath = path.resolve(request.videoPath);
    const outDir = path.resolve(request.outDir);
    yield* ensureFile(fs, videoPath, "video input");
    yield* ensureDirectory(fs, outDir, "frame output directory");
    // Defense-in-depth containment: fail closed if the manifest target (default
    // or caller-supplied) would resolve outside the frame output directory via a
    // `..` traversal or a symlink. resolvePathWithinRoot canonicalizes both root
    // and candidate with realPath and guards the not-yet-created manifest leaf.
    const manifestCandidate = pipe(
      request.manifestPath,
      O.match({
        // shared driver boundary idiom; no in-family home; future foundation capability candidate.
        // fallow-ignore-next-line code-duplication -- shared driver boundary idiom; no in-family home, future foundation capability candidate
        onNone: () => path.join(outDir, "extract-frames-manifest.json"),
        onSome: path.resolve,
      })
    );
    const manifestPath = yield* resolvePathWithinRoot({ root: outDir, candidate: manifestCandidate }).pipe(
      // Discharge the guard's FileSystem | Path requirement with the platform
      // services already captured at service-construction scope so the method's
      // R stays `never` (matches FFmpegShape and the rest of this service).
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown(
          "extractFrames",
          `Refusing manifest path outside the frame output directory: "${manifestCandidate}"`,
          { cause }
        )
      )
    );
    yield* ensureDirectory(fs, path.dirname(manifestPath), "manifest directory");
    yield* preflightWritable(fs, manifestPath, request.overwrite, "manifest");

    const probe = yield* probeVideo(ProbeVideoRequest.make({ videoPath }));
    const context = yield* makeExtractContext(
      path,
      // Reuse the containment-validated manifest path so the rendered manifest
      // cannot be redirected outside the output directory by makeExtractContext.
      ExtractFramesRequest.make({ ...request, manifestPath: O.some(manifestPath), outDir, videoPath }),
      probe
    );

    return yield* Effect.acquireUseRelease(
      fs
        .makeTempDirectory({ directory: context.outDir, prefix: ".beep-ffmpeg-extract-frames-" })
        .pipe(
          Effect.mapError((cause) =>
            FFmpegError.fromUnknown(
              "extractFrames",
              `Failed to create temporary frame directory in "${context.outDir}".`,
              { cause }
            )
          )
        ),
      Effect.fnUntraced(function* (tempDir) {
        const tempPattern = path.join(tempDir, `${context.prefix}_%0${context.padding}d.png`);
        const args = buildExtractFramesArgs({
          fps: context.fpsText,
          outputPattern: tempPattern,
          videoPath: context.videoPath,
        });
        const command = ChildProcess.make(config.ffmpegPath, args, {
          forceKillAfter: `${config.forceKillAfterMillis} millis`,
          stdin: "ignore",
          stderr: "pipe",
          stdout: "pipe",
        });

        yield* emitEvent(
          onEvent,
          FFmpegStartedEvent.make({
            args,
            command: config.ffmpegPath,
            kind: "started",
            outDir: context.outDir,
            videoPath: context.videoPath,
          })
        );

        const result = yield* runExtractProcess(spawner, command, context.expectedFrameCount, onEvent);
        if (result.exitCode !== 0) {
          return yield* FFmpegError.make({
            command: O.some(config.ffmpegPath),
            exitCode: O.some(result.exitCode),
            message: `ffmpeg could not extract frames for "${context.videoPath}".`,
            operation: "extractFrames",
            stderr: O.some(Str.trim(result.stderr)),
            stdout: O.some(Str.trim(result.stdout)),
          });
        }

        const tempFrames = yield* readTempFrames(fs, path, tempDir, context.prefix);
        const frames = yield* commitFrames(fs, path, context, tempDir, tempFrames).pipe(Effect.uninterruptible);
        const resultValue = ExtractFramesResult.make({
          frameCount: A.length(frames),
          frames,
          manifestPath: context.manifestPath,
          outDir: context.outDir,
          videoPath: context.videoPath,
        });
        yield* emitEvent(
          onEvent,
          FFmpegCompletedEvent.make({
            frameCount: resultValue.frameCount,
            kind: "completed",
            manifestPath: resultValue.manifestPath,
            outDir: resultValue.outDir,
          })
        );
        return resultValue;
      }),
      (tempDir) => fs.remove(tempDir, { recursive: true, force: true }).pipe(Effect.ignore)
    );
  });

  const runCaptureOutput = Effect.fn("FFmpeg.runCaptureOutput")(function* (options: {
    readonly argsForTarget: (target: string) => ReadonlyArray<string>;
    readonly failureMessage: string;
    readonly operation: string;
    readonly outPath: string;
    readonly overwrite: boolean;
    readonly videoPath: string;
  }): Effect.fn.Return<FileSizeBytes, FFmpegError> {
    yield* ensureFile(fs, options.videoPath, "video input", options.operation);
    const outDir = path.dirname(options.outPath);
    yield* ensureDirectory(fs, outDir, "output directory", options.operation);
    yield* preflightWritable(fs, options.outPath, options.overwrite, "output", options.operation);

    return yield* withStagingDirectory(
      fs,
      outDir,
      options.operation,
      Effect.fnUntraced(function* (tempDir) {
        const tempTarget = path.join(tempDir, path.basename(options.outPath));
        const args = options.argsForTarget(tempTarget);
        const result = yield* runProcess(
          spawner,
          makeCommand(config.ffmpegPath, args),
          options.operation,
          "Failed to run ffmpeg. Install ffmpeg or configure ffmpegPath."
        );
        if (result.exitCode !== 0) {
          return yield* FFmpegError.make({
            command: O.some(config.ffmpegPath),
            exitCode: O.some(result.exitCode),
            message: options.failureMessage,
            operation: options.operation,
            stderr: O.some(Str.trim(result.stderr)),
            stdout: O.some(Str.trim(result.stdout)),
          });
        }

        const produced = yield* fs
          .exists(tempTarget)
          .pipe(
            Effect.mapError((cause) =>
              FFmpegError.fromUnknown(options.operation, `Failed to inspect staged output: "${tempTarget}"`, { cause })
            )
          );
        if (!produced) {
          return yield* FFmpegError.make({
            message: `ffmpeg completed without producing output: "${options.outPath}"`,
            operation: options.operation,
          });
        }

        const stat = yield* fs
          .stat(tempTarget)
          .pipe(
            Effect.mapError((cause) =>
              FFmpegError.fromUnknown(options.operation, `Failed to stat staged output: "${tempTarget}"`, { cause })
            )
          );
        const fileSizeBytes = FileSizeBytes.make(Number(stat.size));

        yield* Effect.uninterruptible(
          Effect.gen(function* () {
            if (options.overwrite) {
              yield* fs.remove(options.outPath, { force: true }).pipe(Effect.ignore);
            }
            yield* fs
              .rename(tempTarget, options.outPath)
              .pipe(
                Effect.mapError((cause) =>
                  FFmpegError.fromUnknown(options.operation, `Failed to commit output: "${options.outPath}"`, { cause })
                )
              );
          })
        );

        return fileSizeBytes;
      })
    );
  });

  const extractFrameAt = Effect.fn("FFmpeg.extractFrameAt")(function* (rawRequest: ExtractFrameAtRequest) {
    const request = yield* ExtractFrameAtRequest.decodeEffect(rawRequest).pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown("extractFrameAt", "Invalid extract-frame-at request.", { cause })
      )
    );
    const videoPath = path.resolve(request.videoPath);
    const outPath = path.resolve(request.outPath);
    yield* runCaptureOutput({
      argsForTarget: (target) =>
        buildExtractFrameAtArgs({
          outputPath: target,
          timestamp: `${request.timestampSeconds}`,
          videoPath,
        }),
      failureMessage: `ffmpeg could not extract a frame at ${request.timestampSeconds}s from "${videoPath}".`,
      operation: "extractFrameAt",
      outPath,
      overwrite: request.overwrite,
      videoPath,
    });
    return TimestampedFrame.make({
      fileName: path.basename(outPath),
      index: FrameIndex.make(0),
      path: outPath,
      relativePath: path.basename(outPath),
      requestedTimestampSeconds: request.timestampSeconds,
    });
  });

  const extractFramesAt = Effect.fn("FFmpeg.extractFramesAt")(function* (rawRequest: ExtractFramesAtRequest) {
    const request = yield* ExtractFramesAtRequest.decodeEffect(rawRequest).pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown("extractFramesAt", "Invalid extract-frames-at request.", { cause })
      )
    );
    const videoPath = path.resolve(request.videoPath);
    const outDir = path.resolve(request.outDir);
    yield* ensureFile(fs, videoPath, "video input", "extractFramesAt");
    yield* ensureDirectory(fs, outDir, "frame output directory", "extractFramesAt");
    // Same defense-in-depth containment as extractFrames: the manifest target
    // (default or caller-supplied) must stay inside the frame output directory.
    const manifestCandidate = pipe(
      request.manifestPath,
      O.match({
        onNone: () => path.join(outDir, "extract-frames-at-manifest.json"),
        onSome: path.resolve,
      })
    );
    const manifestPath = yield* resolvePathWithinRoot({ root: outDir, candidate: manifestCandidate }).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown(
          "extractFramesAt",
          `Refusing manifest path outside the frame output directory: "${manifestCandidate}"`,
          { cause }
        )
      )
    );
    yield* ensureDirectory(fs, path.dirname(manifestPath), "manifest directory", "extractFramesAt");
    yield* preflightWritable(fs, manifestPath, request.overwrite, "manifest", "extractFramesAt");

    const probe = yield* probeVideo(ProbeVideoRequest.make({ videoPath }));
    const sourceExtension = path.extname(videoPath);
    const sourceStem = path.basename(videoPath, sourceExtension) || "video";
    const prefix = pipe(
      request.prefix,
      O.getOrElse(() => SafeFramePrefix.decodeUnknownSync(`${sourceStem}_at`))
    );
    const context = ExtractAtContext.make({
      manifestPath,
      outDir,
      overwrite: request.overwrite,
      padding: paddingForCount(A.length(request.timestampsSeconds)),
      prefix,
      probe,
      timestampsSeconds: request.timestampsSeconds,
      videoPath,
    });

    return yield* withStagingDirectory(
      fs,
      outDir,
      "extractFramesAt",
      Effect.fnUntraced(function* (tempDir) {
        const staged = yield* Effect.forEach(
          A.map(request.timestampsSeconds, (timestampSeconds, index) => ({ index, timestampSeconds })),
          Effect.fnUntraced(function* (entry) {
            const index = FrameIndex.make(entry.index);
            const fileName = formatFrameFileName({ index, padding: context.padding, prefix: context.prefix });
            const tempPath = path.join(tempDir, fileName);
            const args = buildExtractFrameAtArgs({
              outputPath: tempPath,
              timestamp: `${entry.timestampSeconds}`,
              ...pipe(
                request.maxWidth,
                O.map((maxWidth) => ({ maxWidth })),
                O.getOrElse(() => ({}))
              ),
              videoPath,
            });
            const result = yield* runProcess(
              spawner,
              makeCommand(config.ffmpegPath, args),
              "extractFramesAt",
              "Failed to run ffmpeg. Install ffmpeg or configure ffmpegPath."
            );
            if (result.exitCode !== 0) {
              return yield* FFmpegError.make({
                command: O.some(config.ffmpegPath),
                exitCode: O.some(result.exitCode),
                message: `ffmpeg could not extract a frame at ${entry.timestampSeconds}s from "${videoPath}".`,
                operation: "extractFramesAt",
                stderr: O.some(Str.trim(result.stderr)),
                stdout: O.some(Str.trim(result.stdout)),
              });
            }
            const produced = yield* fs
              .exists(tempPath)
              .pipe(
                Effect.mapError((cause) =>
                  FFmpegError.fromUnknown("extractFramesAt", `Failed to inspect staged frame: "${tempPath}"`, { cause })
                )
              );
            if (!produced) {
              return yield* FFmpegError.make({
                message: `ffmpeg completed without producing a frame at ${entry.timestampSeconds}s from "${videoPath}".`,
                operation: "extractFramesAt",
              });
            }
            return StagedTimestampedFrame.make({
              fileName,
              index,
              tempPath,
              timestampSeconds: entry.timestampSeconds,
            });
          }),
          { concurrency: 4 }
        );

        const frames = yield* commitTimestampedFrames(fs, path, context, tempDir, staged).pipe(Effect.uninterruptible);
        return ExtractFramesAtResult.make({
          frameCount: A.length(frames),
          frames,
          manifestPath: context.manifestPath,
          outDir: context.outDir,
          videoPath: context.videoPath,
        });
      })
    );
  });

  const extractClip = Effect.fn("FFmpeg.extractClip")(function* (rawRequest: ExtractClipRequest) {
    const request = yield* ExtractClipRequest.decodeEffect(rawRequest).pipe(
      // shared driver boundary idiom; no in-family home; future foundation capability candidate.
      // fallow-ignore-next-line code-duplication -- shared driver boundary idiom; no in-family home, future foundation capability candidate
      Effect.mapError((cause) => FFmpegError.fromUnknown("extractClip", "Invalid extract-clip request.", { cause }))
    );
    const videoPath = path.resolve(request.videoPath);
    const outPath = path.resolve(request.outPath);
    const fileSizeBytes = yield* runCaptureOutput({
      argsForTarget: (target) =>
        buildExtractClipArgs({
          codec: request.codec,
          outputPath: target,
          start: `${request.startSeconds}`,
          videoPath,
          ...pipe(
            request.durationSeconds,
            O.map((seconds) => ({ duration: `${seconds}` })),
            O.getOrElse(() => ({}))
          ),
        }),
      failureMessage: `ffmpeg could not extract a clip from "${videoPath}".`,
      operation: "extractClip",
      outPath,
      overwrite: request.overwrite,
      videoPath,
    });
    return ExtractClipResult.make({
      durationSeconds: request.durationSeconds,
      fileSizeBytes,
      outPath,
      startSeconds: request.startSeconds,
      videoPath,
    });
  });

  const renderGif = Effect.fn("FFmpeg.renderGif")(function* (rawRequest: RenderGifRequest) {
    const request = yield* RenderGifRequest.decodeEffect(rawRequest).pipe(
      // shared driver boundary idiom; no in-family home; future foundation capability candidate.
      // fallow-ignore-next-line code-duplication -- shared driver boundary idiom; no in-family home, future foundation capability candidate
      Effect.mapError((cause) => FFmpegError.fromUnknown("renderGif", "Invalid render-gif request.", { cause }))
    );
    const videoPath = path.resolve(request.videoPath);
    const outPath = path.resolve(request.outPath);
    const fileSizeBytes = yield* runCaptureOutput({
      argsForTarget: (target) =>
        buildRenderGifArgs({
          dither: request.dither,
          duration: `${request.durationSeconds}`,
          fps: formatFps(request.fps),
          outputPath: target,
          start: `${request.startSeconds}`,
          videoPath,
          width: request.width,
        }),
      failureMessage: `ffmpeg could not render a GIF from "${videoPath}".`,
      operation: "renderGif",
      outPath,
      overwrite: request.overwrite,
      videoPath,
    });
    return RenderGifResult.make({
      fileSizeBytes,
      outPath,
      videoPath,
    });
  });

  const renderContactSheet = Effect.fn("FFmpeg.renderContactSheet")(function* (rawRequest: RenderContactSheetRequest) {
    const request = yield* RenderContactSheetRequest.decodeEffect(rawRequest).pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown("renderContactSheet", "Invalid render-contact-sheet request.", { cause })
      )
    );
    const videoPath = path.resolve(request.videoPath);
    const outPath = path.resolve(request.outPath);
    const probe = yield* probeVideo(ProbeVideoRequest.make({ videoPath }));
    const durationSeconds = yield* pipe(
      probe.durationSeconds,
      O.filter((value) => value > 0),
      Effect.fromOption(() =>
        FFmpegError.make({
          message: `ffprobe reported no positive duration for "${videoPath}"; remux or re-encode (extractClip) before rendering a contact sheet.`,
          operation: "renderContactSheet",
        })
      )
    );
    const sheetFps = (request.columns * request.rows) / durationSeconds;
    const fileSizeBytes = yield* runCaptureOutput({
      argsForTarget: (target) =>
        buildRenderContactSheetArgs({
          columns: request.columns,
          fps: formatFps(sheetFps),
          outputPath: target,
          quality: request.quality,
          rows: request.rows,
          tileWidth: request.tileWidth,
          videoPath,
        }),
      failureMessage: `ffmpeg could not render a contact sheet from "${videoPath}".`,
      operation: "renderContactSheet",
      outPath,
      overwrite: request.overwrite,
      videoPath,
    });
    return RenderContactSheetResult.make({
      columns: request.columns,
      fileSizeBytes,
      outPath,
      rows: request.rows,
      videoPath,
    });
  });

  const writeContainerMetadata = Effect.fn("FFmpeg.writeContainerMetadata")(function* (
    rawRequest: WriteContainerMetadataRequest
  ) {
    // shared driver boundary idiom; no in-family home; future foundation capability candidate.
    // fallow-ignore-next-line code-duplication -- shared driver boundary idiom; no in-family home, future foundation capability candidate
    const request = yield* WriteContainerMetadataRequest.decodeEffect(rawRequest).pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown("writeContainerMetadata", "Invalid write-container-metadata request.", { cause })
      )
    );
    const videoPath = path.resolve(request.videoPath);
    const outPath = path.resolve(request.outPath);
    const fileSizeBytes = yield* runCaptureOutput({
      argsForTarget: (target) =>
        buildWriteContainerMetadataArgs({
          metadata: request.metadata,
          outputPath: target,
          useMetadataTags: shouldUseMetadataTags(path.extname(outPath)),
          videoPath,
        }),
      failureMessage: `ffmpeg could not write container metadata for "${videoPath}".`,
      operation: "writeContainerMetadata",
      outPath,
      overwrite: request.overwrite,
      videoPath,
    });
    return WriteContainerMetadataResult.make({
      fileSizeBytes,
      outPath,
      videoPath,
    });
  });

  const probeRegionLuminance = Effect.fn("FFmpeg.probeRegionLuminance")(function* (
    rawRequest: ProbeRegionLuminanceRequest
  ) {
    const request = yield* ProbeRegionLuminanceRequest.decodeEffect(rawRequest).pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown("probeRegionLuminance", "Invalid probe-region-luminance request.", { cause })
      )
    );
    const videoPath = path.resolve(request.videoPath);
    yield* ensureFile(fs, videoPath, "video input", "probeRegionLuminance");
    const args = buildProbeRegionLuminanceArgs({
      height: request.height,
      videoPath,
      width: request.width,
      x: request.x,
      y: request.y,
    });
    const result = yield* runProcess(
      spawner,
      makeCommand(config.ffmpegPath, args),
      "probeRegionLuminance",
      "Failed to run ffmpeg. Install ffmpeg or configure ffmpegPath."
    );
    if (result.exitCode !== 0) {
      return yield* FFmpegError.make({
        command: O.some(config.ffmpegPath),
        exitCode: O.some(result.exitCode),
        message: `ffmpeg could not sample region luminance for "${videoPath}".`,
        operation: "probeRegionLuminance",
        stderr: O.some(Str.trim(result.stderr)),
        stdout: O.some(Str.trim(result.stdout)),
      });
    }
    return ProbeRegionLuminanceResult.make({
      samples: parseLuminanceSamples(result.stdout),
      videoPath,
    });
  });

  return {
    extractClip,
    extractFrameAt,
    extractFrames,
    extractFramesAt,
    probeRegionLuminance,
    probeVideo,
    renderContactSheet,
    renderGif,
    writeContainerMetadata,
  };
});

/**
 * Effect service for native FFmpeg and ffprobe execution.
 *
 * **Example** (Reference FFmpeg service)
 *
 * ```ts
 * import { FFmpeg } from "@beep/ffmpeg"
 *
 * const service = FFmpeg
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FFmpeg extends Context.Service<FFmpeg, FFmpegShape>()($I`FFmpeg`) {
  /**
   * Build the native FFmpeg service layer.
   *
   * **Example** (Build FFmpeg layer)
   *
   * ```ts
   * import { FFmpeg } from "@beep/ffmpeg"
   *
   * const layer = FFmpeg.makeLayer()
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    config?: FFmpegConfigInputOptions | undefined
  ): Layer.Layer<FFmpeg, never, ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path> =>
    Layer.effect(FFmpeg, Effect.map(makeService(config), FFmpeg.of));
}
