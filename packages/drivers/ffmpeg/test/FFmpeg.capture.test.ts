import {
  buildExtractClipArgs,
  buildExtractFrameAtArgs,
  buildProbeRegionLuminanceArgs,
  buildRenderContactSheetArgs,
  buildRenderGifArgs,
  buildWriteContainerMetadataArgs,
  ClipCodec,
  ExtractClipRequest,
  ExtractClipResult,
  ExtractFrameAtRequest,
  ExtractFramesAtManifest,
  ExtractFramesAtRequest,
  ExtractFramesAtResult,
  FFmpeg,
  FFmpegError,
  FileSizeBytes,
  GifDither,
  JpegQuality,
  LumaValue,
  LuminanceSample,
  MetadataPair,
  PixelOffset,
  PositiveSeconds,
  ProbeRegionLuminanceRequest,
  ProbeRegionLuminanceResult,
  ProbeVideoRequest,
  ProcessExitCode,
  RenderContactSheetRequest,
  RenderContactSheetResult,
  RenderGifRequest,
  RenderGifResult,
  SafeMetadataKey,
  TileCount,
  TimestampedFrame,
  WriteContainerMetadataRequest,
  WriteContainerMetadataResult,
} from "@beep/ffmpeg";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import { Context, Deferred, Effect, Equal, FileSystem, Layer, Order, Path, pipe, Sink, Stream } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";

const decodeUnknownSafeMetadataKey = S.decodeUnknownEffect(SafeMetadataKey);
const encoder = new TextEncoder();
const decodeFramesAtManifest = S.decodeUnknownEffect(S.fromJsonString(ExtractFramesAtManifest));

const assertRoundTrip = Effect.fn("FFmpegTest.assertRoundTrip")(function* <Schema extends S.Codec<unknown, unknown>>(
  schema: Schema,
  value: Schema["Type"]
) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  expect(Equal.equals(decoded, value)).toBe(true);
});

const ffprobeJson = UnknownFromJsonString.encodeUnknownSync({
  format: { duration: "2.0", start_time: "0.000000" },
  streams: [
    {
      avg_frame_rate: "30/1",
      duration: "2.0",
      height: 1080,
      nb_frames: "60",
      r_frame_rate: "30/1",
      start_time: "0.023",
      width: 1920,
    },
  ],
});

const luminanceStdout = [
  "frame:0    pts:0       pts_time:0",
  "lavfi.signalstats.YAVG=16.5",
  "frame:1    pts:512     pts_time:0.0333333",
  "lavfi.signalstats.YAVG=200.25",
  "frame:2    pts:1024    pts_time:0.0666667",
  "lavfi.signalstats.YAVG=70.8008",
  "",
].join("\n");

const makeStream = (text: string) => (text.length === 0 ? Stream.empty : Stream.succeed(encoder.encode(text)));

const makeHandle = (
  stdout: string,
  stderr = "",
  exitCode = 0,
  onExit: Effect.Effect<void> = Effect.void
): ChildProcessSpawner.ChildProcessHandle =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)).pipe(Effect.tap(() => onExit)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: makeStream(stderr),
    stdin: Sink.drain,
    stdout: makeStream(stdout),
    unref: Effect.succeed(Effect.void),
  });

const makeCaptureSpawnerLayer = (
  commands: Array<ChildProcess.StandardCommand>,
  exitCode = 0,
  failAfterFirstSuccess = false
) =>
  Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const firstSucceeded = yield* FirstFrameSucceeded;
      return ChildProcessSpawner.ChildProcessSpawner.of(
        ChildProcessSpawner.make((command) =>
          Effect.gen(function* () {
            if (!ChildProcess.isStandardCommand(command)) {
              return makeHandle("", "unsupported command", 1);
            }

            commands[A.length(commands)] = command;

            if (command.command === "ffprobe") {
              return makeHandle(ffprobeJson);
            }

            const encodeNumber = A.length(A.filter(commands, (command) => command.command === "ffmpeg"));
            const commandExitCode = failAfterFirstSuccess && encodeNumber === 1 ? 0 : exitCode;
            if (failAfterFirstSuccess && encodeNumber > 1) {
              const firstPath = yield* Deferred.await(firstSucceeded);
              expect(yield* fs.readFileString(firstPath)).toBe("fake output");
            }
            // The null muxer probe emits per-frame metadata on stdout and
            // writes no output file.
            if (A.contains(command.args, "null")) {
              return makeHandle(luminanceStdout, "ffmpeg stderr", commandExitCode);
            }

            return yield* O.match(A.last(command.args), {
              onNone: () => Effect.succeed(makeHandle("", "ffmpeg stderr", commandExitCode)),
              onSome: Effect.fnUntraced(function* (target) {
                if (commandExitCode === 0) {
                  yield* fs.writeFileString(target, "fake output");
                }
                const onExit =
                  failAfterFirstSuccess && encodeNumber === 1
                    ? Deferred.succeed(firstSucceeded, target).pipe(Effect.asVoid)
                    : Effect.void;
                return makeHandle("", "ffmpeg stderr", commandExitCode, onExit);
              }),
            });
          })
        )
      );
    })
  );

const makeLayer = (commands: Array<ChildProcess.StandardCommand>, exitCode = 0, failAfterFirstSuccess = false) =>
  FFmpeg.makeLayer().pipe(
    Layer.provide(makeCaptureSpawnerLayer(commands, exitCode, failAfterFirstSuccess)),
    Layer.provide(NodeServices.layer)
  );
class Commands extends Context.Service<Commands, Array<ChildProcess.StandardCommand>>()(
  "@beep/ffmpeg/test/FFmpeg.capture.test/Commands"
) {}
class FirstFrameSucceeded extends Context.Service<FirstFrameSucceeded, Deferred.Deferred<string>>()(
  "@beep/ffmpeg/test/FFmpeg.capture.test/FirstFrameSucceeded"
) {}
const makeTestLayer = (exitCode = 0, failAfterFirstSuccess = false) =>
  Layer.unwrap(
    Effect.map(Commands, (commands) =>
      Layer.mergeAll(NodeServices.layer, makeLayer(commands, exitCode, failAfterFirstSuccess))
    )
  ).pipe(
    Layer.provideMerge(Layer.sync(Commands, () => [])),
    Layer.provideMerge(Layer.effect(FirstFrameSucceeded, Deferred.make<string>()))
  );

const withTempDirectory = <A2, E, R>(use: (tmpDir: string) => Effect.Effect<A2, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tmpDir, {
          recursive: true,
          force: true,
        });
      })
  );

describe("@beep/ffmpeg capture", () => {
  it.effect.prop(
    "round-trips schema-modeled capture payloads",
    {
      PositiveSeconds: Arbitrary.schema(PositiveSeconds),
      FileSizeBytes: Arbitrary.schema(FileSizeBytes),
      TileCount: Arbitrary.schema(TileCount),
      JpegQuality: Arbitrary.schema(JpegQuality),
      PixelOffset: Arbitrary.schema(PixelOffset),
      LumaValue: Arbitrary.schema(LumaValue),
      SafeMetadataKey: Arbitrary.schema(SafeMetadataKey),
      GifDither: Arbitrary.schema(GifDither),
      ClipCodec: Arbitrary.schema(ClipCodec),
      MetadataPair: Arbitrary.schema(MetadataPair),
      ExtractFrameAtRequest: Arbitrary.schema(ExtractFrameAtRequest),
      TimestampedFrame: Arbitrary.schema(TimestampedFrame),
      ExtractFramesAtRequest: Arbitrary.schema(ExtractFramesAtRequest),
      ExtractFramesAtManifest: Arbitrary.schema(ExtractFramesAtManifest),
      ExtractFramesAtResult: Arbitrary.schema(ExtractFramesAtResult),
      ExtractClipRequest: Arbitrary.schema(ExtractClipRequest),
      ExtractClipResult: Arbitrary.schema(ExtractClipResult),
      RenderGifRequest: Arbitrary.schema(RenderGifRequest),
      RenderGifResult: Arbitrary.schema(RenderGifResult),
      RenderContactSheetRequest: Arbitrary.schema(RenderContactSheetRequest),
      RenderContactSheetResult: Arbitrary.schema(RenderContactSheetResult),
      WriteContainerMetadataRequest: Arbitrary.schema(WriteContainerMetadataRequest),
      WriteContainerMetadataResult: Arbitrary.schema(WriteContainerMetadataResult),
      ProbeRegionLuminanceRequest: Arbitrary.schema(ProbeRegionLuminanceRequest),
      LuminanceSample: Arbitrary.schema(LuminanceSample),
      ProbeRegionLuminanceResult: Arbitrary.schema(ProbeRegionLuminanceResult),
    },
    (values) =>
      Effect.gen(function* () {
        yield* assertRoundTrip(PositiveSeconds, values.PositiveSeconds);
        yield* assertRoundTrip(FileSizeBytes, values.FileSizeBytes);
        yield* assertRoundTrip(TileCount, values.TileCount);
        yield* assertRoundTrip(JpegQuality, values.JpegQuality);
        yield* assertRoundTrip(PixelOffset, values.PixelOffset);
        yield* assertRoundTrip(LumaValue, values.LumaValue);
        yield* assertRoundTrip(SafeMetadataKey, values.SafeMetadataKey);
        yield* assertRoundTrip(GifDither, values.GifDither);
        yield* assertRoundTrip(ClipCodec, values.ClipCodec);
        yield* assertRoundTrip(MetadataPair, values.MetadataPair);
        yield* assertRoundTrip(ExtractFrameAtRequest, values.ExtractFrameAtRequest);
        yield* assertRoundTrip(TimestampedFrame, values.TimestampedFrame);
        yield* assertRoundTrip(ExtractFramesAtRequest, values.ExtractFramesAtRequest);
        yield* assertRoundTrip(ExtractFramesAtManifest, values.ExtractFramesAtManifest);
        yield* assertRoundTrip(ExtractFramesAtResult, values.ExtractFramesAtResult);
        yield* assertRoundTrip(ExtractClipRequest, values.ExtractClipRequest);
        yield* assertRoundTrip(ExtractClipResult, values.ExtractClipResult);
        yield* assertRoundTrip(RenderGifRequest, values.RenderGifRequest);
        yield* assertRoundTrip(RenderGifResult, values.RenderGifResult);
        yield* assertRoundTrip(RenderContactSheetRequest, values.RenderContactSheetRequest);
        yield* assertRoundTrip(RenderContactSheetResult, values.RenderContactSheetResult);
        yield* assertRoundTrip(WriteContainerMetadataRequest, values.WriteContainerMetadataRequest);
        yield* assertRoundTrip(WriteContainerMetadataResult, values.WriteContainerMetadataResult);
        yield* assertRoundTrip(ProbeRegionLuminanceRequest, values.ProbeRegionLuminanceRequest);
        yield* assertRoundTrip(LuminanceSample, values.LuminanceSample);
        yield* assertRoundTrip(ProbeRegionLuminanceResult, values.ProbeRegionLuminanceResult);
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect("rejects unsafe metadata keys", () =>
    Effect.gen(function* () {
      expect(yield* decodeUnknownSafeMetadataKey("BEEP_QA_SESSION_ID")).toBe("BEEP_QA_SESSION_ID");
      pipe(yield* Effect.exit(decodeUnknownSafeMetadataKey("BEEP QA")), Exit.isFailure, assertTrue);
      pipe(yield* Effect.exit(decodeUnknownSafeMetadataKey("BEEP=QA")), Exit.isFailure, assertTrue);
      pipe(yield* Effect.exit(decodeUnknownSafeMetadataKey("1BEEP")), Exit.isFailure, assertTrue);
      pipe(yield* Effect.exit(decodeUnknownSafeMetadataKey("")), Exit.isFailure, assertTrue);
    })
  );

  it("builds single-frame timestamp extraction arguments", () => {
    expect(
      buildExtractFrameAtArgs({
        outputPath: "./frames/frame.png",
        timestamp: "1.25",
        videoPath: "./capture.webm",
      })
    ).toEqual([
      "-hide_banner",
      "-nostdin",
      "-y",
      "-ss",
      "1.25",
      "-i",
      "./capture.webm",
      "-frames:v",
      "1",
      "-update",
      "1",
      "./frames/frame.png",
    ]);
  });

  it("builds clip extraction arguments per codec preset", () => {
    expect(
      buildExtractClipArgs({
        codec: "h264",
        duration: "2",
        outputPath: "./clips/drag.mp4",
        start: "1.5",
        videoPath: "./capture.webm",
      })
    ).toEqual([
      "-hide_banner",
      "-nostdin",
      "-y",
      "-ss",
      "1.5",
      "-i",
      "./capture.webm",
      "-t",
      "2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "./clips/drag.mp4",
    ]);

    expect(
      buildExtractClipArgs({
        codec: "vp9",
        duration: "2",
        outputPath: "./clips/drag.webm",
        start: "1.5",
        videoPath: "./capture.webm",
      })
    ).toEqual([
      "-hide_banner",
      "-nostdin",
      "-y",
      "-ss",
      "1.5",
      "-i",
      "./capture.webm",
      "-t",
      "2",
      "-c:v",
      "libvpx-vp9",
      "-crf",
      "32",
      "-b:v",
      "0",
      "-row-mt",
      "1",
      "./clips/drag.webm",
    ]);
  });

  it("builds palette-optimized GIF arguments with dither routing", () => {
    expect(
      buildRenderGifArgs({
        dither: "bayer",
        duration: "2",
        fps: "10",
        outputPath: "./clips/drag.gif",
        start: "1.5",
        videoPath: "./capture.webm",
        width: 640,
      })
    ).toEqual([
      "-hide_banner",
      "-nostdin",
      "-y",
      "-ss",
      "1.5",
      "-i",
      "./capture.webm",
      "-t",
      "2",
      "-filter_complex",
      "[0:v] fps=10,scale=640:-1:flags=lanczos,split [a][b];[a] palettegen=stats_mode=diff [p];[b][p] paletteuse=dither=bayer:bayer_scale=5",
      "-f",
      "gif",
      "./clips/drag.gif",
    ]);

    const floydArgs = buildRenderGifArgs({
      dither: "floyd_steinberg",
      duration: "2",
      fps: "15",
      outputPath: "./clips/drag.gif",
      start: "0",
      videoPath: "./capture.webm",
      width: 480,
    });
    expect(floydArgs).toContain(
      "[0:v] fps=15,scale=480:-1:flags=lanczos,split [a][b];[a] palettegen=stats_mode=diff [p];[b][p] paletteuse=dither=floyd_steinberg"
    );
  });

  it("builds contact-sheet arguments", () => {
    expect(
      buildRenderContactSheetArgs({
        columns: 4,
        fps: "8",
        outputPath: "./sheets/capture.jpg",
        quality: 5,
        rows: 4,
        tileWidth: 320,
        videoPath: "./capture.webm",
      })
    ).toEqual([
      "-hide_banner",
      "-nostdin",
      "-y",
      "-i",
      "./capture.webm",
      "-vf",
      "fps=8,scale=320:-1,tile=4x4",
      "-frames:v",
      "1",
      "-q:v",
      "5",
      "./sheets/capture.jpg",
    ]);
  });

  it("builds container metadata remux arguments with movflags routing", () => {
    expect(
      buildWriteContainerMetadataArgs({
        metadata: [
          MetadataPair.make({ key: "BEEP_QA_SESSION_ID", value: "session-42" }),
          MetadataPair.make({ key: "BEEP_QA_ROUND", value: "3" }),
        ],
        outputPath: "./tagged/capture.webm",
        useMetadataTags: false,
        videoPath: "./capture.webm",
      })
    ).toEqual([
      "-hide_banner",
      "-nostdin",
      "-y",
      "-i",
      "./capture.webm",
      "-map",
      "0",
      "-c",
      "copy",
      "-metadata",
      "BEEP_QA_SESSION_ID=session-42",
      "-metadata",
      "BEEP_QA_ROUND=3",
      "./tagged/capture.webm",
    ]);

    expect(
      buildWriteContainerMetadataArgs({
        metadata: [MetadataPair.make({ key: "BEEP_QA_SESSION_ID", value: "session-42" })],
        outputPath: "./tagged/capture.mp4",
        useMetadataTags: true,
        videoPath: "./capture.mp4",
      })
    ).toEqual([
      "-hide_banner",
      "-nostdin",
      "-y",
      "-i",
      "./capture.mp4",
      "-map",
      "0",
      "-c",
      "copy",
      "-metadata",
      "BEEP_QA_SESSION_ID=session-42",
      "-movflags",
      "use_metadata_tags",
      "./tagged/capture.mp4",
    ]);
  });

  it("builds region luminance probe arguments", () => {
    expect(
      buildProbeRegionLuminanceArgs({
        height: 128,
        videoPath: "./capture.webm",
        width: 128,
        x: 0,
        y: 0,
      })
    ).toEqual([
      "-hide_banner",
      "-nostdin",
      "-nostats",
      "-i",
      "./capture.webm",
      "-vf",
      "crop=128:128:0:0,signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-",
      "-f",
      "null",
      "-",
    ]);
  });

  it.layer(makeTestLayer())("surfaces start time and r_frame_rate from ffprobe", (it) => {
    it.effect("surfaces start time and r_frame_rate from ffprobe", () =>
      Effect.gen(function* () {
        const commands = yield* Commands;
        expect(commands).toEqual([]);

        return yield* withTempDirectory(
          Effect.fnUntraced(function* (tmpDir) {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const videoPath = path.join(tmpDir, "clip.mp4");
            yield* fs.writeFileString(videoPath, "video");

            const ffmpeg = yield* FFmpeg;
            const probe = yield* ffmpeg.probeVideo(ProbeVideoRequest.make({ videoPath }));

            expect(
              pipe(
                probe.rFrameRate,
                O.getOrElse(() => 0)
              )
            ).toBe(30);
            expect(
              pipe(
                probe.startTimeSeconds,
                O.getOrElse(() => -1)
              )
            ).toBe(0.023);
          })
        );
      })
    );
  });

  it.layer(makeTestLayer())("extracts timestamped frames and writes the frames-at manifest", (it) => {
    it.effect(
      "extracts timestamped frames and writes the frames-at manifest",
      Effect.fnUntraced(function* () {
        const commands = yield* Commands;
        expect(commands).toEqual([]);

        yield* withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const videoPath = path.join(tmpDir, "sample.webm");
            const outDir = path.join(tmpDir, "frames");
            yield* fs.writeFileString(videoPath, "video");

            const ffmpeg = yield* FFmpeg;
            const result = yield* ffmpeg.extractFramesAt(
              ExtractFramesAtRequest.make({
                manifestPath: O.none(),
                outDir,
                overwrite: false,
                prefix: O.none(),
                timestampsSeconds: [0.25, 1.5],
                videoPath,
              })
            );

            expect(result.frameCount).toBe(2);
            expect(A.map(result.frames, (frame) => frame.fileName)).toEqual([
              "sample_at_00000.png",
              "sample_at_00001.png",
            ]);
            expect(A.map(result.frames, (frame) => frame.requestedTimestampSeconds)).toEqual([0.25, 1.5]);
            expect(A.sort(yield* fs.readDirectory(outDir), Order.String)).toEqual([
              "extract-frames-at-manifest.json",
              "sample_at_00000.png",
              "sample_at_00001.png",
            ]);

            const manifest = yield* decodeFramesAtManifest(
              yield* fs.readFileString(path.join(outDir, "extract-frames-at-manifest.json"))
            );
            expect(manifest.schemaVersion).toBe("beep.ffmpeg.extract-frames-at.v1");
            expect(manifest.summary.frameCount).toBe(2);
            expect(manifest.options.timestampsSeconds).toEqual([0.25, 1.5]);

            expect(A.map(commands, (command) => command.command)).toEqual(["ffprobe", "ffmpeg", "ffmpeg"]);
            const firstExtract = commands[1];
            const seekIndex = pipe(
              O.fromUndefinedOr(firstExtract),
              O.map((command) => A.findFirstIndex(command.args, (arg) => arg === "-ss")),
              O.flatten,
              O.getOrElse(() => -1)
            );
            const inputIndex = pipe(
              O.fromUndefinedOr(firstExtract),
              O.map((command) => A.findFirstIndex(command.args, (arg) => arg === "-i")),
              O.flatten,
              O.getOrElse(() => -1)
            );
            expect(seekIndex).toBeGreaterThanOrEqual(0);
            expect(seekIndex).toBeLessThan(inputIndex);
          })
        );
      })
    );
  });

  it.layer(makeTestLayer(7))("fails extract-frames-at without partial commits", (it) => {
    it.effect(
      "fails extract-frames-at without partial commits",
      Effect.fnUntraced(function* () {
        const commands = yield* Commands;
        expect(commands).toEqual([]);

        yield* withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const videoPath = path.join(tmpDir, "sample.webm");
            const outDir = path.join(tmpDir, "frames");
            yield* fs.writeFileString(videoPath, "video");

            const ffmpeg = yield* FFmpeg;
            const error = yield* Effect.flip(
              ffmpeg.extractFramesAt(
                ExtractFramesAtRequest.make({
                  manifestPath: O.none(),
                  outDir,
                  overwrite: false,
                  prefix: O.none(),
                  timestampsSeconds: [0.25, 1.5],
                  videoPath,
                })
              )
            );

            expect(error).toBeInstanceOf(FFmpegError);
            expect(error.operation).toBe("extractFramesAt");
            expect(error.message).toContain("could not extract a frame at");
            expect(yield* fs.readDirectory(outDir)).toEqual([]);
          })
        );
      })
    );
  });
  it.layer(makeTestLayer(7, true))("cleans a staged first frame when the second encode fails", (it) => {
    it.effect(
      "cleans a staged first frame when the second encode fails",
      Effect.fnUntraced(function* () {
        const commands = yield* Commands;
        expect(commands).toEqual([]);

        yield* withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const videoPath = path.join(tmpDir, "sample.webm");
            const outDir = path.join(tmpDir, "frames");
            yield* fs.writeFileString(videoPath, "video");

            const ffmpeg = yield* FFmpeg;
            const error = yield* Effect.flip(
              ffmpeg.extractFramesAt(
                ExtractFramesAtRequest.make({
                  manifestPath: O.none(),
                  outDir,
                  overwrite: false,
                  prefix: O.none(),
                  timestampsSeconds: [0.25, 1.5],
                  videoPath,
                })
              )
            );

            expect(error).toBeInstanceOf(FFmpegError);
            expect(error.operation).toBe("extractFramesAt");
            expect(error.message).toContain("could not extract a frame at");
            expect(yield* fs.readDirectory(outDir)).toEqual([]);
            const firstSucceeded = yield* FirstFrameSucceeded;
            pipe(yield* Deferred.poll(firstSucceeded), O.isSome, assertTrue);
            const firstStagedPath = yield* Deferred.await(firstSucceeded);
            expect(yield* fs.exists(firstStagedPath)).toBe(false);
            expect(yield* fs.exists(path.dirname(firstStagedPath))).toBe(false);
            expect(yield* fs.exists(path.join(outDir, "sample_at_00000.png"))).toBe(false);
            expect(yield* fs.exists(path.join(outDir, "sample_at_00001.png"))).toBe(false);
            expect(yield* fs.exists(path.join(outDir, "extract-frames-at-manifest.json"))).toBe(false);
            expect(A.sort(yield* fs.readDirectory(tmpDir), Order.String)).toEqual(["frames", "sample.webm"]);
            expect(A.map(commands, (command) => command.command)).toEqual(["ffprobe", "ffmpeg", "ffmpeg"]);
            assertSome(error.exitCode, ProcessExitCode.make(7));
          })
        );
      })
    );
  });

  it.layer(makeTestLayer())("extracts a single timestamped frame to the requested path", (it) => {
    it.effect(
      "extracts a single timestamped frame to the requested path",
      Effect.fnUntraced(function* () {
        const commands = yield* Commands;
        expect(commands).toEqual([]);

        yield* withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const videoPath = path.join(tmpDir, "sample.webm");
            const outPath = path.join(tmpDir, "frames", "pointer-down.png");
            yield* fs.writeFileString(videoPath, "video");

            const ffmpeg = yield* FFmpeg;
            const frame = yield* ffmpeg.extractFrameAt(
              ExtractFrameAtRequest.make({
                outPath,
                overwrite: false,
                timestampSeconds: 1.25,
                videoPath,
              })
            );

            expect(frame.fileName).toBe("pointer-down.png");
            expect(frame.index).toBe(0);
            expect(frame.requestedTimestampSeconds).toBe(1.25);
            expect(yield* fs.readFileString(outPath)).toBe("fake output");
          })
        );
      })
    );
  });

  it.layer(makeTestLayer())("renders a gif, surfaces fileSizeBytes, and refuses overwrites", (it) => {
    it.effect(
      "renders a gif, surfaces fileSizeBytes, and refuses overwrites",
      Effect.fnUntraced(function* () {
        const commands = yield* Commands;
        expect(commands).toEqual([]);

        yield* withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const videoPath = path.join(tmpDir, "sample.webm");
            const outPath = path.join(tmpDir, "clips", "drag.gif");
            yield* fs.writeFileString(videoPath, "video");

            const ffmpeg = yield* FFmpeg;
            const request = RenderGifRequest.make({
              dither: "bayer",
              durationSeconds: 2,
              fps: 10,
              outPath,
              overwrite: false,
              startSeconds: 1.5,
              videoPath,
            });
            const result = yield* ffmpeg.renderGif(request);

            expect(result.fileSizeBytes).toBe("fake output".length);
            expect(yield* fs.readFileString(outPath)).toBe("fake output");

            const error = yield* Effect.flip(ffmpeg.renderGif(request));
            expect(error).toBeInstanceOf(FFmpegError);
            expect(error.operation).toBe("renderGif");
            expect(error.message).toContain("Refusing to overwrite existing output");
          })
        );
      })
    );
  });

  it.layer(makeTestLayer())("extracts a re-encoded clip and reports the staged file size", (it) => {
    it.effect(
      "extracts a re-encoded clip and reports the staged file size",
      Effect.fnUntraced(function* () {
        const commands = yield* Commands;
        expect(commands).toEqual([]);

        yield* withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const videoPath = path.join(tmpDir, "sample.webm");
            const outPath = path.join(tmpDir, "clips", "drag.mp4");
            yield* fs.writeFileString(videoPath, "video");

            const ffmpeg = yield* FFmpeg;
            const request = ExtractClipRequest.make({
              codec: "h264",
              durationSeconds: O.some(2),
              outPath,
              overwrite: false,
              startSeconds: 1.5,
              videoPath,
            });
            const result = yield* ffmpeg.extractClip(request);

            assertSome(result.durationSeconds, 2);
            expect(result.startSeconds).toBe(1.5);
            expect(result.fileSizeBytes).toBe("fake output".length);
            expect(yield* fs.readFileString(outPath)).toBe("fake output");

            // The clip is cut without a probe; only the encode command runs.
            expect(A.map(commands, (command) => command.command)).toEqual(["ffmpeg"]);
            const clipCommand = commands[0];
            expect(clipCommand?.args).toContain("libx264");

            const error = yield* Effect.flip(ffmpeg.extractClip(request));
            expect(error).toBeInstanceOf(FFmpegError);
            expect(error.operation).toBe("extractClip");
            expect(error.message).toContain("Refusing to overwrite existing output");
          })
        );
      })
    );
  });

  it.layer(makeTestLayer())("renders a contact sheet spreading tiles across the probed duration", (it) => {
    it.effect(
      "renders a contact sheet spreading tiles across the probed duration",
      Effect.fnUntraced(function* () {
        const commands = yield* Commands;
        expect(commands).toEqual([]);

        yield* withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const videoPath = path.join(tmpDir, "sample.webm");
            const outPath = path.join(tmpDir, "sheets", "capture.jpg");
            yield* fs.writeFileString(videoPath, "video");

            const ffmpeg = yield* FFmpeg;
            const result = yield* ffmpeg.renderContactSheet(
              RenderContactSheetRequest.make({
                columns: 4,
                outPath,
                overwrite: false,
                quality: 5,
                rows: 4,
                tileWidth: 320,
                videoPath,
              })
            );

            expect(result.columns).toBe(4);
            expect(result.rows).toBe(4);
            expect(result.fileSizeBytes).toBe("fake output".length);

            // 16 tiles across the fixture's 2s duration = fps=8.
            const sheetCommand = commands[A.length(commands) - 1];
            expect(sheetCommand?.args).toContain("fps=8,scale=320:-1,tile=4x4");
          })
        );
      })
    );
  });

  it.layer(makeTestLayer())("routes container metadata movflags by output extension", (it) => {
    it.effect(
      "routes container metadata movflags by output extension",
      Effect.fnUntraced(function* () {
        const commands = yield* Commands;
        expect(commands).toEqual([]);

        yield* withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const videoPath = path.join(tmpDir, "sample.webm");
            yield* fs.writeFileString(videoPath, "video");

            const ffmpeg = yield* FFmpeg;
            const metadata = [MetadataPair.make({ key: "BEEP_QA_SESSION_ID", value: "session-42" })];

            yield* ffmpeg.writeContainerMetadata(
              WriteContainerMetadataRequest.make({
                metadata,
                outPath: path.join(tmpDir, "tagged.webm"),
                overwrite: false,
                videoPath,
              })
            );
            const webmCommand = commands[A.length(commands) - 1];
            expect(webmCommand?.args).toContain("BEEP_QA_SESSION_ID=session-42");
            expect(webmCommand?.args).not.toContain("use_metadata_tags");

            yield* ffmpeg.writeContainerMetadata(
              WriteContainerMetadataRequest.make({
                metadata,
                outPath: path.join(tmpDir, "tagged.mp4"),
                overwrite: false,
                videoPath,
              })
            );
            const mp4Command = commands[A.length(commands) - 1];
            expect(mp4Command?.args).toContain("use_metadata_tags");
          })
        );
      })
    );
  });

  it.layer(makeTestLayer())("parses signalstats samples from the region luminance probe", (it) => {
    it.effect(
      "parses signalstats samples from the region luminance probe",
      Effect.fnUntraced(function* () {
        const commands = yield* Commands;
        expect(commands).toEqual([]);

        yield* withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const videoPath = path.join(tmpDir, "sample.webm");
            yield* fs.writeFileString(videoPath, "video");

            const ffmpeg = yield* FFmpeg;
            const result = yield* ffmpeg.probeRegionLuminance(
              ProbeRegionLuminanceRequest.make({
                height: 128,
                videoPath,
                width: 128,
                x: 0,
                y: 0,
              })
            );

            expect(A.length(result.samples)).toBe(3);
            expect(A.map(result.samples, (sample) => sample.frameIndex)).toEqual([0, 1, 2]);
            expect(A.map(result.samples, (sample) => sample.meanLuma)).toEqual([16.5, 200.25, 70.8008]);
            expect(A.map(result.samples, (sample) => sample.ptsTimeSeconds)).toEqual([0, 0.0333333, 0.0666667]);
          })
        );
      })
    );
  });
});
