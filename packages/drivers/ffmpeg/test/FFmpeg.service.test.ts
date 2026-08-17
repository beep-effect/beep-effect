import {
  buildExtractFramesArgs,
  buildFfprobeArgs,
  ExtractFramesManifest,
  ExtractFramesRequest,
  FFmpeg,
  FFmpegError,
  FFmpegErrorContext,
  FFmpegErrorFromUnknownOptions,
  FFmpegEvent,
  FFmpegProgressEvent,
  FFmpegProgressPercent,
  FrameCount,
  FrameIndex,
  formatFrameFileName,
  PositiveFrameRate,
  PositiveMilliseconds,
  ProbeVideoRequest,
  ProcessExitCode,
  SafeFramePrefix,
  VideoDimension,
  VideoProbe,
} from "@beep/ffmpeg";
import { Unknown } from "@beep/schema/Unknown";
import { fcRuns } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal, FileSystem, Layer, Order, Path, pipe, Sink, Stream } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

type FFmpegEventValue = FFmpegEvent;

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const encoder = new TextEncoder();
const decodeManifest = S.decodeUnknownSync(S.fromJsonString(ExtractFramesManifest));

const assertRoundTrip = <Schema extends S.Codec<unknown, unknown>>(schema: Schema): void => {
  const encode = S.encodeSync(schema);
  const decode = S.decodeUnknownSync(schema);

  fc.assert(
    fc.property(S.toArbitrary(schema)(fc), (value) => {
      expect(Equal.equals(decode(encode(value)), value)).toBe(true);
    }),
    fcRuns(25)
  );
};

// TODO(effect-native-migration): model schema
const ffprobeJson = Unknown.encodeUnknownSyncFromJsonString({
  format: { duration: "2.0" },
  streams: [
    {
      avg_frame_rate: "30/1",
      duration: "2.0",
      height: 1080,
      nb_frames: "60",
      width: 1920,
    },
  ],
});

const makeStream = (text: string) => (text.length === 0 ? Stream.empty : Stream.succeed(encoder.encode(text)));

const makeHandle = (stdout: string, stderr = "", exitCode = 0): ChildProcessSpawner.ChildProcessHandle =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
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

const renderPatternPath = (pattern: string, index: number): string =>
  Str.replaceWith(/%0(\d+)d/, (_match, width) => pipe(`${index}`, Str.padStart(Number(width), "0")))(pattern);

const makeFakeSpawnerLayer = (commands: Array<ChildProcess.StandardCommand>, exitCode = 0) =>
  Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
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

            const pattern = A.get(command.args, A.length(command.args) - 1);
            if (O.isSome(pattern) && exitCode === 0) {
              yield* fs.writeFileString(renderPatternPath(pattern.value, 0), "frame zero");
              yield* fs.writeFileString(renderPatternPath(pattern.value, 1), "frame one");
            }

            return makeHandle("frame=1\nprogress=continue\nframe=2\nprogress=end\n", "ffmpeg stderr", exitCode);
          })
        )
      );
    })
  );

const makeLayer = (commands: Array<ChildProcess.StandardCommand>, exitCode = 0) =>
  FFmpeg.makeLayer().pipe(Layer.provide(makeFakeSpawnerLayer(commands, exitCode)), Layer.provide(NodeServices.layer));

const withTempDirectory = <A, E, R>(use: (tmpDir: string) => Effect.Effect<A, E, R>) =>
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

describe("@beep/ffmpeg", () => {
  it("round-trips schema-modeled public payloads", () => {
    assertRoundTrip(PositiveFrameRate);
    assertRoundTrip(PositiveMilliseconds);
    assertRoundTrip(SafeFramePrefix);
    assertRoundTrip(FrameIndex);
    assertRoundTrip(FrameCount);
    assertRoundTrip(VideoDimension);
    assertRoundTrip(FFmpegProgressPercent);
    assertRoundTrip(ProcessExitCode);
    assertRoundTrip(ProbeVideoRequest);
    assertRoundTrip(VideoProbe);
    assertRoundTrip(ExtractFramesRequest);
    assertRoundTrip(FFmpegProgressEvent);
    assertRoundTrip(FFmpegEvent);
    assertRoundTrip(ExtractFramesManifest);
    assertRoundTrip(FFmpegErrorContext);

    const encodeErrorOptions = S.encodeSync(FFmpegErrorFromUnknownOptions);
    const decodeErrorOptions = S.decodeUnknownSync(FFmpegErrorFromUnknownOptions);
    fc.assert(
      fc.property(
        S.toArbitrary(FFmpegErrorFromUnknownOptions)(fc).filter((options) => O.isNone(options.cause)),
        (options) => {
          expect(Equal.equals(decodeErrorOptions(encodeErrorOptions(options)), options)).toBe(true);
        }
      ),
      fcRuns(25)
    );
  });

  it("keeps Option-modeled optional metadata encoded as omitted keys", () => {
    expect(
      S.encodeSync(VideoProbe)(
        VideoProbe.make({
          videoPath: "./clip.mp4",
          durationSeconds: O.some(2),
          fps: O.some(30),
          frameCount: O.some(60),
          height: O.some(1080),
          width: O.some(1920),
        })
      )
    ).toEqual({
      videoPath: "./clip.mp4",
      durationSeconds: 2,
      fps: 30,
      frameCount: 60,
      height: 1080,
      width: 1920,
    });

    expect(S.encodeSync(VideoProbe)(VideoProbe.make({ videoPath: "./clip.mp4" }))).toEqual({
      videoPath: "./clip.mp4",
    });

    expect(
      S.encodeSync(FFmpegProgressEvent)(
        FFmpegProgressEvent.make({
          frameCount: 1,
          kind: "progress",
          outTimeSeconds: O.some(0.5),
          percent: 50,
          progress: "continue",
          speed: O.some("1x"),
        })
      )
    ).toEqual({
      frameCount: 1,
      kind: "progress",
      outTimeSeconds: 0.5,
      percent: 50,
      progress: "continue",
      speed: "1x",
    });

    expect(
      S.encodeSync(FFmpegProgressEvent)(
        FFmpegProgressEvent.make({
          frameCount: 1,
          kind: "progress",
          percent: 50,
          progress: "continue",
        })
      )
    ).toEqual({
      frameCount: 1,
      kind: "progress",
      percent: 50,
      progress: "continue",
    });
  });

  it("formats frame names and command arguments", () => {
    expect(
      formatFrameFileName({
        index: 7,
        padding: 5,
        prefix: "clip_frame",
      })
    ).toBe("clip_frame_00007.png");
    expect(buildFfprobeArgs(ProbeVideoRequest.make({ videoPath: "./clip.mp4" }))).toContain("./clip.mp4");
    expect(
      buildExtractFramesArgs({
        fps: "1",
        outputPattern: "./frames/frame_%05d.png",
        videoPath: "./clip.mp4",
      })
    ).toEqual([
      "-hide_banner",
      "-nostdin",
      "-y",
      "-i",
      "./clip.mp4",
      "-vf",
      "fps=1",
      "-start_number",
      "0",
      "-progress",
      "pipe:1",
      "-nostats",
      "-f",
      "image2",
      "./frames/frame_%05d.png",
    ]);
  });

  it.effect("probes video metadata through the fake child-process layer", () => {
    const commands: Array<ChildProcess.StandardCommand> = [];

    return withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const videoPath = path.join(tmpDir, "clip.mp4");
        yield* fs.writeFileString(videoPath, "video");

        const ffmpeg = yield* FFmpeg;
        const probe = yield* ffmpeg.probeVideo(ProbeVideoRequest.make({ videoPath }));

        expect(
          pipe(
            probe.width,
            O.getOrElse(() => 0)
          )
        ).toBe(1920);
        expect(
          pipe(
            probe.height,
            O.getOrElse(() => 0)
          )
        ).toBe(1080);
        expect(
          pipe(
            probe.durationSeconds,
            O.getOrElse(() => 0)
          )
        ).toBe(2);
        expect(
          pipe(
            probe.fps,
            O.getOrElse(() => 0)
          )
        ).toBe(30);
        expect(
          pipe(
            probe.frameCount,
            O.getOrElse(() => 0)
          )
        ).toBe(60);
        expect(commands[0]?.command).toBe("ffprobe");
      })
    ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands))));
  });

  it.effect(
    "extracts frames into final names and writes the default manifest",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];
      const events: Array<FFmpegEventValue> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const videoPath = path.join(tmpDir, "sample.mp4");
          const outDir = path.join(tmpDir, "frames");
          yield* fs.writeFileString(videoPath, "video");

          const ffmpeg = yield* FFmpeg;
          const result = yield* ffmpeg.extractFrames(
            ExtractFramesRequest.make({
              fps: 1,
              manifestPath: O.none(),
              outDir,
              overwrite: false,
              prefix: O.none(),
              videoPath,
            }),
            (event) =>
              Effect.sync(() => {
                events[A.length(events)] = event;
              })
          );

          expect(result.frameCount).toBe(2);
          expect(A.sort(yield* fs.readDirectory(outDir), Order.String)).toEqual([
            "extract-frames-manifest.json",
            "sample_frame_00000.png",
            "sample_frame_00001.png",
          ]);

          const manifest = decodeManifest(yield* fs.readFileString(path.join(outDir, "extract-frames-manifest.json")));
          expect(manifest.summary.frameCount).toBe(2);
          expect(manifest.options.prefix).toBe("sample_frame");
          expect(A.map(events, (event) => event.kind)).toEqual(["started", "progress", "progress", "completed"]);
          expect(A.map(commands, (command) => command.command)).toEqual(["ffprobe", "ffmpeg"]);
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands))));
    })
  );

  it.effect(
    "fails before overwriting an existing frame target",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const videoPath = path.join(tmpDir, "sample.mp4");
          const outDir = path.join(tmpDir, "frames");
          yield* fs.makeDirectory(outDir, { recursive: true });
          yield* fs.writeFileString(videoPath, "video");
          yield* fs.writeFileString(path.join(outDir, "sample_frame_00000.png"), "existing");

          const ffmpeg = yield* FFmpeg;
          const error = yield* Effect.flip(
            ffmpeg.extractFrames(
              ExtractFramesRequest.make({
                fps: 1,
                manifestPath: O.none(),
                outDir,
                overwrite: false,
                prefix: O.none(),
                videoPath,
              })
            )
          );

          expect(error).toBeInstanceOf(FFmpegError);
          expect(error.message).toContain("Refusing to overwrite existing frame output");
          expect(yield* fs.readFileString(path.join(outDir, "sample_frame_00000.png"))).toBe("existing");
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands))));
    })
  );

  it.effect(
    "normalizes failed ffmpeg exits into FFmpegError",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const videoPath = path.join(tmpDir, "sample.mp4");
          const outDir = path.join(tmpDir, "frames");
          yield* fs.writeFileString(videoPath, "video");

          const ffmpeg = yield* FFmpeg;
          const error = yield* Effect.flip(
            ffmpeg.extractFrames(
              ExtractFramesRequest.make({
                fps: 1,
                manifestPath: O.none(),
                outDir,
                overwrite: false,
                prefix: O.none(),
                videoPath,
              })
            )
          );

          expect(error).toBeInstanceOf(FFmpegError);
          expect(error.message).toContain("ffmpeg could not extract frames");
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands, 7))));
    })
  );
});
