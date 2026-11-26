import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import { constant, dual } from "effect/Function";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { YamlScalar } from "../../YamlNode.ts";
import { findKeyIndent, foldBlockLines, hasBlockContent } from "../block-scalar.ts";
import { RawDiagnostic } from "../diagnostics.ts";
import { registerAnchor, registerMetaAnchor } from "./anchors.ts";
import { rawCommentText } from "./comments.ts";
import { lineCol } from "./state.ts";
import { resolveTagHandle } from "./tags.ts";
import type { ScalarStyle } from "../../YamlNode.ts";
import type { CstNode } from "../cst.ts";
import type { ComposerState, NodeMeta } from "./state.ts";

const NULL_RE = /^(?:null|Null|NULL|~)$/;
const TRUE_RE = /^(?:true|True|TRUE)$/;
const FALSE_RE = /^(?:false|False|FALSE)$/;
const INT_RE = /^[-+]?[0-9]+$/;
const OCT_RE = /^0o[0-7]+$/;
const HEX_RE = /^0x[\dA-Fa-f]+$/;
const FLOAT_RE = /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?$/;
const INF_RE = /^[-+]?\.(?:inf|Inf|INF)$/;
const NAN_RE = /^\.(?:nan|NaN|NAN)$/;

const safeParseInt: {
  (value: string, radix: number): number | bigint;
  (radix: number): (value: string) => number | bigint;
} = dual(2, (value: string, radix: number): number | bigint => {
  const n = Number.parseInt(value, radix);
  if (Number.isSafeInteger(n)) return n;
  const prefix = radix === 16 ? "0x" : radix === 8 ? "0o" : "";
  return BigInt(`${prefix}${value}`);
});

/**
 * Classifies a plain scalar's numeric form for duplicate-key identity.
 *
 * **Details**
 *
 * `1` is an `!!int` and `1.0` an `!!float` even though both resolve to the JS number `1`,
 * so they are distinct mapping keys; `1` and `0x1` are both `!!int 1` and so
 * are the same key. Returns `None` for non-numeric plain text. Uses the same
 * regexes as {@link resolvePlainScalar} so the classification always agrees
 * with how the value was resolved.
 *
 * **Example** (Distinguish integer and floating keys)
 *
 * ```ts
 * import { classifyPlainNumeric } from "@beep/yaml/internal/composer/scalars";
 *
 * import * as O from "effect/Option";
 *
 * const kinds = ["1", "1.0", "0x1"].map((raw) => O.getOrUndefined(classifyPlainNumeric(raw)))
 * console.log(kinds) // ["int", "float", "int"]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function classifyPlainNumeric(raw: string): O.Option<"int" | "float"> {
  const t = Str.trim(raw);
  if (OCT_RE.test(t) || HEX_RE.test(t) || INT_RE.test(t)) return O.some("int");
  if (INF_RE.test(t) || NAN_RE.test(t) || FLOAT_RE.test(t)) return O.some("float");
  return O.none();
}

const signedInfinity = (value: string): number =>
  Str.startsWith("-")(value) ? -Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;

const PLAIN_SCALAR_RULES_IN_ORDER: ReadonlyArray<readonly [pattern: RegExp, resolve: (value: string) => unknown]> = [
  [NULL_RE, () => null],
  [TRUE_RE, () => true],
  [FALSE_RE, () => false],
  [OCT_RE, (value) => safeParseInt(Str.slice(2)(value), 8)],
  [HEX_RE, (value) => safeParseInt(Str.slice(2)(value), 16)],
  [INT_RE, (value) => safeParseInt(value, 10)],
  [INF_RE, signedInfinity],
  [NAN_RE, () => Number.NaN],
  [FLOAT_RE, (value) => Number.parseFloat(value)],
];

function resolvePlainScalar(value: string): unknown {
  if (value === "") return null;
  for (const [pattern, resolve] of PLAIN_SCALAR_RULES_IN_ORDER) {
    if (pattern.test(value)) return resolve(value);
  }
  return value;
}

const resolveTaggedScalar: {
  (rawValue: string, tag: string): unknown;
  (tag: string): (rawValue: string) => unknown;
} = dual(2, (rawValue: string, tag: string): unknown =>
  Match.value(tag).pipe(
    Match.when(Match.is("!!str", "tag:yaml.org,2002:str"), () => rawValue),
    Match.when(Match.is("!!int", "tag:yaml.org,2002:int"), () => {
      if (OCT_RE.test(rawValue)) return safeParseInt(Str.slice(2)(rawValue), 8);
      if (HEX_RE.test(rawValue)) return safeParseInt(Str.slice(2)(rawValue), 16);
      if (INT_RE.test(rawValue)) return safeParseInt(rawValue, 10);
      const n = Number.parseInt(rawValue, 10);
      return Number.isNaN(n) ? rawValue : n;
    }),
    Match.when(Match.is("!!float", "tag:yaml.org,2002:float"), () => {
      if (INF_RE.test(rawValue)) return signedInfinity(rawValue);
      if (NAN_RE.test(rawValue)) return Number.NaN;
      const n = Number.parseFloat(rawValue);
      return Number.isNaN(n) ? rawValue : n;
    }),
    Match.when(Match.is("!!bool", "tag:yaml.org,2002:bool"), () => {
      if (TRUE_RE.test(rawValue)) return true;
      if (FALSE_RE.test(rawValue)) return false;
      return rawValue;
    }),
    Match.when(Match.is("!!null", "tag:yaml.org,2002:null"), () => null),
    Match.orElse(() => rawValue)
  )
);

type ResolveScalarContext = readonly [
  style: ScalarStyle,
  tag?: string | undefined,
  state?: ComposerState | undefined,
  tagSpan?: NodeMeta["tagSpan"],
];

/**
 * Resolves scalar text using an explicit YAML tag or the plain-style Core Schema rules.
 *
 * **Details**
 *
 * Without a tag, quoted and block styles retain their string values. With a composer
 * state, tag handles are expanded before resolution. Plain integers beyond the safe
 * integer range resolve to bigint to avoid silent precision loss.
 *
 * **Example** (Resolve plain and quoted numbers)
 *
 * ```ts
 * import { resolveScalar } from "@beep/yaml/internal/composer/scalars";
 *
 * console.log(resolveScalar("42", ["plain"]), resolveScalar("42", ["double-quoted"])) // 42 42
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const resolveScalar: {
  ([style, tag, state, tagSpan]: ResolveScalarContext): (rawValue: string) => unknown;
  (rawValue: string, [style, tag, state, tagSpan]: ResolveScalarContext): unknown;
} = dual(2, (rawValue: string, [style, tag, state, tagSpan]: ResolveScalarContext): unknown => {
  if (tag !== undefined && tag !== "") {
    const resolvedTag = state !== undefined ? resolveTagHandle(tag, state, tagSpan) : tag;
    return resolveTaggedScalar(rawValue, resolvedTag);
  }
  if (style !== "plain") return rawValue;
  return resolvePlainScalar(rawValue);
});

/**
 * Identifies plain, quoted, literal, or folded scalar syntax from a CST source slice.
 *
 * **Example** (Identify single quoted syntax)
 *
 * ```ts
 * import { getScalarStyle } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "flow-scalar", source: "'hello'", offset: 0, length: 7 };
 * console.log(getScalarStyle(node)) // single-quoted
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function getScalarStyle(node: CstNode): ScalarStyle {
  if (node.type === "block-scalar") {
    const ch = Str.trimStart(node.source)[0];
    return ch === ">" ? "block-folded" : "block-literal";
  }
  const first = node.source[0];
  if (first === "'") return "single-quoted";
  if (first === '"') return "double-quoted";
  return "plain";
}

/**
 * Extracts the chomp indicator from a block scalar's header.
 *
 * **Details**
 *
 * Returns "strip" for `-`, "keep" for `+`, "clip" otherwise (default).
 * Returns `None` for non-block scalars.
 *
 * **Example** (Read the keep indicator)
 *
 * ```ts
 * import { getBlockChomp } from "@beep/yaml/internal/composer/scalars";
 * import * as O from "effect/Option";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "block-scalar", source: "|+", offset: 0, length: 2 };
 * console.log(O.getOrUndefined(getBlockChomp(node))) // keep
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function getBlockChomp(node: CstNode): O.Option<"strip" | "clip" | "keep"> {
  if (node.type !== "block-scalar") return O.none();
  const headerIndicatorRun = O.getOrNull(Str.match(/^[|>]([0-9+-]*)/)(Str.trimStart(node.source)))?.[1] ?? "";
  if (Str.includes("+")(headerIndicatorRun)) return O.some("keep");
  if (Str.includes("-")(headerIndicatorRun)) return O.some("strip");
  return O.some("clip");
}

/**
 * Extracts the explicit indentation-indicator digit from a block scalar's header.
 *
 * **Details**
 *
 * Headers such as `|2` and `>1+` carry an explicit digit. Returns `None` when
 * the header carries none (the reader auto-detects) or the node is not a block
 * scalar. Inspects only the indicator run — see {@link getBlockChomp} for why
 * the rest of the header line (a comment can contain digits) must not be read.
 *
 * **Example** (Read explicit block indentation)
 *
 * ```ts
 * import { getBlockIndent } from "@beep/yaml/internal/composer/scalars";
 * import * as O from "effect/Option";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "block-scalar", source: "|2", offset: 0, length: 2 };
 * console.log(O.getOrUndefined(getBlockIndent(node))) // 2
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function getBlockIndent(node: CstNode): O.Option<number> {
  if (node.type !== "block-scalar") return O.none();
  const indicators = O.getOrNull(Str.match(/^[|>]([0-9+-]*)/)(Str.trimStart(node.source)))?.[1] ?? "";
  return O.map(O.fromUndefinedOr(O.getOrNull(Str.match(/[1-9]/)(indicators))?.[0]), Number);
}

function blockScalarHeaderComment(cst: CstNode): string | undefined {
  const src = Str.trimStart(cst.source);
  const nl = O.getOrElse(constant(-1))(Str.search(/[\r\n]/)(src));
  const header = nl < 0 ? src : Str.slice(0, nl)(src);
  const hash = O.getOrElse(constant(-1))(Str.indexOf("#")(header));
  if (hash < 1) return undefined;
  const before = header[hash - 1];
  const separatedFromIndicators = before === " " || before === "\t";
  if (!separatedFromIndicators) return undefined;
  return rawCommentText(Str.slice(hash)(header));
}

/**
 * Decodes a CST scalar into text by removing syntax, unescaping quotes, and folding lines.
 *
 * **Details**
 *
 * For block scalars with explicit indentation, supply the full document text so
 * the indentation digit is interpreted relative to the parent block context.
 *
 * **Example** (Decode a plain scalar)
 *
 * ```ts
 * import { getScalarValue } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "flow-scalar", source: " hello ", offset: 0, length: 7 };
 * console.log(getScalarValue(node)) // hello
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const getScalarValue: {
  (fullText?: string): (node: CstNode) => string;
  (node: CstNode, fullText?: string): string;
} = dual(
  (args) => P.hasProperty(args[0], "source"),
  (node: CstNode, fullText?: string): string => {
    if (node.type === "block-scalar") return decodeBlockScalar(node.source, fullText, node.offset);
    const style = getScalarStyle(node);
    if (style === "single-quoted") return decodeSingleQuoted(node.source);
    if (style === "double-quoted") return decodeDoubleQuoted(node.source);
    return decodePlainScalar(node.source);
  }
);

function decodePlainScalar(raw: string): string {
  const trimmed = plainSourceText(raw);
  if (!Str.includes("\n")(trimmed)) return trimmed;
  return foldFlowLines(trimmed);
}

const plainSourceText = (raw: string): string => Str.replace(/\r\n?/g, "\n")(Str.trim(raw));

function decodeSingleQuoted(raw: string): string {
  const inner = Str.slice(1, -1)(raw);
  const unescaped = Str.replace(/''/g, "'")(inner);
  if (!Str.includes("\n")(unescaped)) return unescaped;
  return foldFlowLines(unescaped);
}

const SIMPLE_ESCAPES: { readonly [escape: string]: string | undefined } = {
  "\\": "\\",
  '"': '"',
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  "0": "\0",
  a: "\x07",
  e: "\x1B",
  v: "\x0B",
  " ": " ",
  N: "\u0085",
  _: " ",
  L: " ",
  P: " ",
};

const lastUnicodeCodePoint = 0x10ffff;

const HEX_ESCAPES: {
  readonly [escape: string]: readonly [width: number, decode: (code: number) => string] | undefined;
} = {
  x: [2, (code) => String.fromCharCode(code)],
  u: [4, (code) => String.fromCodePoint(code)],
  U: [8, (code) => (code <= lastUnicodeCodePoint ? String.fromCodePoint(code) : "�")],
};

const makeDoubleQuotedCursor = (inner: string) => ({ inner, result: "", untrimmableEnd: 0, i: 0 });
type DoubleQuotedCursor = ReturnType<typeof makeDoubleQuotedCursor>;

const skipBlanks = (text: string, i: number): number => {
  let j = i;
  while (text[j] === " " || text[j] === "\t") j++;
  return j;
};

const isBreakAt = (text: string, i: number): boolean => text[i] === "\n" || text[i] === "\r";

const escapeText = (cur: DoubleQuotedCursor, esc: string | undefined): string => {
  if (esc === undefined) return "\\";
  const simple = SIMPLE_ESCAPES[esc];
  if (simple !== undefined) return simple;
  const hex = HEX_ESCAPES[esc];
  if (hex === undefined) return esc;
  const [width, decode] = hex;
  const digits = Str.slice(cur.i + 1, cur.i + 1 + width)(cur.inner);
  cur.i += width;
  return decode(Number.parseInt(digits, 16));
};

const decodeEscape = (cur: DoubleQuotedCursor): void => {
  cur.i++;
  const esc = cur.inner[cur.i];
  const escapedLineBreak = esc === "\n" || esc === "\r";
  if (escapedLineBreak) {
    cur.i = skipBlanks(cur.inner, skipLineBreak(cur.inner, cur.i));
    return;
  }
  cur.result += escapeText(cur, esc);
  cur.untrimmableEnd = cur.result.length;
  cur.i++;
};

const foldBareNewline = (cur: DoubleQuotedCursor, ch: string): void => {
  cur.result = Str.slice(0, cur.untrimmableEnd)(cur.result);
  cur.i = skipBlanks(cur.inner, cur.i + (ch === "\r" ? 2 : 1));
  if (!isBreakAt(cur.inner, cur.i)) cur.result += " ";
  while (isBreakAt(cur.inner, cur.i)) {
    cur.result += "\n";
    cur.i = skipBlanks(cur.inner, skipLineBreak(cur.inner, cur.i));
  }
  cur.untrimmableEnd = cur.result.length;
};

const appendLiteral = (cur: DoubleQuotedCursor, ch: string | undefined): void => {
  cur.result += ch;
  if (ch !== " " && ch !== "\t") cur.untrimmableEnd = cur.result.length;
  cur.i++;
};

function decodeDoubleQuoted(raw: string): string {
  const cur = makeDoubleQuotedCursor(Str.slice(1, -1)(raw));
  while (cur.i < cur.inner.length) {
    const ch = cur.inner[cur.i];
    if (ch === "\\") decodeEscape(cur);
    else if (ch === "\n" || (ch === "\r" && cur.inner[cur.i + 1] === "\n")) foldBareNewline(cur, ch);
    else appendLiteral(cur, ch);
  }
  return cur.result;
}

/**
 * Applies YAML 1.2 §6.5 flow line folding to a string.
 *
 * **Details**
 *
 * - Split into lines, trim trailing whitespace from each
 * - Newline between non-empty lines becomes a space
 * - Empty line preserved as newline in output
 * - Leading whitespace (indentation) on continuation lines trimmed
 *
 * **Example** (Fold a continuation line)
 *
 * ```ts
 * import { foldFlowLines } from "@beep/yaml/internal/composer/scalars";
 *
 * console.log(foldFlowLines("hello\n  world")) // hello world
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function foldFlowLines(text: string): string {
  const lines = Str.split("\n")(text);
  let result = Str.replace(/[ \t]+$/, "")(lines[0] ?? "");
  const last = lines.length - 1;
  for (let i = 1; i < lines.length; i++) result = foldContinuationLine(result, lines[i] ?? "", i === last);
  return result;
}

const foldContinuationLine = (result: string, line: string, isClosingDelimiterLine: boolean): string => {
  const trimmed = isClosingDelimiterLine ? Str.trimStart(line) : Str.trim(line);
  const endsInEmptyLineBreak = result[result.length - 1] === "\n";
  if (trimmed !== "") return (result.length > 0 && !endsInEmptyLineBreak ? `${result} ` : result) + trimmed;
  if (!isClosingDelimiterLine) return `${result}\n`;
  return endsInEmptyLineBreak ? result : `${result} `;
};

/**
 * Collects a multi-line plain scalar key from consecutive CST children.
 *
 * **Details**
 *
 * Like `collectMultilinePlainScalar`, but for keys: collects plain scalars
 * up until the `:` value separator, merging them with flow line folding.
 * Returns the folded key text and the index after the last consumed child.
 *
 * **Example** (Collect a key fragment)
 *
 * ```ts
 * import { collectMultilineKey } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "flow-scalar", source: "hello", offset: 0, length: 5 };
 * console.log(collectMultilineKey([node], 0).value) // hello
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const collectMultilineKey: {
  (startIdx: number): (children: readonly CstNode[]) => { value: string; nextIdx: number };
  (children: readonly CstNode[], startIdx: number): { value: string; nextIdx: number };
} = dual(2, (children: readonly CstNode[], startIdx: number): { value: string; nextIdx: number } => {
  const first = children[startIdx];
  if (first?.type !== "flow-scalar") {
    return { value: Str.trim(first?.source ?? ""), nextIdx: startIdx + 1 };
  }

  // decision: plain-continuation-lines
  const plain = isPlainFlowScalar(first);
  const seed = plain ? plainSourceText(first.source) : Str.trim(first.source);
  const parts: string[] = [seed];
  const idx = collectKeyContinuation(children, startIdx + 1, parts);
  return { value: parts.length === 1 && !plain ? seed : foldFlowLines(A.join(parts, "\n")), nextIdx: idx };
});

const isPlainFlowScalar = (c: CstNode): boolean => c.type === "flow-scalar" && getScalarStyle(c) === "plain";

const isBlankTrivia = (c: CstNode): boolean =>
  c.type === "newline" || (c.type === "whitespace" && Str.trim(c.source) === "");

const isSegmentBoundary = (c: CstNode): boolean => c.type === "whitespace" && (c.source === ":" || c.source === ",");

const collectKeyContinuation = (children: readonly CstNode[], startIdx: number, parts: string[]): number => {
  let idx = startIdx;
  for (; idx < children.length; idx++) {
    const child = children[idx];
    if (child === undefined || isSegmentBoundary(child)) break;
    if (isPlainFlowScalar(child)) parts.push(plainSourceText(child.source));
    else if (!isBlankTrivia(child)) break;
  }
  return idx;
};

const extractLineContent: {
  (text: string, offset: number): { lineText: string; lineEndOffset: number };
  (offset: number): (text: string) => { lineText: string; lineEndOffset: number };
} = dual(2, (text: string, offset: number): { lineText: string; lineEndOffset: number } => {
  let lineStart = offset;
  while (lineStart > 0 && text[lineStart - 1] !== "\n" && text[lineStart - 1] !== "\r") {
    lineStart--;
  }
  let lineEnd = offset;
  while (lineEnd < text.length && text[lineEnd] !== "\n" && text[lineEnd] !== "\r") {
    lineEnd++;
  }
  return { lineText: Str.trim(Str.slice(lineStart, lineEnd)(text)), lineEndOffset: lineEnd };
});

const skipChildrenOnLine: {
  (children: readonly CstNode[], startIdx: number, lineEndOffset: number): number;
  (startIdx: number, lineEndOffset: number): (children: readonly CstNode[]) => number;
} = dual(3, (children: readonly CstNode[], startIdx: number, lineEndOffset: number): number => {
  let idx = startIdx;
  while (idx < children.length) {
    const c = children[idx];
    if (c === undefined) break;
    const newlineEndingThisLine = c.type === "newline" && c.offset >= lineEndOffset;
    if (newlineEndingThisLine) break;
    const startsPastLineEnd = c.offset > lineEndOffset;
    if (startsPastLineEnd) break;
    idx++;
  }
  return idx;
});

/**
 * Collects a multi-line plain scalar from consecutive CST children.
 *
 * **Details**
 *
 * Starting from a plain flow-scalar at `startIdx`, look ahead through
 * newlines and whitespace for more plain flow-scalars that continue the
 * same value. Returns the folded scalar text and the index after the last
 * consumed child.
 *
 * A continuation scalar must:
 * - Be a plain flow-scalar (not quoted)
 * - NOT be followed by a value-sep (`:`) — that makes it a mapping key
 * - Be separated from the previous scalar only by newlines/whitespace
 *
 * When the lexer mis-tokenizes continuation line content as anchors, tags,
 * aliases, directives, or block-seq entries, this function detects such
 * lines and extracts the raw source text as continuation parts (3MYT, FBC9,
 * XLQ9, AB8U).
 *
 * `endOffset` is the source end of the last consumed fragment, so callers
 * can span the composed scalar node across the whole folded value (the
 * sourceMultiline decoration pass then stamps it from the span).
 *
 * **Example** (Collect a scalar fragment)
 *
 * ```ts
 * import { collectMultilinePlainScalar } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "flow-scalar", source: "hello", offset: 0, length: 5 };
 * console.log(collectMultilinePlainScalar([node], 0).value) // hello
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const collectMultilinePlainScalar: {
  (
    startIdx: number,
    minContinuationColumn?: number,
    sourceText?: string
  ): (children: readonly CstNode[]) => { value: string; nextIdx: number; partsCount: number; endOffset: number };
  (
    children: readonly CstNode[],
    startIdx: number,
    minContinuationColumn?: number,
    sourceText?: string
  ): { value: string; nextIdx: number; partsCount: number; endOffset: number };
} = dual(
  (args) => A.isArray(args[0]),
  (
    children: readonly CstNode[],
    startIdx: number,
    minContinuationColumn?: number,
    sourceText?: string
  ): { value: string; nextIdx: number; partsCount: number; endOffset: number } => {
    const first = children[startIdx];
    if (first === undefined || !isPlainFlowScalar(first)) return singleScalarFragment(first, startIdx);

    const cur = makePlainScalarCursor(children, first, startIdx, minContinuationColumn, sourceText);
    while (cur.idx < children.length) {
      const child = children[cur.idx];
      if (child === undefined || !stepPlainContinuation(cur, child)) break;
    }

    if (cur.parts.length === 1) {
      return { value: decodePlainScalar(first.source), nextIdx: cur.idx, partsCount: 1, endOffset: cur.endOffset };
    }

    return {
      value: foldFlowLines(A.join(cur.parts, "\n")),
      nextIdx: cur.idx,
      partsCount: cur.parts.length,
      endOffset: cur.endOffset,
    };
  }
);

const singleScalarFragment = (
  first: CstNode | undefined,
  startIdx: number
): { value: string; nextIdx: number; partsCount: number; endOffset: number } => {
  if (first === undefined) return { value: "", nextIdx: startIdx + 1, partsCount: 1, endOffset: 0 };
  const endOffset = first.offset + first.length;
  const value = first.type === "flow-scalar" ? getScalarValue(first) : Str.trim(first.source);
  return { value, nextIdx: startIdx + 1, partsCount: 1, endOffset };
};

const makePlainScalarCursor = (
  children: readonly CstNode[],
  first: CstNode,
  startIdx: number,
  minContinuationColumn: number | undefined,
  sourceText: string | undefined
) => ({
  children,
  minContinuationColumn,
  sourceText,
  parts: [plainSourceText(first.source)],
  endOffset: first.offset + first.length,
  emptyLines: 0,
  idx: startIdx + 1,
  sawNewline: false,
});
type PlainScalarCursor = ReturnType<typeof makePlainScalarCursor>;

const plainRunTerminators: ReadonlyArray<string> = [":", "?", "-", ","];

const stepPlainContinuation = (cur: PlainScalarCursor, child: CstNode): boolean => {
  if (child.type === "newline") {
    cur.emptyLines++;
    cur.sawNewline = true;
    cur.idx++;
    return true;
  }
  if (child.type === "whitespace") {
    if (A.contains(plainRunTerminators, child.source)) return false;
    cur.idx++;
    return true;
  }
  if (child.type === "comment") return false;
  return isPlainFlowScalar(child) ? mergePlainScalar(cur, child) : absorbMistokenizedLine(cur, child);
};

const pushPlainScalarPart = (cur: PlainScalarCursor, part: string, endOffset: number): void => {
  const emptyLinesBetween = cur.emptyLines - 1;
  for (let e = 0; e < emptyLinesBetween; e++) cur.parts.push("");
  cur.parts.push(part);
  cur.endOffset = endOffset;
  cur.emptyLines = 0;
  cur.sawNewline = false;
};

const isBelowContinuationColumn = (cur: PlainScalarCursor, child: CstNode): boolean =>
  cur.minContinuationColumn !== undefined &&
  cur.sourceText !== undefined &&
  cur.sourceText !== "" &&
  lineCol(cur.sourceText, child.offset).column < cur.minContinuationColumn;

const mergePlainScalar = (cur: PlainScalarCursor, child: CstNode): boolean => {
  if (hasValueSepAfterInList(cur.children, cur.idx + 1) || hasBlockMapAfterInList(cur.children, cur.idx + 1)) {
    return false;
  }
  if (isBelowContinuationColumn(cur, child)) return false;
  pushPlainScalarPart(cur, plainSourceText(child.source), child.offset + child.length);
  cur.idx++;
  return true;
};

const continuationSourceText = (cur: PlainScalarCursor, child: CstNode): string | undefined =>
  cur.sawNewline && child.type !== "flow-scalar" && child.type !== "block-scalar" && cur.sourceText !== ""
    ? cur.sourceText
    : undefined;

const isContinuationColumn = (cur: PlainScalarCursor, child: CstNode, childCol: number): boolean => {
  if (child.type === "directive") return true;
  if (cur.minContinuationColumn !== undefined && childCol < cur.minContinuationColumn) return false;
  return childCol > 0;
};

const trimTrailingBlanks = (text: string, end: number): number => {
  let contentEnd = end;
  while (contentEnd > 0 && (text[contentEnd - 1] === " " || text[contentEnd - 1] === "\t")) contentEnd--;
  return contentEnd;
};

// decision: plain-continuation-lines
const absorbMistokenizedLine = (cur: PlainScalarCursor, child: CstNode): boolean => {
  const sourceText = continuationSourceText(cur, child);
  if (sourceText === undefined) return false;
  if (!isContinuationColumn(cur, child, lineCol(sourceText, child.offset).column)) return false;
  const { lineText, lineEndOffset } = extractLineContent(sourceText, child.offset);
  if (lineText.length === 0) return false;
  pushPlainScalarPart(cur, lineText, trimTrailingBlanks(sourceText, lineEndOffset));
  cur.idx = skipChildrenOnLine(cur.children, cur.idx, lineEndOffset);
  return true;
};

const scanPastTrivia = (
  children: readonly CstNode[],
  ...[startIdx, stopAt]: [startIdx: number, stopAt: (whitespace: CstNode) => boolean]
): number => {
  for (let j = startIdx; j < children.length; j++) {
    const c = children[j];
    if (c !== undefined && !isSkippedTrivia(c, stopAt)) return j;
  }
  return -1;
};

const isSkippedTrivia = (c: CstNode, stopAt: (whitespace: CstNode) => boolean): boolean =>
  c.type === "newline" || c.type === "comment" || (c.type === "whitespace" && !stopAt(c));

const isValueSepChild = (c: CstNode): boolean => c.source === ":";

/**
 * Finds the index of the next non-trivia child, skipping newline, whitespace, and comment nodes.
 *
 * **Details**
 *
 * If `stopAtDash` is true, returns null when a `-` indicator is encountered before
 * a significant child (used to avoid merging across sequence entry boundaries).
 *
 * **Example** (Skip a newline before content)
 *
 * ```ts
 * import { findNextSignificantChild } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "flow-scalar", source: "hello", offset: 0, length: 5 };
 * console.log(findNextSignificantChild([{ type: "newline", source: "\n", offset: 0, length: 1 }, node], 0)) // 1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const findNextSignificantChild: {
  (startIdx: number, stopAtDash?: boolean): (children: readonly CstNode[]) => number | null;
  (children: readonly CstNode[], startIdx: number, stopAtDash?: boolean): number | null;
} = dual(
  (args) => A.isArray(args[0]),
  (children: readonly CstNode[], startIdx: number, stopAtDash?: boolean): number | null => {
    const j = scanPastTrivia(children, startIdx, (c) => stopAtDash === true && Str.trim(c.source) === "-");
    return j < 0 || children[j]?.type === "whitespace" ? null : j;
  }
);

/**
 * Checks whether a value separator (`:`) follows in a CST children list, skipping whitespace and newlines.
 *
 * **Example** (Detect a following separator)
 *
 * ```ts
 * import { hasValueSepAfterInList } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "whitespace", source: ":", offset: 0, length: 1 };
 * console.log(hasValueSepAfterInList([node], 0)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasValueSepAfterInList: {
  (startIdx: number): (children: readonly CstNode[]) => boolean;
  (children: readonly CstNode[], startIdx: number): boolean;
} = dual(2, (children: readonly CstNode[], startIdx: number): boolean => findValueSepOffset(children, startIdx) >= 0);

/**
 * Checks whether the next non-trivia child starts a nested implicit mapping.
 *
 * **Details**
 *
 * A block-map indicates that the preceding scalar is the first key of a nested
 * implicit mapping. Returns false if a sibling `:` value-sep is encountered first,
 * since that means the scalar is a key at the current level (not a nested mapping start).
 *
 * **Example** (Detect a nested block map)
 *
 * ```ts
 * import { hasBlockMapAfterInList } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "block-map", source: "", offset: 0, length: 0 };
 * console.log(hasBlockMapAfterInList([node], 0)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasBlockMapAfterInList: {
  (startIdx: number): (children: readonly CstNode[]) => boolean;
  (children: readonly CstNode[], startIdx: number): boolean;
} = dual(
  2,
  (children: readonly CstNode[], startIdx: number): boolean =>
    children[scanPastTrivia(children, startIdx, isValueSepChild)]?.type === "block-map"
);

/**
 * Finds the offset of the next `:` value separator in a CST children list, or -1 if none.
 *
 * **Example** (Locate a separator offset)
 *
 * ```ts
 * import { findValueSepOffset } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "whitespace", source: ":", offset: 4, length: 1 };
 * console.log(findValueSepOffset([node], 0)) // 4
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const findValueSepOffset: {
  (startIdx: number): (children: readonly CstNode[]) => number;
  (children: readonly CstNode[], startIdx: number): number;
} = dual(2, (children: readonly CstNode[], startIdx: number): number => {
  const c = children[scanPastTrivia(children, startIdx, isValueSepChild)];
  return c?.type === "whitespace" ? c.offset : -1;
});

/**
 * Checks whether a `:` value separator exists between startIdx (inclusive) and endIdx (exclusive).
 *
 * **Example** (Search a bounded child range)
 *
 * ```ts
 * import { hasValueSepBetween } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "whitespace", source: ":", offset: 0, length: 1 };
 * console.log(hasValueSepBetween([node], 0, 1)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasValueSepBetween: {
  (startIdx: number, endIdx: number): (children: readonly CstNode[]) => boolean;
  (children: readonly CstNode[], startIdx: number, endIdx: number): boolean;
} = dual(3, (children: readonly CstNode[], startIdx: number, endIdx: number): boolean => {
  for (let j = startIdx; j < endIdx; j++) {
    const c = children[j];
    if (c === undefined) continue;
    if (c.type === "whitespace" && c.source === ":") return true;
  }
  return false;
});

/**
 * Detects a block map whose first non-trivia child is a `:` value separator.
 *
 * **Details**
 *
 * The block map begins with an implicit empty key followed by a value indicator.
 * Used to decide whether a pending anchor/tag belongs to that empty key rather
 * than to the block map itself.
 *
 * **Example** (Detect an implicit empty key)
 *
 * ```ts
 * import { blockMapStartsWithValueSep } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "whitespace", source: ":", offset: 0, length: 1 };
 * const map: CstNode = { type: "block-map", source: ":", offset: 0, length: 1, children: [node] };
 * console.log(blockMapStartsWithValueSep(map)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export function blockMapStartsWithValueSep(blockMap: CstNode): boolean {
  const children = blockMap.children ?? [];
  const first = children[scanPastTrivia(children, 0, isNonBlankChild)];
  return first?.type === "whitespace" && first.source === ":";
}

const isNonBlankChild = (c: CstNode): boolean => Str.trim(c.source) !== "";

/**
 * Detects a value separator beyond plain scalar continuation lines.
 *
 * **Details**
 *
 * Like `hasValueSepAfterInList`, but also skips over plain flow-scalars
 * that appear after a newline. Used to detect multi-line keys:
 * `multi\n  line: value` where `:` comes after continuation plain scalars.
 * Only allows skipping plain scalars that were preceded by a newline,
 * preventing false matches across comma-delimited entries on the same line.
 *
 * **Example** (Find a separator after a continuation)
 *
 * ```ts
 * import { hasValueSepThroughPlainScalars } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "flow-scalar", source: "line", offset: 0, length: 4 };
 * const children: CstNode[] = [
 *   { type: "newline", source: "\n", offset: 0, length: 1 },
 *   node,
 *   { type: "whitespace", source: ":", offset: 5, length: 1 },
 * ];
 * console.log(hasValueSepThroughPlainScalars(children, 0)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasValueSepThroughPlainScalars: {
  (startIdx: number): (children: readonly CstNode[]) => boolean;
  (children: readonly CstNode[], startIdx: number): boolean;
} = dual(2, (children: readonly CstNode[], startIdx: number): boolean => {
  let sawNewline = false;
  for (let j = startIdx; j < children.length; j++) {
    const c = children[j];
    if (c?.type === "newline") sawNewline = true;
    const verdict = c === undefined ? undefined : valueSepThroughPlainVerdict(c, sawNewline);
    if (verdict !== undefined) return verdict;
  }
  return false;
});

const valueSepThroughPlainVerdict = (c: CstNode, sawNewline: boolean): boolean | undefined => {
  if (c.type === "newline" || c.type === "comment") return undefined;
  if (c.type === "whitespace") return whitespaceSepVerdict(c.source);
  return sawNewline && isPlainFlowScalar(c) ? undefined : false;
};

const whitespaceSepVerdict = (source: string): boolean | undefined => {
  if (source === ":") return true;
  return source === "," ? false : undefined;
};

/**
 * Finds the next non-trivia CST child in a list, returning the node and its index.
 *
 * **Example** (Read the next content index)
 *
 * ```ts
 * import { findNextContentInList } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "flow-scalar", source: "hello", offset: 0, length: 5 };
 * console.log(findNextContentInList([node], 0)?.idx) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const findNextContentInList: {
  (startIdx: number): (children: readonly CstNode[]) => { node: CstNode; idx: number } | null;
  (children: readonly CstNode[], startIdx: number): { node: CstNode; idx: number } | null;
} = dual(2, (children: readonly CstNode[], startIdx: number): { node: CstNode; idx: number } | null => {
  for (let j = startIdx; j < children.length; j++) {
    const c = children[j];
    if (c === undefined) continue;
    if (c.type === "whitespace" || c.type === "newline" || c.type === "comment") continue;
    return { node: c, idx: j };
  }
  return null;
});

/**
 * Finds the first child other than a newline or blank whitespace.
 *
 * **Details**
 *
 * Comments and structural whitespace indicators count as content.
 *
 * **Example** (Read the first content slice)
 *
 * ```ts
 * import { findFirstContent } from "@beep/yaml/internal/composer/scalars";
 * import * as O from "effect/Option";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "flow-scalar", source: "hello", offset: 0, length: 5 };
 * console.log(findFirstContent([node]).pipe(O.map((c) => c.source), O.getOrUndefined)) // hello
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function findFirstContent(children: readonly CstNode[]): O.Option<CstNode> {
  for (const c of children) {
    if (c === undefined) continue;
    if (c.type === "whitespace" && Str.trim(c.source) === "") continue;
    if (c.type === "newline") continue;
    return O.some(c);
  }
  return O.none();
}

/**
 * Finds the last child other than a newline or blank whitespace.
 *
 * **Details**
 *
 * Comments and structural whitespace indicators count as content.
 *
 * **Example** (Read the last content slice)
 *
 * ```ts
 * import { findLastContent } from "@beep/yaml/internal/composer/scalars";
 * import * as O from "effect/Option";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "flow-scalar", source: "hello", offset: 0, length: 5 };
 * console.log(findLastContent([node]).pipe(O.map((c) => c.source), O.getOrUndefined)) // hello
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function findLastContent(children: readonly CstNode[]): O.Option<CstNode> {
  for (let i = children.length - 1; i >= 0; i--) {
    const c = children[i];
    if (c === undefined) continue;
    if (c.type === "whitespace" && Str.trim(c.source) === "") continue;
    if (c.type === "newline") continue;
    return O.some(c);
  }
  return O.none();
}

/**
 * Finds the next content child, skipping trivia and anchor/tag properties, or null.
 *
 * **Details**
 *
 * Used at the document level where properties precede content.
 *
 * **Example** (Skip properties before document content)
 *
 * ```ts
 * import { findNextContentChild } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "flow-scalar", source: "hello", offset: 0, length: 5 };
 * console.log(findNextContentChild([node], 0)?.source) // hello
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const findNextContentChild: {
  (startIdx: number): (children: readonly CstNode[]) => CstNode | null;
  (children: readonly CstNode[], startIdx: number): CstNode | null;
} = dual(2, (children: readonly CstNode[], startIdx: number): CstNode | null => {
  for (let i = startIdx; i < children.length; i++) {
    const c = children[i];
    if (c === undefined) continue;
    if (
      c.type === "whitespace" ||
      c.type === "newline" ||
      c.type === "comment" ||
      c.type === "anchor" ||
      c.type === "tag"
    )
      continue;
    return c;
  }
  return null;
});

/**
 * Locates a CST child by object identity, returning -1 when absent.
 *
 * **Example** (Locate a child reference)
 *
 * ```ts
 * import { indexOfChild } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "flow-scalar", source: "hello", offset: 0, length: 5 };
 * console.log(indexOfChild([node], node)) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const indexOfChild: {
  (target: CstNode): (children: readonly CstNode[]) => number;
  (children: readonly CstNode[], target: CstNode): number;
} = dual(2, (children: readonly CstNode[], target: CstNode): number => {
  for (let i = 0; i < children.length; i++) {
    if (children[i] === target) return i;
  }
  return -1;
});

/**
 * Checks whether a `:` value separator follows startIdx through whitespace and newlines.
 *
 * **Details**
 *
 * The scan skips whitespace and newlines, but stops at other node types, including comments.
 *
 * **Example** (Detect a separator after whitespace)
 *
 * ```ts
 * import { hasValueSepAfter } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 *
 * const node: CstNode = { type: "whitespace", source: ":", offset: 0, length: 1 };
 * console.log(hasValueSepAfter([node], 0)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasValueSepAfter: {
  (startIdx: number): (children: readonly CstNode[]) => boolean;
  (children: readonly CstNode[], startIdx: number): boolean;
} = dual(2, (children: readonly CstNode[], startIdx: number): boolean => {
  for (let j = startIdx; j < children.length; j++) {
    const verdict = valueSepAfterVerdict(children[j]);
    if (verdict !== undefined) return verdict;
  }
  return false;
});

const valueSepAfterVerdict = (c: CstNode | undefined): boolean | undefined => {
  if (c === undefined || c.type === "newline") return undefined;
  if (c.type !== "whitespace") return false;
  return c.source === ":" ? true : undefined;
};

// decision: block-scalar-indentation
const findParentIndent: {
  (fullText: string, indicatorOffset: number): number;
  (indicatorOffset: number): (fullText: string) => number;
} = dual(2, (fullText: string, indicatorOffset: number): number => {
  const cur = { scanBack: indicatorOffset - 1, lineStart: indicatorOffset };
  while (cur.scanBack >= 0) {
    const indent = parentIndentStep(fullText, cur);
    if (indent !== undefined) return indent;
  }
  return 0;
});

const parentIndentStep = (text: string, cur: { scanBack: number; lineStart: number }): number | undefined => {
  if (cur.scanBack < cur.lineStart && !enterLineBackward(text, cur)) return undefined;
  const ch = text[cur.scanBack];
  if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
    cur.scanBack--;
    return undefined;
  }
  const tokenStart = tokenStartOf(text, cur.scanBack);
  const opaquePropertyToken = text[tokenStart] === "!" || text[tokenStart] === "&";
  if (opaquePropertyToken) {
    cur.scanBack = tokenStart - 1;
    return undefined;
  }
  const indent = indicatorParentIndent(text, cur.scanBack, tokenStart);
  cur.scanBack--;
  return indent;
};

const enterLineBackward = (text: string, cur: { scanBack: number; lineStart: number }): boolean => {
  cur.lineStart = lineStartOf(text, cur.scanBack);
  const hash = findLineCommentStart(text, cur.lineStart, cur.scanBack);
  if (hash >= 0) cur.scanBack = hash - 1;
  return cur.scanBack >= cur.lineStart;
};

const tokenStartOf = (text: string, pos: number): number => {
  let tokenStart = pos;
  while (tokenStart > 0 && !/[ \t\r\n]/.test(text[tokenStart - 1] ?? "")) tokenStart--;
  return tokenStart;
};

const indicatorParentIndent = (text: string, pos: number, tokenStart: number): number | undefined => {
  const after = text[pos + 1];
  if (after !== undefined && !/[ \t\r\n]/.test(after)) return undefined;
  const ch = text[pos];
  if (ch === ":") return findKeyIndent(text, pos);
  return ch === "-" && pos === tokenStart ? findColOnLine(text, pos) : undefined;
};

const findLineCommentStart = (text: string, lineStart: number, end: number): number => {
  const scan: { quote: string | undefined; tokenStart: boolean } = { quote: undefined, tokenStart: true };
  for (let i = lineStart; i <= end; i++) {
    const c = text[i];
    if (scan.quote !== undefined) i = advanceInQuote(text, i, scan);
    else if (isCommentStartAt(text, lineStart, i)) return i;
    else if (scan.tokenStart && isQuoteChar(c)) scan.quote = c;
    scan.tokenStart = isTokenBoundaryChar(c);
  }
  return -1;
};

const isCommentStartAt = (text: string, lineStart: number, i: number): boolean =>
  text[i] === "#" && (i === lineStart || /[ \t]/.test(text[i - 1] ?? ""));

const isQuoteChar = (c: string | undefined): c is string => c === "'" || c === '"';

const isTokenBoundaryChar = (c: string | undefined): boolean =>
  c === " " || c === "\t" || c === "[" || c === "{" || c === ",";

const advanceInQuote = (text: string, i: number, scan: { quote: string | undefined }): number => {
  const c = text[i];
  if (scan.quote === '"' && c === "\\") return i + 1;
  if (c !== scan.quote) return i;
  if (scan.quote === "'" && text[i + 1] === "'") return i + 1;
  scan.quote = undefined;
  return i;
};

const lineStartOf = (text: string, pos: number): number => {
  let lineStart = pos;
  while (lineStart > 0 && text[lineStart - 1] !== "\n" && text[lineStart - 1] !== "\r") lineStart--;
  return lineStart;
};

const findColOnLine: {
  (text: string, pos: number): number;
  (pos: number): (text: string) => number;
} = dual(2, (text: string, pos: number): number => pos - lineStartOf(text, pos));

const lineEndFrom = (raw: string, i: number): number => {
  let j = i;
  while (j < raw.length && raw[j] !== "\n" && raw[j] !== "\r") j++;
  return j;
};

const skipLineBreak = (raw: string, i: number): number => {
  if (i >= raw.length) return i;
  return raw[i] === "\r" && raw[i + 1] === "\n" ? i + 2 : i + 1;
};

const countLeadingSpaces = (raw: string, i: number): number => {
  let j = i;
  while (j < raw.length && raw[j] === " ") j++;
  return j - i;
};

const isLineEnd = (raw: string, i: number): boolean => i >= raw.length || raw[i] === "\n" || raw[i] === "\r";

const makeBlockHeader = (
  bodyStart: number
): { chomp: "clip" | "strip" | "keep"; explicitIndent: number; i: number } => ({
  chomp: "clip",
  explicitIndent: 0,
  i: bodyStart,
});
type BlockHeader = ReturnType<typeof makeBlockHeader>;

const readHeaderIndicator = (raw: string, header: BlockHeader): boolean => {
  const ch = raw[header.i];
  if (ch === "-" || ch === "+") {
    header.chomp = ch === "-" ? "strip" : "keep";
  } else if (ch !== undefined && ch >= "1" && ch <= "9") {
    header.explicitIndent = Number.parseInt(ch, 10);
  } else {
    return false;
  }
  header.i++;
  return true;
};

const parseBlockHeader = (raw: string, indicatorAt: number): BlockHeader => {
  const header = makeBlockHeader(indicatorAt + 1);
  let count = 0;
  while (count < 2 && readHeaderIndicator(raw, header)) count++;
  header.i = skipLineBreak(raw, lineEndFrom(raw, header.i));
  return header;
};

const resolveContentIndent = (
  raw: string,
  header: BlockHeader,
  fullText: string | undefined,
  nodeOffset: number | undefined
): number | undefined => {
  if (header.explicitIndent === 0) return detectContentIndent(raw, header.i);
  if (fullText === undefined || nodeOffset === undefined) return header.explicitIndent;
  return findParentIndent(fullText, nodeOffset) + header.explicitIndent;
};

const detectContentIndent = (raw: string, start: number): number | undefined => {
  let scanAhead = start;
  while (scanAhead < raw.length) {
    const spaces = countLeadingSpaces(raw, scanAhead);
    scanAhead += spaces;
    if (!isLineEnd(raw, scanAhead)) return spaces;
    scanAhead = skipLineBreak(raw, scanAhead);
  }
  return undefined;
};

const countKeptEmptyLines = (raw: string, start: number): number => {
  let count = 0;
  let j = start;
  while (j < raw.length) {
    j = skipBlanks(raw, j);
    if (j >= raw.length) return Math.max(count, 1);
    count++;
    j = skipKeptBreak(raw, j);
  }
  return count;
};

const skipKeptBreak = (raw: string, j: number): number => (raw[j] !== "\n" && raw[j + 1] === "\n" ? j + 2 : j + 1);

const makeBlockBody = (): { lines: string[]; trailing: number } => ({ lines: [], trailing: 0 });
type BlockBody = ReturnType<typeof makeBlockBody>;

const pushBlockLine = (body: BlockBody, line: string): void => {
  for (let k = 0; k < body.trailing; k++) body.lines.push("");
  body.trailing = 0;
  body.lines.push(line);
};

const pushBlankBlockLine = (body: BlockBody, extra: number): void => {
  if (extra > 0) pushBlockLine(body, Str.repeat(extra)(" "));
  else body.trailing++;
};

const collectBlockBody = (raw: string, start: number, contentIndent: number): BlockBody => {
  const body = makeBlockBody();
  let i = start;
  while (i < raw.length) {
    const spaces = countLeadingSpaces(raw, i);
    i += spaces;
    if (isLineEnd(raw, i)) {
      pushBlankBlockLine(body, spaces - contentIndent);
      i = skipLineBreak(raw, i);
      continue;
    }
    if (spaces < contentIndent) break;
    const contentEnd = lineEndFrom(raw, i);
    pushBlockLine(body, Str.repeat(spaces - contentIndent)(" ") + Str.slice(i, contentEnd)(raw));
    i = skipLineBreak(raw, contentEnd);
  }
  return body;
};

const chompSuffix = (chomp: BlockHeader["chomp"], hasContent: boolean, trailing: number): string => {
  if (chomp === "strip") return "";
  const finalBreakOnlyAfterContent = hasContent ? "\n" : "";
  return chomp === "keep" ? finalBreakOnlyAfterContent + Str.repeat(trailing)("\n") : finalBreakOnlyAfterContent;
};

function decodeBlockScalar(raw: string, fullText?: string, nodeOffset?: number): string {
  const isFolded = Str.trimStart(raw)[0] === ">";
  const indicatorAt = O.getOrElse(constant(-1))(Str.indexOf(isFolded ? ">" : "|")(raw));
  if (indicatorAt < 0) return "";
  const header = parseBlockHeader(raw, indicatorAt);
  const contentIndent = resolveContentIndent(raw, header, fullText, nodeOffset);
  if (contentIndent === undefined) {
    return header.chomp === "keep" ? Str.repeat(countKeptEmptyLines(raw, header.i))("\n") : "";
  }
  const { lines, trailing } = collectBlockBody(raw, header.i, contentIndent);
  if (isFolded) return foldBlockLines(lines) + chompSuffix(header.chomp, hasBlockContent(lines), trailing);
  return A.join(lines, "\n") + chompSuffix(header.chomp, lines.length > 0, trailing);
}

const validateBlockScalarLeadingEmpties: {
  (cst: CstNode, state: ComposerState): void;
  (state: ComposerState): (cst: CstNode) => void;
} = dual(2, (cst: CstNode, state: ComposerState): void => {
  const raw = cst.source;
  let i = skipLineBreak(raw, lineEndFrom(raw, 0));
  const emptyIndents: { indent: number; offsetInRaw: number }[] = [];
  while (i < raw.length) {
    const lineStart = i;
    const spaces = countLeadingSpaces(raw, i);
    i += spaces;
    if (!isLineEnd(raw, i)) {
      reportOverIndentedEmpty(cst, state, emptyIndents, spaces);
      return;
    }
    emptyIndents.push({ indent: spaces, offsetInRaw: lineStart });
    i = skipLineBreak(raw, i);
  }
});

const reportOverIndentedEmpty = (
  cst: CstNode,
  state: ComposerState,
  emptyIndents: ReadonlyArray<{ indent: number; offsetInRaw: number }>,
  contentIndent: number
): void => {
  const empty = O.getOrUndefined(A.findFirst(emptyIndents, (e) => e.indent > contentIndent));
  if (empty === undefined) return;
  state.errors.push(
    RawDiagnostic.make({
      code: "InvalidIndentation",
      message: "Block scalar leading empty line cannot be more indented than the first content line",
      offset: cst.offset + empty.offsetInRaw,
      length: empty.indent,
    })
  );
};

/**
 * Builds a plain scalar carrying `meta`'s tag and anchor, registering the
 * anchor (when non-empty) at `offset`.
 *
 * **Example** (Materialize an anchored empty value)
 *
 * ```ts
 * import { scalarWithMeta } from "@beep/yaml/internal/composer/scalars"
 * import { createState, NodeMeta } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 *
 * const state = createState("&a", { composeFlowMap, composeFlowSeq })
 * const scalar = scalarWithMeta(null, NodeMeta.make({ anchor: "a" }), state, 2, 0)
 * console.log(scalar.anchor, scalar.value) // a null
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export function scalarWithMeta(
  value: unknown,
  ...[meta, state, offset, length]: [meta: NodeMeta, state: ComposerState, offset: number, length: number]
): YamlScalar {
  const scalar = YamlScalar.make({
    value,
    style: "plain",
    offset,
    length,
    ...O.getSomesStruct({ tag: O.fromUndefinedOr(meta.tag), anchor: O.fromUndefinedOr(meta.anchor) }),
  });
  if (meta.anchor !== undefined && meta.anchor !== "") registerAnchor(scalar, meta.anchor, state, offset);
  return scalar;
}

/**
 * Resolves plain scalar text under `meta`'s tag, then builds it with
 * {@link scalarWithMeta}.
 *
 * **Example** (Resolve a tagged empty value)
 *
 * ```ts
 * import { plainScalarWithMeta } from "@beep/yaml/internal/composer/scalars"
 * import { createState, NodeMeta } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 *
 * const state = createState("!!str", { composeFlowMap, composeFlowSeq })
 * const scalar = plainScalarWithMeta("", NodeMeta.make({ tag: "!!str" }), state, 5, 0)
 * console.log(JSON.stringify(scalar.value), scalar.tag) // "" !!str
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export function plainScalarWithMeta(
  raw: string,
  ...[meta, state, offset, length]: [meta: NodeMeta, state: ComposerState, offset: number, length: number]
): YamlScalar {
  return scalarWithMeta(resolveScalar(raw, ["plain", meta.tag, state, meta.tagSpan]), meta, state, offset, length);
}

/**
 * Constructs a resolved YAML scalar while retaining source metadata and recording composition diagnostics.
 *
 * **Details**
 *
 * Block scalars retain their chomp and indentation indicators and header-line comments.
 * Leading empty lines are validated before decoding. Anchored scalars are registered
 * in composer state. Noncanonical plain numeric spelling is retained for round trips.
 *
 * **Example** (Compose a numeric scalar)
 *
 * ```ts
 * import { makeScalar } from "@beep/yaml/internal/composer/scalars";
 * import type { CstNode } from "@beep/yaml/internal/cst";
 * import { createState } from "@beep/yaml/internal/composer/state";
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow";
 *
 * const node: CstNode = { type: "flow-scalar", source: "42", offset: 0, length: 2 };
 * const state = createState("42", { composeFlowMap, composeFlowSeq });
 * console.log(makeScalar(node, state).value) // 42
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeScalar: {
  (state: ComposerState, meta?: NodeMeta): (cst: CstNode) => YamlScalar;
  (cst: CstNode, state: ComposerState, meta?: NodeMeta): YamlScalar;
} = dual(
  (args) => P.hasProperty(args[0], "source"),
  (cst: CstNode, state: ComposerState, meta?: NodeMeta): YamlScalar => {
    const style = getScalarStyle(cst);
    const isBlock = style === "block-literal" || style === "block-folded";
    if (isBlock) validateBlockScalarLeadingEmpties(cst, state);
    const rawValue = getScalarValue(cst, state.text);
    const value = resolveScalar(rawValue, [style, meta?.tag, state, meta?.tagSpan]);
    const scalar = YamlScalar.make({
      value,
      style,
      offset: cst.offset,
      length: cst.length,
      ...scalarDecorations(cst, meta, isBlock),
      ...rawSpelling(style, rawValue, value),
    });
    registerMetaAnchor(scalar, meta, state, cst.offset);
    return scalar;
  }
);

// decision: comments-on-nodes
const scalarDecorations = (cst: CstNode, meta: NodeMeta | undefined, isBlock: boolean) => {
  const chomp = getBlockChomp(cst);
  const blockIndent = getBlockIndent(cst);
  const headerComment = isBlock ? blockScalarHeaderComment(cst) : undefined;
  return O.getSomesStruct({
    tag: O.fromUndefinedOr(meta?.tag),
    anchor: O.fromUndefinedOr(meta?.anchor),
    comment: O.fromUndefinedOr(headerComment ?? meta?.comment),
    chomp,
    blockIndent,
  });
};

const rawSpelling = (style: ScalarStyle, rawValue: string, value: unknown): { raw?: string } =>
  style === "plain" && !P.isString(value) && shouldPreserveRaw(rawValue, value) ? { raw: rawValue } : {};

/**
 * Determines whether a scalar's source representation should be preserved for canonical round-trip.
 *
 * **Details**
 *
 * The source form differs from `String(value)` but resolves to the same value.
 *
 * Special-float values (NaN, +/-Infinity) are excluded: their canonical YAML
 * spelling is the lowercase `.inf` / `.nan` form per spec §10.3, so source
 * variants like `.INF` or `.NaN` should normalize on round-trip rather than
 * preserve.
 *
 * **Example** (Preserve hexadecimal spelling)
 *
 * ```ts
 * import { shouldPreserveRaw } from "@beep/yaml/internal/composer/scalars";
 *
 * console.log(shouldPreserveRaw("0x10", 16), shouldPreserveRaw("16", 16)) // true false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const shouldPreserveRaw: {
  (value: unknown): (rawValue: string) => boolean;
  (rawValue: string, value: unknown): boolean;
} = dual(2, (rawValue: string, value: unknown): boolean => {
  if (P.isNumber(value)) {
    if (Number.isNaN(value) || !Number.isFinite(value)) return false;
    return rawValue !== String(value);
  }
  return false;
});
