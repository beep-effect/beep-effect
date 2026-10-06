/**
 * Synchronous JSON line parsing with UTF-8 byte offsets.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
// The pure, synchronous line layer of a JSONL journal.
//
// Nothing here touches `FileSystem`, builds an `Effect`, or needs a runtime —
// a `PreToolUse` hook script reads the current state of a journal with one
// call. That is a contract, not a convenience: a hook that had to construct an
// Effect runtime to read one line would not adopt this package.
import * as Str from "effect/String";
import { utf8Length } from "./internal/utf8.js";
import { MalformedLine } from "./JsonlError.js";
import { LineSlice } from "./LineSlice.js";

const $I = $ScratchpadId.create("Line");

/**
 * A line that parsed as JSON, paired with the slice it came from.
 *
 * **Details**
 *
 * `value` is deliberately `unknown`: this layer knows JSON, not envelopes.
 * Validating `event`, `at`, `scope` and the registered payload schema is the
 * envelope layer's job, and keeping the split means a malformed *envelope* and
 * a malformed *line* stay distinguishable failures.
 *
 * **Example** (Inspect a parsed value and its source)
 * ```ts import.meta.vitest name="Inspect a parsed value and its source"
 * import { pipe } from "effect";
 * import { Line } from "@beep/scratchpad/effected/jsonl/index";
 * import * as A from "effect/Array";
 * import * as O from "effect/Option";
 * import * as Result from "effect/Result";
 * const result = pipe(Line.split('42'), A.head, O.map(Line.parseResult));
 * O.isSome(result) && Result.isSuccess(result.value) && result.value.success.value // => 42
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ParsedLine extends S.Class<ParsedLine>($I`ParsedLine`)(
  {
    /** Where this line lives in the source. */
    line: LineSlice.pipe(
      $I.annoteKey("ParsedLine.line", {
        description: "Where this line lives in the source.",
      }),
    ),
    /** The parsed JSON value — any JSON value, not necessarily an object. */
    value: S.Unknown.pipe(
      $I.annoteKey("ParsedLine.value", {
        description: "The parsed JSON value — any JSON value, not necessarily an object.",
      }),
    ),
  },
  $I.annote("ParsedLine", {
    description: "A line that parsed as JSON, paired with the slice it came from.",
    documentation:
      "`value` is deliberately `unknown`: this layer knows JSON, not envelopes.\nValidating `event`, `at`, `scope` and the registered payload schema is the\nenvelope layer's job, and keeping the split means a malformed *envelope* and\na malformed *line* stay distinguishable failures.",
  }),
) {}

/** Whether a line carries nothing but whitespace. */
const isBlank = (line: LineSlice): boolean => Str.isEmpty(Str.trim(line.text));
const decodeJson = S.decodeResult(S.fromJsonString(S.Unknown));

/**
 * Splitting, parsing and corrupt-tail walk-back over JSONL text.
 *
 * **Details**
 *
 * Every operation is total and synchronous: it returns a value for every
 * input, including empty text, torn tails, and text that is not JSONL at all.
 * Nothing here throws — a `JSON.parse` failure becomes a {@link MalformedLine}
 * in the returned `Result`, because a journal is untrusted input and untrusted
 * input fails typed.
 *
 * **Example** (Recover the last valid JSON value)
 * ```ts import.meta.vitest name="Recover the last valid JSON value"
 * import { Line } from "@beep/scratchpad/effected/jsonl/index";
 * import * as O from "effect/Option";
 * Line.byteLength("😀") // => 4
 * Line.lastValid('42\n{').pipe(O.map((line) => line.value)) // => O.some(42)
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
 */
export const Line = {
  /**
   * The UTF-8 byte length of a string.
   *
   * **Details**
   *
   * Exposed because callers doing their own offset arithmetic must measure
   * the same way this module does. `String.length` is a different number for
   * any non-ASCII line.
   *
   * An unpaired surrogate counts as the 3 bytes of U+FFFD, matching what a
   * UTF-8 write actually emits. The offsets therefore stay true to the file
   * even though the character itself cannot survive the round trip — text
   * read back from a UTF-8 journal never contains one.
   *
   * **Example** (Measure encoded bytes)
   * ```ts import.meta.vitest name="Measure encoded bytes"
   * import { Line } from "@beep/scratchpad/effected/jsonl/index";
   *
   * Line.byteLength("\u{1F600}"); // 4
   * "\u{1F600}".length;           // 2 — the trap
   * ```
   */
  byteLength(text: string): number {
    return utf8Length(text);
  },

  /**
   * Split text into candidate lines with byte-exact offsets.
   *
   * **Details**
   *
   * Lines are separated by `\n`; a `\r` immediately preceding it is treated as
   * part of the terminator, so CRLF journals split identically to LF ones. A
   * bare `\r` is ordinary content, because only `\n` terminates.
   *
   * A trailing terminator does **not** produce a phantom empty final line, so
   * a well-formed journal yields exactly as many slices as it has entries.
   * Interior blank lines *are* returned — they are real bytes at real offsets,
   * and hiding them would make the offsets lie.
   *
   * Only the final slice can have `terminated: false`.
   *
   * **Example** (Track CRLF byte boundaries)
   *
   * ```ts import.meta.vitest name="Track CRLF byte boundaries"
   * import { Line } from "@beep/scratchpad/effected/jsonl/index";
   * const slices = Line.split("42\r\ntrue\n");
   * slices[1]?.offset // => 4
   * ```
   *
   * @param text - JSONL source text.
   * @returns One {@link LineSlice} per candidate line, in source order.
   * @category parsing
   * @since 0.0.0
   */
  split(text: string): ReadonlyArray<LineSlice> {
    if (Str.isEmpty(text)) return A.empty();
    const parts = Str.split(text, "\n");
    const terminatedCount = A.length(parts) - 1;
    const candidates = Str.endsWith("\n")(text) ? A.dropRight(parts, 1) : parts;
    return A.mapAccum(candidates, 0, (offset, raw, index) => {
      const terminated = index < terminatedCount;
      const hadCarriageReturn = terminated && Str.endsWith("\r")(raw);
      const content = hadCarriageReturn ? Str.slice(0, -1)(raw) : raw;
      const length = utf8Length(content);
      const end = offset + length + (terminated ? (hadCarriageReturn ? 2 : 1) : 0);
      return [end, LineSlice.make({ offset, end, length, text: content, terminated })];
    })[1];
  },

  /**
   * The byte offset up to which this text has been fully consumed.
   *
   * **Details**
   *
   * This is the offset past the last **terminated** line. An unterminated
   * final line is left unconsumed on purpose: it may be a writer caught
   * mid-append, and re-reading from this offset once the file grows sees the
   * completed line rather than gluing a stale fragment to fresh bytes.
   *
   * **Example** (Resume before an incomplete tail)
   *
   * ```ts import.meta.vitest name="Resume before an incomplete tail"
   * import { Line } from "@beep/scratchpad/effected/jsonl/index";
   * Line.consumedOffset("42\n{") // => 3
   * ```
   *
   * @param text - JSONL source text.
   * @returns The resume cursor, in UTF-8 bytes.
   * @category getters
   * @since 0.0.0
   */
  consumedOffset(text: string): number {
    return pipe(
      Line.split(text),
      A.last,
      O.map((last) => (last.terminated ? last.end : last.offset)),
      O.getOrElse(() => 0),
    );
  },

  /**
   * Parse one candidate line's JSON.
   *
   * **Details**
   *
   * Any JSON value succeeds — objects, arrays and scalars alike. This layer
   * does not know what an envelope is.
   *
   * **Example** (Parse one candidate line)
   *
   * ```ts import.meta.vitest name="Parse one candidate line"
   * import { Line } from "@beep/scratchpad/effected/jsonl/index";
   * import * as A from "effect/Array";
   * import * as O from "effect/Option";
   * import * as Result from "effect/Result";
   * const line = O.getOrThrow(A.head(Line.split("42")));
   * Result.map(Line.parseResult(line), (parsed) => parsed.value) // => Result.succeed(42)
   * ```
   *
   * @param line - A slice from {@link Line.split}.
   * @returns The {@link ParsedLine}, or a {@link MalformedLine} carrying the
   *   slice so the caller can locate the damage and decide whether an
   *   unterminated line is a torn tail worth waiting for.
   * @category parsing
   * @since 0.0.0
   */
  parseResult(line: LineSlice): Result.Result<ParsedLine, MalformedLine> {
    return decodeJson(line.text).pipe(
      Result.map((value) => ParsedLine.make({ line, value })),
      Result.mapError(() => MalformedLine.make({ line })),
    );
  },

  /**
   * Parse every non-blank line, reporting failures rather than dropping them.
   *
   * **Details**
   *
   * There is deliberately no "valid lines only" variant. A hole in the middle
   * of a journal is information — it means a line was written that no reader
   * can interpret — and whether that is tolerable is the caller's decision,
   * not this module's. Filter the `Result`s yourself and the choice stays
   * visible at the call site.
   *
   * Whitespace-only lines are skipped rather than reported: they carry no
   * information to lose, and reporting them would make a hand-edited journal
   * look corrupt.
   *
   * **Example** (Retain malformed interior lines)
   *
   * ```ts import.meta.vitest name="Retain malformed interior lines"
   * import { Line } from "@beep/scratchpad/effected/jsonl/index";
   * import * as A from "effect/Array";
   * import * as Result from "effect/Result";
   * A.map(Line.parseAll("42\nbad\ntrue\n"), Result.isSuccess) // => [true, false, true]
   * ```
   *
   * @param text - JSONL source text.
   * @returns One `Result` per non-blank line, in source order.
   * @category parsing
   * @since 0.0.0
   */
  parseAll(text: string): ReadonlyArray<Result.Result<ParsedLine, MalformedLine>> {
    return pipe(
      Line.split(text),
      A.filter((line) => !isBlank(line)),
      A.map(Line.parseResult),
    );
  },

  /**
   * Walk back from the end to the last line that parses.
   *
   * **Details**
   *
   * This is the whole read path for a snapshot-style journal, where the
   * current state *is* the last valid line: a session killed mid-append leaves
   * a partial final line, and the walk-back steps over it — and over any
   * number of malformed or blank trailing lines — to the last line that means
   * something.
   *
   * Parsing stops at the first success, so the cost is proportional to the
   * damage at the tail rather than to the age of the file.
   *
   * **A torn tail is only detectable when its fragment fails to parse.**
   * Every strict prefix of a JSON *object* is invalid JSON, so a truncated
   * `{"event":"unlinked"}` is always caught. A truncated *scalar* is not:
   * `42` cut mid-write leaves `4`, which parses cleanly as a different value.
   * The JSON layer cannot close that hole — the envelope layer can, because
   * `4` is not an envelope, which is one more reason the envelope is the
   * package's contract rather than an option. Check `LineSlice.terminated` on
   * the result when it matters.
   *
   * **Example** (Recover from a torn object tail)
   *
   * ```ts import.meta.vitest name="Recover from a torn object tail"
   * import { Line } from "@beep/scratchpad/effected/jsonl/index";
   * import * as O from "effect/Option";
   * Line.lastValid("42\n{").pipe(O.map((parsed) => parsed.value)) // => O.some(42)
   * ```
   *
   * @param text - JSONL source text.
   * @returns The last parseable line, or `O.none()` if none parses.
   * @category parsing
   * @since 0.0.0
   */
  lastValid(text: string): O.Option<ParsedLine> {
    return pipe(
      Line.split(text),
      A.findLast((line) => (isBlank(line) ? O.none() : Result.getSuccess(Line.parseResult(line)))),
    );
  },
};
