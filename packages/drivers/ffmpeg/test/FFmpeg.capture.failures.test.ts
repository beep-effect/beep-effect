import {
  ExtractClipRequest,
  ExtractFramesRequest,
  FFmpeg,
  FFmpegError,
  ProbeRegionLuminanceRequest,
  ProbeVideoRequest,
  RenderContactSheetRequest,
} from "@beep/ffmpeg";
import { Unknown } from "@beep/schema/Unknown";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, pipe, Sink, Stream } from "effect";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const encoder = new TextEncoder();
const encodeProbeJson = Unknown.encodeUnknownSyncFromJsonString;

const healthyProbeJson = encodeProbeJson({
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

// Chrome's MediaRecorder webm output routinely lands without a container
// duration; the driver must degrade rather than assume one.
const durationlessProbeJson = encodeProbeJson({
  format: {},
  streams: [{ height: 1080, width: 1920 }],
});

// ffprobe emits bare JSON numbers whenever the muxer reports numeric metadata,
// so the numeric arm of the probe parsers has to hold as well as the string arm.
const numericProbeJson = encodeProbeJson({
  format: { duration: 2 },
  streams: [
    {
      avg_frame_rate: 25,
      height: 720,
      nb_frames: 50,
      start_time: 0.5,
      width: 1280,
    },
  ],
});

const luminanceEdgeStdout = [
  // Orphan luma line ahead of any frame header.
  "lavfi.signalstats.YAVG=99.0",
  // Malformed frame header: the index is not an integer.
  "frame:abc  pts:0       pts_time:0",
  "lavfi.signalstats.YAVG=88.0",
  "frame:0    pts:0       pts_time:0",
  // Above the 8-bit ceiling; clamped rather than rejected.
  "lavfi.signalstats.YAVG=300",
  // Negative presentation timestamp: the frame header is dropped.
  "frame:1    pts:512     pts_time:-0.5",
  "lavfi.signalstats.YAVG=120",
  "not a frame header and not a luma line",
  "frame:2    pts:1024    pts_time:0.5",
  // Matches the luma line shape but is not a number; the sample is dropped.
  "lavfi.signalstats.YAVG=.",
  "frame:3    pts:2048    pts_time:1",
  // Below the floor; clamped rather than rejected.
  "lavfi.signalstats.YAVG=-12",
  "",
].join("\n");

type SpawnScript = {
  readonly ffmpegExitCode: number;
  readonly ffmpegStdout: string;
  readonly ffprobeExitCode: number;
  readonly ffprobeStdout: string;
  readonly produceOutput: boolean;
};

const defaultScript: SpawnScript = {
  ffmpegExitCode: 0,
  ffmpegStdout: "",
  ffprobeExitCode: 0,
  ffprobeStdout: healthyProbeJson,
  produceOutput: true,
};

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

/**
 * Fake spawner whose ffprobe payload, exit codes, and output-producing
 * behavior are scripted per test so failure branches can be driven directly.
 */
const makeScriptedSpawnerLayer = (
  commands: Array<ChildProcess.StandardCommand>,
  overrides: Partial<SpawnScript> = {}
) => {
  const script: SpawnScript = { ...defaultScript, ...overrides };

  return Layer.effect(
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
              return makeHandle(script.ffprobeStdout, "ffprobe stderr", script.ffprobeExitCode);
            }

            // The null muxer probe reports on stdout and writes no output file.
            if (A.contains(command.args, "null")) {
              return makeHandle(script.ffmpegStdout, "ffmpeg stderr", script.ffmpegExitCode);
            }

            const target = A.last(command.args);
            if (O.isSome(target) && script.produceOutput && script.ffmpegExitCode === 0) {
              yield* Str.includes("%0")(target.value)
                ? Effect.all([
                    fs.writeFileString(renderPatternPath(target.value, 0), "frame zero"),
                    fs.writeFileString(renderPatternPath(target.value, 1), "frame one"),
                  ])
                : fs.writeFileString(target.value, "fake output");
            }

            return makeHandle(script.ffmpegStdout, "ffmpeg stderr", script.ffmpegExitCode);
          })
        )
      );
    })
  );
};

const makeLayer = (commands: Array<ChildProcess.StandardCommand>, overrides: Partial<SpawnScript> = {}) =>
  FFmpeg.makeLayer().pipe(
    Layer.provide(makeScriptedSpawnerLayer(commands, overrides)),
    Layer.provide(NodeServices.layer)
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

const exitCodeOf = (error: FFmpegError): number =>
  pipe(
    error.exitCode,
    O.getOrElse(() => -1)
  );

describe("@beep/ffmpeg capture failures", () => {
  it.effect(
    "normalizes a missing video input into a typed driver failure",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const ffmpeg = yield* FFmpeg;

          const error = yield* Effect.flip(
            ffmpeg.probeRegionLuminance(
              ProbeRegionLuminanceRequest.make({
                height: 128,
                videoPath: path.join(tmpDir, "absent.webm"),
                width: 128,
                x: 0,
                y: 0,
              })
            )
          );

          expect(error).toBeInstanceOf(FFmpegError);
          expect(error.operation).toBe("probeRegionLuminance");
          expect(error.message).toContain("Failed to stat video input");
          // The preflight fails before anything is spawned.
          expect(A.length(commands)).toBe(0);
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands))));
    })
  );

  it.effect(
    "rejects a directory supplied as the video input",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const ffmpeg = yield* FFmpeg;

          const error = yield* Effect.flip(ffmpeg.probeVideo(ProbeVideoRequest.make({ videoPath: tmpDir })));

          expect(error).toBeInstanceOf(FFmpegError);
          expect(error.message).toContain("Expected video input to be a file");
          expect(error.operation).toBe("probeVideo");
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands))));
    })
  );

  it.effect(
    "surfaces a failed ffprobe exit with its captured process context",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const videoPath = path.join(tmpDir, "sample.webm");
          yield* fs.writeFileString(videoPath, "video");

          const ffmpeg = yield* FFmpeg;
          const error = yield* Effect.flip(ffmpeg.probeVideo(ProbeVideoRequest.make({ videoPath })));

          expect(error).toBeInstanceOf(FFmpegError);
          expect(error.operation).toBe("probeVideo");
          expect(error.message).toContain("ffprobe could not read video metadata");
          expect(exitCodeOf(error)).toBe(3);
          expect(
            pipe(
              error.stderr,
              O.getOrElse(() => "")
            )
          ).toBe("ffprobe stderr");
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands, { ffprobeExitCode: 3 }))));
    })
  );

  it.effect(
    "normalizes undecodable ffprobe output into a decode failure",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const videoPath = path.join(tmpDir, "sample.webm");
          yield* fs.writeFileString(videoPath, "video");

          const ffmpeg = yield* FFmpeg;
          const error = yield* Effect.flip(ffmpeg.probeVideo(ProbeVideoRequest.make({ videoPath })));

          expect(error).toBeInstanceOf(FFmpegError);
          expect(error.operation).toBe("probeVideo");
          expect(error.message).toContain("Failed to decode ffprobe JSON");
        })
      ).pipe(
        provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands, { ffprobeStdout: "<not json>" })))
      );
    })
  );

  it.effect(
    "reads numeric ffprobe fields as readily as string ones",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const videoPath = path.join(tmpDir, "sample.webm");
          yield* fs.writeFileString(videoPath, "video");

          const ffmpeg = yield* FFmpeg;
          const probe = yield* ffmpeg.probeVideo(ProbeVideoRequest.make({ videoPath }));

          expect(
            pipe(
              probe.durationSeconds,
              O.getOrElse(() => 0)
            )
          ).toBe(2);
          // A bare numeric frame rate carries no "/" to divide through.
          expect(
            pipe(
              probe.fps,
              O.getOrElse(() => 0)
            )
          ).toBe(25);
          expect(
            pipe(
              probe.frameCount,
              O.getOrElse(() => 0)
            )
          ).toBe(50);
          expect(
            pipe(
              probe.startTimeSeconds,
              O.getOrElse(() => -1)
            )
          ).toBe(0.5);
        })
      ).pipe(
        provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands, { ffprobeStdout: numericProbeJson })))
      );
    })
  );

  it.effect(
    "extracts frames from a container that reports no duration",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const videoPath = path.join(tmpDir, "sample.webm");
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
            })
          );

          // No duration means no expected frame count; the frames ffmpeg
          // actually produced still commit under the minimum padding.
          expect(result.frameCount).toBe(2);
          expect(A.map(result.frames, (frame) => frame.fileName)).toEqual([
            "sample_frame_00000.png",
            "sample_frame_00001.png",
          ]);
        })
      ).pipe(
        provideScopedLayer(
          Layer.mergeAll(NodeServices.layer, makeLayer(commands, { ffprobeStdout: durationlessProbeJson }))
        )
      );
    })
  );

  it.effect(
    "refuses to render a contact sheet without a positive duration",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const videoPath = path.join(tmpDir, "sample.webm");
          yield* fs.writeFileString(videoPath, "video");

          const ffmpeg = yield* FFmpeg;
          const error = yield* Effect.flip(
            ffmpeg.renderContactSheet(
              RenderContactSheetRequest.make({
                columns: 4,
                outPath: path.join(tmpDir, "sheets", "capture.jpg"),
                overwrite: false,
                quality: 5,
                rows: 4,
                tileWidth: 320,
                videoPath,
              })
            )
          );

          expect(error).toBeInstanceOf(FFmpegError);
          expect(error.operation).toBe("renderContactSheet");
          expect(error.message).toContain("reported no positive duration");
          // Only the probe ran; the tile grid was never spawned.
          expect(A.map(commands, (command) => command.command)).toEqual(["ffprobe"]);
        })
      ).pipe(
        provideScopedLayer(
          Layer.mergeAll(NodeServices.layer, makeLayer(commands, { ffprobeStdout: durationlessProbeJson }))
        )
      );
    })
  );

  it.effect(
    "surfaces a nonzero ffmpeg exit under the failing operation",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const videoPath = path.join(tmpDir, "sample.webm");
          const outPath = path.join(tmpDir, "clips", "drag.mp4");
          yield* fs.writeFileString(videoPath, "video");

          const ffmpeg = yield* FFmpeg;
          const error = yield* Effect.flip(
            ffmpeg.extractClip(
              ExtractClipRequest.make({
                codec: "vp9",
                durationSeconds: O.some(2),
                outPath,
                overwrite: false,
                startSeconds: 1.5,
                videoPath,
              })
            )
          );

          expect(error).toBeInstanceOf(FFmpegError);
          expect(error.operation).toBe("extractClip");
          expect(error.message).toContain("ffmpeg could not extract a clip from");
          expect(exitCodeOf(error)).toBe(9);
          // The staging directory is released, so nothing is left behind.
          expect(yield* fs.readDirectory(path.dirname(outPath))).toEqual([]);
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands, { ffmpegExitCode: 9 }))));
    })
  );

  it.effect(
    "fails when ffmpeg exits cleanly without writing the output",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const videoPath = path.join(tmpDir, "sample.webm");
          const outPath = path.join(tmpDir, "clips", "drag.mp4");
          yield* fs.writeFileString(videoPath, "video");

          const ffmpeg = yield* FFmpeg;
          const error = yield* Effect.flip(
            ffmpeg.extractClip(
              ExtractClipRequest.make({
                codec: "h264",
                durationSeconds: O.some(2),
                outPath,
                overwrite: false,
                startSeconds: 0,
                videoPath,
              })
            )
          );

          expect(error).toBeInstanceOf(FFmpegError);
          expect(error.operation).toBe("extractClip");
          expect(error.message).toContain("ffmpeg completed without producing output");
          expect(yield* fs.exists(outPath)).toBe(false);
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands, { produceOutput: false }))));
    })
  );

  it.effect(
    "surfaces a nonzero exit from the region luminance probe",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

      yield* withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const videoPath = path.join(tmpDir, "sample.webm");
          yield* fs.writeFileString(videoPath, "video");

          const ffmpeg = yield* FFmpeg;
          const error = yield* Effect.flip(
            ffmpeg.probeRegionLuminance(
              ProbeRegionLuminanceRequest.make({
                height: 64,
                videoPath,
                width: 64,
                x: 8,
                y: 8,
              })
            )
          );

          expect(error).toBeInstanceOf(FFmpegError);
          expect(error.operation).toBe("probeRegionLuminance");
          expect(error.message).toContain("ffmpeg could not sample region luminance");
          expect(exitCodeOf(error)).toBe(4);
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, makeLayer(commands, { ffmpegExitCode: 4 }))));
    })
  );

  it.effect(
    "skips malformed frame headers, orphan luma lines, and clamps out-of-range luma",
    Effect.fnUntraced(function* () {
      const commands: Array<ChildProcess.StandardCommand> = [];

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

          expect(A.map(result.samples, (sample) => sample.frameIndex)).toEqual([0, 3]);
          expect(A.map(result.samples, (sample) => sample.meanLuma)).toEqual([255, 0]);
          expect(A.map(result.samples, (sample) => sample.ptsTimeSeconds)).toEqual([0, 1]);
        })
      ).pipe(
        provideScopedLayer(
          Layer.mergeAll(NodeServices.layer, makeLayer(commands, { ffmpegStdout: luminanceEdgeStdout }))
        )
      );
    })
  );
});
