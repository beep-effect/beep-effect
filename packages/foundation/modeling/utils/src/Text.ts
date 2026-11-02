/**
 * Text formatting helpers for command and document output.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual, flow, pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as Str from "effect/String";

const descriptionFromOptions = (options: { readonly description: string }): string =>
  P.isString(options) ? options : options.description;

/**
 * Splits comma-separated text, trims each entry, and drops empty values.
 *
 * **Example** (Trim and drop empties)
 *
 * ```ts import.meta.vitest name="Trim and drop empties"
 * import * as Text from "@beep/utils/Text"
 *
 * const tags = Text.splitCommaSeparatedTrimmed(" foo , bar , , baz ")
 * // ["foo", "bar", "baz"]
 *
 * console.log(tags)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const splitCommaSeparatedTrimmed = flow(Str.split(","), A.map(Str.trim), A.filter(Str.isNonEmpty));

/**
 * Renders a named list row with optional aliases.
 *
 * **Details**
 *
 * Produces `"name (alias1, alias2): description"` when aliases are present,
 * or `"name: description"` when there are none.
 *
 * **Example** (Format name with aliases)
 *
 * ```ts import.meta.vitest name="Format name with aliases"
 * import * as Text from "@beep/utils/Text"
 *
 * const row = Text.formatNameWithAliases("ls", ["list", "dir"], { description: "List files" })
 * // "ls (list, dir): List files"
 *
 * const noAlias = Text.formatNameWithAliases("rm", [], { description: "Remove files" })
 * // "rm: Remove files"
 *
 * console.log(row)
 * console.log(noAlias)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const formatNameWithAliases: {
  (aliases: ReadonlyArray<string>, options: { readonly description: string }): (name: string) => string;
  (name: string, aliases: ReadonlyArray<string>, options: { readonly description: string }): string;
} = dual(3, (name: string, aliases: ReadonlyArray<string>, options: { readonly description: string }): string => {
  const description = descriptionFromOptions(options);

  return pipe(
    aliases,
    A.match({
      onEmpty: () => `${name}: ${description}`,
      onNonEmpty: (nonEmptyAliases) => `${name} (${A.join(nonEmptyAliases, ", ")}): ${description}`,
    })
  );
});

/**
 * Joins text lines with a newline separator.
 *
 * **Example** (Join lines with newline)
 *
 * ```ts import.meta.vitest name="Join lines with newline"
 * import * as Text from "@beep/utils/Text"
 *
 * const block = Text.joinLines(["hello", "world"])
 * // "hello\nworld"
 *
 * console.log(block)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const joinLines = (lines: ReadonlyArray<string>): string => A.join(lines, "\n");

/**
 * Newline grammar of {@link lineCharacterAt}.
 *
 * **Details**
 *
 * `\n`, `\r` and `\r\n` always break a line, and a CRLF pair counts as one
 * break. `unicodeSeparators` also breaks on U+2028 and U+2029.
 * `crlfLookahead` decides where the `\r\n` pair check may read: `"text"`
 * reads the whole text, so an offset that points at the `\n` of a pair is
 * measured from the following line start; `"prefix"` stays inside the scanned
 * prefix.
 */
type LineBreakGrammar = {
  readonly unicodeSeparators?: boolean;
  readonly crlfLookahead?: "text" | "prefix";
};

const CARRIAGE_RETURN = "\r";
const LINE_FEED = "\n";
const LINE_SEPARATOR = "\u2028";
const PARAGRAPH_SEPARATOR = "\u2029";

const lineBreakWidth = (text: string, index: number, pairEnd: number, unicodeSeparators: boolean): number => {
  const char = text[index];
  if (char === CARRIAGE_RETURN) {
    return index + 1 < pairEnd && text[index + 1] === LINE_FEED ? 2 : 1;
  }
  return char === LINE_FEED || (unicodeSeparators && (char === LINE_SEPARATOR || char === PARAGRAPH_SEPARATOR)) ? 1 : 0;
};

/**
 * Converts a code-unit offset into a zero-based line and character position.
 *
 * **Details**
 *
 * Scans `text` up to `min(offset, text.length)` and counts one line per
 * break; `character` is `offset` minus the start of the last line. `\n`, `\r`
 * and `\r\n` always break a line (a CRLF pair is one break). With
 * `unicodeSeparators: true`, U+2028 and U+2029 break too. `crlfLookahead`
 * (default `"text"`) lets the pair check read past the prefix; `"prefix"`
 * keeps it inside, so an offset between `\r` and `\n` lands at character 0
 * of the next line instead of -1.
 *
 * **Example** (Locate offsets under two newline grammars)
 *
 * ```ts import.meta.vitest name="Locate offsets under two newline grammars"
 * import { lineCharacterAt } from "@beep/utils/Text"
 *
 * lineCharacterAt("ab\r\ncd", 5) // => { line: 1, character: 1 }
 * lineCharacterAt(3, { crlfLookahead: "prefix" })("ab\r\ncd") // => { line: 1, character: 0 }
 * lineCharacterAt("a\u2028b", 2, { unicodeSeparators: true }) // => { line: 1, character: 0 }
 * ```
 *
 * @param text - The source text the offset indexes into.
 * @param offset - The code-unit offset to locate.
 * @param grammar - Which extra separators count and where the CRLF check may read.
 * @returns The zero-based `line` and `character` of `offset`.
 * @category utilities
 * @since 0.0.0
 */
export const lineCharacterAt: {
  (offset: number, grammar?: LineBreakGrammar): (text: string) => { readonly line: number; readonly character: number };
  (text: string, offset: number, grammar?: LineBreakGrammar): { readonly line: number; readonly character: number };
} = dual(
  (args) => P.isString(args[0]),
  (text: string, offset: number, grammar?: LineBreakGrammar): { readonly line: number; readonly character: number } => {
    const limit = Math.min(offset, text.length);
    const pairEnd = grammar?.crlfLookahead === "prefix" ? limit : text.length;
    const unicodeSeparators = grammar?.unicodeSeparators === true;
    let line = 0;
    let lineStart = 0;
    let index = 0;
    while (index < limit) {
      const width = lineBreakWidth(text, index, pairEnd, unicodeSeparators);
      index += Math.max(width, 1);
      if (width > 0) {
        line++;
        lineStart = index;
      }
    }
    return { line, character: offset - lineStart };
  }
);

/**
 * Indexes one source for repeated code-unit offset lookups.
 *
 * **Details**
 *
 * Preserves {@link lineCharacterAt} positions, including fractional offsets,
 * offsets outside the text and either CRLF lookahead rule. Construction scans
 * the text once; each lookup searches the recorded line breaks in logarithmic
 * time. The returned function owns its index and does not rescan the source.
 *
 * **Example** (Locate several diagnostics in one source)
 *
 * ```ts import.meta.vitest name="Locate several diagnostics in one source"
 * import { lineCharacterIndex } from "@beep/utils/Text"
 *
 * const position = lineCharacterIndex("ab\r\ncd", { crlfLookahead: "prefix" })
 * position(3) // => { line: 1, character: 0 }
 * position(5) // => { line: 1, character: 1 }
 * ```
 *
 * @param text - The source shared by the offset lookups.
 * @param grammar - The newline and CRLF lookahead rules to preserve.
 * @returns An independent lookup using the same positions as `lineCharacterAt`.
 * @category utilities
 * @since 0.0.0
 */
export const lineCharacterIndex: {
  (text: string, grammar?: LineBreakGrammar): (offset: number) => { readonly line: number; readonly character: number };
  (
    grammar?: LineBreakGrammar
  ): (text: string) => (offset: number) => { readonly line: number; readonly character: number };
} = dual(
  (args) => P.isString(args[0]),
  (text: string, grammar?: LineBreakGrammar) => {
    const breaks: Array<number> = [];
    const starts: Array<number> = [0];
    const lineBreak = grammar?.unicodeSeparators === true ? /\r\n|[\n\r\u2028\u2029]/g : /\r\n|[\n\r]/g;
    const prefixLookahead = grammar?.crlfLookahead === "prefix";
    const textLength = text.length;
    for (let match = lineBreak.exec(text); match !== null; match = lineBreak.exec(text)) {
      breaks.push(match.index + 1);
      starts.push(match.index + match[0].length);
    }
    return (offset: number) => {
      const limit = Math.min(offset, textLength);
      let low = 0;
      let high = breaks.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (A.getUnsafe(breaks, middle) <= Math.ceil(limit)) low = middle + 1;
        else high = middle;
      }
      const start = A.getUnsafe(starts, low);
      const lineStart =
        prefixLookahead && low > 0 && breaks[low - 1] === start - 1 && limit <= start - 1 ? start - 1 : start;
      return { line: low, character: offset - lineStart };
    };
  }
);
