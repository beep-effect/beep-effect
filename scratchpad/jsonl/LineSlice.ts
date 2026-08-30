/**
 * One candidate line of a JSONL journal, located in the source by byte.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";

const $I = $ScratchpadId.create("jsonl/LineSlice");

/**
 * A single candidate line: its text, and where it lives in the source **in
 * bytes**.
 *
 * **Details**
 *
 * Every offset on this class is a UTF-8 byte offset, never a UTF-16 code-unit
 * index, because these values are cursors into a file: they are handed to
 * `FileSystem.stream`'s `offset` option and persisted across process restarts.
 *
 * The terminator is **not** part of the content: `text` and `length` exclude
 * the trailing `\n`, and exclude the `\r` of a `\r\n` pair. `end` includes it,
 * which is why `end - offset` is not always `length`.
 *
 * **Gotchas**
 *
 * A `String.length`-derived offset is correct only for ASCII journals and is
 * the single most likely bug in this module. `end - offset !== length` whenever
 * the line was terminated (one extra byte for LF, two for CRLF).
 * `terminated: false` can only occur on the final line and means the line
 * **may be a torn tail** — leave its bytes unconsumed so the next read sees the
 * completed line.
 *
 * **Example** (CRLF byte offsets)
 *
 * ```ts
 * import { Line } from "@beep/scratchpad/jsonl"
 *
 * const first = Line.split('{"a":1}\r\n{"b":2}\n')[0]
 * if (first !== undefined) {
 *   console.log(first.text) // '{"a":1}'
 *   console.log(first.offset) // 0
 *   console.log(first.length) // 7
 *   console.log(first.end) // 9
 *   console.log(first.terminated) // true
 * }
 * ```
 *
 * @see {@link Line} for split/parse/lastValid over these slices.
 * @public
 * @category models
 * @since 0.0.0
 */
export class LineSlice extends Schema.Class<LineSlice>($I`LineSlice`)(
  {
    /** UTF-8 byte offset of this line's first content byte. */
    offset: Schema.Finite,
    /**
     * UTF-8 byte offset just past this line's terminator — the offset at which
     * the next line begins, and the resume cursor for an incremental read.
     *
     * Equal to `offset + length` when the line is unterminated.
     */
    end: Schema.Finite,
    /** UTF-8 byte length of `LineSlice.text`, excluding any terminator. */
    length: Schema.Finite,
    /** The line's content, with its terminator and any paired `\r` removed. */
    text: Schema.String,
    /**
     * Whether a `\n` terminated this line in the source.
     *
     * `false` can only occur on the final line, and means the line **may be a
     * torn tail** — a writer caught mid-append. A reader walks back over it and
     * leaves its bytes unconsumed so the next read sees the completed line.
     */
    terminated: Schema.Boolean,
  },
  $I.annote("LineSlice", {
    description: "One candidate JSONL line located in the source by UTF-8 byte offsets.",
  })
) {}
