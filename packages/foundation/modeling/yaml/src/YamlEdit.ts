/**
 * The non-mutating text-edit vocabulary shared by the formatter and modifier:
 * YamlEdit, YamlRange, YamlPath and YamlSegment.
 *
 * **Details**
 *
 * Edits describe replacements as `offset`/`length`/`content`; applying them in
 * reverse-offset order is byte-minimal and preserves comments and whitespace —
 * the core value proposition over `yaml` round-trips.
 *
 * `YamlEdit`, `YamlRange`, `YamlPath`, `YamlSegment` and
 * `YamlFormattingOptions` are bound by the cross-package parity convention:
 * they are structurally identical to their `Jsonc*`, `Toml*` and `Markdown*`
 * counterparts (same field names, types, optionality and semantics) so
 * consumer code can be written once over "a document codec's Edit/Range/Path".
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $YamlId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $YamlId.create("YamlEdit");

class YamlEditFailure extends S.TaggedError<YamlEditFailure, { readonly brand: unique symbol }>($I`YamlEditFailure`)(
  "YamlEditFailure",
  {
    message: S.String.pipe(
      $I.annoteKey("YamlEditFailure.message", {
        description: "The overlapping edit ranges that prevent applying the YAML edits.",
      })
    ),
  },
  $I.annoteError<YamlEditFailure>("YamlEditFailure", {
    description: "A defect raised when overlapping YAML text edits cannot be applied consistently.",
  })
) {}

/**
 * A single path segment: a `string` for mapping keys or a `number` for
 * sequence indices.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlSegment = string | number;

/**
 * An ordered sequence of {@link (YamlSegment:type)} values describing a
 * location within a YAML document tree.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlPath = ReadonlyArray<YamlSegment>;

/**
 * **Example** (Select a formatting region)
 *
 * ```ts
 * import { YamlRange } from "@beep/yaml/YamlEdit";
 *
 * const range = YamlRange.make({ offset: 5, length: 3 });
 * console.log(range.offset + range.length) // 8
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlRange extends S.Opaque<YamlRange, { readonly brand: unique symbol }>()(
  S.Struct({
    offset: S.Finite.pipe(
      $I.annoteKey("YamlRange.offset", {
        description: "Zero-based start of the source region to format, measured in UTF-16 code units",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("YamlRange.length", {
        description: "Extent of the source region to format, measured in UTF-16 code units",
      })
    ),
  }).pipe(
    $I.annoteSchema("YamlRange", {
      description:
        "A range within a YAML document, expressed as a zero-based character `offset` and a `length` in UTF-16 code units. Pass to `YamlFormat.format` to restrict formatting to a region.",
    })
  )
) {}

/**
 * **Details**
 *
 * Structurally identical to the edit shape of `@beep/jsonc`,
 * `@beep/toml` and `@beep/markdown` (same field names, types and
 * semantics), so consumer code can be written once over "a document codec's
 * Edit/Range/Path".
 *
 * **Example** (Replace a source span)
 *
 * ```ts
 * import { YamlEdit } from "@beep/yaml/YamlEdit";
 *
 * const edit = YamlEdit.make({ offset: 3, length: 1, content: "2" });
 * console.log(YamlEdit.applyAll("a: 1", [edit])) // a: 2
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlEdit extends S.Opaque<YamlEdit, { readonly brand: unique symbol }>()(
  S.Struct({
    offset: S.Finite.pipe(
      $I.annoteKey("YamlEdit.offset", {
        description: "Zero-based start of the replacement span in the original source, measured in UTF-16 code units",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("YamlEdit.length", {
        description: "Number of source UTF-16 code units to replace; `0` inserts without removing text",
      })
    ),
    content: S.String.pipe(
      $I.annoteKey("YamlEdit.content", {
        description: "Replacement text for the selected source span; an empty string deletes the span",
      })
    ),
  }).pipe(
    $I.annoteSchema("YamlEdit", {
      description:
        'A non-mutating text edit: replace the span `[offset, offset + length)` with `content`. Set `length` to `0` to insert, `content` to `""` to delete.',
    })
  )
) {
  /**
   * Apply `edits` to `text`, producing a new string.
   *
   * **Details**
   *
   * Edits are applied in
   * reverse-offset order so earlier offsets stay valid; the input `edits`
   * array is not mutated.
   *
   * **Gotchas**
   *
   * Overlapping edits are a programmer error and throw
   * as a defect — `YamlFormat` never produces them.
   *
   * **Example** (Apply edits supplied in source order)
   *
   * ```ts
   * import { YamlEdit } from "@beep/yaml/YamlEdit";
   *
   * const edits = [
   *   YamlEdit.make({ offset: 3, length: 1, content: "2" }),
   *   YamlEdit.make({ offset: 8, length: 1, content: "4" }),
   * ];
   * console.log(JSON.stringify(YamlEdit.applyAll("a: 1\nb: 3\n", edits))) // "a: 2\nb: 4\n"
   * ```
   *
   * @param text - The source text to edit.
   * @param edits - The edits to apply, in any order.
   * @returns The edited text.
   * @category utilities
   * @since 0.0.0
   */
  static readonly applyAll: {
    (text: string, edits: ReadonlyArray<YamlEdit>): string;
    (edits: ReadonlyArray<YamlEdit>): (text: string) => string;
  } = dual(2, (text: string, edits: ReadonlyArray<YamlEdit>): string => {
    const sorted = A.sort(edits, Order.flip(Order.mapInput(Order.Number, (edit: YamlEdit) => edit.offset)));
    for (const [upper, lower] of A.zip(sorted, A.drop(sorted, 1))) {
      if (lower.offset + lower.length > upper.offset) {
        throw YamlEditFailure.make({
          message: `YamlEdit.applyAll received overlapping edits at offsets ${lower.offset} and ${upper.offset} — overlapping edits are a programmer error`,
        });
      }
    }
    let result = text;
    for (const edit of sorted) {
      result = Str.substring(0, edit.offset)(result) + edit.content + Str.substring(edit.offset + edit.length)(result);
    }
    return result;
  });
}
