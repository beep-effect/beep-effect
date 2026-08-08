/**
 * Command definitions for image and video curation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { Console, Effect, Match } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { printLines } from "../../internal/cli/Printer.ts";
import { ImageCommandError } from "./Image.errors.ts";
import {
  renderExtractFramesCommandSummary,
  renderExtractFramesDirError,
  renderExtractFramesDirFailure,
  renderExtractFramesDirSuccess,
  renderExtractFramesDirSummary,
} from "./Image.render.ts";
import { decodeExtractFramesDirOptions, decodeExtractFramesOptions } from "./Image.schemas.ts";
import { ImageCommandService, ImageCommandServiceLive } from "./Image.service.ts";
import type { FFmpegError } from "@beep/ffmpeg";
import type { ExtractFramesDirOutcome, ExtractFramesDirResult } from "./Image.schemas.ts";

const videoFlag = Flag.file("video", { mustExist: true }).pipe(Flag.withDescription("Input video file to sample"));
const dirFlag = Flag.directory("dir", { mustExist: true }).pipe(
  Flag.withDescription("Directory containing direct video files to sample")
);
const outDirFlag = Flag.directory("out-dir").pipe(Flag.withDescription("Output directory for extracted PNG frames"));
const fpsFlag = Flag.float("fps").pipe(Flag.withDescription("Positive frame extraction rate in frames per second"));
const prefixFlag = Flag.string("prefix").pipe(
  Flag.withDescription("Generated frame prefix; defaults to <video-stem>_frame"),
  Flag.optional
);
const manifestFlag = Flag.path("manifest", { pathType: "file" }).pipe(
  Flag.withDescription("Manifest output path; defaults to --out-dir/extract-frames-manifest.json"),
  Flag.optional
);
const overwriteFlag = Flag.boolean("overwrite").pipe(
  Flag.withDescription("Overwrite existing frame outputs and manifest")
);

const printImageIndex = () => printLines(["image commands: extract-frames, extract-frames-dir"]);

const printExtractFramesDirOutcome = Match.type<ExtractFramesDirOutcome>().pipe(
  Match.discriminators("status")({
    failure: (outcome) => Console.error(renderExtractFramesDirFailure(outcome)),
    success: (outcome) => Console.log(renderExtractFramesDirSuccess(outcome)),
  }),
  Match.exhaustive
);

const raiseOnFailedExtractFramesDir = (result: ExtractFramesDirResult): Effect.Effect<void, ImageCommandError> =>
  result.failedCount > 0
    ? Effect.fail(
        ImageCommandError.make({
          message: renderExtractFramesDirError(result),
        })
      )
    : Effect.void;

const renderExtractFramesDirResult = Effect.fn("ImageCommand.renderExtractFramesDirResult")(function* (
  result: ExtractFramesDirResult
): Effect.fn.Return<void, ImageCommandError> {
  yield* Effect.forEach(result.outcomes, printExtractFramesDirOutcome, { discard: true });
  yield* Console.log(renderExtractFramesDirSummary(result));
  yield* raiseOnFailedExtractFramesDir(result);
});

const runExtractFramesCommand = Effect.fn("ImageCommand.runExtractFramesCommand")(function* (
  options: unknown
): Effect.fn.Return<void, FFmpegError | ImageCommandError, ImageCommandService> {
  const decoded = yield* decodeExtractFramesOptions(options).pipe(
    ImageCommandError.mapError(
      "Invalid image extract-frames options. Expected a video, output directory, and positive FPS."
    )
  );
  const image = yield* ImageCommandService;
  const result = yield* image.extractFrames(decoded);
  yield* Console.log(renderExtractFramesCommandSummary(result));
});

const runExtractFramesDirCommand = Effect.fn("ImageCommand.runExtractFramesDirCommand")(function* (
  options: unknown
): Effect.fn.Return<void, ImageCommandError, ImageCommandService> {
  const decoded = yield* decodeExtractFramesDirOptions(options).pipe(
    ImageCommandError.mapError("Invalid image extract-frames-dir options. Expected a directory and positive FPS.")
  );
  const image = yield* ImageCommandService;
  const result = yield* image.extractFramesDir(decoded);
  yield* renderExtractFramesDirResult(result);
});

const imageExtractFramesCommand = Command.make(
  "extract-frames",
  {
    fps: fpsFlag,
    manifest: manifestFlag,
    outDir: outDirFlag,
    overwrite: overwriteFlag,
    prefix: prefixFlag,
    video: videoFlag,
  },
  runExtractFramesCommand
).pipe(
  Command.withDescription("Extract PNG frames from a video with native ffmpeg"),
  Command.provide(ImageCommandServiceLive)
);

const imageExtractFramesDirCommand = Command.make(
  "extract-frames-dir",
  {
    dir: dirFlag,
    fps: fpsFlag,
    overwrite: overwriteFlag,
    prefix: prefixFlag,
  },
  runExtractFramesDirCommand
).pipe(
  Command.withDescription("Extract PNG frames from every direct video file in a directory"),
  Command.provide(ImageCommandServiceLive)
);

/**
 * Image and video curation command group.
 *
 * **Example** (Run image command group)
 *
 * ```ts
 * import { imageCommand } from "@beep/repo-cli"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(imageCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const imageCommand = Command.make("image", {}, printImageIndex).pipe(
  Command.withDescription("Image and video curation commands"),
  Command.withSubcommands(A.make(imageExtractFramesCommand, imageExtractFramesDirCommand))
);
