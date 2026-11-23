// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// Port notes: upstream splits the input with `input.split(/\r\n|\n|\r/)` and
// throws the line offsets away — it only ever needs line NUMBERS for its
// sourcepos. This package's edit layer is offset-based, so the split is
// rewritten as a manual scan that keeps each line's absolute start offset.
// Everything else (the NUL replacement, the trailing-newline rule, the
// tab-stop arithmetic) is upstream's behavior verbatim.
//
// Leaf module: imports no public markdown modules.

import { $MarkdownId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { identity } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $MarkdownId.create("internal/preprocess");

/**
 * Columns of indentation that open an indented code block.
 *
 * **Example** (Read the code indentation threshold)
 *
 * ```ts
 * import { CODE_INDENT } from "@beep/markdown/internal/preprocess";
 *
 * console.log(CODE_INDENT) // 4
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CODE_INDENT = 4;

/**
 * The tab stop width CommonMark fixes for indentation arithmetic.
 *
 * **Example** (Read the CommonMark tab width)
 *
 * ```ts
 * import { TAB_STOP } from "@beep/markdown/internal/preprocess";
 *
 * console.log(TAB_STOP) // 4
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TAB_STOP = 4;

/**
 * One source line: its text with the line terminator stripped, and the
 * absolute offset of its first character in the original source.
 *
 * **Details**
 *
 * `text` is NUL-replaced (see {@link preprocessLines}), which is a 1:1
 * character substitution — every index into `text` is still a valid
 * `start + index` offset into the original source.
 *
 * **Example** (Validate SourceLine data)
 *
 * ```ts
 * import { SourceLine } from "@beep/markdown/internal/preprocess";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(SourceLine)({ text: "heading", start: 0 })); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceLine extends S.Opaque<SourceLine, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.pipe(
      $I.annoteKey("SourceLine.text", { description: "Line text without its terminator, with NUL replaced by U+FFFD." })
    ),
    start: S.Finite.pipe(
      $I.annoteKey("SourceLine.start", {
        description: "Absolute UTF-16 offset of the line's first character in the original source.",
      })
    ),
  }).pipe(
    $I.annoteSchema("SourceLine", {
      description:
        "A preprocessed source line retaining its original offset after length-preserving NUL normalization.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SourceLine {
  /**
   * The plain line record the preprocessor emits: a constructed {@link SourceLine} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SourceLine.Encoded;
}

/** Every line terminator: `\r\n` is tried first, so it is one terminator, not two. */
const reLineTerminator = /\r\n|\n|\r/g;

const hasCarriageReturn = Str.includes("\r");
const endsWithNewline = Str.endsWith("\n");
const splitOnNewline = Str.split("\n");

/**
 * Split a text holding no `\r`: one native split on `\n`, offsets accumulated
 * from the line lengths. The common case, and as fast as a character scan.
 */
const splitNewlineOnly = (text: string, normalize: (line: string) => string): Array<SourceLine.Encoded> => {
  const parts = splitOnNewline(text);
  const lines: Array<SourceLine.Encoded> = [];
  const last = parts.length - 1;
  let start = 0;
  for (let index = 0; index < last; index += 1) {
    const line = A.getUnsafe(parts, index);
    lines.push({ text: normalize(line), start });
    start += line.length + 1;
  }
  // The remainder after the last `\n`: a final line without a terminator, or
  // the empty string upstream drops (`input.charCodeAt(len - 1) === 10`) —
  // unless it is the whole of an empty text, which is one empty line.
  const tail = A.getUnsafe(parts, last);
  if (tail.length > 0 || last === 0) {
    lines.push({ text: normalize(tail), start });
  }
  return lines;
};

/**
 * Split a text holding `\r`: a walk over every terminator spelling. A bare
 * `\r` at the very end keeps a final blank line, which is upstream's rule too
 * (it drops the remainder only after a `\n`).
 */
const splitAnyTerminator = (text: string, normalize: (line: string) => string): Array<SourceLine.Encoded> => {
  const lines: Array<SourceLine.Encoded> = [];
  let start = 0;
  // The shared global regex is reset on entry, and `exec` always runs it to
  // exhaustion, which leaves `lastIndex` at 0 for the next caller.
  reLineTerminator.lastIndex = 0;
  for (let match = reLineTerminator.exec(text); match !== null; match = reLineTerminator.exec(text)) {
    lines.push({ text: normalize(Str.slice(start, match.index)(text)), start });
    start = reLineTerminator.lastIndex;
  }
  if (start < text.length || !endsWithNewline(text)) {
    lines.push({ text: normalize(Str.slice(start)(text)), start });
  }
  return lines;
};

/**
 * Split `text` into lines, preserving each line's absolute start offset.
 *
 * **Details**
 *
 * `\r\n`, `\n` and `\r` all terminate a line. U+0000 is replaced with U+FFFD
 * per the spec's security note; the replacement is length-preserving so
 * offsets stay aligned with the original source.
 *
 * A single trailing `\n` does not produce a final empty line (upstream's
 * rule — the document `"foo\n"` is one line, not two). A trailing bare `\r`
 * does, which is also upstream's behavior: the extra blank line is inert.
 *
 * **Example** (Keep offsets across newline and NUL normalization)
 *
 * ```ts
 * import { preprocessLines } from "@beep/markdown/internal/preprocess";
 *
 * console.log(JSON.stringify(preprocessLines("a\u0000\r\nb\n"))) // [{"text":"a�","start":0},{"text":"b","start":4}]
 * console.log(preprocessLines("foo\r").length) // 2
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const preprocessLines = (text: string): ReadonlyArray<SourceLine.Encoded> => {
  // Lines are plain encoded records, not `SourceLine.make`: the table is
  // engine input built once per parse, and its consumers only read the two
  // fields. A text with no U+0000 anywhere skips the per-line check.
  const normalize = hasNul(text) ? replaceNul : identity;
  return hasCarriageReturn(text) ? splitAnyTerminator(text, normalize) : splitNewlineOnly(text, normalize);
};

const hasNul = Str.includes("\u0000");
const swapNul = Str.replaceAll("\u0000", "\uFFFD");

/**
 * The spec's security substitution: U+0000 becomes U+FFFD, 1:1 by length.
 *
 * **Example** (Replace a NUL without shifting offsets)
 *
 * ```ts
 * import { replaceNul } from "@beep/markdown/internal/preprocess";
 *
 * console.log(replaceNul("a\u0000b")) // a�b
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const replaceNul = (line: string): string => (hasNul(line) ? swapNul(line) : line);

const reNonSpace = /[^ \t\f\v\r\n]/;

/**
 * True when `line` holds nothing but whitespace.
 *
 * **Example** (Recognize blank and nonblank lines)
 *
 * ```ts
 * import { isBlankLine } from "@beep/markdown/internal/preprocess";
 *
 * console.log(isBlankLine(" \t\f\v\r\n")) // true
 * console.log(isBlankLine("text")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isBlankLine = (line: string): boolean => !reNonSpace.test(line);

/**
 * True for the two characters CommonMark treats as horizontal whitespace.
 *
 * **Example** (Distinguish horizontal whitespace from a newline)
 *
 * ```ts
 * import { isSpaceOrTab } from "@beep/markdown/internal/preprocess";
 *
 * console.log(isSpaceOrTab(" "), isSpaceOrTab("\t"), isSpaceOrTab("\n")) // true true false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isSpaceOrTab = (char: string): boolean => char === " " || char === "\t";

/**
 * Columns from `column` to the next tab stop — the width a `\t` expands to.
 *
 * **Details**
 *
 * `column` is the tab-expanded column the block pass tracks, not a character
 * index: a tab at column 2 is two columns wide, at column 4 it is four.
 *
 * **Example** (Expand tabs at partial and full tab stops)
 *
 * ```ts
 * import { columnsToNextTabStop } from "@beep/markdown/internal/preprocess";
 *
 * console.log(columnsToNextTabStop(2), columnsToNextTabStop(4)) // 2 4
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const columnsToNextTabStop = (column: number): number => TAB_STOP - (column % TAB_STOP);

/**
 * Whether the sticky `pattern` matches `subject` at `index`.
 *
 * **Details**
 *
 * The block starts test the rest of the line from the scan position on every
 * line they see. Matching a sticky (`y`) pattern at the position tests the
 * same thing without copying the remainder out of the line first. The
 * pattern's `lastIndex` is set on every call, so one module-level pattern
 * serves every caller.
 Both call forms are kept, but the form is chosen by the first argument's
 * type rather than by `dual`, because it runs per line per block start (see
 * `unitAt` in `patterns.ts`).
 *
 * **Gotchas**
 *
 * The pattern must carry the `y` flag and no leading `^`: a caret anchors to
 * the start of the whole subject, not to `index`.
 *
 * **Example** (Test a marker at the scan position)
 *
 * ```ts
 * import { matchesAt } from "@beep/markdown/internal/preprocess";
 *
 * const marker = /[*+-]/y;
 * console.log(matchesAt(marker, "  - item", 2), matchesAt(marker, "  - item", 0)) // true false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export function matchesAt(pattern: RegExp, subject: string, index: number): boolean;
export function matchesAt(subject: string, index: number): (pattern: RegExp) => boolean;
export function matchesAt(
  patternOrSubject: RegExp | string,
  subjectOrIndex: string | number,
  index?: number
): boolean | ((pattern: RegExp) => boolean) {
  return P.isString(patternOrSubject)
    ? (pattern: RegExp): boolean => testAt(pattern, patternOrSubject, Number(subjectOrIndex))
    : testAt(patternOrSubject, String(subjectOrIndex), Number(index));
}

const testAt = (pattern: RegExp, subject: string, index: number): boolean => {
  pattern.lastIndex = index;
  return pattern.test(subject);
};
