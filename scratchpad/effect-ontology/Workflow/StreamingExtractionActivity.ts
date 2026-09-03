/**
 * Workflow: Streaming Extraction Activity
 *
 * **Details**
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
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { provBundleToDataset } from "@beep/rdf/ProvRdf";
import { NonNegativeInt, NonNegNum, PosInt } from "@beep/schema";
import { Crypto, DateTime, Duration, Effect, Encoding, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Activity } from "effect/unstable/workflow";
import { ActivityError, notFoundError, toActivityError } from "../Domain/Error/Activity.ts";
import { ContentHash, DocumentId, GcsUri, Namespace, OntologyName } from "../Domain/Identity.ts";
import { Entity, KnowledgeGraph } from "../Domain/Model/Entity.ts";
import { ChunkingConfig, GroundingPolicy, LlmConfig, RunConfig } from "../Domain/Model/ExtractionRun.ts";
import { OntologyRef } from "../Domain/Model/Ontology.ts";
import { PathLayout } from "../Domain/PathLayout.ts";
import type { ExtractionActivityInput } from "../Domain/Schema/Batch.ts";
// Note: ClaimPersistenceService removed - claims persist only after validation
// via makeClaimPersistenceActivity in WorkflowOrchestrator
import { ConfigService } from "../Service/Config.ts";
import { ExtractionWorkflow } from "../Service/ExtractionWorkflow.ts";
import { RdfBuilder, rdfStoreAddQuad } from "../Service/Rdf.ts";
import { StorageService } from "../Service/Storage.ts";
import { activityRetryPolicy } from "../Utils/Activity.ts";
import {
  ClaimExtractionArtifact,
  claimExtractionArtifactToQuads,
  claimsDataToQuads,
  knowledgeGraphToClaims,
} from "../Utils/ClaimFactory.ts";
import { dual3 } from "../Utils/Dual.ts";
import { makeProvenanceUri } from "../Utils/Provenance.ts";

const $I = $ScratchpadId.create("effect-ontology/Workflow/StreamingExtractionActivity");
const isActivityError = S.is(ActivityError);
const preserveActivityError = (error: unknown): ActivityError =>
  isActivityError(error) ? error : toActivityError(error);
const textEncoder = new TextEncoder();

// -----------------------------------------------------------------------------
// Output Schema
// -----------------------------------------------------------------------------

/**
 * Output schema for StreamingExtractionActivity
 *
 * **Details**
 *
 * Describes the persisted graph and extraction counts produced for one document.
 *
 * The schema is local to the canonical streaming activity so its output contract
 * cannot drift from a retired activity implementation.
 *
 * **Example** (Decode a streaming extraction output)
 *
 * ```ts
 * import { StreamingExtractionOutput } from "@effect-ontology/Workflow/StreamingExtractionActivity"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(StreamingExtractionOutput)({
 *   documentId: "doc-deadbeefcafe",
 *   graphUri: "gs://beep-ontology-state/docs/doc-deadbeefcafe.ttl",
 *   entityCount: 2,
 *   relationCount: 1,
 *   claimCount: 3,
 *   durationMs: 88
 * })
 * console.log(O.map(decoded, (output) => output.entityCount))
 * ```
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
  entityCount: NonNegativeInt.pipe(
    $I.annoteKey("StreamingExtractionOutput.entityCount", {
      description: "Number of entities written to the graph.",
    })
  ),
  /** Number of relations written to the graph. */
  relationCount: NonNegativeInt.pipe(
    $I.annoteKey("StreamingExtractionOutput.relationCount", {
      description: "Number of relations written to the graph.",
    })
  ),
  /** Number of claims derived from the extracted graph. */
  claimCount: NonNegativeInt.pipe(
    $I.annoteKey("StreamingExtractionOutput.claimCount", {
      description: "Number of claims derived from the extracted graph.",
    })
  ),
  /** Total extraction duration in milliseconds. */
  durationMs: NonNegNum.pipe(
    $I.annoteKey("StreamingExtractionOutput.durationMs", {
      description: "Total extraction duration in milliseconds.",
    })
  ),
}).pipe(
  $I.annoteSchema("StreamingExtractionOutput", {
    description: "Output produced by the canonical streaming extraction activity.",
  })
);

/**
 * Decoded streaming extraction output produced by {@link StreamingExtractionOutput}.
 *
 * @see {@link StreamingExtractionOutput} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type StreamingExtractionOutput = typeof StreamingExtractionOutput.Type;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const stripGsPrefix = (uri: string): string =>
  Str.startsWith("gs://")(uri) ? Str.replace(/^gs:\/\/[^/]+\//, "")(uri) : uri;

const requireContent = (opt: O.Option<string>, key: string) =>
  Effect.fromOption(opt, () => notFoundError("StorageObject", key));

const resolveBucket = (config: { storage: { bucket: O.Option<string> } }) =>
  O.getOrElse(config.storage.bucket, () => "local-bucket");

// -----------------------------------------------------------------------------
// Config Builders
// -----------------------------------------------------------------------------

/**
 * Computes the canonical SHA-256 identity for document content.
 */
const computeContentHash = Effect.fn("StreamingExtractionActivity.computeContentHash")(function* (content: string) {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto.digest("SHA-256", textEncoder.encode(content));
  return yield* ContentHash.decodeEffect(Encoding.encodeHex(digest));
});

/** Extracts the ontology name component from a storage URI path. */
const extractOntologyName = (uri: string): OntologyName => {
  const path = stripGsPrefix(uri);
  const filename = pipe(
    Str.split("/")(path),
    A.last,
    O.getOrElse(() => "ontology")
  );
  const name = Str.replace(/\.(ttl|rdf|owl|n3)$/, "")(filename);
  // Ensure valid OntologyName pattern (alphanumeric + hyphens + underscores)
  const sanitized = pipe(name, Str.replace(/[^a-zA-Z0-9_-]/g, "-"), Str.toLowerCase);
  return OntologyName.make(Str.isNonEmpty(sanitized) ? sanitized : "ontology");
};

/**
 * Build RunConfig from ExtractionActivityInput
 *
 * **Details**
 *
 * Translates the batch activity input (with preprocessing hints) to the
 * RunConfig format expected by StreamingExtraction.
 *
 * **Example** (Map batch input to chunking and grounding)
 *
 * ```ts
 * import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan"
 * import { PosInt } from "@beep/schema/Int"
 * import { Duration } from "effect"
 * import { BatchId, ContentHash, DocumentId, GcsUri, Namespace, OntologyName } from "@effect-ontology/Identity"
 * import { ExtractionActivityInput } from "@effect-ontology/Schema/Batch"
 * import { buildRunConfig } from "@effect-ontology/Workflow/StreamingExtractionActivity"
 * import * as S from "effect/Schema"
 *
 * const input = ExtractionActivityInput.make({
 *   batchId: BatchId.make("batch-deadbeefcafe"),
 *   documentId: DocumentId.make("doc-deadbeefcafe"),
 *   sourceUri: S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/docs/doc-deadbeefcafe.txt"),
 *   ontologyUri: S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/ontologies/foaf.ttl"),
 *   ontologyId: OntologyName.make("foaf"),
 *   targetNamespace: Namespace.make("foaf")
 * })
 * const config = buildRunConfig(input, {
 *   model: "claude-haiku-4-5",
 *   temperature: 0.1,
 *   maxTokens: 1024,
 *   timeout: Duration.seconds(30),
 *   groundingEnabled: true,
 *   groundingThreshold: Confidence.make(0.8),
 *   groundingBatchSize: PosInt.make(8)
 * }, ContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"))
 * console.log(config.chunking.maxChunkSize)
 * console.log(config.grounding.mode)
 * ```
 *
 * @param input - Extraction activity input with optional preprocessing hints
 * @param llmConfig - LLM configuration from ConfigService
 * @param ontologyContentHash - Pre-computed hash of ontology CONTENT (not URI)
 * @returns RunConfig for StreamingExtraction
 * @category factories
 * @since 0.0.0
 */
export const buildRunConfig = dual3(
  (
    input: ExtractionActivityInput,
    llmConfig: {
      model: string;
      temperature: number;
      maxTokens: number;
      timeout: Duration.Duration;
      groundingEnabled: boolean;
      groundingThreshold: Confidence;
      groundingBatchSize: PosInt;
    },
    ontologyContentHash: ContentHash
  ): RunConfig => {
    // Build OntologyRef from the ontology URI
    // Use content hash for cache invalidation when ontology changes
    const ontologyRef = OntologyRef.make({
      namespace: Namespace.make(input.targetNamespace),
      name: extractOntologyName(input.ontologyUri),
      contentHash: ontologyContentHash,
    });

    // Build ChunkingConfig - use preprocessing hints if available, otherwise defaults
    const chunkingConfig = ChunkingConfig.make({
      maxChunkSize: PosInt.make(input.chunking.chunkSize),
      preserveSentences: input.chunking.preserveSentences,
      overlapSentences: NonNegativeInt.make(2),
    });

    // Build LlmConfig from service config
    const llmConfigSchema = LlmConfig.make({
      model: llmConfig.model,
      temperature: llmConfig.temperature,
      maxTokens: PosInt.make(llmConfig.maxTokens),
      timeout: llmConfig.timeout,
    });

    return RunConfig.make({
      ontology: ontologyRef,
      chunking: chunkingConfig,
      llm: llmConfigSchema,
      concurrency: PosInt.make(5), // Default concurrency
      grounding: llmConfig.groundingEnabled
        ? GroundingPolicy.cases.Enabled.make({
            threshold: llmConfig.groundingThreshold,
            batchSize: llmConfig.groundingBatchSize,
          })
        : GroundingPolicy.cases.Disabled.make({}),
    });
  }
);

/**
 * Enrich extracted entities with document-level metadata
 *
 * **Details**
 *
 * Adds provenance information to each entity for traceability.
 *
 * **Example** (Stamp a document id onto an extracted entity)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 * import { BatchId, DocumentId, GcsUri, Namespace, OntologyName } from "@effect-ontology/Identity"
 * import { Entity } from "@effect-ontology/Model/Entity"
 * import { EntityId } from "@effect-ontology/Model/shared"
 * import { ExtractionActivityInput } from "@effect-ontology/Schema/Batch"
 * import { enrichEntityMetadata } from "@effect-ontology/Workflow/StreamingExtractionActivity"
 * import * as S from "effect/Schema"
 *
 * const input = ExtractionActivityInput.make({
 *   batchId: BatchId.make("batch-deadbeefcafe"),
 *   documentId: DocumentId.make("doc-deadbeefcafe"),
 *   sourceUri: S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/docs/doc-deadbeefcafe.txt"),
 *   ontologyUri: S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/ontologies/foaf.ttl"),
 *   ontologyId: OntologyName.make("foaf"),
 *   targetNamespace: Namespace.make("foaf")
 * })
 * const enriched = enrichEntityMetadata(
 *   [
 *     Entity.make({
 *       id: EntityId.make("ada_lovelace"),
 *       mention: "Ada Lovelace",
 *       types: [IRI.make("https://schema.org/Person")]
 *     })
 *   ],
 *   input,
 *   DateTime.makeUnsafe("2026-08-26T00:00:00.000Z")
 * )
 * console.log(O.getOrUndefined(enriched[0]?.documentId))
 * ```
 *
 * @param entities - Extracted entities from StreamingExtraction
 * @param input - Original extraction input with document metadata
 * @param extractedAt - Timestamp of extraction
 * @returns Enriched entities with document metadata
 * @category workflows
 * @since 0.0.0
 */
export const enrichEntityMetadata = dual3(
  (entities: ReadonlyArray<Entity>, input: ExtractionActivityInput, extractedAt: DateTime.Utc): ReadonlyArray<Entity> =>
    A.map(entities, (entity) =>
      Entity.make({
        ...entity,
        documentId: O.some(input.documentId),
        sourceUri: O.some(input.sourceUri),
        extractedAt: O.some(extractedAt),
        // Inherit eventTime from document metadata (if available)
        eventTime: O.orElse(input.eventTime, () => entity.eventTime),
      })
    )
);

// -----------------------------------------------------------------------------
// Streaming Extraction Activity
// -----------------------------------------------------------------------------

/**
 * Durable Streaming Extraction Activity
 *
 * **Details**
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
 * **Example** (Name the canonical streaming extraction activity)
 *
 * ```ts
 * import { BatchId, DocumentId, GcsUri, Namespace, OntologyName } from "@effect-ontology/Identity"
 * import { ExtractionActivityInput } from "@effect-ontology/Schema/Batch"
 * import { makeStreamingExtractionActivity } from "@effect-ontology/Workflow/StreamingExtractionActivity"
 * import * as S from "effect/Schema"
 *
 * const activity = makeStreamingExtractionActivity(
 *   ExtractionActivityInput.make({
 *     batchId: BatchId.make("batch-deadbeefcafe"),
 *     documentId: DocumentId.make("doc-deadbeefcafe"),
 *     sourceUri: S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/docs/doc-deadbeefcafe.txt"),
 *     ontologyUri: S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/ontologies/foaf.ttl"),
 *     ontologyId: OntologyName.make("foaf"),
 *     targetNamespace: Namespace.make("foaf")
 *   })
 * )
 * console.log(activity.name)
 * ```
 *
 * @param input - Extraction activity input (from batch workflow)
 * @returns Durable activity with journaled execution
 * @category constructors
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
        .getOption(sourceKey)
        .pipe(Effect.flatMap((opt) => requireContent(opt, sourceKey)));

      yield* Effect.logInfo("Source document loaded", {
        documentId: input.documentId,
        contentLength: sourceContent.length,
      });

      // 2. Load ontology and compute content hash for cache invalidation
      const ontologyKey = stripGsPrefix(input.ontologyUri);
      const ontologyContent = yield* storage.getOption(ontologyKey).pipe(
        Effect.flatMap((opt) => requireContent(opt, ontologyKey)),
        Effect.mapError((error) =>
          ActivityError.serviceFailure("StorageService", `get ontology ${ontologyKey}`, error, true)
        )
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
          timeout: config.llm.retryPolicy.attemptTimeout,
          groundingEnabled: config.grounder.enabled,
          groundingThreshold: config.grounder.confidenceThreshold,
          groundingBatchSize: config.grounder.batchSize,
        },
        ontologyContentHash
      );

      yield* Effect.logInfo("RunConfig built for streaming extraction", {
        documentId: input.documentId,
        ontologyRef: runConfig.ontology.shortId,
        chunkSize: runConfig.chunking.maxChunkSize,
        concurrency: runConfig.concurrency,
        grounding: runConfig.grounding.mode,
      });

      // 4. Run 6-phase streaming extraction
      const outcome = yield* extractionWorkflow.extract(sourceContent, runConfig).pipe(
        Effect.withLogSpan("streaming-extraction-6-phase"),
        Effect.tap(({ graph, telemetry }) =>
          Effect.logInfo("Streaming extraction complete", {
            documentId: input.documentId,
            entityCount: graph.entities.length,
            relationCount: graph.relations.length,
            chunkCount: telemetry.chunkCount,
            tokenUsage: telemetry.usage._tag,
          })
        )
      );
      const rawGraph = outcome.graph;

      // 5. Enrich entities with document metadata
      const extractedAt = yield* DateTime.now;
      const enrichedEntities = enrichEntityMetadata(rawGraph.entities, input, extractedAt);

      const graph = KnowledgeGraph.make({
        entities: enrichedEntities,
        relations: rawGraph.relations,
        sourceText: O.some(sourceContent),
        provenance: rawGraph.provenance,
        entityObservations: rawGraph.entityObservations,
        relationObservations: rawGraph.relationObservations,
      });

      yield* Effect.logInfo("Entities enriched with document metadata", {
        documentId: input.documentId,
        entityCount: graph.entities.length,
        hasEventTime: O.isSome(input.eventTime),
      });

      // 6. Generate provenance URI and create claims
      const provenanceUri = makeProvenanceUri(input.batchId, input.documentId, undefined);

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
      const provenanceDataset = yield* Effect.fromResult(provBundleToDataset(graph.provenance));
      A.forEach(provenanceDataset.quads, (quad) => rdfStoreAddQuad(store, quad));

      // 7. Create claims from extracted entities and relations
      // Convert Namespace identifier to full IRI
      const baseDomain = pipe(
        Str.match(/^https?:\/\/[^/]+\//)(config.rdf.baseNamespace),
        O.flatMap(A.head),
        O.getOrElse(() => "https://example.org/")
      );
      const baseNamespace = `${baseDomain}${input.targetNamespace}/`;
      const claims = knowledgeGraphToClaims(graph.entities, graph.relations, {
        baseNamespace,
        documentId: input.documentId,
        ontologyId: input.ontologyId,
        defaultConfidence: Confidence.make(0.85),
      });

      // Convert claims to RDF quads and add to store
      const claimQuads = claimsDataToQuads(claims, provenanceUri, DateTime.formatIso(extractedAt));

      // Add claim quads to the store
      A.forEach(claimQuads, (quad) => rdfStoreAddQuad(store, quad));
      const extractionArtifactQuads = yield* claimExtractionArtifactToQuads(
        ClaimExtractionArtifact.make({
          claims,
          entityObservations: graph.entityObservations,
          relationObservations: graph.relationObservations,
        }),
        provenanceUri
      );
      A.forEach(extractionArtifactQuads, (quad) => rdfStoreAddQuad(store, quad));

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

      const graphUri = yield* GcsUri.decodeEffect(`gs://${bucket}/${graphPath}`);

      // Note: Claims are persisted only after SHACL validation passes,
      // via makeClaimPersistenceActivity in WorkflowOrchestrator.
      // This ensures only validated claims enter the database.

      const end = yield* DateTime.now;

      yield* Effect.logInfo("Streaming extraction activity complete", {
        batchId: input.batchId,
        documentId: input.documentId,
        entityCount: NonNegativeInt.make(graph.entities.length),
        relationCount: NonNegativeInt.make(graph.relations.length),
        claimCount: NonNegativeInt.make(claims.length),
        durationMs: NonNegNum.make(Duration.toMillis(DateTime.distance(start, end))),
      });

      return {
        documentId: input.documentId,
        graphUri,
        entityCount: NonNegativeInt.make(graph.entities.length),
        relationCount: NonNegativeInt.make(graph.relations.length),
        claimCount: NonNegativeInt.make(claims.length),
        durationMs: NonNegNum.make(Duration.toMillis(DateTime.distance(start, end))),
      };
    }).pipe(Effect.mapError(preserveActivityError)),
    interruptRetryPolicy: activityRetryPolicy,
  });
