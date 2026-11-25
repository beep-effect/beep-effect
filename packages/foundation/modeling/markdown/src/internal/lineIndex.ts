// An offset -> unist Point (1-based line/column) index. Built once per parse
// from the source text, iteratively (a single forward scan, no recursion),
// then queried by binary search — MarkdownNode.ts's Point construction is the
// consumer. Imports no public markdown modules, keeping the cycle firewall.

import { $MarkdownId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $MarkdownId.create("internal/lineIndex");

/**
 * A malformed line table supplied to the source-position index.
 *
 * **Example** (Describe a malformed line table)
 *
 * ```ts
 * import { InvalidLineTableError } from "@beep/markdown/internal/lineIndex"
 *
 * const error = InvalidLineTableError.make({ message: "Missing initial offset zero" })
 * console.log(error.message) // Missing initial offset zero
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class InvalidLineTableError extends S.TaggedError<InvalidLineTableError, { readonly brand: unique symbol }>(
  $I`InvalidLineTableError`
)(
  "InvalidLineTableError",
  {
    message: S.String.pipe(
      $I.annoteKey("InvalidLineTableError.message", {
        description: "Explains why the supplied line-start table cannot initialize the source-position index.",
      })
    ),
  },
  $I.annoteError<InvalidLineTableError>("InvalidLineTableError", {
    description: "Signals that a supplied line-start table is empty or does not begin at source offset zero.",
  })
) {}

/**
 * A 1-based line/column pair, unist's `Point` shape minus the `offset` field.
 *
 * **Example** (Validate LineColumn data)
 *
 * ```ts
 * import { LineColumn } from "@beep/markdown/internal/lineIndex";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(LineColumn)({ line: 1, column: 1 })); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LineColumn extends S.Opaque<LineColumn, { readonly brand: unique symbol }>()(
  S.Struct({
    line: S.Finite.pipe(
      $I.annoteKey("LineColumn.line", { description: "One-based source line containing the queried offset." })
    ),
    column: S.Finite.pipe(
      $I.annoteKey("LineColumn.column", { description: "One-based UTF-16 column within the source line." })
    ),
  }).pipe(
    $I.annoteSchema("LineColumn", {
      description: "A source position returned by the line index without an absolute offset field.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LineColumn {
  /**
   * The plain line/column pair the index returns: a constructed {@link LineColumn} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof LineColumn.Encoded;
}

/**
 * A precomputed index of line-start offsets over a fixed source text,
 * answering `positionAt(offset)` in `O(log n)` via binary search rather than
 * rescanning the text per query.
 *
 * **Details**
 *
 * Only `\n` begins a new line. A `\r` immediately before a `\n` (CRLF) is
 * left as the trailing character of the prior line — the pair still reads as
 * a single boundary because the following `\n` is what advances the line
 * counter, not the `\r`. A bare `\r` (old Mac line endings) is not
 * recognized as a break; CommonMark's preprocessing pass normalizes those
 * before this index is ever built.
 *
 * **Example** (Locate the second line)
 *
 * ```ts
 * import { LineIndex } from "@beep/markdown/internal/lineIndex"
 *
 * const point = LineIndex.make("one\ntwo").positionAt(4)
 * console.log(point.line, point.column) // 2 1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class LineIndex {
  private readonly text: string;
  private readonly lineStarts: ReadonlyArray<number>;
  private constructor(text: string, lineStarts: ReadonlyArray<number>) {
    this.text = text;
    this.lineStarts = lineStarts;
  }

  /**
   * Build a {@link LineIndex} over `text` with one forward scan.
   *
   * **Details**
   *
   * Recognizes only `\n`, which is why the block pass hands over its own
   * line table instead — see {@link LineIndex.fromLineStarts}.
   *
   * **Example** (Index a newline with a forward scan)
   *
   * ```ts
   * import { LineIndex } from "@beep/markdown/internal/lineIndex"
   *
   * const point = LineIndex.make("a\nb").positionAt(2)
   * console.log(point.line, point.column) // 2 1
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static make(text: string): LineIndex {
    const lineStarts: number[] = [0];
    // One regex walk over the newlines rather than a per-character scan; a
    // fresh global regex per call keeps `lastIndex` private to this build.
    const newline = /\n/g;
    for (let match = newline.exec(text); match !== null; match = newline.exec(text)) {
      lineStarts.push(match.index + 1);
    }
    return new LineIndex(text, lineStarts);
  }

  /**
   * Build a {@link LineIndex} over `text` from a line table someone else
   * already computed.
   *
   * **Gotchas**
   *
   * The parser splits lines on `\r\n`, `\n` AND a bare `\r`; this index's
   * own scan recognizes only `\n`. For any document without a bare `\r` the
   * two agree, but for one with them they disagree about what a line is, and
   * every reported line number would be wrong. Handing the parser's own
   * table over removes the possibility rather than documenting it: there is
   * one definition of a line, and it belongs to the preprocessor.
   *
   * `starts` must be ascending and begin at 0; a table that is neither is a
   * wiring bug and dies as a defect.
   * The constructor checks that the table is non-empty and begins at zero;
   * the caller is responsible for ensuring ascending order.
   *
   * **Example** (Reuse the parser's bare carriage-return boundary)
   *
   * ```ts
   * import { LineIndex } from "@beep/markdown/internal/lineIndex"
   *
   * const point = LineIndex.fromLineStarts("a\rb", [0, 2]).positionAt(2)
   * console.log(point.line, point.column) // 2 1
   * ```
   *
   * @throws InvalidLineTableError when the table is empty or its first offset is not zero.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromLineStarts: {
    (text: string, starts: ReadonlyArray<number>): LineIndex;
    (starts: ReadonlyArray<number>): (text: string) => LineIndex;
  } = dual(2, (text: string, starts: ReadonlyArray<number>): LineIndex => {
    if (starts.length === 0 || starts[0] !== 0) {
      throw InvalidLineTableError.make({ message: "line index: a line table must be non-empty and start at offset 0" });
    }
    return new LineIndex(text, starts);
  });

  /**
   * The 1-based `{ line, column }` of `offset` within this index's text.
   *
   * **Details**
   *
   * Out-of-range offsets clamp to the nearest valid position (`0` or
   * `text.length`) rather than throwing.
   *
   * **Example** (Clamp offsets to the source boundaries)
   *
   * ```ts
   * import { LineIndex } from "@beep/markdown/internal/lineIndex"
   *
   * const index = LineIndex.make("abc")
   * console.log(index.positionAt(-1).column) // 1
   * console.log(index.positionAt(99).column) // 4
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  positionAt(offset: number): LineColumn.Encoded {
    const clamped = Math.min(Math.max(offset, 0), this.text.length);

    let low = 0;
    let high = this.lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (A.getUnsafe(this.lineStarts, mid) <= clamped) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    // Both constructors provide a non-empty table; the search keeps low in bounds.
    const lineStart = A.getUnsafe(this.lineStarts, low);
    // Plain encoded data, not `LineColumn.make`: this runs twice per node, and
    // the parser admits its tree once at the facade (D-39).
    return { line: low + 1, column: clamped - lineStart + 1 };
  }
}
