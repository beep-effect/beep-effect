/**
 * The pure, synchronous line layer of a JSONL journal.
 *
 * Nothing here touches `FileSystem`, builds an `Effect`, or needs a runtime —
 * a `PreToolUse` hook script reads the current state of a journal with one
 * call. That is a contract, not a convenience: a hook that had to construct an
 * Effect runtime to read one line would not adopt this package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { Option, Result, Schema } from "effect";
import { utf8Length } from "./internal/utf8.ts";
import { MalformedLine } from "./JsonlError.ts";
import { LineSlice } from "./LineSlice.ts";

const $I = $ScratchpadId.create("jsonl/Line");

/**
 * A line that parsed as JSON, paired with the slice it came from.
 *
 * `value` is deliberately `unknown`: this layer knows JSON, not envelopes.
 * Validating `event`, `at`, `scope` and the registered payload schema is the
 * envelope layer's job, and keeping the split means a malformed *envelope* and
 * a malformed *line* stay distinguishable failures.
 *
 * **Example** (Parse a well-formed object line)
 *
 * ```ts
 * import { Line } from "@beep/scratchpad/jsonl"
 * import { Result } from "effect"
 *
 * const line = Line.split('{"round":1}\n')[0]
 * if (line !== undefined) {
 *   const parsed = Line.parseResult(line)
 *   console.log(Result.isSuccess(parsed)) // true
 *   if (Result.isSuccess(parsed)) {
 *     console.log(parsed.success.value) // { round: 1 }
 *   }
 * }
 * ```
 *
 * @see {@link Line} for split/parse/lastValid that produce this pairing.
 * @see {@link LineSlice} for the byte-located slice `line` carries.
 * @public
 * @category models
 * @since 0.0.0
 */
export class ParsedLine extends Schema.Class<ParsedLine>($I`ParsedLine`)(
  {
    /** Where this line lives in the source. */
    line: LineSlice,
    /** The parsed JSON value — any JSON value, not necessarily an object. */
    value: Schema.Unknown,
  },
  $I.annote("ParsedLine", {
    description: "A JSON-parsed line paired with the byte slice it came from.",
  })
) {}

/** Whether a line carries nothing but whitespace. */
const isBlank = (line: LineSlice): boolean => line.text.trim() === "";

/**
 * Splitting, parsing and corrupt-tail walk-back over JSONL text.
 *
 * Every operation is total and synchronous: it returns a value for every
 * input, including empty text, torn tails, and text that is not JSONL at all.
 * Nothing here throws — a `JSON.parse` failure becomes a {@link MalformedLine}
 * in the returned `Result`, because a journal is untrusted input and untrusted
 * input fails typed.
 *
 * **Gotchas**
 *
 * `Line.lastValid` stops at JSON validity. A torn scalar tail (`42` cut
 * mid-write leaves `4`) parses as a different value, so a JSON-level walk-back
 * hands back corruption as the current state. Use {@link Envelope.lastValidResult}
 * when the line must be an envelope. Offsets are UTF-8 bytes:
 * `Line.byteLength("\u{1F600}")` is 4, while `"\u{1F600}".length` is 2.
 *
 * **Example** (Split offsets and last-valid walk-back)
 *
 * ```ts
 * import { Line } from "@beep/scratchpad/jsonl"
 * import * as O from "effect/Option"
 *
 * const text = '{"a":1}\r\n{"b":2}\n{"c":'
 * const first = Line.split(text)[0]
 * if (first !== undefined) {
 *   console.log(first.text) // '{"a":1}'
 *   console.log(first.offset) // 0
 *   console.log(first.length) // 7
 *   console.log(first.end) // 9
 * }
 *
 * const last = Line.lastValid(text)
 * console.log(O.isSome(last)) // true
 * if (O.isSome(last)) {
 *   console.log(last.value.value) // { b: 2 }
 * }
 * ```
 *
 * @see {@link LineSlice} for the byte-located slice `split` returns.
 * @see {@link MalformedLine} for the typed JSON-parse failure.
 * @see {@link Envelope} for the envelope walk-back that closes the torn-scalar hole.
 * @public
 * @category parsing
 * @since 0.0.0
 */
export class Line {
  /**
   * The UTF-8 byte length of a string.
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
   * **Example** (Emoji bytes vs String.length)
   *
   * ```ts
   * import { Line } from "@beep/scratchpad/jsonl"
   *
   * console.log(Line.byteLength("\u{1F600}")) // 4
   * console.log("\u{1F600}".length) // 2
   * ```
   */
  static byteLength(text: string): number {
    return utf8Length(text);
  }

  /**
   * Split text into candidate lines with byte-exact offsets.
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
   * **Example** (CRLF split keeps content and end distinct)
   *
   * ```ts
   * import { Line } from "@beep/scratchpad/jsonl"
   *
   * const lines = Line.split('{"a":1}\r\n{"b":2}\n')
   * console.log(lines.length) // 2
   * console.log(lines[0]?.end) // 9
   * console.log(lines[1]?.offset) // 9
   * ```
   *
   * @param text - JSONL source text.
   * @returns One {@link LineSlice} per candidate line, in source order.
   */
  static split(text: string): ReadonlyArray<LineSlice> {
    const lines: Array<LineSlice> = [];
    let offset = 0;
    let start = 0;
    for (;;) {
      const newline = text.indexOf("\n", start);
      if (newline === -1) {
        break;
      }
      const raw = text.slice(start, newline);
      const hadCarriageReturn = raw.endsWith("\r");
      const content = hadCarriageReturn ? raw.slice(0, -1) : raw;
      const length = utf8Length(content);
      const end = offset + length + (hadCarriageReturn ? 2 : 1);
      lines.push(LineSlice.make({ offset, end, length, text: content, terminated: true }));
      offset = end;
      start = newline + 1;
    }
    if (start < text.length) {
      const content = text.slice(start);
      const length = utf8Length(content);
      lines.push(LineSlice.make({ offset, end: offset + length, length, text: content, terminated: false }));
    }
    return lines;
  }

  /**
   * The byte offset up to which this text has been fully consumed.
   *
   * This is the offset past the last **terminated** line. An unterminated
   * final line is left unconsumed on purpose: it may be a writer caught
   * mid-append, and re-reading from this offset once the file grows sees the
   * completed line rather than gluing a stale fragment to fresh bytes.
   *
   * **Example** (Leave a torn tail unconsumed)
   *
   * ```ts
   * import { Line } from "@beep/scratchpad/jsonl"
   *
   * console.log(Line.consumedOffset('{"a":1}\n{"b":')) // 8
   * console.log(Line.consumedOffset('{"a":1}\n')) // 8
   * ```
   *
   * @param text - JSONL source text.
   * @returns The resume cursor, in UTF-8 bytes.
   */
  static consumedOffset(text: string): number {
    const lines = Line.split(text);
    const last = lines.at(-1);
    if (last === undefined) {
      return 0;
    }
    return last.terminated ? last.end : last.offset;
  }

  /**
   * Parse one candidate line's JSON.
   *
   * Any JSON value succeeds — objects, arrays and scalars alike. This layer
   * does not know what an envelope is.
   *
   * **Example** (Object succeeds, torn object fails)
   *
   * ```ts
   * import { Line } from "@beep/scratchpad/jsonl"
   * import { Result } from "effect"
   *
   * const good = Line.split('{"a":1}\n')[0]
   * const torn = Line.split('{"a":')[0]
   * if (good !== undefined && torn !== undefined) {
   *   console.log(Result.isSuccess(Line.parseResult(good))) // true
   *   console.log(Result.isFailure(Line.parseResult(torn))) // true
   * }
   * ```
   *
   * @param line - A slice from {@link Line.split}.
   * @returns The {@link ParsedLine}, or a {@link MalformedLine} carrying the
   *   slice so the caller can locate the damage and decide whether an
   *   unterminated line is a torn tail worth waiting for.
   */
  static parseResult(line: LineSlice): Result.Result<ParsedLine, MalformedLine> {
    let value: unknown;
    try {
      value = JSON.parse(line.text);
    } catch {
      // Every throw is converted here — a SyntaxError from invalid JSON and a
      // RangeError from pathological nesting alike. A throw escaping this
      // module would be a defect that no `Effect.catch*` combinator can see.
      return Result.fail(MalformedLine.make({ line }));
    }
    return Result.succeed(ParsedLine.make({ line, value }));
  }

  /**
   * Parse every non-blank line, reporting failures rather than dropping them.
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
   * **Example** (Keep the hole, skip the blank)
   *
   * ```ts
   * import { Line } from "@beep/scratchpad/jsonl"
   * import { Result } from "effect"
   *
   * const results = Line.parseAll('{"a":1}\n\n{"b":\n{"c":3}\n')
   * const first = results[0]
   * const hole = results[1]
   * const last = results[2]
   * console.log(results.length) // 3
   * console.log(first !== undefined && Result.isSuccess(first)) // true
   * console.log(hole !== undefined && Result.isFailure(hole)) // true
   * console.log(last !== undefined && Result.isSuccess(last)) // true
   * ```
   *
   * @param text - JSONL source text.
   * @returns One `Result` per non-blank line, in source order.
   */
  static parseAll(text: string): ReadonlyArray<Result.Result<ParsedLine, MalformedLine>> {
    const results: Array<Result.Result<ParsedLine, MalformedLine>> = [];
    for (const line of Line.split(text)) {
      if (!isBlank(line)) {
        results.push(Line.parseResult(line));
      }
    }
    return results;
  }

  /**
   * Walk back from the end to the last line that parses.
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
   * **Example** (Walk back over a torn object)
   *
   * ```ts
   * import { Line } from "@beep/scratchpad/jsonl"
   * import * as O from "effect/Option"
   *
   * const last = Line.lastValid('{"round":1}\n{"round":')
   * console.log(O.isSome(last)) // true
   * if (O.isSome(last)) {
   *   console.log(last.value.value) // { round: 1 }
   * }
   * ```
   *
   * @param text - JSONL source text.
   * @returns The last parseable line, or `Option.none()` if none parses.
   */
  static lastValid(text: string): Option.Option<ParsedLine> {
    const lines = Line.split(text);
    for (let index = lines.length - 1; index >= 0; index--) {
      const line = lines[index];
      if (line === undefined || isBlank(line)) {
        continue;
      }
      const parsed = Line.parseResult(line);
      if (Result.isSuccess(parsed)) {
        return Option.some(parsed.success);
      }
    }
    return Option.none();
  }
}
