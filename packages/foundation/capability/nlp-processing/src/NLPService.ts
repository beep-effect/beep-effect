/**
 * NLPService - high-level facade over a pluggable {@link Backend.NLPBackend}.
 *
 * The main entry point for NLP in the categorical text-processing framework:
 * abstracts the backend behind a clean API ({@link NLPServiceShape.processText}
 * builds an annotated text graph; the other methods surface entities, relations,
 * and POS tags). The service depends on an {@link Backend.NLPBackend} provided via
 * a layer (e.g. `WinkBackendLive`).
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * `Context.GenericTag` becomes the `Context.Service` class form; `getBackend`
 * becomes a bare `Effect` (no zero-arg thunk).
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { Context, Effect, Layer } from "effect";
import * as Backend from "./Backend/NLPBackend.ts";
import * as ATG from "./Graph/AnnotatedTextGraph.ts";
import type { EntityNode, POSNode, RelationNode } from "@beep/nlp/Graph/Schema";
import type { NLPBackendError, NLPBackendShape } from "./Backend/NLPBackend.ts";
import type { AnnotatedTextGraph } from "./Graph/AnnotatedTextGraph.ts";

const $I = $NlpProcessingId.create("NLPService");

/**
 * High-level service facade over an {@link Backend.NLPBackend} implementation.
 *
 * **Details**
 *
 * The facade keeps user-facing NLP calls stable while individual backends own
 * tokenization, POS tagging, entity extraction, relation extraction, and graph
 * construction details.
 *
 * **Example** (Partial extractEntities stub)
 *
 * ```ts
 * import { Effect } from "effect"
 * import type { NLPServiceShape } from "@beep/nlp-processing/NLPService"
 *
 * const service: Pick<NLPServiceShape, "extractEntities"> = {
 *   extractEntities: () => Effect.succeed([])
 * }
 * Effect.runPromise(service.extractEntities("Effect")).then((entities) => console.log(entities.length)) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface NLPServiceShape {
  /** Extract named entities from text. */
  readonly extractEntities: (text: string) => Effect.Effect<ReadonlyArray<EntityNode>, NLPBackendError>;
  /** Extract semantic relations from text. */
  readonly extractRelations: (text: string) => Effect.Effect<ReadonlyArray<RelationNode>, NLPBackendError>;
  /** The underlying backend. */
  readonly getBackend: Effect.Effect<NLPBackendShape>;
  /** Process text into an annotated text graph. */
  readonly processText: (text: string) => Effect.Effect<AnnotatedTextGraph, NLPBackendError>;
  /** Tag parts of speech. */
  readonly tagPartsOfSpeech: (text: string) => Effect.Effect<ReadonlyArray<POSNode>, NLPBackendError>;
}

/**
 * Service tag for the {@link NLPServiceShape} facade.
 *
 * **Example** (Log service key)
 *
 * ```ts
 * import { NLPService } from "@beep/nlp-processing/NLPService"
 *
 * console.log(NLPService.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class NLPService extends Context.Service<NLPService, NLPServiceShape>()($I`NLPService`) {}

/**
 * Build an {@link NLPServiceShape} facade around a concrete backend.
 *
 * **Details**
 *
 * The returned service delegates backend-native operations directly and builds
 * annotated text graphs by providing the backend to the graph construction
 * pipeline.
 *
 * **Example** (Facade around minimal backend)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { make } from "@beep/nlp-processing/NLPService"
 * import type { NLPBackendShape } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const backend: NLPBackendShape = {
 *   name: "minimal",
 *   capabilities: {
 *     constituencyParsing: false,
 *     coreferenceResolution: false,
 *     dependencyParsing: false,
 *     lemmatization: false,
 *     ner: false,
 *     posTagging: true,
 *     relationExtraction: false,
 *     sentencization: true,
 *     tokenization: true
 *   },
 *   tokenize: (text) => Effect.succeed(text.split(" ")),
 *   sentencize: (text) => Effect.succeed([text]),
 *   posTag: () => Effect.succeed([]),
 *   lemmatize: () => Effect.succeed([]),
 *   extractEntities: () => Effect.succeed([]),
 *   parseDependencies: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([])
 * }
 * Effect.runPromise(make(backend).getBackend).then((providedBackend) => console.log(providedBackend.name)) // "minimal"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make = (backend: NLPBackendShape): NLPServiceShape =>
  NLPService.of({
    extractEntities: Effect.fn("NLPService.extractEntities")(function* (text: string) {
      return yield* backend.extractEntities(text);
    }),
    extractRelations: Effect.fn("NLPService.extractRelations")(function* (text: string) {
      return yield* backend.extractRelations(text);
    }),
    getBackend: Effect.succeed(backend),
    processText: Effect.fn("NLPService.processText")(function* (text: string) {
      return yield* Effect.provideService(ATG.fromDocumentAnnotated(text), Backend.NLPBackend, backend);
    }),
    tagPartsOfSpeech: Effect.fn("NLPService.tagPartsOfSpeech")(function* (text: string) {
      return yield* backend.posTag(text);
    }),
  });

/**
 * Lift a backend layer into the high-level {@link NLPService} layer.
 *
 * **Example** (Provide backend via layer)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { NLPService, layer } from "@beep/nlp-processing/NLPService"
 * import { NLPBackend, notSupported } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const backendLayer = Layer.succeed(NLPBackend, NLPBackend.of({
 *   name: "empty",
 *   capabilities: {
 *     constituencyParsing: false,
 *     coreferenceResolution: false,
 *     dependencyParsing: false,
 *     lemmatization: false,
 *     ner: false,
 *     posTagging: false,
 *     relationExtraction: false,
 *     sentencization: false,
 *     tokenization: false
 *   },
 *   tokenize: () => Effect.fail(notSupported("empty", "tokenize")),
 *   sentencize: () => Effect.fail(notSupported("empty", "sentencize")),
 *   posTag: () => Effect.fail(notSupported("empty", "posTag")),
 *   lemmatize: () => Effect.fail(notSupported("empty", "lemmatize")),
 *   extractEntities: () => Effect.fail(notSupported("empty", "extractEntities")),
 *   parseDependencies: () => Effect.fail(notSupported("empty", "parseDependencies")),
 *   extractRelations: () => Effect.fail(notSupported("empty", "extractRelations"))
 * }))
 * const program = Effect.flatMap(NLPService, (service) => service.getBackend)
 * Effect.runPromise(Effect.provide(program, layer(backendLayer))).then((backend) => console.log(backend.name)) // "empty"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = <E, R>(backendLayer: Layer.Layer<Backend.NLPBackend, E, R>): Layer.Layer<NLPService, E, R> =>
  Layer.provide(Layer.effect(NLPService, Effect.map(Backend.NLPBackend, make)), backendLayer);

/**
 * Process text into an annotated graph using {@link NLPService} from context.
 *
 * **Example** (Process text with stub service)
 *
 * ```ts import.meta.vitest name="Process text with stub service"
 * import { Effect } from "effect"
 * import { empty, nodeCount } from "@beep/nlp-processing/Graph/AnnotatedTextGraph"
 * import { NLPService, processText } from "@beep/nlp-processing/NLPService"
 * import type { NLPBackendShape } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const backend: NLPBackendShape = {
 *   name: "minimal",
 *   capabilities: {
 *     constituencyParsing: false,
 *     coreferenceResolution: false,
 *     dependencyParsing: false,
 *     lemmatization: false,
 *     ner: false,
 *     posTagging: false,
 *     relationExtraction: false,
 *     sentencization: false,
 *     tokenization: false
 *   },
 *   tokenize: () => Effect.succeed([]),
 *   sentencize: () => Effect.succeed([]),
 *   posTag: () => Effect.succeed([]),
 *   lemmatize: () => Effect.succeed([]),
 *   extractEntities: () => Effect.succeed([]),
 *   parseDependencies: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([])
 * }
 * const service = NLPService.of({
 *   getBackend: Effect.succeed(backend),
 *   processText: () => Effect.succeed(empty()),
 *   extractEntities: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([]),
 *   tagPartsOfSpeech: () => Effect.succeed([])
 * })
 * const program = Effect.map(
 *   Effect.provideService(processText("Effect models typed failure."), NLPService, service),
 *   nodeCount
 * )
 * await Effect.runPromise(program) // => 0
 * ```
 *
 * @effects Requires an {@link NLPService} in context and executes the
 * service's graph-construction effect.
 * @category accessors
 * @since 0.0.0
 */
export const processText = (text: string): Effect.Effect<AnnotatedTextGraph, NLPBackendError, NLPService> =>
  Effect.flatMap(NLPService, (service) => service.processText(text));

/**
 * Extract entity nodes using {@link NLPService} from context.
 *
 * **Example** (Extract entities from context)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { empty } from "@beep/nlp-processing/Graph/AnnotatedTextGraph"
 * import { NLPService, extractEntities } from "@beep/nlp-processing/NLPService"
 * import type { NLPBackendShape } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const backend: NLPBackendShape = {
 *   name: "minimal",
 *   capabilities: {
 *     constituencyParsing: false,
 *     coreferenceResolution: false,
 *     dependencyParsing: false,
 *     lemmatization: false,
 *     ner: false,
 *     posTagging: false,
 *     relationExtraction: false,
 *     sentencization: false,
 *     tokenization: false
 *   },
 *   tokenize: () => Effect.succeed([]),
 *   sentencize: () => Effect.succeed([]),
 *   posTag: () => Effect.succeed([]),
 *   lemmatize: () => Effect.succeed([]),
 *   extractEntities: () => Effect.succeed([]),
 *   parseDependencies: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([])
 * }
 * const service = NLPService.of({
 *   getBackend: Effect.succeed(backend),
 *   processText: () => Effect.succeed(empty()),
 *   extractEntities: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([]),
 *   tagPartsOfSpeech: () => Effect.succeed([])
 * })
 * const program = Effect.provideService(extractEntities("Acme hired Ada."), NLPService, service)
 * Effect.runPromise(program).then((entities) => console.log(entities.length)) // 0
 * ```
 *
 * @effects Requires an {@link NLPService} in context and executes the
 * service's entity-extraction effect.
 * @category accessors
 * @since 0.0.0
 */
export const extractEntities = (text: string): Effect.Effect<ReadonlyArray<EntityNode>, NLPBackendError, NLPService> =>
  Effect.flatMap(NLPService, (service) => service.extractEntities(text));

/**
 * Extract relation nodes using {@link NLPService} from context.
 *
 * **Example** (Extract relations from context)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { empty } from "@beep/nlp-processing/Graph/AnnotatedTextGraph"
 * import { NLPService, extractRelations } from "@beep/nlp-processing/NLPService"
 * import type { NLPBackendShape } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const backend: NLPBackendShape = {
 *   name: "minimal",
 *   capabilities: {
 *     constituencyParsing: false,
 *     coreferenceResolution: false,
 *     dependencyParsing: false,
 *     lemmatization: false,
 *     ner: false,
 *     posTagging: false,
 *     relationExtraction: false,
 *     sentencization: false,
 *     tokenization: false
 *   },
 *   tokenize: () => Effect.succeed([]),
 *   sentencize: () => Effect.succeed([]),
 *   posTag: () => Effect.succeed([]),
 *   lemmatize: () => Effect.succeed([]),
 *   extractEntities: () => Effect.succeed([]),
 *   parseDependencies: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([])
 * }
 * const service = NLPService.of({
 *   getBackend: Effect.succeed(backend),
 *   processText: () => Effect.succeed(empty()),
 *   extractEntities: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([]),
 *   tagPartsOfSpeech: () => Effect.succeed([])
 * })
 * const program = Effect.provideService(extractRelations("Ada founded Acme."), NLPService, service)
 * Effect.runPromise(program).then((relations) => console.log(relations.length)) // 0
 * ```
 *
 * @effects Requires an {@link NLPService} in context and executes the
 * service's relation-extraction effect.
 * @category accessors
 * @since 0.0.0
 */
export const extractRelations = (
  text: string
): Effect.Effect<ReadonlyArray<RelationNode>, NLPBackendError, NLPService> =>
  Effect.flatMap(NLPService, (service) => service.extractRelations(text));

/**
 * Tag parts of speech using {@link NLPService} from context.
 *
 * **Example** (Tag POS from context)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { empty } from "@beep/nlp-processing/Graph/AnnotatedTextGraph"
 * import { NLPService, tagPartsOfSpeech } from "@beep/nlp-processing/NLPService"
 * import type { NLPBackendShape } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const backend: NLPBackendShape = {
 *   name: "minimal",
 *   capabilities: {
 *     constituencyParsing: false,
 *     coreferenceResolution: false,
 *     dependencyParsing: false,
 *     lemmatization: false,
 *     ner: false,
 *     posTagging: false,
 *     relationExtraction: false,
 *     sentencization: false,
 *     tokenization: false
 *   },
 *   tokenize: () => Effect.succeed([]),
 *   sentencize: () => Effect.succeed([]),
 *   posTag: () => Effect.succeed([]),
 *   lemmatize: () => Effect.succeed([]),
 *   extractEntities: () => Effect.succeed([]),
 *   parseDependencies: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([])
 * }
 * const service = NLPService.of({
 *   getBackend: Effect.succeed(backend),
 *   processText: () => Effect.succeed(empty()),
 *   extractEntities: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([]),
 *   tagPartsOfSpeech: () => Effect.succeed([])
 * })
 * const program = Effect.provideService(tagPartsOfSpeech("Effect composes."), NLPService, service)
 * Effect.runPromise(program).then((tags) => console.log(tags.length)) // 0
 * ```
 *
 * @effects Requires an {@link NLPService} in context and executes the
 * service's POS-tagging effect.
 * @category accessors
 * @since 0.0.0
 */
export const tagPartsOfSpeech = (text: string): Effect.Effect<ReadonlyArray<POSNode>, NLPBackendError, NLPService> =>
  Effect.flatMap(NLPService, (service) => service.tagPartsOfSpeech(text));
