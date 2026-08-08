/**
 * Schema models for image and video curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ExtractFramesResult, PositiveFrameRate } from "@beep/ffmpeg";
import { $RepoCliId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Image/Image.schemas");

/**
 * Options accepted by `image extract-frames`.
 *
 * **Example** (Construct extract-frames options)
 *
 * ```ts
 * import { ExtractFramesOptions } from "@beep/repo-cli/commands/Image/index"
 * import * as O from "effect/Option"
 *
 * const options = ExtractFramesOptions.make({
 *   fps: 1,
 *   manifest: O.none(),
 *   outDir: "./frames",
 *   overwrite: false,
 *   prefix: O.none(),
 *   video: "./clip.mp4"
 * })
 * console.log(options) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesOptions extends S.Class<ExtractFramesOptions>($I`ExtractFramesOptions`)(
  {
    fps: PositiveFrameRate,
    manifest: S.Option(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<string>())),
      S.withDecodingDefault(Effect.succeed(O.none<string>()))
    ),
    outDir: S.String,
    overwrite: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    prefix: S.Option(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<string>())),
      S.withDecodingDefault(Effect.succeed(O.none<string>()))
    ),
    video: S.String,
  },
  $I.annote("ExtractFramesOptions", {
    description: "Validated options for extracting PNG frames from one video.",
  })
) {}

/**
 * Options accepted by `image extract-frames-dir`.
 *
 * **Example** (Construct directory extract options)
 *
 * ```ts
 * import { ExtractFramesDirOptions } from "@beep/repo-cli/commands/Image/index"
 * import * as O from "effect/Option"
 *
 * const options = ExtractFramesDirOptions.make({
 *   dir: "./videos",
 *   fps: 1,
 *   overwrite: false,
 *   prefix: O.none()
 * })
 * console.log(options) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesDirOptions extends S.Class<ExtractFramesDirOptions>($I`ExtractFramesDirOptions`)(
  {
    dir: S.String,
    fps: PositiveFrameRate,
    overwrite: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    prefix: S.Option(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(O.none<string>())),
      S.withDecodingDefault(Effect.succeed(O.none<string>()))
    ),
  },
  $I.annote("ExtractFramesDirOptions", {
    description: "Validated options for extracting PNG frames from direct video files in a directory.",
  })
) {}

/**
 * Direct video selected by `image extract-frames-dir`.
 *
 * **Example** (Construct directory video entry)
 *
 * ```ts
 * import { ExtractFramesDirVideo } from "@beep/repo-cli/commands/Image/index"
 *
 * const video = ExtractFramesDirVideo.make({
 *   outDir: "./videos/clip",
 *   sourceName: "clip.mp4",
 *   sourcePath: "./videos/clip.mp4",
 *   stem: "clip"
 * })
 * console.log(video) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesDirVideo extends S.Class<ExtractFramesDirVideo>($I`ExtractFramesDirVideo`)(
  {
    outDir: S.String,
    sourceName: S.String,
    sourcePath: S.String,
    stem: S.String,
  },
  $I.annote("ExtractFramesDirVideo", {
    description: "A direct video file selected for folder-based frame extraction.",
  })
) {}

/**
 * Successful video from a folder-based frame extraction run.
 *
 * **Example** (Construct successful dir outcome)
 *
 * ```ts
 * import { ExtractFramesDirSuccess } from "@beep/repo-cli/commands/Image/index"
 * import { ExtractFramesResult } from "@beep/ffmpeg"
 *
 * const success = ExtractFramesDirSuccess.make({
 *   result: ExtractFramesResult.make({
 *     frameCount: 0,
 *     frames: [],
 *     manifestPath: "./videos/clip/extract-frames-manifest.json",
 *     outDir: "./videos/clip",
 *     videoPath: "./videos/clip.mp4"
 *   }),
 *   sourceName: "clip.mp4",
 *   sourcePath: "./videos/clip.mp4",
 *   status: "success"
 * })
 * console.log(success) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesDirSuccess extends S.Class<ExtractFramesDirSuccess>($I`ExtractFramesDirSuccess`)(
  {
    result: ExtractFramesResult,
    sourceName: S.String,
    sourcePath: S.String,
    status: S.tag("success"),
  },
  $I.annote("ExtractFramesDirSuccess", {
    description: "Successful extraction outcome for one direct video file.",
  })
) {}

/**
 * Failed video from a folder-based frame extraction run.
 *
 * **Example** (Construct failed dir outcome)
 *
 * ```ts
 * import { ExtractFramesDirFailure } from "@beep/repo-cli/commands/Image/index"
 *
 * const failure = ExtractFramesDirFailure.make({
 *   message: "ffmpeg failed",
 *   sourceName: "clip.mp4",
 *   sourcePath: "./videos/clip.mp4",
 *   status: "failure"
 * })
 * console.log(failure) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesDirFailure extends S.Class<ExtractFramesDirFailure>($I`ExtractFramesDirFailure`)(
  {
    message: S.String,
    sourceName: S.String,
    sourcePath: S.String,
    status: S.tag("failure"),
  },
  $I.annote("ExtractFramesDirFailure", {
    description: "Failure summary for one video in a folder-based frame extraction run.",
  })
) {}

/**
 * Ordered outcome for one `image extract-frames-dir` input video.
 *
 * **Example** (Validate outcome schema guard)
 *
 * ```ts
 * import { ExtractFramesDirOutcome } from "@beep/repo-cli/commands/Image"
 * import * as S from "effect/Schema"
 *
 * const value = "example"
 * console.log(S.is(ExtractFramesDirOutcome)(value)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExtractFramesDirOutcome = S.Union([ExtractFramesDirSuccess, ExtractFramesDirFailure]).pipe(
  $I.annoteSchema("ExtractFramesDirOutcome", {
    description: "Success or failure outcome for one direct video file.",
  })
);

/**
 * Ordered outcome for one `image extract-frames-dir` input video.
 *
 * **Example** (Type success as dir outcome)
 *
 * ```ts
 * import { ExtractFramesDirOutcome, ExtractFramesDirSuccess } from "@beep/repo-cli/commands/Image"
 * import { ExtractFramesResult } from "@beep/ffmpeg"
 *
 * const outcome: ExtractFramesDirOutcome = ExtractFramesDirSuccess.make({
 *   result: ExtractFramesResult.make({
 *     frameCount: 0,
 *     frames: [],
 *     manifestPath: "./videos/clip/extract-frames-manifest.json",
 *     outDir: "./videos/clip",
 *     videoPath: "./videos/clip.mp4"
 *   }),
 *   sourceName: "clip.mp4",
 *   sourcePath: "./videos/clip.mp4",
 *   status: "success"
 * })
 * console.log(outcome.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ExtractFramesDirOutcome = typeof ExtractFramesDirOutcome.Type;

/**
 * Result returned by `image extract-frames-dir`.
 *
 * **Example** (Construct directory extract result)
 *
 * ```ts
 * import { ExtractFramesDirResult } from "@beep/repo-cli/commands/Image/index"
 *
 * const result = ExtractFramesDirResult.make({
 *   completedCount: 0,
 *   failedCount: 0,
 *   outcomes: [],
 *   totalCount: 0
 * })
 * console.log(result) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractFramesDirResult extends S.Class<ExtractFramesDirResult>($I`ExtractFramesDirResult`)(
  {
    completedCount: S.Finite,
    failedCount: S.Finite,
    outcomes: S.Array(ExtractFramesDirOutcome),
    totalCount: S.Finite,
  },
  $I.annote("ExtractFramesDirResult", {
    description: "Batch result for extracting frames from direct video files in a directory.",
  })
) {}

/**
 * Decode unknown single-video frame extraction options.
 *
 * **Example** (Wrap options decoder in Effect)
 *
 * ```ts
 * import { decodeExtractFramesOptions } from "@beep/repo-cli/commands/Image"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(decodeExtractFramesOptions)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeExtractFramesOptions: {
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<ExtractFramesOptions, S.SchemaError>;
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<ExtractFramesOptions, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(ExtractFramesOptions));

/**
 * Decode unknown directory frame extraction options.
 *
 * **Example** (Wrap dir options decoder in Effect)
 *
 * ```ts
 * import { decodeExtractFramesDirOptions } from "@beep/repo-cli/commands/Image"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(decodeExtractFramesDirOptions)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeExtractFramesDirOptions: {
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<ExtractFramesDirOptions, S.SchemaError>;
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<ExtractFramesDirOptions, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(ExtractFramesDirOptions));
