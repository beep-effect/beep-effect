// Ported from microsoft/node-jsonc-parser src/impl/parser.ts (MIT).

import { $JsoncId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { JsoncNode, makeNodeUnsafe } from "../JsoncNode.ts";
import { accumulation } from "./accumulation.ts";
import { MAX_NESTING_DEPTH } from "./limits.ts";
import { createScanner, SyntaxKind } from "./scanner.ts";
import { skipBalancedValue } from "./skip.ts";
import type { JsoncNodeType } from "../JsoncNode.ts";
import type { ScanError } from "./scanner.ts";
import type { SkipCursor } from "./skip.ts";

const $I = $JsoncId.create("internal/parser");

/**
 * The parse-error code vocabulary shared by the parser, the visitor and the
 * public `JsoncParseErrorCode` kit the facade derives from it.
 *
 * **Example** (Guard a code with the kit)
 *
 * ```ts
 * import { ParseCode } from "@beep/jsonc/internal/parser"
 *
 * console.log(ParseCode.is.ValueExpected("ValueExpected")) // true
 * console.log(ParseCode.literals.length) // 17
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ParseCode = LiteralKit([
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
]).pipe(
  $I.annoteSchema("ParseCode", {
    description: "Parse-error codes the recovering JSONC parser can report.",
  })
);

/**
 * @see {@link ParseCode} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type ParseCode = typeof ParseCode.Type;

/**
 * One recovered parse error as the parser records it: the code plus the
 * offending token's span. The facade adds `line`/`character`.
 *
 * **Example** (Construct a raw error record)
 *
 * ```ts
 * import { RawParseError } from "@beep/jsonc/internal/parser"
 *
 * const error = RawParseError.make({ code: "CommaExpected", offset: 4, length: 1 })
 *
 * console.log(error.code) // "CommaExpected"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RawParseError extends S.Opaque<RawParseError, { readonly brand: unique symbol }>()(
  S.Struct({
    code: ParseCode,
    offset: S.Natural,
    length: S.Natural,
  }).pipe(
    $I.annoteSchema("RawParseError", {
      description: "A parse error with its token span, before line and character are derived.",
    })
  )
) {}

/**
 * Resolved parse flags, every field present. The facade decodes its public
 * `JsoncParseOptions` into this shape before calling the parser.
 *
 * **Example** (Construct the JSONC defaults)
 *
 * ```ts
 * import { ParseFlags } from "@beep/jsonc/internal/parser"
 *
 * const flags = ParseFlags.make({})
 *
 * console.log(flags.allowTrailingComma) // true
 * console.log(flags.disallowComments) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ParseFlags extends S.Opaque<ParseFlags, { readonly brand: unique symbol }>()(
  S.Struct({
    disallowComments: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    allowTrailingComma: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))),
    allowEmptyContent: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  }).pipe(
    $I.annoteSchema("ParseFlags", {
      description: "Resolved parser behaviour flags with every field present.",
    })
  )
) {}

/**
 * Value-mode recovery result: the recovered value plus every error met.
 *
 * **Example** (Inspect a value-mode result)
 *
 * ```ts
 * import { ParseFlags, parseValue } from "@beep/jsonc/internal/parser"
 *
 * const result = parseValue('{ "a": 1 }', ParseFlags.make({}))
 *
 * console.log(result.value) // { a: 1 }
 * console.log(result.errors.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ParseValueResult extends S.Opaque<ParseValueResult, { readonly brand: unique symbol }>()(
  S.Struct({
    value: S.Unknown,
    errors: S.Array(RawParseError),
  }).pipe(
    $I.annoteSchema("ParseValueResult", {
      description: "A recovered plain value together with every parse error encountered.",
    })
  )
) {}

/**
 * Tree-mode recovery result: the root node, absent for empty input, plus every
 * error met.
 *
 * **Example** (Inspect a tree-mode result)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ParseFlags, parseTree } from "@beep/jsonc/internal/parser"
 *
 * const result = parseTree("[1]", ParseFlags.make({}))
 *
 * console.log(O.map(result.root, (root) => root.type)) // Option.some("array")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ParseTreeResult extends S.Opaque<ParseTreeResult, { readonly brand: unique symbol }>()(
  S.Struct({
    root: S.Option(JsoncNode),
    errors: S.Array(RawParseError),
  }).pipe(
    $I.annoteSchema("ParseTreeResult", {
      description: "A recovered AST root, absent for empty input, together with every parse error encountered.",
    })
  )
) {}

/**
 * The single scan-error to parse-code translation, shared by the parser and
 * the visitor.
 *
 * **Details**
 *
 * `"None"` maps to `O.none()`; every other scanner code maps to its public
 * parse code, with `UnexpectedEndOfNumber` reported as `InvalidNumberFormat`.
 *
 * **Example** (Translate scanner codes)
 *
 * ```ts
 * import { scanErrorToCode } from "@beep/jsonc/internal/parser"
 *
 * console.log(scanErrorToCode("UnexpectedEndOfNumber")) // Option.some("InvalidNumberFormat")
 * console.log(scanErrorToCode("None")) // Option.none()
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const scanErrorToCode: (error: ScanError) => O.Option<ParseCode> = Match.type<ScanError>().pipe(
  Match.when("None", () => O.none()),
  Match.when("UnexpectedEndOfNumber", () => O.some<ParseCode>("InvalidNumberFormat")),
  Match.orElse(O.some<ParseCode>)
);

const isStructuralTrivia = S.is(SyntaxKind.pick(["LineComment", "BlockComment", "Trivia", "LineBreak"]));
const isComment = S.is(SyntaxKind.pick(["LineComment", "BlockComment"]));

type LeafNodeType = Exclude<JsoncNodeType, "object" | "array" | "property">;

interface Internal {
  readonly errors: ReadonlyArray<RawParseError>;
  readonly root: O.Option<JsoncNode>;
  readonly value: unknown;
}

const run: {
  (text: string, flags: ParseFlags, buildTree: boolean): Internal;
  (flags: ParseFlags, buildTree: boolean): (text: string) => Internal;
} = dual(3, (text: string, flags: ParseFlags, buildTree: boolean): Internal => {
  const scanner = createScanner(text, false);
  const errors: Array<RawParseError> = [];
  let currentToken: SyntaxKind = "Unknown";
  let depth = 0;

  const currentTokenUnnarrowed = (): SyntaxKind => currentToken;

  const tightTokenEndBeforeTrailingTrivia = (): number => scanner.getTokenOffset() + scanner.getTokenLength();

  const record = (code: ParseCode): void => {
    accumulation.append(
      errors,
      RawParseError.make({
        code,
        offset: scanner.getTokenOffset(),
        length: scanner.getTokenLength(),
      })
    );
  };

  const scanNext = (): SyntaxKind => {
    for (;;) {
      currentToken = scanner.scan();
      const code = scanErrorToCode(scanner.getTokenError());
      if (O.isSome(code)) {
        record(code.value);
      }
      if (!isStructuralTrivia(currentToken)) {
        return currentToken;
      }
      if (flags.disallowComments && isComment(currentToken)) {
        record("InvalidCommentToken");
      }
    }
  };

  const recordDepthErrorOnceAtCappingToken = (): void => {
    if (!A.some(errors, (e) => e.code === "NestingDepthExceeded")) {
      record("NestingDepthExceeded");
    }
  };

  const skipCursorCollectingSkippedSubtreeDiagnostics: SkipCursor = {
    getToken: currentTokenUnnarrowed,
    advance: () => {
      scanNext();
    },
    tokenStart: () => scanner.getTokenOffset(),
    tokenLength: () => scanner.getTokenLength(),
  };

  const skipContainer = (): void => {
    skipBalancedValue(skipCursorCollectingSkippedSubtreeDiagnostics);
  };

  const recordThenResyncUntil: {
    (code: ParseCode, skipUntil?: ReadonlyArray<SyntaxKind>): void;
    (skipUntil?: ReadonlyArray<SyntaxKind>): (code: ParseCode) => void;
  } = dual(
    (args) => P.isString(args[0]),
    (code: ParseCode, skipUntil: ReadonlyArray<SyntaxKind> = A.empty()): void => {
      record(code);
      if (A.isReadonlyArrayNonEmpty(skipUntil)) {
        while (currentTokenUnnarrowed() !== "EOF" && !A.contains(skipUntil, currentTokenUnnarrowed())) {
          scanNext();
        }
      }
    }
  );

  const guardDepth: {
    <T>(placeholder: () => T, body: () => T): T;
    <T>(body: () => T): (placeholder: () => T) => T;
  } = dual(2, <T>(placeholder: () => T, body: () => T): T => {
    if (depth >= MAX_NESTING_DEPTH) {
      recordDepthErrorOnceAtCappingToken();
      skipContainer();
      return placeholder();
    }
    depth++;
    try {
      return body();
    } finally {
      depth--;
    }
  });

  const separatorFalseWhenTrailingCommaCloses: {
    (closer: SyntaxKind, missingValue: ParseCode, needsComma: boolean): boolean;
    (missingValue: ParseCode, needsComma: boolean): (closer: SyntaxKind) => boolean;
  } = dual(3, (closer: SyntaxKind, missingValue: ParseCode, needsComma: boolean): boolean => {
    if (currentTokenUnnarrowed() === "Comma") {
      if (!needsComma) {
        recordThenResyncUntil(missingValue);
      }
      scanNext();
      if (currentTokenUnnarrowed() === closer && flags.allowTrailingComma) {
        return false;
      }
    } else if (needsComma) {
      recordThenResyncUntil("CommaExpected");
    }
    return true;
  });

  const atMemberName = (needsComma: boolean): boolean => {
    if (!separatorFalseWhenTrailingCommaCloses("CloseBrace", "PropertyNameExpected", needsComma)) {
      return false;
    }
    if (currentTokenUnnarrowed() === "String") {
      return true;
    }
    recordThenResyncUntil("PropertyNameExpected", ["CloseBrace", "Comma"]);
    return false;
  };

  const parseLiteral = <T>(value: T): T => {
    scanNext();
    return value;
  };

  const parseValue = (): O.Option<unknown> =>
    Match.value(currentTokenUnnarrowed()).pipe(
      Match.when("OpenBracket", () => O.some<unknown>(parseArray())),
      Match.when("OpenBrace", () => O.some<unknown>(parseObject())),
      Match.when("String", () => O.some<unknown>(parseLiteral(scanner.getTokenValue()))),
      Match.when("Number", () => O.some<unknown>(parseLiteral(Number.parseFloat(scanner.getTokenValue())))),
      Match.when("True", () => O.some<unknown>(parseLiteral(true))),
      Match.when("False", () => O.some<unknown>(parseLiteral(false))),
      Match.when("Null", () => O.some<unknown>(parseLiteral(null))),
      Match.orElse(O.none<unknown>)
    );

  const parseElements = <T>(parse: () => O.Option<T>, items: Array<T>): void => {
    let needsComma = false;
    while (
      currentTokenUnnarrowed() !== "CloseBracket" &&
      currentTokenUnnarrowed() !== "EOF" &&
      separatorFalseWhenTrailingCommaCloses("CloseBracket", "ValueExpected", needsComma)
    ) {
      const item = parse();
      if (O.isSome(item)) {
        accumulation.append(items, item.value);
      } else {
        recordThenResyncUntil("ValueExpected", ["CloseBracket", "Comma"]);
      }
      needsComma = true;
    }
  };

  const parseMembers = (memberRequiresComma: () => boolean): void => {
    let needsComma = false;
    while (currentTokenUnnarrowed() !== "CloseBrace" && currentTokenUnnarrowed() !== "EOF") {
      if (atMemberName(needsComma) && memberRequiresComma()) {
        needsComma = true;
      }
    }
  };

  const closeContainer: {
    (closer: SyntaxKind, missing: ParseCode): number;
    (missing: ParseCode): (closer: SyntaxKind) => number;
  } = dual(2, (closer: SyntaxKind, missing: ParseCode): number => {
    if (currentTokenUnnarrowed() === closer) {
      const end = tightTokenEndBeforeTrailingTrivia();
      scanNext();
      return end;
    }
    recordThenResyncUntil(missing);
    return scanner.getTokenOffset();
  });

  const parseArray = (): ReadonlyArray<unknown> =>
    guardDepth(A.empty<unknown>, () => {
      scanNext();
      const items: Array<unknown> = [];
      parseElements(parseValue, items);
      closeContainer("CloseBracket", "CloseBracketExpected");
      return items;
    });

  const parseMember = (obj: Record<string, unknown>): boolean => {
    const key = scanner.getTokenValue();
    scanNext();
    if (currentTokenUnnarrowed() !== "Colon") {
      recordThenResyncUntil("ColonExpected", ["CloseBrace", "Comma"]);
      return false;
    }
    scanNext();
    const value = parseValue();
    if (O.isSome(value)) {
      Object.defineProperty(obj, key, {
        value: value.value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    } else {
      recordThenResyncUntil("ValueExpected", ["CloseBrace", "Comma"]);
    }
    return true;
  };

  const parseObject = (): Record<string, unknown> =>
    guardDepth(
      () => ({}),
      () => {
        scanNext();
        const obj: Record<string, unknown> = {};
        parseMembers(() => parseMember(obj));
        closeContainer("CloseBrace", "CloseBraceExpected");
        return obj;
      }
    );

  const leafTree: {
    (type: LeafNodeType, value: unknown): JsoncNode;
    (value: unknown): (type: LeafNodeType) => JsoncNode;
  } = dual(2, (type: LeafNodeType, value: unknown): JsoncNode => {
    const offset = scanner.getTokenOffset();
    const end = tightTokenEndBeforeTrailingTrivia();
    scanNext();
    return makeNodeUnsafe({ type, offset, length: end - offset, value });
  });

  const parseValueTree = (): O.Option<JsoncNode> =>
    Match.value(currentTokenUnnarrowed()).pipe(
      Match.when("OpenBracket", () => O.some(parseArrayTree())),
      Match.when("OpenBrace", () => O.some(parseObjectTree())),
      Match.when("String", () => O.some(leafTree("string", scanner.getTokenValue()))),
      Match.when("Number", () => O.some(leafTree("number", Number.parseFloat(scanner.getTokenValue())))),
      Match.when("True", () => O.some(leafTree("boolean", true))),
      Match.when("False", () => O.some(leafTree("boolean", false))),
      Match.when("Null", () => O.some(leafTree("null", null))),
      Match.orElse(O.none<JsoncNode>)
    );

  const parseArrayTree = (): JsoncNode => {
    const offset = scanner.getTokenOffset();
    return guardDepth(
      () => makeNodeUnsafe({ type: "array", offset, length: scanner.getTokenOffset() - offset, children: [] }),
      () => {
        scanNext();
        const children: Array<JsoncNode> = [];
        parseElements(parseValueTree, children);
        const end = closeContainer("CloseBracket", "CloseBracketExpected");
        return makeNodeUnsafe({ type: "array", offset, length: end - offset, children });
      }
    );
  };

  const parseMemberTree = (children: Array<JsoncNode>): boolean => {
    const propOffset = scanner.getTokenOffset();
    const keyNode = leafTree("string", scanner.getTokenValue());
    if (currentTokenUnnarrowed() !== "Colon") {
      recordThenResyncUntil("ColonExpected", ["CloseBrace", "Comma"]);
      accumulation.append(
        children,
        makeNodeUnsafe({
          type: "property",
          offset: propOffset,
          length: scanner.getTokenOffset() - propOffset,
          children: [keyNode],
        })
      );
      return false;
    }
    const colonOffset = scanner.getTokenOffset();
    scanNext();
    const valueNode = parseValueTree();
    if (O.isSome(valueNode)) {
      accumulation.append(
        children,
        makeNodeUnsafe({
          type: "property",
          offset: propOffset,
          length: valueNode.value.offset + valueNode.value.length - propOffset,
          colonOffset,
          children: [keyNode, valueNode.value],
        })
      );
    } else {
      recordThenResyncUntil("ValueExpected", ["CloseBrace", "Comma"]);
      accumulation.append(
        children,
        makeNodeUnsafe({
          type: "property",
          offset: propOffset,
          length: scanner.getTokenOffset() - propOffset,
          colonOffset,
          children: [keyNode],
        })
      );
    }
    return true;
  };

  const parseObjectTree = (): JsoncNode => {
    const offset = scanner.getTokenOffset();
    return guardDepth(
      () => makeNodeUnsafe({ type: "object", offset, length: scanner.getTokenOffset() - offset, children: [] }),
      () => {
        scanNext();
        const children: Array<JsoncNode> = [];
        parseMembers(() => parseMemberTree(children));
        const end = closeContainer("CloseBrace", "CloseBraceExpected");
        return makeNodeUnsafe({ type: "object", offset, length: end - offset, children });
      }
    );
  };

  scanNext();

  const finish = (present: boolean): void => {
    if (currentTokenUnnarrowed() !== "EOF") {
      recordThenResyncUntil("EndOfFileExpected");
    }
    if (!present && !flags.allowEmptyContent) {
      recordThenResyncUntil("ValueExpected");
    }
  };

  if (buildTree) {
    const root = parseValueTree();
    finish(root.pipe(O.isSome));
    return { value: undefined, root, errors };
  }

  const value = parseValue();
  finish(value.pipe(O.isSome));
  return { value: value.pipe(O.getOrUndefined), root: O.none(), errors };
});

/**
 * Parse JSONC into a plain JavaScript value, recovering from and collecting
 * every error.
 *
 * **Details**
 *
 * Dual: `parseValue(text, flags)` or `parseValue(flags)(text)`. Malformed
 * input still yields the best-effort value alongside its errors; callers that
 * want all-or-nothing semantics check `errors` first, as the facade does.
 *
 * **Example** (Recover a value and its errors)
 *
 * ```ts
 * import { ParseFlags, parseValue } from "@beep/jsonc/internal/parser"
 *
 * const { value, errors } = parseValue('{ "a": 1 "b": 2 }', ParseFlags.make({}))
 *
 * console.log(value) // { a: 1, b: 2 }
 * console.log(errors.map((e) => e.code)) // ["CommaExpected"]
 * ```
 *
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
 * Parse JSONC into a `JsoncNode` AST, recovering from and collecting every
 * error.
 *
 * **Details**
 *
 * Dual: `parseTree(text, flags)` or `parseTree(flags)(text)`. The root is
 * `O.none()` for empty or whitespace-only input; with `allowEmptyContent`
 * unset that case also records a `ValueExpected` error.
 *
 * **Example** (Build an AST and read its root span)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ParseFlags, parseTree } from "@beep/jsonc/internal/parser"
 *
 * const { root } = parseTree('{ "a": 1 }  ', ParseFlags.make({}))
 *
 * console.log(O.map(root, (node) => node.length)) // Option.some(10)
 * ```
 *
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
