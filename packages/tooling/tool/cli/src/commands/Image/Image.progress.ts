/**
 * Terminal progress helpers for image and video curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Match, pipe } from "effect";
import { dual } from "effect/Function";
import { renderCompletedProgress, renderInitialProgress, renderProgressBar } from "./Image.render.ts";
import type { FFmpegEvent } from "@beep/ffmpeg";
import type { Terminal } from "effect";

/**
 * Render one FFmpeg event through the terminal service.
 *
 * **Example** (Render FFmpeg progress event)
 *
 * ```ts
 * import { renderExtractFramesEvent } from "@beep/repo-cli/commands/Image"
 *
 * const result = renderExtractFramesEvent("clip.mp4", { frameCount: 12, percent: 50 })
 * console.log(result) // rendered command output
 * ```
 *
 * @param terminal - Terminal service used for in-place display.
 * @param label - User-facing operation label.
 * @param event - FFmpeg event.
 * @returns Effect that updates the terminal display.
 * @category utilities
 * @since 0.0.0
 */
export const renderExtractFramesEvent: {
  (terminal: Terminal.Terminal, label: string, event: FFmpegEvent): Effect.Effect<void, never>;
  (label: string, event: FFmpegEvent): (terminal: Terminal.Terminal) => Effect.Effect<void, never>;
} = dual(
  3,
  Effect.fnUntraced(function* (
    terminal: Terminal.Terminal,
    label: string,
    event: FFmpegEvent
  ): Effect.fn.Return<void, never> {
    return yield* Match.value(event).pipe(
      Match.discriminators("kind")({
        completed: (event) => pipe(renderCompletedProgress(label, event.frameCount), terminal.display, Effect.ignore),
        progress: (event) => pipe(renderProgressBar(label, event), terminal.display, Effect.ignore),
      }),
      Match.orElse(() => pipe(label, renderInitialProgress, terminal.display, Effect.ignore))
    );
  })
);

/**
 * Build a TTY-only FFmpeg event sink.
 *
 * **Example** (Build TTY FFmpeg event sink)
 *
 * ```ts
 * import { makeExtractFramesEvents } from "@beep/repo-cli/commands/Image"
 *
 * const result = makeExtractFramesEvents("clip.mp4", [{ frameCount: 12, percent: 50 }])
 * console.log(result) // rendered command output
 * ```
 *
 * @param terminal - Terminal service used for in-place display.
 * @param label - User-facing operation label.
 * @returns Event sink when stdout is a TTY; otherwise undefined.
 * @category utilities
 * @since 0.0.0
 */
export const makeExtractFramesEvents: {
  (terminal: Terminal.Terminal, label: string): ((event: FFmpegEvent) => Effect.Effect<void, never>) | undefined;
  (label: string): (terminal: Terminal.Terminal) => ((event: FFmpegEvent) => Effect.Effect<void, never>) | undefined;
} = dual(2, (terminal: Terminal.Terminal, label: string) =>
  process.stdout.isTTY === true ? (event: FFmpegEvent) => renderExtractFramesEvent(terminal, label, event) : undefined
);
