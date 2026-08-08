/**
 * Ontology session server adapter layer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { N3ParseTurtleRequest, N3SerializeTurtleRequest, N3TurtleCodec, N3TurtleCodecLive } from "@beep/n3";
import { OntologyConfigLive } from "@beep/ontology-config/layer";
import {
  OntologyFileStore,
  OntologyReasonerLive,
  OntologySparqlRunnerLive,
  OntologyValidationRunnerLive,
  ParseTurtleResult,
  SerializeTurtleResult,
  SessionUseCasesLayer,
  TurtleCodec,
  TurtleCodecError,
} from "@beep/ontology-use-cases/aggregates/Session";
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import { ShaclValidationServiceLive } from "@beep/shacl";
import { Effect, Layer } from "effect";
import { makeFileSystemOntologyFileStore } from "./Session.file-store.ts";
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
 * **Example** (Import TurtleCodecLayer)
 *
 * ```ts
 * import { TurtleCodecLayer } from "@beep/ontology-server/aggregates/Session"
 *
 * console.log(TurtleCodecLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const TurtleCodecLayer = Layer.effect(TurtleCodec, makeTurtleCodec()).pipe(Layer.provide(N3TurtleCodecLive));

/**
 * FileSystem-backed ontology file-store port layer.
 *
 * **Example** (Configure file-store layer)
 *
 * ```ts
 * import { OntologyFileStoreLayer } from "@beep/ontology-server/aggregates/Session"
 * import { NodeServices } from "@effect/platform-node"
 * import { ConfigProvider, Effect, Layer } from "effect"
 *
 * const configuredLayer = OntologyFileStoreLayer.pipe(
 *   Layer.provide(
 *     ConfigProvider.layer(
 *       ConfigProvider.fromUnknown({ ONTOLOGY_WORKSPACE_ROOT: "." })
 *     )
 *   ),
 *   Layer.provide(NodeServices.layer)
 * )
 * const program = Effect.scoped(Layer.build(configuredLayer))
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @effects Resolves the typed ontology config from the ambient
 * `ConfigProvider`, acquires filesystem and path services, canonicalizes and
 * validates the authority root, and constructs the file-store service.
 * @category layers
 * @since 0.0.0
 */
export const OntologyFileStoreLayer = Layer.effect(OntologyFileStore, makeFileSystemOntologyFileStore()).pipe(
  Layer.provide(OntologyConfigLive)
);

/**
 * Domain-native ontology reasoner port layer.
 *
 * **Example** (Import OntologyReasonerLayer)
 *
 * ```ts
 * import { OntologyReasonerLayer } from "@beep/ontology-server/aggregates/Session"
 *
 * console.log(OntologyReasonerLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const OntologyReasonerLayer = OntologyReasonerLive;

/**
 * Oxigraph-backed SPARQL runner port layer.
 *
 * **Example** (Import OntologySparqlRunnerLayer)
 *
 * ```ts
 * import { OntologySparqlRunnerLayer } from "@beep/ontology-server/aggregates/Session"
 *
 * console.log(OntologySparqlRunnerLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const OntologySparqlRunnerLayer = OntologySparqlRunnerLive.pipe(Layer.provide(OxigraphSparqlQueryServiceLive));

/**
 * shacl-engine-backed validation runner port layer.
 *
 * **Example** (Import OntologyValidationRunnerLayer)
 *
 * ```ts
 * import { OntologyValidationRunnerLayer } from "@beep/ontology-server/aggregates/Session"
 *
 * console.log(OntologyValidationRunnerLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const OntologyValidationRunnerLayer = OntologyValidationRunnerLive.pipe(
  Layer.provideMerge(TurtleCodecLayer),
  Layer.provideMerge(OntologyFileStoreLayer),
  Layer.provide(ShaclValidationServiceLive)
);

/**
 * Live session server layer for the P1 ontology foundation.
 *
 * **Example** (Import SessionServerLayer)
 *
 * ```ts
 * import { SessionServerLayer } from "@beep/ontology-server/aggregates/Session"
 *
 * console.log(SessionServerLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SessionServerLayer = SessionUseCasesLayer.pipe(
  Layer.provideMerge(TurtleCodecLayer),
  Layer.provideMerge(OntologyFileStoreLayer),
  Layer.merge(OntologyReasonerLayer),
  Layer.merge(OntologySparqlRunnerLayer),
  Layer.merge(OntologyValidationRunnerLayer)
);
