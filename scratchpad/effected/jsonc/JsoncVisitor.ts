import * as Match from "effect/Match";
// SAX-style visitor: a demand-driven `Stream` of typed events over a JSONC
// document, enabling early termination (`Stream.take`) without building an
// AST.
//
// The event union is a `Schema.TaggedUnion` — serializable tagged values with
// structural equality, consistent with the rest of the library. Malformed
// input surfaces as `Error` events inside the union, so the stream stays
// infallible at the type level. There is no collecting variant:
// `Stream.filter` + `Stream.runCollect` cover it.

import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { scanErrorToCode } from "./internal/parser.ts";
import type { SyntaxKind } from "./internal/scanner.ts";
import { createScanner } from "./internal/scanner.ts";
import type { SkipCursor } from "./internal/skip.ts";
import { skipBalancedValue } from "./internal/skip.ts";
import { JsoncParseErrorCode, type JsoncParseOptions } from "./Jsonc.ts";
import { JsoncPath, type JsoncSegment } from "./JsoncNode.ts";

/**
 * The discriminated union of JSONC visitor events. Every variant carries
 * `offset` and `length`; `ObjectBegin`, `ArrayBegin`, `ObjectProperty` and
 * `LiteralValue` also carry `path` context (the location being entered).
 *
 * - `ObjectBegin` / `ObjectEnd` — an object's opening `{` / closing `}`.
 * - `ObjectProperty` — an object key, ahead of its value; `property` is the
 *   key string.
 * - `ArrayBegin` / `ArrayEnd` — an array's opening `[` / closing `]`.
 * - `LiteralValue` — a scalar value (`string`/`number`/`boolean`/`null`);
 *   `value` is the decoded JS value.
 * - `Separator` — a `,` or `:` token; `character` is which one.
 * - `Comment` — a line or block comment span.
 * - `Error` — a recovered parse error; `code` is its `JsoncParseErrorCode`.
 *
 * @public
 */
export const JsoncVisitorEvent = S.TaggedUnion({
  ObjectBegin: { offset: S.Int, length: S.Int, path: JsoncPath },
  ObjectEnd: { offset: S.Int, length: S.Int },
  ObjectProperty: { property: S.String, offset: S.Int, length: S.Int, path: JsoncPath },
  ArrayBegin: { offset: S.Int, length: S.Int, path: JsoncPath },
  ArrayEnd: { offset: S.Int, length: S.Int },
  LiteralValue: { value: S.Unknown, offset: S.Int, length: S.Int, path: JsoncPath },
  Separator: { character: S.Literals([",", ":"]), offset: S.Int, length: S.Int },
  Comment: { offset: S.Int, length: S.Int },
  Error: { code: JsoncParseErrorCode, offset: S.Int, length: S.Int },
});
export type JsoncVisitorEvent = typeof JsoncVisitorEvent.Type;

/**
 * Walks JSONC text as a lazy `Stream` of typed events — objects, properties,
 * values, separators, comments and recovered errors — without building an AST.
 * Not instantiable.
 *
 * @example
 * ```ts
 * import { JsoncVisitor, JsoncVisitorEvent } from "@effected/jsonc";
 * import { Effect, Stream } from "effect";
 *
 * const keys = JsoncVisitor.visit('{ "a": 1, "b": 2 }').pipe(
 *   Stream.filter(JsoncVisitorEvent.guards.ObjectProperty),
 *   Stream.map((event) => event.property),
 *   Stream.runCollect,
 * );
 * // Effect.runSync(keys) // => ["a", "b"]
 * ```
 *
 * @public
 */
export abstract class JsoncVisitor {

  /**
   * Create a lazy `Stream` of `JsoncVisitorEvent` from JSONC text. Events
   * are produced on demand, so combining with `Stream.take` allows efficient
   * partial scans of large documents.
   *
   * @param text - The JSONC source to visit.
   * @param options - Optional {@link JsoncParseOptions}; only comment handling
   *   is consulted.
   * @returns A lazy `Stream` of `JsoncVisitorEvent`, infallible at the type
   *   level — malformed input surfaces as in-band `Error` events rather than
   *   failing the stream.
   */
  static visit(text: string, options?: JsoncParseOptions): Stream.Stream<JsoncVisitorEvent> {
    return Stream.fromIterable(visitGen(text, options?.disallowComments ?? false));
  }
}

function* visitGen(text: string, disallowComments: boolean): Generator<JsoncVisitorEvent> {
  const scanner = createScanner(text, false);
  const path: Array<JsoncSegment> = [];
  // Current collection-nesting depth. Deeply-nested input would otherwise
  // overflow the stack via visitObject/visitArray recursion — a defect when the
  // stream is pulled. At the cap the visitor emits one in-band Error event and
  // skips the over-deep subtree iteratively (see MAX_NESTING_DEPTH).
  let depth = 0;

  // Cursor adapter for the shared iterative bracket-balance skip (see
  // internal/skip.ts). `advance` is the raw scanner.scan — not the
  // event-emitting scanNext — so nothing is emitted while a too-deep
  // container is consumed.
  const skipCursor: SkipCursor = {
    getToken: () => scanner.getToken(),
    advance: () => {
      scanner.scan();
    },
    tokenStart: () => scanner.getTokenOffset(),
    tokenEnd: () => scanner.getTokenOffset() + scanner.getTokenLength(),
  };

  // Consume a balanced container (current token is its opener) — never
  // recursing, never emitting.
  function skipDeepContainer(): void {
    skipBalancedValue(skipCursor);
  }

  function* scanNext(): Generator<JsoncVisitorEvent, SyntaxKind> {
    for (; ;) {
      const t = scanner.scan();

      const code = scanErrorToCode(scanner.getTokenError());
      if (code !== undefined) {
        yield JsoncVisitorEvent.cases.Error.make({
          code,
          offset: scanner.getTokenOffset(),
          length: scanner.getTokenLength(),
        });
      }

      if (t === "LineComment" || t === "BlockComment") {
        const span = { offset: scanner.getTokenOffset(), length: scanner.getTokenLength() };
        yield disallowComments
          ? JsoncVisitorEvent.cases.Error.make({ ...span, code: "InvalidCommentToken" })
          : JsoncVisitorEvent.cases.Comment.make(span);
        continue;
      }
      if (t !== "Trivia" && t !== "LineBreak") return t;
    }
  }

  function literalValue(kind: SyntaxKind, tokenValue: string): unknown {
    return Match.value(kind).pipe(
Match.when("String", (): unknown => {
        return tokenValue;
}),
Match.when("Number", (): unknown => {
        return Number.parseFloat(tokenValue);
}),
Match.when("True", (): unknown => {
        return true;
}),
Match.when("False", (): unknown => {
        return false;
}),
Match.when("Null", (): unknown => {
        return null;
}),
Match.orElse((): unknown => {
        return undefined;
})
);
  }

  function* visitValue(): Generator<JsoncVisitorEvent, boolean> {
    const t = scanner.getToken();
    return yield* Match.value(t).pipe(
Match.when("OpenBrace", function* (): Generator<JsoncVisitorEvent, boolean> { {
        if (depth >= MAX_NESTING_DEPTH) {
          yield JsoncVisitorEvent.cases.Error.make({
            code: "NestingDepthExceeded",
            offset: scanner.getTokenOffset(),
            length: scanner.getTokenLength(),
          });
          skipDeepContainer();
          return false;
        }
        depth++;
        try {
          return yield* visitObject();
        } finally {
          depth--;
        }
      }
}),
Match.when("OpenBracket", function* (): Generator<JsoncVisitorEvent, boolean> { {
        if (depth >= MAX_NESTING_DEPTH) {
          yield JsoncVisitorEvent.cases.Error.make({
            code: "NestingDepthExceeded",
            offset: scanner.getTokenOffset(),
            length: scanner.getTokenLength(),
          });
          skipDeepContainer();
          return false;
        }
        depth++;
        try {
          return yield* visitArray();
        } finally {
          depth--;
        }
      }
}),
Match.whenOr("String", "Number", "True", "False", "Null", function* (): Generator<JsoncVisitorEvent, boolean> {
        yield JsoncVisitorEvent.cases.LiteralValue.make({
          value: literalValue(t, scanner.getTokenValue()),
          offset: scanner.getTokenOffset(),
          length: scanner.getTokenLength(),
          path: [...path],
        });
        yield* scanNext();
        return true;
}),
Match.orElse(function* (): Generator<JsoncVisitorEvent, boolean> { {
        yield JsoncVisitorEvent.cases.Error.make({
          code: "ValueExpected",
          offset: scanner.getTokenOffset(),
          length: scanner.getTokenLength(),
        });
        // Consume the offending token so recovery always makes progress —
        // leaving it in place loops forever on inputs like `[bad]`. Container
        // closers stay put so the enclosing visit can close normally.
        if (t !== "CloseBrace" && t !== "CloseBracket" && t !== "EOF") {
          yield* scanNext();
        }
        return false;
      }
})
);
  }

  function* visitObject(): Generator<JsoncVisitorEvent, boolean> {
    yield JsoncVisitorEvent.cases.ObjectBegin.make({
      offset: scanner.getTokenOffset(),
      length: scanner.getTokenLength(),
      path: [...path],
    });

    yield* scanNext(); // skip {
    let needsComma = false;

    while (scanner.getToken() !== "CloseBrace" && scanner.getToken() !== "EOF") {
      if (scanner.getToken() === "Comma") {
        yield JsoncVisitorEvent.cases.Separator.make({
          character: ",",
          offset: scanner.getTokenOffset(),
          length: scanner.getTokenLength(),
        });
        yield* scanNext();
        if (scanner.getToken() === "CloseBrace") {
          break; // trailing comma
        }
      } else if (needsComma) {
        yield JsoncVisitorEvent.cases.Error.make({
          code: "CommaExpected",
          offset: scanner.getTokenOffset(),
          length: scanner.getTokenLength(),
        });
      }

      if (scanner.getToken() !== "String") {
        yield JsoncVisitorEvent.cases.Error.make({
          code: "PropertyNameExpected",
          offset: scanner.getTokenOffset(),
          length: scanner.getTokenLength(),
        });
        yield* scanNext();
        continue;
      }

      const key = scanner.getTokenValue();
      yield JsoncVisitorEvent.cases.ObjectProperty.make({
        property: key,
        offset: scanner.getTokenOffset(),
        length: scanner.getTokenLength(),
        path: [...path],
      });
      path.push(key);

      yield* scanNext(); // skip key
      if (scanner.getToken() === "Colon") {
        yield JsoncVisitorEvent.cases.Separator.make({
          character: ":",
          offset: scanner.getTokenOffset(),
          length: scanner.getTokenLength(),
        });
        yield* scanNext(); // skip colon
      } else {
        yield JsoncVisitorEvent.cases.Error.make({
          code: "ColonExpected",
          offset: scanner.getTokenOffset(),
          length: scanner.getTokenLength(),
        });
      }

      yield* visitValue();
      path.pop();
      needsComma = true;
    }

    if (scanner.getToken() === "CloseBrace") {
      yield JsoncVisitorEvent.cases.ObjectEnd.make({
        offset: scanner.getTokenOffset(),
        length: scanner.getTokenLength(),
      });
      yield* scanNext();
    } else {
      yield JsoncVisitorEvent.cases.Error.make({
        code: "CloseBraceExpected",
        offset: scanner.getTokenOffset(),
        length: scanner.getTokenLength(),
      });
    }

    return true;
  }

  function* visitArray(): Generator<JsoncVisitorEvent, boolean> {
    yield JsoncVisitorEvent.cases.ArrayBegin.make({
      offset: scanner.getTokenOffset(),
      length: scanner.getTokenLength(),
      path: [...path],
    });

    yield* scanNext(); // skip [
    let index = 0;
    let needsComma = false;

    while (scanner.getToken() !== "CloseBracket" && scanner.getToken() !== "EOF") {
      if (scanner.getToken() === "Comma") {
        yield JsoncVisitorEvent.cases.Separator.make({
          character: ",",
          offset: scanner.getTokenOffset(),
          length: scanner.getTokenLength(),
        });
        yield* scanNext();
        if (scanner.getToken() === "CloseBracket") {
          break; // trailing comma
        }
      } else if (needsComma) {
        yield JsoncVisitorEvent.cases.Error.make({
          code: "CommaExpected",
          offset: scanner.getTokenOffset(),
          length: scanner.getTokenLength(),
        });
      }

      path.push(index);
      yield* visitValue();
      path.pop();
      index++;
      needsComma = true;
    }

    if (scanner.getToken() === "CloseBracket") {
      yield JsoncVisitorEvent.cases.ArrayEnd.make({
        offset: scanner.getTokenOffset(),
        length: scanner.getTokenLength(),
      });
      yield* scanNext();
    } else {
      yield JsoncVisitorEvent.cases.Error.make({
        code: "CloseBracketExpected",
        offset: scanner.getTokenOffset(),
        length: scanner.getTokenLength(),
      });
    }

    return true;
  }

  yield* scanNext();
  if (scanner.getToken() !== "EOF") {
    yield* visitValue();
    if (scanner.getToken() !== "EOF") {
      yield JsoncVisitorEvent.cases.Error.make({
        code: "EndOfFileExpected",
        offset: scanner.getTokenOffset(),
        length: scanner.getTokenLength(),
      });
    }
  }
}
