/**
 * SAX-style event stream over the semantic walk: `TableStart`/
 * `ArrayTableStart`/`KeyValue` events ride `analyze`'s existing iterative pass
 * (no added recursion — analyze's own header/dotted-key navigation is already
 * iterative, and this module adds only a flat second pass plus a sort, never
 * a walk of its own). Comment events — standalone trivia comments and
 * expression trailing comments — are collected by that second pass over the
 * same `TomlExpression` array and merged with the semantic events by source
 * offset, so the merged sequence streams in document order.
 *
 * **Details**
 *
 * Offset semantics (pinned in `test/TomlVisitor.test.ts`): a `Comment`
 * event's `offset` is the position of its `#` marker in the source text. For
 * a standalone trivia comment that is the `#` found inside the trivia's raw
 * slice; for a trailing comment it is located by searching forward from the
 * end of the value span (key-values) or the last key span (headers) — the
 * first position a `#` can legally appear, since nothing between there and
 * the comment marker can itself contain a `#` character.
 *
 * Cycle firewall: same materialization as `Toml.parse` — the engine
 * throws raw carriers (`RawTomlError`, `GuardExceeded`); this module builds
 * the typed `TomlParseError`, never letting a raw carrier escape as a defect.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TomlId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { constant, dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { parseExpressions } from "./internal/parser.ts";
import { scanComment, scanNewline, scanWhitespace } from "./internal/scanner.ts";
import { analyze } from "./internal/semantic.ts";
import { TomlParseError } from "./Toml.ts";
import { TomlKeyValue } from "./TomlNode.ts";
import type { TomlArrayTableHeader, TomlTableHeader, TomlTrivia } from "./TomlNode.ts";

const $I = $TomlId.create("TomlVisitor");

const visitorVariants = S.TaggedUnion({
  TableStart: {
    path: S.Array(S.String).pipe(
      $I.annoteKey("TomlVisitorEvent.TableStart.path", {
        description: "Semantic table path, empty for the root table.",
      })
    ),
  },
  ArrayTableStart: {
    path: S.Array(S.String).pipe(
      $I.annoteKey("TomlVisitorEvent.ArrayTableStart.path", { description: "Semantic path of the array of tables." })
    ),
    index: S.Finite.pipe(
      $I.annoteKey("TomlVisitorEvent.ArrayTableStart.index", {
        description: "Zero-based index of the table element starting at this header.",
      })
    ),
  },
  KeyValue: {
    path: S.Array(S.String).pipe(
      $I.annoteKey("TomlVisitorEvent.KeyValue.path", { description: "Semantic key path including the final key." })
    ),
    node: TomlKeyValue.pipe(
      $I.annoteKey("TomlVisitorEvent.KeyValue.node", {
        description: "CST key-value expression carrying the original value and source spans.",
      })
    ),
  },
  Comment: {
    text: S.String.pipe(
      $I.annoteKey("TomlVisitorEvent.Comment.text", {
        description: "Comment text after the hash marker with one leading space removed.",
      })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("TomlVisitorEvent.Comment.offset", {
        description: "Source position of the comment's hash marker in UTF-16 code units.",
      })
    ),
  },
}).pipe(
  $I.annoteSchema("TomlVisitorEvent", {
    description: "Table, array-table, key-value and comment events emitted in TOML document order.",
  })
);

/**
 * The discriminated union of TOML visitor events, in document order.
 *
 * **Details**
 *
 * `TableStart` fires once for the root with `path: []` before any other
 * event, then again for every `[table]` header. `ArrayTableStart` fires for
 * every `[[array]]` header with the 0-based element `index`. `KeyValue.path`
 * includes the final key. `Comment` covers both standalone (trivia) and
 * trailing comments: `offset` is the source position of the comment's `#`
 * marker, and `text` is the comment after the `#` with one leading space
 * removed.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export type TomlVisitorEvent = typeof visitorVariants.Type;

const visitorConstructors = Data.taggedEnum<TomlVisitorEvent>();
const visitorBaseWidenedForClassExtension: S.Codec<TomlVisitorEvent, typeof visitorVariants.Encoded> =
  S.Opaque<TomlVisitorEvent>()(visitorVariants);

class TomlVisitorEventStatics extends visitorBaseWidenedForClassExtension {
  static readonly TableStart = visitorConstructors.TableStart;
  static readonly ArrayTableStart = visitorConstructors.ArrayTableStart;
  static readonly KeyValue = visitorConstructors.KeyValue;
  static readonly Comment = visitorConstructors.Comment;
  static readonly $is = visitorConstructors.$is;
  static readonly $match = visitorConstructors.$match;
}

/**
 * Constructors and matchers for the `TomlVisitorEvent` union (e.g.
 * `TomlVisitorEvent.KeyValue({ path, node })`, `TomlVisitorEvent.$is("Comment")`).
 *
 * **Example** (Construct and recognize a comment event)
 *
 * ```ts
 * import { TomlVisitorEvent } from "@beep/toml/TomlVisitor";
 *
 * const event = TomlVisitorEvent.Comment({ text: "note", offset: 0 });
 * console.log(TomlVisitorEvent.$is("Comment")(event)) // true
 * ```
 *
 * @public
 * @category constructors
 * @since 0.0.0
 */
export const TomlVisitorEvent = TomlVisitorEventStatics;

const ROOT_TABLE_SORT_OFFSET_BEFORE_ANY_COMMENT = -1;

interface PositionedEvent {
  readonly event: TomlVisitorEvent;
  readonly offset: number;
}

const stripOneLeadingCommentSpace = (raw: string): string => (Str.startsWith(" ")(raw) ? Str.slice(1)(raw) : raw);

const trailingCommentOffset: {
  (source: string, expression: TomlKeyValue | TomlTableHeader | TomlArrayTableHeader): number;
  (expression: TomlKeyValue | TomlTableHeader | TomlArrayTableHeader): (source: string) => number;
} = dual(2, (source: string, expression: TomlKeyValue | TomlTableHeader | TomlArrayTableHeader): number => {
  const start = P.isTagged(expression, "TomlKeyValue")
    ? expression.value.offset + expression.value.length
    : A.reduce(expression.keyPath, expression.offset, (_, key) => key.offset + key.length);
  return pipe(
    source,
    Str.slice(start),
    Str.indexOf("#"),
    O.map((index) => start + index),
    O.getOrElse(constant(-1))
  );
});

const pastNewlineOrEof = (text: string, i: number): number => (i < text.length ? scanNewline(text, i) : i);

const collectTriviaComments = (trivia: TomlTrivia): Array<PositionedEvent> => {
  const events: Array<PositionedEvent> = [];
  const text = trivia.text;
  let pos = 0;
  while (pos < text.length) {
    const i = scanWhitespace(text, pos);
    if ((text[i] ?? "") !== "#") {
      pos = pastNewlineOrEof(text, i);
      continue;
    }
    const scanned = scanComment(text, i);
    const offset = trivia.offset + i;
    events.push({
      offset,
      event: TomlVisitorEvent.Comment({ text: stripOneLeadingCommentSpace(scanned.value), offset }),
    });
    pos = pastNewlineOrEof(text, scanned.end);
  }
  return events;
};

// decision: engine-diagnostic-boundary
const collectEvents = (text: string): Array<TomlVisitorEvent> => {
  const expressions = parseExpressions(text);
  const positioned: Array<PositionedEvent> = [];

  analyze(expressions, {
    onTableStart: (path, header) => {
      positioned.push({
        offset: header?.offset ?? ROOT_TABLE_SORT_OFFSET_BEFORE_ANY_COMMENT,
        event: TomlVisitorEvent.TableStart({ path }),
      });
    },
    onArrayTableStart: (path, index, header) => {
      positioned.push({ offset: header.offset, event: TomlVisitorEvent.ArrayTableStart({ path, index }) });
    },
    onKeyValue: (path, node) => {
      positioned.push({ offset: node.offset, event: TomlVisitorEvent.KeyValue({ path, node }) });
    },
  });

  for (const expression of expressions) {
    if (P.isTagged(expression, "TomlTrivia")) {
      positioned.push(...collectTriviaComments(expression));
      continue;
    }
    if (expression.comment !== undefined) {
      const offset = trailingCommentOffset(text, expression);
      positioned.push({ offset, event: TomlVisitorEvent.Comment({ text: expression.comment, offset }) });
    }
  }

  const sorted = A.sort(
    positioned,
    Order.mapInput(Order.Number, (event: PositionedEvent) => event.offset)
  );
  return A.map(sorted, (positionedEvent) => positionedEvent.event);
};

const collectEventsOrFail = (text: string): Effect.Effect<Array<TomlVisitorEvent>, TomlParseError> =>
  Effect.try({
    try: () => collectEvents(text),
    catch: (defect) => TomlParseError.fromDefect(text, defect),
  });

/**
 * Walks TOML text as a `Stream` of table, array-table, key-value and comment
 * events in document order, without building a value. Not instantiable.
 *
 * **Example** (Collect dotted key paths from TOML visitor events)
 *
 * ```ts
 * import { TomlVisitor, TomlVisitorEvent } from "@beep/toml/TomlVisitor";
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 *
 * const keys = TomlVisitor.visit("[server]\nport = 1\n").pipe(
 *   Stream.filter(TomlVisitorEvent.$is("KeyValue")),
 *   Stream.map((event) => event.path.join(".")),
 *   Stream.runCollect,
 * );
 * console.log(Effect.runSync(keys).join(",")) // server.port
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
 */
export class TomlVisitor {
  private constructor() {}

  /**
   * Creates a stream of TOML visitor events in document order.
   *
   * **Details**
   *
   * Fails the stream with {@link TomlParseError} on the first
   * lex/parse or semantic violation — never as an unhandled defect.
   *
   * **Gotchas**
   *
   * Construction is eager, not on-demand: the full text is parsed, walked by
   * `analyze` and sorted into document order up front, inside the `Effect`
   * `Stream.unwrap` runs to build the stream. Only enumeration of the
   * already-built event array is streamed — `Stream.take` still short-circuits
   * consumption, but it does not avoid the initial parse/analyze/sort pass.
   *
   * **Example** (Count root and key-value events)
   *
   * ```ts
   * import { TomlVisitor } from "@beep/toml/TomlVisitor";
   * import * as Effect from "effect/Effect";
   * import * as Stream from "effect/Stream";
   *
   * const events = Stream.runCollect(TomlVisitor.visit("port = 1\n"));
   * console.log(Effect.runSync(events).length) // 2
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static visit(text: string): Stream.Stream<TomlVisitorEvent, TomlParseError> {
    return Stream.unwrap(collectEventsOrFail(text).pipe(Effect.map(Stream.fromIterable)));
  }
}
