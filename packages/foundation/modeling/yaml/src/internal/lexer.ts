// YAML 1.2 lexer — tokenizes raw YAML text into YamlToken records.
//
// This is the only mutable module in the pipeline: the scanner uses
// imperative character-by-character scanning with position tracking.
// `createScanner` IS the state machine; `lexAll` drives it to completion.

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

/** YAML's single-character escape substitutions; other escapes require scanning. */
const simpleEscapes: Readonly<Record<string, string>> = {
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

/** Fixed-width hex escapes: the escape letter and its hex digit count. */
const hexEscapeWidths: Readonly<Record<string, number>> = { x: 2, u: 4, U: 8 };

/** Block scalar chomping indicators. */
const chompIndicators: Readonly<Record<string, ScalarChomp>> = { "-": "strip", "+": "keep" };

// ---------------------------------------------------------------------------
// Character classes (pure)
// ---------------------------------------------------------------------------

const isWhitespace = (ch: string): boolean => ch === " " || ch === "\t";

const isNewline = (ch: string): boolean => ch === "\n" || ch === "\r";

/** A line break or the end of input (`""` from an out-of-range slice). */
const isLineEnd = (ch: string): boolean => ch === "" || isNewline(ch);

/** Separation after an indicator or marker: a blank, a line break, or the end of input. */
const isSeparatorOrEnd = (ch: string): boolean => isLineEnd(ch) || isWhitespace(ch);

const isFlowIndicator = (ch: string): boolean => ch === "{" || ch === "}" || ch === "[" || ch === "]" || ch === ",";

/** A first character the parser reads as a scalar's style: a quote or a block-scalar indicator. */
const isStyleIndicator = (ch: string): boolean => ch === '"' || ch === "'" || ch === "|" || ch === ">";

/** YAML 1.2 ns-anchor-char (and tag suffix char): any non-whitespace char except c-flow-indicator. */
const isNameChar = (ch: string): boolean => !isWhitespace(ch) && !isNewline(ch) && !isFlowIndicator(ch);

/** A block scalar indentation indicator digit (`1`–`9`). */
const isIndentIndicator = (ch: string): boolean => ch.length === 1 && ch >= "1" && ch <= "9";

/** What may follow `|` / `>` for it to open a block scalar header (0 included so `|0` is rejected by the header). */
const blockHeaderCharacter = /[-+#0-9]/;

const isBlockScalarHeaderStart = (next: string): boolean =>
  isSeparatorOrEnd(next) || (next.length === 1 && blockHeaderCharacter.test(next));

/** Block indicators and their separation: all that may precede a compact explicit key on its line. */
const compactKeyPrefix = /^(?:[-?:][ \t]+)+$/;

// ---------------------------------------------------------------------------
// Source probes (pure)
// ---------------------------------------------------------------------------

/** True when a document marker (--- or ...) followed by whitespace, a line break or EOF starts at `at`. */
const isDocumentMarkerAt = (text: string, at: number): boolean => {
  const head = Str.slice(at, at + 3)(text);
  return (head === "---" || head === "...") && isSeparatorOrEnd(Str.slice(at + 3, at + 4)(text));
};

/** The offset after the line break at `at` (CRLF as one break). */
const lineBreakEnd = (text: string, at: number): number =>
  text[at] === "\r" && text[at + 1] === "\n" ? at + 2 : at + 1;

/** The offset where the line containing `at` starts. */
const lineStartOf = (text: string, at: number): number => {
  let lineStart = at;
  while (lineStart > 0 && !isNewline(Str.slice(lineStart - 1, lineStart)(text))) {
    lineStart--;
  }
  return lineStart;
};

/** The number of spaces starting at `at`. */
const countSpaces = (text: string, at: number): number => {
  let spaces = 0;
  while (text[at + spaces] === " ") spaces++;
  return spaces;
};

/**
 * Auto-detect a block scalar's content indentation from its first non-empty
 * line at or after `from`, or `-1` when there is none: blank lines are
 * skipped, and a column-0 document marker terminates the body.
 */
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

/**
 * The quote state after `ch` in invalid block-scalar header text: a quote
 * character opens a quote when none is open and closes its own kind; the
 * other kind inside an open quote is literal.
 */
const toggledQuote = (ch: string, quote: string): string => {
  if (ch !== "'" && ch !== '"') return quote;
  if (quote === "") return ch;
  return quote === ch ? "" : quote;
};

/** Apply a block scalar's chomping: strip drops the final break, clip keeps one, keep also keeps trailing empty lines. */
const chompBlockValue = (body: string, chomp: ScalarChomp, trailingEmptyLines: number): string => {
  if (chomp === "strip") return body;
  return body + Str.repeat(chomp === "keep" ? trailingEmptyLines + 1 : 1)("\n");
};

// ---------------------------------------------------------------------------
// Scanner (mutable, imperative)
// ---------------------------------------------------------------------------

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
  /**
   * The indentation level of the current line. Set to `col` when we encounter
   * the first non-whitespace character after a newline (or at start of input).
   */
  let lineIndent = 0;
  /** Whether `lineIndent` has been locked (set) for the current line. */
  let lineIndentLocked = false;
  /** Flow nesting depth (positive means we are inside flow context). */
  let flowDepth = 0;
  /** Whether we've emitted block-map-start / block-seq-start for the current indent. */
  const blockStarted = MutableHashMap.empty<number, "map" | "seq">();
  /** Set when the block scalar scanner produces an empty value (contentIndent === 0). */
  let afterEmptyBlockScalar = false;
  /** Set when the previous token was a quoted scalar (single or double quoted). */
  let afterQuotedScalar = false;
  let afterFlowCollectionEnd = false;
  /**
   * `afterQuotedScalar` / `afterFlowCollectionEnd` as they stood before the
   * token being scanned; the `:` and `#` handlers read them.
   */
  let prevWasQuoted = false;
  let prevWasFlowEnd = false;
  /**
   * Indents of the open block collections, ascending: the column of a `-` or
   * `?` indicator, or of the key that an implicit `:` closes (so a compact
   * `- a: x` mapping records column 2, not the line indent).
   */
  const collectionIndents: number[] = [];
  /**
   * Column where the current line's node started (its first content token
   * after the line start or the last block indicator); `-1` until then.
   */
  let nodeStartCol = -1;
  /**
   * While the last content token was a plain scalar, the indent `n` of its
   * parent collection (`-1` at the document root); `undefined` otherwise. A
   * later line indented past `n` continues the scalar (YAML 1.2
   * s-ns-plain-next-line), whatever character it starts with.
   */
  let plainFloor: number | undefined;
  /** Buffer of tokens to emit before scanning the next real token. */
  const pending: YamlToken.Data[] = [];
  /** Mutable holder for the most recently produced token, set by the public {@link scan} method. */
  const state: { currentToken: YamlToken.Data | null } = { currentToken: null };

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function peek(offset = 0): string {
    const idx = pos + offset;
    return Str.slice(idx, idx + 1)(text);
  }

  function charAt(i: number): string {
    return Str.slice(i, i + 1)(text);
  }

  /** True when the line break at `at` opens a new line (the LF of a CRLF pair does not). */
  function breakOpensLine(at: number): boolean {
    return text[at] === "\r" || text[at - 1] !== "\r";
  }

  /** Consume one character, tracking line, column and the line-indent lock. */
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

  /** Called only after testing or populating the nonempty pending queue. */
  function takePending(): YamlToken.Data {
    const token = A.getUnsafe(pending, 0);
    pending.shift();
    return token;
  }

  /** Lock the line indent to the current column (called on first non-ws char). */
  function lockLineIndent(): void {
    if (!lineIndentLocked) {
      lineIndent = col;
      lineIndentLocked = true;
      // When dedenting, clear blockStarted entries for indentation levels
      // deeper than the current line. This allows the same indent level
      // to start a new block scope after returning from deeper nesting.
      for (const key of MutableHashMap.keys(blockStarted)) {
        if (key > lineIndent) {
          MutableHashMap.remove(blockStarted, key);
        }
      }
      if (flowDepth === 0) closeCollectionsAfter(lineIndent);
    }
  }

  /** The indent of the innermost open collection, or `-1` when none is open. */
  function innermostIndent(): number {
    return O.getOrElse(A.last(collectionIndents), () => -1);
  }

  /** Drop the open collections indented deeper than `indent`. */
  function closeCollectionsAfter(indent: number): void {
    while (innermostIndent() > indent) collectionIndents.pop();
  }

  /** Record a block collection at `indent` (a `-`/`?` column or an implicit key's column). */
  function openCollectionAt(indent: number): void {
    closeCollectionsAfter(indent);
    if (innermostIndent() !== indent) collectionIndents.push(indent);
  }

  /**
   * Record the block collection a `-`, `?` or `:` indicator at `column` opens
   * or continues. A `:` belongs to the key that opened its mapping at the
   * key's column (the `:` itself when it starts the node, as an explicit
   * value does).
   */
  function recordIndicatorCollection(kind: YamlTokenKind, column: number): void {
    if (flowDepth > 0) return;
    openCollectionAt(kind === "block-map-value" ? nodeStartCol : column);
    nodeStartCol = -1;
  }

  /** The indent of the innermost open collection left of `column`, or `-1` at the document root. */
  function parentIndentBefore(column: number): number {
    return O.getOrElse(
      A.findLast(collectionIndents, (indent) => indent < column),
      () => -1
    );
  }

  /**
   * Whether `ch`, the first content at offset `at` on its line, continues the
   * open plain scalar (YAML 1.2 s-ns-plain-next-line): the line's indentation
   * (spaces only; separation blanks, tabs included, may follow it) reaches
   * past the scalar's parent collection, and `ch` is an ns-plain-char, so
   * indicators are scalar text. A comment, a `: ` value indicator, a flow
   * indicator inside flow context and a line-start document marker still end
   * the scalar.
   */
  function continuesPlainAt(ch: string, at: number): boolean {
    const lineStart = lineStartOf(text, at);
    if (plainFloor === undefined || countSpaces(text, lineStart) <= plainFloor) return false;
    if (ch === "#" || plainScalarStopsAt(at)) return false;
    // A line whose run ends at a `:` value indicator would make a multi-line
    // implicit key, which is invalid: the indicator scanners keep its diagnostic.
    if (charAt(plainRunEnd(at)) === ":") return false;
    return !(at === lineStart && isDocumentMarkerAt(text, at));
  }

  /**
   * Whether the line's first content at the cursor continues the open plain
   * scalar as its own token. Quote and block-scalar indicators are excluded:
   * the parser reads a scalar's style from its first source character, so
   * {@link scanPlainScalar} absorbs those lines into the scalar's token.
   */
  function continuesPlainScalar(ch: string): boolean {
    return !lineIndentLocked && !isStyleIndicator(ch) && continuesPlainAt(ch, pos);
  }

  /**
   * The offset of the first content character on the next non-blank line
   * after the line break at the cursor, past its leading spaces and tabs, or
   * `-1` at the end of input.
   */
  function nextLineContent(): number {
    let lineStart = lineBreakEnd(text, pos);
    while (lineStart < text.length) {
      const content = blankRunEnd(lineStart);
      if (!isLineEnd(charAt(content))) return content;
      lineStart = lineBreakEnd(text, content);
    }
    return -1;
  }

  /**
   * Consume the line break, blank lines and indentation before a
   * continuation line that starts with a quote or block-scalar indicator, so
   * the open plain scalar's token runs on through that line.
   */
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

  /**
   * Check if the current position starts a document marker (--- or ...)
   * followed by whitespace, newline, or EOF. Used inside quoted scalars
   * to detect unterminated strings broken by document boundaries.
   */
  function isDocumentMarkerAhead(): boolean {
    return isDocumentMarkerAt(text, pos);
  }

  /**
   * Returns true if `ch` cannot appear in a plain scalar at the current position.
   */
  function isPlainScalarBreak(ch: string): boolean {
    if (isLineEnd(ch)) return true;
    return flowDepth > 0 && isFlowIndicator(ch);
  }

  /** True when the cursor follows separation: input start, a line start, or a blank or line break. */
  function followsSeparation(): boolean {
    return pos === 0 || col === 0 || isSeparatorOrEnd(charAt(pos - 1));
  }

  /** Consume the run of spaces and tabs at the cursor; true when it was nonempty. */
  function consumeBlanks(): boolean {
    const start = pos;
    while (pos < text.length && isWhitespace(peek())) {
      advance();
    }
    return pos > start;
  }

  /** Consume up to (not including) the next line break or the end of input. */
  function consumeToLineEnd(): void {
    while (pos < text.length && !isNewline(peek())) {
      advance();
    }
  }

  /** Consume the characters of an anchor, alias or tag name. */
  function consumeNameChars(): void {
    while (pos < text.length && isNameChar(peek())) {
      advance();
    }
  }

  /** The first offset at or after `from` past a run of spaces and tabs. */
  function blankRunEnd(from: number): number {
    let end = from;
    while (end < text.length && (text[end] === " " || text[end] === "\t")) end++;
    return end;
  }

  // -----------------------------------------------------------------------
  // Block-structure helpers
  // -----------------------------------------------------------------------

  const ensureBlockMap: {
    (indent: number, offset: number, tokLine: number, _tokCol: number): void;
    (offset: number, tokLine: number, _tokCol: number): (indent: number) => void;
  } = dual(4, (indent: number, offset: number, tokLine: number, _tokCol: number): void => {
    if (flowDepth > 0) return;
    const started = O.getOrUndefined(MutableHashMap.get(blockStarted, indent));
    if (started === "map") return;
    if (started === "seq") {
      // switch from seq to map not supported in same indent; ignore
      return;
    }
    MutableHashMap.set(blockStarted, indent, "map");
    // Use `indent` (the line indent) as the column for the zero-width
    // block-map-start marker so the parser can correctly determine which
    // block scope this mapping belongs to.
    pending.push(makeToken("block-map-start", "", offset, tokLine, indent));
  });

  const ensureBlockSeq: {
    (indent: number, offset: number, tokLine: number, _tokCol: number): void;
    (offset: number, tokLine: number, _tokCol: number): (indent: number) => void;
  } = dual(4, (indent: number, offset: number, tokLine: number, _tokCol: number): void => {
    const started = O.getOrUndefined(MutableHashMap.get(blockStarted, indent));
    if (started === "seq") return;
    MutableHashMap.set(blockStarted, indent, "seq");
    // Use `indent` as the column for consistency with ensureBlockMap.
    pending.push(makeToken("block-seq-start", "", offset, tokLine, indent));
  });

  /** Lock the line indent, record where a quoted scalar starts, and consume its opening quote. */
  function openQuotedScalar(): { readonly start: number; readonly sLine: number; readonly sCol: number } {
    lockLineIndent();
    const opened = { start: pos, sLine: line, sCol: col };
    advance(); // skip opening quote
    return opened;
  }

  /** Consume a quoted scalar's closing quote and emit it, spanning the raw source including both quotes. */
  function closeQuotedScalar(value: string, start: number, sLine: number, sCol: number): YamlToken.Data {
    advance();
    return makeToken("scalar", value, start, sLine, sCol, pos - start);
  }

  /** An `error` token spanning the source from `start` to the cursor. */
  function errorSince(start: number, sLine: number, sCol: number): YamlToken.Data {
    return makeToken("error", Str.slice(start, pos)(text), start, sLine, sCol);
  }

  /** A `whitespace` token spanning the source from `start` to the cursor. */
  function whitespaceSince(start: number, sLine: number, sCol: number): YamlToken.Data {
    return makeToken("whitespace", Str.slice(start, pos)(text), start, sLine, sCol);
  }

  /** Consume the single character at the cursor as a token of `kind`. */
  function consumeCharToken(kind: YamlTokenKind): YamlToken.Data {
    const start = pos;
    const sLine = line;
    const sCol = col;
    const ch = peek();
    advance();
    return makeToken(kind, ch, start, sLine, sCol);
  }

  /**
   * The separation run after an indicator: the first offset past its spaces
   * and tabs, and the first tab inside the run (`-1` when there is none).
   */
  function scanSeparation(): { readonly end: number; readonly firstTab: number } {
    const end = blankRunEnd(pos);
    let firstTab = pos;
    while (firstTab < end && text[firstTab] !== "\t") firstTab++;
    return { end, firstTab: firstTab < end ? firstTab : -1 };
  }

  /** True when the character at `at` is content rather than a line break. */
  function isContentAt(at: number): boolean {
    return !isNewline(charAt(at));
  }

  /** True when a block indicator (`-` or `?` followed by a separator or the end of input) starts at `at`. */
  function isBlockIndicatorAt(at: number): boolean {
    const nc = text[at];
    return (nc === "-" || nc === "?") && isSeparatorOrEnd(charAt(at + 1));
  }

  /**
   * The indent the block indicator at the cursor opens its scope at: the line
   * indent, except for a compact explicit key (`- ? k`, `? ? k`, `: ? k`). That
   * line indent belongs to the enclosing collection, so the key's mapping opens
   * at the `?` itself; otherwise its start marker is lost and it opens only at
   * its first `:`, behind its own key.
   */
  function blockIndicatorIndent(kind: YamlTokenKind): number {
    const prefix = Str.slice(pos - (col - lineIndent), pos)(text);
    return kind === "block-map-key" && compactKeyPrefix.test(prefix) ? col : lineIndent;
  }

  /**
   * Scan the block indicator at the cursor (`?`, `-` or `:`): lock the line
   * indent, consume the indicator, open its block scope and emit its token
   * behind any block-start marker the scope step queued.
   *
   * **Details**
   *
   * When `checkTab` holds and the indicator's separation carries a tab that
   * `tabIsIndent` says acts as indentation, the tab is consumed too and an
   * `error` token for it follows the indicator.
   */
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
      return takePending();
    }
    ensure(indent, start, sLine, sCol);
    const token = makeToken(kind, indicator, start, sLine, sCol);
    if (pending.length > 0) {
      pending.push(token);
      return takePending();
    }
    return token;
  }

  /** Consume the line break `ch` at the cursor, treating CRLF as one break. */
  function consumeLineBreak(ch: string): void {
    if (ch === "\r" && peek(1) === "\n") advance(2);
    else advance();
  }

  /**
   * Consume the line break at the cursor inside a quoted scalar (CRLF as
   * one break) and report whether a column-0 document marker follows it,
   * which terminates the scalar.
   */
  function breakReachesDocumentMarker(ch: string): boolean {
    consumeLineBreak(ch);
    return col === 0 && isDocumentMarkerAhead();
  }

  /** Consume the line break that ends a block-scalar body line (CRLF as one break), if any. */
  function consumeBlockLineBreak(): void {
    if (pos < text.length) {
      pos = lineBreakEnd(text, pos);
      line++;
      col = 0;
    }
  }

  /** Move the deferred empty lines of a block scalar into its body, in order. */
  function flushTrailingLines(lines: Array<string>, trailingNewlines: Array<string>): void {
    for (const nl of trailingNewlines) {
      lines.push(nl);
    }
    trailingNewlines.length = 0;
  }

  // -----------------------------------------------------------------------
  // Scanning methods
  // -----------------------------------------------------------------------

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

  /**
   * Whether a leading tab run outside flow context acts as block indentation
   * (YAML 1.2 §6.1), which is an error.
   *
   * **Details**
   *
   * A tab-only blank line is separation unless an empty block scalar was just
   * emitted (e.g. `foo: |\n\t\n`, where the tab line could be intended as
   * tab-indented block scalar content). A tab before a flow-opening indicator
   * is separation, and so is any tab while no block structure is active (e.g.
   * plain scalar continuation, YAML 1.2 §6.2).
   */
  function leadingTabIsIndent(): boolean {
    const next = charAt(blankRunEnd(pos));
    if (!afterEmptyBlockScalar && isLineEnd(next)) return false;
    return next !== "{" && next !== "[" && MutableHashMap.size(blockStarted) > 0;
  }

  /**
   * Whether a leading tab run inside flow context precedes content: tabs
   * before closing indicators, line breaks or the end of input are valid
   * separation space; tabs before content are invalid (YAML 1.2 §6.1).
   */
  function flowTabPrecedesContent(): boolean {
    const next = charAt(blankRunEnd(pos));
    return next !== "]" && next !== "}" && !isLineEnd(next);
  }

  /**
   * Change 5a: mixed tab+space indentation check. When whitespace starts with
   * spaces but contains a tab, the tab may be invalid indentation (YAML 1.2
   * §6.1). It is an error only when the number of leading spaces matches an
   * existing block scope — the tab is extending indentation at a known block
   * level. Blank/separator lines (next char is newline/EOF) are exempt.
   */
  function isMixedIndentError(start: number, sCol: number): boolean {
    if (lineIndentLocked || flowDepth !== 0 || sCol !== 0) return false;
    let tab = start;
    while (tab < pos && text[tab] !== "\t") tab++;
    const tabIdx = tab < pos ? tab - start : -1;
    return tabIdx > 0 && !isLineEnd(charAt(pos)) && MutableHashMap.has(blockStarted, tabIdx);
  }

  function scanWhitespace(): YamlToken.Data {
    const start = pos;
    const sLine = line;
    const sCol = col;
    // YAML 1.2 §6.1: Tabs are not allowed as indentation characters.
    // Detect tabs in leading whitespace (before lineIndent is locked).
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
    // Must be exactly 3 chars followed by EOF, newline, or whitespace
    if (!isSeparatorOrEnd(charAt(pos + 3))) {
      return null; // not a document marker, treat as plain scalar
    }
    advance(3);
    const kind = marker === "---" ? "document-start" : "document-end";
    // Reset block tracking so the next document gets fresh block-start tokens.
    MutableHashMap.clear(blockStarted);
    collectionIndents.length = 0;
    return makeToken(kind, marker, start, sLine, sCol);
  }

  /**
   * Whether the plain scalar stops before offset `at`: a line break or the
   * end of input, a flow indicator in flow context, a `:` value indicator
   * (followed by a separator, the end of input, or a flow indicator in flow
   * context), or the blank of a ` #` / `\t#` comment start.
   */
  function plainScalarStopsAt(at: number): boolean {
    const ch = charAt(at);
    if (isPlainScalarBreak(ch)) return true;
    const next = charAt(at + 1);
    if (ch === ":") return isPlainColonStop(next);
    return isWhitespace(ch) && next === "#";
  }

  /** Whether a `:` followed by `next` is a value indicator rather than plain scalar text. */
  function isPlainColonStop(next: string): boolean {
    return isSeparatorOrEnd(next) || (flowDepth > 0 && isFlowIndicator(next));
  }

  /** The offset where a plain scalar run starting at `from` stops. */
  function plainRunEnd(from: number): number {
    let at = from;
    while (at < text.length && !plainScalarStopsAt(at)) at++;
    return at;
  }

  /**
   * Scan a plain scalar. Its token runs on across continuation lines that
   * start with a quote or block-scalar indicator, so the parser never reads
   * such a line as a quoted or block scalar of its own.
   */
  function scanPlainScalar(): YamlToken.Data {
    lockLineIndent();
    const start = pos;
    const sLine = line;
    const sCol = col;

    do {
      advance(plainRunEnd(pos) - pos);
    } while (absorbsStyleIndicatorLine());

    // Trim trailing whitespace from plain scalar value
    let end = pos;
    while (end > start && isWhitespace(charAt(end - 1))) {
      end--;
    }

    col -= pos - end;
    pos = end;
    const value = Str.slice(start, end)(text);
    return makeToken("scalar", value, start, sLine, sCol);
  }

  /**
   * Scan a quoted scalar: `closes` recognizes the closing quote and `pieceOf`
   * consumes one body unit, returning its decoded text or `null` when the
   * scalar is malformed. An unterminated scalar is an `error` token.
   */
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

  /**
   * A line break inside a quoted scalar folds to a space; a document marker
   * (--- or ...) at column 0 after it terminates the scalar instead.
   */
  function quotedLineFold(ch: string): string | null {
    return breakReachesDocumentMarker(ch) ? null : " ";
  }

  /** A `'` that is not the first half of an escaped `''` closes a single-quoted scalar. */
  function closesSingleQuoted(ch: string): boolean {
    return ch === "'" && peek(1) !== "'";
  }

  function singleQuotedPiece(ch: string): string | null {
    if (ch === "'") {
      // escaped single quote
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

  /**
   * Scan a fixed-width hex escape (`\x`, `\u`, `\U`) after its letter. A
   * well-formed 8-hex-digit escape can still denote a code point above the
   * Unicode maximum (U+10FFFF); that is invalid YAML and must surface as an
   * error token, never a String.fromCodePoint RangeError escaping as an
   * unhandled defect.
   */
  function scanHexEscape(width: number): string | null {
    advance(); // skip 'x', 'u' or 'U'
    const hex = Str.slice(pos, pos + width)(text);
    const cp = hex.length === width && /^[\da-fA-F]+$/.test(hex) ? Number.parseInt(hex, 16) : Number.NaN;
    if (!(cp <= 0x10ffff)) return null;
    advance(width);
    return String.fromCodePoint(cp);
  }

  /** Scan the escape after a `\`; `null` for an invalid escape sequence. */
  function scanEscape(): string | null {
    advance(); // skip backslash
    const esc = peek();
    const simple = R.get(simpleEscapes, esc);
    if (O.isSome(simple)) {
      advance();
      return simple.value;
    }
    const width = R.get(hexEscapeWidths, esc);
    if (O.isSome(width)) return scanHexEscape(width.value);
    if (!isNewline(esc)) return null;
    // line continuation: skip the break and the next line's leading whitespace
    consumeLineBreak(esc);
    consumeBlanks();
    return "";
  }

  /**
   * Change 5b: a tab after a bare line break in a double-quoted scalar is
   * forbidden when the scalar is nested (`sCol > 0`), since the tab would be
   * acting as indentation. At column 0, tabs are just leading whitespace.
   */
  function doubleQuotedLineFold(ch: string, sCol: number): string | null {
    const folded = quotedLineFold(ch);
    if (folded === null || sCol === 0 || peek() !== "\t") return folded;
    advance(); // consume the tab so it's included in the error span
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

  /**
   * Parse a block scalar header's optional chomping and indentation
   * indicators (at most one of each, in either order).
   */
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

  /**
   * Skip invalid text after a block scalar header, up to the line end or a
   * comment indicator preceded by whitespace outside quotes.
   */
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

  /** Width of the header text unit at the cursor: escapes and doubled single quotes span two characters. */
  function headerTextWidth(ch: string, quote: string): number {
    if (quote === '"' && ch === "\\") return isLineEnd(peek(1)) ? 1 : 2;
    return quote === "'" && ch === "'" && peek(1) === "'" ? 2 : 1;
  }

  /**
   * After the indicator and modifiers, only whitespace, a comment (preceded
   * by whitespace), or newline/EOF is allowed on the header line. Any other
   * content (e.g. "first line" in `> first line`) is invalid: it becomes an
   * `error` token, and a comment that ends it is queued behind it.
   */
  function scanBlockHeaderTail(start: number, sLine: number, sCol: number): YamlToken.Data | null {
    const hadHeaderWhitespace = consumeBlanks();
    if (isLineEnd(peek())) return null;
    if (peek() === "#" && hadHeaderWhitespace) {
      // Comment on header line preceded by whitespace — valid
      consumeToLineEnd();
      return null;
    }
    skipInvalidHeaderText();
    const error = errorSince(start, sLine, sCol);
    if (peek() === "#") pending.push(scanComment());
    return error;
  }

  /**
   * The parent context indentation n of a block scalar with an explicit
   * indentation indicator (YAML 1.2 §8.1.1.1), found by looking backward
   * from the indicator at `start`: the key's indentation after a same-line
   * `:` (after a compact sequence's "- " when the line opens with one), the
   * column of a same-line `-`, and otherwise (the scalar on its own line,
   * e.g. after a tag or anchor) the highest active block indent.
   */
  function blockParentIndent(start: number): number {
    let scanBack = start - 1;
    while (scanBack >= 0 && (text[scanBack] === " " || text[scanBack] === "\t")) {
      scanBack--;
    }
    const before = charAt(scanBack);
    // `charAt(-1)` is "", so a scalar at the very start matches neither indicator.
    if (before === ":") return findKeyIndent(text, scanBack);
    if (before === "-") return scanBack - lineStartOf(text, scanBack);
    let maxBlockIndent = 0;
    for (const key of MutableHashMap.keys(blockStarted)) {
      maxBlockIndent = Math.max(maxBlockIndent, key);
    }
    return maxBlockIndent;
  }

  /**
   * The content indentation of a block scalar whose body starts at the
   * cursor, or `-1` when it has no content lines. An explicit indentation
   * indicator m gives n+m absolute spaces; otherwise the first non-empty
   * line sets it.
   */
  function blockContentIndent(start: number, explicitIndent: number): number {
    return explicitIndent > 0 ? blockParentIndent(start) + explicitIndent : detectBlockIndent(text, pos);
  }

  /** Consume the trailing empty/whitespace-only lines a keep-chomped empty block scalar keeps, counting them. */
  function consumeKeptEmptyLines(): number {
    let count = 0;
    while (pos < text.length) {
      consumeRawBlanks();
      // Whitespace-only content at EOF counts as one empty line
      if (pos >= text.length) return Math.max(count, 1);
      if (!isNewline(charAt(pos))) return count;
      count++;
      consumeBlockLineBreak();
    }
    return count;
  }

  /**
   * Emit a block scalar without content lines (none found, or zero-indent
   * content inside a block structure — zero-indent content is only valid at
   * document level, not inside mappings/sequences).
   */
  function emptyBlockScalar(chomp: ScalarChomp, start: number, sLine: number, sCol: number): YamlToken.Data {
    if (chomp === "keep") {
      const value = Str.repeat(consumeKeptEmptyLines())("\n");
      return makeToken("scalar", value, start, sLine, sCol, pos - start);
    }
    afterEmptyBlockScalar = true;
    return makeToken("scalar", "", start, sLine, sCol, pos - start);
  }

  /** Consume spaces and tabs without line-indent bookkeeping (block-scalar body scanning). */
  function consumeRawBlanks(): void {
    const end = blankRunEnd(pos);
    col += end - pos;
    pos = end;
  }

  /** Consume the spaces at the start of a block-scalar body line, returning their count. */
  function consumeRawSpaces(): number {
    const lineStart = pos;
    while (pos < text.length && text[pos] === " ") {
      pos++;
      col++;
    }
    return pos - lineStart;
  }

  /** Consume the rest of a block-scalar body line, returning its text. */
  function consumeRawLine(): string {
    const contentStart = pos;
    while (pos < text.length && text[pos] !== "\n" && text[pos] !== "\r") {
      pos++;
      col++;
    }
    return Str.slice(contentStart, pos)(text);
  }

  /** Whether the body line at the cursor, after its `spaces` leading spaces, ends the block scalar body. */
  function endsBlockBody(spaces: number, blank: boolean, contentIndent: number): boolean {
    if (spaces === 0 && isDocumentMarkerAt(text, pos)) return true;
    return !blank && spaces < contentIndent;
  }

  /**
   * Collect one block-scalar body line into `lines` (deferring empty lines
   * to `trailingNewlines`). Returns `false`, with the cursor rewound to the
   * line start, when the line ends the body: a column-0 document marker
   * (--- or ...) always does, regardless of indentation level (YAML 1.2
   * §9.1.2), and so does content indented less than `contentIndent`.
   */
  function collectBlockLine(contentIndent: number, lines: Array<string>, trailingNewlines: Array<string>): boolean {
    const lineStart = pos;
    const spaces = consumeRawSpaces();
    const blank = isLineEnd(charAt(pos));
    if (endsBlockBody(spaces, blank, contentIndent)) {
      pos = lineStart;
      col = 0;
      return false;
    }
    if (blank && spaces <= contentIndent) {
      // Empty line (at or below content indent) — defer as trailing
      trailingNewlines.push("");
    } else {
      // Content, or a whitespace-only line with extra indentation, which is
      // content rather than an empty line (YAML 1.2 section 8.1.3)
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

    // Consume the newline after header
    if (isNewline(peek())) consumeLineBreak(peek());

    const contentIndent = blockContentIndent(start, explicitIndent);
    if (contentIndent < 0 || (contentIndent === 0 && MutableHashMap.size(blockStarted) > 0)) {
      return emptyBlockScalar(chomp, start, sLine, sCol);
    }

    const lines: Array<string> = [];
    const trailingNewlines: Array<string> = [];
    let more = true;
    while (more && pos < text.length) {
      more = collectBlockLine(contentIndent, lines, trailingNewlines);
    }

    // Folded (YAML 1.2 §8.1.3): adjacent non-empty lines at base indent fold
    // to space; literal joins lines with newlines.
    const body = isFolded ? foldBlockLines(lines) : A.join(lines, "\n");
    return makeToken("scalar", chompBlockValue(body, chomp, trailingNewlines.length), start, sLine, sCol, pos - start);
  }

  /**
   * Scan an anchor (`&name`) or alias (`*name`) at the cursor. The token value
   * is the bare name, but the span covers the sigil too — the raw length is
   * passed so the span is not one character short. An empty name is an
   * `error` token.
   */
  function scanNodeName(kind: "anchor" | "alias"): YamlToken.Data {
    lockLineIndent();
    const start = pos;
    const sLine = line;
    const sCol = col;
    advance(); // skip the '&' or '*' sigil
    const nameStart = pos;
    // YAML 1.2 ns-anchor-char: any non-whitespace char except c-flow-indicator
    consumeNameChars();
    const name = Str.slice(nameStart, pos)(text);
    if (name.length === 0) {
      return errorSince(start, sLine, sCol);
    }
    return makeToken(kind, name, start, sLine, sCol, pos - start);
  }

  /** Scan the rest of a verbatim tag (`!<...>`) after its `!`; a line break or EOF before `>` is an error. */
  function scanVerbatimTag(start: number, sLine: number, sCol: number): YamlToken.Data {
    advance(); // skip '<'
    while (pos < text.length && peek() !== ">") {
      if (isNewline(peek())) return errorSince(start, sLine, sCol);
      advance();
    }
    if (peek() !== ">") return errorSince(start, sLine, sCol);
    advance(); // skip '>'
    return makeToken("tag", Str.slice(start, pos)(text), start, sLine, sCol);
  }

  function scanTag(): YamlToken.Data {
    lockLineIndent();
    const start = pos;
    const sLine = line;
    const sCol = col;
    advance(); // skip first '!'

    if (peek() === "<") return scanVerbatimTag(start, sLine, sCol);

    if (peek() === "!") {
      // Secondary tag handle: !!
      advance();
    }

    // Collect tag suffix
    consumeNameChars();

    return makeToken("tag", Str.slice(start, pos)(text), start, sLine, sCol);
  }

  function scanDirective(): YamlToken.Data {
    lockLineIndent();
    const start = pos;
    const sLine = line;
    const sCol = col;
    // Consume the entire line
    consumeToLineEnd();
    return makeToken("directive", Str.slice(start, pos)(text), start, sLine, sCol);
  }

  // -----------------------------------------------------------------------
  // Content dispatch (one scanner per leading character)
  // -----------------------------------------------------------------------

  /**
   * Comment: YAML 1.2 §6.6 requires # to be preceded by whitespace (or be at
   * the start of a line) to be a valid comment indicator. A # without
   * preceding whitespace after a quoted scalar is invalid (e.g.,
   * "value"# comment). In other contexts, # is valid plain scalar content.
   */
  function scanHash(): YamlToken.Data | null {
    if (followsSeparation()) return scanComment();
    return prevWasQuoted ? consumeCharToken("error") : null;
  }

  /** Document markers (only at column 0); `null` falls through to the next candidate. */
  function scanMarkerAtLineStart(marker: string): YamlToken.Data | null {
    return col === 0 && Str.slice(pos, pos + marker.length)(text) === marker ? scanDocumentStartOrEnd() : null;
  }

  /**
   * Block sequence entry. Change 4: a tab in separation space before a nested
   * block structure is forbidden. YAML 1.2 allows tabs in separation space
   * for scalar values, but when the content after tab-containing separation
   * is a block indicator or mapping key, the tab effectively acts as
   * indentation.
   */
  function scanDash(): YamlToken.Data | null {
    const marker = scanMarkerAtLineStart("---");
    if (marker !== null) return marker;
    if (!isSeparatorOrEnd(peek(1)) || flowDepth !== 0) return null;
    return scanBlockIndicator("block-seq-entry", ensureBlockSeq, true, isBlockIndicatorAt);
  }

  function scanDot(): YamlToken.Data | null {
    return scanMarkerAtLineStart("...");
  }

  /** Directive (only at column 0 outside flow context). */
  function scanPercent(): YamlToken.Data | null {
    return col === 0 && flowDepth === 0 ? scanDirective() : null;
  }

  /**
   * Block scalar indicators: truly one only outside flow context and when
   * followed by a newline, whitespace, chomping/indentation indicator, # or
   * EOF (0 included so |0 enters scanBlockScalar, whose header rejects it).
   */
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

  /**
   * Comma is only valid as an item separator inside flow context. Outside
   * flow (`{...}`/`[...]`), a stand-alone comma is malformed input — e.g., U99R
   * `!!str, xxx` where the comma trails a tag.
   */
  function scanComma(): YamlToken.Data {
    lockLineIndent();
    return consumeCharToken(flowDepth === 0 ? "error" : "flow-separator");
  }

  /**
   * Explicit map key. Change 4: a tab in separation space before content
   * after ? is forbidden — any content at a tab-based position would use the
   * tab as effective indentation for the key content.
   */
  function scanQuestion(): YamlToken.Data | null {
    if (!isSeparatorOrEnd(peek(1))) return null;
    return scanBlockIndicator("block-map-key", ensureBlockMap, flowDepth === 0, isContentAt);
  }

  /**
   * Value indicator. YAML 1.2 §7.18: in flow context, ":" is a valid value
   * indicator immediately after a quoted scalar (JSON-like key) or a flow
   * collection used as an implicit-mapping key, without requiring a
   * following whitespace character.
   */
  function isValueIndicator(): boolean {
    const next = peek(1);
    if (isSeparatorOrEnd(next)) return true;
    return flowDepth > 0 && (isFlowIndicator(next) || prevWasQuoted || prevWasFlowEnd);
  }

  /** Change 4: a tab in separation space before a nested block structure is forbidden. */
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

  /** Scanners keyed by the token's first character; `null` falls back to a plain scalar. */
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

  /**
   * Scan a content token (anything but a line break or whitespace) starting
   * with `ch`. A continuation line of an open plain scalar lexes as plain
   * text before any indicator scanner sees its first character.
   */
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

  /** Scan a plain scalar outside any indicator scanner. */
  function scanPlainFallback(): YamlToken.Data {
    afterQuotedScalar = false;
    return scanPlainScalar();
  }

  /**
   * BOM (YAML 1.2 §5.2). Consumed WITHOUT `advance()`: the mark is invisible,
   * so it must not occupy a column — otherwise the first line's content lexes
   * one column deeper than every line that follows and the composer opens a
   * second collection at that indent. The token still spans its real offset
   * so node offsets stay indices into the original text.
   */
  function scanByteOrderMark(): YamlToken.Data {
    const start = pos;
    pos++;
    return makeToken("byte-order-mark", "﻿", start, line, col);
  }

  /**
   * Save and reset the quoted-scalar and flow-collection-end flags. The `:`
   * handler reads `prevWasQuoted` to allow adjacent value indicators in flow
   * context (YAML 1.2 §7.18), and `prevWasFlowEnd` to allow them after a flow
   * collection used as an implicit-mapping key (e.g. `[ {JSON: like}:v ]`).
   * In flow context the flags survive whitespace, newlines, and comments, so
   * that a colon on the next line after a quoted key is still recognized as
   * a value indicator (e.g., `{ "foo"\n  :bar }` or `{ "foo" # comment\n  :bar }`).
   */
  function rollTokenFlags(ch: string): void {
    prevWasQuoted = afterQuotedScalar;
    prevWasFlowEnd = afterFlowCollectionEnd;
    const isFlowTrivia = isWhitespace(ch) || isNewline(ch) || (ch === "#" && followsSeparation());
    if (flowDepth === 0 || !isFlowTrivia) {
      afterQuotedScalar = false;
      afterFlowCollectionEnd = false;
    }
  }

  // -----------------------------------------------------------------------
  // Main scan (internal)
  // -----------------------------------------------------------------------

  function scanNext(): YamlToken.Data | null {
    // Drain pending tokens first
    if (pending.length > 0) return takePending();
    if (pos >= text.length) return null;

    const ch = peek();
    rollTokenFlags(ch);
    if (ch === "﻿") return scanByteOrderMark();
    if (isNewline(ch)) return scanNewline();
    if (isWhitespace(ch)) return scanWhitespace();

    // Clear the empty block scalar flag once we reach non-whitespace content.
    afterEmptyBlockScalar = false;
    return scanContent(ch);
  }

  /** Replay one character of `setPosition`: like `advanceOne`, but a BOM occupies no column (as in `scanNext`). */
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

  /** Reset all mutable scanner state except the cursor. */
  function resetScanState(): void {
    lineIndent = 0;
    lineIndentLocked = false;
    flowDepth = 0;
    MutableHashMap.clear(blockStarted);
    collectionIndents.length = 0;
    nodeStartCol = -1;
    plainFloor = undefined;
    pending.length = 0;
    afterEmptyBlockScalar = false;
    afterQuotedScalar = false;
    afterFlowCollectionEnd = false;
    state.currentToken = null;
  }

  // -----------------------------------------------------------------------
  // Public scanner interface
  // -----------------------------------------------------------------------

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
      // Recompute line/col by replaying character advances from the start.
      pos = 0;
      line = 0;
      col = 0;
      while (pos < newPos && pos < text.length) replayChar();
      resetScanState();
    },
  };
}

// ---------------------------------------------------------------------------
// Batch API
// ---------------------------------------------------------------------------

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
