/**
 * The non-mutating text-edit vocabulary shared by the formatter and the
 * modifier: TomlEdit, TomlRange, TomlPath and TomlSegment. Edits are text
 * splices computed against the linear CST's expression spans — applying them
 * in reverse-offset order is byte-minimal and preserves comments and layout,
 * the core value proposition over parse → re-stringify round trips.
 *
 * **Details**
 *
 * `TomlEdit`, `TomlRange`, `TomlPath` and `TomlSegment` are bound by the
 * cross-package parity convention: they are structurally identical to their
 * `Jsonc*`, `Yaml*` and `Markdown*` counterparts (same field names, types and
 * semantics) so consumer code can be written once over "a document codec's
 * Edit/Range/Path".
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TomlId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $TomlId.create("TomlEdit");

class TomlEditInvariantError extends S.TaggedError<TomlEditInvariantError, { readonly brand: unique symbol }>(
  $I`TomlEditInvariantError`
)(
  "TomlEditInvariantError",
  {
    message: S.String.pipe(
      $I.annoteKey("TomlEditInvariantError.message", {
        description: "Explanation of the missing or overlapping edit that violates the application invariant.",
      })
    ),
  },
  $I.annoteError<TomlEditInvariantError>("TomlEditInvariantError", {
    description: "A programmer defect encountered while applying TOML text edits.",
  })
) {}

/**
 * A single path segment: a `string` for table keys or a `number` for array
 * and array-of-tables indices.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlSegment = string | number;

/**
 * An ordered sequence of {@link TomlSegment} values describing a location
 * within a TOML document's semantic tree.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlPath = ReadonlyArray<TomlSegment>;

/**
 * **Example** (Select a formatting region)
 *
 * ```ts
 * import { TomlRange } from "@beep/toml/TomlEdit";
 *
 * const range = TomlRange.make({ offset: 4, length: 8 });
 * console.log(range.length) // 8
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlRange extends S.Opaque<TomlRange, { readonly brand: unique symbol }>()(
  S.Struct({
    offset: S.Finite.pipe(
      $I.annoteKey("TomlRange.offset", {
        description: "Zero-based starting position in UTF-16 code units for selecting expressions to format",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("TomlRange.length", { description: "Extent of the formatting region in UTF-16 code units" })
    ),
  }).pipe(
    $I.annoteSchema("TomlRange", {
      description:
        "A range within a TOML document, expressed as a zero-based character `offset` and a `length` in UTF-16 code units. Pass to `TomlFormat.format` to restrict formatting to the expressions intersecting a region.",
    })
  )
) {}

/**
 * **Details**
 *
 * Structurally identical to the edit shapes of `@beep/jsonc`,
 * `@beep/yaml` and `@beep/markdown` (same field names, types and
 * semantics), so consumer code can be written once over "a document codec's
 * Edit/Range/Path".
 *
 * **Example** (Insert text without replacing source)
 *
 * ```ts
 * import { TomlEdit } from "@beep/toml/TomlEdit";
 *
 * const edit = TomlEdit.make({ offset: 0, length: 0, content: "# note\n" });
 * console.log(TomlEdit.applyAll("count = 2", [edit]) === "# note\ncount = 2") // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlEdit extends S.Opaque<TomlEdit, { readonly brand: unique symbol }>()(
  S.Struct({
    offset: S.Finite.pipe(
      $I.annoteKey("TomlEdit.offset", {
        description: "Zero-based starting position of the text splice in UTF-16 code units",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("TomlEdit.length", {
        description: "Number of UTF-16 code units to replace, with zero inserting text without removing any",
      })
    ),
    content: S.String.pipe(
      $I.annoteKey("TomlEdit.content", {
        description: "Replacement text for the selected span, with an empty string deleting that span",
      })
    ),
  }).pipe(
    $I.annoteSchema("TomlEdit", {
      description:
        'A non-mutating text edit: replace the span `[offset, offset + length)` with `content`. Set `length` to `0` to insert, `content` to `""` to delete.',
    })
  )
) {
  /**
   * Apply `edits` to `text`, producing a new string. Edits are applied in
   * reverse-offset order so earlier offsets stay valid; the input `edits`
   * array is not mutated. Overlapping edits are a programmer error and throw
   * as a defect — `TomlFormat` never produces them.
   *
   * **Example** (Apply edits against their original offsets)
   *
   * ```ts
   * import { TomlEdit } from "@beep/toml/TomlEdit";
   *
   * const edits = [
   *   TomlEdit.make({ offset: 4, length: 1, content: "3" }),
   *   TomlEdit.make({ offset: 10, length: 1, content: "4" }),
   * ];
   * console.log(TomlEdit.applyAll("a = 1;b = 2", edits)) // a = 3;b = 4
   * ```
   *
   * @param text - The source text to edit.
   * @param edits - The edits to apply, in any order.
   * @returns The edited text.
   * @category utilities
   * @since 0.0.0
   */
  static readonly applyAll: {
    (text: string, edits: ReadonlyArray<TomlEdit>): string;
    (edits: ReadonlyArray<TomlEdit>): (text: string) => string;
  } = dual(2, (text: string, edits: ReadonlyArray<TomlEdit>): string => {
    const sorted = A.sort(
      edits,
      Order.mapInput(Order.flip(Order.Number), (edit: TomlEdit) => edit.offset)
    );
    for (const [upper, lower] of A.zip(sorted, A.drop(sorted, 1))) {
      if (lower.offset + lower.length > upper.offset) {
        throw TomlEditInvariantError.make({
          message: `TomlEdit.applyAll received overlapping edits at offsets ${lower.offset} and ${upper.offset} — overlapping edits are a programmer error`,
        });
      }
    }
    let result = text;
    for (const edit of sorted) {
      result = Str.slice(0, edit.offset)(result) + edit.content + Str.slice(edit.offset + edit.length)(result);
    }
    return result;
  });
}
