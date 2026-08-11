import { Chunk, Effect, Option, Schema, Context, Layer } from "effect"
import {
  EmbeddingsNotFound,
  EmbeddingsVersionMismatch,
  OntologyFileNotFound,
  OntologyParsingFailed
} from "../Domain/Error/Ontology.ts"
import type { ContentHash, Namespace, OntologyName } from "../Domain/Identity.ts"
import {
  type ClassDefinition,
  OntologyContext,
  OntologyRef,
  type PropertyDefinition
} from "../Domain/Model/Ontology.ts"
import { OntologyEmbeddings, OntologyEmbeddingsJson } from "../Domain/Model/OntologyEmbeddings.ts"
import { PathLayout } from "../Domain/PathLayout.ts"
import { type EmbeddingEntityType, EmbeddingRepository } from "../Repository/Embedding.ts"
import { extractLocalNameFromIri } from "../Utils/Iri.ts"
import { rrfFusion } from "../Utils/Retrieval.ts"
import { ConfigService, ConfigServiceDefault } from "./Config.ts"
import { EmbeddingService, EmbeddingServiceDefault } from "./Embedding.ts"
import type { OntologySearchResult } from "./Nlp.ts"
import { NlpService } from "./Nlp.ts"
import { parseOntologyFromStore } from "./Ontology.ts"
import { RdfBuilder } from "./Rdf.ts"
import { StorageService } from "./Storage.ts"
import { $ScratchpadId } from "@beep/identity";
import * as O from "effect/Option";
const $I = $ScratchpadId.create("effect-ontology/Service/OntologyLoader");

// =============================================================================
// Helpers
// =============================================================================

/**
 * Resolve classes from search results
 *
 * Maps search results (which may include classes or properties) to ClassDefinitions.
 * For properties, resolves the domain classes.
 *
 * @param results - Search results from BM25 or semantic index
 * @param classes - All classes in the ontology context
 * @returns Map of class IDs to ClassDefinitions (deduplicated)
 */
const resolveClassesFromSearchResults = (
  results: ReadonlyArray<OntologySearchResult>,
  classes: ReadonlyArray<ClassDefinition>
): Map<string, ClassDefinition> => {
  const classesMap = new Map<string, ClassDefinition>()

  for (const result of results) {
    if (result.class) {
      classesMap.set(result.class.id, result.class)
    }
    if (result.property) {
      for (const domainLocalName of result.property.domain) {
        const domainClass = classes.find(
          (c) => extractLocalNameFromIri(c.id) === domainLocalName
        )
        if (domainClass) {
          classesMap.set(domainClass.id, domainClass)
        }
      }
    }
  }

  return classesMap
}

const makeOntologyLoader = Effect.gen(function*() {
  const config = yield* ConfigService
  const storage = yield* StorageService
  const rdf = yield* RdfBuilder
  const nlp = yield* NlpService
  const embedding = yield* EmbeddingService

  // Cache Ontology Loading & Parsing -> Returns OntologyContext
  const getOntology = yield* Effect.cached(
    Effect.gen(function*() {
      const ontologyPath = config.ontology.path

      const contentOpt = yield* storage.get(ontologyPath).pipe(
        Effect.mapError((error) =>
          OntologyFileNotFound.make({
            message: `Failed to read ontology from GCS: ${error.message}`,
            path: ontologyPath,
            cause: O.some(error)
          })
        )
      )

      if ((contentOpt === undefined)) {
        return yield* Effect.fail(
          OntologyFileNotFound.make({
            message: `Ontology file not found at ${ontologyPath} in GCS`,
            path: ontologyPath
          })
        )
      }

      const turtleContent = contentOpt
      const store = yield* rdf.parseTurtle(turtleContent).pipe(
        Effect.mapError((error) =>
          OntologyParsingFailed.make({
            message: `Failed to parse ontology turtle content: ${error.message}`,
            path: ontologyPath,
            cause: O.some(error)
          })
        )
      )

      const { classes, hierarchy, properties, propertyHierarchy } = yield* parseOntologyFromStore(
        rdf,
        store,
        ontologyPath
      )

      const ref = yield* Effect.try(() => PathLayout.ontology.decode(ontologyPath)).pipe(
        Effect.map(([ns, name, hash]) => OntologyRef.make({ namespace: ns, name, contentHash: hash })),
        Effect.orElseSucceed(() =>
          OntologyRef.make({
            namespace: "unknown" as Namespace,
            name: "current" as OntologyName,
            contentHash: "00000000" as ContentHash
          })
        )
      )

      return {
        context: OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties)
        }),
        ref
      }
    })
  )

  // Cache BM25 index
  const getBm25Index = yield* Effect.cached(
    Effect.gen(function*() {
      const { context } = yield* getOntology
      return yield* nlp.createOntologyIndex(context)
    })
  )

  // Cache Semantic index
  const getSemanticIndex = yield* Effect.cached(
    Effect.gen(function*() {
      const { context } = yield* getOntology
      return yield* nlp.createOntologySemanticIndex(context)
    })
  )

  return {
    ontology: Effect.map(getOntology, (o) => o.context),
    ontologyRef: Effect.map(getOntology, (o) => o.ref),

    searchClasses: (query: string, limit: number = 10) =>
      Effect.gen(function*() {
        const { context } = yield* getOntology
        const index = yield* getBm25Index
        const results = yield* nlp.searchOntologyIndex(index, query, limit)
        const validClasses = resolveClassesFromSearchResults(results, context.classes)
        return Chunk.fromIterable(validClasses.values())
      }),

    searchProperties: (query: string, limit: number = 10) =>
      Effect.gen(function*() {
        const index = yield* getBm25Index
        const results = yield* nlp.searchOntologyIndex(index, query, limit)
        return Chunk.fromIterable(
          results
            .filter((r) => r.property !== undefined)
            .map((r) => r.property!)
        )
      }),

    getPropertiesFor: (classIris: ReadonlyArray<string>) =>
      Effect.gen(function*() {
        const { context } = yield* getOntology
        const props: Array<PropertyDefinition> = []

        for (const classIri of classIris) {
          const classProps = context.getPropertiesForClass(classIri)
          for (const prop of classProps) {
            props.push(prop)
          }
        }

        const uniqueProps = new Map<string, PropertyDefinition>()
        for (const prop of props) {
          uniqueProps.set(prop.id, prop)
        }

        return Chunk.fromIterable(uniqueProps.values())
      }),

    searchClassesSemantic: (query: string, limit: number = 10) =>
      Effect.gen(function*() {
        const { context } = yield* getOntology
        const index = yield* getSemanticIndex
        const results = yield* nlp.searchOntologySemanticIndex(index, query, limit)
        const validClasses = resolveClassesFromSearchResults(results, context.classes)
        return Chunk.fromIterable(validClasses.values())
      }),

    searchPropertiesSemantic: (query: string, limit: number = 10) =>
      Effect.gen(function*() {
        const index = yield* getSemanticIndex
        const results = yield* nlp.searchOntologySemanticIndex(
          index,
          query,
          limit
        )
        return Chunk.fromIterable(
          results
            .filter((r) => r.property !== undefined)
            .map((r) => r.property!)
        )
      }),

    /**
     * Load ontology with pre-computed embeddings from storage
     *
     * Loads both the ontology file and its pre-computed embeddings blob in parallel.
     * Validates that embeddings version matches ontology content hash.
     *
     * @param ontologyUri - URI of the ontology file (e.g., "gs://bucket/ontologies/football/ontology.ttl")
     * @returns OntologyContext and OntologyEmbeddings
     *
     * @example
     * ```typescript
     * const { context, embeddings } = yield* loader.loadOntologyWithEmbeddings(
     *   "gs://bucket/ontologies/football/ontology.ttl"
     * )
     * ```
     *
     * @since 2.0.0
     */
    loadOntologyWithEmbeddings: (ontologyUri: string) =>
      Effect.gen(function*() {
        // Derive embeddings path from ontology URI
        const embeddingsPath = OntologyEmbeddings.storagePathFor(ontologyUri)

        // Load ontology and embeddings in parallel
        const [ontologyContentOpt, embeddingsJsonOpt] = yield* Effect.all([
          storage.get(ontologyUri).pipe(
            Effect.mapError((error) =>
              OntologyFileNotFound.make({
                message: `Failed to read ontology from storage: ${error.message}`,
                path: ontologyUri,
                cause: O.some(error)
              })
            )
          ),
          storage.get(embeddingsPath).pipe(
            Effect.catch(() => Effect.succeed(Option.none<string>()))
          )
        ], { concurrency: 2 })

        // Check ontology exists
        if ((ontologyContentOpt === undefined)) {
          return yield* Effect.fail(
            OntologyFileNotFound.make({
              message: `Ontology file not found at ${ontologyUri}`,
              path: ontologyUri
            })
          )
        }

        const ontologyContent = ontologyContentOpt

        // Parse ontology
        const store = yield* rdf.parseTurtle(ontologyContent).pipe(
          Effect.mapError((error) =>
            OntologyParsingFailed.make({
              message: `Failed to parse ontology: ${error.message}`,
              path: ontologyUri,
              cause: O.some(error)
            })
          )
        )

        const { classes, hierarchy, properties, propertyHierarchy } = yield* parseOntologyFromStore(
          rdf,
          store,
          ontologyUri
        )

        const context = OntologyContext.make({
          classes: Chunk.toReadonlyArray(classes),
          hierarchy,
          propertyHierarchy,
          properties: Chunk.toReadonlyArray(properties)
        })

        // Compute expected version from ontology content
        const expectedVersion = yield* OntologyEmbeddings.computeVersion(ontologyContent)

        // Check if embeddings exist
        if (Option.isNone(embeddingsJsonOpt)) {
          yield* Effect.logWarning("Pre-computed embeddings not found, will need to compute on-the-fly", {
            ontologyUri,
            embeddingsPath
          })
          return yield* Effect.fail(
            EmbeddingsNotFound.make({
              message: `Pre-computed embeddings not found for ontology`,
              ontologyUri,
              embeddingsPath
            })
          )
        }

        // Parse embeddings JSON
        const embeddingsJson = embeddingsJsonOpt.value
        const embeddings = yield* Schema.decode(OntologyEmbeddingsJson)(embeddingsJson).pipe(
          Effect.mapError((error) =>
            OntologyParsingFailed.make({
              message: `Failed to parse embeddings JSON: ${String(error)}`,
              path: embeddingsPath,
              cause: O.some(error)
            })
          )
        )

        // Validate version
        if (embeddings.version !== expectedVersion) {
          yield* Effect.logWarning("Embeddings version mismatch - ontology has changed", {
            ontologyUri,
            expectedVersion,
            actualVersion: embeddings.version
          })
          return yield* Effect.fail(
            EmbeddingsVersionMismatch.make({
              message: `Embeddings version mismatch: expected ${expectedVersion}, got ${embeddings.version}`,
              ontologyUri,
              expectedVersion,
              actualVersion: embeddings.version
            })
          )
        }

        yield* Effect.logInfo("Ontology with embeddings loaded successfully", {
          ontologyUri,
          version: embeddings.version,
          classCount: context.classes.length,
          propertyCount: context.properties.length,
          embeddingCount: embeddings.classes.length + embeddings.properties.length
        })

        return { context, embeddings }
      }),

    searchClassesHybrid: (query: string, limit: number = 100) =>
      Effect.gen(function*() {
        const { context } = yield* getOntology
        const searchLimit = Math.ceil(limit * 0.7)

        const [semanticResults, bm25Results] = yield* Effect.all([
          Effect.gen(function*() {
            const semanticIndex = yield* getSemanticIndex
            const results = yield* nlp.searchOntologySemanticIndex(semanticIndex, query, searchLimit)
            return Chunk.fromIterable(resolveClassesFromSearchResults(results, context.classes).values())
          }).pipe(Effect.catch(() => Effect.succeed(Chunk.empty<ClassDefinition>()))),
          Effect.gen(function*() {
            const bm25Index = yield* getBm25Index
            const results = yield* nlp.searchOntologyIndex(bm25Index, query, searchLimit)
            return Chunk.fromIterable(resolveClassesFromSearchResults(results, context.classes).values())
          })
        ], { concurrency: 2 })

        const merged = new Map<string, ClassDefinition>()
        for (const cls of semanticResults) merged.set(cls.id, cls)
        for (const cls of bm25Results) {
          if (!merged.has(cls.id)) merged.set(cls.id, cls)
        }

        if (merged.size < limit && context.classes.length <= limit) {
          for (const cls of context.classes) merged.set(cls.id, cls)
        }

        return Chunk.fromIterable(Array.from(merged.values()).slice(0, limit))
      }),

    /**
     * Search for classes using pre-loaded embeddings (fast path)
     *
     * Uses pre-computed ontology embeddings for semantic search instead of
     * computing embeddings at search time. Combines semantic similarity with
     * BM25 lexical search using Reciprocal Rank Fusion.
     *
     * @param query - Search query string
     * @param ontologyContext - The ontology context containing class definitions
     * @param ontologyEmbeddings - Pre-computed embeddings for all classes
     * @param limit - Maximum number of results (default: 100)
     * @returns Chunk of ClassDefinition objects ranked by relevance
     *
     * @example
     * ```typescript
     * const { context, embeddings } = yield* loader.loadOntologyWithEmbeddings(ontologyUri)
     * const results = yield* loader.searchClassesWithEmbeddings("soccer player", context, embeddings, 10)
     * ```
     *
     * @since 2.0.0
     */
    searchClassesWithEmbeddings: (
      query: string,
      ontologyContext: OntologyContext,
      ontologyEmbeddings: OntologyEmbeddings,
      limit: number = 100
    ) =>
      Effect.gen(function*() {
        // 1. Embed the query using "search_query" task type for asymmetric search
        const queryEmbedding = yield* embedding.embed(query, "search_query")

        // 2. Compute cosine similarity against all pre-loaded class embeddings
        // Store as { id, similarity } for ranking, then map back to ClassDefinition
        const semanticScores: Array<{ id: string; similarity: number }> = []

        for (const classEmb of ontologyEmbeddings.classes) {
          const similarity = embedding.cosineSimilarity(queryEmbedding, classEmb.embedding)
          semanticScores.push({ id: classEmb.iri, similarity })
        }

        // Sort by similarity (descending)
        semanticScores.sort((a, b) => b.similarity - a.similarity)
        const semanticRanked = semanticScores.slice(0, Math.ceil(limit * 0.7))

        // 3. Also run BM25 search for lexical matching
        const bm25Index = yield* getBm25Index
        const bm25Raw = yield* nlp.searchOntologyIndex(bm25Index, query, Math.ceil(limit * 0.7))
        const bm25Ranked: Array<{ id: string }> = []
        const seenIds = new Set<string>()

        for (const result of bm25Raw) {
          if (result.class && !seenIds.has(result.class.id)) {
            bm25Ranked.push({ id: result.class.id })
            seenIds.add(result.class.id)
          }
          if (result.property) {
            for (const domainLocalName of result.property.domain) {
              const domainClass = ontologyContext.classes.find(
                (c) => extractLocalNameFromIri(c.id) === domainLocalName
              )
              if (domainClass && !seenIds.has(domainClass.id)) {
                bm25Ranked.push({ id: domainClass.id })
                seenIds.add(domainClass.id)
              }
            }
          }
        }

        // 4. Combine using Reciprocal Rank Fusion
        const fused = rrfFusion([semanticRanked, bm25Ranked])

        // 5. Map back to ClassDefinitions
        const results: Array<ClassDefinition> = []
        for (const item of fused.slice(0, limit)) {
          const classDef = ontologyContext.classes.find((c) => c.id === item.id)
          if (classDef) {
            results.push(classDef)
          }
        }

        // 6. Fallback: if we don't have enough, add remaining classes
        if (results.length < limit && ontologyContext.classes.length <= limit) {
          const existingIds = new Set(results.map((c) => c.id))
          for (const cls of ontologyContext.classes) {
            if (!existingIds.has(cls.id)) {
              results.push(cls)
              if (results.length >= limit) break
            }
          }
        }

        return Chunk.fromIterable(results)
      }),

    // =========================================================================
    // PostgreSQL-Backed Hybrid Search (Phase 4)
    // =========================================================================

    /**
     * Persist ontology embeddings to PostgreSQL
     *
     * Computes embeddings for all classes and properties in the ontology
     * and persists them to the PostgreSQL embeddings table for fast retrieval.
     *
     * @param ontologyId - Unique identifier for this ontology (e.g., "seattle")
     * @param ontologyContext - The parsed ontology context
     * @returns Number of embeddings persisted
     *
     * @example
     * ```typescript
     * const { context } = yield* loader.loadOntology()
     * const count = yield* loader.persistOntologyEmbeddings("seattle", context)
     * ```
     *
     * @since 2.0.0
     */
    persistOntologyEmbeddings: (
      ontologyId: string,
      ontologyContext: OntologyContext
    ) =>
      Effect.gen(function*() {
        const embeddingRepo = yield* EmbeddingRepository

        // Get documents from ontology (returns [IRI, document] tuples)
        const documents = ontologyContext.toDocuments()
        let persisted = 0

        yield* Effect.logInfo("Persisting ontology embeddings to PostgreSQL", {
          ontologyId,
          documentCount: documents.length
        })

        // Process in batches of 20 for efficiency
        const batchSize = 20
        for (let i = 0; i < documents.length; i += batchSize) {
          const batch = documents.slice(i, i + batchSize)

          // Compute embeddings for batch
          const texts = batch.map(([_, doc]) => doc)
          const embeddings = yield* embedding.embedBatch(texts, "search_document")

          // Persist each embedding
          yield* Effect.forEach(
            batch.map(([iri, doc], idx) => ({
              iri,
              doc,
              embedding: embeddings[idx]
            })),
            ({ doc, embedding: emb, iri }) => {
              // Determine entity type from IRI pattern or ontology lookup
              const isClass = ontologyContext.classes.some((c) => c.id === iri)
              const entityType: EmbeddingEntityType = isClass ? "class" : "entity"

              return embeddingRepo.upsert(
                ontologyId,
                entityType,
                iri,
                emb,
                doc, // Store text for hybrid search
                "nomic-embed-text-v1.5"
              )
            },
            { concurrency: 5 }
          )

          persisted += batch.length
        }

        yield* Effect.logInfo("Ontology embeddings persisted", {
          ontologyId,
          persisted
        })

        return persisted
      }),

    /**
     * Persist pre-computed ontology embeddings to PostgreSQL
     *
     * Takes already-computed embeddings (from file) and persists them to PostgreSQL.
     * Useful when embeddings are pre-computed offline.
     *
     * @param ontologyId - Unique identifier for this ontology
     * @param ontologyContext - The parsed ontology context
     * @param ontologyEmbeddings - Pre-computed embeddings
     * @returns Number of embeddings persisted
     *
     * @since 2.0.0
     */
    persistPrecomputedEmbeddings: (
      ontologyId: string,
      ontologyContext: OntologyContext,
      ontologyEmbeddings: OntologyEmbeddings
    ) =>
      Effect.gen(function*() {
        const embeddingRepo = yield* EmbeddingRepository

        yield* Effect.logInfo("Persisting pre-computed embeddings to PostgreSQL", {
          ontologyId,
          classCount: ontologyEmbeddings.classes.length,
          propertyCount: ontologyEmbeddings.properties.length
        })

        // Persist class embeddings
        const classItems = ontologyEmbeddings.classes.map((classEmb) => {
          const classDef = ontologyContext.classes.find((c) => c.id === classEmb.iri)
          const contentText = classDef
            ? `${classDef.label ?? ""} ${classDef.comment ?? ""} ${classDef.id}`
            : classEmb.iri

          return {
            ontologyId,
            entityType: "class" as EmbeddingEntityType,
            entityId: classEmb.iri,
            embedding: classEmb.embedding,
            contentText,
            model: ontologyEmbeddings.model
          }
        })

        // Persist property embeddings
        const propertyItems = ontologyEmbeddings.properties.map((propEmb) => {
          const propDef = ontologyContext.properties.find((p) => p.id === propEmb.iri)
          const contentText = propDef
            ? `${propDef.label ?? ""} ${propDef.comment ?? ""} ${propDef.id}`
            : propEmb.iri

          return {
            ontologyId,
            entityType: "entity" as EmbeddingEntityType, // Use 'entity' for properties
            entityId: propEmb.iri,
            embedding: propEmb.embedding,
            contentText,
            model: ontologyEmbeddings.model
          }
        })

        const allItems = [...classItems, ...propertyItems]
        const persisted = yield* embeddingRepo.upsertBatch(allItems)

        yield* Effect.logInfo("Pre-computed embeddings persisted", {
          ontologyId,
          persisted
        })

        return persisted
      }),

    /**
     * Search for classes using PostgreSQL hybrid search
     *
     * Uses PostgreSQL's pgvector for semantic similarity and tsvector for
     * full-text search, combined with Reciprocal Rank Fusion (RRF).
     *
     * Falls back to in-memory search if PostgreSQL is not available.
     *
     * @param ontologyId - Ontology identifier in PostgreSQL
     * @param query - Search query string
     * @param limit - Maximum number of results (default: 100)
     * @returns Chunk of ClassDefinition objects ranked by relevance
     *
     * @example
     * ```typescript
     * // First persist embeddings (once)
     * yield* loader.persistOntologyEmbeddings("seattle", context)
     *
     * // Then search using PostgreSQL
     * const results = yield* loader.searchClassesHybridPg("seattle", "city council", 10)
     * ```
     *
     * @since 2.0.0
     */
    searchClassesHybridPg: (
      ontologyId: string,
      query: string,
      limit: number = 100
    ) =>
      Effect.gen(function*() {
        const { context } = yield* getOntology
        const embeddingRepo = yield* EmbeddingRepository

        // Check if we have embeddings in PostgreSQL
        const hasEmbeddings = yield* embeddingRepo.hasEmbeddings(ontologyId, "class")

        if (!hasEmbeddings) {
          yield* Effect.logWarning(
            "No PostgreSQL embeddings found, falling back to in-memory search",
            { ontologyId }
          )
          // Fall back to in-memory hybrid search
          const searchLimit = Math.ceil(limit * 0.7)
          const [semanticResults, bm25Results] = yield* Effect.all([
            Effect.gen(function*() {
              const semanticIndex = yield* getSemanticIndex
              const results = yield* nlp.searchOntologySemanticIndex(semanticIndex, query, searchLimit)
              return Chunk.fromIterable(resolveClassesFromSearchResults(results, context.classes).values())
            }).pipe(Effect.catch(() => Effect.succeed(Chunk.empty<ClassDefinition>()))),
            Effect.gen(function*() {
              const bm25Index = yield* getBm25Index
              const results = yield* nlp.searchOntologyIndex(bm25Index, query, searchLimit)
              return Chunk.fromIterable(resolveClassesFromSearchResults(results, context.classes).values())
            })
          ], { concurrency: 2 })

          const merged = new Map<string, ClassDefinition>()
          for (const cls of semanticResults) merged.set(cls.id, cls)
          for (const cls of bm25Results) {
            if (!merged.has(cls.id)) merged.set(cls.id, cls)
          }

          return Chunk.fromIterable(Array.from(merged.values()).slice(0, limit))
        }

        // Use PostgreSQL hybrid search
        const queryEmbedding = yield* embedding.embed(query, "search_query")

        const hybridResults = yield* embeddingRepo.hybridSearch(
          ontologyId,
          "class",
          queryEmbedding,
          query,
          { limit, vectorWeight: 0.6, textWeight: 0.4 }
        )

        // Map results back to ClassDefinitions
        const results: Array<ClassDefinition> = []
        for (const result of hybridResults) {
          const classDef = context.classes.find((c) => c.id === result.entityId)
          if (classDef) {
            results.push(classDef)
          }
        }

        // Fallback: if we don't have enough, add remaining classes
        if (results.length < limit && context.classes.length <= limit) {
          const existingIds = new Set(results.map((c) => c.id))
          for (const cls of context.classes) {
            if (!existingIds.has(cls.id)) {
              results.push(cls)
              if (results.length >= limit) break
            }
          }
        }

        return Chunk.fromIterable(results)
      }),

    /**
     * Load ontology and persist embeddings to PostgreSQL
     *
     * Combines ontology loading with embedding persistence in one operation.
     * Useful for initialization when PostgreSQL storage is desired.
     *
     * @param ontologyId - Unique identifier for the ontology
     * @returns OntologyContext and number of persisted embeddings
     *
     * @since 2.0.0
     */
    loadAndPersistEmbeddings: (ontologyId: string) =>
      Effect.gen(function*() {
        const { context, ref } = yield* getOntology
        const embeddingRepo = yield* EmbeddingRepository

        // Check if embeddings already exist
        const hasExisting = yield* embeddingRepo.hasEmbeddings(ontologyId, "class")

        if (hasExisting) {
          yield* Effect.logDebug("Ontology embeddings already in PostgreSQL", { ontologyId })
          return { context, ref, embeddingsCount: 0, alreadyPersisted: true }
        }

        // Compute and persist embeddings
        const documents = context.toDocuments()
        let persisted = 0

        yield* Effect.logInfo("Computing and persisting ontology embeddings", {
          ontologyId,
          documentCount: documents.length
        })

        const batchSize = 20
        for (let i = 0; i < documents.length; i += batchSize) {
          const batch = documents.slice(i, i + batchSize)
          const texts = batch.map(([_, doc]) => doc)
          const embeddings = yield* embedding.embedBatch(texts, "search_document")

          yield* Effect.forEach(
            batch.map(([iri, doc], idx) => ({
              iri,
              doc,
              embedding: embeddings[idx]
            })),
            ({ doc, embedding: emb, iri }) => {
              const isClass = context.classes.some((c) => c.id === iri)
              const entityType: EmbeddingEntityType = isClass ? "class" : "entity"

              return embeddingRepo.upsert(
                ontologyId,
                entityType,
                iri,
                emb,
                doc,
                "nomic-embed-text-v1.5"
              )
            },
            { concurrency: 5 }
          )

          persisted += batch.length
        }

        yield* Effect.logInfo("Ontology loaded and embeddings persisted", {
          ontologyId,
          classCount: context.classes.length,
          propertyCount: context.properties.length,
          embeddingsCount: persisted
        })

        return { context, ref, embeddingsCount: persisted, alreadyPersisted: false }
      })
  }
})

export class OntologyLoader extends Context.Service<OntologyLoader>()($I`OntologyLoader`, {
  make: makeOntologyLoader,
}) {
    static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([
            ConfigServiceDefault,
            RdfBuilder.Default,
            NlpService.Default,
            EmbeddingServiceDefault
          ]));
}
