/**
 * One candidate line of a JSONL journal, located in the source by byte.
 *
 * @since 0.1.0
 */
import { Schema } from "effect";

/**
 * A single candidate line: its text, and where it lives in the source **in
 * bytes**.
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
 * @example
 * ```ts
 * import { Line } from "@effected/jsonl";
 *
 * const [first] = Line.split('{"a":1}\r\n{"b":2}\n');
 * first?.text;       // '{"a":1}'
 * first?.offset;     // 0
 * first?.length;     // 7  — content bytes, no terminator
 * first?.end;        // 9  — past the CR and the LF
 * first?.terminated; // true
 * ```
 *
 * @public
 */
export class LineSlice extends Schema.Class<LineSlice>("LineSlice")({
	/** UTF-8 byte offset of this line's first content byte. */
	offset: Schema.Number,
	/**
	 * UTF-8 byte offset just past this line's terminator — the offset at which
	 * the next line begins, and the resume cursor for an incremental read.
	 *
	 * Equal to `offset + length` when the line is unterminated.
	 */
	end: Schema.Number,
	/** UTF-8 byte length of `LineSlice.text`, excluding any terminator. */
	length: Schema.Number,
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
}) {}
