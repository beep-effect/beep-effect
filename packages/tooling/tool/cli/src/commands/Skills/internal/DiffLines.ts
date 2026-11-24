/**
 * The line model shared by the patch renderer and the strict patch applier.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("commands/Skills/internal/DiffLines");

/**
 * **Details**
 *
 * Only the last line of a file can lack its newline. Comparing the flag as
 * well as the text is what lets a patch carry Git's end-of-file newline marker.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class DiffLine extends S.Opaque<DiffLine, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String,
    eol: S.Boolean,
  }).pipe($I.annoteSchema("DiffLine", { description: "One text line and whether a newline ends it." }))
) {}

/**
 * Splits text into lines; the last line has `eol: false` when the text does not end in a newline.
 *
 * **Details**
 *
 * Preserves each line's terminating-newline state in the returned values.
 *
 * @internal
 * @param content - Text whose line endings should be preserved.
 * @returns Lines carrying their text and terminating-newline state.
 * @category parsing
 * @since 0.0.0
 */
export const diffLines = (content: string): ReadonlyArray<DiffLine> => {
  if (Str.isEmpty(content)) {
    return A.empty<DiffLine>();
  }
  const terminated = Str.endsWith("\n")(content);
  const parts = Str.split(content, "\n");
  const lines = terminated ? A.dropRight(parts, 1) : parts;
  const lastIndex = A.length(lines) - 1;
  return A.map(lines, (text, index) => DiffLine.make({ text, eol: terminated || index < lastIndex }));
};

/**
 * Joins lines back into text, the inverse of {@link diffLines}.
 *
 * **Details**
 *
 * Appends a newline only for lines whose `eol` value is `true`.
 *
 * @internal
 * @param lines - Lines carrying their text and terminating-newline state.
 * @returns Text reconstructed with the recorded line endings.
 * @category formatting
 * @since 0.0.0
 */
export const joinDiffLines = (lines: ReadonlyArray<DiffLine>): string =>
  A.join(
    A.map(lines, (line) => (line.eol ? `${line.text}\n` : line.text)),
    ""
  );

/**
 * Two lines are the same when their text and their newline state agree.
 *
 * @internal
 * @param left - First line to compare.
 * @param right - Second line to compare.
 * @returns Whether the lines have equal text and newline state.
 * @category predicates
 * @since 0.0.0
 */
export const sameDiffLine: {
  (right: DiffLine): (left: DiffLine) => boolean;
  (left: DiffLine, right: DiffLine): boolean;
} = dual(
  2,
  (left: DiffLine, right: DiffLine): boolean => Str.Equivalence(left.text, right.text) && left.eol === right.eol
);
