/**
 * Service implementation for image and video curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ExtractFramesRequest, FFmpeg } from "@beep/ffmpeg";
import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { VideoFileExtension } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Cause, Context, Effect, Exit, FileSystem, Layer, Order, Path, pipe, Terminal } from "effect";
import { dual, flow } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ImageCommandError } from "./Image.errors.ts";
import { makeExtractFramesEvents } from "./Image.progress.ts";
import {
  decodeExtractFramesDirOptions,
  decodeExtractFramesOptions,
  ExtractFramesDirFailure,
  ExtractFramesDirResult,
  ExtractFramesDirSuccess,
  ExtractFramesDirVideo,
  ExtractFramesOptions,
} from "./Image.schemas.ts";
import type { ExtractFramesResult, FFmpegError } from "@beep/ffmpeg";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ExtractFramesDirOptions } from "./Image.schemas.ts";

const $I = $RepoCliId.create("commands/Image/Image.service");

type ImageCommandServiceContext = FFmpeg | FileSystem.FileSystem | Path.Path | Terminal.Terminal;

type ImageCommandServiceRequirements =
  | ChildProcessSpawner.ChildProcessSpawner
  | FileSystem.FileSystem
  | Path.Path
  | Terminal.Terminal;

/**
 * Service contract for image and video curation commands.
 *
 * **Example** (List shape method keys)
 *
 * ```ts
 * import type { ImageCommandServiceShape } from "@beep/repo-cli/commands/Image"
 *
 * const methodNames: ReadonlyArray<keyof ImageCommandServiceShape> = ["extractFrames", "extractFramesDir"]
 * console.log(methodNames.length) // 2
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ImageCommandServiceShape {
  /**
   * Extract PNG frames from a single video.
   *
   * @since 0.0.0
   */
  readonly extractFrames: (
    options: ExtractFramesOptions
  ) => Effect.Effect<ExtractFramesResult, FFmpegError | ImageCommandError>;

  /**
   * Extract PNG frames from every direct video in a directory.
   *
   * @since 0.0.0
   */
  readonly extractFramesDir: (
    options: ExtractFramesDirOptions
  ) => Effect.Effect<ExtractFramesDirResult, ImageCommandError>;
}

/**
 * Service tag for image and video curation operations.
 *
 * **Example** (Resolve service with Effect)
 *
 * ```ts
 * import { ImageCommandService } from "@beep/repo-cli/commands/Image"
 * import { Effect } from "effect"
 *
 * const program = Effect.service(ImageCommandService)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ImageCommandService extends Context.Service<ImageCommandService, ImageCommandServiceShape>()(
  $I`ImageCommandService`
) {}

const normalizeBareExtension = flow(Str.replace(/^\./, ""), Str.toLowerCase);
const videoExtensionGuard = S.is(VideoFileExtension);

const isVideoFileName: {
  (path: Path.Path, name: string): boolean;
  (name: string): (path: Path.Path) => boolean;
} = dual(2, (path: Path.Path, name: string): boolean =>
  pipe(name, path.extname, normalizeBareExtension, videoExtensionGuard)
);

const resolveExtractFramesDirOutDir = Effect.fn("ImageCommandService.resolveExtractFramesDirOutDir")(function* (
  directory: string,
  sourceName: string,
  stem: string
) {
  // Fail closed when the filename-derived stem (e.g. ".." from "...mp4") or a
  // same-stem symlink would place the output directory outside the selected
  // directory. resolvePathWithinRoot canonicalizes via realPath and guards
  // not-yet-existing write targets, so lexical checks cannot be bypassed.
  return yield* resolvePathWithinRoot({ root: directory, candidate: stem }).pipe(
    ImageCommandError.mapError(`image extract-frames-dir: refusing unsafe output directory for "${sourceName}".`)
  );
});

const makeExtractFramesRequest = (options: ExtractFramesOptions): ExtractFramesRequest =>
  ExtractFramesRequest.make({
    fps: options.fps,
    manifestPath: options.manifest,
    outDir: options.outDir,
    overwrite: options.overwrite,
    prefix: options.prefix,
    videoPath: options.video,
  });

const validateExtractFramesOptions = (
  options: ExtractFramesOptions
): Effect.Effect<ExtractFramesOptions, ImageCommandError> =>
  decodeExtractFramesOptions(options).pipe(
    ImageCommandError.mapError(
      "Invalid image extract-frames options. Expected a video, output directory, and positive FPS."
    )
  );

const validateExtractFramesDirOptions = (
  options: ExtractFramesDirOptions
): Effect.Effect<ExtractFramesDirOptions, ImageCommandError> =>
  decodeExtractFramesDirOptions(options).pipe(
    ImageCommandError.mapError("Invalid image extract-frames-dir options. Expected a directory and positive FPS.")
  );

const extractCauseMessage = (cause: Cause.Cause<unknown>): string => {
  const error = Cause.squash(cause);
  if (P.hasProperty(error, "message") && P.isString(error.message)) {
    return error.message;
  }

  return Cause.pretty(cause);
};

const runExtractFramesImpl = Effect.fn("ImageCommandService.extractFrames")(function* (
  label: string,
  options: ExtractFramesOptions
): Effect.fn.Return<ExtractFramesResult, FFmpegError | ImageCommandError, ImageCommandServiceContext> {
  const decoded = yield* validateExtractFramesOptions(options);
  const ffmpeg = yield* FFmpeg;
  const terminal = yield* Terminal.Terminal;
  return yield* ffmpeg.extractFrames(makeExtractFramesRequest(decoded), makeExtractFramesEvents(terminal, label));
});

const collectExtractFramesDirVideos = Effect.fn("ImageCommandService.collectExtractFramesDirVideos")(function* (
  dir: string
): Effect.fn.Return<ReadonlyArray<ExtractFramesDirVideo>, ImageCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.resolve(dir);
  const entries = yield* fs
    .readDirectory(directory)
    .pipe(ImageCommandError.mapError(`Failed to read video directory: "${directory}"`));
  let videos = A.empty<ExtractFramesDirVideo>();

  for (const entry of entries) {
    const sourcePath = path.join(directory, entry);
    const stat = yield* fs.stat(sourcePath).pipe(Effect.option);
    if (O.isNone(stat) || stat.value.type !== "File" || !isVideoFileName(path, entry)) {
      continue;
    }

    const extension = path.extname(entry);
    const stem = path.basename(entry, extension);
    const outDir = yield* resolveExtractFramesDirOutDir(directory, entry, stem);
    videos = A.append(
      videos,
      ExtractFramesDirVideo.make({
        outDir,
        sourceName: entry,
        sourcePath,
        stem,
      })
    );
  }

  return A.sort(
    videos,
    Order.mapInput(Str.orderAsc, (video: ExtractFramesDirVideo) => video.sourceName)
  );
});

const preflightExtractFramesDirVideos = Effect.fn("ImageCommandService.preflightExtractFramesDirVideos")(function* (
  videos: ReadonlyArray<ExtractFramesDirVideo>
): Effect.fn.Return<void, ImageCommandError> {
  if (A.length(videos) === 0) {
    return yield* ImageCommandError.make({ message: "image extract-frames-dir: no direct video files found." });
  }

  let stems = A.empty<string>();
  for (const video of videos) {
    if (A.contains(stems, video.stem)) {
      return yield* ImageCommandError.make({
        message: `image extract-frames-dir: multiple videos would write to "${video.outDir}".`,
      });
    }
    stems = A.append(stems, video.stem);
  }
});

const runExtractFramesDirImpl = Effect.fn("ImageCommandService.extractFramesDir")(function* (
  options: ExtractFramesDirOptions
): Effect.fn.Return<ExtractFramesDirResult, ImageCommandError, ImageCommandServiceContext> {
  const decoded = yield* validateExtractFramesDirOptions(options);
  const videos = yield* collectExtractFramesDirVideos(decoded.dir);
  yield* preflightExtractFramesDirVideos(videos);
  let completedCount = 0;
  let failedCount = 0;
  let outcomes = A.empty<ExtractFramesDirSuccess | ExtractFramesDirFailure>();

  for (const video of videos) {
    const request = ExtractFramesOptions.make({
      fps: decoded.fps,
      manifest: O.none(),
      outDir: video.outDir,
      overwrite: decoded.overwrite,
      prefix: decoded.prefix,
      video: video.sourcePath,
    });
    const exit = yield* Effect.exit(runExtractFramesImpl(`image extract-frames-dir ${video.sourceName}`, request));

    if (Exit.isSuccess(exit)) {
      completedCount += 1;
      outcomes = A.append(
        outcomes,
        ExtractFramesDirSuccess.make({
          result: exit.value,
          sourceName: video.sourceName,
          sourcePath: video.sourcePath,
          status: "success",
        })
      );
    } else {
      failedCount += 1;
      outcomes = A.append(
        outcomes,
        ExtractFramesDirFailure.make({
          message: extractCauseMessage(exit.cause),
          sourceName: video.sourceName,
          sourcePath: video.sourcePath,
          status: "failure",
        })
      );
    }
  }

  return ExtractFramesDirResult.make({
    completedCount,
    failedCount,
    outcomes,
    totalCount: A.length(videos),
  });
});

const makeImageCommandService = Effect.fn("ImageCommandService.make")(function* () {
  const runtimeContext = yield* Effect.context<ImageCommandServiceContext>();

  return ImageCommandService.of({
    extractFrames: Effect.fn("ImageCommandService.extractFrames")((options) =>
      runExtractFramesImpl("image extract-frames", options).pipe(Effect.provide(runtimeContext))
    ),
    extractFramesDir: Effect.fn("ImageCommandService.extractFramesDir")((options) =>
      runExtractFramesDirImpl(options).pipe(Effect.provide(runtimeContext))
    ),
  });
});

/**
 * Live service layer for image and video curation operations.
 *
 * **Example** (Confirm live layer identity)
 *
 * ```ts
 * import { ImageCommandServiceLive } from "@beep/repo-cli/commands/Image"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ImageCommandServiceLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ImageCommandServiceLive: Layer.Layer<ImageCommandService, never, ImageCommandServiceRequirements> =
  Layer.effect(ImageCommandService, makeImageCommandService()).pipe(Layer.provideMerge(FFmpeg.makeLayer()));

/**
 * Extract PNG frames from a single video.
 *
 * **Example** (Wrap extractFrames as Effect)
 *
 * ```ts
 * import { extractFrames } from "@beep/repo-cli/commands/Image"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(extractFrames)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Single-video frame extraction options.
 * @returns Frame extraction result.
 * @category use-cases
 * @since 0.0.0
 */
export const extractFrames = Effect.fn("Image.extractFrames")(function* (
  options: ExtractFramesOptions
): Effect.fn.Return<ExtractFramesResult, FFmpegError | ImageCommandError, ImageCommandService> {
  const image = yield* ImageCommandService;
  return yield* image.extractFrames(options);
});

/**
 * Extract PNG frames from every direct video in a directory.
 *
 * **Example** (Wrap extractFramesDir as Effect)
 *
 * ```ts
 * import { extractFramesDir } from "@beep/repo-cli/commands/Image"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(extractFramesDir)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Directory frame extraction options.
 * @returns Directory extraction result.
 * @category use-cases
 * @since 0.0.0
 */
export const extractFramesDir = Effect.fn("Image.extractFramesDir")(function* (
  options: ExtractFramesDirOptions
): Effect.fn.Return<ExtractFramesDirResult, ImageCommandError, ImageCommandService> {
  const image = yield* ImageCommandService;
  return yield* image.extractFramesDir(options);
});
