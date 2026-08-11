/**
 * Durable Workflow Activities
 *
 * Effect-native durable activities using @effect/workflow's Activity.make.
 * These activities are journaled by the WorkflowEngine for crash recovery.
 *
 * Architecture:
 * - Activity.make creates activities that integrate with WorkflowEngine
 * - Activities are automatically retried and journaled
 * - Each activity has typed success/error schemas for serialization
 *
 * Note: These activities require WorkflowEngine and WorkflowInstance context.
 * For standalone execution (e.g., ActivityRunner), use Activities.ts instead.
 *
 * @since 2.0.0
 */

import { LanguageModel } from "effect/unstable/ai"
import { Activity } from "effect/unstable/workflow"
import { Chunk, DateTime, Duration, Effect, Option, Schedule, Schema } from "effect"
import * as A from "effect/Array"
import * as N3 from "n3"
import { ActivityError, notFoundError, toActivityError } from "../Domain/Error/Activity.ts"
import { type BatchId, ContentHash, GcsUri } from "../Domain/Identity.ts"
import { Entity, KnowledgeGraph, Relation, RelationObject } from "../Domain/Model/Entity.ts"
import { EntityResolutionConfig } from "../Domain/Model/EntityResolution.ts"
import {
  ElementEmbedding,
  OntologyEmbeddings,
  OntologyEmbeddingsJson
} from "../Domain/Model/OntologyEmbeddings.ts"
import { EntityId, IRI } from "../Domain/Model/shared.ts"
import { PathLayout } from "../Domain/PathLayout.ts"
import { CLAIMS, PROV, RDF, RDFS } from "../Domain/Rdf/Constants.ts"
import type {
  IngestionActivityInput,
  ResolutionActivityInput,
  ValidationActivityInput
} from "../Domain/Schema/Batch.ts"
import { BatchManifest, ValidationActivityOutput } from "../Domain/Schema/Batch.ts"
import type { EnrichedManifest, PreprocessingActivityInput } from "../Domain/Schema/DocumentMetadata.ts"
import { ChunkingStrategy, DocumentMetadata, LanguageCode } from "../Domain/Schema/DocumentMetadata.ts"
import { ClaimPersistenceService } from "../Service/ClaimPersistence.ts"
import { ConfigService } from "../Service/Config.ts"
import { CrossBatchEntityResolver, CrossBatchResolverConfig } from "../Service/CrossBatchEntityResolver.ts"
import { EmbeddingService } from "../Service/Embedding.ts"
import { EntityResolutionService } from "../Service/EntityResolution.ts"
import { StageTimeoutService } from "../Service/LlmControl/StageTimeout.ts"
import { generateObjectWithRetry } from "../Service/LlmWithRetry.ts"
import { parseOntologyFromStore } from "../Service/Ontology.ts"
import { RdfBuilder, type RdfStore } from "../Service/Rdf.ts"
import { Reasoner, ReasoningConfig } from "../Service/Reasoner.ts"
import { ShaclService } from "../Service/Shacl.ts"
import type { ShaclViolation } from "../Service/Shacl.ts"
import { GenerationMismatchError, StorageService } from "../Service/Storage.ts"
import { LlmAttributes } from "../Telemetry/LlmAttributes.ts"
import { knowledgeGraphToClaims } from "../Utils/ClaimFactory.ts"
import { extractLocalNameFromIri } from "../Utils/Iri.ts"
import { computeQuadDelta } from "../Utils/QuadDelta.ts"
import { SchemaUtils } from "@beep/schema";
import * as O from "effect/Option";
import { NonNegativeInt } from "@beep/schema/Int";
import { UnitInterval } from "@beep/schema/UnitInterval";

// -----------------------------------------------------------------------------
// Output Schemas (must be serializable for journaling)
// -----------------------------------------------------------------------------

export const ResolutionOutput = Schema.Struct({
  resolvedUri: GcsUri,
  /** Total entities before resolution */
  entitiesTotal: Schema.Number,
  /** Number of clusters formed (resolved entities) */
  clustersFormed: Schema.Number,
  /** Total relations in merged graph */
  relationsTotal: Schema.Number,
  /** Compression ratio: 1 - (clustersFormed / entitiesTotal) */
  compressionRatio: Schema.Number,
  /** Maps canonical entity ID to source document URIs */
  provenanceMap: Schema.Record(Schema.String, Schema.Array(Schema.String)),
  durationMs: Schema.Number
})

export const ValidationOutput = ValidationActivityOutput

export const IngestionOutput = Schema.Struct({
  canonicalUri: GcsUri,
  triplesIngested: Schema.Number,
  durationMs: Schema.Number
})

export const ClaimPersistenceOutput = Schema.Struct({
  /** Total claims persisted across all documents */
  claimsPersisted: Schema.Number,
  /** Number of documents processed */
  documentsProcessed: Schema.Number,
  /** Number of documents that failed claim persistence */
  documentsFailed: Schema.Number,
  durationMs: Schema.Number
})

export const CrossBatchResolutionOutput = Schema.Struct({
  /** Total entities processed */
  entitiesTotal: Schema.Number,
  /** Entities matched to existing canonical entities */
  matchedToExisting: Schema.Number,
  /** New canonical entities created */
  newCanonicals: Schema.Number,
  /** Candidates evaluated during blocking */
  candidatesEvaluated: Schema.Number,
  durationMs: Schema.Number
})

export interface CrossBatchResolutionInput {
  readonly batchId: string
  /** Path to the resolved graph from within-batch resolution */
  readonly resolvedGraphUri: string
  /** Whether to enable cross-batch resolution */
  readonly enabled: boolean
  /** Ontology scope for entity resolution */
  readonly ontologyId: string
}

// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------

const stripGsPrefix = (uri: string): string => uri.startsWith("gs://") ? uri.replace(/^gs:\/\/[^/]+\//, "") : uri

const requireContent = (opt: Option.Option<string>, key: string) =>
  Option.match(opt, {
    onNone: () => Effect.fail(notFoundError("StorageObject", key)),
    onSome: (value) => Effect.succeed(value)
  })

const summarizeViolations = (violations: ReadonlyArray<ShaclViolation>) => {
  const grouped = new Map<string, { count: number; sampleMessages: Array<string> }>()

  for (const violation of violations) {
    const entry = grouped.get(violation.severity) ?? { count: 0, sampleMessages: [] }
    entry.count += 1
    if (entry.sampleMessages.length < 3 && violation.message) {
      entry.sampleMessages.push(violation.message)
    }
    grouped.set(violation.severity, entry)
  }

  return Array.from(grouped.entries()).map(([severity, info]) => ({
    severity,
    count: info.count,
    sampleMessages: info.sampleMessages
  }))
}

const resolveBucket = (config: { storage: { bucket: Option.Option<string> } }) =>
  Option.getOrElse(config.storage.bucket, () => "local-bucket")

/**
 * Parse Turtle to stats (entity/triple count)
 */
const parseTurtleStats = (turtle: string) =>
  Effect.gen(function*() {
    const rdf = yield* RdfBuilder
    const store = yield* rdf.parseTurtle(turtle)
    const typeQuads = yield* rdf.queryStore(store, {
      predicate: RDF.type
    })
    const allQuads = yield* rdf.queryStore(store, {})
    return {
      entityCount: typeQuads.length,
      tripleCount: allQuads.length
    }
  })

/**
 * Extract minimal KnowledgeGraph from an RDF store
 *
 * Reconstructs Entity objects from RDF quads:
 * - Entity ID from subject IRI local name
 * - mention from rdfs:label
 * - types from rdf:type
 * - Relations from triples where both subject and object are entities
 */
const storeToKnowledgeGraph = (store: RdfStore) =>
  Effect.gen(function*() {
    const rdf = yield* RdfBuilder

    // Get all type quads to find entities
    const typeQuads = yield* rdf.queryStore(store, { predicate: RDF.type })

    // Get all label quads
    const labelQuads = yield* rdf.queryStore(store, { predicate: RDFS.label })

    // Build entity ID -> types map
    const entityTypes = new Map<string, Array<string>>()
    const entityIris = new Set<string>()

    for (const quad of typeQuads) {
      const subjectIri = quad.subject as string
      // Skip blank nodes and non-instance types (owl:Class, etc.)
      if (subjectIri.startsWith("_:")) continue

      const typeIri = quad.object as string
      if (typeof typeIri !== "string") continue

      // Skip OWL/RDFS meta-types
      if (typeIri.includes("owl#") || typeIri.includes("rdf-schema#")) continue

      // Skip claims (they are not entities - they're reified statements)
      if (subjectIri.startsWith(CLAIMS.namespace)) continue
      if (typeIri.startsWith(CLAIMS.namespace)) continue

      entityIris.add(subjectIri)
      const types = entityTypes.get(subjectIri) ?? []
      types.push(typeIri)
      entityTypes.set(subjectIri, types)
    }

    // Build entity ID -> label map
    const entityLabels = new Map<string, string>()
    for (const quad of labelQuads) {
      const subjectIri = quad.subject as string
      if (entityIris.has(subjectIri)) {
        const label = typeof quad.object === "string"
          ? quad.object
          : (quad.object as { value: string }).value
        entityLabels.set(subjectIri, label)
      }
    }

    // Create Entity objects
    const entities: Array<Entity> = []
    for (const iri of entityIris) {
      const types = entityTypes.get(iri) ?? []
      if (!A.isReadonlyArrayNonEmpty(types)) continue

      const localName = extractLocalNameFromIri(iri)
      const mention = entityLabels.get(iri) ?? localName

      entities.push(
        Entity.make({
          id: EntityId.make(localName),
          mention,
          types: A.map(types, IRI.fromUnknown),
          attributes: {}
        })
      )
    }

    // Extract relations (triples where both subject and object are known entities)
    const entityIdSet = new Set(entities.map((e) => e.id))
    const allQuads = yield* rdf.queryStore(store, {})
    const relations: Array<Relation> = []

    for (const quad of allQuads) {
      const subjectIri = quad.subject as string
      const subjectLocalName = extractLocalNameFromIri(subjectIri)
      const subjectId = EntityId.make(subjectLocalName)

      // Skip if subject is not an entity
      if (!entityIdSet.has(subjectId)) continue

      // Skip rdf:type and rdfs:label (already processed)
      const predicate = quad.predicate as string
      if (predicate === RDF.type || predicate === RDFS.label) continue

      // Check if object is an entity reference
      const objectValue = quad.object
      if (typeof objectValue === "string" && !objectValue.startsWith("_:")) {
        const objectLocalName = extractLocalNameFromIri(objectValue)
        const objectId = EntityId.make(objectLocalName)
        if (entityIdSet.has(objectId)) {
          relations.push(
            Relation.make({
              subjectId,
              predicate: IRI.fromUnknown(predicate),
              object: RelationObject.cases.EntityReference.make({ value: objectId })
            })
          )
        }
      }
    }

    return KnowledgeGraph.make({
      entities,
      relations
    })
  })

// -----------------------------------------------------------------------------
// Retry Policy for Activities
// -----------------------------------------------------------------------------

/**
 * Default retry policy for activities
 * - Exponential backoff starting at 1 second
 * - Max 3 attempts
 * - Jitter to prevent thundering herd
 */
const activityRetryPolicy = Schedule.max([
  Schedule.exponential("1 second"),
  Schedule.recurs(3)
]).pipe(Schedule.jittered)

// -----------------------------------------------------------------------------
// Durable Activities
// -----------------------------------------------------------------------------

/**
 * Durable Resolution Activity
 *
 * Merges multiple document graphs and performs entity resolution.
 * Uses EntityResolutionService for proper clustering across documents.
 * Journaled by WorkflowEngine for crash recovery.
 *
 * Pipeline:
 * 1. Load all document Turtle files from storage
 * 2. Parse each Turtle into RdfStore, extract KnowledgeGraphs
 * 3. Call EntityResolutionService.resolve() to cluster similar entities
 * 4. Rewrite entity IRIs to use canonical IDs
 * 5. Serialize resolved graph back to Turtle
 */
export const makeResolutionActivity = (input: ResolutionActivityInput) =>
  Activity.make({
    name: `resolution-${input.batchId}`,
    success: ResolutionOutput,
    error: ActivityError,
    execute: Effect.gen(function*() {
      const start = yield* DateTime.now
      const storage = yield* StorageService
      const config = yield* ConfigService
      const rdf = yield* RdfBuilder
      const entityResolution = yield* EntityResolutionService
      const bucket = resolveBucket(config)

      yield* Effect.logInfo("Resolution activity starting", {
        batchId: input.batchId,
        graphCount: input.documentGraphUris.length
      })

      // 1. Load all document graphs
      const graphContents = yield* Effect.forEach(input.documentGraphUris, (uri) =>
        storage.get(stripGsPrefix(uri)).pipe(
          Effect.flatMap((opt) => requireContent(O.fromNullishOr(opt), uri)),
          Effect.tapCause((cause) =>
            Effect.logError("Resolution: Failed to load document graph", {
              activity: "resolution",
              batchId: input.batchId,
              graphUri: uri,
              cause: String(cause)
            })
          )
        ), { concurrency: 10 })

      // 2. Parse each TriG graph and extract KnowledgeGraphs
      const knowledgeGraphs = yield* Effect.forEach(graphContents, (trig) =>
        Effect.gen(function*() {
          const store = yield* rdf.parseTriG(trig)
          return yield* storeToKnowledgeGraph(store)
        }).pipe(
          Effect.catch((err) =>
            Effect.gen(function*() {
              yield* Effect.logWarning("Failed to parse document graph, skipping", { error: String(err) })
              return KnowledgeGraph.make({ entities: [], relations: [] })
            })
          )
        ), { concurrency: 5 })

      // Count total entities and relations before resolution
      const totalEntities = knowledgeGraphs.reduce((sum, kg) => sum + kg.entities.length, 0)
      const totalRelations = knowledgeGraphs.reduce((sum, kg) => sum + kg.relations.length, 0)

      yield* Effect.logInfo("Parsed document graphs", {
        batchId: input.batchId,
        graphCount: knowledgeGraphs.length,
        totalEntities,
        totalRelations
      })

      // 3. Perform entity resolution across all graphs
      const resolutionGraph = yield* entityResolution.resolve(
        knowledgeGraphs,
        EntityResolutionConfig.default()
      ).pipe(
        Effect.tap((erg) =>
          Effect.logInfo("Entity resolution complete", {
            batchId: input.batchId,
            mentionCount: erg.stats.mentionCount,
            resolvedCount: erg.stats.resolvedCount,
            clusterCount: erg.stats.clusterCount
          })
        )
      )

      // 4. Build resolved Turtle with canonical IDs
      // Track entity provenance: which document each entity came from
      const entityToDocumentUri: Record<string, string> = {}
      knowledgeGraphs.forEach((kg, docIndex) => {
        const docUri = input.documentGraphUris[docIndex]
        for (const entity of kg.entities) {
          entityToDocumentUri[entity.id] = docUri
        }
      })

      // Merge all graphs and rewrite entity IDs using canonicalMap
      const mergedEntities = knowledgeGraphs.flatMap((kg) => kg.entities)
      const mergedRelations = knowledgeGraphs.flatMap((kg) => kg.relations)

      // Rewrite entity IDs to canonical IDs
      const rewrittenEntities = mergedEntities.map((entity) => {
        const canonicalId = resolutionGraph.canonicalMap[entity.id] ?? entity.id
        return Entity.make({
          ...entity,
          id: EntityId.make(canonicalId)
        })
      })

      // Deduplicate entities by canonical ID (keep first occurrence)
      const seenIds = new Set<string>()
      const uniqueEntities = rewrittenEntities.filter((entity) => {
        if (seenIds.has(entity.id)) return false
        seenIds.add(entity.id)
        return true
      })

      // Rewrite relation IDs
      const rewrittenRelations = mergedRelations.map((rel) => {
        const canonicalSubject = resolutionGraph.canonicalMap[rel.subjectId] ?? rel.subjectId
        const canonicalObject = rel.object._tag === "EntityReference"
          ? RelationObject.cases.EntityReference.make({
            value: resolutionGraph.canonicalMap[rel.object.value] ?? rel.object.value
          })
          : rel.object
        return Relation.make({
          subjectId: canonicalSubject,
          predicate: rel.predicate,
          object: canonicalObject
        })
      })

      // Create resolved KnowledgeGraph
      const resolvedGraph = KnowledgeGraph.make({
        entities: uniqueEntities,
        relations: rewrittenRelations
      })

      // 5. Serialize to Turtle with owl:sameAs links and save
      const store = yield* rdf.createStore
      yield* rdf.addEntities(store, resolvedGraph.entities)
      yield* rdf.addRelations(store, resolvedGraph.relations)
      yield* rdf.addSameAsLinks(store, resolutionGraph.canonicalMap)
      const resolvedTurtle = yield* rdf.toTurtle(store)
      const resolutionPath = PathLayout.batch.resolution(input.batchId)
      yield* storage.set(resolutionPath, resolvedTurtle)

      const end = yield* DateTime.now
      const compressionRatio = totalEntities > 0
        ? 1 - (resolutionGraph.stats.resolvedCount / totalEntities)
        : 0

      // Build provenance map: canonical ID -> source document URIs
      const provenanceMap: Record<string, Array<string>> = {}
      for (const [entityId, docUri] of Object.entries(entityToDocumentUri)) {
        const canonicalId = resolutionGraph.canonicalMap[EntityId.make(entityId)] ?? entityId
        if (!provenanceMap[canonicalId]) {
          provenanceMap[canonicalId] = []
        }
        // Only add unique document URIs
        if (!provenanceMap[canonicalId].includes(docUri)) {
          provenanceMap[canonicalId].push(docUri)
        }
      }

      yield* Effect.logInfo("Resolution activity complete", {
        batchId: input.batchId,
        entitiesTotal: totalEntities,
        clustersFormed: resolutionGraph.stats.clusterCount,
        relationsTotal: totalRelations,
        compressionRatio,
        provenanceMapEntries: Object.keys(provenanceMap).length,
        durationMs: Duration.toMillis(DateTime.distance(start, end))
      })

      return {
        resolvedUri: GcsUri.fromUnknown(`gs://${bucket}/${resolutionPath}`),
        entitiesTotal: totalEntities,
        clustersFormed: resolutionGraph.stats.clusterCount,
        relationsTotal: totalRelations,
        compressionRatio,
        provenanceMap,
        durationMs: Duration.toMillis(DateTime.distance(start, end))
      }
    }).pipe(Effect.mapError(toActivityError)),
    interruptRetryPolicy: activityRetryPolicy
  })

/**
 * Durable Validation Activity
 *
 * Validates the resolved graph against SHACL shapes (if provided).
 * Journaled by WorkflowEngine for crash recovery.
 */
export const makeValidationActivity = (input: ValidationActivityInput) =>
  Activity.make({
    name: `validation-${input.batchId}`,
    success: ValidationOutput,
    error: ActivityError,
    execute: Effect.gen(function*() {
      const start = yield* DateTime.now
      const storage = yield* StorageService
      const config = yield* ConfigService
      const rdf = yield* RdfBuilder
      const shacl = yield* ShaclService
      const bucket = resolveBucket(config)

      yield* Effect.logInfo("Validation activity starting", {
        batchId: input.batchId,
        hasShaclUri: Option.isSome(Option.fromNullishOr(input.shaclUri))
      })

      const resolvedGraph = yield* storage.get(stripGsPrefix(input.resolvedGraphUri)).pipe(
        Effect.flatMap((opt) => requireContent(O.fromNullishOr(opt), input.resolvedGraphUri)),
        Effect.tapCause((cause) =>
          Effect.logError("Validation: Failed to load resolved graph", {
            activity: "validation",
            batchId: input.batchId,
            cause: String(cause)
          })
        )
      )

      const dataStore = yield* rdf.parseTurtle(resolvedGraph).pipe(
        Effect.tapCause((cause) =>
          Effect.logError("Validation: Failed to parse turtle", {
            activity: "validation",
            batchId: input.batchId,
            cause: String(cause)
          })
        )
      )

      // Load SHACL shapes with auto-discovery:
      // 1. If shaclUri provided explicitly, use it
      // 2. Otherwise, try convention-based discovery: shapes.ttl in same directory as ontology
      // 3. Fall back to auto-generation from ontology if shapes.ttl not found
      const shapesStore = yield* O.match(input.shaclUri, {
        onSome: shacl.loadShapesFromUri,
        onNone: () => Effect.gen(function*() {
          // Try convention-based discovery: shapes.ttl in same directory as ontology
          const shapesPath = input.ontologyUri.replace(/[^/]+\.ttl$/i, "shapes.ttl")
          const shapesContent = yield* storage.get(stripGsPrefix(shapesPath))

          if ((shapesContent !== undefined)) {
            yield* Effect.logInfo("Validation: Found shapes.ttl via auto-discovery", {
              activity: "validation",
              batchId: input.batchId,
              shapesPath,
              ontologyUri: input.ontologyUri
            })
            const parsed = yield* rdf.parseTurtle(shapesContent)
            return parsed._store
          }

          // Fall back to auto-generation from ontology
          yield* Effect.logInfo("Validation: Auto-generating SHACL shapes from ontology", {
            activity: "validation",
            batchId: input.batchId,
            ontologyUri: input.ontologyUri,
            triedShapesPath: shapesPath
          })
          const ontologyContent = yield* storage.get(stripGsPrefix(input.ontologyUri)).pipe(
            Effect.flatMap((opt) => requireContent(O.fromNullishOr(opt), input.ontologyUri)),
            Effect.tapCause((cause) =>
              Effect.logError("Validation: Failed to load ontology", {
                activity: "validation",
                batchId: input.batchId,
                ontologyUri: input.ontologyUri,
                cause: String(cause)
              })
            )
          )
          const ontologyStore = yield* rdf.parseTurtle(ontologyContent)
          return yield* shacl.generateShapesFromOntology(ontologyStore._store)
        }).pipe(
          Effect.tapCause((cause) =>
            Effect.logError("Validation: Failed to load or generate shapes", {
              activity: "validation",
              batchId: input.batchId,
              cause: String(cause)
            })
          )
        )
      })

      // Apply validation policy from input or config
      // Config defaults: logOnly=false, failOnViolation=true, failOnWarning=false
      // For development, set VALIDATION_LOG_ONLY=true to allow workflows to complete
      const policy = input.validationPolicy

      // Run validation with policy - this will fail if policy is violated
      const report = yield* shacl.validateWithPolicy(dataStore._store, shapesStore, policy).pipe(
        Effect.tapCause((cause) =>
          Effect.logError("Validation: SHACL validation failed", {
            activity: "validation",
            batchId: input.batchId,
            cause: String(cause)
          })
        )
      )

      const validationGraphPath = PathLayout.batch.validationGraph(input.batchId)
      yield* storage.set(validationGraphPath, resolvedGraph)

      const reportPath = PathLayout.batch.validationReport(input.batchId)
      yield* storage.set(reportPath, JSON.stringify(report, null, 2))

      const end = yield* DateTime.now

      yield* Effect.logInfo("Validation activity complete", {
        batchId: input.batchId,
        conforms: report.conforms,
        violations: NonNegativeInt.make(report.violations.length),
        policyApplied: policy,
        durationMs: Duration.toMillis(DateTime.distance(start, end))
      })

      return {
        validatedUri: GcsUri.fromUnknown(`gs://${bucket}/${validationGraphPath}`),
        conforms: report.conforms,
        violations: report.violations.length,
        violationSummary: report.violations.length ? summarizeViolations(report.violations) : [],
        reportUri: GcsUri.fromUnknown(`gs://${bucket}/${reportPath}`),
        durationMs: Duration.toMillis(DateTime.distance(start, end))
      }
    }).pipe(Effect.mapError(toActivityError)),
    interruptRetryPolicy: activityRetryPolicy
  })

/**
 * Durable Ingestion Activity
 *
 * Ingests the validated graph into the canonical store.
 * Journaled by WorkflowEngine for crash recovery.
 */
export const makeIngestionActivity = (input: IngestionActivityInput) =>
  Activity.make({
    name: `ingestion-${input.batchId}`,
    success: IngestionOutput,
    error: ActivityError,
    execute: Effect.gen(function*() {
      const start = yield* DateTime.now
      const storage = yield* StorageService
      const config = yield* ConfigService
      const rdf = yield* RdfBuilder
      const bucket = resolveBucket(config)

      yield* Effect.logInfo("Ingestion activity starting", {
        batchId: input.batchId,
        targetNamespace: input.targetNamespace
      })

      const validatedGraph = yield* storage.get(stripGsPrefix(input.validatedGraphUri)).pipe(
        Effect.flatMap((opt) => requireContent(O.fromNullishOr(opt), input.validatedGraphUri)),
        Effect.tapCause((cause) =>
          Effect.logError("Ingestion: Failed to load validated graph", {
            activity: "ingestion",
            batchId: input.batchId,
            cause: String(cause)
          })
        )
      )

      const stats = yield* parseTurtleStats(validatedGraph).pipe(
        Effect.catch((error) =>
          Effect.gen(function*() {
            yield* Effect.logError("Ingestion: Failed to parse validated graph for stats", {
              activity: "ingestion",
              batchId: input.batchId,
              error: String(error)
            })
            // Return zeros but the error is logged - consider making this fail
            return { entityCount: 0, tripleCount: 0 }
          })
        )
      )

      // Save batch-specific canonical graph (always overwrite - one batch = one file)
      const canonicalPath = PathLayout.batch.canonical(input.batchId)
      yield* storage.set(canonicalPath, validatedGraph)

      // Namespace canonical graph: optimistic locking for concurrent batch safety
      const namespaceCanonicalPath = PathLayout.canonical(input.targetNamespace).entities

      // Parse the new graph we want to merge
      const newStore = yield* rdf.parseTurtle(validatedGraph).pipe(
        Effect.mapError((error) => new Error(`Failed to parse new graph: ${error.message}`))
      )
      const newTripleCount = newStore._store.size

      // Optimistic locking merge with retry on conflict
      // This prevents concurrent batches from overwriting each other's data
      const mergeWithOptimisticLocking = Effect.gen(function*() {
        // Try to load existing namespace canonical graph with generation for optimistic locking
        const existingGraphOpt = yield* storage.getWithGeneration(namespaceCanonicalPath)

        let mergedGraph: string
        const mergedStats = { existingTriples: 0, newTriples: newTripleCount, addedTriples: 0 }
        let generation: string | undefined

        if (Option.isSome(existingGraphOpt)) {
          generation = existingGraphOpt.value.generation

          // Merge with existing graph
          const existingStore = yield* rdf.parseTurtle(existingGraphOpt.value.content).pipe(
            Effect.mapError((error) => new Error(`Failed to parse existing graph: ${error.message}`))
          )
          mergedStats.existingTriples = existingStore._store.size

          // Re-parse new graph for merge (since we can't clone N3 stores)
          const newStoreForMerge = yield* rdf.parseTurtle(validatedGraph).pipe(
            Effect.mapError((error) => new Error(`Failed to parse new graph for merge: ${error.message}`))
          )

          // Merge new into existing (union semantics)
          mergedStats.addedTriples = yield* rdf.mergeStores(existingStore, newStoreForMerge)

          // Validate merge integrity: addedTriples should never exceed newTriples
          if (mergedStats.addedTriples > mergedStats.newTriples) {
            yield* Effect.logError("Ingestion: Merge integrity violation - added more triples than source had", {
              batchId: input.batchId,
              newTriples: mergedStats.newTriples,
              addedTriples: mergedStats.addedTriples
            })
            const errorMessage =
              `Merge integrity violation: added ${mergedStats.addedTriples} triples but source only had ${mergedStats.newTriples}`
            return yield* Effect.fail(new Error(errorMessage))
          }

          // Calculate deduplicated triples
          const deduplicatedTriples = mergedStats.newTriples - mergedStats.addedTriples

          // Log deduplication stats
          if (deduplicatedTriples > 0) {
            const deduplicationRatio = (deduplicatedTriples / mergedStats.newTriples) * 100

            if (deduplicationRatio > 50) {
              yield* Effect.logWarning(
                "Ingestion: High triple deduplication detected - possible IRI collision or duplicate documents",
                {
                  batchId: input.batchId,
                  namespace: input.targetNamespace,
                  deduplicatedTriples,
                  newTriples: mergedStats.newTriples,
                  deduplicationRatio: `${deduplicationRatio.toFixed(1)}%`
                }
              )
            } else {
              yield* Effect.logDebug("Ingestion: Triple deduplication during merge", {
                batchId: input.batchId,
                deduplicatedTriples,
                newTriples: mergedStats.newTriples,
                deduplicationRatio: `${deduplicationRatio.toFixed(1)}%`
              })
            }
          }

          // Serialize merged graph
          mergedGraph = yield* rdf.toTurtle(existingStore)

          yield* Effect.logInfo("Ingestion: Merged with existing namespace graph", {
            batchId: input.batchId,
            namespace: input.targetNamespace,
            existingTriples: mergedStats.existingTriples,
            newTriples: mergedStats.newTriples,
            addedTriples: mergedStats.addedTriples,
            deduplicatedTriples,
            totalTriples: existingStore._store.size
          })
        } else {
          // No existing graph - use new graph as-is
          mergedGraph = validatedGraph
          mergedStats.addedTriples = newTripleCount

          yield* Effect.logInfo("Ingestion: Creating new namespace graph", {
            batchId: input.batchId,
            namespace: input.targetNamespace,
            tripleCount: newTripleCount
          })
        }

        // Write with optimistic locking (conditional on generation match)
        if (generation !== undefined) {
          yield* storage.setIfGenerationMatch(namespaceCanonicalPath, mergedGraph, generation)
        } else {
          // No existing file - just write directly
          yield* storage.set(namespaceCanonicalPath, mergedGraph)
        }

        return mergedStats
      })

      // Retry on generation mismatch (concurrent write detected)
      const maxRetries = 3
      yield* mergeWithOptimisticLocking.pipe(
        Effect.retry({
          while: (error) => error instanceof GenerationMismatchError,
          times: maxRetries,
          schedule: Schedule.exponential("100 millis").pipe(Schedule.jittered)
        }),
        Effect.tapError((error) => {
          if (error instanceof GenerationMismatchError) {
            return Effect.logError("Ingestion: Failed after max retries due to concurrent writes", {
              batchId: input.batchId,
              namespace: input.targetNamespace,
              maxRetries,
              key: error.key
            })
          }
          return Effect.void
        })
      )

      const end = yield* DateTime.now

      return {
        canonicalUri: GcsUri.fromUnknown(`gs://${bucket}/${canonicalPath}`),
        triplesIngested: stats.tripleCount,
        durationMs: Duration.toMillis(DateTime.distance(start, end))
      }
    }).pipe(Effect.mapError(toActivityError)),
    interruptRetryPolicy: activityRetryPolicy
  })

// -----------------------------------------------------------------------------
// Claim Persistence Activity (runs after validation)
// -----------------------------------------------------------------------------

/**
 * Input for ClaimPersistence activity
 */
export const ClaimPersistenceInput = Schema.Struct({
  /** Batch ID for logging */
  batchId: Schema.String,
  /** Ontology ID for namespace scoping (e.g., "seattle") */
  ontologyId: Schema.String,
  /** URIs of document graphs to process */
  documentGraphUris: Schema.Array(Schema.String),
  /** Target namespace for IRI construction */
  targetNamespace: Schema.String,
  /** Optional article metadata per document */
  documentMetadata: Schema.Array(
        Schema.Struct({
          documentId: Schema.String,
          sourceUri: Schema.String,
          eventTime: Schema.DateTimeUtc.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
          headline: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault)
        })
      ).pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault)
})
export type ClaimPersistenceInput = typeof ClaimPersistenceInput.Type

/**
 * Durable Claim Persistence Activity
 *
 * Persists claims to PostgreSQL AFTER validation passes.
 * This ensures only validated claims are persisted to the database.
 *
 * Pipeline:
 * 1. For each document graph URI, load the TriG/Turtle content
 * 2. Parse to RDF store and extract entities/relations
 * 3. Convert to claims using knowledgeGraphToClaims
 * 4. Persist to PostgreSQL via ClaimPersistenceService
 *
 * @since 2.0.0
 */
export const makeClaimPersistenceActivity = (input: ClaimPersistenceInput) =>
  Activity.make({
    name: `claim-persistence-${input.batchId}`,
    success: ClaimPersistenceOutput,
    error: ActivityError,
    execute: Effect.gen(function*() {
      const start = yield* DateTime.now
      const storage = yield* StorageService
      const rdf = yield* RdfBuilder
      const config = yield* ConfigService
      const claimPersistence = yield* Effect.serviceOption(ClaimPersistenceService)

      if (Option.isNone(claimPersistence)) {
        yield* Effect.logInfo("Claim persistence skipped - PostgreSQL not configured", {
          batchId: input.batchId
        })
        const end = yield* DateTime.now
        return {
          claimsPersisted: 0,
          documentsProcessed: 0,
          documentsFailed: 0,
          durationMs: Duration.toMillis(DateTime.distance(start, end))
        }
      }

      yield* Effect.logInfo("Claim persistence activity starting", {
        batchId: input.batchId,
        documentCount: input.documentGraphUris.length
      })

      // Build metadata lookup
      const metadataMap = new Map<string, {
        documentId: string
        sourceUri: string
        eventTime: O.Option<DateTime.Utc>
        headline: O.Option<string>
      }>()

      for (const meta of O.getOrElse(input.documentMetadata, () => [])) {
        metadataMap.set(meta.sourceUri, meta)
      }

      let totalClaimsPersisted = 0
      let documentsProcessed = 0
      let documentsFailed = 0

      // Process each document graph
      for (const graphUri of input.documentGraphUris) {
        const result = yield* Effect.gen(function*() {
          const graphPath = stripGsPrefix(graphUri)
          const graphContent = yield* storage.get(graphPath).pipe(
            Effect.flatMap((opt) => requireContent(O.fromNullishOr(opt), graphPath))
          )

          // Parse TriG to extract entities and relations (preserves named graphs)
          const store = yield* rdf.parseTriG(graphContent)
          const knowledgeGraph = yield* storeToKnowledgeGraph(store)

          // Get metadata for this document
          // Try to find metadata by matching graph URI path to sourceUri
          let docMeta = metadataMap.get(graphUri)
          if (!docMeta) {
            // Fall back to extracting document ID from path
            const pathMatch = graphPath.match(/documents\/([^/]+)\//)
            const documentId = pathMatch?.[1] ?? graphPath
            docMeta = {
              documentId,
              sourceUri: graphUri,
              eventTime: O.none(),
              headline: O.none()
            }
          }

          // Convert to claims
          // Convert Namespace identifier to full IRI
          const match = config.rdf.baseNamespace.match(/^https?:\/\/[^/]+\//)
          const baseDomain = match ? match[0] : "http://example.org/"
          const baseNamespace = `${baseDomain}${input.targetNamespace}/`
          const claims = knowledgeGraphToClaims(
            knowledgeGraph.entities,
            knowledgeGraph.relations,
            {
              baseNamespace,
              documentId: docMeta.documentId,
              ontologyId: input.ontologyId,
              defaultConfidence: 0.85
            }
          )

          if (claims.length === 0) {
            yield* Effect.logDebug("No claims to persist for document", {
              batchId: input.batchId,
              documentId: docMeta.documentId
            })
            return { persisted: 0, documentId: docMeta.documentId }
          }

          // Persist to PostgreSQL
          const persistResult = yield* claimPersistence.value.persistClaims(
            claims,
            {
              uri: docMeta.sourceUri,
              ontologyId: input.ontologyId,
              ...(O.isSome(docMeta.headline) ? { headline: docMeta.headline.value } : {}),
              publishedAt: O.match(docMeta.eventTime, {
                onNone: () => new Date(),
                onSome: DateTime.toDate
              })
            },
            graphUri
          )

          yield* Effect.logDebug("Claims persisted for document", {
            batchId: input.batchId,
            documentId: docMeta.documentId,
            claimsInserted: persistResult.claimsInserted,
            claimsTotal: persistResult.claimsTotal
          })

          return { persisted: persistResult.claimsInserted, documentId: docMeta.documentId }
        }).pipe(
          Effect.catch((error) =>
            Effect.gen(function*() {
              yield* Effect.logWarning("Failed to persist claims for document", {
                batchId: input.batchId,
                graphUri,
                error: String(error)
              })
              return { persisted: 0, failed: true, graphUri }
            })
          )
        )

        if ("failed" in result && result.failed) {
          documentsFailed++
        } else {
          documentsProcessed++
          totalClaimsPersisted += result.persisted
        }
      }

      const end = yield* DateTime.now

      yield* Effect.logInfo("Claim persistence activity complete", {
        batchId: input.batchId,
        claimsPersisted: totalClaimsPersisted,
        documentsProcessed,
        documentsFailed,
        durationMs: Duration.toMillis(DateTime.distance(start, end))
      })

      return {
        claimsPersisted: totalClaimsPersisted,
        documentsProcessed,
        documentsFailed,
        durationMs: Duration.toMillis(DateTime.distance(start, end))
      }
    }).pipe(Effect.mapError(toActivityError)),
    interruptRetryPolicy: activityRetryPolicy
  })

// -----------------------------------------------------------------------------
// Cross-Batch Entity Resolution Activity
// -----------------------------------------------------------------------------

/**
 * Durable Cross-Batch Entity Resolution Activity
 *
 * Links entities from the current batch to the persistent entity registry.
 * Enables building up a knowledge base over time where entities across
 * different batches are linked to canonical IRIs.
 *
 * Pipeline:
 * 1. Load resolved graph from storage
 * 2. Parse graph and extract entities
 * 3. Resolve entities against persistent registry
 * 4. Update registry with new/merged entities
 * 5. Return resolution statistics
 *
 * @since 2.0.0
 */
export const makeCrossBatchResolutionActivity = (input: CrossBatchResolutionInput) =>
  Activity.make({
    name: `cross-batch-resolution-${input.batchId}`,
    success: CrossBatchResolutionOutput,
    error: ActivityError,
    execute: Effect.gen(function*() {
      const start = yield* DateTime.now

      // Skip if not enabled
      if (!input.enabled) {
        yield* Effect.logInfo("Cross-batch resolution skipped - not enabled", {
          batchId: input.batchId
        })
        const end = yield* DateTime.now
        return {
          entitiesTotal: 0,
          matchedToExisting: 0,
          newCanonicals: 0,
          candidatesEvaluated: 0,
          durationMs: Duration.toMillis(DateTime.distance(start, end))
        }
      }

      // Get cross-batch resolver (optional - may not be configured)
      const resolverOpt = yield* Effect.serviceOption(CrossBatchEntityResolver)

      if (Option.isNone(resolverOpt)) {
        yield* Effect.logInfo("Cross-batch resolution skipped - resolver not configured", {
          batchId: input.batchId
        })
        const end = yield* DateTime.now
        return {
          entitiesTotal: 0,
          matchedToExisting: 0,
          newCanonicals: 0,
          candidatesEvaluated: 0,
          durationMs: Duration.toMillis(DateTime.distance(start, end))
        }
      }

      const resolver = resolverOpt.value
      const storage = yield* StorageService
      const rdf = yield* RdfBuilder

      yield* Effect.logInfo("Cross-batch entity resolution starting", {
        batchId: input.batchId,
        resolvedGraphUri: input.resolvedGraphUri
      })

      // Load resolved graph
      const graphPath = stripGsPrefix(input.resolvedGraphUri)
      const graphContent = yield* storage.get(graphPath).pipe(
        Effect.flatMap((opt) => requireContent(O.fromNullishOr(opt), graphPath))
      )

      // Parse graph and extract entities
      const store = yield* rdf.parseTurtle(graphContent)
      const knowledgeGraph = yield* storeToKnowledgeGraph(store)

      yield* Effect.logDebug("Loaded resolved graph for cross-batch resolution", {
        batchId: input.batchId,
        entityCount: knowledgeGraph.entities.length,
        relationCount: knowledgeGraph.relations.length
      })

      // Resolve against registry
      const config = CrossBatchResolverConfig.make({})
      const result = yield* resolver.resolve(input.ontologyId, knowledgeGraph.entities, input.batchId, config)

      const end = yield* DateTime.now

      yield* Effect.logInfo("Cross-batch entity resolution complete", {
        batchId: input.batchId,
        entitiesTotal: result.stats.totalEntities,
        matchedToExisting: result.stats.matchedToExisting,
        newCanonicals: result.stats.createdNew,
        candidatesEvaluated: result.stats.candidatesEvaluated,
        durationMs: Duration.toMillis(DateTime.distance(start, end))
      })

      return {
        entitiesTotal: result.stats.totalEntities,
        matchedToExisting: result.stats.matchedToExisting,
        newCanonicals: result.stats.createdNew,
        candidatesEvaluated: result.stats.candidatesEvaluated,
        durationMs: Duration.toMillis(DateTime.distance(start, end))
      }
    }).pipe(Effect.mapError(toActivityError)),
    interruptRetryPolicy: activityRetryPolicy
  })

// -----------------------------------------------------------------------------
// RDFS Inference Activity
// -----------------------------------------------------------------------------

/**
 * Input for Inference activity
 */
export const InferenceInput = Schema.Struct({
  /** Batch ID for logging and provenance */
  batchId: Schema.String,
  /** URI of the resolved graph to reason over */
  resolvedGraphUri: Schema.String,
  /** Reasoning profile to use (default: rdfs) */
  profile: Schema.Literals(["rdfs", "rdfs-subclass", "owl-sameas", "custom"]).pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  /** Whether inference is enabled (default: true) */
  enabled: Schema.Boolean.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault)
})
export type InferenceInput = typeof InferenceInput.Type

/**
 * Output for Inference activity
 */
export const InferenceOutput = Schema.Struct({
  /** URI of the enriched graph with inferences */
  enrichedGraphUri: GcsUri,
  /** Number of triples inferred */
  inferredTripleCount: Schema.Number,
  /** Total triples after inference */
  totalTripleCount: Schema.Number,
  /** Number of provenance quads added */
  provenanceQuadCount: Schema.Number,
  /** Number of rules applied */
  rulesApplied: Schema.Number,
  /** Duration in milliseconds */
  durationMs: Schema.Number
})
export type InferenceOutput = typeof InferenceOutput.Type

/**
 * Durable RDFS Inference Activity
 *
 * Applies RDFS reasoning to the resolved graph to generate new facts
 * through forward-chaining inference. Computes the delta (new triples only)
 * and adds PROV-O provenance linking inferred facts to the inference activity.
 *
 * Pipeline:
 * 1. Load resolved graph from storage
 * 2. Apply reasoning (rdfs profile by default)
 * 3. Compute delta (new triples)
 * 4. Add PROV provenance for each inferred triple
 * 5. Save enriched graph
 * 6. Return statistics
 *
 * @since 2.0.0
 */
export const makeInferenceActivity = (input: InferenceInput) =>
  Activity.make({
    name: `inference-${input.batchId}`,
    success: InferenceOutput,
    error: ActivityError,
    execute: Effect.gen(function*() {
      const start = yield* DateTime.now
      const storage = yield* StorageService
      const config = yield* ConfigService
      const rdf = yield* RdfBuilder
      const reasoner = yield* Reasoner
      const bucket = resolveBucket(config)

      // Skip if not enabled
      const enabled = input.enabled ?? true
      if (!enabled) {
        yield* Effect.logInfo("Inference skipped - not enabled", {
          batchId: input.batchId
        })
        const end = yield* DateTime.now
        return {
          enrichedGraphUri: input.resolvedGraphUri as GcsUri,
          inferredTripleCount: 0,
          totalTripleCount: 0,
          provenanceQuadCount: 0,
          rulesApplied: 0,
          durationMs: Duration.toMillis(DateTime.distance(start, end))
        }
      }

      yield* Effect.logInfo("Inference activity starting", {
        batchId: input.batchId,
        profile: input.profile ?? "rdfs"
      })

      // 1. Load resolved graph
      const graphPath = stripGsPrefix(input.resolvedGraphUri)
      const graphContent = yield* storage.get(graphPath).pipe(
        Effect.flatMap((opt) => requireContent(O.fromNullishOr(opt), graphPath))
      )
      const originalStore = yield* rdf.parseTurtle(graphContent)

      // 2. Apply reasoning (creates a copy, doesn't mutate original)
      const profile = O.getOrElse(input.profile, () => "rdfs" as const)
      const reasoningConfig = ReasoningConfig.make({ profile })
      const { result: reasoningResult, store: enrichedStore } = yield* reasoner.reasonCopy(
        originalStore,
        reasoningConfig
      )

      yield* Effect.logInfo("Reasoning complete", {
        batchId: input.batchId,
        inferredTriples: reasoningResult.inferredTripleCount,
        totalTriples: reasoningResult.totalTripleCount,
        rulesApplied: reasoningResult.rulesApplied
      })

      // 3. Compute delta (new triples only)
      const delta = yield* computeQuadDelta(originalStore, enrichedStore)

      // 4. Add PROV provenance for the inference activity
      let provenanceQuadCount = 0
      if (delta.deltaCount > 0) {
        const inferenceActivityIri = `urn:provenance:inference:${input.batchId}`
        const df = N3.DataFactory

        // Helper to add a quad to the enriched store
        const addQuad = (s: string, p: string, o: string) => {
          enrichedStore._store.addQuad(df.quad(
            df.namedNode(s),
            df.namedNode(p),
            o.startsWith("http") || o.startsWith("urn:") ? df.namedNode(o) : df.literal(o)
          ))
        }

        // Add inference activity metadata
        addQuad(inferenceActivityIri, RDF.type, PROV.Activity)
        addQuad(inferenceActivityIri, PROV.generatedAtTime, DateTime.formatIso(start))
        addQuad(inferenceActivityIri, PROV.used, input.resolvedGraphUri)
        provenanceQuadCount += 3

        // For each inferred triple, add prov:wasGeneratedBy linking to the activity
        // We use RDF reification (rdf:Statement) to reference the inferred triples
        for (const quad of delta.newQuads) {
          // Create a statement IRI based on hash of the quad
          const quadHash = `${quad.subject.value}|${quad.predicate.value}|${quad.object.value}`.split("").reduce(
            (acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0,
            0
          )
          const statementIri = `${inferenceActivityIri}/stmt/${Math.abs(quadHash).toString(16)}`

          // Reify the statement
          addQuad(statementIri, RDF.type, RDF.Statement)
          addQuad(statementIri, RDF.subject, quad.subject.value)
          addQuad(statementIri, RDF.predicate, quad.predicate.value)
          addQuad(
            statementIri,
            RDF.object,
            quad.object.termType === "Literal" ? `"${quad.object.value}"` : quad.object.value
          )
          addQuad(statementIri, PROV.wasGeneratedBy, inferenceActivityIri)
          provenanceQuadCount += 5
        }

        yield* Effect.logInfo("Added provenance for inferred triples", {
          batchId: input.batchId,
          inferredTriples: delta.deltaCount,
          provenanceQuads: provenanceQuadCount
        })
      }

      // 5. Save enriched graph
      const enrichedTurtle = yield* rdf.toTurtle(enrichedStore)
      const enrichedPath = PathLayout.batch.inference(input.batchId as BatchId)
      yield* storage.set(enrichedPath, enrichedTurtle)

      const end = yield* DateTime.now

      yield* Effect.logInfo("Inference activity complete", {
        batchId: input.batchId,
        inferredTriples: delta.deltaCount,
        totalTriples: enrichedStore._store.size,
        provenanceQuads: provenanceQuadCount,
        durationMs: Duration.toMillis(DateTime.distance(start, end))
      })

      return {
        enrichedGraphUri: GcsUri.fromUnknown(`gs://${bucket}/${enrichedPath}`),
        inferredTripleCount: delta.deltaCount,
        totalTripleCount: enrichedStore._store.size,
        provenanceQuadCount,
        rulesApplied: reasoningResult.rulesApplied,
        durationMs: Duration.toMillis(DateTime.distance(start, end))
      }
    }).pipe(Effect.mapError(toActivityError)),
    interruptRetryPolicy: activityRetryPolicy
  })

// -----------------------------------------------------------------------------
// Compute Ontology Embeddings Activity
// -----------------------------------------------------------------------------

/**
 * Input for ComputeOntologyEmbeddings activity
 */
export const ComputeEmbeddingsInput = Schema.Struct({
  /** URI of the ontology (e.g., "gs://bucket/ontologies/football/ontology.ttl") */
  ontologyUri: Schema.String,
  /** Embedding model to use */
  model: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault)
})
export type ComputeEmbeddingsInput = typeof ComputeEmbeddingsInput.Type

/**
 * Output for ComputeOntologyEmbeddings activity
 */
export const ComputeEmbeddingsOutput = Schema.Struct({
  /** URI of the stored embeddings blob */
  embeddingsUri: GcsUri,
  /** Version hash of the ontology */
  version: Schema.String,
  /** Number of class embeddings */
  classCount: Schema.Number,
  /** Number of property embeddings */
  propertyCount: Schema.Number,
  /** Embedding dimension */
  dimension: Schema.Number,
  /** Duration in milliseconds */
  durationMs: Schema.Number
})
export type ComputeEmbeddingsOutput = typeof ComputeEmbeddingsOutput.Type

/**
 * Durable Compute Ontology Embeddings Activity
 *
 * Pre-computes embeddings for all classes and properties in an ontology
 * and stores them as a blob alongside the ontology file.
 *
 * Pipeline:
 * 1. Load ontology from storage
 * 2. Parse ontology to extract classes and properties
 * 3. Build embedding text for each (label + description)
 * 4. Embed all texts
 * 5. Create OntologyEmbeddings blob
 * 6. Store blob to GCS
 *
 * Idempotent: Same ontology content produces same embeddings blob.
 */
export const makeComputeEmbeddingsActivity = (input: ComputeEmbeddingsInput) =>
  Activity.make({
    name: "compute-ontology-embeddings",
    success: ComputeEmbeddingsOutput,
    error: ActivityError,
    execute: Effect.gen(function*() {
              const start = yield* DateTime.now
              const storage = yield* StorageService
              const config = yield* ConfigService
              const rdf = yield* RdfBuilder
              const embedding = yield* EmbeddingService
              const bucket = resolveBucket(config)

              // Get actual provider metadata for accurate model tracking
              const providerMetadata = yield* embedding.getProviderMetadata()

              yield* Effect.logInfo("Computing ontology embeddings", {
                ontologyUri: input.ontologyUri,
                provider: providerMetadata.providerId,
                model: providerMetadata.modelId
              })

              // 1. Load ontology content
              const ontologyPath = stripGsPrefix(input.ontologyUri)
              const ontologyContent = yield* storage.get(ontologyPath).pipe(
                Effect.flatMap((opt) => requireContent(O.fromNullishOr(opt), ontologyPath))
              )

              // 2. Compute version hash
              const version = yield* OntologyEmbeddings.computeVersion(ontologyContent)

              // 3. Parse ontology and extract classes/properties
              const store = yield* rdf.parseTurtle(ontologyContent)
              const { classes, properties } = yield* parseOntologyFromStore(rdf, store, ontologyPath)

              yield* Effect.logInfo("Ontology loaded", {
                classCount: Chunk.size(classes),
                propertyCount: Chunk.size(properties),
                version
              })

              // 4. Embed all classes (parallelized for ~5x speedup)
              // Concurrency limited to 5 to respect embedding service rate limits
              const classEmbeddings = yield* Effect.forEach(
                Chunk.toReadonlyArray(classes),
                (cls) =>
                  Effect.gen(function*() {
                    const text = ElementEmbedding.buildText(
                      cls.label,
                      cls.definition ?? cls.comment,
                      cls.altLabels ?? []
                    )
                    const emb = yield* embedding.embed(text, "search_document")
                    return Schema.decodeUnknownSync(ElementEmbedding)({
                      iri: cls.id,
                      text,
                      embedding: Array.from(emb)
                    })
                  }),
                { concurrency: 5 }
              )

              // 5. Embed all properties (parallelized for ~5x speedup)
              const propertyEmbeddings = yield* Effect.forEach(
                Chunk.toReadonlyArray(properties),
                (prop) =>
                  Effect.gen(function*() {
                    const text = ElementEmbedding.buildText(prop.label, prop.comment, [])
                    const emb = yield* embedding.embed(text, "search_document")
                    return Schema.decodeUnknownSync(ElementEmbedding)({
                      iri: prop.id,
                      text,
                      embedding: Array.from(emb)
                    })
                  }),
                { concurrency: 5 }
              )

              // 6. Determine dimension from first embedding
              const dimension = classEmbeddings[0]?.embedding.length ?? propertyEmbeddings[0]?.embedding.length ?? 0

              // 7. Build OntologyEmbeddings blob
              // Use actual provider model from metadata, not hardcoded fallback
              const ontologyUri = GcsUri.fromUnknown(input.ontologyUri)
              const embeddingsBlob: OntologyEmbeddings = Schema.decodeUnknownSync(OntologyEmbeddings)({
                ontologyUri,
                version: ContentHash.make(version),
                model: O.getOrElse(input.model, () => providerMetadata.modelId),
                dimension: NonNegativeInt.make(dimension),
                createdAt: start,
                classes: classEmbeddings,
                properties: propertyEmbeddings
              })

              // 8. Serialize and store
              const embeddingsJson = yield* Schema.encodeEffect(OntologyEmbeddingsJson)(embeddingsBlob)
              const embeddingsPath = stripGsPrefix(OntologyEmbeddings.storagePathFor(ontologyUri))
              yield* storage.set(embeddingsPath, embeddingsJson)

              const end = yield* DateTime.now

              yield* Effect.logInfo("Ontology embeddings computed and stored", {
                embeddingsPath,
                classCount: classEmbeddings.length,
                propertyCount: propertyEmbeddings.length,
                dimension,
                durationMs: Duration.toMillis(DateTime.distance(start, end))
              })

              return {
                embeddingsUri: GcsUri.fromUnknown(`gs://${bucket}/${embeddingsPath}`),
                version,
                classCount: classEmbeddings.length,
                propertyCount: propertyEmbeddings.length,
                dimension,
                durationMs: Duration.toMillis(DateTime.distance(start, end))
              }
            }).pipe(Effect.mapError(toActivityError)),
    interruptRetryPolicy: activityRetryPolicy
  })

// -----------------------------------------------------------------------------
// LLM Verification Activity (Entity Resolution Enhancement)
// -----------------------------------------------------------------------------

/**
 * Entity pair for LLM verification
 */
export const EntityPair = Schema.Struct({
  /** First entity ID */
  entityA: Schema.String,
  /** Second entity ID */
  entityB: Schema.String,
  /** Mention text for entity A */
  mentionA: Schema.String,
  /** Mention text for entity B */
  mentionB: Schema.String,
  /** Types for entity A */
  typesA: Schema.Array(Schema.String),
  /** Types for entity B */
  typesB: Schema.Array(Schema.String),
  /** Initial similarity score from embedding/string matching */
  similarity: Schema.Number
})
export type EntityPair = typeof EntityPair.Type

/**
 * Input for LLM verification activity
 */
export const LlmVerificationInput = Schema.Struct({
  /** Batch ID for context */
  batchId: Schema.String,
  /** Entity pairs with low confidence to verify */
  entityPairs: Schema.Array(EntityPair),
  /** Similarity threshold below which to verify (default: 0.7) */
  verificationThreshold: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })).pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault)
})
export type LlmVerificationInput = typeof LlmVerificationInput.Type

/**
 * Verified entity pair result
 */
export const VerifiedPair = Schema.Struct({
  /** First entity ID */
  entityA: Schema.String,
  /** Second entity ID */
  entityB: Schema.String,
  /** Whether LLM confirmed these are the same entity */
  sameEntity: Schema.Boolean,
  /** LLM confidence in the verification */
  confidence: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
  /** Original similarity score */
  originalSimilarity: Schema.Number
})
export type VerifiedPair = typeof VerifiedPair.Type

/**
 * Output for LLM verification activity
 */
export const LlmVerificationOutput = Schema.Struct({
  /** Pairs verified as same entity */
  verified: Schema.Array(VerifiedPair),
  /** Pairs rejected as different entities */
  rejected: Schema.Array(VerifiedPair),
  /** Pairs skipped (above threshold) */
  skipped: Schema.Number,
  /** Total pairs processed */
  totalProcessed: Schema.Number,
  /** Duration in milliseconds */
  durationMs: Schema.Number
})
export type LlmVerificationOutput = typeof LlmVerificationOutput.Type

/**
 * Schema for single LLM entity comparison response
 */
const EntityComparisonSchema = Schema.Struct({
  sameEntity: Schema.Boolean.annotate({
    description: "True if these refer to the same real-world entity"
  }),
  confidence: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })).annotate({
    description: "Confidence in the decision (0-1)"
  }),
  reasoning: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
    description: "Brief explanation of the decision"
  })
}).annotate({
  identifier: "EntityComparison",
  description: "LLM decision on whether two entities are the same"
})

/**
 * Schema for batch entity comparison response
 */
const BatchComparisonSchema = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      index: Schema.Number.annotate({
        description: "Index of the pair in the input list (0-based)"
      }),
      sameEntity: Schema.Boolean.annotate({
        description: "True if these refer to the same real-world entity"
      }),
      confidence: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })).annotate({
        description: "Confidence in the decision (0-1)"
      })
    })
  )
}).annotate({
  identifier: "BatchEntityComparison",
  description: "LLM decisions for multiple entity pairs"
})

/**
 * Build prompt for single entity comparison
 * @internal
 */
const buildComparisonPrompt = (pair: EntityPair): string => {
  const typeLabelsA = pair.typesA.map((t) => extractLocalNameFromIri(t)).join(", ")
  const typeLabelsB = pair.typesB.map((t) => extractLocalNameFromIri(t)).join(", ")

  return `You are an entity resolution expert. Determine if these two mentions refer to the same real-world entity.

Entity A:
- Mention: "${pair.mentionA}"
- Types: ${typeLabelsA || "Unknown"}

Entity B:
- Mention: "${pair.mentionB}"
- Types: ${typeLabelsB || "Unknown"}

Initial similarity score: ${pair.similarity.toFixed(2)}

Instructions:
- Consider: Are these mentions of the SAME real-world entity (person, organization, place, etc.)?
- Account for variations: nicknames, abbreviations, alternate spellings, different naming conventions
- If types don't overlap, they're likely different entities
- Return JSON: { "sameEntity": boolean, "confidence": number (0-1) }
- confidence should reflect how certain you are about the decision`
}

/**
 * Build prompt for batch entity comparison
 * @internal
 */
const buildBatchComparisonPrompt = (pairs: ReadonlyArray<EntityPair>): string => {
  const pairsFormatted = pairs.map((pair, i) => {
    const typeLabelsA = pair.typesA.map((t) => extractLocalNameFromIri(t)).join(", ")
    const typeLabelsB = pair.typesB.map((t) => extractLocalNameFromIri(t)).join(", ")
    return `${i}. Entity A: "${pair.mentionA}" (${typeLabelsA || "?"})\n   Entity B: "${pair.mentionB}" (${
      typeLabelsB || "?"
    })\n   Similarity: ${pair.similarity.toFixed(2)}`
  }).join("\n\n")

  return `You are an entity resolution expert. For each pair, determine if the two mentions refer to the same real-world entity.

Pairs to evaluate:
${pairsFormatted}

Instructions:
- For each pair, decide: Do these mentions refer to the SAME real-world entity?
- Consider: nicknames, abbreviations, alternate spellings, naming variations
- If types don't overlap, they're likely different entities
- Return JSON with "results" array, each having: { "index": <pair number>, "sameEntity": boolean, "confidence": number (0-1) }
- Return results for ALL pairs in order`
}

/**
 * Default verification threshold (verify pairs below this similarity)
 */
const DEFAULT_VERIFICATION_THRESHOLD = 0.7

/**
 * Batch size for LLM verification
 */
const VERIFICATION_BATCH_SIZE = 5

/**
 * Durable LLM Verification Activity
 *
 * Verifies low-confidence entity pairs using LLM to improve resolution accuracy.
 * This is an optional post-clustering step for entity resolution.
 *
 * Use cases:
 * - Verify uncertain matches (similarity 0.5-0.7) before merging
 * - Catch false negatives from pure string/embedding matching
 * - Improve recall for entities with very different surface forms
 *
 * @since 2.0.0
 */
export const makeLlmVerificationActivity = (input: LlmVerificationInput) =>
  Activity.make({
    name: `llm-verification-${input.batchId}`,
    success: LlmVerificationOutput,
    error: ActivityError,
    execute: Effect.gen(function*() {
      const start = yield* DateTime.now
      const config = yield* ConfigService
      const timeout = yield* StageTimeoutService
      const llm = yield* LanguageModel.LanguageModel

      const threshold = O.getOrElse(input.verificationThreshold, () => DEFAULT_VERIFICATION_THRESHOLD)

      // Filter pairs that need verification (below threshold)
      const pairsToVerify = input.entityPairs.filter((p) => p.similarity < threshold)
      const skippedCount = input.entityPairs.length - pairsToVerify.length

      yield* Effect.logInfo("LLM verification activity starting", {
        batchId: input.batchId,
        totalPairs: input.entityPairs.length,
        pairsToVerify: pairsToVerify.length,
        skipped: skippedCount,
        threshold
      })

      if (pairsToVerify.length === 0) {
        const end = yield* DateTime.now
        return {
          verified: [],
          rejected: [],
          skipped: skippedCount,
          totalProcessed: 0,
          durationMs: Duration.toMillis(DateTime.distance(start, end))
        }
      }

      const verified: Array<VerifiedPair> = []
      const rejected: Array<VerifiedPair> = []

      // Process in batches
      for (let i = 0; i < pairsToVerify.length; i += VERIFICATION_BATCH_SIZE) {
        const batch = pairsToVerify.slice(i, i + VERIFICATION_BATCH_SIZE)

        if (batch.length === 1) {
          // Single pair: use focused prompt
          const pair = batch[0]
          const prompt = buildComparisonPrompt(pair)

          const result = yield* timeout.withTimeout(
            "entity_verification",
            generateObjectWithRetry({
              llm,
              prompt,
              schema: EntityComparisonSchema,
              objectName: "EntityComparison",
              serviceName: "LlmVerification",
              model: config.llm.model,
              provider: config.llm.provider,
              retryConfig: {
                initialDelayMs: config.runtime.retryInitialDelayMs,
                maxDelayMs: config.runtime.retryMaxDelayMs,
                maxAttempts: config.runtime.retryMaxAttempts,
                timeoutMs: config.llm.timeoutMs
              },
              spanAttributes: {
                [LlmAttributes.PROMPT_LENGTH]: prompt.length,
                "verification.pair_index": i
              }
            }),
            () =>
              Effect.logWarning("Entity verification approaching timeout", {
                batchId: input.batchId,
                pairIndex: i
              })
          )

          const verifiedPair: VerifiedPair = {
            entityA: pair.entityA,
            entityB: pair.entityB,
            sameEntity: result.value.sameEntity,
            confidence: result.value.confidence,
            originalSimilarity: pair.similarity
          }

          if (result.value.sameEntity) {
            verified.push(verifiedPair)
          } else {
            rejected.push(verifiedPair)
          }
        } else {
          // Batch verification
          const prompt = buildBatchComparisonPrompt(batch)

          const result = yield* timeout.withTimeout(
            "entity_verification",
            generateObjectWithRetry({
              llm,
              prompt,
              schema: BatchComparisonSchema,
              objectName: "BatchEntityComparison",
              serviceName: "LlmVerification",
              model: config.llm.model,
              provider: config.llm.provider,
              retryConfig: {
                initialDelayMs: config.runtime.retryInitialDelayMs,
                maxDelayMs: config.runtime.retryMaxDelayMs,
                maxAttempts: config.runtime.retryMaxAttempts,
                timeoutMs: config.llm.timeoutMs * 2
              },
              spanAttributes: {
                [LlmAttributes.PROMPT_LENGTH]: prompt.length,
                "verification.batch_size": batch.length,
                "verification.batch_start": i
              }
            }),
            () =>
              Effect.logWarning("Batch entity verification approaching timeout", {
                batchId: input.batchId,
                batchStart: i,
                batchSize: batch.length
              })
          )

          // Map results back to pairs
          type ComparisonResult = { index: number; sameEntity: boolean; confidence: number }
          const resultsMap = new Map(
            (result.value.results as ReadonlyArray<ComparisonResult>).map((r) => [r.index, r])
          )

          batch.forEach((pair, idx) => {
            const llmResult = resultsMap.get(idx)
            const verifiedPair: VerifiedPair = {
              entityA: pair.entityA,
              entityB: pair.entityB,
              sameEntity: llmResult?.sameEntity ?? false,
              confidence: llmResult?.confidence ?? 0,
              originalSimilarity: pair.similarity
            }

            if (llmResult?.sameEntity) {
              verified.push(verifiedPair)
            } else {
              rejected.push(verifiedPair)
            }
          })
        }
      }

      const end = yield* DateTime.now

      yield* Effect.logInfo("LLM verification activity complete", {
        batchId: input.batchId,
        verified: verified.length,
        rejected: rejected.length,
        skipped: skippedCount,
        totalProcessed: pairsToVerify.length,
        durationMs: Duration.toMillis(DateTime.distance(start, end))
      })

      return {
        verified,
        rejected,
        skipped: skippedCount,
        totalProcessed: pairsToVerify.length,
        durationMs: Duration.toMillis(DateTime.distance(start, end))
      }
    }).pipe(Effect.mapError(toActivityError)),
    interruptRetryPolicy: activityRetryPolicy
  })

// -----------------------------------------------------------------------------
// Document Preprocessing Activity
// -----------------------------------------------------------------------------

/**
 * LLM response schema for document classification
 *
 * Used to classify document type, extract domain tags, and estimate complexity.
 */
const DocumentClassificationResponse = Schema.Struct({
  /** Classified document type */
  documentType: Schema.Literals(["article", "transcript", "report", "contract", "correspondence", "reference", "narrative", "structured", "unknown"]).annotate({
    description: "Document structure/type classification"
  }),
  /** Domain/topic tags extracted from content */
  domainTags: Schema.Array(Schema.String).annotate({
    description: "2-5 domain tags describing the document topic"
  }),
  /** Complexity score 0-1 */
  complexityScore: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })).annotate({
    description: "Document complexity (0=simple, 1=complex)"
  }),
  /** Entity density estimation */
  entityDensity: Schema.Literals(["sparse", "moderate", "dense"]).annotate({
    description: "Estimated entity density"
  }),
  /** Optional detected language */
  language: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
    description: "Detected language code (ISO 639-1)"
  }),
  /** Optional extracted title */
  title: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
    description: "Document title if detectable"
  })
})

/**
 * Batch classification response for multiple documents
 */
const BatchClassificationResponse = Schema.Struct({
  classifications: Schema.Array(
    Schema.Struct({
      /** Document index in the batch (0-based) */
      index: Schema.Number,
      /** Classification result */
      classification: DocumentClassificationResponse
    })
  )
})

/**
 * Output schema for preprocessing activity
 */
export const PreprocessingOutput = Schema.Struct({
  enrichedManifestUri: GcsUri,
  totalDocuments: Schema.Number,
  classifiedCount: Schema.Number,
  failedCount: Schema.Number,
  totalEstimatedTokens: Schema.Number,
  averageComplexity: Schema.Number,
  durationMs: Schema.Number
})
export type PreprocessingOutput = typeof PreprocessingOutput.Type

/** Preview size in bytes for classification */
const PREVIEW_SIZE = 4096

/** Batch size for LLM classification calls */
/**
 * Build classification prompt for a batch of document previews
 */
const buildClassificationPrompt = (
  previews: ReadonlyArray<{ index: number; preview: string; contentType: string }>
): string => {
  const docSummaries = previews.map(({ contentType, index, preview }) =>
    `Document ${index} (${contentType}):\n"""${preview.slice(0, 1500)}"""`
  ).join("\n\n---\n\n")

  return `You are a document classification assistant. Analyze the following document previews and classify each one.

For each document, determine:
1. **documentType**: The structural type (article, transcript, report, contract, correspondence, reference, narrative, structured, unknown)
2. **domainTags**: 2-5 topic tags describing what the document is about
3. **complexityScore**: How complex is the language/structure? (0=very simple, 1=highly technical/complex)
4. **entityDensity**: How many named entities per paragraph?
   - "sparse": Few entities, mostly prose
   - "moderate": Average density
   - "dense": Many entities (lists, tables, rosters)
5. **language**: ISO 639-1 code if detectable (e.g., "en", "es")
6. **title**: Document title if visible

${docSummaries}

Respond with classifications for each document by index.`
}

/**
 * Durable Preprocessing Activity
 *
 * Preprocesses documents in a batch to extract metadata for intelligent batching:
 * - Loads document previews (first ${PREVIEW_SIZE} bytes)
 * - Classifies documents using LLM in batches
 * - Computes chunking strategies and priorities
 * - Creates EnrichedManifest for downstream processing
 *
 * @since 2.3.0
 */
export const makePreprocessingActivity = (input: PreprocessingActivityInput) =>
  Activity.make({
    name: `preprocessing-${input.batchId}`,
    success: PreprocessingOutput,
    error: ActivityError,
    execute: Effect.gen(function*() {
              const start = yield* DateTime.now
              const storage = yield* StorageService
              const config = yield* ConfigService
              const llm = yield* LanguageModel.LanguageModel
              const bucket = resolveBucket(config)

              // Resolve preprocessing options (use defaults if not provided)
              // Support both new preprocessing options and deprecated skipClassification
              const shouldClassify = input.preprocessing.classifyDocuments
              const options = {
                classifyDocuments: shouldClassify,
                adaptiveChunking: input.preprocessing.adaptiveChunking,
                priorityOrdering: input.preprocessing.priorityOrdering,
                chunkingStrategyOverride: O.getOrUndefined(input.preprocessing.chunkingStrategyOverride),
                classificationBatchSize: input.preprocessing.classificationBatchSize
              }

              yield* Effect.logInfo("Preprocessing activity starting", {
                batchId: input.batchId,
                manifestUri: input.manifestUri,
                options
              })

              // 1. Load the batch manifest
              const manifestPath = stripGsPrefix(input.manifestUri)
              const manifestContent = yield* storage.get(manifestPath).pipe(
                Effect.flatMap((opt) => requireContent(O.fromNullishOr(opt), manifestPath))
              )
              const manifest = yield* Schema.decodeUnknownEffect(BatchManifest)(JSON.parse(manifestContent)).pipe(
                Effect.mapError((e) => notFoundError("BatchManifest", `Parse error: ${e}`))
              )

              yield* Effect.logInfo("Manifest loaded", {
                batchId: input.batchId,
                documentCount: manifest.documents.length
              })

              // 2. Load document previews (first PREVIEW_SIZE bytes of each)
              const previews = yield* Effect.forEach(
                manifest.documents,
                (doc, index) =>
                  Effect.gen(function*() {
                    const sourcePath = stripGsPrefix(doc.sourceUri)
                    const content = yield* storage.get(sourcePath).pipe(
                      Effect.map((opt) => (opt ?? (() => "")())),
                      Effect.catch((error) =>
                        Effect.gen(function*() {
                          yield* Effect.logWarning("Failed to load document for preview", {
                            documentId: doc.documentId,
                            sourcePath,
                            error: String(error)
                          })
                          return ""
                        })
                      )
                    )
                    return {
                      index,
                      documentId: doc.documentId,
                      sourceUri: doc.sourceUri,
                      contentType: doc.contentType,
                      sizeBytes: doc.sizeBytes,
                      preview: content.slice(0, PREVIEW_SIZE)
                    }
                  }),
                { concurrency: 10 }
              )

              yield* Effect.logInfo("Document previews loaded", {
                batchId: input.batchId,
                previewCount: previews.length
              })

              // 3. Classify documents (skip if requested)
              const preprocessedAt = yield* DateTime.now

              let documentMetadata: Array<DocumentMetadata>
              let classifiedCount = 0
              let failedCount = 0

              if (!options.classifyDocuments) {
                // Use defaults for all documents (no classification)
                // Apply chunkingStrategyOverride if provided
                const overrideStrategy = options.chunkingStrategyOverride
                documentMetadata = previews.map((p) => {
                  const fallback = DocumentMetadata.fallback({
                    documentId: p.documentId,
                    sourceUri: p.sourceUri,
                    contentType: p.contentType,
                    sizeBytes: NonNegativeInt.make(p.sizeBytes),
                    preprocessedAt
                  })
                  if (overrideStrategy === undefined) return fallback
                  const params = ChunkingStrategy.parameters(overrideStrategy)
                  return DocumentMetadata.make({
                    ...fallback,
                    chunkingStrategy: overrideStrategy,
                    suggestedChunkSize: params.chunkSize,
                    suggestedOverlap: params.overlapSentences
                  })
                })
                failedCount = previews.length
              } else {
                // Batch LLM classification
                const classifications = new Map<number, typeof DocumentClassificationResponse.Type>()

                // Process in batches (use configurable batch size)
                const batchSize = options.classificationBatchSize
                for (let i = 0; i < previews.length; i += batchSize) {
                  const batch = previews.slice(i, i + batchSize)
                  const batchPreviews = batch.map((p) => ({
                    index: p.index,
                    preview: p.preview,
                    contentType: p.contentType
                  }))

                  yield* Effect.logDebug("Classifying batch", {
                    batchId: input.batchId,
                    batchStart: i,
                    batchSize: batch.length
                  })

                  const result = yield* generateObjectWithRetry({
                    llm,
                    prompt: buildClassificationPrompt(batchPreviews),
                    schema: BatchClassificationResponse,
                    objectName: "batch_classification",
                    serviceName: "Preprocessing",
                    model: config.llm.model,
                    provider: config.llm.provider,
                    retryConfig: {
                      initialDelayMs: 1000,
                      maxDelayMs: 30000,
                      maxAttempts: 3,
                      timeoutMs: 60000
                    },
                    spanAttributes: {
                      "preprocessing.batch_id": input.batchId,
                      "preprocessing.batch_start": i,
                      "preprocessing.batch_size": batch.length
                    }
                  }).pipe(
                    Effect.catch((error) => {
                      // Log error but continue with defaults
                      return Effect.gen(function*() {
                        yield* Effect.logWarning("Classification batch failed, using defaults", {
                          batchId: input.batchId,
                          batchStart: i,
                          error: String(error)
                        })
                        return { value: { classifications: [] } }
                      })
                    })
                  )

                  // Store classifications by index
                  for (const item of result.value.classifications) {
                    classifications.set(item.index, item.classification)
                  }
                }

                // 4. Build DocumentMetadata for each document
                documentMetadata = previews.map((p) => {
                  const classification = classifications.get(p.index)

                  if (classification) {
                    classifiedCount++
                    const tokens = DocumentMetadata.estimateTokens(p.sizeBytes)

                    const complexityScore = UnitInterval.make(classification.complexityScore)
                    const strategy = options.chunkingStrategyOverride ?? (options.adaptiveChunking
                      ? ChunkingStrategy.recommend(
                        classification.documentType,
                        classification.entityDensity,
                        complexityScore
                      )
                      : ChunkingStrategy.Enum.standard)
                    const chunkParameters = ChunkingStrategy.parameters(strategy)

                    const priority = DocumentMetadata.computePriority(
                      complexityScore,
                      tokens,
                      classification.entityDensity
                    )

                    return DocumentMetadata.make({
                      documentId: p.documentId,
                      sourceUri: p.sourceUri,
                      contentType: p.contentType,
                      sizeBytes: NonNegativeInt.make(p.sizeBytes),
                      eventTime: O.none(),
                      publishedAt: O.none(),
                      ingestedAt: preprocessedAt,
                      preprocessedAt,
                      title: classification.title,
                      language: LanguageCode.make(O.getOrElse(classification.language, () => "en")),
                      estimatedTokens: tokens,
                      documentType: classification.documentType,
                      domainTags: classification.domainTags,
                      complexityScore,
                      entityDensityHint: classification.entityDensity,
                      chunkingStrategy: strategy,
                      suggestedChunkSize: chunkParameters.chunkSize,
                      suggestedOverlap: chunkParameters.overlapSentences,
                      priority,
                      estimatedExtractionCost: NonNegativeInt.make(tokens * 2)
                    })
                  } else {
                    // Use defaults for failed classifications
                    failedCount++
                    return DocumentMetadata.fallback({
                      documentId: p.documentId,
                      sourceUri: p.sourceUri,
                      contentType: p.contentType,
                      sizeBytes: NonNegativeInt.make(p.sizeBytes),
                      preprocessedAt
                    })
                  }
                })
              }

              // 5. Sort by priority if enabled (lower = process first)
              if (options.priorityOrdering) {
                documentMetadata.sort((a, b) => a.priority - b.priority)
              }

              // 6. Compute stats
              const totalEstimatedTokens = documentMetadata.reduce((sum, d) => sum + d.estimatedTokens, 0)
              const avgComplexity = documentMetadata.reduce((sum, d) => sum + d.complexityScore, 0) / documentMetadata.length
              const typeDistribution: Record<string, NonNegativeInt> = {}
              for (const d of documentMetadata) {
                typeDistribution[d.documentType] = NonNegativeInt.make((typeDistribution[d.documentType] ?? 0) + 1)
              }

              // 7. Compute duration and create EnrichedManifest
              const end = yield* DateTime.now
              const durationMs = Duration.toMillis(DateTime.distance(start, end))

              const enrichedManifest: EnrichedManifest = {
                batchId: manifest.batchId,
                ontologyUri: manifest.ontologyUri,
                ontologyVersion: manifest.ontologyVersion,
                shaclUri: manifest.shaclUri,
                targetNamespace: manifest.targetNamespace,
                documents: documentMetadata,
                createdAt: manifest.createdAt,
                preprocessedAt,
                preprocessingStats: {
                  totalDocuments: NonNegativeInt.make(documentMetadata.length),
                  classifiedCount: NonNegativeInt.make(classifiedCount),
                  failedCount: NonNegativeInt.make(failedCount),
                  totalEstimatedTokens: NonNegativeInt.make(totalEstimatedTokens),
                  preprocessingDurationMs: durationMs,
                  averageComplexity: UnitInterval.make(avgComplexity),
                  documentTypeDistribution: typeDistribution
                }
              }

              // 8. Write enriched manifest to storage
              const enrichedManifestPath = PathLayout.batch.enrichedManifest(input.batchId)
              yield* storage.set(enrichedManifestPath, JSON.stringify(enrichedManifest, null, 2))

              yield* Effect.logInfo("Preprocessing activity complete", {
                batchId: input.batchId,
                totalDocuments: documentMetadata.length,
                classifiedCount,
                failedCount,
                totalEstimatedTokens,
                averageComplexity: avgComplexity,
                durationMs
              })

              return {
                enrichedManifestUri: GcsUri.fromUnknown(`gs://${bucket}/${enrichedManifestPath}`),
                totalDocuments: documentMetadata.length,
                classifiedCount,
                failedCount,
                totalEstimatedTokens,
                averageComplexity: avgComplexity,
                durationMs
              }
            }).pipe(Effect.mapError(toActivityError)),
    interruptRetryPolicy: activityRetryPolicy
  })
