/**
 * Service: RDF Services
 *
 * RDF abstraction layer using N3.js as the backend.
 * Provides backend-agnostic RDF operations for parsing, querying, and serialization.
 *
 * @since 2.0.0
 * @module Service/Rdf
 */

import { $ScratchpadId } from "@beep/identity";
import type { Scope } from "effect";
import { Chunk, Context, Duration, Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as N3 from "n3";
import { ParsingFailed, RdfError, SerializationFailed } from "../Domain/Error/Rdf.ts";
import type { Entity, Relation } from "../Domain/Model/Entity.ts";
import { CLAIMS, CORE, DCTERMS, EXTR, OWL, PROV, RDF, XSD } from "../Domain/Rdf/Constants.ts";
import type { BlankNode as BlankNodeType, IRI, RdfTerm } from "../Domain/Rdf/Types.ts";
import { Literal, Quad } from "../Domain/Rdf/Types.ts";
import { createN3Builders, entityToQuads, relationToQuad } from "../Utils/Rdf.ts";
import { ConfigService, ConfigServiceDefault } from "./Config.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Rdf");

/**
 * N3Store type (from n3 library) - internal use only
 */
type N3Store = N3.Store;

/**
 * RdfStore - Abstract RDF store type
 *
 * Opaque wrapper around N3.Store to hide backend implementation.
 * All N3-specific code stays within RdfService.
 *
 * @since 2.0.0
 */
export interface RdfStore {
  readonly _tag: "RdfStore";
  readonly _store: N3Store;
}

/**
 * QuadPattern - Query pattern for store queries
 *
 * null values act as wildcards (match anything).
 *
 * @since 2.0.0
 */
export interface QuadPattern {
  readonly subject?: IRI | BlankNodeType | null;
  readonly predicate?: IRI | null;
  readonly object?: RdfTerm | null;
  readonly graph?: IRI | null;
}

/**
 * Internal: Convert N3 Term to domain RdfTerm
 */
const n3TermToDomainTerm = (term: N3.Term): RdfTerm => {
  if (term.termType === "NamedNode") {
    return term.value as IRI;
  } else if (term.termType === "BlankNode") {
    return `_:${term.value}` as const as BlankNodeType;
  } else if (term.termType === "Literal") {
    return Literal.make({
      value: term.value,
      language: O.fromNullishOr(term.language || undefined),
      datatype: O.fromNullishOr(P.isTruthy(term.datatype) ? (term.datatype.value as IRI) : undefined),
    });
  } else {
    throw new Error(`Unsupported term type: ${term.termType}`);
  }
};

/**
 * Internal: Convert N3 Quad to domain Quad
 */
const n3QuadToDomainQuad = (n3Quad: N3.Quad): Quad => {
  const subject =
    n3Quad.subject.termType === "NamedNode"
      ? (n3Quad.subject.value as IRI)
      : (`_:${n3Quad.subject.value}` as const as BlankNodeType);

  const predicate = n3Quad.predicate.value as IRI;

  const object = n3TermToDomainTerm(n3Quad.object);

  const graph = n3Quad.graph.termType === "NamedNode" ? (n3Quad.graph.value as IRI) : undefined;

  return Quad.make({
    subject,
    predicate,
    object,
    graph: O.fromNullishOr(graph),
  });
};

/**
 * Internal: Convert domain term to N3 Term for querying
 */
const domainTermToN3Term = (term: IRI | BlankNodeType | RdfTerm | null | undefined): N3.Term | null => {
  if (term === null || term === undefined) {
    return null;
  }
  if (typeof term === "string") {
    if (term.startsWith("_:")) {
      return N3.DataFactory.blankNode(term.slice(2));
    } else {
      return N3.DataFactory.namedNode(term);
    }
  }
  if (S.is(Literal)(term)) {
    return O.isSome(term.datatype)
      ? N3.DataFactory.literal(term.value, N3.DataFactory.namedNode(term.datatype.value))
      : O.isSome(term.language)
        ? N3.DataFactory.literal(term.value, term.language.value)
        : N3.DataFactory.literal(term.value);
  }
  throw new Error(`Cannot convert term to N3 term: ${term}`);
};

/**
 * RdfBuilder service interface
 *
 * Explicitly typed to avoid inference issues with transitive @rdfjs/types dependency.
 *
 * @since 2.0.0
 */
/**
 * Options for adding triples to a store with optional named graph
 *
 * @since 2.0.0
 */
export interface AddTriplesOptions {
  /** Optional named graph URI - triples go to default graph if not specified */
  readonly graphUri?: string;
  /**
   * Target namespace for entity/relation IRIs
   *
   * When provided, overrides config.rdf.baseNamespace for IRI minting.
   * Use this to ensure extracted entities land in the batch's target namespace
   * rather than the deployment's default namespace.
   *
   * Example: "http://sports.org/football/" will produce IRIs like
   * "http://sports.org/football/entity123" instead of config default.
   */
  readonly targetNamespace?: string;
}

/**
 * Extraction metadata for provenance tracking
 *
 * Captures information about the extraction run for audit purposes.
 *
 * @since 2.0.0
 */
export interface ExtractionMetadata {
  /** Graph URI where metadata triples will be added (typically the provenance graph) */
  readonly graphUri: string;
  /** Activity URI representing the extraction run */
  readonly activityUri?: string;
  /** ISO 8601 timestamp when extraction was performed */
  readonly timestamp: string;
  /** Source document URI */
  readonly sourceUri: string;
  /** LLM model used for extraction */
  readonly model: string;
  /** Ontology version identifier (e.g., "football/ontology@abc123") */
  readonly ontologyVersion: string;
}

export interface RdfBuilderShape {
  readonly makeStore: Effect.Effect<RdfStore, never, Scope.Scope>;
  readonly createStore: Effect.Effect<RdfStore, never, never>;
  readonly parseTurtle: (turtle: string) => Effect.Effect<RdfStore, ParsingFailed, never>;
  /**
   * Parse TriG string to RDF store
   *
   * Parses RDF TriG syntax (with named graphs) into an RdfStore.
   *
   * @param trig - TriG RDF string
   * @returns Effect yielding RdfStore or ParsingFailed
   *
   * @since 2.0.0
   */
  readonly parseTriG: (trig: string) => Effect.Effect<RdfStore, ParsingFailed, never>;
  readonly queryStore: (store: RdfStore, pattern: QuadPattern) => Effect.Effect<Chunk.Chunk<Quad>, RdfError, never>;
  readonly createIri: (iri: string) => IRI;
  readonly addEntities: (
    store: RdfStore,
    entities: Iterable<Entity>,
    options?: AddTriplesOptions
  ) => Effect.Effect<void, RdfError, never>;
  readonly addRelations: (
    store: RdfStore,
    relations: Iterable<Relation>,
    options?: AddTriplesOptions
  ) => Effect.Effect<void, RdfError, never>;
  readonly addSameAsLinks: (
    store: RdfStore,
    canonicalMap: Record<string, string>
  ) => Effect.Effect<void, RdfError, never>;
  readonly addExtractionMetadata: (
    store: RdfStore,
    metadata: ExtractionMetadata
  ) => Effect.Effect<void, RdfError, never>;
  /**
   * Add a triple with confidence annotation using RDF-star
   *
   * Creates the original triple and adds a confidence score annotation
   * using RDF-star quoted triple syntax:
   * `<<subject predicate object>> ex:confidence "0.95"^^xsd:double .`
   *
   * @param store - Target RDF store
   * @param triple - Triple components (subject IRI, predicate IRI, object IRI or literal)
   * @param confidence - Confidence score between 0 and 1
   * @param graphUri - Optional named graph URI
   *
   * @since 2.0.0
   */
  readonly addTripleWithConfidence: (
    store: RdfStore,
    triple: { subject: string; predicate: string; object: string | number | boolean },
    confidence: number,
    graphUri?: string
  ) => Effect.Effect<void, RdfError, never>;
  /**
   * Generate core:Mention RDF triples from entity evidence spans
   *
   * @since 2.0.0
   */
  readonly generateMentionTriples: (
    store: RdfStore,
    entityUri: string,
    mention: { text: string; startChar: number; endChar: number; confidence?: number },
    options?: { mentionUri?: string; sourceUri?: string; graphUri?: string }
  ) => Effect.Effect<string, RdfError, never>;
  readonly toTurtle: (store: RdfStore) => Effect.Effect<string, SerializationFailed, never>;
  /**
   * Serialize store to TriG format with named graphs
   *
   * TriG format supports named graphs, outputting quads as:
   * ```trig
   * @prefix ex: <http://example.org/> .
   *
   * ex:graph1 {
   *   ex:s ex:p ex:o .
   * }
   *
   * ex:graph2 {
   *   ex:a ex:b ex:c .
   * }
   * ```
   *
   * @param store - RdfStore to serialize
   * @returns TriG string
   *
   * @since 2.0.0
   */
  readonly toTriG: (store: RdfStore) => Effect.Effect<string, SerializationFailed, never>;
  /**
   * Get all named graphs in the store
   *
   * Returns a list of all graph IRIs that have quads.
   * Does not include the default graph.
   *
   * @param store - RdfStore to query
   * @returns Array of graph IRIs
   *
   * @since 2.0.0
   */
  readonly getGraphs: (store: RdfStore) => Effect.Effect<Array<IRI>, RdfError, never>;
  /**
   * Get all quads from a specific named graph
   *
   * @param store - RdfStore to query
   * @param graphIri - Named graph IRI
   * @returns Chunk of Quad objects from the graph
   *
   * @since 2.0.0
   */
  readonly getQuadsFromGraph: (store: RdfStore, graphIri: IRI) => Effect.Effect<Chunk.Chunk<Quad>, RdfError, never>;
  /**
   * Copy quads between graphs
   *
   * Copies all quads from source graph to target graph.
   * Useful for promoting claims from article graphs to the main KB graph.
   *
   * @param store - RdfStore to operate on
   * @param sourceGraph - Source graph IRI
   * @param targetGraph - Target graph IRI
   * @returns Number of quads copied
   *
   * @since 2.0.0
   */
  readonly copyGraphQuads: (
    store: RdfStore,
    sourceGraph: IRI,
    targetGraph: IRI
  ) => Effect.Effect<number, RdfError, never>;
  /**
   * Delete a named graph and all its quads
   *
   * Removes all quads in the specified graph.
   * Useful for retracting article claims.
   *
   * @param store - RdfStore to operate on
   * @param graphIri - Graph IRI to delete
   * @returns Number of quads deleted
   *
   * @since 2.0.0
   */
  readonly deleteGraph: (store: RdfStore, graphIri: IRI) => Effect.Effect<number, RdfError, never>;
  /**
   * Merge source store into target store (union semantics)
   *
   * Adds all quads from source to target. Duplicate quads are ignored
   * (RDF set semantics). This is the core operation for incremental
   * knowledge base building.
   *
   * @param target - Store to merge into (modified in place)
   * @param source - Store to merge from (unchanged)
   * @returns Number of new quads added
   *
   * @since 2.0.0
   */
  readonly mergeStores: (target: RdfStore, source: RdfStore) => Effect.Effect<number, RdfError, never>;
  /**
   * Clone an RDF store
   *
   * Creates a new store with copies of all quads from the source.
   * Useful when you need to modify a store without affecting the original.
   *
   * @param source - Store to clone
   * @returns New RdfStore with same quads
   *
   * @since 2.0.0
   */
  readonly cloneStore: (source: RdfStore) => Effect.Effect<RdfStore, RdfError, never>;
  readonly validate: (
    store: RdfStore,
    shapesGraph: string
  ) => Effect.Effect<{ conforms: boolean; report: string }, never, never>;
}

/**
 * RdfBuilder - RDF graph construction service
 *
 * Manages N3.Store lifecycle with automatic cleanup.
 * Provides capability-oriented API for RDF operations.
 *
 * **Capabilities**:
 * - `makeStore`: Create scoped N3.Store with cleanup
 * - `addEntities`: Convert Entity domain objects to RDF
 * - `addRelations`: Convert Relation domain objects to RDF
 * - `toTurtle`: Serialize to Turtle with prefixes
 * - `validate`: SHACL validation placeholder
 *
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const store = yield* RdfBuilder.makeStore
 *   yield* RdfBuilder.addEntities(store, entities)
 *   yield* RdfBuilder.addRelations(store, relations)
 *   const turtle = yield* RdfBuilder.toTurtle(store)
 *   return turtle
 * }).pipe(Effect.scoped, Effect.provide(RdfBuilder.Default))
 * ```
 *
 * @since 2.0.0
 * @category Services
 */
export class RdfBuilder extends Context.Service<RdfBuilder>()($I`RdfBuilder`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;

    // Create N3 term builders with IRI validation
    const builders = createN3Builders(N3.DataFactory, true);

    const baseNs = config.rdf.baseNamespace;
    const prefixes = config.rdf.prefixes;

    return {
      /**
       * Create scoped RDF store with automatic cleanup
       *
       * Store is managed within Effect.Scope and cleaned up automatically.
       *
       * @returns Scoped RdfStore instance
       */
      makeStore: Effect.acquireRelease(
        Effect.sync(() => {
          const n3Store = new N3.Store();
          return { _tag: "RdfStore" as const, _store: n3Store } satisfies RdfStore;
        }),
        (store) =>
          Effect.sync(() => {
            // Actually clear the store to release memory
            const quads = store._store.getQuads(null, null, null, null);
            store._store.removeQuads(quads);
          }).pipe(
            Effect.tap(() =>
              Effect.logDebug("RDF store cleared", {
                finalQuadCount: store._store.size,
              })
            )
          )
      ),

      /**
       * Create a new RDF store (non-scoped)
       *
       * For use cases where store lifecycle is managed externally.
       *
       * @returns RdfStore instance
       */
      createStore: Effect.sync(() => {
        const n3Store = new N3.Store();
        return { _tag: "RdfStore" as const, _store: n3Store } satisfies RdfStore;
      }),

      /**
       * Parse Turtle string to RDF store
       *
       * Parses RDF Turtle syntax into an abstract RdfStore.
       * All N3-specific parsing logic is encapsulated here.
       *
       * @param turtle - Turtle RDF string
       * @returns Effect yielding RdfStore or ParsingFailed
       */
      parseTurtle: (turtle: string) =>
        Effect.try({
          try: () => {
            const parser = new N3.Parser();
            const quads = parser.parse(turtle);
            const n3Store = new N3.Store();
            n3Store.addQuads(quads);
            return { _tag: "RdfStore" as const, _store: n3Store } satisfies RdfStore;
          },
          catch: (error) =>
            ParsingFailed.make({
              message: `Failed to parse Turtle: ${error}`,
              cause: O.some(error),
              format: O.some("Turtle"),
            }),
        }),

      /**
       * Parse TriG string to RDF store
       *
       * Parses RDF TriG syntax (with named graphs) into an RdfStore.
       *
       * @param trig - TriG RDF string
       * @returns Effect yielding RdfStore or ParsingFailed
       */
      parseTriG: (trig: string) =>
        Effect.try({
          try: () => {
            const parser = new N3.Parser({ format: "application/trig" });
            const quads = parser.parse(trig);
            const n3Store = new N3.Store();
            n3Store.addQuads(quads);
            return { _tag: "RdfStore" as const, _store: n3Store } satisfies RdfStore;
          },
          catch: (error) =>
            ParsingFailed.make({
              message: `Failed to parse TriG: ${error}`,
              cause: O.some(error),
              format: O.some("TriG"),
            }),
        }),

      /**
       * Query RDF store with pattern
       *
       * Queries the store using a pattern where null values act as wildcards.
       * Returns domain Quad objects, not N3 types.
       *
       * @param store - RdfStore to query
       * @param pattern - Query pattern
       * @returns Effect yielding Chunk of Quad objects
       */
      queryStore: (store: RdfStore, pattern: QuadPattern) =>
        Effect.try({
          try: () => {
            const n3Store = store._store;

            // Convert domain terms to N3 terms for querying
            const n3Subject = domainTermToN3Term(pattern.subject ?? null);
            const n3Predicate = domainTermToN3Term(pattern.predicate ?? null);
            const n3Object = domainTermToN3Term(pattern.object ?? null);
            const n3Graph = domainTermToN3Term(pattern.graph ?? null);

            // Query N3 store
            const n3Quads = n3Store.getQuads(
              n3Subject as N3.Term | null,
              n3Predicate as N3.Term | null,
              n3Object as N3.Term | null,
              n3Graph as N3.Term | null
            );

            // Convert N3 quads to domain quads
            return Chunk.fromIterable(n3Quads.map(n3QuadToDomainQuad));
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to query store: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Create IRI from string
       *
       * Validates and creates a domain IRI type.
       *
       * @param iri - IRI string
       * @returns IRI domain type
       */
      createIri: (iri: string): IRI => iri as IRI,

      /**
       * Add entities to store
       *
       * Converts Entity domain objects to N3 quads using pure utils.
       * Optionally adds triples to a named graph for provenance tracking.
       *
       * @param store - RdfStore to add to
       * @param entities - Entities to convert to RDF
       * @param options - Optional settings including graphUri for named graph
       * @returns Effect completing when entities are added
       */
      addEntities: (store: RdfStore, entities: Iterable<Entity>, options?: AddTriplesOptions) =>
        Effect.try({
          try: () => {
            const n3Store = store._store;
            const graphNode = P.isNotUndefined(options?.graphUri)
              ? N3.DataFactory.namedNode(options.graphUri)
              : undefined;
            // Use targetNamespace from options if provided, otherwise fall back to config
            // Convert Namespace identifier to full IRI if targetNamespace is provided
            const namespace = P.isNotUndefined(options?.targetNamespace)
              ? (() => {
                  // Extract protocol://domain/ from baseNs
                  const match = baseNs.match(/^https?:\/\/[^/]+\//);
                  const baseDomain = P.isNotNull(match) ? match[0] : "http://example.org/";
                  return `${baseDomain}${options.targetNamespace}/`;
                })()
              : baseNs;

            for (const entity of entities) {
              // Use pure util function for transformation
              const quads = entityToQuads(entity, namespace, prefixes, builders);
              for (const quad of quads) {
                // Add to named graph if specified, otherwise default graph
                if (P.isNotUndefined(graphNode)) {
                  n3Store.addQuad(N3.DataFactory.quad(quad.subject, quad.predicate, quad.object, graphNode));
                } else {
                  n3Store.addQuad(quad);
                }
              }
            }
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to add entities to RDF store: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Add relations to store
       *
       * Converts Relation domain objects to N3 quads using pure utils.
       * Optionally adds triples to a named graph for provenance tracking.
       *
       * @param store - RdfStore to add to
       * @param relations - Relations to convert to RDF
       * @param options - Optional settings including graphUri for named graph
       * @returns Effect completing when relations are added
       */
      addRelations: (store: RdfStore, relations: Iterable<Relation>, options?: AddTriplesOptions) =>
        Effect.try({
          try: () => {
            const n3Store = store._store;
            const graphNode = P.isNotUndefined(options?.graphUri)
              ? N3.DataFactory.namedNode(options.graphUri)
              : undefined;
            // Use targetNamespace from options if provided, otherwise fall back to config
            // Convert Namespace identifier to full IRI if targetNamespace is provided
            const namespace = P.isNotUndefined(options?.targetNamespace)
              ? (() => {
                  // Extract protocol://domain/ from baseNs
                  const match = baseNs.match(/^https?:\/\/[^/]+\//);
                  const baseDomain = P.isNotNull(match) ? match[0] : "http://example.org/";
                  return `${baseDomain}${options.targetNamespace}/`;
                })()
              : baseNs;

            for (const rel of relations) {
              // Use pure util function for transformation
              const quad = relationToQuad(rel, namespace, prefixes, builders);
              // Add to named graph if specified, otherwise default graph
              if (P.isNotUndefined(graphNode)) {
                n3Store.addQuad(N3.DataFactory.quad(quad.subject, quad.predicate, quad.object, graphNode));
              } else {
                n3Store.addQuad(quad);
              }
            }
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to add relations to RDF store: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Add owl:sameAs links for entity resolution
       *
       * Generates owl:sameAs triples linking mention IRIs to canonical entity IRIs.
       * Skips self-referential links (where mentionId === canonicalId).
       *
       * @param store - RdfStore to add to
       * @param canonicalMap - Map of mentionId -> canonicalId
       * @returns Effect completing when links are added
       *
       * @since 2.0.0
       */
      addSameAsLinks: (store: RdfStore, canonicalMap: Record<string, string>) =>
        Effect.try({
          try: () => {
            const n3Store = store._store;
            const sameAsPredicate = N3.DataFactory.namedNode(OWL.sameAs);

            for (const [mentionId, canonicalId] of Object.entries(canonicalMap)) {
              // Skip self-referential links
              if (mentionId === canonicalId) continue;

              // Build full IRIs for the entities
              const mentionIri = mentionId.startsWith("http") ? mentionId : `${baseNs}${mentionId}`;
              const canonicalIri = canonicalId.startsWith("http") ? canonicalId : `${baseNs}${canonicalId}`;

              const subject = N3.DataFactory.namedNode(mentionIri);
              const object = N3.DataFactory.namedNode(canonicalIri);

              n3Store.addQuad(N3.DataFactory.quad(subject, sameAsPredicate, object));
            }
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to add owl:sameAs links to RDF store: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Add extraction run metadata triples for provenance tracking
       *
       * Generates PROV-O and Dublin Core metadata triples describing the
       * extraction activity. Triples are added to the specified named graph.
       *
       * Generated triples:
       * - prov:wasGeneratedBy → extraction activity
       * - prov:generatedAtTime → timestamp
       * - dcterms:source → document URI
       * - :usedModel → LLM model name
       * - :ontologyVersion → ontology IRI + hash
       *
       * @param store - RdfStore to add metadata to
       * @param metadata - Extraction metadata
       * @returns Effect completing when metadata is added
       *
       * @since 2.0.0
       */
      addExtractionMetadata: (store: RdfStore, metadata: ExtractionMetadata) =>
        Effect.try({
          try: () => {
            const n3Store = store._store;
            const graphNode = N3.DataFactory.namedNode(metadata.graphUri);
            const graphSubject = N3.DataFactory.namedNode(metadata.graphUri);

            // Activity URI defaults to graph URI with /activity suffix
            const activityUri = metadata.activityUri ?? `${metadata.graphUri}/activity`;
            const activityNode = N3.DataFactory.namedNode(activityUri);

            // Custom predicates in the extraction namespace
            const usedModelPredicate = N3.DataFactory.namedNode(`${baseNs}usedModel`);
            const ontologyVersionPredicate = N3.DataFactory.namedNode(`${baseNs}ontologyVersion`);

            // prov:wasGeneratedBy
            n3Store.addQuad(
              N3.DataFactory.quad(graphSubject, N3.DataFactory.namedNode(PROV.wasGeneratedBy), activityNode, graphNode)
            );

            // prov:generatedAtTime
            n3Store.addQuad(
              N3.DataFactory.quad(
                graphSubject,
                N3.DataFactory.namedNode(PROV.generatedAtTime),
                N3.DataFactory.literal(metadata.timestamp, N3.DataFactory.namedNode(XSD.dateTime)),
                graphNode
              )
            );

            // dcterms:source
            n3Store.addQuad(
              N3.DataFactory.quad(
                graphSubject,
                N3.DataFactory.namedNode(DCTERMS.source),
                N3.DataFactory.namedNode(metadata.sourceUri),
                graphNode
              )
            );

            // :usedModel (custom predicate)
            n3Store.addQuad(
              N3.DataFactory.quad(activityNode, usedModelPredicate, N3.DataFactory.literal(metadata.model), graphNode)
            );

            // :ontologyVersion (custom predicate)
            n3Store.addQuad(
              N3.DataFactory.quad(
                activityNode,
                ontologyVersionPredicate,
                N3.DataFactory.literal(metadata.ontologyVersion),
                graphNode
              )
            );

            // Mark activity as prov:Activity type
            n3Store.addQuad(
              N3.DataFactory.quad(
                activityNode,
                N3.DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
                N3.DataFactory.namedNode(PROV.Activity),
                graphNode
              )
            );
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to add extraction metadata to RDF store: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Add a triple with confidence annotation using RDF-star
       *
       * Uses N3.js quoted triple support to create:
       * - The original triple (subject predicate object)
       * - A confidence annotation triple using the original as subject
       *
       * RDF-star syntax: <<:subject :predicate :object>> ex:confidence "0.95"^^xsd:double
       */
      addTripleWithConfidence: (
        store: RdfStore,
        triple: { subject: string; predicate: string; object: string | number | boolean },
        confidence: number,
        graphUri?: string
      ) =>
        Effect.try({
          try: () => {
            const n3Store = store._store;
            const graphNode = P.isNotUndefined(graphUri)
              ? N3.DataFactory.namedNode(graphUri)
              : N3.DataFactory.defaultGraph();

            // Create subject and predicate nodes
            const subjectNode = N3.DataFactory.namedNode(triple.subject);
            const predicateNode = N3.DataFactory.namedNode(triple.predicate);

            // Create object node (IRI or literal)
            const objectNode =
              typeof triple.object === "string"
                ? triple.object.startsWith("http://") ||
                  triple.object.startsWith("https://") ||
                  triple.object.startsWith("urn:")
                  ? N3.DataFactory.namedNode(triple.object)
                  : N3.DataFactory.literal(triple.object)
                : typeof triple.object === "number"
                  ? N3.DataFactory.literal(triple.object.toString(), N3.DataFactory.namedNode(XSD.double))
                  : N3.DataFactory.literal(triple.object.toString(), N3.DataFactory.namedNode(XSD.boolean));

            // Create the original quad (triple)
            const originalQuad = N3.DataFactory.quad(subjectNode, predicateNode, objectNode, graphNode);

            // Add the original quad to the store
            n3Store.addQuad(originalQuad);

            // Create confidence annotation using RDF-star (quoted triple as subject)
            // The N3.DataFactory.quad() can accept a Quad as subject for RDF-star
            const confidenceQuad = N3.DataFactory.quad(
              originalQuad, // Quoted triple as subject (RDF-star)
              N3.DataFactory.namedNode(EXTR.confidence),
              N3.DataFactory.literal(confidence.toString(), N3.DataFactory.namedNode(XSD.double)),
              graphNode
            );

            n3Store.addQuad(confidenceQuad);
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to add triple with confidence: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Generate core:Mention RDF triples from entity evidence spans
       *
       * Creates proper Mention nodes linked to entities via core:hasEvidentialMention.
       * Each Mention node includes:
       * - rdf:type core:Mention
       * - claims:evidenceText (the quoted text)
       * - claims:startOffset, claims:endOffset (character positions)
       * - claims:confidence (extraction confidence)
       * - core:mentions (link back to entity)
       *
       * @param store - Target RDF store
       * @param entityUri - URI of the entity this mention references
       * @param mention - EvidenceSpan data (text, startChar, endChar, confidence)
       * @param options - Optional mention URI and source document URI
       * @returns Effect completing when triples are added
       *
       * @example
       * ```typescript
       * yield* rdf.generateMentionTriples(store, entityUri, {
       *   text: "Mayor Bruce Harrell",
       *   startChar: 42,
       *   endChar: 60,
       *   confidence: 0.95
       * }, { sourceUri: "gs://bucket/doc.txt" })
       * ```
       *
       * @since 2.0.0
       */
      generateMentionTriples: (
        store: RdfStore,
        entityUri: string,
        mention: { text: string; startChar: number; endChar: number; confidence?: number },
        options?: { mentionUri?: string; sourceUri?: string; graphUri?: string }
      ) =>
        Effect.try({
          try: () => {
            const n3Store = store._store;
            const graphNode = P.isNotUndefined(options?.graphUri)
              ? N3.DataFactory.namedNode(options.graphUri)
              : N3.DataFactory.defaultGraph();

            // Generate mention URI if not provided
            // Format: entity_uri/mention/{startChar}-{endChar}
            const mentionUri = options?.mentionUri ?? `${entityUri}/mention/${mention.startChar}-${mention.endChar}`;
            const mentionNode = N3.DataFactory.namedNode(mentionUri);
            const entityNode = N3.DataFactory.namedNode(entityUri);

            // rdf:type core:Mention
            n3Store.addQuad(
              N3.DataFactory.quad(
                mentionNode,
                N3.DataFactory.namedNode(RDF.type),
                N3.DataFactory.namedNode(CORE.Mention),
                graphNode
              )
            );

            // claims:evidenceText
            n3Store.addQuad(
              N3.DataFactory.quad(
                mentionNode,
                N3.DataFactory.namedNode(CLAIMS.evidenceText),
                N3.DataFactory.literal(mention.text),
                graphNode
              )
            );

            // claims:startOffset
            n3Store.addQuad(
              N3.DataFactory.quad(
                mentionNode,
                N3.DataFactory.namedNode(CLAIMS.startOffset),
                N3.DataFactory.literal(mention.startChar.toString(), N3.DataFactory.namedNode(XSD.integer)),
                graphNode
              )
            );

            // claims:endOffset
            n3Store.addQuad(
              N3.DataFactory.quad(
                mentionNode,
                N3.DataFactory.namedNode(CLAIMS.endOffset),
                N3.DataFactory.literal(mention.endChar.toString(), N3.DataFactory.namedNode(XSD.integer)),
                graphNode
              )
            );

            // claims:confidence (if provided)
            if (mention.confidence !== undefined) {
              n3Store.addQuad(
                N3.DataFactory.quad(
                  mentionNode,
                  N3.DataFactory.namedNode(CLAIMS.confidence),
                  N3.DataFactory.literal(mention.confidence.toString(), N3.DataFactory.namedNode(XSD.decimal)),
                  graphNode
                )
              );
            }

            // core:mentions (mention → entity)
            n3Store.addQuad(
              N3.DataFactory.quad(mentionNode, N3.DataFactory.namedNode(CORE.mentions), entityNode, graphNode)
            );

            // core:hasEvidentialMention (entity → mention)
            n3Store.addQuad(
              N3.DataFactory.quad(
                entityNode,
                N3.DataFactory.namedNode(CORE.hasEvidentialMention),
                mentionNode,
                graphNode
              )
            );

            // claims:statedIn (source document reference)
            if (P.isNotUndefined(options?.sourceUri)) {
              n3Store.addQuad(
                N3.DataFactory.quad(
                  mentionNode,
                  N3.DataFactory.namedNode(CLAIMS.statedIn),
                  N3.DataFactory.namedNode(options.sourceUri),
                  graphNode
                )
              );
            }

            return mentionUri;
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to generate mention triples: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Serialize store to Turtle with prefixes
       *
       * Uses prefixes from ConfigService for clean output.
       * Async operation via N3.Writer.
       *
       * @param store - RdfStore to serialize
       * @returns Turtle string
       */
      toTurtle: (store: RdfStore) =>
        Effect.callback<string, SerializationFailed>((resume) => {
          const n3Store = store._store;
          const writer = new N3.Writer({
            format: "Turtle",
            prefixes: config.rdf.prefixes,
          });

          // Add all quads from store
          n3Store.forEach((q) => writer.addQuad(q));

          writer.end((error, result) => {
            if (P.isTruthy(error)) {
              resume(
                Effect.fail(
                  SerializationFailed.make({
                    message: `Turtle serialization failed: ${error}`,
                    cause: O.some(error),
                    format: O.some("Turtle"),
                  })
                )
              );
            } else {
              resume(Effect.succeed(result));
            }
          });
        }).pipe(
          Effect.timeoutOrElse({
            duration: Duration.seconds(30),
            orElse: () =>
              Effect.fail(
                SerializationFailed.make({
                  message: "Turtle serialization timed out after 30 seconds",
                  format: O.some("Turtle"),
                })
              ),
          })
        ),

      /**
       * Serialize store to TriG format with named graphs
       *
       * Uses prefixes from ConfigService for clean output.
       * Async operation via N3.Writer with TriG format.
       *
       * @param store - RdfStore to serialize
       * @returns TriG string
       */
      toTriG: (store: RdfStore) =>
        Effect.callback<string, SerializationFailed>((resume) => {
          const n3Store = store._store;
          const writer = new N3.Writer({
            format: "application/trig",
            prefixes: config.rdf.prefixes,
          });

          // Add all quads from store (including graph information)
          n3Store.forEach((q) => writer.addQuad(q));

          writer.end((error, result) => {
            if (P.isTruthy(error)) {
              resume(
                Effect.fail(
                  SerializationFailed.make({
                    message: `TriG serialization failed: ${error}`,
                    cause: O.some(error),
                    format: O.some("TriG"),
                  })
                )
              );
            } else {
              resume(Effect.succeed(result));
            }
          });
        }).pipe(
          Effect.timeoutOrElse({
            duration: Duration.seconds(30),
            orElse: () =>
              Effect.fail(
                SerializationFailed.make({
                  message: "TriG serialization timed out after 30 seconds",
                  format: O.some("TriG"),
                })
              ),
          })
        ),

      /**
       * Get all named graphs in the store
       *
       * Returns unique graph IRIs from all quads.
       */
      getGraphs: (store: RdfStore) =>
        Effect.try({
          try: () => {
            const n3Store = store._store;
            const graphs = new Set<string>();

            // Iterate all quads and collect unique graph IRIs
            n3Store.forEach((quad) => {
              if (quad.graph.termType === "NamedNode") {
                graphs.add(quad.graph.value);
              }
            });

            return Array.from(graphs) as Array<IRI>;
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to get graphs: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Get all quads from a specific named graph
       */
      getQuadsFromGraph: (store: RdfStore, graphIri: IRI) =>
        Effect.try({
          try: () => {
            const n3Store = store._store;
            const graphNode = N3.DataFactory.namedNode(graphIri);
            const n3Quads = n3Store.getQuads(null, null, null, graphNode);
            return Chunk.fromIterable(n3Quads.map(n3QuadToDomainQuad));
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to get quads from graph ${graphIri}: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Copy quads between graphs
       */
      copyGraphQuads: (store: RdfStore, sourceGraph: IRI, targetGraph: IRI) =>
        Effect.try({
          try: () => {
            const n3Store = store._store;
            const sourceNode = N3.DataFactory.namedNode(sourceGraph);
            const targetNode = N3.DataFactory.namedNode(targetGraph);

            // Get all quads from source graph
            const sourceQuads = n3Store.getQuads(null, null, null, sourceNode);

            // Add each quad to target graph
            for (const quad of sourceQuads) {
              n3Store.addQuad(N3.DataFactory.quad(quad.subject, quad.predicate, quad.object, targetNode));
            }

            return sourceQuads.length;
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to copy quads from ${sourceGraph} to ${targetGraph}: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Delete a named graph and all its quads
       */
      deleteGraph: (store: RdfStore, graphIri: IRI) =>
        Effect.try({
          try: () => {
            const n3Store = store._store;
            const graphNode = N3.DataFactory.namedNode(graphIri);

            // Get all quads in the graph
            const quadsToDelete = n3Store.getQuads(null, null, null, graphNode);
            const count = quadsToDelete.length;

            // Remove all quads
            n3Store.removeQuads(quadsToDelete);

            return count;
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to delete graph ${graphIri}: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Merge source store into target store (union semantics)
       *
       * Uses RDF set semantics - duplicate quads are ignored.
       * Returns count of new quads added (not total quads).
       */
      mergeStores: (target: RdfStore, source: RdfStore) =>
        Effect.try({
          try: () => {
            const targetStore = target._store;
            const sourceStore = source._store;

            // Get initial count
            const initialCount = targetStore.size;

            // Get all quads from source
            const sourceQuads = sourceStore.getQuads(null, null, null, null);

            // Add all quads to target (N3.Store handles deduplication)
            targetStore.addQuads(sourceQuads);

            // Return number of new quads added
            return targetStore.size - initialCount;
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to merge stores: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * Clone an RDF store
       *
       * Creates a new store with copies of all quads from the source.
       */
      cloneStore: (source: RdfStore) =>
        Effect.try({
          try: () => {
            const newStore = new N3.Store();
            const sourceQuads = source._store.getQuads(null, null, null, null);
            newStore.addQuads(sourceQuads);
            return { _tag: "RdfStore" as const, _store: newStore } satisfies RdfStore;
          },
          catch: (error) =>
            RdfError.make({
              message: `Failed to clone store: ${error}`,
              cause: O.some(error),
            }),
        }),

      /**
       * SHACL validation placeholder
       *
       * Future: Integrate SHACL validator
       *
       * @param store - RdfStore to validate
       * @param shapesGraph - SHACL shapes as Turtle string
       * @returns Validation result
       */
      validate: (_store: RdfStore, _shapesGraph: string) =>
        Effect.succeed({
          conforms: true,
          report: "SHACL validation not yet implemented",
        }),
    } satisfies RdfBuilderShape;
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([ConfigServiceDefault]));
}
