/**
 * The non-mutating text-edit vocabulary shared by the formatter and modifier:
 * `JsoncEdit`, `JsoncRange` and `JsoncFormattingOptions`.
 *
 * **Details**
 *
 * Edits describe replacements as `offset`/`length`/`content`; applying them in
 * reverse-offset order is byte-minimal and preserves comments and whitespace —
 * the core value proposition over `JSON.parse`/`JSON.stringify` round-trips.
 *
 * `JsoncEdit`, `JsoncRange`, `JsoncPath`, `JsoncSegment` and
 * `JsoncFormattingOptions` are bound by the jsonc/yaml parity convention:
 * their future `Yaml*` counterparts must be structurally identical (same
 * field names, types, optionality and semantics) so consumer code can be
 * written once over "a document codec's Edit/Range/Path".
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";

const $I = $ScratchpadId.create("jsonc/JsoncEdit");

class OverlappingJsoncEdits extends Schema.TaggedError<OverlappingJsoncEdits>($I`OverlappingJsoncEdits`)(
  "OverlappingJsoncEdits",
  {
    lowerOffset: Schema.Finite,
    upperOffset: Schema.Finite,
  }
) {}

/**
 * A range within a JSONC document, expressed as a zero-based character
 * `offset` and a `length` in UTF-16 code units. Pass to `JsoncFormatter.format`
 * to restrict formatting to a region.
 *
 * **Example** (Build a formatting range)
 *
 * ```ts
 * import { JsoncRange } from "@beep/scratchpad/jsonc";
 *
 * const range = JsoncRange.make({ offset: 0, length: 16 });
 *
 * console.log(range.offset); // 0
 * console.log(range.length); // 16
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class JsoncRange extends Schema.Class<JsoncRange>($I`JsoncRange`)(
  {
    offset: Schema.Finite,
    length: Schema.Finite,
  },
  $I.annote("JsoncRange", {
    description: "A zero-based UTF-16 offset/length window used to restrict JSONC formatting.",
  })
) {}

/**
 * Options controlling JSONC formatting. All fields are omissible.
 *
 * **Details**
 *
 * - `tabSize` — the indent width in columns when `insertSpaces` is `true`.
 *   Defaults to `2`.
 * - `insertSpaces` — indent with spaces (`tabSize` of them) when `true`, or a
 *   single tab character when `false`. Defaults to `true`.
 * - `eol` — the line-ending string inserted between formatted tokens.
 *   Defaults to `"\n"`.
 * - `insertFinalNewline` — append `eol` at the end of the document if it
 *   doesn't already end with one. Defaults to `false`.
 * - `keepLines` — preserve existing line breaks (including blank lines)
 *   between tokens instead of collapsing each gap to the canonical single
 *   `eol`. Defaults to `false`.
 *
 * **Example** (Request tab indentation)
 *
 * ```ts
 * import { JsoncFormattingOptions } from "@beep/scratchpad/jsonc";
 *
 * const options = JsoncFormattingOptions.make({ insertSpaces: false, tabSize: 2 });
 *
 * console.log(options.insertSpaces); // false
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class JsoncFormattingOptions extends Schema.Class<JsoncFormattingOptions>($I`JsoncFormattingOptions`)(
  {
    tabSize: Schema.optionalKey(Schema.Finite),
    insertSpaces: Schema.optionalKey(Schema.Boolean),
    eol: Schema.optionalKey(Schema.String),
    insertFinalNewline: Schema.optionalKey(Schema.Boolean),
    keepLines: Schema.optionalKey(Schema.Boolean),
  },
  $I.annote("JsoncFormattingOptions", {
    description: "Omissible JSONC formatting knobs for indent, EOL, final newline, and keep-lines.",
  })
) {}

/**
 * Formatting options accepted at call sites: either a
 * {@link JsoncFormattingOptions} instance or a plain literal with the same
 * fields (the two are structurally interchangeable — only the option fields
 * are read). Mirrors the `YamlRangeLike` posture in `@effected/yaml`, so a
 * caller can pass `{ insertSpaces: false, tabSize: 2 }` without constructing
 * the class. `JsoncFormattingOptions` remains the canonical decoded form.
 *
 * **Example** (Guard a structural formatting literal)
 *
 * ```ts
 * import { JsoncFormattingOptionsLike } from "@beep/scratchpad/jsonc"
 * import { Schema } from "effect"
 *
 * console.log(Schema.is(JsoncFormattingOptionsLike)({ insertSpaces: false, tabSize: 2 })) // true
 * ```
 *
 * @see {@link JsoncFormattingOptions} for the canonical decoded options class.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export const JsoncFormattingOptionsLike = Schema.Union([
  JsoncFormattingOptions,
  Schema.Struct(JsoncFormattingOptions.fields),
]).pipe(
  $I.annoteSchema("JsoncFormattingOptionsLike", {
    description: "JSONC formatting options accepted as either the canonical class or a structural literal.",
  })
);

/**
 * Decoded JSONC formatting options accepted by formatter and modifier APIs.
 *
 * @see {@link JsoncFormattingOptionsLike} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type JsoncFormattingOptionsLike = typeof JsoncFormattingOptionsLike.Type;

/**
 * A non-mutating text edit: replace the span `[offset, offset + length)` with
 * `content`. Set `length` to `0` to insert, `content` to `""` to delete.
 *
 * **Example** (Apply two non-overlapping edits)
 *
 * ```ts
 * import { JsoncEdit } from "@beep/scratchpad/jsonc";
 *
 * const source = '{ "port": 3000 }';
 * const portKey = '"port"';
 * const portValue = "3000";
 * const edited = JsoncEdit.applyAll(source, [
 *   JsoncEdit.make({
 *     offset: source.indexOf(portValue),
 *     length: portValue.length,
 *     content: "8080",
 *   }),
 *   JsoncEdit.make({
 *     offset: source.indexOf(portKey),
 *     length: portKey.length,
 *     content: '"host"',
 *   }),
 * ]);
 *
 * console.log(edited); // { "host": 8080 }
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class JsoncEdit extends Schema.Class<JsoncEdit>($I`JsoncEdit`)(
  {
    offset: Schema.Finite,
    length: Schema.Finite,
    content: Schema.String,
  },
  $I.annote("JsoncEdit", {
    description: "A non-mutating text splice replacing [offset, offset + length) with content.",
  })
) {
  /**
   * Apply `edits` to `text`, producing a new string. Edits are applied in
   * reverse-offset order so earlier offsets stay valid; the input `edits`
   * array is not mutated.
   *
   * **Gotchas**
   *
   * Input order is irrelevant because application is reverse-offset. Overlapping
   * spans throw: synthesizing edits (not just formatter output) can hit this
   * untyped defect. {@link JsoncFormatter} never produces overlapping edits.
   *
   * **Example** (Replace a value by offset)
   *
   * ```ts
   * import { JsoncEdit } from "@beep/scratchpad/jsonc";
   *
   * const source = '{ "port": 3000 }';
   * const edited = JsoncEdit.applyAll(source, [
   *   JsoncEdit.make({
   *     offset: source.indexOf("3000"),
   *     length: 4,
   *     content: "8080",
   *   }),
   * ]);
   *
   * console.log(edited); // { "port": 8080 }
   * ```
   *
   * @param text - The source text to edit.
   * @param edits - The edits to apply, in any order.
   * @throws {@link OverlappingJsoncEdits} as a defect when edit ranges overlap.
   * @see {@link JsoncFormatter.format} for a producer that never overlaps.
   * @since 0.0.0
   */
  static applyAll(text: string, edits: ReadonlyArray<JsoncEdit>): string {
    const sorted = [...edits].sort((a, b) => b.offset - a.offset);
    for (let i = 0; i + 1 < sorted.length; i++) {
      const upper = sorted[i];
      const lower = sorted[i + 1];
      if (lower.offset + lower.length > upper.offset) {
        throw OverlappingJsoncEdits.make({ lowerOffset: lower.offset, upperOffset: upper.offset });
      }
    }
    let result = text;
    for (const edit of sorted) {
      result = result.substring(0, edit.offset) + edit.content + result.substring(edit.offset + edit.length);
    }
    return result;
  }
}
