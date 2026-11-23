/**
 * Pure JSONC formatting: compute the minimal set of whitespace edits that
 * bring a document to canonical shape, or apply them in one step.
 *
 * **Details**
 *
 * Kept as its own concept module (rather than folded into the `Jsonc` facade)
 * so the format surface stays symmetric with sibling document codecs. Both
 * statics are pure and total: computing edits never fails.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { thunk0 } from "@beep/utils/thunk";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { accumulation } from "./internal/accumulation.ts";
import { lineSpan } from "./internal/lines.ts";
import { createScanner, SyntaxKind } from "./internal/scanner.ts";
import { JsoncEdit, JsoncFormattingOptions } from "./JsoncEdit.ts";
import type { Scanner } from "./internal/scanner.ts";
import type { JsoncFormattingOptionsLike, JsoncRange } from "./JsoncEdit.ts";

const isSkipped = S.is(SyntaxKind.pick(["Trivia", "LineBreak"]));
const isCloser = S.is(SyntaxKind.pick(["CloseBrace", "CloseBracket"]));
const isOpener = S.is(SyntaxKind.pick(["OpenBrace", "OpenBracket"]));
const isComment = S.is(SyntaxKind.pick(["LineComment", "BlockComment"]));
const isValueEndNeedingCommaCommentOrEof = S.is(
  SyntaxKind.pick(["Null", "True", "False", "Number", "CloseBrace", "CloseBracket"])
);

/**
 * Formats JSONC text into canonical whitespace, as minimal edits or as a
 * finished string, preserving comments. Pure and total; not instantiable.
 *
 * **Example** (Reflow a compact document)
 *
 * ```ts
 * import { JsoncFormatter } from "@beep/jsonc/JsoncFormatter"
 *
 * console.log(JsoncFormatter.formatToString('{"a":1,"b":[1,2]} // keep'))
 * // '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n} // keep'
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export abstract class JsoncFormatter {
  /**
   * Compute formatting edits for a JSONC document.
   *
   * **Details**
   *
   * Non-mutating: apply the result with `JsoncEdit.applyAll`. With a `range`,
   * the lines it touches are formatted from the indentation of their first
   * line and only the edits overlapping `range` are returned. The algorithm is
   * `jsonc-parser`'s `format`: empty containers stay compact, a comment on the
   * same line stays there, and the document's own line ending wins over
   * `eol`. Omitted option fields take the {@link JsoncFormattingOptions}
   * defaults.
   *
   * **Example** (Compute edits for a compact object)
   *
   * ```ts
   * import { JsoncFormatter } from "@beep/jsonc/JsoncFormatter"
   *
   * const edits = JsoncFormatter.format('{"a":1}')
   *
   * console.log(edits.map((edit) => edit.content)) // ["\n  ", " ", "\n"]
   * ```
   *
   * @param text - The JSONC source to format.
   * @param range - Optional sub-range restricting which edits are returned.
   * @param options - Formatting options as an instance or a plain literal.
   * @returns The edits that bring `text` to canonical shape.
   */
  static readonly format: {
    (text: string, range?: JsoncRange, options?: JsoncFormattingOptionsLike): ReadonlyArray<JsoncEdit>;
    (range?: JsoncRange, options?: JsoncFormattingOptionsLike): (text: string) => ReadonlyArray<JsoncEdit>;
  } = dual(
    (args) => P.isString(args[0]),
    (text: string, range?: JsoncRange, options?: JsoncFormattingOptionsLike): ReadonlyArray<JsoncEdit> =>
      formatImpl(text, O.fromUndefinedOr(range), JsoncFormattingOptions.make(options ?? R.empty()))
  );

  /**
   * Format `text` and apply the resulting edits in one step.
   *
   * **Example** (Format with a final newline)
   *
   * ```ts
   * import { JsoncFormatter } from "@beep/jsonc/JsoncFormatter"
   *
   * console.log(JsoncFormatter.formatToString('{"a":1}', undefined, { insertFinalNewline: true })) // '{\n  "a": 1\n}\n'
   * ```
   *
   * @param text - The JSONC source to format.
   * @param range - Optional sub-range restricting which edits are applied.
   * @param options - Formatting options as an instance or a plain literal.
   * @returns The formatted text.
   */
  static readonly formatToString: {
    (text: string, range?: JsoncRange, options?: JsoncFormattingOptionsLike): string;
    (range?: JsoncRange, options?: JsoncFormattingOptionsLike): (text: string) => string;
  } = dual(
    (args) => P.isString(args[0]),
    (text: string, range?: JsoncRange, options?: JsoncFormattingOptionsLike): string =>
      JsoncEdit.applyAll(text, JsoncFormatter.format(text, range, options))
  );
}

// Ported from microsoft/node-jsonc-parser src/impl/format.ts (MIT).

const documentEol = (text: string, fallback: string): string =>
  O.match(Str.match(/\r\n?|\n/)(text), { onNone: () => fallback, onSome: (found) => found[0] });

const leadingIndentLevel = (text: string, tabSize: number): number => {
  const tabWidthZeroReadAsFour = tabSize === 0 ? 4 : tabSize;
  const leading = Str.slice(0, text.length - Str.replace(/^[ \t]+/, "")(text).length)(text);
  const tabs = Str.split(leading, "\t").length - 1;
  return Math.floor((leading.length - tabs + tabs * tabWidthZeroReadAsFour) / tabWidthZeroReadAsFour);
};

interface FormatRun {
  readonly edits: Array<JsoncEdit>;
  readonly eol: string;
  readonly formatTextStart: number;
  hasError: boolean;
  indentLevel: number;
  readonly indentUnit: string;
  readonly initialIndentLevel: number;
  lineBreaks: number;
  readonly options: JsoncFormattingOptions;
  readonly ranged: boolean;
  readonly rangeEnd: number;
  readonly rangeStart: number;
  readonly scanner: Scanner;
  readonly text: string;
}

const makeRun = (text: string, range: O.Option<JsoncRange>, options: JsoncFormattingOptions): FormatRun => {
  const rangeStart = O.match(range, { onNone: thunk0, onSome: (r) => r.offset });
  const rangeEnd = O.match(range, { onNone: () => text.length, onSome: (r) => r.offset + r.length });
  const [formatTextStart, formatTextEnd] = O.isSome(range)
    ? lineSpan(text, rangeStart, rangeEnd)
    : ([0, text.length] as const);
  const formatText = Str.substring(formatTextStart, formatTextEnd)(text);
  return {
    text,
    ranged: O.isSome(range),
    rangeStart,
    rangeEnd,
    formatTextStart,
    initialIndentLevel: O.isSome(range) ? leadingIndentLevel(formatText, options.tabSize) : 0,
    eol: documentEol(text, options.eol),
    indentUnit: options.insertSpaces ? Str.repeat(options.tabSize)(" ") : "\t",
    options,
    scanner: createScanner(formatText, false),
    edits: [],
    hasError: false,
    lineBreaks: 0,
    indentLevel: 0,
  };
};

const indentOf = (run: FormatRun, level: number): string => Str.repeat(level)(run.indentUnit);

const newLinesAndIndent = (run: FormatRun): string =>
  (run.lineBreaks > 1 ? Str.repeat(run.lineBreaks)(run.eol) : run.eol) +
  indentOf(run, run.initialIndentLevel + run.indentLevel);

const scanNext = (run: FormatRun): SyntaxKind => {
  let token = run.scanner.scan();
  run.lineBreaks = 0;
  while (isSkipped(token)) {
    if (SyntaxKind.is.LineBreak(token)) {
      run.lineBreaks = run.options.keepLines ? run.lineBreaks + 1 : 1;
    }
    token = run.scanner.scan();
  }
  run.hasError = SyntaxKind.is.Unknown(token) || run.scanner.getTokenError() !== "None";
  return token;
};

const inRange = (run: FormatRun, start: number, end: number): boolean =>
  !run.ranged || (start < run.rangeEnd && end > run.rangeStart);

const addEdit = (run: FormatRun, content: string, start: number, end: number): void => {
  if (!run.hasError && inRange(run, start, end) && Str.substring(start, end)(run.text) !== content) {
    accumulation.append(run.edits, JsoncEdit.make({ offset: start, length: end - start, content }));
  }
};

const tokenStart = (run: FormatRun): number => run.scanner.getTokenOffset() + run.formatTextStart;
const tokenEnd = (run: FormatRun): number => tokenStart(run) + run.scanner.getTokenLength();
const keptBreak = (run: FormatRun): boolean => run.options.keepLines && run.lineBreaks > 0;

interface Gap {
  readonly contentChosenSoFar: string;
  readonly first: SyntaxKind;
  readonly needsLineBreak: boolean;
  readonly second: SyntaxKind;
}

const opensIt = (gap: Gap): boolean =>
  SyntaxKind.is.CloseBrace(gap.second) ? SyntaxKind.is.OpenBrace(gap.first) : SyntaxKind.is.OpenBracket(gap.first);

const closerGap = (run: FormatRun, gap: Gap): string => {
  const isMatchedEmptyContainer = opensIt(gap);
  if (!isMatchedEmptyContainer) {
    run.indentLevel--;
  }
  if (keptBreak(run) || (!run.options.keepLines && !isMatchedEmptyContainer)) {
    return newLinesAndIndent(run);
  }
  return run.options.keepLines ? " " : gap.contentChosenSoFar;
};

const breakOrSpace = (run: FormatRun): string =>
  !run.options.keepLines || run.lineBreaks > 0 ? newLinesAndIndent(run) : " ";
const keptBreakOr = (run: FormatRun, otherwise: () => string): string =>
  keptBreak(run) ? newLinesAndIndent(run) : otherwise();
const spaceUnlessBreak = (gap: Gap): string => (gap.needsLineBreak ? gap.contentChosenSoFar : " ");

const tokenGap: (run: FormatRun, gap: Gap) => string = (run, gap) =>
  Match.value(gap.first).pipe(
    Match.when(isOpener, () => {
      run.indentLevel++;
      return breakOrSpace(run);
    }),
    Match.when(SyntaxKind.is.Comma, () => breakOrSpace(run)),
    Match.when(SyntaxKind.is.LineComment, () => newLinesAndIndent(run)),
    Match.when(SyntaxKind.is.BlockComment, () => (run.lineBreaks > 0 ? newLinesAndIndent(run) : spaceUnlessBreak(gap))),
    Match.when(SyntaxKind.is.Colon, () => keptBreakOr(run, () => spaceUnlessBreak(gap))),
    Match.when(SyntaxKind.is.String, () =>
      keptBreakOr(run, () => (SyntaxKind.is.Colon(gap.second) && !gap.needsLineBreak ? "" : gap.contentChosenSoFar))
    ),
    Match.orElse(() =>
      keptBreakOr(run, () => (isComment(gap.second) && !gap.needsLineBreak ? " " : gap.contentChosenSoFar))
    )
  );

const isStructuralError = (run: FormatRun, gap: Gap): boolean => {
  if (SyntaxKind.is.Unknown(gap.first)) {
    return true;
  }
  const allowed =
    keptBreak(run) ||
    (isComment(gap.second) && !gap.needsLineBreak) ||
    SyntaxKind.is.Comma(gap.second) ||
    SyntaxKind.is.EOF(gap.second);
  return isValueEndNeedingCommaCommentOrEof(gap.first) && !allowed;
};

const openGap = (run: FormatRun, gap: Gap): string => {
  const content = tokenGap(run, gap);
  run.hasError = run.hasError || isStructuralError(run, gap);
  return run.lineBreaks > 0 && isComment(gap.second) ? newLinesAndIndent(run) : content;
};

const finalGap = (run: FormatRun): string => {
  if (keptBreak(run)) {
    return newLinesAndIndent(run);
  }
  return run.options.insertFinalNewline ? run.eol : "";
};

const sameLineComments = (run: FormatRun, firstEnd: number) => {
  let end = firstEnd;
  let second = scanNext(run);
  let needsLineBreak = false;
  let contentChosenSoFar = "";
  while (run.lineBreaks === 0 && isComment(second)) {
    addEdit(run, " ", end, tokenStart(run));
    end = tokenEnd(run);
    needsLineBreak = SyntaxKind.is.LineComment(second);
    contentChosenSoFar = needsLineBreak ? newLinesAndIndent(run) : "";
    second = scanNext(run);
  }
  return { end, second, needsLineBreak, contentChosenSoFar };
};

const formatGapAfterTokenReturningNext = (run: FormatRun, first: SyntaxKind): SyntaxKind => {
  const { end, second, needsLineBreak, contentChosenSoFar } = sameLineComments(run, tokenEnd(run));
  const gap: Gap = { first, second, needsLineBreak, contentChosenSoFar };
  const content = isCloser(second) ? closerGap(run, gap) : openGap(run, gap);
  addEdit(run, SyntaxKind.is.EOF(second) ? finalGap(run) : content, end, tokenStart(run));
  return second;
};

const formatImpl: {
  (text: string, range: O.Option<JsoncRange>, options: JsoncFormattingOptions): ReadonlyArray<JsoncEdit>;
  (range: O.Option<JsoncRange>, options: JsoncFormattingOptions): (text: string) => ReadonlyArray<JsoncEdit>;
} = dual(3, (text: string, range: O.Option<JsoncRange>, options: JsoncFormattingOptions): ReadonlyArray<JsoncEdit> => {
  const run = makeRun(text, range, options);
  let token = scanNext(run);
  if (keptBreak(run)) {
    addEdit(run, Str.repeat(run.lineBreaks)(run.eol), 0, 0);
  }
  if (!SyntaxKind.is.EOF(token)) {
    addEdit(run, indentOf(run, run.initialIndentLevel), run.formatTextStart, tokenStart(run));
  }
  while (!SyntaxKind.is.EOF(token)) {
    token = formatGapAfterTokenReturningNext(run, token);
  }
  return run.edits;
});
