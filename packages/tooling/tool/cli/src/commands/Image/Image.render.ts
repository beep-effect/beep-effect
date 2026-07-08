/**
 * Pure renderers for image and video curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Str } from "@beep/utils";
import { Match, pipe } from "effect";
import { dual } from "effect/Function";
import type { ExtractFramesResult, FFmpegEvent } from "@beep/ffmpeg";
import type {
  ExtractFramesDirFailure,
  ExtractFramesDirOutcome,
  ExtractFramesDirResult,
  ExtractFramesDirSuccess,
} from "./Image.schemas.js";

const BAR_WIDTH = 24;
const repeatBarWidth = Str.repeat(BAR_WIDTH);

type RenderProgressBarEvent = typeof FFmpegEvent.cases.progress.Type;

/**
 * Render the progress bar for one FFmpeg progress event.
 *
 * @param label - User-facing operation label.
 * @param event - FFmpeg progress event.
 * @returns Single-line terminal progress text.
 * @example
 * ```ts
 * import { renderProgressBar } from "@beep/repo-cli/commands/Image"
 *
 * const result = renderProgressBar("extract clip.mp4", { frameCount: 12, percent: 50 })
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderProgressBar: {
  (label: string, event: RenderProgressBarEvent): string;
  (event: RenderProgressBarEvent): (label: string) => string;
} = dual(2, (label: string, event: RenderProgressBarEvent): string => {
  const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round((event.percent / 100) * BAR_WIDTH)));
  const empty = BAR_WIDTH - filled;
  const bar = `${pipe("#", Str.repeat(filled))}${pipe("-", Str.repeat(empty))}`;
  return `\r${label} [${bar}] ${event.frameCount} frame(s) ${event.percent.toFixed(1)}%`;
});

/**
 * Render a completed progress line.
 *
 * @param label - User-facing operation label.
 * @param frameCount - Number of frames written.
 * @returns Single-line completed progress text.
 * @example
 * ```ts
 * import { renderCompletedProgress } from "@beep/repo-cli/commands/Image"
 *
 * const result = renderCompletedProgress("extract clip.mp4", 12)
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderCompletedProgress: {
  (label: string, frameCount: number): string;
  (frameCount: number): (label: string) => string;
} = dual(
  2,
  (label: string, frameCount: number): string =>
    `\r${label} [${pipe("#", repeatBarWidth)}] ${frameCount} frame(s) 100.0%\n`
);

/**
 * Render the initial progress line.
 *
 * @param label - User-facing operation label.
 * @returns Single-line initial progress text.
 * @example
 * ```ts
 * import { renderInitialProgress } from "@beep/repo-cli/commands/Image"
 *
 * const result = renderInitialProgress("extract clip.mp4")
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderInitialProgress = (label: string): string =>
  `\r${label} [${pipe("-", repeatBarWidth)}] 0 frame(s) 0.0%`;

/**
 * Render a frame extraction summary.
 *
 * @param result - Extraction result.
 * @returns Human-readable extraction summary.
 * @example
 * ```ts
 * import { renderExtractFramesSummary } from "@beep/repo-cli/commands/Image"
 *
 * const result = renderExtractFramesSummary({ frameCount: 2, frames: [], manifestPath: "./frames/manifest.json", outDir: "./frames", videoPath: "./clip.mp4" })
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderExtractFramesSummary = (result: ExtractFramesResult): string =>
  `wrote ${result.frameCount} frame(s) to ${result.outDir}. manifest: ${result.manifestPath}`;

/**
 * Render the final `image extract-frames` output line.
 *
 * @param result - Extraction result.
 * @returns Human-readable command summary.
 * @example
 * ```ts
 * import { renderExtractFramesCommandSummary } from "@beep/repo-cli/commands/Image"
 *
 * const result = renderExtractFramesCommandSummary({ frameCount: 2, frames: [], manifestPath: "./frames/manifest.json", outDir: "./frames", videoPath: "./clip.mp4" })
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderExtractFramesCommandSummary = (result: ExtractFramesResult): string =>
  `image extract-frames: ${renderExtractFramesSummary(result)}`;

/**
 * Render one successful directory extraction outcome.
 *
 * @param outcome - Successful video outcome.
 * @returns Human-readable success summary.
 * @example
 * ```ts
 * import { renderExtractFramesDirSuccess } from "@beep/repo-cli/commands/Image"
 *
 * const result = renderExtractFramesDirSuccess({ result: { frameCount: 2, frames: [], manifestPath: "./frames/manifest.json", outDir: "./frames", videoPath: "./clip.mp4" }, sourceName: "clip.mp4", sourcePath: "./clip.mp4", status: "success" })
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderExtractFramesDirSuccess = (outcome: ExtractFramesDirSuccess): string =>
  `image extract-frames-dir: ${outcome.sourceName}: ${renderExtractFramesSummary(outcome.result)}`;

/**
 * Render one failed directory extraction outcome.
 *
 * @param outcome - Failed video outcome.
 * @returns Human-readable failure summary.
 * @example
 * ```ts
 * import { renderExtractFramesDirFailure } from "@beep/repo-cli/commands/Image"
 *
 * const result = renderExtractFramesDirFailure({ message: "ffmpeg failed", sourceName: "clip.mp4", sourcePath: "./clip.mp4", status: "failure" })
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderExtractFramesDirFailure = (outcome: ExtractFramesDirFailure): string =>
  `image extract-frames-dir: ${outcome.sourceName}: failed: ${outcome.message}`;

/**
 * Render one directory extraction outcome.
 *
 * @param outcome - Video outcome.
 * @returns Human-readable outcome summary.
 * @example
 * ```ts
 * import { renderExtractFramesDirOutcome } from "@beep/repo-cli/commands/Image"
 *
 * const result = renderExtractFramesDirOutcome({ message: "ffmpeg failed", sourceName: "clip.mp4", sourcePath: "./clip.mp4", status: "failure" })
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderExtractFramesDirOutcome = Match.type<ExtractFramesDirOutcome>().pipe(
  Match.discriminatorsExhaustive("status")({
    failure: renderExtractFramesDirFailure,
    success: renderExtractFramesDirSuccess,
  })
);

/**
 * Render the final directory extraction summary line.
 *
 * @param result - Directory extraction result.
 * @returns Human-readable batch summary.
 * @example
 * ```ts
 * import { renderExtractFramesDirSummary } from "@beep/repo-cli/commands/Image"
 *
 * const result = renderExtractFramesDirSummary({ completedCount: 1, failedCount: 1, outcomes: [], totalCount: 2 })
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderExtractFramesDirSummary = (result: ExtractFramesDirResult): string =>
  `image extract-frames-dir: processed ${result.totalCount} video(s); succeeded ${result.completedCount}; failed ${result.failedCount}.`;

/**
 * Render the aggregate directory extraction error message.
 *
 * @param result - Directory extraction result with failures.
 * @returns Human-readable aggregate failure.
 * @example
 * ```ts
 * import { renderExtractFramesDirError } from "@beep/repo-cli/commands/Image"
 *
 * const result = renderExtractFramesDirError({ completedCount: 1, failedCount: 1, outcomes: [], totalCount: 2 })
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const renderExtractFramesDirError = (result: ExtractFramesDirResult): string =>
  `image extract-frames-dir: ${result.failedCount} video(s) failed.`;
