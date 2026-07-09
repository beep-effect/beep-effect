/**
 * N3-backed Turtle codec service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { make as makeIdentity } from "@beep/identity";
import * as Rdf from "@beep/rdf/Rdf";
import { SchemaUtils } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { Context, Effect, Layer, Match, pipe } from "effect";
import * as S from "effect/Schema";
import { DataFactory, Parser, Writer } from "n3";
import { N3TurtleCodecError } from "./N3.errors.js";
import type * as N3 from "n3";

const { $N3Id } = makeIdentity("n3");
const $I = $N3Id.create("N3.service");

const emptyPrefixMap = (): Rdf.PrefixMap => ({});

const PrefixMapWithEmptyDefault = Rdf.PrefixMap.pipe(
  S.withConstructorDefault(Effect.succeed(emptyPrefixMap())),
  S.withDecodingDefaultKey(Effect.succeed(emptyPrefixMap()))
);

/**
 * N3 Turtle parse request.
 *
 * @example
 * ```ts
 * import { N3ParseTurtleRequest } from "@beep/n3"
 *
 * const request = N3ParseTurtleRequest.make({
 *   source: "@prefix ex: <https://example.test/> ."
 * })
 *
 * console.log(request.source)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class N3ParseTurtleRequest extends S.Class<N3ParseTurtleRequest>($I`N3ParseTurtleRequest`)(
  {
    source: S.String,
    baseIri: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("N3ParseTurtleRequest", {
    description: "N3 Turtle parse request.",
  })
) {}

/**
 * N3 Turtle parse result.
 *
 * @example
 * ```ts
 * import { N3ParseTurtleResult } from "@beep/n3"
 * import { makeDataset } from "@beep/rdf/Rdf"
 *
 * const result = N3ParseTurtleResult.make({
 *   dataset: makeDataset([])
 * })
 *
 * console.log(result.dataset.quads.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class N3ParseTurtleResult extends S.Class<N3ParseTurtleResult>($I`N3ParseTurtleResult`)(
  {
    dataset: Rdf.Dataset,
    prefixes: PrefixMapWithEmptyDefault,
  },
  $I.annote("N3ParseTurtleResult", {
    description: "N3 Turtle parse result.",
  })
) {}

/**
 * N3 Turtle serialize request.
 *
 * @example
 * ```ts
 * import { N3SerializeTurtleRequest } from "@beep/n3"
 * import { makeDataset } from "@beep/rdf/Rdf"
 *
 * const request = N3SerializeTurtleRequest.make({
 *   dataset: makeDataset([])
 * })
 *
 * console.log(request.dataset.quads.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class N3SerializeTurtleRequest extends S.Class<N3SerializeTurtleRequest>($I`N3SerializeTurtleRequest`)(
  {
    dataset: Rdf.Dataset,
    prefixes: PrefixMapWithEmptyDefault,
  },
  $I.annote("N3SerializeTurtleRequest", {
    description: "N3 Turtle serialize request.",
  })
) {}

/**
 * N3 Turtle serialize result.
 *
 * @example
 * ```ts
 * import { N3SerializeTurtleResult } from "@beep/n3"
 *
 * const result = N3SerializeTurtleResult.make({
 *   source: "@prefix ex: <https://example.test/> ."
 * })
 *
 * console.log(result.source)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class N3SerializeTurtleResult extends S.Class<N3SerializeTurtleResult>($I`N3SerializeTurtleResult`)(
  {
    source: S.String,
  },
  $I.annote("N3SerializeTurtleResult", {
    description: "N3 Turtle serialize result.",
  })
) {}

/**
 * N3 Turtle codec service shape.
 *
 * @since 0.0.0
 * @category services
 */
interface N3TurtleCodecShape {
  readonly parse: (request: N3ParseTurtleRequest) => Effect.Effect<N3ParseTurtleResult, N3TurtleCodecError>;
  readonly serialize: (request: N3SerializeTurtleRequest) => Effect.Effect<N3SerializeTurtleResult, N3TurtleCodecError>;
}

const unsupportedTerm = (position: string, termType: string): N3TurtleCodecError =>
  N3TurtleCodecError.make({
    reason: "parseFailed",
    message: `Unsupported ${position} term type in Turtle input: ${termType}.`,
  });

const parseFailure = (cause: unknown): N3TurtleCodecError =>
  N3TurtleCodecError.make({
    reason: "parseFailed",
    message: cause instanceof Error ? cause.message : "N3 failed to parse Turtle input.",
  });

const serializeFailure = (cause: unknown): N3TurtleCodecError =>
  N3TurtleCodecError.make({
    reason: "serializeFailed",
    message: cause instanceof Error ? cause.message : "N3 failed to serialize Turtle output.",
  });

const unsupportedGraph = (graph: Rdf.GraphTerm): N3TurtleCodecError =>
  N3TurtleCodecError.make({
    reason: "unsupportedGraph",
    message: `Turtle serialization only supports default graph quads; found ${Rdf.serializeTerm(graph)}.`,
  });

const fromN3Subject = (subject: N3.Quad_Subject): Effect.Effect<Rdf.Subject, N3TurtleCodecError> =>
  Match.value(subject).pipe(
    Match.withReturnType<Effect.Effect<Rdf.Subject, N3TurtleCodecError>>(),
    Match.discriminatorsExhaustive("termType")({
      NamedNode: (value) => Effect.succeed(Rdf.makeNamedNode(value.value)),
      BlankNode: (value) => Effect.succeed(Rdf.makeBlankNode(value.value)),
      Variable: (value) => Effect.fail(unsupportedTerm("subject", value.termType)),
    })
  );

const fromN3Predicate = (predicate: N3.Quad_Predicate): Effect.Effect<Rdf.NamedNode, N3TurtleCodecError> =>
  Match.value(predicate).pipe(
    Match.withReturnType<Effect.Effect<Rdf.NamedNode, N3TurtleCodecError>>(),
    Match.discriminatorsExhaustive("termType")({
      NamedNode: (value) => Effect.succeed(Rdf.makeNamedNode(value.value)),
      Variable: (value) => Effect.fail(unsupportedTerm("predicate", value.termType)),
    })
  );

const fromN3Object = (object: N3.Quad_Object): Effect.Effect<Rdf.ObjectTerm, N3TurtleCodecError> =>
  Match.value(object).pipe(
    Match.withReturnType<Effect.Effect<Rdf.ObjectTerm, N3TurtleCodecError>>(),
    Match.discriminatorsExhaustive("termType")({
      NamedNode: (value) => Effect.succeed(Rdf.makeNamedNode(value.value)),
      BlankNode: (value) => Effect.succeed(Rdf.makeBlankNode(value.value)),
      Literal: (value) =>
        Effect.succeed(
          Rdf.makeLiteral(value.value, value.datatype.value, {
            ...O.getSomesStruct({
              language: pipe(value.language, O.liftPredicate(Str.isNonEmpty)),
            }),
          })
        ),
      Variable: (value) => Effect.fail(unsupportedTerm("object", value.termType)),
    })
  );

const fromN3Graph = (graph: N3.Quad_Graph): Effect.Effect<Rdf.GraphTerm, N3TurtleCodecError> =>
  Match.value(graph).pipe(
    Match.withReturnType<Effect.Effect<Rdf.GraphTerm, N3TurtleCodecError>>(),
    Match.discriminatorsExhaustive("termType")({
      NamedNode: (value) => Effect.succeed(Rdf.makeNamedNode(value.value)),
      BlankNode: (value) => Effect.succeed(Rdf.makeBlankNode(value.value)),
      DefaultGraph: () => Effect.succeed(Rdf.DefaultGraph.make({ termType: "DefaultGraph", value: "" })),
      Variable: (value) => Effect.fail(unsupportedTerm("graph", value.termType)),
    })
  );

const fromN3Quad = Effect.fn("N3.fromN3Quad")(function* (quad: N3.Quad) {
  const subject = yield* fromN3Subject(quad.subject);
  const predicate = yield* fromN3Predicate(quad.predicate);
  const object = yield* fromN3Object(quad.object);
  const graph = yield* fromN3Graph(quad.graph);

  return Rdf.makeQuad(subject, predicate, {
    object,
    graph,
  });
});

const toN3Subject = (subject: Rdf.Subject): N3.Quad_Subject =>
  Rdf.Subject.match(subject, {
    NamedNode: (value) => DataFactory.namedNode(value.value),
    BlankNode: (value) => DataFactory.blankNode(value.value),
  });

const toN3Object = (object: Rdf.ObjectTerm): N3.Quad_Object =>
  Rdf.ObjectTerm.match(object, {
    NamedNode: (value) => DataFactory.namedNode(value.value),
    BlankNode: (value) => DataFactory.blankNode(value.value),
    Literal: (value) =>
      O.match(value.language, {
        onNone: () => DataFactory.literal(value.value, DataFactory.namedNode(value.datatype.value)),
        onSome: (language) => DataFactory.literal(value.value, language),
      }),
  });

const toN3Graph = (graph: Rdf.GraphTerm): Effect.Effect<N3.Quad_Graph, N3TurtleCodecError> =>
  Rdf.GraphTerm.match(graph, {
    DefaultGraph: () => Effect.succeed(DataFactory.defaultGraph()),
    NamedNode: () => Effect.fail(unsupportedGraph(graph)),
    BlankNode: () => Effect.fail(unsupportedGraph(graph)),
  });

const toN3Quad = Effect.fn("N3.toN3Quad")(function* (quad: Rdf.Quad) {
  const graph = yield* toN3Graph(quad.graph);
  return DataFactory.quad(
    toN3Subject(quad.subject),
    DataFactory.namedNode(quad.predicate.value),
    toN3Object(quad.object),
    graph
  );
});

const parseTurtle = Effect.fn("N3.parseTurtle")(function* (request: N3ParseTurtleRequest) {
  const prefixes: Record<string, string> = {};
  const quads = yield* Effect.try({
    try: () => {
      const parser = new Parser({
        format: "Turtle",
        ...O.getSomesStruct({
          baseIRI: request.baseIri,
        }),
      });
      return parser.parse(request.source, null, (prefix, prefixNode) => {
        if (Rdf.PrefixLabel.is(prefix)) {
          prefixes[prefix] = prefixNode.value;
        }
      });
    },
    catch: parseFailure,
  });
  const decoded = yield* Effect.forEach(quads, fromN3Quad);
  const decodedPrefixes = yield* S.decodeUnknownEffect(Rdf.PrefixMap)(prefixes).pipe(Effect.mapError(parseFailure));

  return N3ParseTurtleResult.make({
    dataset: Rdf.makeDataset(decoded),
    prefixes: decodedPrefixes,
  });
});

const serializeTurtle = Effect.fn("N3.serializeTurtle")(function* (request: N3SerializeTurtleRequest) {
  const quads = yield* Effect.forEach(request.dataset.quads, toN3Quad);
  const source = yield* Effect.try({
    try: () => {
      let source = "";
      const writer = new Writer({ format: "Turtle", prefixes: request.prefixes });
      writer.addQuads(A.fromIterable(quads));
      writer.end((_error, output) => {
        source = output ?? "";
      });
      return source;
    },
    catch: serializeFailure,
  });

  return N3SerializeTurtleResult.make({
    source,
  });
});

/**
 * N3 Turtle codec service tag.
 *
 * @example
 * ```ts
 * import { N3TurtleCodec } from "@beep/n3"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const codec = yield* N3TurtleCodec
 *   return codec
 * })
 *
 * console.log(program)
 * ```
 *
 * @since 0.0.0
 * @category services
 */
export class N3TurtleCodec extends Context.Service<N3TurtleCodec, N3TurtleCodecShape>()($I`N3TurtleCodec`) {}

/**
 * Live N3 Turtle codec layer.
 *
 * @example
 * ```ts
 * import { N3TurtleCodecLive } from "@beep/n3"
 *
 * console.log(N3TurtleCodecLive)
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const N3TurtleCodecLive = Layer.succeed(
  N3TurtleCodec,
  N3TurtleCodec.of({
    parse: parseTurtle,
    serialize: serializeTurtle,
  } satisfies N3TurtleCodecShape)
);
