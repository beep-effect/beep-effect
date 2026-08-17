/**
 * Service: Entity Index
 *
 * **Details**
 *
 * Indexed embedding store for fast entity retrieval in GraphRAG.
 * Supports k-NN search by embedding similarity and type-based filtering.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt } from "@beep/schema/Int";
import { EpochMillis } from "@beep/schema/Timestamp";
import { Clock, Context, Effect, HashMap, HashSet, Inspectable, Layer, Order, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import type { KnowledgeGraph } from "../Domain/Model/Entity.ts";
import { Entity } from "../Domain/Model/Entity.ts";
import type { EmbeddingServiceMethods } from "./Embedding.ts";
import { EmbeddingService, EmbeddingServiceDefault } from "./Embedding.ts";
import type { Embedding } from "./EmbeddingCache.ts";

// =============================================================================
// Persistent EntityIndex
// =============================================================================
const $I = $ScratchpadId.create("effect-ontology/Service/EntityIndex");

import { $ScratchpadId } from "@beep/identity";
import { dual2, dual3 } from "../Utils/Dual.ts";
import { ConfigService } from "./Config.ts";
import type { StorageServiceMethods } from "./Storage.ts";
import { StorageService } from "./Storage.ts";

/**
 * Scored entity result from similarity search
 *
 *
 * **Example** (Use the ScoredEntity contract)
 *
 * ```ts
 * import type { ScoredEntity } from "@effect-ontology/Service/EntityIndex"
 *
 * const acceptsScoredEntity = (_value: ScoredEntity): void => undefined
 *
 * console.log(acceptsScoredEntity)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ScoredEntity {
  readonly entity: Entity;
  readonly score: number;
}

/**
 * Options for similarity search
 *
 *
 * **Example** (Use the FindSimilarOptions contract)
 *
 * ```ts
 * import type { FindSimilarOptions } from "@effect-ontology/Service/EntityIndex"
 *
 * const acceptsFindSimilarOptions = (_value: FindSimilarOptions): void => undefined
 *
 * console.log(acceptsFindSimilarOptions)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface FindSimilarOptions {
  /** Filter to only entities with any of these types */
  readonly filterTypes?: ReadonlyArray<string>;
  /** Minimum similarity score threshold (0-1) */
  readonly minScore?: number;
}

/**
 * Internal index state
 */
interface IndexState {
  /** Entity storage: id -> Entity */
  readonly entities: HashMap.HashMap<string, Entity>;
  /** Embedding storage: id -> embedding vector */
  readonly embeddings: HashMap.HashMap<string, Embedding>;
  /** Type index: typeIri -> HashSet<entityId> */
  readonly typeIndex: HashMap.HashMap<string, HashSet.HashSet<string>>;
}

const emptyState: IndexState = {
  entities: HashMap.empty(),
  embeddings: HashMap.empty(),
  typeIndex: HashMap.empty(),
};

/**
 * EntityIndex service interface
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export interface EntityIndexService {
  /**
   * Index all entities from a knowledge graph
   * Computes embeddings for all entity mentions
   */
  readonly index: (graph: KnowledgeGraph) => Effect.Effect<number, AnyEmbeddingError>;

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
  ) => Effect.Effect<ReadonlyArray<ScoredEntity>, AnyEmbeddingError>;

  /**
   * Find entities by type IRI
   *
   * @param typeIri - Full type IRI to match
   * @param limit - Maximum results (default: all)
   */
  readonly findByType: (typeIri: string, limit?: number) => Effect.Effect<ReadonlyArray<Entity>>;

  /**
   * Add a single entity to the index (incremental update)
   */
  readonly add: (entity: Entity) => Effect.Effect<void, AnyEmbeddingError>;

  /**
   * Remove an entity from the index
   */
  readonly remove: (entityId: string) => Effect.Effect<boolean>;

  /**
   * Get an entity by ID
   */
  readonly get: (entityId: string) => Effect.Effect<O.Option<Entity>>;

  /**
   * Clear the entire index
   */
  readonly clear: Effect.Effect<void>;

  /**
   * Get current index size (number of entities)
   */
  readonly size: Effect.Effect<number>;
}

/**
 * Cosine similarity between two vectors
 *
 * **Example** (Inspect cosine similarity)
 *
 * ```ts
 * import { cosineSimilarity } from "@effect-ontology/Service/EntityIndex"
 *
 * console.log(cosineSimilarity)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const cosineSimilarity = dual2((a: Embedding, b: Embedding): number => {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
});

const addToTypeIndex = (
  typeIndex: HashMap.HashMap<string, HashSet.HashSet<string>>,
  entity: Entity
): HashMap.HashMap<string, HashSet.HashSet<string>> => {
  let updated = typeIndex;
  for (const typeIri of entity.types) {
    const existing = HashMap.get(updated, typeIri);
    updated = HashMap.set(
      updated,
      typeIri,
      O.isSome(existing) ? HashSet.add(existing.value, entity.id) : HashSet.make(entity.id)
    );
  }
  return updated;
};

const removeFromTypeIndex = (
  typeIndex: HashMap.HashMap<string, HashSet.HashSet<string>>,
  entity: Entity
): HashMap.HashMap<string, HashSet.HashSet<string>> => {
  let updated = typeIndex;
  for (const typeIri of entity.types) {
    const existing = HashMap.get(updated, typeIri);
    if (O.isSome(existing)) {
      const remaining = HashSet.remove(existing.value, entity.id);
      updated =
        HashSet.size(remaining) === 0 ? HashMap.remove(updated, typeIri) : HashMap.set(updated, typeIri, remaining);
    }
  }
  return updated;
};

const makeEntityIndexMethods = (
  embedding: EmbeddingServiceMethods,
  stateRef: Ref.Ref<IndexState>
): EntityIndexService => ({
  index: Effect.fn("EntityIndex.index")(function* (graph: KnowledgeGraph) {
    if (graph.entities.length === 0) return 0;
    const embeddingVectors = yield* embedding.embedBatch(A.map(graph.entities, (entity) => entity.mention));
    let entities = HashMap.empty<string, Entity>();
    let embeddings = HashMap.empty<string, Embedding>();
    let typeIndex = HashMap.empty<string, HashSet.HashSet<string>>();
    for (const [entity, vector] of A.zip(graph.entities, embeddingVectors)) {
      entities = HashMap.set(entities, entity.id, entity);
      embeddings = HashMap.set(embeddings, entity.id, vector);
      typeIndex = addToTypeIndex(typeIndex, entity);
    }
    yield* Ref.set(stateRef, { entities, embeddings, typeIndex });
    return graph.entities.length;
  }),
  findSimilar: Effect.fn("EntityIndex.findSimilar")(function* (
    query: string,
    k: number,
    options: FindSimilarOptions = {}
  ) {
    const state = yield* Ref.get(stateRef);
    if (HashMap.size(state.entities) === 0) return [];
    const queryEmbedding = yield* embedding.embed(query, "search_query");
    let candidateIds = HashSet.empty<string>();
    const filterTypes = O.flatMap(
      O.fromUndefinedOr(options.filterTypes),
      A.match({ onEmpty: O.none, onNonEmpty: O.some })
    );
    if (O.isSome(filterTypes)) {
      for (const typeIri of filterTypes.value) {
        const typeEntities = HashMap.get(state.typeIndex, typeIri);
        if (O.isSome(typeEntities)) candidateIds = HashSet.union(candidateIds, typeEntities.value);
      }
    } else {
      candidateIds = HashSet.fromIterable(HashMap.keys(state.entities));
    }
    const scored: Array<ScoredEntity> = [];
    const minScore = options.minScore ?? 0;
    for (const entityId of candidateIds) {
      const entity = HashMap.get(state.entities, entityId);
      const entityEmbedding = HashMap.get(state.embeddings, entityId);
      if (O.isSome(entity) && O.isSome(entityEmbedding)) {
        const score = cosineSimilarity(queryEmbedding, entityEmbedding.value);
        if (score >= minScore) scored.push({ entity: entity.value, score });
      }
    }
    return A.take(
      A.sort(
        scored,
        Order.mapInput(Order.flip(Order.Number), (item: ScoredEntity) => item.score)
      ),
      k
    );
  }),
  findByType: Effect.fn("EntityIndex.findByType")(function* (typeIri: string, limit?: number) {
    const state = yield* Ref.get(stateRef);
    const entityIds = HashMap.get(state.typeIndex, typeIri);
    if (O.isNone(entityIds)) return [];
    const entities: Array<Entity> = [];
    for (const entityId of entityIds.value) {
      if (P.isNotUndefined(limit) && entities.length >= limit) break;
      const entity = HashMap.get(state.entities, entityId);
      if (O.isSome(entity)) entities.push(entity.value);
    }
    return entities;
  }),
  add: Effect.fn("EntityIndex.add")(function* (entity: Entity) {
    const vector = yield* embedding.embed(entity.mention, "search_document");
    yield* Ref.update(stateRef, (state) => ({
      entities: HashMap.set(state.entities, entity.id, entity),
      embeddings: HashMap.set(state.embeddings, entity.id, vector),
      typeIndex: addToTypeIndex(state.typeIndex, entity),
    }));
  }),
  remove: Effect.fn("EntityIndex.remove")(function* (entityId: string) {
    const state = yield* Ref.get(stateRef);
    const existing = HashMap.get(state.entities, entityId);
    if (O.isNone(existing)) return false;
    yield* Ref.set(stateRef, {
      entities: HashMap.remove(state.entities, entityId),
      embeddings: HashMap.remove(state.embeddings, entityId),
      typeIndex: removeFromTypeIndex(state.typeIndex, existing.value),
    });
    return true;
  }),
  get: (entityId: string) => Ref.get(stateRef).pipe(Effect.map((state) => HashMap.get(state.entities, entityId))),
  clear: Ref.set(stateRef, emptyState),
  size: Ref.get(stateRef).pipe(Effect.map((state) => HashMap.size(state.entities))),
});

/**
 * EntityIndex - In-memory entity index with embedding-based retrieval
 *
 * **Example** (Inspect entity index)
 *
 * ```ts
 * import { EntityIndex } from "@effect-ontology/Service/EntityIndex"
 *
 * console.log(EntityIndex)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class EntityIndex extends Context.Service<EntityIndex>()($I`EntityIndex`, {
  make: Effect.gen(function* () {
    const embedding = yield* EmbeddingService;
    const stateRef = yield* Ref.make<IndexState>(emptyState);

    return makeEntityIndexMethods(embedding, stateRef);
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([EmbeddingServiceDefault]));
}

/**
 * In-memory EntityIndex layer (default)
 *
 * **Details**
 *
 * Requires EmbeddingService dependencies to be provided.
 *
 * **Example** (Inspect entity index default)
 *
 * ```ts
 * import { EntityIndexDefault } from "@effect-ontology/Service/EntityIndex"
 *
 * console.log(EntityIndexDefault)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EntityIndexDefault = EntityIndex.Default;

/**
 * Serialized entity index format for GCS persistence
 *
 * **Example** (Validate serialized entity index)
 *
 * ```ts
 * import { SerializedEntityIndex } from "@effect-ontology/Service/EntityIndex"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SerializedEntityIndex)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SerializedEntityIndex = S.Struct({
  version: S.Literal(1),
  indexedAt: EpochMillis,
  entities: S.Array(
    S.Struct({
      id: S.String,
      mention: S.String,
      types: S.Array(S.String),
      attributes: S.Record(S.String, S.Union([S.String, S.Finite, S.Boolean])),
      embedding: S.Array(S.Finite),
    })
  ),
});

/**
 * Describes the serialized entity index data exposed by this module.
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export type SerializedEntityIndex = typeof SerializedEntityIndex.Type;

const SerializedEntityIndexJson = S.fromJsonString(SerializedEntityIndex);
const encodeSerializedEntityIndex = S.encodeEffect(SerializedEntityIndexJson);
const decodeSerializedEntityIndex = S.decodeOption(SerializedEntityIndexJson);

/**
 * Extended EntityIndex interface with persistence capabilities
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export interface PersistentEntityIndexService extends EntityIndexService {
  /**
   * Serialize the index to JSON format for persistence
   */
  readonly serialize: Effect.Effect<SerializedEntityIndex>;

  /**
   * Load index state from serialized data
   * @returns Number of entities loaded
   */
  readonly deserialize: (data: SerializedEntityIndex) => Effect.Effect<number>;

  /**
   * Persist current index state to GCS
   */
  readonly persist: Effect.Effect<void>;

  /**
   * Load index from GCS
   * @returns Number of entities loaded, 0 if no persisted index found
   */
  readonly load: Effect.Effect<number, Effect.Error<ReturnType<StorageServiceMethods["getOption"]>>>;

  /**
   * Get index statistics
   */
  readonly stats: Effect.Effect<{
    readonly entityCount: NonNegativeInt;
    readonly typeCount: NonNegativeInt;
    readonly lastPersistedAt: O.Option<EpochMillis>;
  }>;
}

/**
 * PersistentEntityIndex service tag
 *
 * **Example** (Inspect persistent entity index)
 *
 * ```ts
 * import { PersistentEntityIndex } from "@effect-ontology/Service/EntityIndex"
 *
 * console.log(PersistentEntityIndex)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PersistentEntityIndex extends Context.Service<PersistentEntityIndex, PersistentEntityIndexService>()(
  $I`PersistentEntityIndex`
) {}

/**
 * Create persistent EntityIndex with GCS backing
 *
 * **Example** (Inspect make persistent entity index)
 *
 * ```ts
 * import { makePersistentEntityIndex } from "@effect-ontology/Service/EntityIndex"
 *
 * console.log(makePersistentEntityIndex)
 * ```
 *
 * @param storage - StorageService for GCS operations
 * @param indexPath - GCS path for index storage (e.g., "entity-index")
 * @category constructors
 * @since 0.0.0
 */
export const makePersistentEntityIndex = dual3(
  (
    storage: StorageServiceMethods,
    embedding: EmbeddingServiceMethods,
    indexPath: string
  ): Effect.Effect<PersistentEntityIndexService> =>
    Effect.gen(function* () {
      // In-memory state
      const stateRef = yield* Ref.make<IndexState>(emptyState);
      const lastPersistedRef = yield* Ref.make<O.Option<EpochMillis>>(O.none());

      const base = makeEntityIndexMethods(embedding, stateRef);

      const serialize: Effect.Effect<SerializedEntityIndex> = Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        const entities: Array<SerializedEntityIndex["entities"][number]> = [];
        for (const [id, entity] of state.entities) {
          const vector = HashMap.get(state.embeddings, id);
          if (O.isSome(vector)) {
            entities.push({
              id: entity.id,
              mention: entity.mention,
              types: entity.types,
              attributes: entity.attributes,
              embedding: vector.value,
            });
          }
        }
        return { version: 1, indexedAt: EpochMillis.make(yield* Clock.currentTimeMillis), entities };
      });

      const deserialize = Effect.fn("PersistentEntityIndex.deserialize")(function* (data: SerializedEntityIndex) {
        let entities = HashMap.empty<string, Entity>();
        let embeddings = HashMap.empty<string, Embedding>();
        let typeIndex = HashMap.empty<string, HashSet.HashSet<string>>();
        for (const entry of data.entities) {
          const entity = Entity.decodeOption(entry);
          if (O.isNone(entity)) continue;
          entities = HashMap.set(entities, entity.value.id, entity.value);
          embeddings = HashMap.set(embeddings, entity.value.id, entry.embedding);
          typeIndex = addToTypeIndex(typeIndex, entity.value);
        }
        yield* Ref.set(stateRef, { entities, embeddings, typeIndex });
        return HashMap.size(entities);
      });

      const persist = Effect.gen(function* () {
        const serialized = yield* serialize;
        const blobPath = `${indexPath}/current.json`;
        const content = yield* encodeSerializedEntityIndex(serialized).pipe(Effect.orDie);
        yield* storage.set(blobPath, content).pipe(
          Effect.tap(() =>
            Clock.currentTimeMillis.pipe(
              Effect.flatMap((now) => Ref.set(lastPersistedRef, O.some(EpochMillis.make(now))))
            )
          ),
          Effect.tap(() =>
            Effect.logInfo("EntityIndex persisted", { path: blobPath, entityCount: serialized.entities.length })
          ),
          Effect.catch((error) =>
            Effect.logWarning("Failed to persist EntityIndex", { error: Inspectable.toStringUnknown(error) })
          )
        );
      });

      const load = Effect.gen(function* () {
        const blobPath = `${indexPath}/current.json`;
        const content = yield* storage.getOption(blobPath);
        if (O.isNone(content)) return 0;
        const decoded = decodeSerializedEntityIndex(content.value);
        if (O.isNone(decoded)) {
          yield* Effect.logWarning("Failed to decode persisted EntityIndex", { path: blobPath });
          return 0;
        }
        const loaded = yield* deserialize(decoded.value);
        yield* Effect.logInfo("EntityIndex loaded", { path: blobPath, entityCount: loaded });
        return loaded;
      });

      const stats = Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        const lastPersistedAt = yield* Ref.get(lastPersistedRef);
        return {
          entityCount: NonNegativeInt.make(HashMap.size(state.entities)),
          typeCount: NonNegativeInt.make(HashMap.size(state.typeIndex)),
          lastPersistedAt,
        };
      });

      const service: PersistentEntityIndexService = {
        ...base,
        index: Effect.fn("PersistentEntityIndex.index")(function* (graph: KnowledgeGraph) {
          const count = yield* base.index(graph);
          yield* persist;
          return count;
        }),
        serialize,
        deserialize,
        persist,
        load,
        stats,
      };
      return service;
    })
);

/**
 * Layer that provides PersistentEntityIndex when EMBEDDING_ENTITY_INDEX_PATH is configured.
 *
 * **Details**
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
 * **Example** (Inspect persistent entity index layer)
 *
 * ```ts
 * import { PersistentEntityIndexLayer } from "@effect-ontology/Service/EntityIndex"
 *
 * console.log(PersistentEntityIndexLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PersistentEntityIndexLayer: Layer.Layer<
  PersistentEntityIndex,
  never,
  ConfigService | StorageService | EmbeddingService
> = Layer.effect(
  PersistentEntityIndex,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const storage = yield* StorageService;
    const embeddingSvc = yield* EmbeddingService;

    if (O.isNone(config.embedding.entityIndexPath)) {
      // No persistence path configured - return stub that logs but does nothing
      yield* Effect.logDebug("PersistentEntityIndex: disabled (no EMBEDDING_ENTITY_INDEX_PATH set)");

      // Return a minimal stub implementation
      const stubService: PersistentEntityIndexService = {
        index: () => Effect.succeed(0),
        findSimilar: () => Effect.succeed([]),
        findByType: () => Effect.succeed([]),
        add: () => Effect.void,
        remove: () => Effect.succeed(false),
        get: () => Effect.succeed(O.none()),
        clear: Effect.void,
        size: Effect.succeed(0),
        serialize: Effect.gen(function* () {
          return {
            version: 1,
            indexedAt: EpochMillis.make(yield* Clock.currentTimeMillis),
            entities: [],
          };
        }),
        deserialize: () => Effect.succeed(0),
        persist: Effect.void,
        load: Effect.succeed(0),
        stats: Effect.succeed({
          entityCount: NonNegativeInt.make(0),
          typeCount: NonNegativeInt.make(0),
          lastPersistedAt: O.none(),
        }),
      };
      return stubService;
    }

    // Persistence enabled
    const indexPath = config.embedding.entityIndexPath.value;
    yield* Effect.logInfo("PersistentEntityIndex: GCS-backed persistence enabled", { indexPath });
    return yield* makePersistentEntityIndex(storage, embeddingSvc, indexPath);
  })
);
