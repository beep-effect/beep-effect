/**
 * Schema for candidate lines and their source byte ranges.
 * @packageDocumentation
 * @since 0.0.0
 */
// One candidate line of a JSONL journal, located in the source by byte.

import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("LineSlice");

/**
 * A single candidate line: its text, and where it lives in the source **in bytes**.
 *
 * **Details**
 *
 * Every offset on this class is a UTF-8 byte offset, never a UTF-16 code-unit
 * index, because these values are cursors into a file: they are handed to
 * `FileSystem.stream`'s `offset` option and persisted across process restarts.
 * A `String.length`-derived offset is correct only for ASCII journals and is
 * the single most likely bug in this module.
 *
 * The terminator is **not** part of the content: `text` and `length` exclude
 * the trailing `\n`, and exclude the `\r` of a `\r\n` pair. `end` includes it,
 * which is why `end - offset` is not always `length`.
 *
 * **Example** (Locate a terminated line in UTF-8 bytes)
 * ```ts import.meta.vitest name="Locate a terminated line in UTF-8 bytes"
 * import { pipe } from "effect";
 * import { Line } from "@beep/scratchpad/effected/jsonl/index";
 * import * as A from "effect/Array";
 * import * as O from "effect/Option";
 * const first = pipe(Line.split('{"a":1}\r\n{"b":2}\n'), A.head);
 * first.pipe(O.map((line) => [line.offset, line.length, line.end])) // => O.some([0, 7, 9])
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LineSlice extends S.Class<LineSlice>($I`LineSlice`)(
  {
    /** UTF-8 byte offset of this line's first content byte. */
    offset: S.Finite.pipe(
      $I.annoteKey("LineSlice.offset", {
        description: "UTF-8 byte offset of this line's first content byte.",
      }),
    ),
    /**
     * UTF-8 byte offset just past this line's terminator — the offset at which
     * the next line begins, and the resume cursor for an incremental read.
     *
     * **Details**
     *
     * Equal to `offset + length` when the line is unterminated.
     */
    end: S.Finite.pipe(
      $I.annoteKey("LineSlice.end", {
        description:
          "UTF-8 byte offset just past this line's terminator — the offset at which the next line begins, and the resume cursor for an incremental read.",
        documentation: "Equal to `offset + length` when the line is unterminated.",
      }),
    ),
    /** UTF-8 byte length of `LineSlice.text`, excluding any terminator. */
    length: S.Finite.pipe(
      $I.annoteKey("LineSlice.length", {
        description: "UTF-8 byte length of `LineSlice.text`, excluding any terminator.",
      }),
    ),
    /** The line's content, with its terminator and any paired `\r` removed. */
    text: S.String.pipe(
      $I.annoteKey("LineSlice.text", {
        description: "The line's content, with its terminator and any paired `\r` removed.",
      }),
    ),
    /**
     * Whether a `\n` terminated this line in the source.
     *
     * **Details**
     *
     * `false` can only occur on the final line, and means the line **may be a
     * torn tail** — a writer caught mid-append. A reader walks back over it and
     * leaves its bytes unconsumed so the next read sees the completed line.
     */
    terminated: S.Boolean.pipe(
      $I.annoteKey("LineSlice.terminated", {
        description: "Whether a `\n` terminated this line in the source.",
        documentation:
          "`false` can only occur on the final line, and means the line **may be a torn tail** — a writer caught mid-append. A reader walks back over it and leaves its bytes unconsumed so the next read sees the completed line.",
      }),
    ),
  },
  $I.annote("LineSlice", {
    description: "A single candidate line: its text, and where it lives in the source **in bytes**.",
    documentation:
      "Every offset on this class is a UTF-8 byte offset, never a UTF-16 code-unit\n" +
      "index, because these values are cursors into a file: they are handed to\n" +
      "`FileSystem.stream`'s `offset` option and persisted across process restarts.\n" +
      "A `String.length`-derived offset is correct only for ASCII journals and is\n" +
      "the single most likely bug in this module.\n" +
      "\n" +
      "The terminator is **not** part of the content: `text` and `length` exclude\n" +
      "the trailing `\\n`, and exclude the `\\r` of a `\\r\\n` pair. `end` includes it,\n" +
      "which is why `end - offset` is not always `length`.\n" +
      "),",
  }),
) {}
