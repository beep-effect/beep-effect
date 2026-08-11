/**
 * Workflow: Streaming Extraction Activity
 *
 * Durable activity wrapper for the 6-phase unified streaming extraction pipeline.
 * This is the single source of truth for all document extraction in batch workflows.
 *
 * Pipeline (delegated to StreamingExtraction):
 * 1. Chunking - Split document into processable segments
 * 2. Mention Detection - Extract entity mention spans
 * 3. Entity Extraction - LLM-based entity typing
 * 4. Property Scoping - Domain/range filtered properties
 * 5. Relation Extraction - LLM-based relation extraction
 * 6. Grounding - Filter relations by embedding similarity (≥0.8)
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $ScratchpadId } from "@beep/identity";
import { DateTime, Duration, Effect, Schedule } from "effect";
import * as Crypto from "effect/Crypto";
import * as Encoding from "effect/Encoding";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Activity } from "effect/unstable/workflow";
import { ActivityError, notFoundError, toActivityError } from "../Domain/Error/Activity.ts";
import type { BatchId, Namespace, OntologyName } from "../Domain/Identity.ts";
import { ContentHash, DocumentId, GcsUri } from "../Domain/Identity.ts";
import { Entity, KnowledgeGraph } from "../Domain/Model/Entity.ts";
import { ChunkingConfig, LlmConfig, RunConfig } from "../Domain/Model/ExtractionRun.ts";
import { OntologyRef } from "../Domain/Model/Ontology.ts";
import { PathLayout } from "../Domain/PathLayout.ts";
import type { ExtractionActivityInput } from "../Domain/Schema/Batch.ts";
// Note: ClaimPersistenceService removed - claims persist only after validation
// via makeClaimPersistenceActivity in WorkflowOrchestrator
import { ConfigService } from "../Service/Config.ts";
import { ExtractionWorkflow } from "../Service/ExtractionWorkflow.ts";
import { RdfBuilder } from "../Service/Rdf.ts";
import { StorageService } from "../Service/Storage.ts";
import { claimsDataToQuads, knowledgeGraphToClaims } from "../Utils/ClaimFactory.ts";
import { makeProvenanceUri } from "../Utils/Provenance.ts";

const $I = $ScratchpadId.create("effect-ontology/Workflow/StreamingExtractionActivity");
const textEncoder = new TextEncoder();

// -----------------------------------------------------------------------------
// Output Schema
// -----------------------------------------------------------------------------

/**
 * Output schema for StreamingExtractionActivity
 *
 * Describes the persisted graph and extraction counts produced for one document.
 *
 * **Details**
 *
 * The schema is local to the canonical streaming activity so its output contract
 * cannot drift from a retired activity implementation.
 *
 * @category schemas
 * @since 0.0.0
 */
export const StreamingExtractionOutput = S.Struct({
  /** Stable identifier of the extracted source document. */
  documentId: DocumentId.pipe(
    $I.annoteKey("StreamingExtractionOutput.documentId", {
      description: "Stable identifier of the extracted source document.",
    })
  ),
  /** Storage URI of the serialized knowledge graph. */
  graphUri: GcsUri.pipe(
    $I.annoteKey("StreamingExtractionOutput.graphUri", {
      description: "Storage URI of the serialized knowledge graph.",
    })
  ),
  /** Number of entities written to the graph. */
  entityCount: S.Finite.pipe(
    $I.annoteKey("StreamingExtractionOutput.entityCount", {
      description: "Number of entities written to the graph.",
    })
  ),
  /** Number of relations written to the graph. */
  relationCount: S.Finite.pipe(
    $I.annoteKey("StreamingExtractionOutput.relationCount", {
      description: "Number of relations written to the graph.",
    })
  ),
  /** Number of claims derived from the extracted graph. */
  claimCount: S.Finite.pipe(
    $I.annoteKey("StreamingExtractionOutput.claimCount", {
      description: "Number of claims derived from the extracted graph.",
    })
  ),
  /** Total extraction duration in milliseconds. */
  durationMs: S.Finite.pipe(
    $I.annoteKey("StreamingExtractionOutput.durationMs", {
      description: "Total extraction duration in milliseconds.",
    })
  ),
}).pipe(
  $I.annoteSchema("StreamingExtractionOutput", {
    description: "Output produced by the canonical streaming extraction activity.",
  })
);

/** Runtime output produced by the streaming extraction activity. */
export type StreamingExtractionOutput = typeof StreamingExtractionOutput.Type;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const stripGsPrefix = (uri: string): string =>
  Str.startsWith("gs://")(uri) ? uri.replace(/^gs:\/\/[^/]+\//, "") : uri;

const requireContent = (opt: O.Option<string>, key: string) =>
  O.match(opt, {
    onNone: () => Effect.fail(notFoundError("StorageObject", key)),
    onSome: Effect.succeed,
  });

const resolveBucket = (config: { storage: { bucket: O.Option<string> } }) =>
  O.getOrElse(config.storage.bucket, () => "local-bucket");

/**
 * Default retry policy for activities
 * - Exponential backoff starting at 1 second
 * - Max 3 attempts
 * - Jitter to prevent thundering herd
 */
const activityRetryPolicy = Schedule.max([Schedule.exponential("1 second"), Schedule.recurs(3)]).pipe(
  Schedule.jittered
);

// -----------------------------------------------------------------------------
// Config Builders
// -----------------------------------------------------------------------------

/**
 * Computes the canonical SHA-256 identity for document content.
 */
const computeContentHash = Effect.fn("StreamingExtractionActivity.computeContentHash")(function* (content: string) {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto.digest("SHA-256", textEncoder.encode(content));
  return yield* S.decodeEffect(ContentHash)(Encoding.encodeHex(digest));
});

/** Extracts the ontology name component from a storage URI path. */
const extractOntologyName = (uri: string): OntologyName => {
  const path = stripGsPrefix(uri);
  const filename = path.split("/").pop() ?? "ontology";
  const name = filename.replace(/\.(ttl|rdf|owl|n3)$/, "");
  // Ensure valid OntologyName pattern (alphanumeric + hyphens + underscores)
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  return (sanitized || "ontology") as OntologyName;
};

/**
 * Build RunConfig from ExtractionActivityInput
 *
 * Translates the batch activity input (with preprocessing hints) to the
 * RunConfig format expected by StreamingExtraction.
 *
 * @param input - Extraction activity input with optional preprocessing hints
 * @param llmConfig - LLM configuration from ConfigService
 * @param ontologyContentHash - Pre-computed hash of ontology CONTENT (not URI)
 * @returns RunConfig for StreamingExtraction
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const buildRunConfig = (
  input: ExtractionActivityInput,
  llmConfig: {
    model: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
  },
  ontologyContentHash: ContentHash
): RunConfig => {
  // Build OntologyRef from the ontology URI
  // Use content hash for cache invalidation when ontology changes
  const ontologyRef = OntologyRef.make({
    namespace: input.targetNamespace as Namespace,
    name: extractOntologyName(input.ontologyUri),
    contentHash: ontologyContentHash,
  });

  // Build ChunkingConfig - use preprocessing hints if available, otherwise defaults
  const chunkingConfig = ChunkingConfig.make({
    maxChunkSize: 500, // Default chunk size (TODO: get from preprocessing hints)
    preserveSentences: true,
    overlapTokens: 50,
  });

  // Build LlmConfig from service config
  const llmConfigSchema = LlmConfig.make({
    model: llmConfig.model,
    temperature: llmConfig.temperature,
    maxTokens: llmConfig.maxTokens,
    timeout: Duration.millis(llmConfig.timeoutMs),
  });

  return RunConfig.make({
    ontology: ontologyRef,
    chunking: chunkingConfig,
    llm: llmConfigSchema,
    concurrency: 5, // Default concurrency
    enableGrounding: true, // Always enable grounding for quality
  });
};

/**
 * Enrich extracted entities with document-level metadata
 *
 * Adds provenance information to each entity for traceability.
 *
 * @param entities - Extracted entities from StreamingExtraction
 * @param input - Original extraction input with document metadata
 * @param extractedAt - Timestamp of extraction
 * @returns Enriched entities with document metadata
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const enrichEntityMetadata = (
  entities: ReadonlyArray<Entity>,
  input: ExtractionActivityInput,
  extractedAt: DateTime.Utc
): ReadonlyArray<Entity> =>
  entities.map((entity) =>
    Entity.make({
      ...entity,
      documentId: O.some(input.documentId),
      sourceUri: O.some(input.sourceUri),
      extractedAt: O.some(extractedAt),
      // Inherit eventTime from document metadata (if available)
      eventTime: input.eventTime ?? entity.eventTime,
    })
  );

// -----------------------------------------------------------------------------
// Streaming Extraction Activity
// -----------------------------------------------------------------------------

/**
 * Durable Streaming Extraction Activity
 *
 * Unified extraction activity that uses the 6-phase streaming extraction pipeline.
 * This replaces makeExtractionActivity in DurableActivities.ts as the canonical
 * extraction path.
 *
 * Key differences from legacy makeExtractionActivity:
 * - Uses StreamingExtraction for the 6-phase pipeline
 * - Grounding verification is always enabled (≥0.8 threshold)
 * - Consistent with streaming/batch unification goal
 *
 * Pipeline:
 * 1. Read source document from storage
 * 2. Build RunConfig from input (with preprocessing hints)
 * 3. Call StreamingExtraction.extract() for 6-phase extraction
 * 4. Enrich entities with document metadata
 * 5. Convert to claims using knowledgeGraphToClaims()
 * 6. Serialize to RDF using claimsDataToQuads()
 * 7. Write graph to storage and return output
 *
 * @param input - Extraction activity input (from batch workflow)
 * @returns Durable activity with journaled execution
 *
 * @since 0.0.0
 */
export const makeStreamingExtractionActivity = (input: ExtractionActivityInput) =>
  Activity.make({
    name: `streaming-extraction-${input.documentId}`,
    success: StreamingExtractionOutput,
    error: ActivityError,
    execute: Effect.gen(function* () {
      const start = yield* DateTime.now;
      const storage = yield* StorageService;
      const config = yield* ConfigService;
      const extractionWorkflow = yield* ExtractionWorkflow;
      const rdf = yield* RdfBuilder;

      const bucket = resolveBucket(config);

      yield* Effect.logInfo("Streaming extraction activity starting", {
        batchId: input.batchId,
        documentId: input.documentId,
        sourceUri: input.sourceUri,
        ontologyUri: input.ontologyUri,
      });

      // 1. Read source document
      const sourceKey = stripGsPrefix(input.sourceUri);
      const sourceContent = yield* storage
        .get(sourceKey)
        .pipe(Effect.flatMap((opt) => requireContent(O.fromNullishOr(opt), sourceKey)));

      yield* Effect.logInfo("Source document loaded", {
        documentId: input.documentId,
        contentLength: sourceContent.length,
      });

      // 2. Load ontology and compute content hash for cache invalidation
      const ontologyKey = stripGsPrefix(input.ontologyUri);
      const ontologyContent = yield* storage.get(ontologyKey).pipe(
        Effect.flatMap((opt) => requireContent(O.fromNullishOr(opt), ontologyKey)),
        Effect.mapError((error) => toActivityError(new Error(`Failed to load ontology: ${ontologyKey} - ${error}`)))
      );
      const ontologyContentHash = yield* computeContentHash(ontologyContent);

      yield* Effect.logDebug("Ontology loaded for content hashing", {
        documentId: input.documentId,
        ontologyKey,
        contentHash: ontologyContentHash,
        contentLength: ontologyContent.length,
      });

      // 3. Build RunConfig from input with content-based hash
      const runConfig = buildRunConfig(
        input,
        {
          model: config.llm.model,
          temperature: 0.0, // Deterministic extraction
          maxTokens: config.llm.maxTokens,
          timeoutMs: config.llm.timeoutMs,
        },
        ontologyContentHash
      );

      yield* Effect.logInfo("RunConfig built for streaming extraction", {
        documentId: input.documentId,
        ontologyRef: runConfig.ontology.shortId,
        chunkSize: runConfig.chunking.maxChunkSize,
        concurrency: runConfig.concurrency,
        enableGrounding: runConfig.enableGrounding,
      });

      // 4. Run 6-phase streaming extraction
      const rawGraph = yield* extractionWorkflow.extract(sourceContent, runConfig).pipe(
        Effect.withLogSpan("streaming-extraction-6-phase"),
        Effect.tap((graph) =>
          Effect.logInfo("Streaming extraction complete", {
            documentId: input.documentId,
            entityCount: graph.entities.length,
            relationCount: graph.relations.length,
          })
        ),
        Effect.mapError((error) =>
          toActivityError(error instanceof Error ? error : new Error(`Streaming extraction failed: ${String(error)}`))
        )
      );

      // 5. Enrich entities with document metadata
      const extractedAt = yield* DateTime.now;
      const enrichedEntities = enrichEntityMetadata(rawGraph.entities, input, extractedAt);

      const graph = KnowledgeGraph.make({
        entities: Array.from(enrichedEntities),
        relations: rawGraph.relations,
        sourceText: O.some(sourceContent),
      });

      yield* Effect.logInfo("Entities enriched with document metadata", {
        documentId: input.documentId,
        entityCount: graph.entities.length,
        hasEventTime: input.eventTime !== undefined,
      });

      // 6. Generate provenance URI and create claims
      const provenanceUri = makeProvenanceUri(input.batchId as BatchId, input.documentId);

      // Serialize with named graph for provenance tracking
      const store = yield* rdf.createStore;
      yield* rdf.addEntities(store, graph.entities, {
        graphUri: provenanceUri,
        targetNamespace: input.targetNamespace,
      });
      yield* rdf.addRelations(store, graph.relations, {
        graphUri: provenanceUri,
        targetNamespace: input.targetNamespace,
      });

      // 7. Create claims from extracted entities and relations
      // Convert Namespace identifier to full IRI
      const match = config.rdf.baseNamespace.match(/^https?:\/\/[^/]+\//);
      const baseDomain = P.isNotNull(match) ? match[0] : "http://example.org/";
      const baseNamespace = `${baseDomain}${input.targetNamespace}/`;
      const claims = knowledgeGraphToClaims(graph.entities, graph.relations, {
        baseNamespace,
        documentId: input.documentId,
        ontologyId: input.ontologyId,
        defaultConfidence: 0.85,
      });

      // Convert claims to RDF quads and add to store
      const claimQuads = claimsDataToQuads(claims, provenanceUri, extractedAt.toString());

      // Add claim quads to the store
      for (const quad of claimQuads) {
        const n3 = yield* Effect.promise(() => import("n3"));
        const { DataFactory } = n3;
        const subject = DataFactory.namedNode(quad.subject as string);
        const predicate = DataFactory.namedNode(quad.predicate as string);

        // Handle object (IRI or Literal)
        let object: ReturnType<typeof DataFactory.namedNode> | ReturnType<typeof DataFactory.literal>;
        if (typeof quad.object === "string") {
          object = DataFactory.namedNode(quad.object);
        } else {
          const lit = quad.object;
          if (O.isSome(lit.datatype)) {
            object = DataFactory.literal(lit.value, DataFactory.namedNode(lit.datatype.value));
          } else if (O.isSome(lit.language)) {
            object = DataFactory.literal(lit.value, lit.language.value);
          } else {
            object = DataFactory.literal(lit.value);
          }
        }

        const graphNode = O.isSome(quad.graph) ? DataFactory.namedNode(quad.graph.value) : DataFactory.defaultGraph();

        store._store.addQuad(DataFactory.quad(subject, predicate, object, graphNode));
      }

      yield* Effect.logInfo("Claims created from extraction", {
        documentId: input.documentId,
        claimCount: claims.length,
        entityClaims: graph.entities.length * 2, // type + label claims per entity
        relationClaims: graph.relations.length,
      });

      const trigContent = yield* rdf.toTriG(store);

      yield* Effect.logInfo("Graph serialized to TriG with provenance and claims", {
        documentId: input.documentId,
        provenanceUri,
        trigLength: trigContent.length,
        claimCount: claims.length,
      });

      // 7. Save TriG graph to storage
      const graphPath = PathLayout.document.graph(input.documentId);
      yield* storage.set(graphPath, trigContent);

      const graphUri = GcsUri.fromUnknown(`gs://${bucket}/${graphPath}`);

      // Note: Claims are persisted only after SHACL validation passes,
      // via makeClaimPersistenceActivity in WorkflowOrchestrator.
      // This ensures only validated claims enter the database.

      const end = yield* DateTime.now;

      yield* Effect.logInfo("Streaming extraction activity complete", {
        batchId: input.batchId,
        documentId: input.documentId,
        entityCount: graph.entities.length,
        relationCount: graph.relations.length,
        claimCount: claims.length,
        durationMs: Duration.toMillis(DateTime.distance(start, end)),
      });

      return {
        documentId: input.documentId,
        graphUri,
        entityCount: graph.entities.length,
        relationCount: graph.relations.length,
        claimCount: claims.length,
        durationMs: Duration.toMillis(DateTime.distance(start, end)),
      };
    }).pipe(Effect.mapError(toActivityError)),
    interruptRetryPolicy: activityRetryPolicy,
  });
