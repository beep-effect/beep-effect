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
 * One text line and whether a newline ends it.
 *
 * **Details**
 *
 * Only the last line of a file can lack its newline. Comparing the flag as
 * well as the text is what lets a patch carry Git's `\ No newline at end of
 * file` marker.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class DiffLine extends S.Class<DiffLine>($I`DiffLine`)(
  {
    text: S.String,
    eol: S.Boolean,
  },
  $I.annote("DiffLine", { description: "One text line and whether a newline ends it." })
) {}

/**
 * Splits text into lines; the last line has `eol: false` when the text does not end in a newline.
 *
 * @internal
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
 * @internal
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
