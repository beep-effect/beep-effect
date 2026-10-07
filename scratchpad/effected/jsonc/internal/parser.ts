// Recursive-descent JSONC parser: value mode (plain JS values) and tree mode
// (`JsoncNode` AST). Private implementation.
//
// This module owns the single copy of the scan-error to parse-code mapping
// (`scanErrorToCode`), consumed by both this parser and the visitor. It
// returns plain results plus raw error records and MUST NOT import from
// `Jsonc.ts`: the facade maps raw records into `JsoncParseErrorDetail`
// (computing `line`/`character` from `offset`) and constructs the aggregate
// `JsoncParseError` itself, so the dependency edge runs facade to parser only.
//
// Reference: Microsoft's jsonc-parser parser design (MIT).

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { JsoncNode, makeNodeUnsafe } from "../JsoncNode.ts";
import { MAX_NESTING_DEPTH } from "./limits.ts";
import type { ScanError } from "./scanner.ts";
import { createScanner, SyntaxKind } from "./scanner.ts";
import type { SkipCursor } from "./skip.ts";
import { skipBalancedValue } from "./skip.ts";

const $I = $ScratchpadId.create("effected/jsonc/internal/parser");

/**
 * The parse-error code vocabulary shared by the parser, the visitor and the
 * public `JsoncParseErrorCode` kit the facade derives from it.
 *
 * **Example** (Guard a code with the kit)
 *
 * ```ts
 * import { ParseCode } from "@beep/scratchpad/effected/jsonc/internal/parser"
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
]).annotate(
  $I.annote("ParseCode", {
    description: "Parse-error codes the recovering JSONC parser can report.",
  })
);

/**
 * The union of parse-error code literals.
 *
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
 * import { RawParseError } from "@beep/scratchpad/effected/jsonc/internal/parser"
 *
 * const error = RawParseError.make({ code: "CommaExpected", offset: 4, length: 1 })
 *
 * console.log(error.code) // "CommaExpected"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RawParseError = S.Struct({
  code: ParseCode,
  offset: S.Natural,
  length: S.Natural,
}).pipe(
  $I.annoteSchema("RawParseError", {
    description: "A parse error with its token span, before line and character are derived.",
  })
);

/**
 * The decoded shape of {@link RawParseError}.
 *
 * @see {@link RawParseError} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type RawParseError = typeof RawParseError.Type;

/**
 * Resolved parse flags, every field present. The facade decodes its public
 * `JsoncParseOptions` into this shape before calling the parser.
 *
 * **Example** (Construct the JSONC defaults)
 *
 * ```ts
 * import { ParseFlags } from "@beep/scratchpad/effected/jsonc/internal/parser"
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
export const ParseFlags = S.Struct({
  disallowComments: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  allowTrailingComma: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))),
  allowEmptyContent: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
}).pipe(
  $I.annoteSchema("ParseFlags", {
    description: "Resolved parser behaviour flags with every field present.",
  })
);

/**
 * The decoded shape of {@link ParseFlags}.
 *
 * @see {@link ParseFlags} for the runtime schema and defaults.
 * @category type-level
 * @since 0.0.0
 */
export type ParseFlags = typeof ParseFlags.Type;

/**
 * Value-mode recovery result: the recovered value plus every error met.
 *
 * **Example** (Inspect a value-mode result)
 *
 * ```ts
 * import { ParseFlags, parseValue } from "@beep/scratchpad/effected/jsonc/internal/parser"
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
export const ParseValueResult = S.Struct({
  value: S.Unknown,
  errors: S.Array(RawParseError),
}).pipe(
  $I.annoteSchema("ParseValueResult", {
    description: "A recovered plain value together with every parse error encountered.",
  })
);

/**
 * The decoded shape of {@link ParseValueResult}.
 *
 * @see {@link ParseValueResult} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ParseValueResult = typeof ParseValueResult.Type;

/**
 * Tree-mode recovery result: the root node, absent for empty input, plus every
 * error met.
 *
 * **Example** (Inspect a tree-mode result)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ParseFlags, parseTree } from "@beep/scratchpad/effected/jsonc/internal/parser"
 *
 * const result = parseTree("[1]", ParseFlags.make({}))
 *
 * console.log(O.map(result.root, (root) => root.type)) // Option.some("array")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ParseTreeResult = S.Struct({
  root: S.Option(JsoncNode),
  errors: S.Array(RawParseError),
}).pipe(
  $I.annoteSchema("ParseTreeResult", {
    description: "A recovered AST root, absent for empty input, together with every parse error encountered.",
  })
);

/**
 * The decoded shape of {@link ParseTreeResult}.
 *
 * @see {@link ParseTreeResult} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ParseTreeResult = typeof ParseTreeResult.Type;

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
 * import { scanErrorToCode } from "@beep/scratchpad/effected/jsonc/internal/parser"
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

interface Internal {
  readonly value: unknown;
  readonly root: O.Option<JsoncNode>;
  readonly errors: ReadonlyArray<RawParseError>;
}

const run = (text: string, flags: ParseFlags, buildTree: boolean): Internal => {
  const scanner = createScanner(text, false);
  let errors = A.empty<RawParseError>();
  let currentToken: SyntaxKind = "Unknown";
  // Current collection-nesting depth. Guards every recursive-descent surface
  // (parseArray/parseObject and their tree-mode twins) against stack overflow
  // on hostile deeply-nested input — see MAX_NESTING_DEPTH.
  let depth = 0;

  // Defeats TS control-flow narrowing — scanNext() mutates currentToken via closure.
  const token = (): SyntaxKind => currentToken;

  // Tight end-of-token offset — captures where the CURRENT token ends, before
  // scanNext() advances past trailing trivia. Node lengths are computed from
  // this value so spans never swallow trailing whitespace or comments.
  const tokenEnd = (): number => scanner.getTokenOffset() + scanner.getTokenLength();

  const record = (code: ParseCode): void => {
    errors = A.append(errors, {
      code,
      offset: scanner.getTokenOffset(),
      length: scanner.getTokenLength(),
    });
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

  // One fatal, deduped depth diagnostic, anchored at the token that would have
  // pushed nesting past the cap.
  const pushDepthError = (): void => {
    if (!A.some(errors, (e) => e.code === "NestingDepthExceeded")) {
      record("NestingDepthExceeded");
    }
  };

  // Cursor adapter for the shared iterative bracket-balance skip, used at the
  // depth cap so an over-deep subtree is consumed without adding stack frames.
  // `advance` is scanNext, so scan errors and comment diagnostics inside a
  // skipped subtree are still collected.
  const skipCursor: SkipCursor = {
    getToken: token,
    advance: () => {
      scanNext();
    },
    tokenStart: () => scanner.getTokenOffset(),
    tokenLength: () => scanner.getTokenLength(),
  };

  const skipContainer = (): void => {
    skipBalancedValue(skipCursor);
  };

  // Record `code` and resynchronize: advance until one of `skipUntil` is the
  // current token (left in place) or EOF.
  const pushError = (code: ParseCode, skipUntil: ReadonlyArray<SyntaxKind> = A.empty()): void => {
    record(code);
    if (A.isReadonlyArrayNonEmpty(skipUntil)) {
      while (token() !== "EOF" && !A.contains(skipUntil, token())) {
        scanNext();
      }
    }
  };

  const guardDepth = <T>(placeholder: () => T, body: () => T): T => {
    if (depth >= MAX_NESTING_DEPTH) {
      pushDepthError();
      skipContainer();
      return placeholder();
    }
    depth++;
    try {
      return body();
    } finally {
      depth--;
    }
  };

  // Shared container-loop step: handles the separator before an entry and
  // reports a missing comma. Returns `false` when a trailing comma closed the
  // container.
  const separator = (closer: SyntaxKind, missingValue: ParseCode, needsComma: boolean): boolean => {
    if (token() === "Comma") {
      if (!needsComma) {
        pushError(missingValue);
      }
      scanNext();
      if (token() === closer && flags.allowTrailingComma) {
        return false;
      }
    } else if (needsComma) {
      pushError("CommaExpected");
    }
    return true;
  };

  // ── Value mode ──────────────────────────────────────────────────────────

  const parseLiteral = <T>(value: T): T => {
    scanNext();
    return value;
  };

  const parseValue = (): O.Option<unknown> =>
    Match.value(token()).pipe(
      Match.when("OpenBracket", () => O.some<unknown>(parseArray())),
      Match.when("OpenBrace", () => O.some<unknown>(parseObject())),
      Match.when("String", () => O.some<unknown>(parseLiteral(scanner.getTokenValue()))),
      Match.when("Number", () => O.some<unknown>(parseLiteral(Number.parseFloat(scanner.getTokenValue())))),
      Match.when("True", () => O.some<unknown>(parseLiteral(true))),
      Match.when("False", () => O.some<unknown>(parseLiteral(false))),
      Match.when("Null", () => O.some<unknown>(parseLiteral(null))),
      Match.orElse(O.none<unknown>)
    );

  const parseArray = (): ReadonlyArray<unknown> =>
    guardDepth(
      A.empty<unknown>,
      () => {
        scanNext(); // skip [
        let items = A.empty<unknown>();
        let needsComma = false;
        while (token() !== "CloseBracket" && token() !== "EOF") {
          if (!separator("CloseBracket", "ValueExpected", needsComma)) {
            break;
          }
          const value = parseValue();
          if (O.isSome(value)) {
            items = A.append(items, value.value);
          } else {
            pushError("ValueExpected", ["CloseBracket", "Comma"]);
          }
          needsComma = true;
        }
        if (token() === "CloseBracket") {
          scanNext();
        } else {
          pushError("CloseBracketExpected");
        }
        return items;
      }
    );

  const parseObject = (): Record<string, unknown> =>
    guardDepth(
      () => ({}),
      () => {
        scanNext(); // skip {
        const obj: Record<string, unknown> = {};
        let needsComma = false;
        while (token() !== "CloseBrace" && token() !== "EOF") {
          if (!separator("CloseBrace", "PropertyNameExpected", needsComma)) {
            break;
          }
          if (token() !== "String") {
            pushError("PropertyNameExpected", ["CloseBrace", "Comma"]);
            continue;
          }
          const key = scanner.getTokenValue();
          scanNext();
          if (token() !== "Colon") {
            pushError("ColonExpected", ["CloseBrace", "Comma"]);
            continue;
          }
          scanNext();
          const value = parseValue();
          if (O.isSome(value)) {
            // Define as an own data property: plain assignment of `__proto__`
            // would mutate the object's prototype (JSON.parse semantics).
            Object.defineProperty(obj, key, {
              value: value.value,
              writable: true,
              enumerable: true,
              configurable: true,
            });
          } else {
            pushError("ValueExpected", ["CloseBrace", "Comma"]);
          }
          needsComma = true;
        }
        if (token() === "CloseBrace") {
          scanNext();
        } else {
          pushError("CloseBraceExpected");
        }
        return obj;
      }
    );

  // ── Tree mode ───────────────────────────────────────────────────────────

  const leafTree = (type: "string" | "number" | "boolean" | "null", value: unknown): JsoncNode => {
    const offset = scanner.getTokenOffset();
    const end = tokenEnd();
    scanNext();
    return makeNodeUnsafe({ type, offset, length: end - offset, value });
  };

  const parseValueTree = (): O.Option<JsoncNode> =>
    Match.value(token()).pipe(
      Match.when("OpenBracket", () => O.some(parseArrayTree())),
      Match.when("OpenBrace", () => O.some(parseObjectTree())),
      Match.when("String", () => O.some(leafTree("string", scanner.getTokenValue()))),
      Match.when("Number", () => O.some(leafTree("number", Number.parseFloat(scanner.getTokenValue())))),
      Match.when("True", () => O.some(leafTree("boolean", true))),
      Match.when("False", () => O.some(leafTree("boolean", false))),
      Match.when("Null", () => O.some(leafTree("null", null))),
      Match.orElse(O.none<JsoncNode>)
    );

  // The container end offset: the closer's tight end when present, otherwise
  // the start of whatever token the recovery stopped on.
  const closeContainer = (closer: SyntaxKind, missing: ParseCode): number => {
    if (token() === closer) {
      const end = tokenEnd();
      scanNext();
      return end;
    }
    pushError(missing);
    return scanner.getTokenOffset();
  };

  const parseArrayTree = (): JsoncNode => {
    const offset = scanner.getTokenOffset();
    return guardDepth(
      () => makeNodeUnsafe({ type: "array", offset, length: scanner.getTokenOffset() - offset, children: [] }),
      () => {
        scanNext(); // skip [
        let children = A.empty<JsoncNode>();
        let needsComma = false;
        while (token() !== "CloseBracket" && token() !== "EOF") {
          if (!separator("CloseBracket", "ValueExpected", needsComma)) {
            break;
          }
          const child = parseValueTree();
          if (O.isSome(child)) {
            children = A.append(children, child.value);
          } else {
            pushError("ValueExpected", ["CloseBracket", "Comma"]);
          }
          needsComma = true;
        }
        const end = closeContainer("CloseBracket", "CloseBracketExpected");
        return makeNodeUnsafe({ type: "array", offset, length: end - offset, children });
      }
    );
  };

  const parseObjectTree = (): JsoncNode => {
    const offset = scanner.getTokenOffset();
    return guardDepth(
      () => makeNodeUnsafe({ type: "object", offset, length: scanner.getTokenOffset() - offset, children: [] }),
      () => {
        scanNext(); // skip {
        let children = A.empty<JsoncNode>();
        let needsComma = false;
        while (token() !== "CloseBrace" && token() !== "EOF") {
          if (!separator("CloseBrace", "PropertyNameExpected", needsComma)) {
            break;
          }
          if (token() !== "String") {
            pushError("PropertyNameExpected", ["CloseBrace", "Comma"]);
            continue;
          }
          const propOffset = scanner.getTokenOffset();
          const keyNode = leafTree("string", scanner.getTokenValue());
          if (token() !== "Colon") {
            pushError("ColonExpected", ["CloseBrace", "Comma"]);
            children = A.append(
              children,
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
          if (O.isSome(valueNode)) {
            children = A.append(
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
            pushError("ValueExpected", ["CloseBrace", "Comma"]);
            children = A.append(
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
          needsComma = true;
        }
        const end = closeContainer("CloseBrace", "CloseBraceExpected");
        return makeNodeUnsafe({ type: "object", offset, length: end - offset, children });
      }
    );
  };

  // ── Drive ───────────────────────────────────────────────────────────────

  scanNext();

  const finish = (present: boolean): void => {
    if (token() !== "EOF") {
      pushError("EndOfFileExpected");
    }
    if (!present && !flags.allowEmptyContent) {
      pushError("ValueExpected");
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
};

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
 * import { ParseFlags, parseValue } from "@beep/scratchpad/effected/jsonc/internal/parser"
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
  return { value, errors };
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
 * import { ParseFlags, parseTree } from "@beep/scratchpad/effected/jsonc/internal/parser"
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
  return { root, errors };
});
