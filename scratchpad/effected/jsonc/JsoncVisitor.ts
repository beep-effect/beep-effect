// SAX-style visitor: a demand-driven `Stream` of typed events over a JSONC
// document, enabling early termination (`Stream.take`) without building an
// AST.
//
// The event union is a `S.TaggedUnion`: serializable tagged values with
// structural equality, consistent with the rest of the library. Malformed
// input surfaces as `Error` events inside the union, so the stream stays
// infallible at the type level. There is no collecting variant:
// `Stream.filter` plus `Stream.runCollect` cover it.

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { scanErrorToCode } from "./internal/parser.ts";
import { createScanner, SyntaxKind } from "./internal/scanner.ts";
import type { SkipCursor } from "./internal/skip.ts";
import { skipBalancedValue } from "./internal/skip.ts";
import { JsoncParseErrorCode, type JsoncParseOptions } from "./Jsonc.ts";
import { JsoncPath, type JsoncSegment } from "./JsoncNode.ts";

const $I = $ScratchpadId.create("effected/jsonc/JsoncVisitor");

const Span = { offset: S.Natural, length: S.Natural };

/**
 * The discriminated union of JSONC visitor events.
 *
 * **Details**
 *
 * Every variant carries `offset` and `length`; `ObjectBegin`, `ArrayBegin`,
 * `ObjectProperty` and `LiteralValue` also carry `path` context, the location
 * being entered.
 *
 * - `ObjectBegin` / `ObjectEnd`: an object's `{` and `}`.
 * - `ObjectProperty`: an object key ahead of its value; `property` is the key.
 * - `ArrayBegin` / `ArrayEnd`: an array's `[` and `]`.
 * - `LiteralValue`: a scalar; `value` is the decoded JavaScript value.
 * - `Separator`: a `,` or `:` token; `character` is which one.
 * - `Comment`: a line or block comment span.
 * - `Error`: a recovered parse error; `code` is its `JsoncParseErrorCode`.
 *
 * **Example** (Construct and guard events)
 *
 * ```ts
 * import { JsoncVisitorEvent } from "@beep/scratchpad/effected/jsonc/index"
 *
 * const event = JsoncVisitorEvent.cases.Comment.make({ offset: 0, length: 3 })
 *
 * console.log(JsoncVisitorEvent.guards.Comment(event)) // true
 * console.log(JsoncVisitorEvent.guards.Error(event)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsoncVisitorEvent = S.TaggedUnion({
  ObjectBegin: { ...Span, path: JsoncPath },
  ObjectEnd: Span,
  ObjectProperty: { ...Span, property: S.String, path: JsoncPath },
  ArrayBegin: { ...Span, path: JsoncPath },
  ArrayEnd: Span,
  LiteralValue: { ...Span, value: S.Unknown, path: JsoncPath },
  Separator: { ...Span, character: S.Literals([",", ":"]) },
  Comment: Span,
  Error: { ...Span, code: JsoncParseErrorCode },
}).pipe(
  $I.annoteSchema("JsoncVisitorEvent", {
    description: "One event of a JSONC document walk: structure, values, separators, comments or recovered errors.",
  })
);

/**
 * The decoded shape of {@link JsoncVisitorEvent}.
 *
 * @see {@link JsoncVisitorEvent} for the runtime schema and its case helpers.
 * @category type-level
 * @since 0.0.0
 */
export type JsoncVisitorEvent = typeof JsoncVisitorEvent.Type;

/**
 * Walks JSONC text as a lazy `Stream` of typed events without building an
 * AST. Not instantiable.
 *
 * **Example** (Collect the top-level keys)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 * import { JsoncVisitor, JsoncVisitorEvent } from "@beep/scratchpad/effected/jsonc/index"
 *
 * const keys = JsoncVisitor.visit('{ "a": 1, "b": 2 }').pipe(
 *   Stream.filter(JsoncVisitorEvent.guards.ObjectProperty),
 *   Stream.map((event) => event.property),
 *   Stream.runCollect
 * )
 *
 * console.log(Effect.runSync(keys)) // ["a", "b"]
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export abstract class JsoncVisitor {
  /**
   * Create a lazy `Stream` of {@link JsoncVisitorEvent} from JSONC text.
   *
   * **Details**
   *
   * Events are produced on demand, so combining with `Stream.take` allows
   * partial scans of large documents. The stream is infallible at the type
   * level: malformed input surfaces as in-band `Error` events. Only the
   * `disallowComments` option is consulted.
   *
   * **Example** (Stop after the first literal)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import * as Stream from "effect/Stream"
   * import { JsoncVisitor, JsoncVisitorEvent } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const first = JsoncVisitor.visit('{ "a": 1, "b": 2 }').pipe(
   *   Stream.filter(JsoncVisitorEvent.guards.LiteralValue),
   *   Stream.take(1),
   *   Stream.runCollect
   * )
   *
   * console.log(Effect.runSync(first).map((event) => event.value)) // [1]
   * ```
   *
   * @param text - The JSONC source to visit.
   * @param options - Parse options; only comment handling applies.
   * @returns A lazy stream of visitor events.
   */
  static visit(text: string, options?: JsoncParseOptions): Stream.Stream<JsoncVisitorEvent> {
    return Stream.fromIterable(visitGen(text, options?.disallowComments ?? false));
  }
}

const isTrivia = S.is(SyntaxKind.pick(["Trivia", "LineBreak"]));
const isComment = S.is(SyntaxKind.pick(["LineComment", "BlockComment"]));
const isScalar = S.is(SyntaxKind.pick(["String", "Number", "True", "False", "Null"]));
const isNotConsumable = S.is(SyntaxKind.pick(["CloseBrace", "CloseBracket", "EOF"]));

const literalValue = (kind: SyntaxKind, tokenValue: string): unknown =>
  Match.value(kind).pipe(
    Match.when("String", (): unknown => tokenValue),
    Match.when("Number", (): unknown => Number.parseFloat(tokenValue)),
    Match.when("True", (): unknown => true),
    Match.when("False", (): unknown => false),
    Match.orElse((): unknown => null)
  );

type Events = Generator<JsoncVisitorEvent, void>;

function* visitGen(text: string, disallowComments: boolean): Events {
  const scanner = createScanner(text, false);
  let path = A.empty<JsoncSegment>();
  // Current collection-nesting depth. Deeply nested input would otherwise
  // overflow the stack through visitObject/visitArray recursion, a defect
  // when the stream is pulled. At the cap the visitor emits one in-band Error
  // event and skips the over-deep subtree iteratively.
  let depth = 0;

  const span = () => ({ offset: scanner.getTokenOffset(), length: scanner.getTokenLength() });
  const error = (code: JsoncParseErrorCode): JsoncVisitorEvent => JsoncVisitorEvent.cases.Error.make({ ...span(), code });
  const separator = (character: "," | ":"): JsoncVisitorEvent =>
    JsoncVisitorEvent.cases.Separator.make({ ...span(), character });

  // Cursor adapter for the shared iterative bracket-balance skip. `advance` is
  // the raw scanner.scan, not the event-emitting scanNext, so nothing is
  // emitted while a too-deep container is consumed.
  const skipCursor: SkipCursor = {
    getToken: () => scanner.getToken(),
    advance: () => {
      scanner.scan();
    },
    tokenStart: () => scanner.getTokenOffset(),
    tokenLength: () => scanner.getTokenLength(),
  };

  function* scanNext(): Events {
    for (;;) {
      const kind = scanner.scan();
      const code = scanErrorToCode(scanner.getTokenError());
      if (O.isSome(code)) {
        yield error(code.value);
      }
      if (isComment(kind)) {
        yield disallowComments ? error("InvalidCommentToken") : JsoncVisitorEvent.cases.Comment.make(span());
      } else if (!isTrivia(kind)) {
        return;
      }
    }
  }

  function* visitContainer(body: () => Events): Events {
    if (depth >= MAX_NESTING_DEPTH) {
      yield error("NestingDepthExceeded");
      skipBalancedValue(skipCursor);
      return;
    }
    depth++;
    try {
      yield* body();
    } finally {
      depth--;
    }
  }

  function* visitValue(): Events {
    const kind = scanner.getToken();
    if (kind === "OpenBrace") {
      yield* visitContainer(visitObject);
    } else if (kind === "OpenBracket") {
      yield* visitContainer(visitArray);
    } else if (isScalar(kind)) {
      yield JsoncVisitorEvent.cases.LiteralValue.make({ ...span(), value: literalValue(kind, scanner.getTokenValue()), path });
      yield* scanNext();
    } else {
      yield error("ValueExpected");
      // Consume the offending token so recovery always makes progress:
      // leaving it in place loops forever on inputs like `[bad]`. Container
      // closers stay put so the enclosing visit can close normally.
      if (!isNotConsumable(kind)) {
        yield* scanNext();
      }
    }
  }

  // Shared container-loop step: emits the separator before an entry or the
  // missing-comma error. Returns `false` when a trailing comma closed the
  // container.
  function* entrySeparator(closer: SyntaxKind, needsComma: boolean): Generator<JsoncVisitorEvent, boolean> {
    if (scanner.getToken() === "Comma") {
      yield separator(",");
      yield* scanNext();
      return scanner.getToken() !== closer;
    }
    if (needsComma) {
      yield error("CommaExpected");
    }
    return true;
  }

  function* closeContainer(closer: SyntaxKind, end: () => JsoncVisitorEvent, missing: JsoncParseErrorCode): Events {
    if (scanner.getToken() === closer) {
      yield end();
      yield* scanNext();
    } else {
      yield error(missing);
    }
  }

  function* visitObject(): Events {
    yield JsoncVisitorEvent.cases.ObjectBegin.make({ ...span(), path });
    yield* scanNext(); // skip {
    let needsComma = false;
    while (scanner.getToken() !== "CloseBrace" && scanner.getToken() !== "EOF") {
      if (!(yield* entrySeparator("CloseBrace", needsComma))) {
        break;
      }
      if (scanner.getToken() !== "String") {
        yield error("PropertyNameExpected");
        yield* scanNext();
        continue;
      }
      const key = scanner.getTokenValue();
      yield JsoncVisitorEvent.cases.ObjectProperty.make({ ...span(), property: key, path });
      path = A.append(path, key);
      yield* scanNext(); // skip key
      if (scanner.getToken() === "Colon") {
        yield separator(":");
        yield* scanNext(); // skip colon
      } else {
        yield error("ColonExpected");
      }
      yield* visitValue();
      path = A.dropRight(path, 1);
      needsComma = true;
    }
    yield* closeContainer("CloseBrace", () => JsoncVisitorEvent.cases.ObjectEnd.make(span()), "CloseBraceExpected");
  }

  function* visitArray(): Events {
    yield JsoncVisitorEvent.cases.ArrayBegin.make({ ...span(), path });
    yield* scanNext(); // skip [
    let index = 0;
    let needsComma = false;
    while (scanner.getToken() !== "CloseBracket" && scanner.getToken() !== "EOF") {
      if (!(yield* entrySeparator("CloseBracket", needsComma))) {
        break;
      }
      path = A.append(path, index);
      yield* visitValue();
      path = A.dropRight(path, 1);
      index++;
      needsComma = true;
    }
    yield* closeContainer("CloseBracket", () => JsoncVisitorEvent.cases.ArrayEnd.make(span()), "CloseBracketExpected");
  }

  yield* scanNext();
  if (scanner.getToken() !== "EOF") {
    yield* visitValue();
    if (scanner.getToken() !== "EOF") {
      yield error("EndOfFileExpected");
    }
  }
}
