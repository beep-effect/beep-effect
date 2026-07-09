/**
 * Ontology session server adapter layer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { N3ParseTurtleRequest, N3SerializeTurtleRequest, N3TurtleCodec, N3TurtleCodecLive } from "@beep/n3";
import {
  OntologyFileStore,
  OntologyReasonerLive,
  OntologySparqlRunnerLive,
  ParseTurtleResult,
  SerializeTurtleResult,
  SessionUseCasesLayer,
  TurtleCodec,
  TurtleCodecError,
} from "@beep/ontology-use-cases/aggregates/Session";
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import { Effect, Layer } from "effect";
import { makeFileSystemOntologyFileStore } from "./Session.file-store.js";
import type { N3TurtleCodecError } from "@beep/n3";

const toTurtleCodecError = (error: N3TurtleCodecError): TurtleCodecError =>
  TurtleCodecError.make({
    reason: error.reason,
    message: error.message,
  });

const makeTurtleCodec = Effect.fn("Ontology.TurtleCodec.makeN3")(function* () {
  const n3 = yield* N3TurtleCodec;

  return TurtleCodec.of({
    parse: Effect.fn("Ontology.TurtleCodec.parse")(function* (request) {
      const parsed = yield* n3
        .parse(N3ParseTurtleRequest.make({ source: request.source, baseIri: request.baseIri }))
        .pipe(Effect.mapError(toTurtleCodecError));

      return ParseTurtleResult.make({
        dataset: parsed.dataset,
        prefixes: parsed.prefixes,
      });
    }),
    serialize: Effect.fn("Ontology.TurtleCodec.serialize")(function* (request) {
      const serialized = yield* n3
        .serialize(N3SerializeTurtleRequest.make({ dataset: request.dataset, prefixes: request.prefixes }))
        .pipe(Effect.mapError(toTurtleCodecError));

      return SerializeTurtleResult.make({
        source: serialized.source,
      });
    }),
  });
});

/**
 * N3-backed Turtle codec port layer.
 *
 * @example
 * ```ts
 * import { TurtleCodecLayer } from "@beep/ontology-server/aggregates/Session"
 *
 * console.log(TurtleCodecLayer)
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const TurtleCodecLayer = Layer.effect(TurtleCodec, makeTurtleCodec()).pipe(Layer.provide(N3TurtleCodecLive));

/**
 * FileSystem-backed ontology file-store port layer.
 *
 * @example
 * ```ts
 * import { OntologyFileStoreLayer } from "@beep/ontology-server/aggregates/Session"
 *
 * console.log(OntologyFileStoreLayer)
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const OntologyFileStoreLayer = Layer.effect(OntologyFileStore, makeFileSystemOntologyFileStore());

/**
 * Domain-native ontology reasoner port layer.
 *
 * @example
 * ```ts
 * import { OntologyReasonerLayer } from "@beep/ontology-server/aggregates/Session"
 *
 * console.log(OntologyReasonerLayer)
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const OntologyReasonerLayer = OntologyReasonerLive;

/**
 * Oxigraph-backed SPARQL runner port layer.
 *
 * @example
 * ```ts
 * import { OntologySparqlRunnerLayer } from "@beep/ontology-server/aggregates/Session"
 *
 * console.log(OntologySparqlRunnerLayer)
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const OntologySparqlRunnerLayer = OntologySparqlRunnerLive.pipe(Layer.provide(OxigraphSparqlQueryServiceLive));

/**
 * Live session server layer for the P1 ontology foundation.
 *
 * @example
 * ```ts
 * import { SessionServerLayer } from "@beep/ontology-server/aggregates/Session"
 *
 * console.log(SessionServerLayer)
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const SessionServerLayer = SessionUseCasesLayer.pipe(
  Layer.provideMerge(TurtleCodecLayer),
  Layer.provideMerge(OntologyFileStoreLayer),
  Layer.merge(OntologyReasonerLayer),
  Layer.merge(OntologySparqlRunnerLayer)
);
