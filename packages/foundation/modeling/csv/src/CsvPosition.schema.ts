/**
 * Where things are in CSV text: bounded 0-based positions, a span with its line and character, and how a record
 * ended. Every position counts UTF-16 units of the decoded text; a byte offset is its own schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CsvId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { lineCharacterAt } from "@beep/utils/Text";
import * as S from "effect/Schema";

const $I = $CsvId.create("CsvPosition");

/**
 * The most UTF-16 units of text a read takes in: 2^29 - 24, the longest string V8 holds. Every text position and
 * length is bounded by it, so generated positions are ones a real read can have.
 *
 * **Details**
 *
 * The bound is the package's, not every engine's: JavaScriptCore (Bun) holds longer strings, and a stream's text has
 * no length at all. A read never reports a position past it: `CsvLimits.maxTextLength`, at most this, stops the read
 * with `LimitExceeded` `textLength` at the first unit past the cap.
 *
 * **Example** (Bound a text position)
 *
 * ```ts import.meta.vitest name="Bound a text position"
 * import { CsvIndex, MAX_TEXT_UNITS } from "@beep/csv/CsvPosition.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvIndex)(MAX_TEXT_UNITS) // => true
 * S.is(CsvIndex)(MAX_TEXT_UNITS + 1) // => false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_TEXT_UNITS = 536_870_888;

/**
 * A 0-based position or count in decoded text, an integer from 0 up to {@link MAX_TEXT_UNITS}. A position in a
 * stream counts units across every chunk.
 *
 * **Example** (Accept indexes and refuse the rest)
 *
 * ```ts import.meta.vitest name="Accept indexes and refuse the rest"
 * import { CsvIndex } from "@beep/csv/CsvPosition.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvIndex)(12) // => true
 * S.is(CsvIndex)(-1) // => false
 * S.is(CsvIndex)(1.5) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvIndex = S.Int.check(S.isBetween({ minimum: 0, maximum: MAX_TEXT_UNITS })).pipe(
  $I.annoteSchema("CsvIndex", {
    description: "A 0-based position or count in decoded text, at most the text a read takes in",
  })
);

/**
 * A decoded {@link CsvIndex}: a plain non-negative integer, at most {@link MAX_TEXT_UNITS}.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvIndex = typeof CsvIndex.Type;

/**
 * A 0-based offset into the input bytes, for findings about the encoding. Unlike {@link CsvIndex} it is bounded by
 * `Number.MAX_SAFE_INTEGER`, because the text-length cap does not count bytes.
 *
 * **Example** (Accept a byte offset past the text bound)
 *
 * ```ts import.meta.vitest name="Accept a byte offset past the text bound"
 * import { CsvByteOffset, CsvIndex, MAX_TEXT_UNITS } from "@beep/csv/CsvPosition.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(CsvByteOffset)(MAX_TEXT_UNITS + 1) // => true
 * S.is(CsvIndex)(MAX_TEXT_UNITS + 1) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvByteOffset = S.Int.check(S.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })).pipe(
  $I.annoteSchema("CsvByteOffset", { description: "A 0-based offset into the input bytes" })
);

/**
 * A decoded {@link CsvByteOffset}: a non-negative safe integer counting input bytes.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvByteOffset = typeof CsvByteOffset.Type;

/**
 * A stretch of the decoded text: where it starts, how long it is, and the 0-based line and character of its start.
 *
 * **Details**
 *
 * `CsvTextSpan.locate` builds a span from the text it points into, counting `\n`, `\r` and `\r\n` each as one line
 * break; `CsvTextSpan.render` gives the 1-based `line:column` a person sees in an editor. A span a stream reports
 * counts its offset and line across every chunk of the stream, so it is bounded by `CsvLimits.maxTextLength`.
 *
 * **Example** (Locate an offset)
 *
 * ```ts import.meta.vitest name="Locate an offset"
 * import { CsvTextSpan } from "@beep/csv/CsvPosition.schema"
 *
 * const span = CsvTextSpan.locate("a,b\r\nc", 5, 1)
 * span.line // => 1
 * span.character // => 0
 * CsvTextSpan.render(span) // => "2:1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CsvTextSpan extends S.Opaque<CsvTextSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    offset: CsvIndex.pipe(S.annotateKey({ description: "First UTF-16 unit of the span" })),
    length: CsvIndex.pipe(S.annotateKey({ description: "UTF-16 units the span covers" })),
    line: CsvIndex.pipe(S.annotateKey({ description: "0-based physical line of the first unit" })),
    character: CsvIndex.pipe(S.annotateKey({ description: "0-based unit of the first unit within its line" })),
  }).pipe($I.annoteSchema("CsvTextSpan", { description: "Where something is in the decoded text" }))
) {
  /** The span at `offset`, its line and character counted from `text` (`\n`, `\r` and `\r\n` each break a line). */
  static readonly locate = (text: string, offset: number, length: number): CsvTextSpan => {
    const at = lineCharacterAt(text, offset);
    return CsvTextSpan.make({ offset, length, line: at.line, character: at.character });
  };

  /** The 1-based "line:column" a person counts in an editor. */
  static readonly render = (span: Pick<CsvTextSpan, "line" | "character">): string =>
    `${span.line + 1}:${span.character + 1}`;
}

/**
 * How a record ended in the source: a line feed, a carriage return and line feed, a lone carriage return, or the end
 * of the input with no line break after it.
 *
 * **Example** (Decode a record end)
 *
 * ```ts import.meta.vitest name="Decode a record end"
 * import { CsvRecordEnd } from "@beep/csv/CsvPosition.schema"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * Result.getOrThrow(S.decodeUnknownResult(CsvRecordEnd)("CRLF")) // => "CRLF"
 * S.is(CsvRecordEnd)("CRCR") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CsvRecordEnd = LiteralKit(["LF", "CRLF", "CR", "EndOfInput"]).pipe(
  $I.annoteSchema("CsvRecordEnd", { description: "How a record ended in the source" })
);

/**
 * One of the four ways a record can end, as decoded by {@link CsvRecordEnd}.
 *
 * @category models
 * @since 0.0.0
 */
export type CsvRecordEnd = typeof CsvRecordEnd.Type;

/**
 * The characters each record end stands for, so a record can be written back with the ending it was read with.
 *
 * **Example** (Turn a record end back into text)
 *
 * ```ts import.meta.vitest name="Turn a record end back into text"
 * import { recordEndText } from "@beep/csv/CsvPosition.schema"
 *
 * recordEndText("CRLF") // => "\r\n"
 * recordEndText("EndOfInput") // => ""
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const recordEndText = CsvRecordEnd.match({
  LF: () => "\n",
  CRLF: () => "\r\n",
  CR: () => "\r",
  EndOfInput: () => "",
});
