/**
 * Native FFmpeg process driver service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import { $FfmpegId } from "@beep/identity/packages";
import { Fn, SchemaUtils } from "@beep/schema";
import { A, O, Str, thunkEmptyStr } from "@beep/utils";
import { Context, Effect, FileSystem, Layer, Number as N, Order, Path, pipe, Ref, Stream } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
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
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);
const NumberOrString = S.Union([S.Finite, S.String]);
type FFmpegConfigInputOptions = (typeof FFmpegConfigInput)["~type.make.in"];

class FfprobeStream extends S.Class<FfprobeStream>($I`FfprobeStream`)(
  {
    avg_frame_rate: S.OptionFromOptionalKey(NumberOrString).pipe(SchemaUtils.withNoneDefault),
    duration: S.OptionFromOptionalKey(NumberOrString).pipe(SchemaUtils.withNoneDefault),
    height: S.OptionFromOptionalKey(VideoDimension).pipe(SchemaUtils.withNoneDefault),
    nb_frames: S.OptionFromOptionalKey(NumberOrString).pipe(SchemaUtils.withNoneDefault),
    r_frame_rate: S.OptionFromOptionalKey(NumberOrString).pipe(SchemaUtils.withNoneDefault),
    width: S.OptionFromOptionalKey(VideoDimension).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("FfprobeStream", {
    description: "Internal ffprobe stream payload.",
  })
) {}

class FfprobeFormat extends S.Class<FfprobeFormat>($I`FfprobeFormat`)(
  {
    duration: S.OptionFromOptionalKey(NumberOrString).pipe(SchemaUtils.withNoneDefault),
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
 * @example
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
 * @example
 * ```ts
 * import type { FFmpegShape } from "@beep/ffmpeg"
 * import { Effect } from "effect"
 *
 * const service: FFmpegShape = {
 *   extractFrames: () => Effect.die("not implemented"),
 *   probeVideo: () => Effect.die("not implemented")
 * }
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface FFmpegShape {
  readonly extractFrames: (
    request: ExtractFramesRequest,
    onEvent?: FFmpegEventSink | undefined
  ) => Effect.Effect<ExtractFramesResult, FFmpegError>;
  readonly probeVideo: (request: ProbeVideoRequest) => Effect.Effect<VideoProbe, FFmpegError>;
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
 * @example
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
 * @example
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
// fallow-ignore-next-line code-duplication
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
  pipe(parseNumber(value), O.flatMap(NonNegativeSeconds.decodeOption));

const parsePositiveFrameRate = (value: unknown): O.Option<PositiveFrameRate> =>
  pipe(rationalToNumber(value), O.flatMap(PositiveFrameRate.decodeOption));

const parseFrameCount = (value: unknown): O.Option<FrameCount> =>
  pipe(parseNumber(value), O.flatMap(FrameCount.decodeOption));

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

  return VideoProbe.make({
    videoPath,
    durationSeconds,
    fps,
    frameCount,
    height,
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
 * @example
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
 * @example
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
 * @example
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
  "stream=width,height,avg_frame_rate,r_frame_rate,duration,nb_frames",
  "-show_entries",
  "format=duration",
  "-of",
  "json",
  request.videoPath,
];

/**
 * Options for building native ffmpeg frame extraction arguments.
 *
 * @example
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
 * @example
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
    O.flatMap(NonNegativeSeconds.decodeOption)
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
  label: string
): Effect.fn.Return<void, FFmpegError> {
  const stat = yield* fs
    .stat(filePath)
    .pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown("extractFrames", `Failed to stat ${label}: "${filePath}"`, { cause })
      )
    );
  if (stat.type !== "File") {
    return yield* FFmpegError.make({
      message: `Expected ${label} to be a file: "${filePath}"`,
      operation: "extractFrames",
    });
  }
});

const ensureDirectory = Effect.fn("FFmpeg.ensureDirectory")(function* (
  fs: FileSystem.FileSystem,
  dirPath: string,
  label: string
): Effect.fn.Return<void, FFmpegError> {
  const exists = yield* fs
    .exists(dirPath)
    .pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown("extractFrames", `Failed to inspect ${label}: "${dirPath}"`, { cause })
      )
    );
  if (!exists) {
    yield* fs
      .makeDirectory(dirPath, { recursive: true })
      .pipe(
        Effect.mapError((cause) =>
          FFmpegError.fromUnknown("extractFrames", `Failed to create ${label}: "${dirPath}"`, { cause })
        )
      );
    return;
  }

  const stat = yield* fs
    .stat(dirPath)
    .pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown("extractFrames", `Failed to stat ${label}: "${dirPath}"`, { cause })
      )
    );
  if (stat.type !== "Directory") {
    return yield* FFmpegError.make({
      message: `Expected ${label} to be a directory: "${dirPath}"`,
      operation: "extractFrames",
    });
  }
});

const preflightWritable = Effect.fn("FFmpeg.preflightWritable")(function* (
  fs: FileSystem.FileSystem,
  filePath: string,
  overwrite: boolean,
  label: string
): Effect.fn.Return<void, FFmpegError> {
  const exists = yield* fs
    .exists(filePath)
    .pipe(
      Effect.mapError((cause) =>
        FFmpegError.fromUnknown("extractFrames", `Failed to inspect ${label}: "${filePath}"`, { cause })
      )
    );
  if (exists && !overwrite) {
    return yield* FFmpegError.make({
      message: `Refusing to overwrite existing ${label}: "${filePath}"`,
      operation: "extractFrames",
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
  const defaultPrefix = SafeFramePrefix.fromUnknown(`${sourceStem}_frame`);
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
    const index = pipe(N.parse(digits), O.flatMap(FrameIndex.decodeOption));

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

const makeService = Effect.fn("FFmpeg.make")(function* (configInput?: FFmpegConfigInputOptions | undefined) {
  const config = defaultConfig(configInput);
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const probeVideo = Effect.fn("FFmpeg.probeVideo")(function* (rawRequest: ProbeVideoRequest) {
    const request = yield* ProbeVideoRequest.decodeEffect(rawRequest).pipe(
      Effect.mapError((cause) => FFmpegError.fromUnknown("probeVideo", "Invalid probe video request.", { cause }))
    );
    const videoPath = path.resolve(request.videoPath);
    yield* ensureFile(fs, videoPath, "video input");
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

  return {
    extractFrames,
    probeVideo,
  };
});

/**
 * Effect service for native FFmpeg and ffprobe execution.
 *
 * @example
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
   * @example
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
