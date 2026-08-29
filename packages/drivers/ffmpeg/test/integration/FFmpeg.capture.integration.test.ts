import {
  ExtractClipRequest,
  ExtractFrameAtRequest,
  ExtractFramesAtRequest,
  FFmpeg,
  MetadataPair,
  ProbeRegionLuminanceRequest,
  ProbeVideoRequest,
  RenderContactSheetRequest,
  RenderGifRequest,
  WriteContainerMetadataRequest,
} from "@beep/ffmpeg";
import { A, Str, thunkEmptyStr } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, pipe, Stream } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

// Live lane: exercises the real ffmpeg/ffprobe binaries on PATH. Skips
// cleanly (logInfo, no assertions) on machines without ffmpeg.
const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const provideLive = provideScopedLayer(
  Layer.mergeAll(NodeServices.layer, FFmpeg.makeLayer().pipe(Layer.provide(NodeServices.layer)))
);

const skipNotice = Effect.logInfo("Skipping the live ffmpeg capture lane because ffmpeg is not runnable on PATH.");

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<string, E> =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(thunkEmptyStr, (acc, chunk) => `${acc}${chunk}`)
  );

const runTool = (command: string, args: ReadonlyArray<string>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const handle = yield* spawner.spawn(
        ChildProcess.make(command, args, { stdin: "ignore", stderr: "pipe", stdout: "pipe" })
      );
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [collectText(handle.stdout), collectText(handle.stderr), handle.exitCode],
        { concurrency: "unbounded" }
      );
      return { exitCode, stderr, stdout };
    })
  );

const ffmpegAvailable = runTool("ffmpeg", ["-version"]).pipe(
  Effect.map((result) => result.exitCode === 0),
  Effect.orElseSucceed(() => false)
);

const expectToolSuccess = Effect.fnUntraced(function* (command: string, args: ReadonlyArray<string>) {
  const result = yield* runTool(command, args);
  expect(result.exitCode).toBe(0);
  return result;
});

/** 2s 320x180 30fps testsrc2 golden clip. */
const makeTestsrcClip = (outPath: string) =>
  expectToolSuccess("ffmpeg", [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=duration=2:size=320x180:rate=30",
    "-pix_fmt",
    "yuv420p",
    outPath,
  ]);

/**
 * 2s 64x64 10fps clip whose luma rises linearly with time: Y = 255*T/2.
 * Reading a frame's mean luma therefore reveals which source time the frame
 * was taken from — a machine-checkable pts-accuracy oracle.
 */
const makeLumaRampClip = (outPath: string) =>
  expectToolSuccess("ffmpeg", [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=black:size=64x64:rate=10:duration=2",
    "-vf",
    "geq=lum=255*T/2:cb=128:cr=128",
    "-c:v",
    "libx264",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    outPath,
  ]);

const FfprobeFormatTags = S.fromJsonString(
  S.Struct({
    format: S.Struct({
      tags: S.Record(S.String, S.String),
    }),
  })
);
const decodeFormatTags = S.decodeUnknownSync(FfprobeFormatTags);

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

const RAMP_FRAME_DURATION_SECONDS = 0.1;
const LUMA_TOLERANCE_SECONDS = 0.05;

describe("@beep/ffmpeg live capture", () => {
  it.live(
    "extracts pts-accurate timestamped frames from the luma-ramp golden clip",
    () =>
      Effect.gen(function* () {
        if (!(yield* ffmpegAvailable)) {
          return yield* skipNotice;
        }

        yield* withTempDirectory(
          Effect.fnUntraced(function* (tmpDir) {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const videoPath = path.join(tmpDir, "ramp.mp4");
            const outDir = path.join(tmpDir, "frames");
            yield* makeLumaRampClip(videoPath);

            const ffmpeg = yield* FFmpeg;
            const timestamps = [0.35, 1, 1.85];
            const result = yield* ffmpeg.extractFramesAt(
              ExtractFramesAtRequest.make({
                manifestPath: O.none(),
                outDir,
                overwrite: false,
                prefix: O.none(),
                timestampsSeconds: timestamps,
                videoPath,
              })
            );

            expect(result.frameCount).toBe(3);
            expect(yield* fs.exists(result.manifestPath)).toBe(true);

            // pts accuracy: each frame's mean luma implies the source time the
            // frame was decoded at; it must land within one frame duration of
            // the requested timestamp (input-seek grabs the first frame at or
            // after the seek point).
            for (const frame of result.frames) {
              const probe = yield* ffmpeg.probeRegionLuminance(
                ProbeRegionLuminanceRequest.make({
                  height: 64,
                  videoPath: frame.path,
                  width: 64,
                  x: 0,
                  y: 0,
                })
              );
              const meanLuma = pipe(
                A.head(probe.samples),
                O.map((sample) => sample.meanLuma),
                O.getOrElse(() => -1)
              );
              expect(meanLuma).toBeGreaterThanOrEqual(0);
              const impliedTimeSeconds = (meanLuma * 2) / 255;
              const drift = impliedTimeSeconds - frame.requestedTimestampSeconds;
              expect(Math.abs(drift)).toBeLessThanOrEqual(RAMP_FRAME_DURATION_SECONDS + LUMA_TOLERANCE_SECONDS);
            }
          })
        );
      }).pipe(provideLive),
    120_000
  );

  it.live(
    "renders gif and contact sheet artifacts with real byte sizes",
    () =>
      Effect.gen(function* () {
        if (!(yield* ffmpegAvailable)) {
          return yield* skipNotice;
        }

        yield* withTempDirectory(
          Effect.fnUntraced(function* (tmpDir) {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const videoPath = path.join(tmpDir, "clip.mp4");
            yield* makeTestsrcClip(videoPath);

            const ffmpeg = yield* FFmpeg;

            const gifPath = path.join(tmpDir, "clips", "window.gif");
            const gif = yield* ffmpeg.renderGif(
              RenderGifRequest.make({
                dither: "bayer",
                durationSeconds: 1,
                fps: 10,
                outPath: gifPath,
                overwrite: false,
                startSeconds: 0.2,
                videoPath,
              })
            );
            expect(gif.fileSizeBytes).toBeGreaterThan(0);
            const gifStat = yield* fs.stat(gifPath);
            expect(Number(gifStat.size)).toBe(gif.fileSizeBytes);

            const sheetPath = path.join(tmpDir, "sheets", "clip.jpg");
            const sheet = yield* ffmpeg.renderContactSheet(
              RenderContactSheetRequest.make({
                columns: 4,
                outPath: sheetPath,
                overwrite: false,
                quality: 5,
                rows: 4,
                tileWidth: 320,
                videoPath,
              })
            );
            expect(sheet.fileSizeBytes).toBeGreaterThan(0);
            const sheetStat = yield* fs.stat(sheetPath);
            expect(Number(sheetStat.size)).toBe(sheet.fileSizeBytes);

            const framePath = path.join(tmpDir, "frames", "single.png");
            const frame = yield* ffmpeg.extractFrameAt(
              ExtractFrameAtRequest.make({
                outPath: framePath,
                overwrite: false,
                timestampSeconds: 0.5,
                videoPath,
              })
            );
            expect(frame.fileName).toBe("single.png");
            expect(yield* fs.exists(framePath)).toBe(true);
          })
        );
      }).pipe(provideLive),
    120_000
  );

  it.live(
    "cuts clips and round-trips BEEP_QA_SESSION_ID container metadata via ffprobe",
    () =>
      Effect.gen(function* () {
        if (!(yield* ffmpegAvailable)) {
          return yield* skipNotice;
        }

        yield* withTempDirectory(
          Effect.fnUntraced(function* (tmpDir) {
            const path = yield* Path.Path;
            const videoPath = path.join(tmpDir, "clip.mp4");
            yield* makeTestsrcClip(videoPath);

            const ffmpeg = yield* FFmpeg;

            const sourceProbe = yield* ffmpeg.probeVideo(ProbeVideoRequest.make({ videoPath }));
            expect(
              pipe(
                sourceProbe.rFrameRate,
                O.getOrElse(() => 0)
              )
            ).toBe(30);
            expect(O.isSome(sourceProbe.startTimeSeconds)).toBe(true);

            const clipPath = path.join(tmpDir, "clips", "cut.webm");
            const clip = yield* ffmpeg.extractClip(
              ExtractClipRequest.make({
                codec: "vp9",
                durationSeconds: O.some(1),
                outPath: clipPath,
                overwrite: false,
                startSeconds: 0.25,
                videoPath,
              })
            );
            expect(clip.fileSizeBytes).toBeGreaterThan(0);

            const clipProbe = yield* ffmpeg.probeVideo(ProbeVideoRequest.make({ videoPath: clipPath }));
            const clipDuration = pipe(
              clipProbe.durationSeconds,
              O.getOrElse(() => 0)
            );
            expect(clipDuration).toBeGreaterThanOrEqual(0.8);
            expect(clipDuration).toBeLessThanOrEqual(1.2);

            const sessionId = "beep-qa-integration-session";
            const metadata = [MetadataPair.make({ key: "BEEP_QA_SESSION_ID", value: sessionId })];

            const taggedWebmPath = path.join(tmpDir, "tagged", "cut.webm");
            yield* ffmpeg.writeContainerMetadata(
              WriteContainerMetadataRequest.make({
                metadata,
                outPath: taggedWebmPath,
                overwrite: false,
                videoPath: clipPath,
              })
            );

            const taggedMp4Path = path.join(tmpDir, "tagged", "clip.mp4");
            yield* ffmpeg.writeContainerMetadata(
              WriteContainerMetadataRequest.make({
                metadata,
                outPath: taggedMp4Path,
                overwrite: false,
                videoPath,
              })
            );

            for (const taggedPath of [taggedWebmPath, taggedMp4Path]) {
              const probeResult = yield* expectToolSuccess("ffprobe", [
                "-v",
                "error",
                "-show_entries",
                "format_tags=BEEP_QA_SESSION_ID",
                "-of",
                "json",
                taggedPath,
              ]);
              const tags = decodeFormatTags(Str.trim(probeResult.stdout));
              expect(tags.format.tags.BEEP_QA_SESSION_ID).toBe(sessionId);
            }
          })
        );
      }).pipe(provideLive),
    120_000
  );
});
