/**
 * The bound every log excerpt a gate run carries is kept under: the
 * recorder's excerpt of the raw stream, and an adapter's excerpt of the
 * output it parsed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { boundedChunkReducer, emptyBoundedOutput, OutputBound } from "@beep/repo-cli-kit/process/OutputBound";
import * as O from "effect/Option";
import * as Str from "effect/String";

/**
 * The excerpt bound: 8 KiB, keeping the head and the tail of the stream.
 *
 * **Example** (Read the bound)
 *
 * ```ts
 * import { excerptBound } from "@beep/repo-gate-run/Excerpt";
 *
 * console.log(excerptBound.maxChars); // 8192
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const excerptBound: OutputBound = OutputBound.make({
  maxChars: 8 * 1024,
  truncatedNotice: "\n[gate] log excerpt truncated; the full stream is in the log file\n",
  retention: "head-tail",
});

/**
 * A text cut to the excerpt bound, head and tail kept, or none for an empty
 * text.
 *
 * **Example** (Excerpt a short output)
 *
 * ```ts
 * import { boundedExcerpt } from "@beep/repo-gate-run/Excerpt";
 * import * as O from "effect/Option";
 *
 * console.log(O.getOrNull(boundedExcerpt("panic: boom"))); // panic: boom
 * ```
 *
 * @param text - the whole output to excerpt
 * @returns the excerpt within the 8 KiB bound, or none when the text is empty
 * @category utilities
 * @since 0.0.0
 */
export const boundedExcerpt = (text: string): O.Option<string> =>
  O.liftPredicate(boundedChunkReducer(excerptBound)(emptyBoundedOutput, text).text, Str.isNonEmpty);
