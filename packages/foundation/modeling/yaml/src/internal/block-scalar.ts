import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Str from "effect/String";

const isLineBreak = (char: string | undefined): boolean => char === "\n" || char === "\r";

const isIndentChar = (char: string | undefined): boolean => char === " " || char === "\t";

const lineStartOf = (text: string, pos: number): number => {
  let lineStart = pos;
  while (lineStart > 0 && !isLineBreak(text[lineStart - 1])) {
    lineStart--;
  }
  return lineStart;
};

const countSpaces = (text: string, start: number): number => {
  let spaces = 0;
  while (text[start + spaces] === " ") {
    spaces++;
  }
  return spaces;
};

const isCompactEntryAt = (text: string, at: number): boolean => text[at] === "-" && isIndentChar(text[at + 1]);

/**
 * The key indentation for a block-mapping `:` at `colonPos`: the leading
 * spaces of its line, or two past them when the line opens with a compact
 * sequence entry (`- key:`), whose key starts after the `- `.
 *
 * **Example** (Measure a compact-sequence key)
 *
 * ```ts
 * import { findKeyIndent } from "@beep/yaml/internal/block-scalar"
 *
 * console.log(findKeyIndent("  - key: |", 7)) // 4
 * console.log(findKeyIndent(3)("key: |")) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const findKeyIndent: {
  (text: string, colonPos: number): number;
  (colonPos: number): (text: string) => number;
} = dual(2, (text: string, colonPos: number): number => {
  const lineStart = lineStartOf(text, colonPos);
  const spaces = countSpaces(text, lineStart);
  return isCompactEntryAt(text, lineStart + spaces) ? spaces + 2 : spaces;
});

const separatorBeforeLaterContentLine = (result: string, touchesMoreIndented: boolean): string => {
  if (touchesMoreIndented) {
    return "\n";
  }
  const joinsDirectlyAfterPreservedEmptyLine = Str.endsWith("\n")(result);
  return joinsDirectlyAfterPreservedEmptyLine ? "" : " ";
};

/**
 * Join a folded block scalar's content lines (YAML 1.2 §8.1.3), before
 * chomping: adjacent base-indent lines fold to a space, empty lines are
 * preserved as newlines, and a transition to or from a more-indented line
 * keeps its line break.
 *
 * **Example** (Fold base lines and keep more-indented breaks)
 *
 * ```ts
 * import { foldBlockLines } from "@beep/yaml/internal/block-scalar"
 *
 * console.log(JSON.stringify(foldBlockLines(["a", "b", "", "  c"]))) // "a b\n\n  c"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const foldBlockLines = (lines: ReadonlyArray<string>): string => {
  let result = "";
  let lastContentLineMoreIndented = false;
  let hadContent = false;
  for (const ln of lines) {
    if (ln === "") {
      result += "\n";
      continue;
    }
    const isMoreIndented = isIndentChar(ln[0]);
    result += hadContent
      ? `${separatorBeforeLaterContentLine(result, isMoreIndented || lastContentLineMoreIndented)}${ln}`
      : ln;
    lastContentLineMoreIndented = isMoreIndented;
    hadContent = true;
  }
  return result;
};

/**
 * True when a block scalar's content lines hold any non-empty line — the
 * condition under which the last content line contributes a terminating
 * break before chomping.
 *
 * **Example** (Distinguish an all-empty body)
 *
 * ```ts
 * import { hasBlockContent } from "@beep/yaml/internal/block-scalar"
 *
 * console.log(hasBlockContent(["", ""]), hasBlockContent(["", "a"])) // false true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasBlockContent = (lines: ReadonlyArray<string>): boolean => A.some(lines, (ln) => ln !== "");
