/**
 * The non-mutating text-edit vocabulary shared by the formatter and the
 * modifier: MarkdownEdit, MarkdownRange, MarkdownPath and MarkdownSegment.
 *
 * **Details**
 *
 * Edits describe replacements as `offset`/`length`/`content`; applying them in
 * reverse-offset order is byte-minimal and preserves everything outside the
 * spliced spans — the offset-splice editing model chosen over a
 * lossless CST (nobody in the ecosystem ships one; positional splicing is the
 * remark maintainers' own recommendation).
 *
 * `MarkdownEdit`, `MarkdownRange`, `MarkdownPath` and `MarkdownSegment` are
 * bound by the jsonc/yaml/toml parity convention: they are structurally
 * identical to their `Jsonc*`, `Yaml*` and `Toml*` counterparts (same field
 * names, types and semantics) so consumer code can be written once over "a
 * document codec's Edit/Range/Path". All four packages share the `applyAll`
 * overlap check: rejecting overlapping edits as a thrown defect. The formatter
 * and modifier never produce overlapping edits, so the check only ever fires on
 * a hand-constructed edit array, which is a programmer error worth surfacing.
 * The `format` range-filter posture still diverges: this module and toml use
 * owning-node/expression intersection, yaml requires edits fully within range.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $MarkdownId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $MarkdownId.create("MarkdownEdit");

const byOffsetDescending = Order.mapInput(Order.flip(Order.Number), (edit: { readonly offset: number }) => edit.offset);

class OverlappingMarkdownEditsError extends S.TaggedError<
  OverlappingMarkdownEditsError,
  { readonly brand: unique symbol }
>($I`OverlappingMarkdownEditsError`)(
  "OverlappingMarkdownEditsError",
  {
    message: S.String.pipe(
      $I.annoteKey("OverlappingMarkdownEditsError.message", {
        description: "Explanation identifying the overlapping edit offsets and the programmer-error contract",
      })
    ),
  },
  $I.annoteError<OverlappingMarkdownEditsError>("OverlappingMarkdownEditsError", {
    description: "Rejects intersecting source edits before MarkdownEdit.applyAll can splice ambiguous replacements.",
  })
) {}

/**
 * A single path segment: a `number` for child indices in the node tree, or a
 * `string` for named addressing (reserved, e.g. for definition identifiers).
 *
 * **Example** (Validate path segments)
 *
 * ```ts
 * import { MarkdownSegment } from "@beep/markdown/MarkdownEdit";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(MarkdownSegment)(0)) // true
 * console.log(S.is(MarkdownSegment)("guide")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MarkdownSegment = S.Union([S.String, S.Finite]).pipe(
  $I.annoteSchema("MarkdownSegment", {
    description:
      "A single path segment: a number for a child index in the node tree, or a string for named addressing.",
  })
);

/**
 * The union of the two segment spellings.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownSegment = typeof MarkdownSegment.Type;

/**
 * **Example** (Validate a child-index path)
 *
 * ```ts
 * import { MarkdownPath } from "@beep/markdown/MarkdownEdit";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(MarkdownPath)([0, 2])) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MarkdownPath = S.Array(MarkdownSegment).pipe(
  $I.annoteSchema("MarkdownPath", {
    description: "An ordered sequence of path segments describing a location within a markdown document tree.",
  })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownPath = typeof MarkdownPath.Type;

/**
 * **Example** (Select a source region)
 *
 * ```ts
 * import { MarkdownRange } from "@beep/markdown/MarkdownEdit";
 *
 * const range = MarkdownRange.make({ offset: 3, length: 5 });
 * console.log(range.offset + range.length) // 8
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MarkdownRange extends S.Opaque<MarkdownRange, { readonly brand: unique symbol }>()(
  S.Struct({
    offset: S.Finite.pipe(
      $I.annoteKey("MarkdownRange.offset", {
        description: "Zero-based start of the formatting region in the source string, measured in UTF-16 code units",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("MarkdownRange.length", {
        description: "Extent of the formatting region in UTF-16 code units, used to select intersecting nodes",
      })
    ),
  }).pipe(
    $I.annoteSchema("MarkdownRange", {
      description:
        "A range within a markdown document, expressed as a zero-based character `offset` and a `length` in UTF-16 code units. Pass to `MarkdownFormat.format` to restrict formatting to a region.",
    })
  )
) {}

/**
 * **Details**
 *
 * Structurally identical to `@beep/jsonc`'s, `@beep/yaml`'s and
 * `@beep/toml`'s edit shapes (same field names, types and semantics) per
 * the cross-package parity convention, so consumer code can be written once
 * over "a document codec's Edit/Range/Path".
 *
 * **Example** (Insert and delete source text)
 *
 * ```ts
 * import { MarkdownEdit } from "@beep/markdown/MarkdownEdit";
 *
 * const insertion = MarkdownEdit.make({ offset: 5, length: 0, content: " world" });
 * const deletion = MarkdownEdit.make({ offset: 0, length: 1, content: "" });
 * console.log(MarkdownEdit.applyAll("Hello", [insertion, deletion])) // ello world
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MarkdownEdit extends S.Opaque<MarkdownEdit, { readonly brand: unique symbol }>()(
  S.Struct({
    offset: S.Finite.pipe(
      $I.annoteKey("MarkdownEdit.offset", {
        description: "Zero-based start of the span to replace in the original source, measured in UTF-16 code units",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("MarkdownEdit.length", {
        description: "Number of UTF-16 code units to replace in the original source; `0` inserts without removing text",
      })
    ),
    content: S.String.pipe(
      $I.annoteKey("MarkdownEdit.content", {
        description: "Replacement text for the source span; an empty string deletes the span",
      })
    ),
  }).pipe(
    $I.annoteSchema("MarkdownEdit", {
      description:
        'A non-mutating text edit: replace the span `[offset, offset + length)` with `content`. Set `length` to `0` to insert, `content` to `""` to delete.',
    })
  )
) {
  /**
   * Apply `edits` to `text`, producing a new string. Edits are applied in
   * reverse-offset order so earlier offsets stay valid; the input `edits`
   * array is not mutated.
   *
   * **Gotchas**
   *
   * Overlapping edits are a programmer error and throw
   * as a defect — `MarkdownFormat` never produces them.
   *
   * **Example** (Apply edits in arbitrary offset order)
   *
   * ```ts
   * import { MarkdownEdit } from "@beep/markdown/MarkdownEdit";
   *
   * const edits = [
   *   MarkdownEdit.make({ offset: 0, length: 1, content: "h" }),
   *   MarkdownEdit.make({ offset: 5, length: 0, content: " world" }),
   * ];
   * console.log(MarkdownEdit.applyAll("Hello", edits)) // hello world
   * ```
   *
   * @param text - The source text to edit.
   * @param edits - The edits to apply, in arbitrary order.
   * @returns The edited text.
   * @category utilities
   * @since 0.0.0
   */
  static readonly applyAll: {
    (text: string, edits: ReadonlyArray<MarkdownEdit>): string;
    (edits: ReadonlyArray<MarkdownEdit>): (text: string) => string;
  } = dual(
    2,
    (text: string, edits: ReadonlyArray<MarkdownEdit>): string =>
      A.reduce(
        A.sort(edits, byOffsetDescending),
        { result: text, previousEditStart: Number.POSITIVE_INFINITY },
        ({ result, previousEditStart }, edit) => {
          if (edit.offset + edit.length > previousEditStart) {
            throw OverlappingMarkdownEditsError.make({
              message: `MarkdownEdit.applyAll received overlapping edits at offsets ${edit.offset} and ${previousEditStart} — overlapping edits are a programmer error`,
            });
          }
          return {
            result: `${Str.slice(0, edit.offset)(result)}${edit.content}${Str.slice(edit.offset + edit.length)(result)}`,
            previousEditStart: edit.offset,
          };
        }
      ).result
  );
}
