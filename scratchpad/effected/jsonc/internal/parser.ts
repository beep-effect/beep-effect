import * as Match from "effect/Match";
// Recursive-descent JSONC parser: value mode (plain JS values) and tree mode
// (`JsoncNode` AST). Private implementation.
//
// This module owns the single copy of the scan-error to parse-code mapping
// (`scanErrorToCode`), consumed by both this parser and the visitor. It
// returns plain results plus raw error records (`{ code, offset, length }`)
// and MUST NOT import from `Jsonc.ts`: the facade maps raw records into
// `JsoncParseErrorDetail` (computing `line`/`character` from `offset`) and
// constructs the aggregate `JsoncParseError` itself, so the dependency edge
// runs facade to parser only — never the reverse (a cycle would trip the
// error-level `noImportCycles` lint).
//
// Reference: Microsoft's jsonc-parser parser design (MIT).
import * as S from "effect/Schema";
import { pipe } from "effect/Function";
import * as Tuple from "effect/Tuple";
import { JsoncNode } from "../JsoncNode.ts";
import { makeNodeUnsafe } from "../JsoncNode.ts";
import { MAX_NESTING_DEPTH } from "./limits.ts";
import { dual } from "effect/Function";
import  { ScanError, type SyntaxKind } from "./scanner.ts";
import { createScanner } from "./scanner.ts";
import type { SkipCursor } from "./skip.ts";
import { skipBalancedValue } from "./skip.ts";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { $ScratchpadId } from "@beep/identity/packages";

const $I = $ScratchpadId.create("internal/parser");

/**
 * The public parse-error code vocabulary. The facade builds its `@public`
 * `JsoncParseErrorCode` schema from this array; the parser produces these codes
 * as plain strings so the schema stays facade-owned without an import cycle.
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

export const ParseCode = LiteralKit(
  JSONC_PARSE_ERROR_CODES,
).pipe(
  $I.annoteSchema("ParseCode", {
    description: "A single parse-error code.",
  }),
);

/** A single parse-error code. */
export type ParseCode = typeof ParseCode.Type;

export const RawParseError = ParseCode.mapMembers((members) => {
  const make = <T extends ParseCode>({ literal }: S.Literal<T>) => S.Struct({
    code: S.tag(literal),
    offset: S.Finite,
    length: S.Finite,
  });

  return pipe(
    members,
    Tuple.evolve(
      [
        make,
        make,
        make,
        make,
        make,
        make,
        make,
        make,
        make,
        make,
        make,
        make,
        make,
        make,
        make,
        make,
        make,
      ],
    ),
  );
}).pipe(
  S.toTaggedUnion("code"),
  $I.annoteSchema("RawParseError", {
    description: "A single raw parse-error record — position only; the facade derives line/character.",
  }),
);

/** A raw parse error record — position only; the facade derives line/character. */
export type RawParseError = typeof RawParseError.Type;

/** Plain flags accepted by the parser, decoded from `JsoncParseOptions` by the facade. */
export const ParseFlags = S.Struct({
  disallowComments: S.optional(S.Boolean),
  allowTrailingComma: S.optional(S.Boolean),
  allowEmptyContent: S.optional(S.Boolean),
});
export type ParseFlags = typeof ParseFlags.Type;

/** Value-mode recovery result before the facade adds source positions. */
export const ParseValueResult = S.Struct({ value: S.Unknown, errors: S.Array(RawParseError) });
export type ParseValueResult = typeof ParseValueResult.Type;

/** Tree-mode recovery result; empty input has no root. */
export const ParseTreeResult = S.Struct({ root: S.UndefinedOr(JsoncNode), errors: S.Array(RawParseError) });
export type ParseTreeResult = typeof ParseTreeResult.Type;

/**
 * The single scan-error to parse-code translation, shared by the parser and the
 * visitor. Returns `undefined` for `"None"` (no error).
 */
export const scanErrorToCode = (error: ScanError): ParseCode | undefined => {
	return Match.value(error).pipe(
Match.when("InvalidUnicode", (): ParseCode | undefined => {
			return "InvalidUnicode";
}),
Match.when("InvalidEscapeCharacter", (): ParseCode | undefined => {
			return "InvalidEscapeCharacter";
}),
Match.when("UnexpectedEndOfNumber", (): ParseCode | undefined => {
			return "InvalidNumberFormat";
}),
Match.when("UnexpectedEndOfComment", (): ParseCode | undefined => {
			return "UnexpectedEndOfComment";
}),
Match.when("UnexpectedEndOfString", (): ParseCode | undefined => {
			return "UnexpectedEndOfString";
}),
Match.when("InvalidCharacter", (): ParseCode | undefined => {
			return "InvalidCharacter";
}),
Match.when("InvalidSymbol", (): ParseCode | undefined => {
			return "InvalidSymbol";
}),
Match.orElse((): ParseCode | undefined => {
			return undefined;
})
);
};

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
    for (; ;) {
      currentToken = scanner.scan();
      const code = scanErrorToCode(scanner.getTokenError());
      if (code !== undefined) {
        pushError(code);
      }
      if (currentToken === "LineComment" || currentToken === "BlockComment") {
        if (disallowComments) pushError("InvalidCommentToken");
        continue;
      }
      if (currentToken !== "Trivia" && currentToken !== "LineBreak") return currentToken;
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
      errors.push({
        code: "NestingDepthExceeded",
        offset: scanner.getTokenOffset(),
        length: scanner.getTokenLength(),
      });
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
    errors.push({
      code,
      offset: scanner.getTokenOffset(),
      length: scanner.getTokenLength(),
    });
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
Match.when("OpenBracket", (): unknown => {
        return parseArray();
}),
Match.when("OpenBrace", (): unknown => {
        return parseObject();
}),
Match.when("String", (): unknown => {
        return parseString();
}),
Match.when("Number", (): unknown => {
        return parseNumber();
}),
Match.when("True", (): unknown => {
        scanNext();
        return true;
}),
Match.when("False", (): unknown => {
        scanNext();
        return false;
}),
Match.when("Null", (): unknown => {
        scanNext();
        return null;
}),
Match.orElse((): unknown => {
        return undefined;
})
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
        Object.defineProperty(obj, key, {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        });
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
Match.when("OpenBracket", (): JsoncNode | undefined => {
        return parseArrayTree();
}),
Match.when("OpenBrace", (): JsoncNode | undefined => {
        return parseObjectTree();
}),
Match.when("String", (): JsoncNode | undefined => {
        return leafTree("string", scanner.getTokenValue());
}),
Match.when("Number", (): JsoncNode | undefined => {
        return leafTree("number", Number.parseFloat(scanner.getTokenValue()));
}),
Match.when("True", (): JsoncNode | undefined => {
        return leafTree("boolean", true);
}),
Match.when("False", (): JsoncNode | undefined => {
        return leafTree("boolean", false);
}),
Match.when("Null", (): JsoncNode | undefined => {
        return leafTree("null", null);
}),
Match.orElse((): JsoncNode | undefined => {
        return undefined;
})
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
      return makeNodeUnsafe({
        type: "array",
        offset,
        length: scanner.getTokenOffset() - offset,
        children: [],
      });
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
    return makeNodeUnsafe({
      type: "array",
      offset,
      length: end - offset,
      children,
    });
  }

  function parseObjectTree(): JsoncNode {
    const offset = scanner.getTokenOffset();
    if (depth >= MAX_NESTING_DEPTH) {
      pushDepthError();
      skipContainer();
      return makeNodeUnsafe({
        type: "object",
        offset,
        length: scanner.getTokenOffset() - offset,
        children: [],
      });
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
          }),
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
          }),
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
          }),
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
    return makeNodeUnsafe({
      type: "object",
      offset,
      length: end - offset,
      children,
    });
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

/** Parse into a plain JS value, recovering from and collecting every error. */
export const parseValue: {
  (text: string, flags: ParseFlags): ParseValueResult,
  (flags: ParseFlags): (text: string) => ParseValueResult
} = dual(2, (text: string, flags: ParseFlags): ParseValueResult => {
  const { value, errors } = run(text, flags, false);
  return { value, errors };
});

/** Parse into a {@link JsoncNode} AST, recovering from and collecting every error. */
export const parseTree: {
  (text: string, flags: ParseFlags): ParseTreeResult,
  (flags: ParseFlags): (text: string) => ParseTreeResult
} = dual(2, (text: string, flags: ParseFlags): ParseTreeResult => {
  const { root, errors } = run(text, flags, true);
  return { root, errors };
});
