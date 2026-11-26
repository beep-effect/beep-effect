// decision: imperative-scanner

import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { findKeyIndent, foldBlockLines } from "./block-scalar.ts";
import type { ScalarChomp } from "../YamlNode.ts";
import type { YamlToken, YamlTokenKind } from "./token.ts";

const singleCharacterEscapes: Readonly<Record<string, string>> = {
  "\\": "\\",
  '"': '"',
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  "\t": "\t",
  t: "\t",
  "0": "\0",
  a: "\x07",
  e: "\x1B",
  v: "\x0B",
  " ": " ",
  N: "\u0085",
  _: "\u00A0",
  L: "\u2028",
  P: "\u2029",
};

const hexEscapeWidths: Readonly<Record<string, number>> = { x: 2, u: 4, U: 8 };

const chompIndicators: Readonly<Record<string, ScalarChomp>> = { "-": "strip", "+": "keep" };

const minimumKeptLinesAtWhitespaceOnlyEof = 1;

const endOfInput = "";

const isWhitespace = (ch: string): boolean => ch === " " || ch === "\t";

const isNewline = (ch: string): boolean => ch === "\n" || ch === "\r";

const isLineEnd = (ch: string): boolean => ch === endOfInput || isNewline(ch);

const isSeparatorOrEnd = (ch: string): boolean => isLineEnd(ch) || isWhitespace(ch);

const isFlowIndicator = (ch: string): boolean => ch === "{" || ch === "}" || ch === "[" || ch === "]" || ch === ",";

const isStyleIndicator = (ch: string): boolean => ch === '"' || ch === "'" || ch === "|" || ch === ">";

const isNsAnchorChar = (ch: string): boolean => !isWhitespace(ch) && !isNewline(ch) && !isFlowIndicator(ch);

const isIndentIndicator = (ch: string): boolean => ch.length === 1 && ch >= "1" && ch <= "9";

// decision: block-scalar-header-recovery
const blockHeaderCharacter = /[-+#0-9]/;

const isBlockScalarHeaderStart = (next: string): boolean =>
  isSeparatorOrEnd(next) || (next.length === 1 && blockHeaderCharacter.test(next));

const compactKeyPrefix = /^(?:[-?:][ \t]+)+$/;

const isDocumentMarkerAt = (text: string, at: number): boolean => {
  const head = Str.slice(at, at + 3)(text);
  return (head === "---" || head === "...") && isSeparatorOrEnd(Str.slice(at + 3, at + 4)(text));
};

const lineBreakEnd = (text: string, at: number): number =>
  text[at] === "\r" && text[at + 1] === "\n" ? at + 2 : at + 1;

const lineStartOf = (text: string, at: number): number => {
  let lineStart = at;
  while (lineStart > 0 && !isNewline(Str.slice(lineStart - 1, lineStart)(text))) {
    lineStart--;
  }
  return lineStart;
};

const countSpaces = (text: string, at: number): number => {
  let spaces = 0;
  while (text[at + spaces] === " ") spaces++;
  return spaces;
};

const detectBlockIndent = (text: string, from: number): number => {
  let at = from;
  while (at < text.length) {
    const spaces = countSpaces(text, at);
    const content = at + spaces;
    if (spaces === 0 && isDocumentMarkerAt(text, content)) return -1;
    if (!isLineEnd(Str.slice(content, content + 1)(text))) return spaces;
    at = content < text.length ? lineBreakEnd(text, content) : content;
  }
  return -1;
};

const toggledQuote = (ch: string, quote: string): string => {
  if (ch !== "'" && ch !== '"') return quote;
  if (quote === "") return ch;
  return quote === ch ? "" : quote;
};

const chompBlockValue = (body: string, chomp: ScalarChomp, trailingEmptyLines: number): string => {
  if (chomp === "strip") return body;
  return body + Str.repeat(chomp === "keep" ? trailingEmptyLines + 1 : 1)("\n");
};

/**
 * A stateful YAML scanner that produces tokens one at a time.
 *
 * **Details**
 *
 * Provides a pull-based accessor API: call {@link YamlScanner.scan} to advance
 * to the next token, then use the `getToken*` methods to inspect the current
 * token without advancing again.
 *
 * **Example** (Inspect a scanner through its interface)
 *
 * ```ts
 * import type { YamlScanner } from "@beep/yaml/internal/lexer"
 * import { createScanner } from "@beep/yaml/internal/lexer"
 * const scanner: YamlScanner = createScanner("hello")
 * console.log(scanner.scan()) // scalar
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface YamlScanner {
  /**
   * Return the current scanner position (next character to be scanned).
   *
   * **Example** (Inspect consumed source length)
   *
   * ```ts
   * import { createScanner } from "@beep/yaml/internal/lexer"
   *
   * const scanner = createScanner("hello")
   * scanner.scan()
   * console.log(scanner.getPosition()) // 5
   * ```
   *
   * @since 0.0.0
   */
  getPosition(): number;
  /**
   * Return the kind of the current token without advancing, or `null` before scanning.
   *
   * **Example** (Inspect without advancing)
   *
   * ```ts
   * import { createScanner } from "@beep/yaml/internal/lexer"
   *
   * const scanner = createScanner("hello")
   * scanner.scan()
   * console.log(scanner.getToken()) // scalar
   * ```
   *
   * @since 0.0.0
   */
  getToken(): YamlTokenKind | null;
  /**
   * Return the zero-based column of the current token start.
   *
   * **Example** (Locate the scalar column)
   *
   * ```ts
   * import { createScanner } from "@beep/yaml/internal/lexer"
   *
   * const scanner = createScanner("hello")
   * scanner.scan()
   * console.log(scanner.getTokenColumn()) // 0
   * ```
   *
   * @since 0.0.0
   */
  getTokenColumn(): number;
  /**
   * Return the character length of the current token span.
   *
   * **Example** (Measure a scalar span)
   *
   * ```ts
   * import { createScanner } from "@beep/yaml/internal/lexer"
   *
   * const scanner = createScanner("hello")
   * scanner.scan()
   * console.log(scanner.getTokenLength()) // 5
   * ```
   *
   * @since 0.0.0
   */
  getTokenLength(): number;
  /**
   * Return the zero-based line number of the current token start.
   *
   * **Example** (Locate the scalar line)
   *
   * ```ts
   * import { createScanner } from "@beep/yaml/internal/lexer"
   *
   * const scanner = createScanner("hello")
   * scanner.scan()
   * console.log(scanner.getTokenLine()) // 0
   * ```
   *
   * @since 0.0.0
   */
  getTokenLine(): number;
  /**
   * Return the zero-based character offset of the current token start.
   *
   * **Example** (Locate scalar content)
   *
   * ```ts
   * import { createScanner } from "@beep/yaml/internal/lexer"
   *
   * const scanner = createScanner("hello")
   * scanner.scan()
   * console.log(scanner.getTokenOffset()) // 0
   * ```
   *
   * @since 0.0.0
   */
  getTokenOffset(): number;
  /**
   * Return the value string of the current token.
   *
   * **Example** (Read scalar content)
   *
   * ```ts
   * import { createScanner } from "@beep/yaml/internal/lexer"
   *
   * const scanner = createScanner("hello")
   * scanner.scan()
   * console.log(scanner.getTokenValue()) // hello
   * ```
   *
   * @since 0.0.0
   */
  getTokenValue(): string;
  /**
   * Advance to the next token and return its kind, or `null` at end-of-input.
   *
   * **Example** (Advance to a scalar)
   *
   * ```ts
   * import { createScanner } from "@beep/yaml/internal/lexer"
   *
   * const scanner = createScanner("hello")
   * console.log(scanner.scan()) // scalar
   * ```
   *
   * @since 0.0.0
   */
  scan(): YamlTokenKind | null;
  /**
   * Reset the scanner to the given character offset and rescan from there.
   *
   * **Gotchas**
   *
   * All block-structure state (indentation, flow depth, pending tokens) is
   * reset. For reliable results, pass an offset previously returned by
   * {@link YamlScanner.getTokenOffset} rather than an arbitrary mid-token
   * position.
   *
   * **Example** (Rescan from a recorded token offset)
   *
   * ```ts
   * import { createScanner } from "@beep/yaml/internal/lexer"
   *
   * const scanner = createScanner("hello")
   * scanner.scan()
   * const offset = scanner.getTokenOffset()
   * scanner.setPosition(offset)
   * console.log(scanner.scan()) // scalar
   * ```
   *
   * @since 0.0.0
   */
  setPosition(pos: number): void;
}

/**
 * Create a new YAML scanner for the given source text.
 *
 * **Details**
 *
 * Returns a stateful, pull-based scanner. Call {@link YamlScanner.scan} to
 * advance to the next token, then use `getToken*` methods to inspect it.
 *
 * **Example** (Read a scalar token)
 *
 * ```ts
 * import { createScanner } from "@beep/yaml/internal/lexer"
 *
 * const scanner = createScanner("hello")
 * console.log(scanner.scan()) // scalar
 * console.log(scanner.getTokenValue()) // hello
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function createScanner(text: string): YamlScanner {
  let pos = 0;
  let line = 0;
  let col = 0;
  let lineIndent = 0;
  let lineIndentLocked = false;
  let flowDepth = 0;
  const blockStartByIndent = MutableHashMap.empty<number, "map" | "seq">();
  // decision: tabs-as-indentation
  let afterEmptyBlockScalar = false;
  let afterQuotedScalar = false;
  let afterFlowCollectionEnd = false;
  // decision: flow-adjacent-value-indicator
  let prevWasQuoted = false;
  let prevWasFlowEnd = false;
  // decision: block-collection-scopes
  const collectionIndents: number[] = [];
  let nodeStartCol = -1;
  // decision: plain-continuation-lines
  let plainFloor: number | undefined;
  const pending: YamlToken.Data[] = [];
  const state: { currentToken: YamlToken.Data | null } = { currentToken: null };

  function peek(offset = 0): string {
    const idx = pos + offset;
    return Str.slice(idx, idx + 1)(text);
  }

  function charAt(i: number): string {
    return Str.slice(i, i + 1)(text);
  }

  function breakOpensLine(at: number): boolean {
    return text[at] === "\r" || text[at - 1] !== "\r";
  }

  function advanceOne(): void {
    if (text[pos] === "\r" || text[pos] === "\n") {
      if (breakOpensLine(pos)) line++;
      col = 0;
      lineIndent = 0;
      lineIndentLocked = false;
      nodeStartCol = -1;
    } else {
      col++;
    }
    pos++;
  }

  function advance(count = 1): void {
    for (let i = 0; i < count; i++) advanceOne();
  }

  function takeNonemptyPending(): YamlToken.Data {
    const token = A.getUnsafe(pending, 0);
    pending.shift();
    return token;
  }

  function lockLineIndent(): void {
    if (!lineIndentLocked) {
      lineIndent = col;
      lineIndentLocked = true;
      // decision: block-collection-scopes
      for (const key of MutableHashMap.keys(blockStartByIndent)) {
        if (key > lineIndent) {
          MutableHashMap.remove(blockStartByIndent, key);
        }
      }
      if (flowDepth === 0) closeCollectionsAfter(lineIndent);
    }
  }

  function innermostIndent(): number {
    return O.getOrElse(A.last(collectionIndents), () => -1);
  }

  function closeCollectionsAfter(indent: number): void {
    while (innermostIndent() > indent) collectionIndents.pop();
  }

  function openCollectionAt(indent: number): void {
    closeCollectionsAfter(indent);
    if (innermostIndent() !== indent) collectionIndents.push(indent);
  }

  // decision: block-collection-scopes
  function recordIndicatorCollection(kind: YamlTokenKind, column: number): void {
    if (flowDepth > 0) return;
    openCollectionAt(kind === "block-map-value" ? nodeStartCol : column);
    nodeStartCol = -1;
  }

  function parentIndentBefore(column: number): number {
    return O.getOrElse(
      A.findLast(collectionIndents, (indent) => indent < column),
      () => -1
    );
  }

  // decision: plain-continuation-lines
  function continuesPlainAt(ch: string, at: number): boolean {
    const lineStart = lineStartOf(text, at);
    if (plainFloor === undefined || countSpaces(text, lineStart) <= plainFloor) return false;
    if (ch === "#" || plainScalarStopsAt(at)) return false;
    const wouldMakeMultiLineImplicitKey = charAt(plainRunEnd(at)) === ":";
    if (wouldMakeMultiLineImplicitKey) return false;
    return !(at === lineStart && isDocumentMarkerAt(text, at));
  }

  function continuesPlainScalar(ch: string): boolean {
    return !lineIndentLocked && !isStyleIndicator(ch) && continuesPlainAt(ch, pos);
  }

  function nextLineContent(): number {
    let lineStart = lineBreakEnd(text, pos);
    while (lineStart < text.length) {
      const content = blankRunEnd(lineStart);
      if (!isLineEnd(charAt(content))) return content;
      lineStart = lineBreakEnd(text, content);
    }
    return -1;
  }

  function absorbsStyleIndicatorLine(): boolean {
    if (!isNewline(peek())) return false;
    const content = nextLineContent();
    if (content < 0) return false;
    const ch = charAt(content);
    if (!isStyleIndicator(ch) || !continuesPlainAt(ch, content)) return false;
    advance(content - pos);
    lockLineIndent();
    return true;
  }

  const makeToken: {
    (
      value: string,
      offset: number,
      tokenLine: number,
      tokenCol: number,
      rawLength?: number
    ): (kind: YamlTokenKind) => YamlToken.Data;
    (
      kind: YamlTokenKind,
      value: string,
      offset: number,
      tokenLine: number,
      tokenCol: number,
      rawLength?: number
    ): YamlToken.Data;
  } = dual(
    (args) => P.isString(args[1]),
    (
      kind: YamlTokenKind,
      value: string,
      offset: number,
      tokenLine: number,
      tokenCol: number,
      rawLength?: number
    ): YamlToken.Data => ({
      kind,
      value,
      offset,
      length: rawLength ?? value.length,
      line: tokenLine,
      column: tokenCol,
    })
  );

  function isDocumentMarkerAhead(): boolean {
    return isDocumentMarkerAt(text, pos);
  }

  function isPlainScalarBreak(ch: string): boolean {
    if (isLineEnd(ch)) return true;
    return flowDepth > 0 && isFlowIndicator(ch);
  }

  function followsSeparation(): boolean {
    return pos === 0 || col === 0 || isSeparatorOrEnd(charAt(pos - 1));
  }

  function consumeBlanks(): boolean {
    const start = pos;
    while (pos < text.length && isWhitespace(peek())) {
      advance();
    }
    return pos > start;
  }

  function consumeToLineEnd(): void {
    while (pos < text.length && !isNewline(peek())) {
      advance();
    }
  }

  function consumeNameChars(): void {
    while (pos < text.length && isNsAnchorChar(peek())) {
      advance();
    }
  }

  function blankRunEnd(from: number): number {
    let end = from;
    while (end < text.length && (text[end] === " " || text[end] === "\t")) end++;
    return end;
  }

  // decision: block-collection-scopes
  const ensureBlockMap: {
    (indent: number, offset: number, tokLine: number, _tokCol: number): void;
    (offset: number, tokLine: number, _tokCol: number): (indent: number) => void;
  } = dual(4, (indent: number, offset: number, tokLine: number, _tokCol: number): void => {
    if (flowDepth > 0) return;
    const started = O.getOrUndefined(MutableHashMap.get(blockStartByIndent, indent));
    if (started === "map") return;
    if (started === "seq") {
      return;
    }
    MutableHashMap.set(blockStartByIndent, indent, "map");
    pending.push(makeToken("block-map-start", "", offset, tokLine, indent));
  });

  const ensureBlockSeq: {
    (indent: number, offset: number, tokLine: number, _tokCol: number): void;
    (offset: number, tokLine: number, _tokCol: number): (indent: number) => void;
  } = dual(4, (indent: number, offset: number, tokLine: number, _tokCol: number): void => {
    const started = O.getOrUndefined(MutableHashMap.get(blockStartByIndent, indent));
    if (started === "seq") return;
    MutableHashMap.set(blockStartByIndent, indent, "seq");
    pending.push(makeToken("block-seq-start", "", offset, tokLine, indent));
  });

  function openQuotedScalar(): { readonly start: number; readonly sLine: number; readonly sCol: number } {
    lockLineIndent();
    const opened = { start: pos, sLine: line, sCol: col };
    advance();
    return opened;
  }

  function closeQuotedScalar(value: string, start: number, sLine: number, sCol: number): YamlToken.Data {
    advance();
    return makeToken("scalar", value, start, sLine, sCol, pos - start);
  }

  function errorSince(start: number, sLine: number, sCol: number): YamlToken.Data {
    return makeToken("error", Str.slice(start, pos)(text), start, sLine, sCol);
  }

  function whitespaceSince(start: number, sLine: number, sCol: number): YamlToken.Data {
    return makeToken("whitespace", Str.slice(start, pos)(text), start, sLine, sCol);
  }

  function consumeCharToken(kind: YamlTokenKind): YamlToken.Data {
    const start = pos;
    const sLine = line;
    const sCol = col;
    const ch = peek();
    advance();
    return makeToken(kind, ch, start, sLine, sCol);
  }

  function scanSeparation(): { readonly end: number; readonly firstTab: number } {
    const end = blankRunEnd(pos);
    let firstTab = pos;
    while (firstTab < end && text[firstTab] !== "\t") firstTab++;
    return { end, firstTab: firstTab < end ? firstTab : -1 };
  }

  function isContentAt(at: number): boolean {
    return !isNewline(charAt(at));
  }

  function isBlockIndicatorAt(at: number): boolean {
    const nc = text[at];
    return (nc === "-" || nc === "?") && isSeparatorOrEnd(charAt(at + 1));
  }

  // decision: block-collection-scopes
  function blockIndicatorIndent(kind: YamlTokenKind): number {
    const prefix = Str.slice(pos - (col - lineIndent), pos)(text);
    return kind === "block-map-key" && compactKeyPrefix.test(prefix) ? col : lineIndent;
  }

  // decision: tabs-as-indentation
  function scanBlockIndicator(
    kind: YamlTokenKind,
    ensure: typeof ensureBlockMap,
    checkTab: boolean,
    tabIsIndent: (end: number) => boolean
  ): YamlToken.Data {
    lockLineIndent();
    const indent = blockIndicatorIndent(kind);
    const start = pos;
    const sLine = line;
    const sCol = col;
    const indicator = peek();
    recordIndicatorCollection(kind, sCol);
    advance();
    const { end, firstTab } = checkTab ? scanSeparation() : { end: pos, firstTab: -1 };
    if (firstTab >= 0 && end < text.length && tabIsIndent(end)) {
      while (pos < firstTab) advance();
      ensure(indent, start, sLine, sCol);
      pending.push(makeToken(kind, indicator, start, sLine, sCol));
      pending.push(consumeCharToken("error"));
      return takeNonemptyPending();
    }
    ensure(indent, start, sLine, sCol);
    const token = makeToken(kind, indicator, start, sLine, sCol);
    if (pending.length > 0) {
      pending.push(token);
      return takeNonemptyPending();
    }
    return token;
  }

  function consumeLineBreak(ch: string): void {
    if (ch === "\r" && peek(1) === "\n") advance(2);
    else advance();
  }

  function breakReachesDocumentMarker(ch: string): boolean {
    consumeLineBreak(ch);
    return col === 0 && isDocumentMarkerAhead();
  }

  function consumeBlockLineBreak(): void {
    if (pos < text.length) {
      pos = lineBreakEnd(text, pos);
      line++;
      col = 0;
    }
  }

  function flushTrailingLines(lines: Array<string>, trailingNewlines: Array<string>): void {
    for (const nl of trailingNewlines) {
      lines.push(nl);
    }
    trailingNewlines.length = 0;
  }

  function scanNewline(): YamlToken.Data {
    const start = pos;
    const sLine = line;
    const sCol = col;
    if (peek() === "\r" && peek(1) === "\n") {
      advance(2);
      return makeToken("newline", "\r\n", start, sLine, sCol);
    }
    return consumeCharToken("newline");
  }

  // decision: tabs-as-indentation
  function leadingTabIsIndent(): boolean {
    const next = charAt(blankRunEnd(pos));
    if (!afterEmptyBlockScalar && isLineEnd(next)) return false;
    return next !== "{" && next !== "[" && MutableHashMap.size(blockStartByIndent) > 0;
  }

  function flowTabPrecedesContent(): boolean {
    const next = charAt(blankRunEnd(pos));
    return next !== "]" && next !== "}" && !isLineEnd(next);
  }

  function isMixedIndentError(start: number, sCol: number): boolean {
    if (lineIndentLocked || flowDepth !== 0 || sCol !== 0) return false;
    let tab = start;
    while (tab < pos && text[tab] !== "\t") tab++;
    const tabIdx = tab < pos ? tab - start : -1;
    return tabIdx > 0 && !isLineEnd(charAt(pos)) && MutableHashMap.has(blockStartByIndent, tabIdx);
  }

  function scanWhitespace(): YamlToken.Data {
    const start = pos;
    const sLine = line;
    const sCol = col;
    if (!lineIndentLocked && peek() === "\t") {
      const isError = flowDepth === 0 ? leadingTabIsIndent() : flowTabPrecedesContent();
      consumeBlanks();
      return isError ? errorSince(start, sLine, sCol) : whitespaceSince(start, sLine, sCol);
    }
    consumeBlanks();
    return isMixedIndentError(start, sCol) ? errorSince(start, sLine, sCol) : whitespaceSince(start, sLine, sCol);
  }

  function scanComment(): YamlToken.Data {
    lockLineIndent();
    const start = pos;
    const sLine = line;
    const sCol = col;
    consumeToLineEnd();
    return makeToken("comment", Str.slice(start, pos)(text), start, sLine, sCol);
  }

  function scanDocumentStartOrEnd(): YamlToken.Data | null {
    lockLineIndent();
    const start = pos;
    const sLine = line;
    const sCol = col;
    const marker = Str.slice(pos, pos + 3)(text);
    if (!isSeparatorOrEnd(charAt(pos + 3))) {
      return null;
    }
    advance(3);
    const kind = marker === "---" ? "document-start" : "document-end";
    // decision: block-collection-scopes
    MutableHashMap.clear(blockStartByIndent);
    collectionIndents.length = 0;
    return makeToken(kind, marker, start, sLine, sCol);
  }

  function plainScalarStopsAt(at: number): boolean {
    const ch = charAt(at);
    if (isPlainScalarBreak(ch)) return true;
    const next = charAt(at + 1);
    if (ch === ":") return isPlainColonStop(next);
    return isWhitespace(ch) && next === "#";
  }

  function isPlainColonStop(next: string): boolean {
    return isSeparatorOrEnd(next) || (flowDepth > 0 && isFlowIndicator(next));
  }

  function plainRunEnd(from: number): number {
    let at = from;
    while (at < text.length && !plainScalarStopsAt(at)) at++;
    return at;
  }

  // decision: plain-continuation-lines
  function scanPlainScalar(): YamlToken.Data {
    lockLineIndent();
    const start = pos;
    const sLine = line;
    const sCol = col;

    do {
      advance(plainRunEnd(pos) - pos);
    } while (absorbsStyleIndicatorLine());

    let end = pos;
    while (end > start && isWhitespace(charAt(end - 1))) {
      end--;
    }

    col -= pos - end;
    pos = end;
    const value = Str.slice(start, end)(text);
    return makeToken("scalar", value, start, sLine, sCol);
  }

  function scanQuotedScalar(
    closes: (ch: string) => boolean,
    pieceOf: (ch: string, sCol: number) => string | null
  ): YamlToken.Data {
    const { start, sLine, sCol } = openQuotedScalar();
    let value = "";
    while (pos < text.length) {
      const ch = peek();
      if (closes(ch)) return closeQuotedScalar(value, start, sLine, sCol);
      const piece = pieceOf(ch, sCol);
      if (piece === null) return errorSince(start, sLine, sCol);
      value += piece;
    }
    return errorSince(start, sLine, sCol);
  }

  function quotedLineFold(ch: string): string | null {
    return breakReachesDocumentMarker(ch) ? null : " ";
  }

  function closesSingleQuoted(ch: string): boolean {
    return ch === "'" && peek(1) !== "'";
  }

  function singleQuotedPiece(ch: string): string | null {
    if (ch === "'") {
      advance(2);
      return "'";
    }
    if (isNewline(ch)) return quotedLineFold(ch);
    advance();
    return ch;
  }

  function scanSingleQuotedScalar(): YamlToken.Data {
    return scanQuotedScalar(closesSingleQuoted, singleQuotedPiece);
  }

  function closesDoubleQuoted(ch: string): boolean {
    return ch === '"';
  }

  function scanHexEscape(width: number): string | null {
    advance();
    const hex = Str.slice(pos, pos + width)(text);
    const cp = hex.length === width && /^[\da-fA-F]+$/.test(hex) ? Number.parseInt(hex, 16) : Number.NaN;
    if (!(cp <= 0x10ffff)) return null;
    advance(width);
    return String.fromCodePoint(cp);
  }

  function scanEscape(): string | null {
    advance();
    const esc = peek();
    const simple = R.get(singleCharacterEscapes, esc);
    if (O.isSome(simple)) {
      advance();
      return simple.value;
    }
    const width = R.get(hexEscapeWidths, esc);
    if (O.isSome(width)) return scanHexEscape(width.value);
    if (!isNewline(esc)) return null;
    consumeLineBreak(esc);
    consumeBlanks();
    return "";
  }

  // decision: tabs-as-indentation
  function doubleQuotedLineFold(ch: string, sCol: number): string | null {
    const folded = quotedLineFold(ch);
    if (folded === null || sCol === 0 || peek() !== "\t") return folded;
    advance();
    return null;
  }

  function doubleQuotedPiece(ch: string, sCol: number): string | null {
    if (ch === "\\") return scanEscape();
    if (isNewline(ch)) return doubleQuotedLineFold(ch, sCol);
    advance();
    return ch;
  }

  function scanDoubleQuotedScalar(): YamlToken.Data {
    return scanQuotedScalar(closesDoubleQuoted, doubleQuotedPiece);
  }

  function scanBlockScalarHeader(): { readonly chomp: ScalarChomp; readonly explicitIndent: number } {
    let chomp: ScalarChomp = "clip";
    let explicitIndent = 0;
    for (let hc = 0; hc < 2; hc++) {
      const ch = peek();
      const chompOf: O.Option<ScalarChomp> = chomp === "clip" ? R.get(chompIndicators, ch) : O.none();
      if (O.isSome(chompOf)) chomp = chompOf.value;
      else if (explicitIndent === 0 && isIndentIndicator(ch)) explicitIndent = Number.parseInt(ch, 10);
      else break;
      advance();
    }
    return { chomp, explicitIndent };
  }

  // decision: block-scalar-header-recovery
  function skipInvalidHeaderText(): void {
    let quote = "";
    while (!isLineEnd(peek())) {
      const ch = peek();
      if (quote === "" && ch === "#" && isWhitespace(charAt(pos - 1))) return;
      const width = headerTextWidth(ch, quote);
      if (width === 1) quote = toggledQuote(ch, quote);
      advance(width);
    }
  }

  function headerTextWidth(ch: string, quote: string): number {
    if (quote === '"' && ch === "\\") return isLineEnd(peek(1)) ? 1 : 2;
    return quote === "'" && ch === "'" && peek(1) === "'" ? 2 : 1;
  }

  function scanBlockHeaderTail(start: number, sLine: number, sCol: number): YamlToken.Data | null {
    const hadHeaderWhitespace = consumeBlanks();
    if (isLineEnd(peek())) return null;
    if (peek() === "#" && hadHeaderWhitespace) {
      consumeToLineEnd();
      return null;
    }
    skipInvalidHeaderText();
    const error = errorSince(start, sLine, sCol);
    if (peek() === "#") pending.push(scanComment());
    return error;
  }

  // decision: block-scalar-indentation
  function blockParentIndent(start: number): number {
    let scanBack = start - 1;
    while (scanBack >= 0 && (text[scanBack] === " " || text[scanBack] === "\t")) {
      scanBack--;
    }
    const before = charAt(scanBack);
    if (before === ":") return findKeyIndent(text, scanBack);
    if (before === "-") return scanBack - lineStartOf(text, scanBack);
    let maxBlockIndent = 0;
    for (const key of MutableHashMap.keys(blockStartByIndent)) {
      maxBlockIndent = Math.max(maxBlockIndent, key);
    }
    return maxBlockIndent;
  }

  function blockContentIndent(start: number, explicitIndent: number): number {
    return explicitIndent > 0 ? blockParentIndent(start) + explicitIndent : detectBlockIndent(text, pos);
  }

  function consumeKeptEmptyLines(): number {
    let count = 0;
    while (pos < text.length) {
      consumeRawBlanks();
      if (pos >= text.length) return Math.max(count, minimumKeptLinesAtWhitespaceOnlyEof);
      if (!isNewline(charAt(pos))) return count;
      count++;
      consumeBlockLineBreak();
    }
    return count;
  }

  function emptyBlockScalar(chomp: ScalarChomp, start: number, sLine: number, sCol: number): YamlToken.Data {
    if (chomp === "keep") {
      const value = Str.repeat(consumeKeptEmptyLines())("\n");
      return makeToken("scalar", value, start, sLine, sCol, pos - start);
    }
    afterEmptyBlockScalar = true;
    return makeToken("scalar", "", start, sLine, sCol, pos - start);
  }

  function consumeRawBlanks(): void {
    const end = blankRunEnd(pos);
    col += end - pos;
    pos = end;
  }

  function consumeRawSpaces(): number {
    const lineStart = pos;
    while (pos < text.length && text[pos] === " ") {
      pos++;
      col++;
    }
    return pos - lineStart;
  }

  function consumeRawLine(): string {
    const contentStart = pos;
    while (pos < text.length && text[pos] !== "\n" && text[pos] !== "\r") {
      pos++;
      col++;
    }
    return Str.slice(contentStart, pos)(text);
  }

  function endsBlockBody(spaces: number, blank: boolean, contentIndent: number): boolean {
    const columnZeroMarkerEndsBodyAtAnyIndent = spaces === 0 && isDocumentMarkerAt(text, pos);
    if (columnZeroMarkerEndsBodyAtAnyIndent) return true;
    return !blank && spaces < contentIndent;
  }

  function collectBlockLine(contentIndent: number, lines: Array<string>, trailingNewlines: Array<string>): boolean {
    const lineStart = pos;
    const spaces = consumeRawSpaces();
    const blank = isLineEnd(charAt(pos));
    if (endsBlockBody(spaces, blank, contentIndent)) {
      pos = lineStart;
      col = 0;
      return false;
    }
    const isEmptyLine = blank && spaces <= contentIndent;
    if (isEmptyLine) {
      trailingNewlines.push("");
    } else {
      flushTrailingLines(lines, trailingNewlines);
      lines.push(Str.repeat(spaces - contentIndent)(" ") + (blank ? "" : consumeRawLine()));
    }
    consumeBlockLineBreak();
    return true;
  }

  function scanBlockScalar(): YamlToken.Data {
    lockLineIndent();
    const start = pos;
    const sLine = line;
    const sCol = col;
    const isFolded = peek() === ">";
    advance();

    const { chomp, explicitIndent } = scanBlockScalarHeader();
    const headerError = scanBlockHeaderTail(start, sLine, sCol);
    if (headerError !== null) return headerError;

    if (isNewline(peek())) consumeLineBreak(peek());

    const contentIndent = blockContentIndent(start, explicitIndent);
    // decision: block-scalar-indentation
    if (contentIndent < 0 || (contentIndent === 0 && MutableHashMap.size(blockStartByIndent) > 0)) {
      return emptyBlockScalar(chomp, start, sLine, sCol);
    }

    const lines: Array<string> = [];
    const trailingNewlines: Array<string> = [];
    let more = true;
    while (more && pos < text.length) {
      more = collectBlockLine(contentIndent, lines, trailingNewlines);
    }

    const body = isFolded ? foldBlockLines(lines) : A.join(lines, "\n");
    return makeToken("scalar", chompBlockValue(body, chomp, trailingNewlines.length), start, sLine, sCol, pos - start);
  }

  function scanNodeName(kind: "anchor" | "alias"): YamlToken.Data {
    lockLineIndent();
    const start = pos;
    const sLine = line;
    const sCol = col;
    advance();
    const nameStart = pos;
    consumeNameChars();
    const name = Str.slice(nameStart, pos)(text);
    if (name.length === 0) {
      return errorSince(start, sLine, sCol);
    }
    return makeToken(kind, name, start, sLine, sCol, pos - start);
  }

  function scanVerbatimTag(start: number, sLine: number, sCol: number): YamlToken.Data {
    advance();
    while (pos < text.length && peek() !== ">") {
      if (isNewline(peek())) return errorSince(start, sLine, sCol);
      advance();
    }
    if (peek() !== ">") return errorSince(start, sLine, sCol);
    advance();
    return makeToken("tag", Str.slice(start, pos)(text), start, sLine, sCol);
  }

  function scanTag(): YamlToken.Data {
    lockLineIndent();
    const start = pos;
    const sLine = line;
    const sCol = col;
    advance();

    if (peek() === "<") return scanVerbatimTag(start, sLine, sCol);

    if (peek() === "!") {
      advance();
    }

    consumeNameChars();

    return makeToken("tag", Str.slice(start, pos)(text), start, sLine, sCol);
  }

  function scanDirective(): YamlToken.Data {
    lockLineIndent();
    const start = pos;
    const sLine = line;
    const sCol = col;
    consumeToLineEnd();
    return makeToken("directive", Str.slice(start, pos)(text), start, sLine, sCol);
  }

  // decision: flow-adjacent-value-indicator
  function scanHash(): YamlToken.Data | null {
    if (followsSeparation()) return scanComment();
    return prevWasQuoted ? consumeCharToken("error") : null;
  }

  function scanMarkerAtLineStart(marker: string): YamlToken.Data | null {
    return col === 0 && Str.slice(pos, pos + marker.length)(text) === marker ? scanDocumentStartOrEnd() : null;
  }

  // decision: tabs-as-indentation
  function scanDash(): YamlToken.Data | null {
    const marker = scanMarkerAtLineStart("---");
    if (marker !== null) return marker;
    if (!isSeparatorOrEnd(peek(1)) || flowDepth !== 0) return null;
    return scanBlockIndicator("block-seq-entry", ensureBlockSeq, true, isBlockIndicatorAt);
  }

  function scanDot(): YamlToken.Data | null {
    return scanMarkerAtLineStart("...");
  }

  function scanPercent(): YamlToken.Data | null {
    return col === 0 && flowDepth === 0 ? scanDirective() : null;
  }

  // decision: block-scalar-header-recovery
  function scanBlockScalarIndicator(): YamlToken.Data | null {
    return flowDepth === 0 && isBlockScalarHeaderStart(peek(1)) ? scanBlockScalar() : null;
  }

  function scanFlowOpen(kind: YamlTokenKind): YamlToken.Data {
    lockLineIndent();
    flowDepth++;
    return consumeCharToken(kind);
  }

  function scanFlowClose(kind: YamlTokenKind): YamlToken.Data {
    lockLineIndent();
    if (flowDepth > 0) flowDepth--;
    afterFlowCollectionEnd = true;
    return consumeCharToken(kind);
  }

  function scanComma(): YamlToken.Data {
    lockLineIndent();
    const malformedOutsideFlow = flowDepth === 0;
    return consumeCharToken(malformedOutsideFlow ? "error" : "flow-separator");
  }

  // decision: tabs-as-indentation
  function scanQuestion(): YamlToken.Data | null {
    if (!isSeparatorOrEnd(peek(1))) return null;
    return scanBlockIndicator("block-map-key", ensureBlockMap, flowDepth === 0, isContentAt);
  }

  // decision: flow-adjacent-value-indicator
  function isValueIndicator(): boolean {
    const next = peek(1);
    if (isSeparatorOrEnd(next)) return true;
    return flowDepth > 0 && (isFlowIndicator(next) || prevWasQuoted || prevWasFlowEnd);
  }

  // decision: tabs-as-indentation
  function scanColon(): YamlToken.Data | null {
    if (!isValueIndicator()) return null;
    return scanBlockIndicator("block-map-value", ensureBlockMap, flowDepth === 0, isBlockIndicatorAt);
  }

  function scanSingleQuoted(): YamlToken.Data {
    afterQuotedScalar = true;
    return scanSingleQuotedScalar();
  }

  function scanDoubleQuoted(): YamlToken.Data {
    afterQuotedScalar = true;
    return scanDoubleQuotedScalar();
  }

  const contentScanners: Readonly<Record<string, () => YamlToken.Data | null>> = {
    "#": scanHash,
    "-": scanDash,
    ".": scanDot,
    "%": scanPercent,
    "|": scanBlockScalarIndicator,
    ">": scanBlockScalarIndicator,
    "{": () => scanFlowOpen("flow-map-start"),
    "}": () => scanFlowClose("flow-map-end"),
    "[": () => scanFlowOpen("flow-seq-start"),
    "]": () => scanFlowClose("flow-seq-end"),
    ",": scanComma,
    "&": () => scanNodeName("anchor"),
    "*": () => scanNodeName("alias"),
    "!": scanTag,
    "?": scanQuestion,
    ":": scanColon,
    "'": scanSingleQuoted,
    '"': scanDoubleQuoted,
  };

  // decision: plain-continuation-lines
  function scanContent(ch: string): YamlToken.Data {
    if (continuesPlainScalar(ch)) return scanPlainFallback();
    if (ch !== "#" && nodeStartCol < 0) nodeStartCol = col;
    plainFloor = undefined;
    const scanner = R.get(contentScanners, ch);
    const token = O.isSome(scanner) ? scanner.value() : null;
    if (token !== null) return token;
    lockLineIndent();
    plainFloor = parentIndentBefore(col);
    return scanPlainFallback();
  }

  function scanPlainFallback(): YamlToken.Data {
    afterQuotedScalar = false;
    return scanPlainScalar();
  }

  // decision: bom-occupies-no-column
  function scanByteOrderMark(): YamlToken.Data {
    const start = pos;
    pos++;
    return makeToken("byte-order-mark", "﻿", start, line, col);
  }

  // decision: flow-adjacent-value-indicator
  function rollTokenFlags(ch: string): void {
    prevWasQuoted = afterQuotedScalar;
    prevWasFlowEnd = afterFlowCollectionEnd;
    const isFlowTrivia = isWhitespace(ch) || isNewline(ch) || (ch === "#" && followsSeparation());
    if (flowDepth === 0 || !isFlowTrivia) {
      afterQuotedScalar = false;
      afterFlowCollectionEnd = false;
    }
  }

  function scanNext(): YamlToken.Data | null {
    if (pending.length > 0) return takeNonemptyPending();
    if (pos >= text.length) return null;

    const ch = peek();
    rollTokenFlags(ch);
    if (ch === "﻿") return scanByteOrderMark();
    if (isNewline(ch)) return scanNewline();
    if (isWhitespace(ch)) return scanWhitespace();

    // decision: tabs-as-indentation
    afterEmptyBlockScalar = false;
    return scanContent(ch);
  }

  // decision: bom-occupies-no-column
  function replayChar(): void {
    const ch = text[pos];
    if (ch === "\r" || ch === "\n") {
      if (breakOpensLine(pos)) line++;
      col = 0;
    } else if (ch !== "﻿") {
      col++;
    }
    pos++;
  }

  function resetStateExceptCursor(): void {
    lineIndent = 0;
    lineIndentLocked = false;
    flowDepth = 0;
    MutableHashMap.clear(blockStartByIndent);
    collectionIndents.length = 0;
    nodeStartCol = -1;
    plainFloor = undefined;
    pending.length = 0;
    afterEmptyBlockScalar = false;
    afterQuotedScalar = false;
    afterFlowCollectionEnd = false;
    state.currentToken = null;
  }

  return {
    scan(): YamlTokenKind | null {
      const token = scanNext();
      state.currentToken = token;
      return token === null ? null : token.kind;
    },
    getToken(): YamlTokenKind | null {
      return state.currentToken === null ? null : state.currentToken.kind;
    },
    getTokenValue(): string {
      return state.currentToken === null ? "" : state.currentToken.value;
    },
    getTokenOffset(): number {
      return state.currentToken === null ? 0 : state.currentToken.offset;
    },
    getTokenLength(): number {
      return state.currentToken === null ? 0 : state.currentToken.length;
    },
    getTokenLine(): number {
      return state.currentToken === null ? 0 : state.currentToken.line;
    },
    getTokenColumn(): number {
      return state.currentToken === null ? 0 : state.currentToken.column;
    },
    getPosition(): number {
      return pos;
    },
    setPosition(newPos: number): void {
      pos = 0;
      line = 0;
      col = 0;
      while (pos < newPos && pos < text.length) replayChar();
      resetStateExceptCursor();
    },
  };
}

/**
 * Tokenize a YAML source string into an array of {@link YamlToken.Data} records.
 *
 * **Details**
 *
 * Lexer errors are embedded as `"error"` tokens in the result; the downstream
 * parser/composer collects them and records diagnostics as needed.
 *
 * **Example** (Collect source tokens)
 *
 * ```ts
 * import { lexAll } from "@beep/yaml/internal/lexer"
 *
 * const tokens = lexAll("hello")
 * console.log(tokens.length) // 1
 * console.log(tokens[0]?.value) // hello
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function lexAll(text: string): ReadonlyArray<YamlToken.Data> {
  const scanner = createScanner(text);
  const tokens: YamlToken.Data[] = [];
  let kind = scanner.scan();
  while (kind !== null) {
    tokens.push({
      kind,
      value: scanner.getTokenValue(),
      offset: scanner.getTokenOffset(),
      length: scanner.getTokenLength(),
      line: scanner.getTokenLine(),
      column: scanner.getTokenColumn(),
    });
    kind = scanner.scan();
  }
  return tokens;
}
