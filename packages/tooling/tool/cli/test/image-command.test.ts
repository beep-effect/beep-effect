import { ExtractFramesManifest, FFmpegError } from "@beep/ffmpeg";
import { imageCommand } from "@beep/repo-cli";
import { ImageCommandError } from "@beep/repo-cli/commands/Image";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Cause, Effect, Exit, FileSystem, Layer, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { ChildProcess } from "effect/unstable/process";
import { describe, expect, it } from "vitest";
import type * as PlatformError from "effect/PlatformError";
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const testLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer);
const runImageCommand = Command.runWith(imageCommand, { version: "0.0.0" });
const decodeManifest = S.decodeUnknownSync(S.fromJsonString(ExtractFramesManifest));
const CLI_ENTRYPOINT = new URL("../src/bin.ts", import.meta.url).pathname;

const firstFailure = <E>(cause: Cause.Cause<E>): O.Option<E> => Cause.findErrorOption(cause);

const withTempDirectory = <A, E, R>(use: (tmpDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectory();
      const previousCwd = process.cwd();

      process.chdir(tmpDir);

      return { fs, previousCwd, tmpDir } as const;
    }),
    ({ tmpDir }) => use(tmpDir),
    ({ fs, previousCwd, tmpDir }) =>
      Effect.gen(function* () {
        process.chdir(previousCwd);
        yield* fs.remove(tmpDir, { recursive: true, force: true });
      })
  ).pipe(provideScopedLayer(testLayer));

const withPathPrefix = <A, E, R>(pathPrefix: string, use: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previousPath = Bun.env.PATH;
      Bun.env.PATH = `${pathPrefix}:${previousPath ?? ""}`;
      return previousPath;
    }),
    () => use,
    (previousPath) =>
      Effect.sync(() => {
        Bun.env.PATH = previousPath;
      })
  );

const sortedDirectoryEntries = Effect.fn("ImageTest.sortedDirectoryEntries")(function* (dir: string) {
  const fs = yield* FileSystem.FileSystem;
  return A.sort(yield* fs.readDirectory(dir), Order.String);
});

const writeFfprobeShim = Effect.fn("ImageTest.writeFfprobeShim")(function* (binDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const shimPath = path.join(binDir, "ffprobe");
  yield* fs.makeDirectory(binDir, { recursive: true });
  yield* fs.writeFileString(
    shimPath,
    `#!/usr/bin/env sh\nprintf '%s\\n' '{"streams":[{"width":4,"height":3,"duration":"2.0","avg_frame_rate":"30/1","nb_frames":"60"}],"format":{"duration":"2.0"}}'\n`
  );
  yield* fs.chmod(shimPath, 0o755);
});

const writeExtractFramesFfmpegShim = Effect.fn("ImageTest.writeExtractFramesFfmpegShim")(function* (
  binDir: string,
  argsPath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const shimPath = path.join(binDir, "ffmpeg");
  yield* fs.makeDirectory(binDir, { recursive: true });
  yield* fs.writeFileString(
    shimPath,
    `#!/usr/bin/env sh
printf '%s\\n' "$@" > '${argsPath}'
last=''
for arg do last="$arg"; done
first="$(printf '%s\\n' "$last" | sed 's/%0[0-9][0-9]*d/00000/')"
second="$(printf '%s\\n' "$last" | sed 's/%0[0-9][0-9]*d/00001/')"
printf '%s\\n' 'frame zero' > "$first"
printf '%s\\n' 'frame one' > "$second"
printf '%s\\n' 'frame=1' 'progress=continue' 'frame=2' 'progress=end'
`
  );
  yield* fs.chmod(shimPath, 0o755);
});

const writeConditionalExtractFramesFfmpegShim = Effect.fn("ImageTest.writeConditionalExtractFramesFfmpegShim")(
  function* (binDir: string, argsPath: string, failingVideoPath: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const shimPath = path.join(binDir, "ffmpeg");
    yield* fs.makeDirectory(binDir, { recursive: true });
    yield* fs.writeFileString(
      shimPath,
      `#!/usr/bin/env sh
printf '%s\\n' "$@" >> '${argsPath}'
case " $* " in
  *'${failingVideoPath}'*)
    printf '%s\\n' 'intentional ffmpeg failure for test' >&2
    exit 2
    ;;
esac
last=''
for arg do last="$arg"; done
first="$(printf '%s\\n' "$last" | sed 's/%0[0-9][0-9]*d/00000/')"
second="$(printf '%s\\n' "$last" | sed 's/%0[0-9][0-9]*d/00001/')"
printf '%s\\n' 'frame zero' > "$first"
printf '%s\\n' 'frame one' > "$second"
printf '%s\\n' 'frame=1' 'progress=continue' 'frame=2' 'progress=end'
`
    );
    yield* fs.chmod(shimPath, 0o755);
  }
);

const runCliCommand = (
  cwd: string,
  pathPrefix: string,
  ...args: ReadonlyArray<string>
): Effect.Effect<
  { readonly exitCode: number; readonly output: string },
  PlatformError.PlatformError,
  ChildProcessSpawner
> =>
  Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("bun", ["run", CLI_ENTRYPOINT, "--", ...args], {
        cwd,
        env: {
          PATH: `${pathPrefix}:${Bun.env.PATH ?? ""}`,
        },
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = yield* handle.all.pipe(Stream.decodeText(), Stream.runCollect, Effect.map(A.join("")));
      const exitCode = yield* handle.exitCode;
      return { exitCode, output } as const;
    })
  );

describe("image command", { concurrent: false }, () => {
  it("extracts frames, writes the default manifest, and prints a non-TTY summary", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const binDir = path.join(tmpDir, "bin");
          const argsPath = path.join(tmpDir, "ffmpeg-args.txt");
          const videoPath = path.join(tmpDir, "clip.mp4");
          const outDir = path.join(tmpDir, "frames");

          yield* fs.writeFileString(videoPath, "video");
          yield* writeFfprobeShim(binDir);
          yield* writeExtractFramesFfmpegShim(binDir, argsPath);
          yield* withPathPrefix(
            binDir,
            runImageCommand(["extract-frames", "--video", videoPath, "--out-dir", outDir, "--fps", "1"])
          );

          expect(yield* sortedDirectoryEntries(outDir)).toEqual([
            "clip_frame_00000.png",
            "clip_frame_00001.png",
            "extract-frames-manifest.json",
          ]);
          const manifest = decodeManifest(yield* fs.readFileString(path.join(outDir, "extract-frames-manifest.json")));
          expect(manifest.summary.frameCount).toBe(2);
          expect(manifest.options.fps).toBe(1);
          expect(manifest.options.prefix).toBe("clip_frame");
          expect(pipe(yield* fs.readFileString(argsPath), (value) => Str.includes("fps=1")(value))).toBe(true);
          expect(yield* TestConsole.logLines).toEqual([
            `image extract-frames: wrote 2 frame(s) to ${outDir}. manifest: ${path.join(outDir, "extract-frames-manifest.json")}`,
          ]);
          expect(process.exitCode ?? 0).toBe(0);
        })
      )
    ));

  it("fails instead of overwriting existing frame outputs without --overwrite", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const binDir = path.join(tmpDir, "bin");
          const argsPath = path.join(tmpDir, "ffmpeg-args.txt");
          const videoPath = path.join(tmpDir, "clip.mp4");
          const outDir = path.join(tmpDir, "frames");

          yield* fs.makeDirectory(outDir, { recursive: true });
          yield* fs.writeFileString(videoPath, "video");
          yield* fs.writeFileString(path.join(outDir, "clip_frame_00000.png"), "existing");
          yield* writeFfprobeShim(binDir);
          yield* writeExtractFramesFfmpegShim(binDir, argsPath);
          const exit = yield* Effect.exit(
            withPathPrefix(
              binDir,
              runImageCommand(["extract-frames", "--video", videoPath, "--out-dir", outDir, "--fps", "1"])
            )
          );

          expect(yield* fs.readFileString(path.join(outDir, "clip_frame_00000.png"))).toBe("existing");
          expect(yield* TestConsole.errorLines).toEqual([]);
          expect(process.exitCode ?? 0).toBe(0);
          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const failure = firstFailure(exit.cause);
            expect(O.isSome(failure)).toBe(true);
            if (O.isSome(failure)) {
              expect(failure.value).toBeInstanceOf(FFmpegError);
              expect(failure.value.message).toBe(
                `Refusing to overwrite existing frame output: "${path.join(outDir, "clip_frame_00000.png")}"`
              );
            }
          }
        })
      )
    ));

  it("extracts frames for every direct video into sibling stem folders", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const binDir = path.join(tmpDir, "bin");
          const argsPath = path.join(tmpDir, "ffmpeg-args.txt");
          const videoDir = path.join(tmpDir, "videos");

          yield* fs.makeDirectory(videoDir, { recursive: true });
          yield* fs.writeFileString(path.join(videoDir, "clip.mp4"), "video");
          yield* fs.writeFileString(path.join(videoDir, "trailer.mov"), "video");
          yield* fs.writeFileString(path.join(videoDir, "notes.txt"), "not video");
          yield* writeFfprobeShim(binDir);
          yield* writeExtractFramesFfmpegShim(binDir, argsPath);
          yield* withPathPrefix(binDir, runImageCommand(["extract-frames-dir", "--dir", videoDir, "--fps", "1"]));

          expect(yield* sortedDirectoryEntries(path.join(videoDir, "clip"))).toEqual([
            "clip_frame_00000.png",
            "clip_frame_00001.png",
            "extract-frames-manifest.json",
          ]);
          expect(yield* sortedDirectoryEntries(path.join(videoDir, "trailer"))).toEqual([
            "extract-frames-manifest.json",
            "trailer_frame_00000.png",
            "trailer_frame_00001.png",
          ]);
          const clipManifest = decodeManifest(
            yield* fs.readFileString(path.join(videoDir, "clip", "extract-frames-manifest.json"))
          );
          expect(clipManifest.options.prefix).toBe("clip_frame");
          expect(clipManifest.summary.frameCount).toBe(2);
          expect(yield* TestConsole.logLines).toEqual([
            `image extract-frames-dir: clip.mp4: wrote 2 frame(s) to ${path.join(videoDir, "clip")}. manifest: ${path.join(videoDir, "clip", "extract-frames-manifest.json")}`,
            `image extract-frames-dir: trailer.mov: wrote 2 frame(s) to ${path.join(videoDir, "trailer")}. manifest: ${path.join(videoDir, "trailer", "extract-frames-manifest.json")}`,
            "image extract-frames-dir: processed 2 video(s); succeeded 2; failed 0.",
          ]);
        })
      )
    ));

  it("fails extract-frames-dir when no direct videos are found", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const videoDir = path.join(tmpDir, "videos");

          yield* fs.makeDirectory(videoDir, { recursive: true });
          yield* fs.writeFileString(path.join(videoDir, "notes.txt"), "not video");
          const exit = yield* Effect.exit(runImageCommand(["extract-frames-dir", "--dir", videoDir, "--fps", "1"]));

          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const failure = firstFailure(exit.cause);
            expect(O.isSome(failure)).toBe(true);
            if (O.isSome(failure)) {
              expect(failure.value).toBeInstanceOf(ImageCommandError);
              expect(failure.value.message).toBe("image extract-frames-dir: no direct video files found.");
            }
          }
        })
      )
    ));

  it("preflights same-stem videos before extracting frames", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const binDir = path.join(tmpDir, "bin");
          const argsPath = path.join(tmpDir, "ffmpeg-args.txt");
          const videoDir = path.join(tmpDir, "videos");

          yield* fs.makeDirectory(videoDir, { recursive: true });
          yield* fs.writeFileString(path.join(videoDir, "clip.mp4"), "video");
          yield* fs.writeFileString(path.join(videoDir, "clip.mov"), "video");
          yield* writeFfprobeShim(binDir);
          yield* writeExtractFramesFfmpegShim(binDir, argsPath);
          const exit = yield* Effect.exit(
            withPathPrefix(binDir, runImageCommand(["extract-frames-dir", "--dir", videoDir, "--fps", "1"]))
          );

          expect(Exit.isFailure(exit)).toBe(true);
          expect(yield* fs.exists(argsPath)).toBe(false);
          if (Exit.isFailure(exit)) {
            const failure = firstFailure(exit.cause);
            expect(O.isSome(failure)).toBe(true);
            if (O.isSome(failure)) {
              expect(failure.value).toBeInstanceOf(ImageCommandError);
              expect(failure.value.message).toBe(
                `image extract-frames-dir: multiple videos would write to "${path.join(videoDir, "clip")}".`
              );
            }
          }
        })
      )
    ));

  it("continues through per-video failures and exits nonzero after the summary", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const binDir = path.join(tmpDir, "bin");
          const argsPath = path.join(tmpDir, "ffmpeg-args.txt");
          const videoDir = path.join(tmpDir, "videos");
          const badPath = path.join(videoDir, "bad.mp4");

          yield* fs.makeDirectory(videoDir, { recursive: true });
          yield* fs.writeFileString(badPath, "video");
          yield* fs.writeFileString(path.join(videoDir, "good.mp4"), "video");
          yield* writeFfprobeShim(binDir);
          yield* writeConditionalExtractFramesFfmpegShim(binDir, argsPath, badPath);
          const exit = yield* Effect.exit(
            withPathPrefix(binDir, runImageCommand(["extract-frames-dir", "--dir", videoDir, "--fps", "1"]))
          );

          expect(yield* sortedDirectoryEntries(path.join(videoDir, "good"))).toEqual([
            "extract-frames-manifest.json",
            "good_frame_00000.png",
            "good_frame_00001.png",
          ]);
          expect(yield* TestConsole.errorLines).toEqual([
            `image extract-frames-dir: bad.mp4: failed: ffmpeg could not extract frames for "${badPath}".`,
          ]);
          expect(yield* TestConsole.logLines).toEqual([
            `image extract-frames-dir: good.mp4: wrote 2 frame(s) to ${path.join(videoDir, "good")}. manifest: ${path.join(videoDir, "good", "extract-frames-manifest.json")}`,
            "image extract-frames-dir: processed 2 video(s); succeeded 1; failed 1.",
          ]);
          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const failure = firstFailure(exit.cause);
            expect(O.isSome(failure)).toBe(true);
            if (O.isSome(failure)) {
              expect(failure.value).toBeInstanceOf(ImageCommandError);
              expect(failure.value.message).toBe("image extract-frames-dir: 1 video(s) failed.");
            }
          }
        })
      )
    ));

  it("exits nonzero through the real BunRuntime entrypoint when extract-frames fails", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const binDir = path.join(tmpDir, "bin");
          const argsPath = path.join(tmpDir, "ffmpeg-args.txt");
          const videoPath = path.join(tmpDir, "clip.mp4");
          const outDir = path.join(tmpDir, "frames");

          yield* fs.makeDirectory(outDir, { recursive: true });
          yield* fs.writeFileString(videoPath, "video");
          yield* fs.writeFileString(path.join(outDir, "clip_frame_00000.png"), "existing");
          yield* writeFfprobeShim(binDir);
          yield* writeExtractFramesFfmpegShim(binDir, argsPath);

          const result = yield* runCliCommand(
            tmpDir,
            binDir,
            "image",
            "extract-frames",
            "--video",
            videoPath,
            "--out-dir",
            outDir,
            "--fps",
            "1"
          );

          expect(result.exitCode).toBe(1);
          expect(result.output).toContain(
            `Refusing to overwrite existing frame output: "${path.join(outDir, "clip_frame_00000.png")}"`
          );
        })
      )
    ));
});
