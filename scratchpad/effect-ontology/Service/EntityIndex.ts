/**
 * Service: Entity Index
 *
 * Indexed embedding store for fast entity retrieval in GraphRAG.
 * Supports k-NN search by embedding similarity and type-based filtering.
 *
 * @since 2.0.0
 * @module Service/EntityIndex
 */

import { Context, Effect, HashMap, HashSet, Layer, Option, Order, Ref } from "effect"
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts"
import type { Entity, KnowledgeGraph } from "../Domain/Model/Entity.ts"
import { EmbeddingService, EmbeddingServiceDefault } from "./Embedding.ts"
import type { Embedding } from "./EmbeddingCache.ts"

// =============================================================================
// Persistent EntityIndex
// =============================================================================
const $I = $ScratchpadId.create("effect-ontology/Service/EntityIndex");

import { StorageService } from "./Storage.ts"

import { ConfigService } from "./Config.ts"
import { $ScratchpadId } from "@beep/identity";

/**
 * Scored entity result from similarity search
 *
 * @since 2.0.0
 * @category Types
 */
export interface ScoredEntity {
  readonly entity: Entity
  readonly score: number
}

/**
 * Options for similarity search
 *
 * @since 2.0.0
 * @category Types
 */
export interface FindSimilarOptions {
  /** Filter to only entities with any of these types */
  readonly filterTypes?: ReadonlyArray<string>
  /** Minimum similarity score threshold (0-1) */
  readonly minScore?: number
}

/**
 * Internal index state
 */
interface IndexState {
  /** Entity storage: id -> Entity */
  readonly entities: HashMap.HashMap<string, Entity>
  /** Embedding storage: id -> embedding vector */
  readonly embeddings: HashMap.HashMap<string, Embedding>
  /** Type index: typeIri -> Set<entityId> */
  readonly typeIndex: HashMap.HashMap<string, HashSet.HashSet<string>>
}

const emptyState: IndexState = {
  entities: HashMap.empty(),
  embeddings: HashMap.empty(),
  typeIndex: HashMap.empty()
}

/**
 * EntityIndex service interface
 *
 * @since 2.0.0
 * @category Service
 */
export interface EntityIndexService {
  /**
   * Index all entities from a knowledge graph
   * Computes embeddings for all entity mentions
   */
  readonly index: (graph: KnowledgeGraph) => Effect.Effect<number, AnyEmbeddingError>

  /**
   * Find entities similar to query string using k-NN
   *
   * @param query - Search query text
   * @param k - Number of results to return
   * @param options - Optional filtering
   */
  readonly findSimilar: (
    query: string,
    k: number,
    options?: FindSimilarOptions
  ) => Effect.Effect<ReadonlyArray<ScoredEntity>, AnyEmbeddingError>

  /**
   * Find entities by type IRI
   *
   * @param typeIri - Full type IRI to match
   * @param limit - Maximum results (default: all)
   */
  readonly findByType: (
    typeIri: string,
    limit?: number
  ) => Effect.Effect<ReadonlyArray<Entity>>

  /**
   * Add a single entity to the index (incremental update)
   */
  readonly add: (entity: Entity) => Effect.Effect<void, AnyEmbeddingError>

  /**
   * Remove an entity from the index
   */
  readonly remove: (entityId: string) => Effect.Effect<boolean>

  /**
   * Get an entity by ID
   */
  readonly get: (entityId: string) => Effect.Effect<Option.Option<Entity>>

  /**
   * Clear the entire index
   */
  readonly clear: () => Effect.Effect<void>

  /**
   * Get current index size (number of entities)
   */
  readonly size: () => Effect.Effect<number>
}

/**
 * Cosine similarity between two vectors
 */
const cosineSimilarity = (a: Embedding, b: Embedding): number => {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dotProduct / denominator
}

/**
 * EntityIndex - In-memory entity index with embedding-based retrieval
 *
 * @since 2.0.0
 * @category Service
 */
export class EntityIndex extends Context.Service<EntityIndex>()($I`EntityIndex`, {
  make: Effect.gen(function*() {
    const embedding = yield* EmbeddingService
    const stateRef = yield* Ref.make<IndexState>(emptyState)

    /**
     * Add entity to type index
     */
    const addToTypeIndex = (
      typeIndex: HashMap.HashMap<string, HashSet.HashSet<string>>,
      entity: Entity
    ): HashMap.HashMap<string, HashSet.HashSet<string>> => {
      let updated = typeIndex
      for (const typeIri of entity.types) {
        const existing = HashMap.get(updated, typeIri)
        const set = Option.isSome(existing)
          ? HashSet.add(existing.value, entity.id)
          : HashSet.make(entity.id)
        updated = HashMap.set(updated, typeIri, set)
      }
      return updated
    }

    /**
     * Remove entity from type index
     */
    const removeFromTypeIndex = (
      typeIndex: HashMap.HashMap<string, HashSet.HashSet<string>>,
      entity: Entity
    ): HashMap.HashMap<string, HashSet.HashSet<string>> => {
      let updated = typeIndex
      for (const typeIri of entity.types) {
        const existing = HashMap.get(updated, typeIri)
        if (Option.isSome(existing)) {
          const newSet = HashSet.remove(existing.value, entity.id)
          if (HashSet.size(newSet) === 0) {
            updated = HashMap.remove(updated, typeIri)
          } else {
            updated = HashMap.set(updated, typeIri, newSet)
          }
        }
      }
      return updated
    }

    const service: EntityIndexService = {
      index: (graph) =>
        Effect.gen(function*() {
          if (graph.entities.length === 0) {
            return 0
          }

          // Compute embeddings for all entity mentions in batch
          const mentions = graph.entities.map((e) => e.mention)
          const embeddingVectors = yield* embedding.embedBatch(mentions)

          // Build index state
          let entities = HashMap.empty<string, Entity>()
          let embeddings = HashMap.empty<string, Embedding>()
          let typeIndex = HashMap.empty<string, HashSet.HashSet<string>>()

          for (let i = 0; i < graph.entities.length; i++) {
            const entity = graph.entities[i]
            entities = HashMap.set(entities, entity.id, entity)
            embeddings = HashMap.set(embeddings, entity.id, embeddingVectors[i])
            typeIndex = addToTypeIndex(typeIndex, entity)
          }

          yield* Ref.set(stateRef, { entities, embeddings, typeIndex })

          return graph.entities.length
        }),

      findSimilar: (query, k, options = {}) =>
        Effect.gen(function*() {
          const state = yield* Ref.get(stateRef)

          if (HashMap.size(state.entities) === 0) {
            return []
          }

          // Compute query embedding
          const queryEmbedding = yield* embedding.embed(query, "search_query")

          // Determine candidate entities
          let candidateIds: HashSet.HashSet<string>

          if (options.filterTypes && options.filterTypes.length > 0) {
            // Union of all entity IDs that have any of the filter types
            candidateIds = HashSet.empty()
            for (const typeIri of options.filterTypes) {
              const typeEntities = HashMap.get(state.typeIndex, typeIri)
              if (Option.isSome(typeEntities)) {
                candidateIds = HashSet.union(candidateIds, typeEntities.value)
              }
            }
          } else {
            // All entities
            candidateIds = HashSet.fromIterable(HashMap.keys(state.entities))
          }

          // Score all candidates
          const scored: Array<ScoredEntity> = []
          const minScore = options.minScore ?? 0

          for (const entityId of candidateIds) {
            const entity = HashMap.get(state.entities, entityId)
            const entityEmb = HashMap.get(state.embeddings, entityId)

            if (Option.isSome(entity) && Option.isSome(entityEmb)) {
              const score = cosineSimilarity(queryEmbedding, entityEmb.value)
              if (score >= minScore) {
                scored.push({ entity: entity.value, score })
              }
            }
          }

          // Sort by score descending and take top k
          scored.sort((a, b) => b.score - a.score)
          return scored.slice(0, k)
        }),

      findByType: (typeIri, limit) =>
        Effect.gen(function*() {
          const state = yield* Ref.get(stateRef)
          const entityIds = HashMap.get(state.typeIndex, typeIri)

          if (Option.isNone(entityIds)) {
            return []
          }

          const entities: Array<Entity> = []
          for (const entityId of entityIds.value) {
            if (limit !== undefined && entities.length >= limit) break
            const entity = HashMap.get(state.entities, entityId)
            if (Option.isSome(entity)) {
              entities.push(entity.value)
            }
          }

          return entities
        }),

      add: (entity) =>
        Effect.gen(function*() {
          // Compute embedding
          const entityEmbedding = yield* embedding.embed(entity.mention, "search_document")

          // Update state
          yield* Ref.update(stateRef, (state) => ({
            entities: HashMap.set(state.entities, entity.id, entity),
            embeddings: HashMap.set(state.embeddings, entity.id, entityEmbedding),
            typeIndex: addToTypeIndex(state.typeIndex, entity)
          }))
        }),

      remove: (entityId) =>
        Effect.gen(function*() {
          const state = yield* Ref.get(stateRef)
          const existing = HashMap.get(state.entities, entityId)

          if (Option.isNone(existing)) {
            return false
          }

          yield* Ref.update(stateRef, (s) => ({
            entities: HashMap.remove(s.entities, entityId),
            embeddings: HashMap.remove(s.embeddings, entityId),
            typeIndex: removeFromTypeIndex(s.typeIndex, existing.value)
          }))

          return true
        }),

      get: (entityId) =>
        Ref.get(stateRef).pipe(
          Effect.map((state) => HashMap.get(state.entities, entityId))
        ),

      clear: () => Ref.set(stateRef, emptyState),

      size: () => Ref.get(stateRef).pipe(Effect.map((state) => HashMap.size(state.entities)))
    }

    return service
  }),
}) {
    static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([EmbeddingServiceDefault]));
}

/**
 * In-memory EntityIndex layer (default)
 *
 * Requires EmbeddingService dependencies to be provided.
 *
 * @since 2.0.0
 * @category Layers
 */
export const EntityIndexDefault = EntityIndex.Default

/**
 * Serialized entity index format for GCS persistence
 *
 * @since 2.0.0
 * @category Types
 */
export interface SerializedEntityIndex {
  readonly version: 1
  readonly indexedAt: number
  readonly entities: ReadonlyArray<{
    readonly id: string
    readonly mention: string
    readonly types: ReadonlyArray<string>
    readonly attributes: Record<string, string | number | boolean>
    readonly embedding: ReadonlyArray<number>
  }>
}

/**
 * Extended EntityIndex interface with persistence capabilities
 *
 * @since 2.0.0
 * @category Service
 */
export interface PersistentEntityIndexService extends EntityIndexService {
  /**
   * Serialize the index to JSON format for persistence
   */
  readonly serialize: () => Effect.Effect<SerializedEntityIndex>

  /**
   * Load index state from serialized data
   * @returns Number of entities loaded
   */
  readonly deserialize: (data: SerializedEntityIndex) => Effect.Effect<number>

  /**
   * Persist current index state to GCS
   */
  readonly persist: () => Effect.Effect<void>

  /**
   * Load index from GCS
   * @returns Number of entities loaded, 0 if no persisted index found
   */
  readonly load: () => Effect.Effect<number>

  /**
   * Get index statistics
   */
  readonly stats: () => Effect.Effect<{
    readonly entityCount: number
    readonly typeCount: number
    readonly lastPersistedAt: Option.Option<number>
  }>
}

/**
 * PersistentEntityIndex service tag
 *
 * @since 2.0.0
 * @category Service
 */
export class PersistentEntityIndex extends Context.Service<PersistentEntityIndex, PersistentEntityIndexService>()($I`PersistentEntityIndex`) {}

/**
 * Create persistent EntityIndex with GCS backing
 *
 * @param storage - StorageService for GCS operations
 * @param indexPath - GCS path for index storage (e.g., "entity-index")
 *
 * @since 2.0.0
 * @category Layers
 */
export const makePersistentEntityIndex = (
  storage: StorageService,
  embedding: EmbeddingService,
  indexPath: string
): Effect.Effect<PersistentEntityIndexService> =>
  Effect.gen(function*() {
    // In-memory state
    const stateRef = yield* Ref.make<IndexState>(emptyState)
    const lastPersistedRef = yield* Ref.make<Option.Option<number>>(Option.none())

    /**
     * Add entity to type index
     */
    const addToTypeIndex = (
      typeIndex: HashMap.HashMap<string, HashSet.HashSet<string>>,
      entity: Entity
    ): HashMap.HashMap<string, HashSet.HashSet<string>> => {
      let updated = typeIndex
      for (const typeIri of entity.types) {
        const existing = HashMap.get(updated, typeIri)
        const set = Option.isSome(existing)
          ? HashSet.add(existing.value, entity.id)
          : HashSet.make(entity.id)
        updated = HashMap.set(updated, typeIri, set)
      }
      return updated
    }

    /**
     * Remove entity from type index
     */
    const removeFromTypeIndex = (
      typeIndex: HashMap.HashMap<string, HashSet.HashSet<string>>,
      entity: Entity
    ): HashMap.HashMap<string, HashSet.HashSet<string>> => {
      let updated = typeIndex
      for (const typeIri of entity.types) {
        const existing = HashMap.get(updated, typeIri)
        if (Option.isSome(existing)) {
          const newSet = HashSet.remove(existing.value, entity.id)
          if (HashSet.size(newSet) === 0) {
            updated = HashMap.remove(updated, typeIri)
          } else {
            updated = HashMap.set(updated, typeIri, newSet)
          }
        }
      }
      return updated
    }

    const service: PersistentEntityIndexService = {
      index: (graph) =>
        Effect.gen(function*() {
          if (graph.entities.length === 0) {
            return 0
          }

          // Compute embeddings for all entity mentions in batch
          const mentions = graph.entities.map((e) => e.mention)
          const embeddingVectors = yield* embedding.embedBatch(mentions)

          // Build index state
          let entities = HashMap.empty<string, Entity>()
          let embeddings = HashMap.empty<string, Embedding>()
          let typeIndex = HashMap.empty<string, HashSet.HashSet<string>>()

          for (let i = 0; i < graph.entities.length; i++) {
            const entity = graph.entities[i]
            entities = HashMap.set(entities, entity.id, entity)
            embeddings = HashMap.set(embeddings, entity.id, embeddingVectors[i])
            typeIndex = addToTypeIndex(typeIndex, entity)
          }

          yield* Ref.set(stateRef, { entities, embeddings, typeIndex })

          // Auto-persist after indexing (fire-and-forget)
          yield* Effect.forkDetach(service.persist())

          return graph.entities.length
        }),

      findSimilar: (query, k, options = {}) =>
        Effect.gen(function*() {
          const state = yield* Ref.get(stateRef)

          if (HashMap.size(state.entities) === 0) {
            return []
          }

          // Compute query embedding
          const queryEmbedding = yield* embedding.embed(query, "search_query")

          // Determine candidate entities
          let candidateIds: HashSet.HashSet<string>

          if (options.filterTypes && options.filterTypes.length > 0) {
            candidateIds = HashSet.empty()
            for (const typeIri of options.filterTypes) {
              const typeEntities = HashMap.get(state.typeIndex, typeIri)
              if (Option.isSome(typeEntities)) {
                candidateIds = HashSet.union(candidateIds, typeEntities.value)
              }
            }
          } else {
            candidateIds = HashSet.fromIterable(HashMap.keys(state.entities))
          }

          // Score all candidates
          const scored: Array<ScoredEntity> = []
          const minScore = options.minScore ?? 0

          for (const entityId of candidateIds) {
            const entity = HashMap.get(state.entities, entityId)
            const entityEmb = HashMap.get(state.embeddings, entityId)

            if (Option.isSome(entity) && Option.isSome(entityEmb)) {
              const score = cosineSimilarity(queryEmbedding, entityEmb.value)
              if (score >= minScore) {
                scored.push({ entity: entity.value, score })
              }
            }
          }

          scored.sort((a, b) => b.score - a.score)
          return scored.slice(0, k)
        }),

      findByType: (typeIri, limit) =>
        Effect.gen(function*() {
          const state = yield* Ref.get(stateRef)
          const entityIds = HashMap.get(state.typeIndex, typeIri)

          if (Option.isNone(entityIds)) {
            return []
          }

          const entities: Array<Entity> = []
          for (const entityId of entityIds.value) {
            if (limit !== undefined && entities.length >= limit) break
            const entity = HashMap.get(state.entities, entityId)
            if (Option.isSome(entity)) {
              entities.push(entity.value)
            }
          }

          return entities
        }),

      add: (entity) =>
        Effect.gen(function*() {
          const entityEmbedding = yield* embedding.embed(entity.mention, "search_document")

          yield* Ref.update(stateRef, (state) => ({
            entities: HashMap.set(state.entities, entity.id, entity),
            embeddings: HashMap.set(state.embeddings, entity.id, entityEmbedding),
            typeIndex: addToTypeIndex(state.typeIndex, entity)
          }))
        }),

      remove: (entityId) =>
        Effect.gen(function*() {
          const state = yield* Ref.get(stateRef)
          const existing = HashMap.get(state.entities, entityId)

          if (Option.isNone(existing)) {
            return false
          }

          yield* Ref.update(stateRef, (s) => ({
            entities: HashMap.remove(s.entities, entityId),
            embeddings: HashMap.remove(s.embeddings, entityId),
            typeIndex: removeFromTypeIndex(s.typeIndex, existing.value)
          }))

          return true
        }),

      get: (entityId) =>
        Ref.get(stateRef).pipe(
          Effect.map((state) => HashMap.get(state.entities, entityId))
        ),

      clear: () => Ref.set(stateRef, emptyState),

      size: () => Ref.get(stateRef).pipe(Effect.map((state) => HashMap.size(state.entities))),

      // Persistence methods
      serialize: () =>
        Effect.gen(function*() {
          const state = yield* Ref.get(stateRef)
          const entities: Array<SerializedEntityIndex["entities"][number]> = []

          for (const [id, entity] of state.entities) {
            const emb = HashMap.get(state.embeddings, id)
            if (Option.isSome(emb)) {
              entities.push({
                id: entity.id,
                mention: entity.mention,
                types: [...entity.types],
                attributes: { ...entity.attributes },
                embedding: Array.from(emb.value)
              })
            }
          }

          return {
            version: 1 as const,
            indexedAt: Date.now(),
            entities
          }
        }),

      deserialize: (data) =>
        Effect.gen(function*() {
          if (data.version !== 1) {
            yield* Effect.logWarning("Unknown entity index version", { version: data.version })
            return 0
          }

          let entities = HashMap.empty<string, Entity>()
          let embeddings = HashMap.empty<string, Embedding>()
          let typeIndex = HashMap.empty<string, HashSet.HashSet<string>>()

          // Import Entity class for reconstruction
          const { Entity: EntityClass } = yield* Effect.promise(() => import("../Domain/Model/Entity.ts"))

          for (const entry of data.entities) {
            const entity = EntityClass.make({
              id: entry.id as Entity["id"],
              mention: entry.mention,
              types: entry.types,
              attributes: entry.attributes
            })
            entities = HashMap.set(entities, entity.id, entity)
            embeddings = HashMap.set(embeddings, entity.id, entry.embedding)
            typeIndex = addToTypeIndex(typeIndex, entity)
          }

          yield* Ref.set(stateRef, { entities, embeddings, typeIndex })
          return data.entities.length
        }),

      persist: () =>
        Effect.gen(function*() {
          const serialized = yield* service.serialize()
          const blobPath = `${indexPath}/current.json`

          yield* storage.set(blobPath, JSON.stringify(serialized)).pipe(
            Effect.tap(() => Ref.set(lastPersistedRef, Option.some(Date.now()))),
            Effect.tap(() =>
              Effect.logInfo("EntityIndex persisted to GCS", {
                path: blobPath,
                entityCount: serialized.entities.length
              })
            ),
            Effect.catch((error) => Effect.logWarning("Failed to persist EntityIndex", { error: String(error) }))
          )
        }),

      load: () =>
        Effect.gen(function*() {
          const blobPath = `${indexPath}/current.json`

          const content = yield* storage.get(blobPath).pipe(
            Effect.catch(() => Effect.succeed(Option.none<string>()))
          )

          if (Option.isNone(content)) {
            yield* Effect.logDebug("No persisted EntityIndex found", { path: blobPath })
            return 0
          }

          try {
            const data: SerializedEntityIndex = JSON.parse(content.value)
            const loaded = yield* service.deserialize(data)
            yield* Effect.logInfo("EntityIndex loaded from GCS", {
              path: blobPath,
              entityCount: loaded,
              indexedAt: new Date(data.indexedAt).toISOString()
            })
            return loaded
          } catch (e) {
            yield* Effect.logWarning("Failed to parse persisted EntityIndex", {
              path: blobPath,
              error: String(e)
            })
            return 0
          }
        }),

      stats:
        Effect.fn(function*() {
          const state = yield* Ref.get(stateRef)
          const lastPersisted = yield* Ref.get(lastPersistedRef)
          return {
            entityCount: HashMap.size(state.entities),
            typeCount: HashMap.size(state.typeIndex),
            lastPersistedAt: lastPersisted
          }
        })
    }

    return service
  })

/**
 * Layer that provides PersistentEntityIndex when EMBEDDING_ENTITY_INDEX_PATH is configured.
 *
 * For the base EntityIndex service, continue using EntityIndex.Default which provides
 * the standard in-memory implementation. When persistence is needed, also include
 * PersistentEntityIndexLayer and use Effect.serviceOption to access it.
 *
 * Dependencies:
 * - ConfigService (for embedding.entityIndexPath)
 * - StorageService (for GCS persistence when entityIndexPath is set)
 * - EmbeddingService (for computing embeddings)
 *
 * @since 2.0.0
 * @category Layers
 */
export const PersistentEntityIndexLayer: Layer.Layer<
  PersistentEntityIndex,
  never,
  ConfigService | StorageService | EmbeddingService
> = Layer.effect(
  PersistentEntityIndex,
  Effect.gen(function*() {
    const config = yield* ConfigService
    const storage = yield* StorageService
    const embeddingSvc = yield* EmbeddingService

    const indexPath = Option.getOrUndefined(config.embedding.entityIndexPath)

    if (!indexPath) {
      // No persistence path configured - return stub that logs but does nothing
      yield* Effect.logDebug("PersistentEntityIndex: disabled (no EMBEDDING_ENTITY_INDEX_PATH set)")

      // Return a minimal stub implementation
      const stubService: PersistentEntityIndexService = {
        index: () => Effect.succeed(0),
        findSimilar: () => Effect.succeed([]),
        findByType: () => Effect.succeed([]),
        add: () => Effect.void,
        remove: () => Effect.succeed(false),
        get: () => Effect.succeed(Option.none()),
        clear: () => Effect.void,
        size: () => Effect.succeed(0),
        serialize: () => Effect.succeed({ version: 1 as const, indexedAt: Date.now(), entities: [] }),
        deserialize: () => Effect.succeed(0),
        persist: () => Effect.void,
        load: () => Effect.succeed(0),
        stats: () => Effect.succeed({ entityCount: 0, typeCount: 0, lastPersistedAt: Option.none() })
      }
      return stubService
    }

    // Persistence enabled
    yield* Effect.logInfo("PersistentEntityIndex: GCS-backed persistence enabled", { indexPath })
    return yield* makePersistentEntityIndex(storage, embeddingSvc, indexPath)
  })
)
