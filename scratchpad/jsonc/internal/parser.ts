/**
 * Recursive-descent JSONC parser: value mode (plain JS values) and tree mode
 * (`JsoncNode` AST). Private implementation.
 *
 * **Details**
 *
 * This module owns the single copy of the scan-error to parse-code mapping
 * (`scanErrorToCode`), consumed by both this parser and the visitor. It
 * returns plain results plus raw error records (`{ code, offset, length }`)
 * and MUST NOT import from `Jsonc.ts`: the facade maps raw records into
 * `JsoncParseErrorDetail` (computing `line`/`character` from `offset`) and
 * constructs the aggregate `JsoncParseError` itself, so the dependency edge
 * runs facade to parser only — never the reverse (a cycle would trip the
 * error-level `noImportCycles` lint).
 *
 * The public API does not expose this recovered `{ value, errors }` /
 * `{ root, errors }` pair: {@link Jsonc.parseResult} and
 * {@link Jsonc.parseTreeResult} fail whenever `errors.length > 0` and discard
 * the recovered value.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Match, Schema } from "effect";
import { dual } from "effect/Function";
import { JsoncNode, makeNodeUnsafe } from "../JsoncNode.ts";
import { MAX_NESTING_DEPTH } from "./limits.ts";
import type { ScanError, SyntaxKind } from "./scanner.ts";
import { createScanner } from "./scanner.ts";
import type { SkipCursor } from "./skip.ts";
import { skipBalancedValue } from "./skip.ts";

const $I = $ScratchpadId.create("jsonc/internal/parser");

/**
 * The public parse-error code vocabulary. The facade builds its `@public`
 * `JsoncParseErrorCode` schema from this array; the parser produces these codes
 * as plain strings so the schema stays facade-owned without an import cycle.
 *
 * **Example** (Nesting-depth code is in the vocabulary)
 *
 * ```ts
 * import { JSONC_PARSE_ERROR_CODES } from "../../../jsonc/internal/parser.ts";
 *
 * console.log(JSONC_PARSE_ERROR_CODES.includes("NestingDepthExceeded")); // true
 * ```
 *
 * @see {@link JsoncParseErrorCode} for the public literals schema built from this array.
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const JSONC_PARSE_ERROR_CODES = [
  "InvalidSymbol",
  "InvalidNumberFormat",
  "PropertyNameExpected",
  "ValueExpected",
  "ColonExpected",
  "CommaExpected",
  "CloseBraceExpected",
  "CloseBracketExpected",
  "EndOfFileExpected",
  "InvalidCommentToken",
  "UnexpectedEndOfComment",
  "UnexpectedEndOfString",
  "UnexpectedEndOfNumber",
  "InvalidUnicode",
  "InvalidEscapeCharacter",
  "InvalidCharacter",
  "NestingDepthExceeded",
] as const;

/**
 * A single parse-error code.
 *
 * **Example** (Guard a parse-error code)
 *
 * ```ts
 * import { ParseCode } from "../../../jsonc/internal/parser.ts"
 * import { Schema } from "effect"
 *
 * console.log(Schema.is(ParseCode)("ValueExpected")) // true
 * ```
 *
 * @see {@link JSONC_PARSE_ERROR_CODES} for the source array of these literals.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const ParseCode = Schema.Literals(JSONC_PARSE_ERROR_CODES).pipe(
  $I.annoteSchema("ParseCode", {
    description: "The closed internal JSONC parse-error code vocabulary.",
  })
);

/**
 * Decoded internal JSONC parse-error code.
 *
 * @see {@link ParseCode} for the runtime schema.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ParseCode = typeof ParseCode.Type;

/**
 * A raw parse error record — position only; the facade derives line/character.
 *
 * **Example** (Construct a raw parse error)
 *
 * ```ts
 * import { RawParseError } from "../../../jsonc/internal/parser.ts"
 *
 * const error = RawParseError.make({ code: "ValueExpected", offset: 3, length: 1 })
 * console.log(error.code) // "ValueExpected"
 * ```
 *
 * @see {@link JsoncParseError} for the public aggregate that maps these records.
 * @see {@link parseValue} for the recovery pair that carries this record.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const RawParseError = Schema.Struct({
  code: ParseCode,
  offset: Schema.Finite,
  length: Schema.Finite,
}).pipe(
  $I.annoteSchema("RawParseError", {
    description: "An internal JSONC parse-error code with its UTF-16 offset and length.",
  })
);

/**
 * Decoded raw JSONC parse error.
 *
 * @see {@link RawParseError} for the runtime schema.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type RawParseError = typeof RawParseError.Type;

/**
 * Plain flags accepted by the parser, decoded from `JsoncParseOptions` by the
 * facade.
 *
 * **Example** (Construct permissive parse flags)
 *
 * ```ts
 * import { ParseFlags } from "../../../jsonc/internal/parser.ts"
 *
 * const flags = ParseFlags.make({ allowTrailingComma: true })
 * console.log(flags.allowTrailingComma) // true
 * ```
 *
 * @see {@link JsoncParseOptions} for the public options the facade maps into these flags.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const ParseFlags = Schema.Struct({
  disallowComments: Schema.optionalKey(Schema.Boolean),
  allowTrailingComma: Schema.optionalKey(Schema.Boolean),
  allowEmptyContent: Schema.optionalKey(Schema.Boolean),
}).pipe(
  $I.annoteSchema("ParseFlags", {
    description: "Internal JSONC parser flags decoded from the public parse options.",
  })
);

/**
 * Decoded internal JSONC parser flags.
 *
 * @see {@link ParseFlags} for the runtime schema.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ParseFlags = typeof ParseFlags.Type;

/**
 * Value-mode result: the recovered value plus every error encountered.
 *
 * **Example** (Construct a recovered value result)
 *
 * ```ts
 * import { ParseValueResult } from "../../../jsonc/internal/parser.ts"
 *
 * const result = ParseValueResult.make({ value: { port: 3000 }, errors: [] })
 * console.log(result.errors.length) // 0
 * ```
 *
 * @see {@link parseValue} for the function that returns this pair.
 * @see {@link JsoncParseError} for the public failure that discards `value`.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const ParseValueResult = Schema.Struct({
  value: Schema.Unknown,
  errors: Schema.Array(RawParseError),
}).pipe(
  $I.annoteSchema("ParseValueResult", {
    description: "A recovered JSONC value paired with every raw parse error encountered.",
  })
);

/**
 * Decoded internal JSONC value-mode parse result.
 *
 * @see {@link ParseValueResult} for the runtime schema.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ParseValueResult = typeof ParseValueResult.Type;

/**
 * Tree-mode result: the root node (or `undefined` for empty input) plus errors.
 *
 * **Example** (Construct an empty tree result)
 *
 * ```ts
 * import { ParseTreeResult } from "../../../jsonc/internal/parser.ts"
 *
 * const result = ParseTreeResult.make({ root: undefined, errors: [] })
 * console.log(result.root) // undefined
 * ```
 *
 * @see {@link parseTree} for the function that returns this pair.
 * @see {@link JsoncParseError} for the public failure that discards `root`.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const ParseTreeResult = Schema.Struct({
  root: Schema.Union([JsoncNode, Schema.Undefined]),
  errors: Schema.Array(RawParseError),
}).pipe(
  $I.annoteSchema("ParseTreeResult", {
    description: "A recovered JSONC syntax tree paired with every raw parse error encountered.",
  })
);

/**
 * Decoded internal JSONC tree-mode parse result.
 *
 * @see {@link ParseTreeResult} for the runtime schema.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ParseTreeResult = typeof ParseTreeResult.Type;

/**
 * The single scan-error to parse-code translation, shared by the parser and the
 * visitor. Returns `undefined` for `"None"` (no error).
 *
 * **Example** (No scanner error maps to nothing)
 *
 * ```ts
 * import { scanErrorToCode } from "../../../jsonc/internal/parser.ts";
 *
 * console.log(scanErrorToCode("None")); // undefined
 * console.log(scanErrorToCode("InvalidUnicode")); // "InvalidUnicode"
 * ```
 *
 * @see {@link JsoncParseError} for the public aggregate built after this mapping.
 * @internal
 * @category mapping
 * @since 0.0.0
 */
export const scanErrorToCode = (error: ScanError): ParseCode | undefined =>
  Match.value(error).pipe(
    Match.when("InvalidUnicode", () => "InvalidUnicode" as const),
    Match.when("InvalidEscapeCharacter", () => "InvalidEscapeCharacter" as const),
    Match.when("UnexpectedEndOfNumber", () => "InvalidNumberFormat" as const),
    Match.when("UnexpectedEndOfComment", () => "UnexpectedEndOfComment" as const),
    Match.when("UnexpectedEndOfString", () => "UnexpectedEndOfString" as const),
    Match.when("InvalidCharacter", () => "InvalidCharacter" as const),
    Match.when("InvalidSymbol", () => "InvalidSymbol" as const),
    Match.orElse(() => undefined)
  );

interface Internal {
  value: unknown;
  root: JsoncNode | undefined;
  errors: RawParseError[];
}

function run(text: string, flags: ParseFlags, buildTree: boolean): Internal {
  const scanner = createScanner(text, false);
  const errors: RawParseError[] = [];
  const disallowComments = flags.disallowComments ?? false;
  const allowTrailingComma = flags.allowTrailingComma ?? true;
  const allowEmptyContent = flags.allowEmptyContent ?? false;

  let currentToken: SyntaxKind = "Unknown";
  // Current collection-nesting depth. Guards every recursive-descent surface
  // (parseArray/parseObject and their tree-mode twins) against stack overflow
  // on hostile deeply-nested input — see MAX_NESTING_DEPTH.
  let depth = 0;

  // Defeats TS control-flow narrowing — scanNext() mutates currentToken via closure.
  function token(): SyntaxKind {
    return currentToken;
  }

  function scanNext(): SyntaxKind {
    for (;;) {
      currentToken = scanner.scan();
      const code = scanErrorToCode(scanner.getTokenError());
      if (code !== undefined) {
        pushError(code);
      }
      const disposition = Match.value(currentToken).pipe(
        Match.when("LineComment", () => "comment" as const),
        Match.when("BlockComment", () => "comment" as const),
        Match.when("Trivia", () => "trivia" as const),
        Match.when("LineBreak", () => "trivia" as const),
        Match.orElse(() => "token" as const)
      );
      if (disposition === "comment") {
        if (disallowComments) {
          pushError("InvalidCommentToken");
        }
        continue;
      }
      if (disposition === "token") return currentToken;
    }
  }

  // Tight end-of-token offset — captures where the CURRENT token ends, before
  // scanNext() advances past trailing trivia. Node lengths are computed from
  // this value so spans never swallow trailing whitespace or comments.
  function tokenEnd(): number {
    return scanner.getTokenOffset() + scanner.getTokenLength();
  }

  // One fatal, deduped depth diagnostic — anchored at the token that would have
  // pushed nesting past the cap. Mirrors the composer guard in @effected/yaml.
  function pushDepthError(): void {
    if (!errors.some((e) => e.code === "NestingDepthExceeded")) {
      errors.push(
        RawParseError.make({
          code: "NestingDepthExceeded",
          offset: scanner.getTokenOffset(),
          length: scanner.getTokenLength(),
        })
      );
    }
  }

  // Cursor adapter for the shared iterative bracket-balance skip (see
  // internal/skip.ts), used at the depth cap so an over-deep subtree is
  // consumed without adding stack frames; recovery still makes progress past
  // it. `advance` is scanNext, so scan errors and comment diagnostics inside
  // a skipped subtree are still collected.
  const skipCursor: SkipCursor = {
    getToken: token,
    advance: () => {
      scanNext();
    },
    tokenStart: () => scanner.getTokenOffset(),
    tokenEnd,
  };

  function skipContainer(): void {
    skipBalancedValue(skipCursor);
  }

  function pushError(code: ParseCode, skipUntilAfter: SyntaxKind[] = [], skipUntil: SyntaxKind[] = []): void {
    errors.push(
      RawParseError.make({
        code,
        offset: scanner.getTokenOffset(),
        length: scanner.getTokenLength(),
      })
    );
    if (skipUntilAfter.length > 0 || skipUntil.length > 0) {
      let t = token();
      while (t !== "EOF") {
        if (skipUntilAfter.includes(t)) {
          scanNext();
          break;
        }
        if (skipUntil.includes(t)) {
          break;
        }
        t = scanNext();
      }
    }
  }

  // ── Value mode ──────────────────────────────────────────────────────────

  function parseValue(): unknown {
    return Match.value(token()).pipe(
      Match.when("OpenBracket", parseArray),
      Match.when("OpenBrace", parseObject),
      Match.when("String", parseString),
      Match.when("Number", parseNumber),
      Match.when("True", () => {
        scanNext();
        return true;
      }),
      Match.when("False", () => {
        scanNext();
        return false;
      }),
      Match.when("Null", () => {
        scanNext();
        return null;
      }),
      Match.orElse(() => undefined)
    );
  }

  function parseString(): string {
    const value = scanner.getTokenValue();
    scanNext();
    return value;
  }

  function parseNumber(): number {
    const value = Number.parseFloat(scanner.getTokenValue());
    scanNext();
    return value;
  }

  function parseArray(): unknown[] {
    if (depth >= MAX_NESTING_DEPTH) {
      pushDepthError();
      skipContainer();
      return [];
    }
    depth++;
    try {
      scanNext(); // skip [
      const arr: unknown[] = [];
      let needsComma = false;

      while (token() !== "CloseBracket" && token() !== "EOF") {
        if (token() === "Comma") {
          if (!needsComma) {
            pushError("ValueExpected");
          }
          scanNext();
          if (token() === "CloseBracket" && allowTrailingComma) {
            break;
          }
        } else if (needsComma) {
          pushError("CommaExpected");
        }
        const value = parseValue();
        if (value === undefined) {
          pushError("ValueExpected", [], ["CloseBracket", "Comma"]);
        } else {
          arr.push(value);
        }
        needsComma = true;
      }

      if (token() !== "CloseBracket") {
        pushError("CloseBracketExpected");
      } else {
        scanNext();
      }

      return arr;
    } finally {
      depth--;
    }
  }

  function parseObject(): Record<string, unknown> {
    if (depth >= MAX_NESTING_DEPTH) {
      pushDepthError();
      skipContainer();
      return {};
    }
    depth++;
    try {
      return parseObjectBody();
    } finally {
      depth--;
    }
  }

  function parseObjectBody(): Record<string, unknown> {
    scanNext(); // skip {
    const obj: Record<string, unknown> = {};
    let needsComma = false;

    while (token() !== "CloseBrace" && token() !== "EOF") {
      if (token() === "Comma") {
        if (!needsComma) {
          pushError("PropertyNameExpected");
        }
        scanNext();
        if (token() === "CloseBrace" && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        pushError("CommaExpected");
      }
      if (token() !== "String") {
        pushError("PropertyNameExpected", [], ["CloseBrace", "Comma"]);
        continue;
      }
      const key = scanner.getTokenValue();
      scanNext();
      if (token() !== "Colon") {
        pushError("ColonExpected", [], ["CloseBrace", "Comma"]);
        continue;
      }
      scanNext();
      const value = parseValue();
      if (value === undefined) {
        pushError("ValueExpected", [], ["CloseBrace", "Comma"]);
      } else if (key === "__proto__") {
        // Define as an own data property — plain assignment would mutate the
        // object's prototype (JSON.parse semantics, pollution-safe).
        Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
      } else {
        obj[key] = value;
      }
      needsComma = true;
    }

    if (token() !== "CloseBrace") {
      pushError("CloseBraceExpected");
    } else {
      scanNext();
    }

    return obj;
  }

  // ── Tree mode ───────────────────────────────────────────────────────────

  function parseValueTree(): JsoncNode | undefined {
    return Match.value(token()).pipe(
      Match.when("OpenBracket", parseArrayTree),
      Match.when("OpenBrace", parseObjectTree),
      Match.when("String", () => leafTree("string", scanner.getTokenValue())),
      Match.when("Number", () => leafTree("number", Number.parseFloat(scanner.getTokenValue()))),
      Match.when("True", () => leafTree("boolean", true)),
      Match.when("False", () => leafTree("boolean", false)),
      Match.when("Null", () => leafTree("null", null)),
      Match.orElse(() => undefined)
    );
  }

  function leafTree(type: "string" | "number" | "boolean" | "null", value: unknown): JsoncNode {
    const offset = scanner.getTokenOffset();
    const end = tokenEnd();
    scanNext();
    return makeNodeUnsafe({ type, offset, length: end - offset, value });
  }

  function parseArrayTree(): JsoncNode {
    const offset = scanner.getTokenOffset();
    if (depth >= MAX_NESTING_DEPTH) {
      pushDepthError();
      skipContainer();
      return makeNodeUnsafe({ type: "array", offset, length: scanner.getTokenOffset() - offset, children: [] });
    }
    depth++;
    try {
      return parseArrayTreeBody(offset);
    } finally {
      depth--;
    }
  }

  function parseArrayTreeBody(offset: number): JsoncNode {
    const children: JsoncNode[] = [];
    scanNext(); // skip [
    let needsComma = false;

    while (token() !== "CloseBracket" && token() !== "EOF") {
      if (token() === "Comma") {
        if (!needsComma) {
          pushError("ValueExpected");
        }
        scanNext();
        if (token() === "CloseBracket" && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        pushError("CommaExpected");
      }
      const child = parseValueTree();
      if (child !== undefined) {
        children.push(child);
      } else {
        pushError("ValueExpected", [], ["CloseBracket", "Comma"]);
      }
      needsComma = true;
    }

    let end: number;
    if (token() !== "CloseBracket") {
      pushError("CloseBracketExpected");
      end = scanner.getTokenOffset();
    } else {
      end = tokenEnd();
      scanNext();
    }
    return makeNodeUnsafe({ type: "array", offset, length: end - offset, children });
  }

  function parseObjectTree(): JsoncNode {
    const offset = scanner.getTokenOffset();
    if (depth >= MAX_NESTING_DEPTH) {
      pushDepthError();
      skipContainer();
      return makeNodeUnsafe({ type: "object", offset, length: scanner.getTokenOffset() - offset, children: [] });
    }
    depth++;
    try {
      return parseObjectTreeBody(offset);
    } finally {
      depth--;
    }
  }

  function parseObjectTreeBody(offset: number): JsoncNode {
    const children: JsoncNode[] = [];
    scanNext(); // skip {
    let needsComma = false;

    while (token() !== "CloseBrace" && token() !== "EOF") {
      if (token() === "Comma") {
        if (!needsComma) {
          pushError("PropertyNameExpected");
        }
        scanNext();
        if (token() === "CloseBrace" && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        pushError("CommaExpected");
      }
      if (token() !== "String") {
        pushError("PropertyNameExpected", [], ["CloseBrace", "Comma"]);
        continue;
      }

      const propOffset = scanner.getTokenOffset();
      const keyOffset = scanner.getTokenOffset();
      const keyValue = scanner.getTokenValue();
      const keyEnd = tokenEnd();
      scanNext();
      const keyNode = makeNodeUnsafe({
        type: "string",
        offset: keyOffset,
        length: keyEnd - keyOffset,
        value: keyValue,
      });

      if (token() !== "Colon") {
        pushError("ColonExpected", [], ["CloseBrace", "Comma"]);
        children.push(
          makeNodeUnsafe({
            type: "property",
            offset: propOffset,
            length: scanner.getTokenOffset() - propOffset,
            children: [keyNode],
          })
        );
        continue;
      }
      const colonOffset = scanner.getTokenOffset();
      scanNext();

      const valueNode = parseValueTree();
      if (valueNode !== undefined) {
        children.push(
          makeNodeUnsafe({
            type: "property",
            offset: propOffset,
            length: valueNode.offset + valueNode.length - propOffset,
            colonOffset,
            children: [keyNode, valueNode],
          })
        );
      } else {
        pushError("ValueExpected", [], ["CloseBrace", "Comma"]);
        children.push(
          makeNodeUnsafe({
            type: "property",
            offset: propOffset,
            length: scanner.getTokenOffset() - propOffset,
            colonOffset,
            children: [keyNode],
          })
        );
      }
      needsComma = true;
    }

    let end: number;
    if (token() !== "CloseBrace") {
      pushError("CloseBraceExpected");
      end = scanner.getTokenOffset();
    } else {
      end = tokenEnd();
      scanNext();
    }
    return makeNodeUnsafe({ type: "object", offset, length: end - offset, children });
  }

  // ── Drive ───────────────────────────────────────────────────────────────

  scanNext();

  if (buildTree) {
    const root = parseValueTree();
    if (token() !== "EOF") {
      pushError("EndOfFileExpected");
    }
    if (root === undefined && !allowEmptyContent) {
      pushError("ValueExpected");
    }
    return { value: undefined, root, errors };
  }

  const value = parseValue();
  if (token() !== "EOF") {
    pushError("EndOfFileExpected");
  }
  if (value === undefined && !allowEmptyContent) {
    pushError("ValueExpected");
  }
  return { value, root: undefined, errors };
}

/**
 * Parse into a plain JS value, recovering from and collecting every error.
 *
 * **Gotchas**
 *
 * The recovered `value` is an internal artifact. {@link Jsonc.parseResult} fails
 * whenever `errors.length > 0` and does not return it.
 *
 * **Example** (Recovered value plus errors)
 *
 * ```ts
 * import { parseValue } from "../../../jsonc/internal/parser.ts";
 *
 * const recovered = parseValue("{ bad }", {});
 *
 * console.log(recovered.errors.length > 0); // true
 * console.log(recovered.value !== undefined); // true
 * ```
 *
 * @see {@link JsoncParseError} for the public aggregate that discards this recovery pair.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const parseValue: {
  (text: string, flags: ParseFlags): ParseValueResult;
  (flags: ParseFlags): (text: string) => ParseValueResult;
} = dual(2, (text: string, flags: ParseFlags): ParseValueResult => {
  const { value, errors } = run(text, flags, false);
  return ParseValueResult.make({ value, errors });
});

/**
 * Parse into a {@link JsoncNode} AST, recovering from and collecting every error.
 *
 * **Gotchas**
 *
 * The recovered `root` is an internal artifact. {@link Jsonc.parseTreeResult}
 * fails whenever `errors.length > 0` and does not return it.
 *
 * **Example** (Tree mode still reports recovered errors)
 *
 * ```ts
 * import { parseTree } from "../../../jsonc/internal/parser.ts";
 *
 * const recovered = parseTree("{ bad }", {});
 *
 * console.log(recovered.errors.length > 0); // true
 * ```
 *
 * @see {@link parseValue} for the value-mode twin that also keeps recovery artifacts.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const parseTree: {
  (text: string, flags: ParseFlags): ParseTreeResult;
  (flags: ParseFlags): (text: string) => ParseTreeResult;
} = dual(2, (text: string, flags: ParseFlags): ParseTreeResult => {
  const { root, errors } = run(text, flags, true);
  return ParseTreeResult.make({ root, errors });
});
