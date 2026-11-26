/**
 * SAX-style AST visitor: a demand-driven `Stream` of typed events over a
 * parsed YAML document, enabling early termination (`Stream.take`) without
 * building a full in-memory result beyond the AST itself.
 *
 * **Details**
 *
 * The event union is a `Data.TaggedEnum` — serializable tagged values with
 * structural equality, consistent with the rest of the library; `_tag`
 * narrowing suffices, so there are no `is*` guards. There is no collecting
 * variant: `Stream.filter` + `Stream.runCollect` cover it.
 *
 * This is the AST-level visitor only — the CST layer stays internal.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $YamlId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Data from "effect/Data";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { composeAllDocuments } from "./internal/composer/document.ts";
import { ParseOptionsInput } from "./internal/options.ts";
import { YamlDiagnostic } from "./YamlDiagnostic.ts";
import { CollectionStyle, ScalarStyle, YamlAlias, YamlMap, YamlScalar } from "./YamlNode.ts";
import type { RawYamlDocument } from "./internal/raw-document.ts";
import type { YamlParseOptions } from "./Yaml.ts";
import type { YamlPath } from "./YamlEdit.ts";
import type { YamlNode, YamlPair, YamlSeq } from "./YamlNode.ts";

const $I = $YamlId.create("YamlVisitor");
const isScalar = S.is(YamlScalar);
const isAlias = S.is(YamlAlias);
const isMap = S.is(YamlMap);
const isFiniteNumber = S.is(S.Finite);

const eventContext = {
  path: S.Array(S.Union([S.String, S.Finite])).pipe(
    $I.annoteKey("YamlVisitorEvent.path", {
      description: "Ordered mapping keys and sequence indices from the document root.",
    })
  ),
  depth: S.Finite.pipe(
    $I.annoteKey("YamlVisitorEvent.depth", { description: "Zero-based nesting depth of the visited construct." })
  ),
};
const eventProperties = {
  tag: S.optionalKey(S.String).pipe(
    $I.annoteKey("YamlVisitorEvent.tag", { description: "Explicit YAML tag attached to the construct, when present." })
  ),
  anchor: S.optionalKey(S.String).pipe(
    $I.annoteKey("YamlVisitorEvent.anchor", { description: "Anchor name attached to the construct, when present." })
  ),
};
const collectionContext = {
  ...eventContext,
  ...eventProperties,
  style: CollectionStyle.pipe(
    $I.annoteKey("YamlVisitorEvent.style", { description: "Block or flow presentation of the collection." })
  ),
};
const visitorEvent = S.TaggedUnion({
  DocumentStart: {
    ...eventContext,
    directives: S.Array(
      S.Struct({
        name: S.String.pipe(
          $I.annoteKey("VisitorDirective.name", { description: "Directive name without its percent indicator." })
        ),
        parameters: S.Array(S.String).pipe(
          $I.annoteKey("VisitorDirective.parameters", { description: "Ordered directive parameters." })
        ),
      }).pipe($I.annoteSchema("VisitorDirective", { description: "A directive attached to a visited document." }))
    ).pipe(
      $I.annoteKey("YamlVisitorEvent.DocumentStart.directives", {
        description: "Directives applying to the document in source order.",
      })
    ),
  },
  DocumentEnd: eventContext,
  MapStart: collectionContext,
  MapEnd: eventContext,
  SeqStart: collectionContext,
  SeqEnd: eventContext,
  Pair: {
    ...eventContext,
    key: S.Unknown.pipe(
      $I.annoteKey("YamlVisitorEvent.Pair.key", { description: "Resolved scalar key, or null for a complex key." })
    ),
    value: S.Unknown.pipe(
      $I.annoteKey("YamlVisitorEvent.Pair.value", {
        description: "Resolved scalar value, or null for a collection or omitted value.",
      })
    ),
  },
  Scalar: {
    ...eventContext,
    ...eventProperties,
    value: S.Unknown.pipe(
      $I.annoteKey("YamlVisitorEvent.Scalar.value", { description: "Resolved YAML scalar value." })
    ),
    style: ScalarStyle.pipe(
      $I.annoteKey("YamlVisitorEvent.Scalar.style", { description: "Scalar presentation style in the source." })
    ),
  },
  Alias: {
    ...eventContext,
    name: S.String.pipe($I.annoteKey("YamlVisitorEvent.Alias.name", { description: "Referenced anchor name." })),
  },
  Comment: {
    ...eventContext,
    text: S.String.pipe(
      $I.annoteKey("YamlVisitorEvent.Comment.text", { description: "Comment text attached to the visited construct." })
    ),
    placement: S.Literals(["leading", "trailing"]).pipe(
      $I.annoteKey("YamlVisitorEvent.Comment.placement", {
        description: "Own-line comment before the construct or same-line comment after it.",
      })
    ),
  },
  Directive: {
    ...eventContext,
    name: S.String.pipe(
      $I.annoteKey("YamlVisitorEvent.Directive.name", { description: "Directive name without its percent indicator." })
    ),
    parameters: S.String.pipe(
      $I.annoteKey("YamlVisitorEvent.Directive.parameters", { description: "Directive parameters joined with spaces." })
    ),
  },
  Error: {
    ...eventContext,
    diagnostic: YamlDiagnostic,
  },
}).pipe(
  $I.annoteSchema("YamlVisitorEvent", {
    description: "Concrete YAML AST visitor events with shared path and nesting context.",
  })
);

/**
 * The discriminated union of YAML AST visitor events. Every variant carries
 * `path` (segments from the document root) and `depth` (zero-based nesting
 * level); collection/scalar begin events also carry `style` and the optional
 * `tag`/`anchor`. `Error` carries a materialized {@link YamlDiagnostic} for
 * every diagnostic recorded while composing the document — fatal or not.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlVisitorEvent = typeof visitorEvent.Type;

/**
 * Constructors and matchers for the `YamlVisitorEvent` union (e.g.
 * `YamlVisitorEvent.Scalar({ path, depth, value, style })`,
 * `YamlVisitorEvent.$is("MapStart")`).
 *
 * **Example** (Construct and identify a scalar event)
 *
 * ```ts
 * import { YamlVisitorEvent } from "@beep/yaml/YamlVisitor";
 *
 * const event = YamlVisitorEvent.Scalar({ path: [], depth: 0, value: "hello", style: "plain" });
 * console.log(YamlVisitorEvent.$is("Scalar")(event)) // true
 * ```
 *
 * @public
 * @category constructors
 * @since 0.0.0
 */
export const YamlVisitorEvent = Data.taggedEnum<YamlVisitorEvent>();

/**
 * Walks YAML text as a lazy `Stream` of typed events — documents, collections,
 * pairs, scalars, aliases, comments, directives and recovered errors — in
 * document order. Not instantiable.
 *
 * **Example** (Collect YAML mapping keys and scalar values)
 *
 * ```ts
 * import { YamlVisitor, YamlVisitorEvent } from "@beep/yaml/YamlVisitor";
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 *
 * // Mapping keys are scalar events too, so keys and values interleave.
 * const scalars = YamlVisitor.visit("a: 1\nb:\n  - x\n").pipe(
 *   Stream.filter(YamlVisitorEvent.$is("Scalar")),
 *   Stream.map((event) => event.value),
 *   Stream.runCollect,
 * );
 * console.log(JSON.stringify(await Effect.runPromise(scalars))) // ["a",1,"b","x"]
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
 */
export class YamlVisitor {
  private constructor() {}

  /**
   * Create a lazy `Stream` of `YamlVisitorEvent` from YAML text, in document
   * order.
   *
   * **Details**
   *
   * Multi-document streams (separated by `---`) produce a separate
   * `DocumentStart`/`DocumentEnd` pair per document. Events are produced on
   * demand, so combining with `Stream.take` allows efficient partial scans
   * of large documents without materializing the whole event sequence.
   *
   * Infallible at the type level: diagnostics recorded while composing
   * (fatal or not, including an exceeded `maxAliasCount`, recorded as
   * `AliasCountExceeded`) surface as `Error` events inside the stream rather
   * than failing it.
   *
   * **Example** (Visit the first document event)
   *
   * ```ts
   * import { YamlVisitor } from "@beep/yaml/YamlVisitor";
   * import * as A from "effect/Array";
   * import * as Effect from "effect/Effect";
   * import * as Stream from "effect/Stream";
   *
   * const events = await Effect.runPromise(
   *   YamlVisitor.visit("a: 1\n").pipe(Stream.take(1), Stream.runCollect),
   * );
   * console.log(JSON.stringify(A.map(events, (event) => event._tag))) // ["DocumentStart"]
   * ```
   *
   * @param text - The YAML source to visit.
   * @param options - Optional {@link YamlParseOptions} controlling composition.
   * @returns A lazy `Stream` of `YamlVisitorEvent`, infallible at the type
   *   level.
   * @category streams
   * @since 0.0.0
   */
  static readonly visit: {
    (options?: YamlParseOptions): (text: string) => Stream.Stream<YamlVisitorEvent>;
    (text: string, options?: YamlParseOptions): Stream.Stream<YamlVisitorEvent>;
  } = dual(
    (args) => P.isString(args[0]),
    (text: string, options?: YamlParseOptions): Stream.Stream<YamlVisitorEvent> =>
      Stream.suspend(() => Stream.fromIterable(visitGen(text, options)))
  );
}

function* visitGen(text: string, options?: YamlParseOptions): Generator<YamlVisitorEvent> {
  const index = YamlDiagnostic.positionIndex(text);
  const { documents, streamErrors } = composeAllDocuments(
    text,
    ParseOptionsInput.make({
      ...O.getSomesStruct({ strict: O.fromUndefinedOr(options?.strict) }),
      ...O.getSomesStruct({ maxAliasCount: O.fromUndefinedOr(options?.maxAliasCount) }),
      ...O.getSomesStruct({ uniqueKeys: O.fromUndefinedOr(options?.uniqueKeys) }),
    })
  );

  for (const diagnostic of YamlDiagnostic.fromRawBatch(streamErrors, text, index)) {
    yield YamlVisitorEvent.Error({ path: [], depth: 0, diagnostic });
  }

  for (const doc of documents) {
    yield* walkDocument(doc, text, index);
  }
}

function* walkDocument(
  doc: RawYamlDocument,
  text: string,
  index: ReturnType<typeof YamlDiagnostic.positionIndex>
): Generator<YamlVisitorEvent> {
  const path: YamlPath = [];
  const depth = 0;

  for (const dir of doc.directives) {
    yield YamlVisitorEvent.Directive({ path, depth, name: dir.name, parameters: A.join(dir.parameters, " ") });
  }

  yield YamlVisitorEvent.DocumentStart({
    path,
    depth,
    directives: A.map(doc.directives, (d) => ({ name: d.name, parameters: d.parameters })),
  });

  for (const diagnostic of YamlDiagnostic.fromRawBatch(doc.errors, text, index)) {
    yield YamlVisitorEvent.Error({ path, depth, diagnostic });
  }
  for (const diagnostic of YamlDiagnostic.fromRawBatch(doc.warnings, text, index)) {
    yield YamlVisitorEvent.Error({ path, depth, diagnostic });
  }

  if (doc.commentBefore !== undefined) {
    yield YamlVisitorEvent.Comment({ path, depth, text: doc.commentBefore, placement: "leading" });
  }

  if (doc.contents !== null) {
    yield* walkNode(doc.contents, path, depth);
  }

  if (doc.comment !== undefined) {
    yield YamlVisitorEvent.Comment({ path, depth, text: doc.comment, placement: "trailing" });
  }

  yield YamlVisitorEvent.DocumentEnd({ path, depth });
}

const nodeProperties = (node: YamlScalar | YamlMap | YamlSeq) =>
  O.getSomesStruct({ tag: O.fromUndefinedOr(node.tag), anchor: O.fromUndefinedOr(node.anchor) });

function* walkNode(node: YamlNode, path: YamlPath, depth: number): Generator<YamlVisitorEvent> {
  yield* walkCommentsBeforeNodeEvent(node, path, depth);
  if (isScalar(node)) {
    yield YamlVisitorEvent.Scalar({
      path,
      depth,
      value: node.value,
      style: node.style,
      ...nodeProperties(node),
    });
  } else if (isAlias(node)) {
    yield YamlVisitorEvent.Alias({ path, depth, name: node.name });
  } else if (isMap(node)) {
    yield* walkMapNode(node, path, depth);
  } else {
    yield* walkSeqNode(node, path, depth);
  }
}

function* walkCommentsBeforeNodeEvent(node: YamlNode, path: YamlPath, depth: number): Generator<YamlVisitorEvent> {
  if (node.commentBefore !== undefined) {
    yield YamlVisitorEvent.Comment({ path, depth, text: node.commentBefore, placement: "leading" });
  }
  if (node.comment !== undefined) {
    yield YamlVisitorEvent.Comment({ path, depth, text: node.comment, placement: "trailing" });
  }
}

function* walkMapNode(node: YamlMap, path: YamlPath, depth: number): Generator<YamlVisitorEvent> {
  yield YamlVisitorEvent.MapStart({
    path,
    depth,
    style: node.style,
    ...nodeProperties(node),
  });
  for (const pair of node.items) {
    yield* walkPair(pair, path, depth + 1);
  }
  yield YamlVisitorEvent.MapEnd({ path, depth });
}

function* walkSeqNode(node: YamlSeq, path: YamlPath, depth: number): Generator<YamlVisitorEvent> {
  yield YamlVisitorEvent.SeqStart({
    path,
    depth,
    style: node.style,
    ...nodeProperties(node),
  });
  for (const [i, item] of node.items.entries()) {
    yield* walkNode(item, [...path, i], depth + 1);
  }
  yield YamlVisitorEvent.SeqEnd({ path, depth });
}

function* walkPair(pair: YamlPair, parentPath: YamlPath, depth: number): Generator<YamlVisitorEvent> {
  const resolvedKey = isScalar(pair.key) ? pair.key.value : null;
  const resolvedValue = isScalar(pair.value) ? pair.value.value : null;

  const keySegment: string | number = P.isString(resolvedKey)
    ? resolvedKey
    : isFiniteNumber(resolvedKey)
      ? resolvedKey
      : String(resolvedKey);

  const pairPath: YamlPath = [...parentPath, keySegment];

  yield YamlVisitorEvent.Pair({ path: pairPath, depth, key: resolvedKey, value: resolvedValue });

  yield* walkNode(pair.key, pairPath, depth + 1);

  if (pair.value !== null) {
    yield* walkNode(pair.value, pairPath, depth + 1);
  }
}
