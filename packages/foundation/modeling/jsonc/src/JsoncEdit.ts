/**
 * The non-mutating text-edit vocabulary shared by the formatter and modifier:
 * `JsoncEdit`, `JsoncRange` and `JsoncFormattingOptions`.
 *
 * **Details**
 *
 * Edits describe replacements as `offset`/`length`/`content`; applying them in
 * reverse-offset order is byte-minimal and preserves comments and whitespace,
 * the core value proposition over a parse-and-stringify round trip.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $JsoncId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, identity } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $JsoncId.create("JsoncEdit");

/**
 * A range within a JSONC document, expressed as a zero-based character
 * `offset` and a `length` in UTF-16 code units.
 *
 * **When to use**
 *
 * Use with `JsoncFormatter.format` to restrict formatting to a region.
 *
 * **Example** (Describe the first four characters)
 *
 * ```ts
 * import { JsoncRange } from "@beep/jsonc/JsoncEdit"
 *
 * const range = JsoncRange.make({ offset: 0, length: 4 })
 *
 * console.log(range.offset + range.length) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsoncRange extends S.Opaque<JsoncRange, { readonly brand: unique symbol }>()(
  S.Struct({
    offset: S.Finite,
    length: S.Finite,
  }).pipe(
    $I.annoteSchema("JsoncRange", {
      description: "A character span inside a JSONC document.",
    })
  )
) {}

/**
 * Options controlling JSONC formatting. Every field has a schema default, so
 * `JsoncFormattingOptions.make({})` is the canonical style.
 *
 * **Details**
 *
 * - `tabSize`: indent width in columns when `insertSpaces` is `true`. Defaults
 *   to `2`. Any finite number is accepted: a fractional width is truncated
 *   toward zero, and a negative one indents by nothing.
 * - `insertSpaces`: indent with spaces when `true`, one tab when `false`.
 *   Defaults to `true`.
 * - `eol`: the line ending inserted between formatted tokens. Defaults to
 *   `"\n"`.
 * - `insertFinalNewline`: append `eol` at the end of the document when it does
 *   not already end with one. Defaults to `false`.
 * - `keepLines`: preserve existing line breaks between tokens instead of
 *   collapsing each gap to one `eol`. Defaults to `false`.
 *
 * **Example** (Format with tabs)
 *
 * ```ts
 * import { JsoncFormattingOptions } from "@beep/jsonc/JsoncEdit"
 * import { JsoncFormatter } from "@beep/jsonc/JsoncFormatter"
 *
 * const options = JsoncFormattingOptions.make({ insertSpaces: false })
 *
 * console.log(options.tabSize) // 2
 * console.log(JsoncFormatter.formatToString('{"a":1}', undefined, options)) // '{\n\t"a": 1\n}'
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsoncFormattingOptions extends S.Opaque<JsoncFormattingOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    tabSize: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(2)), S.withDecodingDefaultKey(Effect.succeed(2))),
    insertSpaces: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultKey(Effect.succeed(true))
    ),
    eol: S.String.pipe(S.withConstructorDefault(Effect.succeed("\n")), S.withDecodingDefaultKey(Effect.succeed("\n"))),
    insertFinalNewline: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    keepLines: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
  }).pipe(
    $I.annoteSchema("JsoncFormattingOptions", {
      description: "Indentation, line-ending and line-preservation settings for JSONC formatting.",
    })
  )
) {}

/**
 * Formatting options accepted at call sites: the encoded side of
 * {@link JsoncFormattingOptions}, where every field is optional, so a plain
 * literal such as `{ insertSpaces: false }` is accepted alongside a
 * constructed instance.
 *
 * **Example** (Normalize a literal into the canonical class)
 *
 * ```ts
 * import { JsoncFormattingOptions, JsoncFormattingOptionsLike } from "@beep/jsonc/JsoncEdit"
 * import * as S from "effect/Schema"
 *
 * const like: JsoncFormattingOptionsLike = { eol: "\r\n" }
 *
 * console.log(S.is(JsoncFormattingOptionsLike)(like)) // true
 * console.log(JsoncFormattingOptions.make(like).tabSize) // 2
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsoncFormattingOptionsLike = S.toEncoded(JsoncFormattingOptions);

/**
 * The decoded shape of {@link JsoncFormattingOptionsLike}.
 *
 * @see {@link JsoncFormattingOptionsLike} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type JsoncFormattingOptionsLike = typeof JsoncFormattingOptionsLike.Type;

/**
 * Raised by {@link JsoncEdit.applyAllResult} when two edits overlap.
 *
 * **Details**
 *
 * Overlapping edits are a programmer error: neither `JsoncFormatter` nor
 * `JsoncModifier` ever produces them. `lower` and `upper` carry the offsets of
 * the two conflicting edits.
 *
 * **Example** (Read the conflicting offsets)
 *
 * ```ts
 * import { JsoncEditOverlapError } from "@beep/jsonc/JsoncEdit"
 *
 * const error = JsoncEditOverlapError.make({ lower: 0, upper: 2 })
 *
 * console.log(error.message) // "JsoncEdit.applyAll received overlapping edits at offsets 0 and 2"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JsoncEditOverlapError extends S.TaggedError<JsoncEditOverlapError, { readonly brand: unique symbol }>(
  $I.make("JsoncEditOverlapError")
)(
  "JsoncEditOverlapError",
  {
    lower: S.Finite,
    upper: S.Finite,
  },
  $I.annoteError<JsoncEditOverlapError>("JsoncEditOverlapError", {
    description: "Two edits passed to JsoncEdit.applyAll overlap.",
  })
) {
  /**
   * Name both conflicting offsets.
   *
   * **Example** (Read the rendered message)
   *
   * ```ts
   * import { JsoncEditOverlapError } from "@beep/jsonc/JsoncEdit"
   *
   * console.log(JsoncEditOverlapError.make({ lower: 0, upper: 2 }).message.endsWith("offsets 0 and 2")) // true
   * ```
   */
  override get message(): string {
    return `JsoncEdit.applyAll received overlapping edits at offsets ${this.lower} and ${this.upper}`;
  }
}

// Latest offset first; at one offset the longer edit first, so an insertion
// lands before a replacement that starts there (jsonc-parser's applyEdits order).
const byOffsetDescending = Order.flip(
  Order.combine(
    Order.mapInput(Order.Number, (edit: JsoncEdit) => edit.offset),
    Order.mapInput(Order.Number, (edit: JsoncEdit) => edit.length)
  )
);

/**
 * A non-mutating text edit: replace the span `[offset, offset + length)` with
 * `content`. Set `length` to `0` to insert and `content` to `""` to delete.
 *
 * **Example** (Apply a single replacement)
 *
 * ```ts
 * import { JsoncEdit } from "@beep/jsonc/JsoncEdit"
 *
 * const edit = JsoncEdit.make({ offset: 7, length: 1, content: "2" })
 *
 * console.log(JsoncEdit.applyAll('{ "a": 1 }', [edit])) // '{ "a": 2 }'
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsoncEdit extends S.Opaque<JsoncEdit, { readonly brand: unique symbol }>()(
  S.Struct({
    offset: S.Finite,
    length: S.Finite,
    content: S.String,
  }).pipe(
    $I.annoteSchema("JsoncEdit", {
      description: "A replacement of one character span with new content.",
    })
  )
) {
  /**
   * Apply `edits` to `text`, producing a new string, or fail when two edits
   * overlap.
   *
   * **Details**
   *
   * Edits are applied in reverse-offset order so earlier offsets stay valid;
   * the input array is not mutated. Touching edits (one ending exactly where
   * the next begins) are fine, and at one offset the longer edit applies first,
   * so an insertion there lands before the replacement that starts there.
   *
   * **Example** (Receive an overlap as a value)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import { JsoncEdit } from "@beep/jsonc/JsoncEdit"
   *
   * const first = JsoncEdit.make({ offset: 0, length: 4, content: "x" })
   * const second = JsoncEdit.make({ offset: 2, length: 3, content: "y" })
   *
   * console.log(Result.isFailure(JsoncEdit.applyAllResult("abcdef", [first, second]))) // true
   * console.log(Result.getOrThrow(JsoncEdit.applyAllResult("abcdef", [first]))) // "xef"
   * ```
   *
   * @param text - The source text to edit.
   * @param edits - The edits to apply, in any order.
   * @returns The edited text, or a {@link JsoncEditOverlapError}.
   */
  static readonly applyAllResult: {
    (text: string, edits: ReadonlyArray<JsoncEdit>): Result.Result<string, JsoncEditOverlapError>;
    (edits: ReadonlyArray<JsoncEdit>): (text: string) => Result.Result<string, JsoncEditOverlapError>;
  } = dual(2, (text: string, edits: ReadonlyArray<JsoncEdit>): Result.Result<string, JsoncEditOverlapError> => {
    const sorted = A.sort(edits, byOffsetDescending);
    const overlap = A.findFirst(
      A.zip(sorted, A.drop(sorted, 1)),
      ([upper, lower]) => lower.offset + lower.length > upper.offset
    );
    return O.match(overlap, {
      onNone: () =>
        Result.succeed(
          A.reduce(
            sorted,
            text,
            (result, edit) =>
              Str.substring(0, edit.offset)(result) + edit.content + Str.substring(edit.offset + edit.length)(result)
          )
        ),
      onSome: ([upper, lower]) => Result.fail(JsoncEditOverlapError.make({ lower: lower.offset, upper: upper.offset })),
    });
  });

  /**
   * Apply `edits` to `text`, producing a new string.
   *
   * **Gotchas**
   *
   * Overlapping edits throw a {@link JsoncEditOverlapError}: they are a
   * programmer error that the formatter and modifier never produce. Use
   * {@link JsoncEdit.applyAllResult} to receive it as a value.
   *
   * **Example** (Apply edits in any order)
   *
   * ```ts
   * import { JsoncEdit } from "@beep/jsonc/JsoncEdit"
   *
   * const edits = [
   *   JsoncEdit.make({ offset: 0, length: 1, content: "X" }),
   *   JsoncEdit.make({ offset: 4, length: 2, content: "YZ" }),
   *   JsoncEdit.make({ offset: 2, length: 0, content: "-" }),
   * ]
   *
   * console.log(JsoncEdit.applyAll("abcdef", edits)) // "Xb-cdYZ"
   * ```
   *
   * @param text - The source text to edit.
   * @param edits - The edits to apply, in any order.
   * @returns The edited text.
   * @throws A {@link JsoncEditOverlapError} when two edits overlap.
   */
  static readonly applyAll: {
    (text: string, edits: ReadonlyArray<JsoncEdit>): string;
    (edits: ReadonlyArray<JsoncEdit>): (text: string) => string;
  } = dual(2, (text: string, edits: ReadonlyArray<JsoncEdit>): string =>
    Result.getOrThrowWith(JsoncEdit.applyAllResult(text, edits), identity)
  );
}
