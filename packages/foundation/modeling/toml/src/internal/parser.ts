import * as O from "@beep/utils/Option";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import {
  TomlArray,
  TomlArrayTableHeader,
  TomlBoolean,
  TomlDateTimeLiteral,
  TomlFloat,
  TomlInlineEntry,
  TomlInlineTable,
  TomlInteger,
  TomlKey,
  TomlKeyValue,
  TomlString,
  TomlTableHeader,
  TomlTrivia,
} from "../TomlNode.ts";
import { raise } from "./diagnostics.ts";
import { GuardExceeded, MAX_NESTING_DEPTH } from "./limits.ts";
import {
  assertValidUnicode,
  classifyValueToken,
  scanBareKey,
  scanBasicString,
  scanComment,
  scanLiteralString,
  scanMultilineBasicString,
  scanMultilineLiteralString,
  scanNewline,
  scanValueToken,
  scanWhitespace,
  skipBom,
} from "./scanner.ts";
import type { TomlExpression, TomlValueNode } from "../TomlNode.ts";
import type { ScanResult } from "./scanner.ts";

const LF = "\n";
const CR = "\r";
const QUOTE = '"';
const HASH = "#";
const APOSTROPHE = "'";
const COMMA = ",";
const DOT = ".";
const EQUALS = "=";
const LEFT_BRACKET = "[";
const RIGHT_BRACKET = "]";
const LEFT_BRACE = "{";
const RIGHT_BRACE = "}";

interface Parsed<T> {
  readonly end: number;
  readonly node: T;
}

const stripOneLeadingCommentSpace = (raw: string): string => (Str.startsWith(" ")(raw) ? Str.slice(1)(raw) : raw);

const parseSimpleKey: {
  (source: string, pos: number): Parsed<TomlKey>;
  (pos: number): (source: string) => Parsed<TomlKey>;
} = dual(2, (source: string, pos: number): Parsed<TomlKey> => {
  const code = source[pos];
  if (code === QUOTE) {
    const scanned = scanBasicString(source, pos);
    return {
      node: TomlKey.make({ value: scanned.value, kind: "basic", offset: pos, length: scanned.end - pos }),
      end: scanned.end,
    };
  }
  if (code === APOSTROPHE) {
    const scanned = scanLiteralString(source, pos);
    return {
      node: TomlKey.make({ value: scanned.value, kind: "literal", offset: pos, length: scanned.end - pos }),
      end: scanned.end,
    };
  }
  const bare = scanBareKey(source, pos);
  if (bare.end === pos) {
    return raise("ExpectedKey", "expected a key", pos, 1);
  }
  return {
    node: TomlKey.make({ value: bare.value, kind: "bare", offset: pos, length: bare.end - pos }),
    end: bare.end,
  };
});

const parseKeyPath: {
  (source: string, pos: number): Parsed<ReadonlyArray<TomlKey>>;
  (pos: number): (source: string) => Parsed<ReadonlyArray<TomlKey>>;
} = dual(2, (source: string, pos: number): Parsed<ReadonlyArray<TomlKey>> => {
  const keys: Array<TomlKey> = [];
  const first = parseSimpleKey(source, pos);
  keys.push(first.node);
  let i = first.end;
  for (;;) {
    const afterWs = scanWhitespace(source, i);
    if (source[afterWs] !== DOT) {
      break;
    }
    const keyStart = scanWhitespace(source, afterWs + 1);
    const next = parseSimpleKey(source, keyStart);
    keys.push(next.node);
    i = next.end;
  }
  return { node: keys, end: i };
});

const parseLineEnd: {
  (source: string, pos: number): { readonly comment?: string; readonly end: number };
  (pos: number): (source: string) => { readonly comment?: string; readonly end: number };
} = dual(2, (source: string, pos: number): { readonly comment?: string; readonly end: number } => {
  let i = scanWhitespace(source, pos);
  let comment: string | undefined;
  if (source[i] === HASH) {
    const scanned = scanComment(source, i);
    comment = stripOneLeadingCommentSpace(scanned.value);
    i = scanned.end;
  }
  if (i >= source.length) {
    return { ...O.getSomesStruct({ comment: O.fromUndefinedOr(comment) }), end: i };
  }
  const after = scanNewline(source, i);
  if (after === i) {
    return raise("ExpectedNewline", "expected a newline after the expression", i, 1);
  }
  return { ...O.getSomesStruct({ comment: O.fromUndefinedOr(comment) }), end: after };
});

const skipWhitespaceNewlinesAndComments: {
  (source: string, pos: number): number;
  (pos: number): (source: string) => number;
} = dual(2, (source: string, pos: number): number => {
  let i = pos;
  for (;;) {
    i = scanWhitespace(source, i);
    if (source[i] === HASH) {
      i = scanComment(source, i).end;
      continue;
    }
    const after = scanNewline(source, i);
    if (after !== i) {
      i = after;
      continue;
    }
    return i;
  }
});

const isFloatToken = (token: string): boolean =>
  !/^0[xob]/.test(token) && (/[.eE]/.test(token) || Str.includes("inf")(token) || Str.includes("nan")(token));

const assertNestingDepth = (depth: number, openPos: number): void => {
  if (depth > MAX_NESTING_DEPTH) {
    throw GuardExceeded.new("NestingDepthExceeded", MAX_NESTING_DEPTH, depth, openPos);
  }
};

const assertArrayOpen = (source: string, i: number, openPos: number): void => {
  if (i >= source.length) {
    raise("UnterminatedArray", "array not closed before end of input", openPos, i - openPos);
  }
};

const arraySeparatorCloses = (source: string, i: number, openPos: number): boolean => {
  const code = source[i];
  if (code === COMMA) {
    return false;
  }
  if (code === RIGHT_BRACKET) {
    return true;
  }
  assertArrayOpen(source, i, openPos);
  return raise("UnterminatedArray", "expected , or ] in array", i, 1);
};

const parseArray: {
  (source: string, openPos: number, depth: number): Parsed<TomlArray>;
  (openPos: number, depth: number): (source: string) => Parsed<TomlArray>;
} = dual(3, (source: string, openPos: number, depth: number): Parsed<TomlArray> => {
  assertNestingDepth(depth, openPos);
  const items: Array<TomlValueNode> = [];
  let i = openPos + 1;
  for (;;) {
    i = skipWhitespaceNewlinesAndComments(source, i);
    assertArrayOpen(source, i, openPos);
    if (source[i] === RIGHT_BRACKET) {
      i += 1;
      break;
    }
    const item = parseValue(source, i, depth);
    items.push(item.node);
    i = skipWhitespaceNewlinesAndComments(source, item.end);
    const closes = arraySeparatorCloses(source, i, openPos);
    i += 1;
    if (closes) {
      break;
    }
  }
  return { node: TomlArray.make({ items, offset: openPos, length: i - openPos }), end: i };
});

const assertInlineTableOpen = (source: string, i: number, openPos: number): void => {
  if (i >= source.length) {
    raise("UnterminatedInlineTable", "inline table not closed before end of input", openPos, i - openPos);
  }
};

const inlineSeparatorCloses = (source: string, i: number, openPos: number): boolean => {
  const code = source[i];
  if (code === RIGHT_BRACE) {
    return true;
  }
  if (code === COMMA) {
    return false;
  }
  assertInlineTableOpen(source, i, openPos);
  return raise("UnterminatedInlineTable", "expected , or } in inline table", i, 1);
};

const parseInlineEntry = (source: string, entryStart: number, depth: number): Parsed<TomlInlineEntry> => {
  const keyPath = parseKeyPath(source, entryStart);
  const equalsPos = scanWhitespace(source, keyPath.end);
  if (source[equalsPos] !== EQUALS) {
    raise("ExpectedEquals", "expected = after key", equalsPos, 1);
  }
  const value = parseValue(source, scanWhitespace(source, equalsPos + 1), depth);
  return {
    node: TomlInlineEntry.make({
      keyPath: keyPath.node,
      value: value.node,
      offset: entryStart,
      length: value.end - entryStart,
    }),
    end: value.end,
  };
};

const parseInlineTable: {
  (source: string, openPos: number, depth: number): Parsed<TomlInlineTable>;
  (openPos: number, depth: number): (source: string) => Parsed<TomlInlineTable>;
} = dual(3, (source: string, openPos: number, depth: number): Parsed<TomlInlineTable> => {
  assertNestingDepth(depth, openPos);
  const entries: Array<TomlInlineEntry> = [];
  let i = openPos + 1;
  for (;;) {
    i = skipWhitespaceNewlinesAndComments(source, i);
    assertInlineTableOpen(source, i, openPos);
    if (source[i] === RIGHT_BRACE) {
      i += 1;
      break;
    }
    const entry = parseInlineEntry(source, i, depth);
    entries.push(entry.node);
    i = skipWhitespaceNewlinesAndComments(source, entry.end);
    const closes = inlineSeparatorCloses(source, i, openPos);
    i += 1;
    if (closes) {
      break;
    }
  }
  return { node: TomlInlineTable.make({ entries, offset: openPos, length: i - openPos }), end: i };
});

const scalarNode: {
  (source: string, pos: number): Parsed<TomlValueNode>;
  (pos: number): (source: string) => Parsed<TomlValueNode>;
} = dual(2, (source: string, pos: number): Parsed<TomlValueNode> => {
  const token = scanValueToken(source, pos);
  const scalar = classifyValueToken(token.value, pos);
  const length = token.end - pos;
  if (P.isBoolean(scalar)) {
    return { node: TomlBoolean.make({ value: scalar, offset: pos, length }), end: token.end };
  }
  if (P.isBigInt(scalar)) {
    return { node: TomlInteger.make({ value: scalar, offset: pos, length }), end: token.end };
  }
  if (P.isNumber(scalar)) {
    const node = isFloatToken(token.value)
      ? TomlFloat.make({ value: scalar, offset: pos, length })
      : TomlInteger.make({ value: scalar, offset: pos, length });
    return { node, end: token.end };
  }
  return { node: TomlDateTimeLiteral.make({ value: scalar, offset: pos, length }), end: token.end };
});

const isNonValueStart = (code: string | undefined): boolean =>
  code === LF ||
  code === CR ||
  code === HASH ||
  code === COMMA ||
  code === EQUALS ||
  code === RIGHT_BRACKET ||
  code === RIGHT_BRACE;

const hasTripleStringDelimiter = (source: string, pos: number, delimiter: string): boolean =>
  source[pos + 1] === delimiter && source[pos + 2] === delimiter;

const stringNode = (scanned: ScanResult<string>, style: TomlString["style"], pos: number): Parsed<TomlValueNode> => ({
  node: TomlString.make({ value: scanned.value, style, offset: pos, length: scanned.end - pos }),
  end: scanned.end,
});

const parseBasicStringValue = (source: string, pos: number): Parsed<TomlValueNode> =>
  hasTripleStringDelimiter(source, pos, QUOTE)
    ? stringNode(scanMultilineBasicString(source, pos), "multiline-basic", pos)
    : stringNode(scanBasicString(source, pos), "basic", pos);

const parseLiteralStringValue = (source: string, pos: number): Parsed<TomlValueNode> =>
  hasTripleStringDelimiter(source, pos, APOSTROPHE)
    ? stringNode(scanMultilineLiteralString(source, pos), "multiline-literal", pos)
    : stringNode(scanLiteralString(source, pos), "literal", pos);

const parseValue: {
  (source: string, pos: number, depth: number): Parsed<TomlValueNode>;
  (pos: number, depth: number): (source: string) => Parsed<TomlValueNode>;
} = dual(3, (source: string, pos: number, depth: number): Parsed<TomlValueNode> => {
  const code = source[pos];
  if (pos >= source.length || isNonValueStart(code)) {
    return raise("ExpectedValue", "expected a value", pos, 1);
  }
  if (code === QUOTE) {
    return parseBasicStringValue(source, pos);
  }
  if (code === APOSTROPHE) {
    return parseLiteralStringValue(source, pos);
  }
  if (code === LEFT_BRACKET) {
    return parseArray(source, pos, depth + 1);
  }
  if (code === LEFT_BRACE) {
    return parseInlineTable(source, pos, depth + 1);
  }
  return scalarNode(source, pos);
});

const parseKeyValueExpression: {
  (source: string, lineStart: number, keyStart: number): Parsed<TomlKeyValue>;
  (lineStart: number, keyStart: number): (source: string) => Parsed<TomlKeyValue>;
} = dual(3, (source: string, lineStart: number, keyStart: number): Parsed<TomlKeyValue> => {
  const keyPath = parseKeyPath(source, keyStart);
  const equalsPos = scanWhitespace(source, keyPath.end);
  if (source[equalsPos] !== EQUALS) {
    raise("ExpectedEquals", "expected = after key", equalsPos, 1);
  }
  const valueStart = scanWhitespace(source, equalsPos + 1);
  const value = parseValue(source, valueStart, 0);
  const lineEnd = parseLineEnd(source, value.end);
  return {
    node: TomlKeyValue.make({
      keyPath: keyPath.node,
      value: value.node,
      ...O.getSomesStruct({ comment: O.fromUndefinedOr(lineEnd.comment) }),
      offset: lineStart,
      length: lineEnd.end - lineStart,
    }),
    end: lineEnd.end,
  };
});

const closeArrayTableHeader = (source: string, i: number): number => {
  if (source[i] !== RIGHT_BRACKET || source[i + 1] !== RIGHT_BRACKET) {
    raise("ExpectedTableHeaderClose", "expected ]] to close the array-of-tables header", i, 1);
  }
  return i + 2;
};

const closeTableHeader = (source: string, i: number): number => {
  if (source[i] !== RIGHT_BRACKET) {
    raise("ExpectedTableHeaderClose", "expected ] to close the table header", i, 1);
  }
  return i + 1;
};

const parseHeaderExpression: {
  (source: string, lineStart: number, bracketPos: number): Parsed<TomlTableHeader | TomlArrayTableHeader>;
  (lineStart: number, bracketPos: number): (source: string) => Parsed<TomlTableHeader | TomlArrayTableHeader>;
} = dual(3, (source: string, lineStart: number, bracketPos: number): Parsed<TomlTableHeader | TomlArrayTableHeader> => {
  const isArrayTable = source[bracketPos + 1] === LEFT_BRACKET;
  const keyStart = scanWhitespace(source, bracketPos + (isArrayTable ? 2 : 1));
  const keyPath = parseKeyPath(source, keyStart);
  const closePos = scanWhitespace(source, keyPath.end);
  const lineEnd = parseLineEnd(
    source,
    isArrayTable ? closeArrayTableHeader(source, closePos) : closeTableHeader(source, closePos)
  );
  const fields = {
    keyPath: keyPath.node,
    ...O.getSomesStruct({ comment: O.fromUndefinedOr(lineEnd.comment) }),
    offset: lineStart,
    length: lineEnd.end - lineStart,
  };
  return { node: isArrayTable ? TomlArrayTableHeader.make(fields) : TomlTableHeader.make(fields), end: lineEnd.end };
});

const isTriviaLine = (source: string, i: number): boolean => {
  const code = source[i];
  return i >= source.length || code === LF || code === CR || code === HASH;
};

const triviaLineEnd = (source: string, i: number): number => {
  const contentEnd = source[i] === HASH ? scanComment(source, i).end : i;
  return contentEnd < source.length ? scanNewline(source, contentEnd) : contentEnd;
};

const parseExpressionLine = (source: string, lineStart: number, i: number): Parsed<TomlExpression> =>
  source[i] === LEFT_BRACKET
    ? parseHeaderExpression(source, lineStart, i)
    : parseKeyValueExpression(source, lineStart, i);

/**
 * Parses a TOML document into its linear CST: the flat, source-tiling list of expressions.
 *
 * **Details**
 *
 * Each expression includes its leading whitespace and terminating newline
 * (or ends at EOF); the first expression also includes a leading BOM.
 * Consecutive blank or comment-only lines coalesce into one trivia expression.
 * Concatenating the expressions' source slices reproduces the source exactly.
 *
 * **Gotchas**
 *
 * Throws RawTomlError on malformed input and GuardExceeded when value nesting
 * exceeds MAX_NESTING_DEPTH; the facade materializes both into typed errors.
 *
 * **Example** (Reconstruct source from expression spans)
 *
 * ```ts
 * import { parseExpressions } from "@beep/toml/internal/parser"
 * import * as A from "effect/Array"
 *
 * const source = "# settings\n\n  enabled = true\n"
 * const expressions = parseExpressions(source)
 * const reconstructed = A.map(expressions, (expression) =>
 *   source.slice(expression.offset, expression.offset + expression.length)
 * ).join("")
 * console.log(reconstructed === source) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseExpressions = (source: string): ReadonlyArray<TomlExpression> => {
  assertValidUnicode(source);
  const expressions: Array<TomlExpression> = [];
  let triviaStart = -1;
  const flushTrivia = (end: number): void => {
    if (triviaStart !== -1) {
      expressions.push(
        TomlTrivia.make({ text: Str.slice(triviaStart, end)(source), offset: triviaStart, length: end - triviaStart })
      );
      triviaStart = -1;
    }
  };
  let pos = 0;
  while (pos < source.length) {
    const lineStart = pos;
    const i = scanWhitespace(source, lineStart === 0 ? skipBom(source) : lineStart);
    if (isTriviaLine(source, i)) {
      pos = triviaLineEnd(source, i);
      triviaStart = triviaStart === -1 ? lineStart : triviaStart;
      continue;
    }
    flushTrivia(lineStart);
    const parsed = parseExpressionLine(source, lineStart, i);
    expressions.push(parsed.node);
    pos = parsed.end;
  }
  flushTrivia(source.length);
  return expressions;
};
