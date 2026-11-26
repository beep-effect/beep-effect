import { replaceWith } from "@beep/utils/Str";
import * as A from "effect/Array";
import { constant, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";

/**
 * Folds a logical scalar line at safe spaces while preserving its YAML value.
 *
 * **Details**
 *
 * Column-based line folding for a single logical scalar line (YAML 1.2 flow
 * folding, §7.3 / §8.2.1). Breaks the content at "safe" single-space
 * boundaries — a space whose neighbours are neither spaces nor tabs — so each inserted
 * line break is a *semantically transparent* fold: on read, a lone break
 * between non-empty lines at the same indent folds back to a single space, and
 * the leading indentation of continuation lines is absorbed as separation
 * whitespace. The original space at the break point is consumed, replaced by
 * the break, so no content whitespace is added or lost.
 *
 * Continuation lines are prefixed with `indent`. `indentAtStart` is the column
 * the first line begins at (its content is already `indentAtStart` columns in),
 * used only to budget the first line; it is approximate because the caller's
 * exact column (after a `key: ` prefix, say) is not known here.
 *
 * **Gotchas**
 *
 * Only breaks where a break is safe. When no safe break point exists before the
 * width limit, the line overflows unwrapped rather than corrupting the value —
 * width folding is a best-effort presentation concern, never a correctness one.
 * A non-positive `lineWidth` (the default) returns the text unchanged.
 *
 * **Example** (Fold at a safe space)
 *
 * ```ts
 * import { foldScalarLine } from "@beep/yaml/internal/fold"
 *
 * console.log(JSON.stringify(foldScalarLine("hello world", "  ", 8, 0))) // "hello\n  world"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export function foldScalarLine(
  text: string,
  ...[indent, lineWidth, indentAtStart]: [indent: string, lineWidth: number, indentAtStart: number]
): string {
  if (lineWidth <= 0) return text;
  const folds = findFoldPoints(text, lineWidth, indentAtStart, indent.length);
  return folds.length === 0 ? text : applyFolds(text, folds, indent);
}

const isBlankOrEnd = (ch: string | undefined): boolean => ch === undefined || ch === " " || ch === "\t";

const isSafeSplit = (text: string, i: number): boolean =>
  text[i] === " " && text[i - 1] !== "\n" && !isBlankOrEnd(text[i - 1]) && !isBlankOrEnd(text[i + 1]);

function findFoldPoints(text: string, lineWidth: number, indentAtStart: number, indentLength: number): number[] {
  const continuationWidthEvenPastIndentAtLeastOne = Math.max(1, lineWidth - indentLength);
  let foldOnceIndexReaches = Math.max(1, lineWidth - indentAtStart);
  const folds: number[] = [];
  let splitCandidateOnThisPhysicalLine: number | undefined;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      splitCandidateOnThisPhysicalLine = undefined;
      foldOnceIndexReaches = i + 1 + lineWidth;
      continue;
    }
    if (isSafeSplit(text, i)) splitCandidateOnThisPhysicalLine = i;
    if (i >= foldOnceIndexReaches && splitCandidateOnThisPhysicalLine !== undefined) {
      folds.push(splitCandidateOnThisPhysicalLine);
      foldOnceIndexReaches = splitCandidateOnThisPhysicalLine + continuationWidthEvenPastIndentAtLeastOne;
      splitCandidateOnThisPhysicalLine = undefined;
    }
  }
  return folds;
}

function applyFolds(text: string, folds: ReadonlyArray<number>, indent: string): string {
  let result = Str.slice(0, folds[0])(text);
  for (const [f, fold] of folds.entries()) {
    const sliceEnd = folds[f + 1] ?? text.length;
    result += `\n${indent}${Str.slice(fold + 1, sliceEnd)(text)}`;
  }
  return result;
}

/**
 * Applies value-preserving width folding according to a rendered scalar's style.
 *
 * **Details**
 *
 * Apply {@link foldScalarLine} to an already-rendered scalar according to its
 * style, inferred from the leading character:
 *
 * - `|` block-literal — returned unchanged; literal blocks preserve bytes by
 *   definition and must never be folded.
 * - `>` block-folded — each base-indent body content line is folded; blank
 *   lines and more-indented lines (which the reader treats as literal breaks)
 *   are left untouched.
 * - `"` double-quoted — the inner content is folded; breaking only at content
 *   spaces means no `\`-escaped continuations are needed.
 * - `'` single-quoted — returned unchanged (out of scope for width folding).
 * - otherwise plain — folded directly.
 *
 * `indent` is one indentation level (the continuation prefix); `lineWidth` is
 * the target column. A non-positive `lineWidth` returns the text unchanged.
 *
 * **Example** (Keep literal block bytes)
 *
 * ```ts
 * import { foldRenderedScalar } from "@beep/yaml/internal/fold"
 *
 * console.log(JSON.stringify(foldRenderedScalar("|-\n  hello world", "  ", 8))) // "|-\n  hello world"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export function foldRenderedScalar(
  rendered: string,
  ...[indent, lineWidth]: [indent: string, lineWidth: number]
): string {
  if (lineWidth <= 0 || rendered.length === 0) return rendered;
  const first = rendered[0];
  if (first === "|" || first === "'") return rendered;
  if (first === ">") return foldBlockFoldedBody(rendered, indent, lineWidth);
  if (first === '"') {
    const inner = Str.slice(1, -1)(rendered);
    const firstLineStartsPastOpeningQuote = indent.length + 1;
    return `"${foldScalarLine(inner, indent, lineWidth, firstLineStartsPastOpeningQuote)}"`;
  }
  return foldScalarLine(rendered, indent, lineWidth, indent.length);
}

const isBaseIndentContentLine = (line: string, indent: string): boolean =>
  line.length > indent.length &&
  Str.startsWith(indent)(line) &&
  line[indent.length] !== " " &&
  line[indent.length] !== "\t";

function foldBlockFoldedBody(rendered: string, indent: string, lineWidth: number): string {
  const lines = Str.split("\n")(rendered);
  const body = A.map(lines.slice(1), (line) =>
    isBaseIndentContentLine(line, indent)
      ? indent + foldScalarLine(Str.slice(indent.length)(line), indent, lineWidth, indent.length)
      : line
  );
  return A.join([...lines.slice(0, 1), ...body], "\n");
}

/**
 * C0 control characters (except TAB) that must be escaped in double-quoted scalars.
 *
 * **Example** (Distinguish controls from tabs)
 *
 * ```ts
 * import { isControlChar } from "@beep/yaml/internal/fold"
 *
 * console.log(isControlChar(0x00)) // true
 * console.log(isControlChar(0x09)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export function isControlChar(code: number): boolean {
  return (code >= 0x00 && code <= 0x08) || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f);
}

/**
 * Returns true when the value has whitespace immediately before a newline AND
 * the value contains a non-trailing newline. Equivalent to the regex pair
 * `/[\t ]\n/.test(s) && s.replace(/\n+$/, "").includes("\n")` but uses linear
 * imperative scans to avoid polynomial-time regex behaviour on adversarial
 * inputs containing many trailing newlines.
 *
 * **Example** (Detect interior trailing spaces)
 *
 * ```ts
 * import { hasInteriorTrailingWhitespace } from "@beep/yaml/internal/fold"
 *
 * console.log(hasInteriorTrailingWhitespace("a \nb")) // true
 * console.log(hasInteriorTrailingWhitespace("a \n")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export function hasInteriorTrailingWhitespace(s: string): boolean {
  if (!hasWhitespaceBeforeNewline(s)) return false;
  const firstNewline = O.getOrElse(constant(-1))(Str.indexOf("\n")(s));
  const chompOwnedTrailingNewlinesStart = trailingNewlinesStart(s);
  return firstNewline >= 0 && firstNewline < chompOwnedTrailingNewlinesStart;
}

function hasWhitespaceBeforeNewline(s: string): boolean {
  for (let i = 1; i < s.length; i++) {
    if (s[i] === "\n" && isSpaceOrTabCode(Str.slice(i - 1, i)(s))) return true;
  }
  return false;
}

const isSpaceOrTabCode = (ch: string): boolean => ch === " " || ch === "\t";

function trailingNewlinesStart(s: string): number {
  let start = s.length;
  while (start > 0 && s[start - 1] === "\n") start--;
  return start;
}

/**
 * Returns true when the value contains a newline followed by one or more
 * spaces and then a tab — mixed leading whitespace on a continuation line
 * that block style cannot represent unambiguously.
 *
 * **Example** (Detect mixed continuation indentation)
 *
 * ```ts
 * import { hasNewlineSpacesTab } from "@beep/yaml/internal/fold"
 *
 * console.log(hasNewlineSpacesTab("a\n \tb")) // true
 * console.log(hasNewlineSpacesTab("a\n\tb")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export function hasNewlineSpacesTab(s: string): boolean {
  for (let i = 0; i < s.length - 2; i++) {
    if (s[i] === "\n" && isSpacesThenTab(s, i + 1)) return true;
  }
  return false;
}

function isSpacesThenTab(s: string, from: number): boolean {
  let j = from;
  while (j < s.length && s[j] === " ") j++;
  return j > from && j < s.length && s[j] === "\t";
}

/**
 * Renders a multi-line value as a single-quoted scalar with proper fold encoding.
 *
 * **Details**
 *
 * Single-quoted scalars use line folding rules (YAML 1.2 §7.4): bare newlines
 * between non-empty lines fold to a space; empty lines preserve as literal
 * newlines. To round-trip a value with N consecutive literal newlines, the
 * source needs N+1 consecutive source newlines (i.e., one extra to account
 * for the bare newline that would otherwise fold to a space).
 *
 * Continuation lines are prefixed with the given indent. Whitespace adjacent
 * to an interior line break cannot survive flow folding; those values must
 * use escaped double quotes instead.
 *
 * **Gotchas**
 *
 * Returns `None` if the content cannot safely be represented as single-quoted
 * (carriage returns, non-tab control characters, or folding whitespace).
 *
 * **Example** (Encode a literal newline in single quotes)
 *
 * ```ts
 * import { renderSingleQuotedMultiline } from "@beep/yaml/internal/fold"
 * import * as O from "effect/Option"
 *
 * console.log(JSON.stringify(O.getOrNull(renderSingleQuotedMultiline("a\nb", "  ")))) // "'a\n\n  b'"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export function renderSingleQuotedMultiline(s: string, ...[indent]: [indent: string]): O.Option<string> {
  if (hasSingleQuoteUnsafeChar(s)) return O.none();
  if (hasInteriorTrailingWhitespace(s) || /\n[ \t]/.test(s)) return O.none();
  const escaped = Str.replace(/'/g, "''")(s);
  const result = replaceWith(
    escaped,
    /\n+/g,
    (run: string, ...args: ReadonlyArray<unknown>) =>
      Str.repeat(run.length + 1)("\n") + (Number(args[0]) + run.length < escaped.length ? indent : "")
  );
  return O.some(`'${result}'`);
}

const nonTabC0Control = /[\x00-\x08\x0b\x0c\x0e-\x1f]/;

function hasSingleQuoteUnsafeChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const ch = Str.slice(i, i + 1)(s);
    if (ch === "\r" || nonTabC0Control.test(ch)) return true;
  }
  return false;
}

// decision: block-scalar-header-emission
const fidelityIndentIndicator = (explicitIndent: number | undefined, indent: string): string =>
  explicitIndent !== undefined && explicitIndent === indent.length ? String(explicitIndent) : "";

const indicatorOutOfRange = (indicator: string, indent: string): boolean =>
  indicator !== "" && (indent.length < 1 || indent.length > 9);

/**
 * Renders a string scalar using block literal style (pipe `|`).
 *
 * **Gotchas**
 *
 * Returns `None` when preserving indentation would require an indicator outside
 * YAML's single-digit range 1–9. Callers must use escaped double quotes.
 *
 * **Example** (Strip absent trailing newlines)
 *
 * ```ts
 * import { renderBlockLiteral } from "@beep/yaml/internal/fold"
 * import * as O from "effect/Option"
 *
 * console.log(JSON.stringify(O.getOrNull(renderBlockLiteral("hello", "  ")))) // "|-\n  hello"
 * ```
 * @param explicitChomp - Original chomp indicator from the AST, when known.
 * `keep` (`+`) and `strip` (`-`) preserve trailing-newline semantics that
 * cannot be inferred from the resolved value alone.
 * @param preserveKeep - Re-emit a REDUNDANT explicit `+` (a keep header whose
 * value ends in exactly one newline, where clip would read identically) —
 * fidelity-path header preservation; canonical mode passes false.
 * @param explicitIndent - Explicit indentation-indicator digit from the AST,
 * re-emitted only when it matches the rendered indent (fidelity path).
 * @category formatting
 * @since 0.0.0
 */
export function renderBlockLiteral(
  s: string,
  ...[indent, explicitChomp, parentPosition, preserveKeep = false, explicitIndent]: [
    indent: string,
    explicitChomp?: "strip" | "clip" | "keep",
    parentPosition?: "block-map-value" | "block-seq-item",
    preserveKeep?: boolean,
    explicitIndent?: number,
  ]
): O.Option<string> {
  // decision: block-scalar-header-emission
  const chomp = blockChomp(s, preserveKeep && explicitChomp === "keep");
  const lines = bodyLinesWithoutFinalBreakLine(s);
  const indentIndicator = literalIndentIndicator(lines, chomp, parentPosition, indent, explicitIndent);
  if (indicatorOutOfRange(indentIndicator, indent)) return O.none();
  return O.some(
    `|${indentIndicator}${chomp}\n${pipe(
      lines,
      A.map((l) => (l === "" ? "" : `${indent}${l}`)),
      A.join("\n")
    )}`
  );
}

function blockChomp(s: string, explicitKeep: boolean): string {
  if (Str.endsWith("\n\n")(s) || (s.length > 0 && /^\n+$/.test(s))) return "+";
  if (!Str.endsWith("\n")(s)) return "-";
  return explicitKeep ? "+" : "";
}

function bodyLinesWithoutFinalBreakLine(s: string): string[] {
  const lines = Str.split("\n")(s);
  if (Str.endsWith("\n")(s)) lines.pop();
  return lines;
}

const isEmptyLine = (l: string): boolean => l === "";
const startsWithSpace = (l: string): boolean => Str.startsWith(" ")(l);

function literalIndentIndicator(
  lines: ReadonlyArray<string>,
  chomp: string,
  parentPosition: "block-map-value" | "block-seq-item" | undefined,
  indent: string,
  explicitIndent: number | undefined
): string {
  const needsIndicator =
    needsLeadingIndentIndicator(lines, 1) ||
    (chomp === "+" && parentPosition === "block-map-value" && indent.length > 0 && A.every(lines, isEmptyLine));
  return needsIndicator ? String(indent.length) : fidelityIndentIndicator(explicitIndent, indent);
}

function needsLeadingIndentIndicator(lines: ReadonlyArray<string>, leadingBlanks: number): boolean {
  const firstContent = A.findFirst(lines, (l) => l !== "");
  if (O.exists(firstContent, startsWithSpace)) return true;
  return O.isSome(firstContent) && lines.length >= leadingBlanks && A.every(lines.slice(0, leadingBlanks), isEmptyLine);
}

/**
 * Renders a string scalar using block folded style (greater-than `>`).
 *
 * **Details**
 *
 * In folded block scalars, a single newline between content lines is folded
 * into a space by the reader. To preserve a literal newline in the value,
 * the output must contain an empty line (double newline). Each empty line
 * in the value already produces the correct number of blank lines.
 *
 * **Gotchas**
 *
 * Returns `None` when preserving indentation would require an indicator outside
 * YAML's single-digit range 1–9. Callers must use escaped double quotes.
 *
 * **Example** (Preserve a newline in folded output)
 *
 * ```ts
 * import { renderBlockFolded } from "@beep/yaml/internal/fold"
 * import * as O from "effect/Option"
 *
 * console.log(JSON.stringify(O.getOrNull(renderBlockFolded("a\nb", "  ")))) // ">-\n  a\n\n  b"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export function renderBlockFolded(
  s: string,
  ...[indent, explicitChomp, explicitIndent]: [
    indent: string,
    explicitChomp?: "strip" | "clip" | "keep",
    explicitIndent?: number,
  ]
): O.Option<string> {
  // decision: block-scalar-header-emission
  const chomp = blockChomp(s, explicitChomp === "keep");

  const valueLines = bodyLinesWithoutFinalBreakLine(s);

  const indentIndicator = needsLeadingIndentIndicator(valueLines, 2)
    ? String(indent.length)
    : fidelityIndentIndicator(explicitIndent, indent);

  if (indicatorOutOfRange(indentIndicator, indent)) return O.none();
  return O.some(`>${indentIndicator}${chomp}\n${A.join(foldedOutputLines(valueLines, indent), "\n")}`);
}

// decision: block-scalar-header-emission
function foldedOutputLines(valueLines: ReadonlyArray<string>, indent: string): string[] {
  const outputLines: string[] = [];
  let prevContentNormal = false;
  for (const line of valueLines) {
    if (line === "") {
      outputLines.push("");
      continue;
    }
    const isMoreIndented = Str.startsWith(" ")(line) || Str.startsWith("\t")(line);
    if (prevContentNormal && !isMoreIndented) outputLines.push("");
    outputLines.push(`${indent}${line}`);
    prevContentNormal = !isMoreIndented;
  }
  return outputLines;
}
