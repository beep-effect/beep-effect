/**
 * Durable Workflow Activities
 *
 * **Details**
 *
 * Effect-native durable activities using @effect/workflow's Activity.make.
 * These activities are journaled by the WorkflowEngine for crash recovery.
 *
 * Architecture:
 * - Activity.make creates activities that integrate with WorkflowEngine
 * - Activities are automatically retried and journaled
 * - Each activity has typed success/error schemas for serialization
 *
 * **Gotchas**
 *
 * These activities require WorkflowEngine and WorkflowInstance context. For
 * standalone execution (for example ActivityRunner), use Activities.ts instead.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { IRI, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf";
import { datasetToProvBundle, provBundleToDataset } from "@beep/rdf/ProvRdf";
import { PROV_ACTIVITY, PROV_NAMESPACE, PROV_USED, PROV_WAS_GENERATED_BY } from "@beep/rdf/Vocab/Prov";
import { RDF_NAMESPACE, RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_LABEL } from "@beep/rdf/Vocab/Rdfs";
import { SchemaUtils } from "@beep/schema";
import { NonNegativeInt } from "@beep/schema/Int";
import { NonNegNum } from "@beep/schema/Number";
import { UnitInterval } from "@beep/schema/UnitInterval";
import type { ShaclValidationViolation } from "@beep/semantic-web/services/shacl-validation";
import {
  Cause,
  Chunk,
  DateTime,
  Duration,
  Effect,
  HashMap,
  Inspectable,
  MutableHashMap,
  MutableHashSet,
  Order,
  Schedule,
} from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LanguageModel } from "effect/unstable/ai";
import { Activity } from "effect/unstable/workflow";
import { ActivityError, ActivityGenericError, notFoundError, toActivityError } from "../Domain/Error/Activity.ts";
import { BatchId, ContentHash, GcsUri, OntologyName } from "../Domain/Identity.ts";
import { Entity, KnowledgeGraph, Relation, RelationObject } from "../Domain/Model/Entity.ts";
import { EntityResolutionConfig } from "../Domain/Model/EntityResolution.ts";
import { ElementEmbedding, OntologyEmbeddings, OntologyEmbeddingsJson } from "../Domain/Model/OntologyEmbeddings.ts";
import { EntityId } from "../Domain/Model/shared.ts";
import { PathLayout } from "../Domain/PathLayout.ts";
import { CLAIMS } from "../Domain/Rdf/Constants.ts";
import type {
  IngestionActivityInput,
  ResolutionActivityInput,
  ValidationActivityInput,
} from "../Domain/Schema/Batch.ts";
import { BatchManifest, ValidationActivityOutput, ValidationActivityViolationSummary } from "../Domain/Schema/Batch.ts";
import type { PreprocessingActivityInput } from "../Domain/Schema/DocumentMetadata.ts";
import {
  ChunkingStrategy,
  DocumentMetadata,
  EnrichedManifest,
  LanguageCode,
} from "../Domain/Schema/DocumentMetadata.ts";
import { ClaimPersistenceService } from "../Service/ClaimPersistence.ts";
import { ConfigService } from "../Service/Config.ts";
import { CrossBatchEntityResolver, CrossBatchResolverConfig } from "../Service/CrossBatchEntityResolver.ts";
import type { DocumentClassification } from "../Service/DocumentClassifier.ts";
import { BatchClassificationResponse } from "../Service/DocumentClassifier.ts";
import { EmbeddingService } from "../Service/Embedding.ts";
import { EntityResolutionService } from "../Service/EntityResolution.ts";
import { generateObjectWithRetry } from "../Service/LlmWithRetry.ts";
import { parseOntologyFromStore } from "../Service/Ontology.ts";
import type { RdfStore } from "../Service/Rdf.ts";
import { RdfBuilder, rdfStoreAddQuad, rdfStoreSize, rdfStoreToDataset } from "../Service/Rdf.ts";
import { Reasoner, ReasoningConfig } from "../Service/Reasoner.ts";
import { ShaclValidationReport, ShaclWorkflowService } from "../Service/Shacl.ts";
import { GenerationMismatchError, StorageService } from "../Service/Storage.ts";
import { LlmAttributes } from "../Telemetry/LlmAttributes.ts";
import { activityRetryPolicy } from "../Utils/Activity.ts";
import { claimExtractionArtifactFromQuads, knowledgeGraphToClaims } from "../Utils/ClaimFactory.ts";
import { extractLocalNameFromIri } from "../Utils/Iri.ts";
import { computeQuadDelta } from "../Utils/QuadDelta.ts";
import { refineKnowledgeGraph } from "../Utils/RefineKG.ts";
import { mergeGraphs } from "./Merge.ts";

const $I = $ScratchpadId.create("effect-ontology/Workflow/DurableActivities");
const PrettyShaclValidationReportFromJsonString = S.fromJsonString(ShaclValidationReport, { space: 2 }).pipe(
  SchemaUtils.withCodecStatics(["encodeEffect"])
);
const isActivityError = S.is(ActivityError);
const preserveActivityError = (error: unknown): ActivityError =>
  isActivityError(error) ? error : toActivityError(error);

const RDF_STATEMENT = makeNamedNode(`${RDF_NAMESPACE}Statement`);
const RDF_SUBJECT = makeNamedNode(`${RDF_NAMESPACE}subject`);
const RDF_PREDICATE = makeNamedNode(`${RDF_NAMESPACE}predicate`);
const RDF_OBJECT = makeNamedNode(`${RDF_NAMESPACE}object`);
const PROV_GENERATED_AT_TIME = makeNamedNode(`${PROV_NAMESPACE}generatedAtTime`);

// -----------------------------------------------------------------------------
// Output Schemas (must be serializable for journaling)
// -----------------------------------------------------------------------------

/**
 * Journaled success payload for {@link makeResolutionActivity}.
 *
 * **Example** (Decode a resolution output)
 *
 * ```ts
 * import { ResolutionOutput } from "@effect-ontology/Workflow/DurableActivities"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(ResolutionOutput)({
 *   resolvedUri: "gs://beep-ontology-state/graphs/resolved.ttl",
 *   entitiesTotal: 4,
 *   clustersFormed: 3,
 *   relationsTotal: 2,
 *   compressionRatio: 0.25,
 *   provenanceMap: { eze: ["gs://beep-ontology-state/docs/doc-deadbeefcafe.ttl"] },
 *   durationMs: 42
 * })
 * console.log(O.map(decoded, (output) => output.clustersFormed))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ResolutionOutput = S.Struct({
  resolvedUri: GcsUri,
  /** Total entities before resolution */
  entitiesTotal: NonNegativeInt,
  /** Number of clusters formed (resolved entities) */
  clustersFormed: NonNegativeInt,
  /** Total relations in merged graph */
  relationsTotal: NonNegativeInt,
  /** Compression ratio: 1 - (clustersFormed / entitiesTotal) */
  compressionRatio: UnitInterval,
  /** Maps canonical entity ID to source document URIs */
  provenanceMap: S.Record(S.String, S.Array(S.String)),
  durationMs: NonNegNum,
}).pipe(
  $I.annoteSchema("ResolutionOutput", {
    description: "Resolved graph URI, cluster counts, compression ratio, and provenance map for entity resolution.",
  })
);

/**
 * Decoded resolution activity output produced by {@link ResolutionOutput}.
 *
 * @see {@link ResolutionOutput} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ResolutionOutput = typeof ResolutionOutput.Type;

/**
 * Journaled success payload for {@link makeValidationActivity}.
 *
 * **Example** (Construct a conforming validation output)
 *
 * ```ts
 * import { ValidationOutput } from "@effect-ontology/Workflow/DurableActivities"
 * import { GcsUri } from "@effect-ontology/Identity"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const output = ValidationOutput.make({
 *   validatedUri: S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/graphs/validated.ttl"),
 *   conforms: true,
 *   violations: NonNegativeInt.make(0),
 *   reportUri: S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/reports/shacl.json"),
 *   durationMs: NonNegativeInt.make(18)
 * })
 * console.log(output.conforms) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ValidationOutput = ValidationActivityOutput;

/**
 * Decoded validation activity output produced by {@link ValidationOutput}.
 *
 * @see {@link ValidationOutput} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ValidationOutput = typeof ValidationOutput.Type;

/**
 * Journaled success payload for {@link makeIngestionActivity}.
 *
 * **Example** (Decode an ingestion output)
 *
 * ```ts
 * import { IngestionOutput } from "@effect-ontology/Workflow/DurableActivities"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(IngestionOutput)({
 *   canonicalUri: "gs://beep-ontology-state/graphs/canonical.ttl",
 *   triplesIngested: 12,
 *   durationMs: 9
 * })
 * console.log(O.map(decoded, (output) => output.triplesIngested))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IngestionOutput = S.Struct({
  canonicalUri: GcsUri,
  triplesIngested: NonNegativeInt,
  durationMs: NonNegNum,
}).pipe(
  $I.annoteSchema("IngestionOutput", {
    description: "Canonical graph URI, ingested triple count, and elapsed milliseconds for ingestion.",
  })
);

/**
 * Decoded ingestion activity output produced by {@link IngestionOutput}.
 *
 * @see {@link IngestionOutput} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type IngestionOutput = typeof IngestionOutput.Type;

/**
 * Journaled success payload for {@link makeClaimPersistenceActivity}.
 *
 * **Example** (Decode a claim-persistence output)
 *
 * ```ts
 * import { ClaimPersistenceOutput } from "@effect-ontology/Workflow/DurableActivities"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(ClaimPersistenceOutput)({
 *   claimsPersisted: 8,
 *   documentsProcessed: 2,
 *   documentsFailed: 0,
 *   durationMs: 21
 * })
 * console.log(O.map(decoded, (output) => output.claimsPersisted))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimPersistenceOutput = S.Struct({
  /** Total claims persisted across all documents */
  claimsPersisted: NonNegativeInt,
  /** Number of documents processed */
  documentsProcessed: NonNegativeInt,
  /** Number of documents that failed claim persistence */
  documentsFailed: NonNegativeInt,
  durationMs: NonNegNum,
}).pipe(
  $I.annoteSchema("ClaimPersistenceOutput", {
    description: "Persisted claim counts, document totals, failures, and elapsed milliseconds.",
  })
);

/**
 * Decoded claim-persistence output produced by {@link ClaimPersistenceOutput}.
 *
 * @see {@link ClaimPersistenceOutput} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimPersistenceOutput = typeof ClaimPersistenceOutput.Type;

/**
 * Cross-batch resolution counts and an Effect Duration execution measurement.
 *
 * **Example** (Construct a cross-batch resolution output)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { NonNegativeInt } from "@beep/schema"
 * import { CrossBatchResolutionOutput } from "@effect-ontology/Workflow/DurableActivities"
 *
 * const output = CrossBatchResolutionOutput.make({
 *   entitiesTotal: NonNegativeInt.make(10),
 *   matchedToExisting: NonNegativeInt.make(6),
 *   newCanonicals: NonNegativeInt.make(4),
 *   candidatesEvaluated: NonNegativeInt.make(12),
 *   duration: Duration.millis(40)
 * })
 * console.log(output.matchedToExisting) // 6
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CrossBatchResolutionOutput extends S.Class<CrossBatchResolutionOutput>($I`CrossBatchResolutionOutput`)(
  {
    entitiesTotal: NonNegativeInt,
    matchedToExisting: NonNegativeInt,
    newCanonicals: NonNegativeInt,
    candidatesEvaluated: NonNegativeInt,
    duration: S.DurationFromMillis,
  },
  $I.annote("CrossBatchResolutionOutput", {
    description: "Cross-batch resolution counts and an Effect Duration execution measurement.",
  })
) {}

/**
 * Validated batch, graph, enablement, and ontology scope for cross-batch entity resolution.
 *
 * **Example** (Construct a cross-batch resolution input)
 *
 * ```ts
 * import { BatchId, GcsUri, OntologyName } from "@effect-ontology/Identity"
 * import { CrossBatchResolutionInput } from "@effect-ontology/Workflow/DurableActivities"
 * import * as S from "effect/Schema"
 *
 * const input = CrossBatchResolutionInput.make({
 *   batchId: BatchId.make("batch-deadbeefcafe"),
 *   resolvedGraphUri: S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/graphs/resolved.ttl"),
 *   enabled: true,
 *   ontologyId: OntologyName.make("foaf")
 * })
 * console.log(input.enabled) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CrossBatchResolutionInput extends S.Class<CrossBatchResolutionInput>($I`CrossBatchResolutionInput`)(
  {
    batchId: BatchId,
    resolvedGraphUri: GcsUri,
    enabled: S.Boolean,
    ontologyId: OntologyName,
  },
  $I.annote("CrossBatchResolutionInput", {
    description: "Validated batch, graph, enablement, and ontology scope for cross-batch entity resolution.",
  })
) {}

// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------

const stripGsPrefix = (uri: string): string =>
  Str.startsWith("gs://")(uri) ? Str.replace(/^gs:\/\/[^/]+\//, "")(uri) : uri;

const DocumentPriorityOrder = Order.mapInput(Order.Number, (document: DocumentMetadata) => document.priority);

const requireContent = (opt: O.Option<string>, key: string) =>
  Effect.fromOption(opt, () => notFoundError("StorageObject", key));

const summarizeViolations = (violations: ReadonlyArray<ShaclValidationViolation>) => {
  const grouped = MutableHashMap.empty<
    ShaclValidationViolation["severity"],
    { count: number; sampleMessages: Array<string> }
  >();

  for (const violation of violations) {
    const entry = O.getOrElse(
      MutableHashMap.get(grouped, violation.severity),
      (): { count: number; sampleMessages: Array<string> } => ({
        count: 0,
        sampleMessages: [],
      })
    );
    entry.count += 1;
    if (entry.sampleMessages.length < 3 && P.isTruthy(violation.message)) {
      entry.sampleMessages.push(violation.message);
    }
    MutableHashMap.set(grouped, violation.severity, entry);
  }

  return A.map(A.fromIterable(grouped), ([severity, info]) =>
    ValidationActivityViolationSummary.make({
      severity,
      count: NonNegativeInt.make(info.count),
      sampleMessages: info.sampleMessages,
    })
  );
};

const resolveBucket = (config: { storage: { bucket: O.Option<string> } }) =>
  O.getOrElse(config.storage.bucket, () => "local-bucket");

/**
 * Parse Turtle to stats (entity/triple count)
 */
const parseTurtleStats = Effect.fn("parseTurtleStats")(function* (turtle: string) {
  const rdf = yield* RdfBuilder;
  const store = yield* rdf.parseTurtle(turtle);
  const typeQuads = yield* rdf.queryStore(store, {
    predicate: RDF_TYPE,
  });
  const allQuads = yield* rdf.queryStore(store, {});
  return {
    entityCount: typeQuads.length,
    tripleCount: allQuads.length,
  };
});

/**
 * Extract minimal KnowledgeGraph from an RDF store
 *
 * Reconstructs Entity objects from RDF quads:
 * - Entity ID from subject IRI local name
 * - mention from rdfs:label
 * - types from rdf:type
 * - Relations from triples where both subject and object are entities
 */
const storeToKnowledgeGraph = Effect.fn("storeToKnowledgeGraph")(function* (store: RdfStore) {
  const rdf = yield* RdfBuilder;
  const provenance = yield* rdfStoreToDataset(store).pipe(
    Effect.flatMap((dataset) => Effect.fromResult(datasetToProvBundle(dataset)))
  );
  const typeQuads = yield* rdf.queryStore(store, { predicate: RDF_TYPE });
  const labelQuads = yield* rdf.queryStore(store, { predicate: RDFS_LABEL });
  const entityTypes = MutableHashMap.empty<string, Array<string>>();
  const entityIris = MutableHashSet.empty<string>();
  for (const quad of typeQuads) {
    if (quad.subject.termType !== "NamedNode" || quad.object.termType !== "NamedNode") continue;
    const subjectIri = quad.subject.value;
    const typeIri = quad.object.value;
    if (Str.includes("owl#")(typeIri) || Str.includes("rdf-schema#")(typeIri)) continue;
    if (Str.startsWith(CLAIMS.namespace)(subjectIri)) continue;
    if (Str.startsWith(CLAIMS.namespace)(typeIri)) continue;
    MutableHashSet.add(entityIris, subjectIri);
    const types = O.getOrElse(MutableHashMap.get(entityTypes, subjectIri), (): Array<string> => []);
    types.push(typeIri);
    MutableHashMap.set(entityTypes, subjectIri, types);
  }
  const entityLabels = MutableHashMap.empty<string, string>();
  for (const quad of labelQuads) {
    const subjectIri = quad.subject.value;
    if (MutableHashSet.has(entityIris, subjectIri)) {
      const label = quad.object.value;
      MutableHashMap.set(entityLabels, subjectIri, label);
    }
  }
  const entities: Array<Entity> = [];
  for (const iri of entityIris) {
    const types = O.getOrElse(MutableHashMap.get(entityTypes, iri), () => []);
    if (!A.isReadonlyArrayNonEmpty(types)) continue;
    const localName = extractLocalNameFromIri(iri);
    const mention = O.getOrElse(MutableHashMap.get(entityLabels, iri), () => localName);
    entities.push(
      Entity.make({
        id: EntityId.make(localName),
        mention,
        types: A.map(types, (type) => IRI.decodeUnknownSync(type)),
        attributes: {},
      })
    );
  }
  const entityIdSet = MutableHashSet.fromIterable(entities.map((e) => e.id));
  const allQuads = yield* rdf.queryStore(store, {});
  const extractionArtifact = yield* claimExtractionArtifactFromQuads(allQuads);
  const relations: Array<Relation> = [];
  for (const quad of allQuads) {
    if (quad.subject.termType !== "NamedNode") continue;
    const subjectIri = quad.subject.value;
    if (!MutableHashSet.has(entityIris, subjectIri)) continue;
    const subjectLocalName = extractLocalNameFromIri(subjectIri);
    const subjectId = EntityId.make(subjectLocalName);
    const predicate = quad.predicate.value;
    if (predicate === RDF_TYPE.value || predicate === RDFS_LABEL.value) continue;
    const objectValue = quad.object;
    if (objectValue.termType === "NamedNode") {
      if (!MutableHashSet.has(entityIris, objectValue.value)) continue;
      const objectLocalName = extractLocalNameFromIri(objectValue.value);
      const objectId = EntityId.make(objectLocalName);
      if (MutableHashSet.has(entityIdSet, objectId)) {
        relations.push(
          Relation.make({
            subjectId,
            predicate: IRI.decodeUnknownSync(predicate),
            object: RelationObject.cases.EntityReference.make({ value: objectId }),
          })
        );
      }
    }
  }
  return KnowledgeGraph.make({
    entities,
    relations,
    provenance,
    entityObservations: O.match(extractionArtifact, {
      onNone: () => [],
      onSome: (artifact) => artifact.entityObservations,
    }),
    relationObservations: O.match(extractionArtifact, {
      onNone: () => [],
      onSome: (artifact) => artifact.relationObservations,
    }),
  });
});

// -----------------------------------------------------------------------------
// Durable Activities
// -----------------------------------------------------------------------------

/**
 * Durable Resolution Activity
 *
 * **Details**
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
 *
 * **Example** (Name a resolution activity)
 *
 * ```ts
 * import { BatchId, GcsUri } from "@effect-ontology/Identity"
 * import { ResolutionActivityInput } from "@effect-ontology/Schema/Batch"
 * import { makeResolutionActivity } from "@effect-ontology/Workflow/DurableActivities"
 * import * as S from "effect/Schema"
 *
 * const activity = makeResolutionActivity(
 *   ResolutionActivityInput.make({
 *     batchId: BatchId.make("batch-deadbeefcafe"),
 *     documentGraphUris: [S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/docs/doc-deadbeefcafe.ttl")]
 *   })
 * )
 * console.log(activity.name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeResolutionActivity = (input: ResolutionActivityInput) =>
  Activity.make({
    name: `resolution-${input.batchId}`,
    success: ResolutionOutput,
    error: ActivityError,
    execute: Effect.gen(function* () {
      const start = yield* DateTime.now;
      const storage = yield* StorageService;
      const config = yield* ConfigService;
      const rdf = yield* RdfBuilder;
      const entityResolution = yield* EntityResolutionService;
      const bucket = resolveBucket(config);

      yield* Effect.logInfo("Resolution activity starting", {
        batchId: input.batchId,
        graphCount: input.documentGraphUris.length,
      });

      // 1. Load all document graphs
      const graphContents = yield* Effect.forEach(
        input.documentGraphUris,
        (uri) =>
          storage.getOption(stripGsPrefix(uri)).pipe(
            Effect.flatMap((content) => requireContent(content, uri)),
            Effect.tapCause((cause) =>
              Effect.logError("Resolution: Failed to load document graph", {
                activity: "resolution",
                batchId: input.batchId,
                graphUri: uri,
                cause: Cause.pretty(cause),
              })
            )
          ),
        { concurrency: 10 }
      );

      // 2. Parse each TriG graph and extract KnowledgeGraphs
      const knowledgeGraphs = yield* Effect.forEach(
        graphContents,
        (trig) =>
          Effect.gen(function* () {
            const store = yield* rdf.parseTriG(trig);
            return yield* storeToKnowledgeGraph(store);
          }).pipe(
            Effect.catch((err) =>
              Effect.gen(function* () {
                yield* Effect.logWarning("Failed to parse document graph, skipping", {
                  error: Inspectable.toStringUnknown(err),
                });
                return KnowledgeGraph.make({ entities: [], relations: [] });
              })
            )
          ),
        { concurrency: 5 }
      );

      // Count total entities and relations before resolution
      const totalEntities = knowledgeGraphs.reduce((sum, kg) => sum + kg.entities.length, 0);
      const totalRelations = knowledgeGraphs.reduce((sum, kg) => sum + kg.relations.length, 0);

      yield* Effect.logInfo("Parsed document graphs", {
        batchId: input.batchId,
        graphCount: knowledgeGraphs.length,
        totalEntities,
        totalRelations,
      });

      // 3. Perform entity resolution across all graphs
      const resolutionGraph = yield* entityResolution.resolve(knowledgeGraphs, EntityResolutionConfig.default()).pipe(
        Effect.tap((erg) =>
          Effect.logInfo("Entity resolution complete", {
            batchId: input.batchId,
            mentionCount: erg.stats.mentionCount,
            resolvedCount: erg.stats.resolvedCount,
            clusterCount: erg.stats.clusterCount,
          })
        )
      );

      // 4. Build resolved Turtle with canonical IDs
      // Track entity provenance: which document each entity came from
      const entityToDocumentUri: Record<string, string> = {};
      knowledgeGraphs.forEach((kg, docIndex) => {
        const docUri = input.documentGraphUris[docIndex];
        for (const entity of kg.entities) {
          entityToDocumentUri[entity.id] = docUri;
        }
      });

      const mergedGraph = A.reduce(knowledgeGraphs, KnowledgeGraph.make({}), mergeGraphs);
      const resolvedGraph = refineKnowledgeGraph(mergedGraph, resolutionGraph);

      // 5. Serialize to Turtle with owl:sameAs links and save
      const store = yield* rdf.createStore;
      yield* rdf.addEntities(store, resolvedGraph.entities);
      yield* rdf.addRelations(store, resolvedGraph.relations);
      yield* rdf.addSameAsLinks(store, resolutionGraph.canonicalMap);
      const provenanceDataset = yield* Effect.fromResult(provBundleToDataset(resolvedGraph.provenance));
      A.forEach(provenanceDataset.quads, (quad) => rdfStoreAddQuad(store, quad));
      const resolvedTurtle = yield* rdf.toTurtle(store);
      const resolutionPath = PathLayout.batch.resolution(input.batchId);
      yield* storage.set(resolutionPath, resolvedTurtle);

      const end = yield* DateTime.now;
      const compressionRatio = totalEntities > 0 ? 1 - resolutionGraph.stats.resolvedCount / totalEntities : 0;

      // Build provenance map: canonical ID -> source document URIs
      const provenanceMap: Record<string, Array<string>> = {};
      for (const [entityId, docUri] of R.toEntries(entityToDocumentUri)) {
        const canonicalId = resolutionGraph.canonicalMap[EntityId.make(entityId)] ?? entityId;
        if (P.not(P.isTruthy)(provenanceMap[canonicalId])) {
          provenanceMap[canonicalId] = [];
        }
        // Only add unique document URIs
        if (!provenanceMap[canonicalId].includes(docUri)) {
          provenanceMap[canonicalId].push(docUri);
        }
      }

      yield* Effect.logInfo("Resolution activity complete", {
        batchId: input.batchId,
        entitiesTotal: NonNegativeInt.make(totalEntities),
        clustersFormed: NonNegativeInt.make(resolutionGraph.stats.clusterCount),
        relationsTotal: NonNegativeInt.make(totalRelations),
        compressionRatio: UnitInterval.make(compressionRatio),
        provenanceMapEntries: R.size(provenanceMap),
        durationMs: NonNegNum.make(Duration.toMillis(DateTime.distance(start, end))),
      });

      return {
        resolvedUri: GcsUri.decodeUnknownSync(`gs://${bucket}/${resolutionPath}`),
        entitiesTotal: NonNegativeInt.make(totalEntities),
        clustersFormed: NonNegativeInt.make(resolutionGraph.stats.clusterCount),
        relationsTotal: NonNegativeInt.make(totalRelations),
        compressionRatio: UnitInterval.make(compressionRatio),
        provenanceMap,
        durationMs: NonNegNum.make(Duration.toMillis(DateTime.distance(start, end))),
      };
    }).pipe(Effect.mapError(preserveActivityError)),
    interruptRetryPolicy: activityRetryPolicy,
  });

/**
 * Durable Validation Activity
 *
 * **Details**
 *
 * Validates the resolved graph against SHACL shapes (if provided).
 * Journaled by WorkflowEngine for crash recovery.
 *
 * **Example** (Name a validation activity)
 *
 * ```ts
 * import { BatchId, GcsUri } from "@effect-ontology/Identity"
 * import { ValidationActivityInput } from "@effect-ontology/Schema/Batch"
 * import { makeValidationActivity } from "@effect-ontology/Workflow/DurableActivities"
 * import * as S from "effect/Schema"
 *
 * const activity = makeValidationActivity(
 *   ValidationActivityInput.make({
 *     batchId: BatchId.make("batch-deadbeefcafe"),
 *     resolvedGraphUri: S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/graphs/resolved.ttl"),
 *     ontologyUri: S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/ontologies/foaf.ttl")
 *   })
 * )
 * console.log(activity.name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeValidationActivity = (input: ValidationActivityInput) =>
  Activity.make({
    name: `validation-${input.batchId}`,
    success: ValidationOutput,
    error: ActivityError,
    execute: Effect.gen(function* () {
      const start = yield* DateTime.now;
      const storage = yield* StorageService;
      const config = yield* ConfigService;
      const rdf = yield* RdfBuilder;
      const shacl = yield* ShaclWorkflowService;
      const bucket = resolveBucket(config);

      yield* Effect.logInfo("Validation activity starting", {
        batchId: input.batchId,
        hasShaclUri: input.shaclUri.pipe(O.fromNullishOr, O.isSome),
      });

      const resolvedGraph = yield* storage.getOption(stripGsPrefix(input.resolvedGraphUri)).pipe(
        Effect.flatMap((content) => requireContent(content, input.resolvedGraphUri)),
        Effect.tapCause((cause) =>
          Effect.logError("Validation: Failed to load resolved graph", {
            activity: "validation",
            batchId: input.batchId,
            cause: Cause.pretty(cause),
          })
        )
      );

      const dataStore = yield* rdf.parseTurtle(resolvedGraph).pipe(
        Effect.tapCause((cause) =>
          Effect.logError("Validation: Failed to parse turtle", {
            activity: "validation",
            batchId: input.batchId,
            cause: Cause.pretty(cause),
          })
        )
      );

      // Load SHACL shapes with auto-discovery:
      // 1. If shaclUri provided explicitly, use it
      // 2. Otherwise, try convention-based discovery: shapes.ttl in same directory as ontology
      // 3. Fall back to auto-generation from ontology if shapes.ttl not found
      const shapesStore = Effect.fn("onNone")(
        function* () {
          const shapesPath = input.ontologyUri.replace(/[^/]+\.ttl$/i, "shapes.ttl");
          const shapesContent = yield* storage.getOption(stripGsPrefix(shapesPath));
          if (O.isSome(shapesContent)) {
            yield* Effect.logInfo("Validation: Found shapes.ttl via auto-discovery", {
              activity: "validation",
              batchId: input.batchId,
              shapesPath,
              ontologyUri: input.ontologyUri,
            });
            return yield* rdf.parseTurtle(shapesContent.value);
          }
          yield* Effect.logInfo("Validation: Auto-generating SHACL shapes from ontology", {
            activity: "validation",
            batchId: input.batchId,
            ontologyUri: input.ontologyUri,
            triedShapesPath: shapesPath,
          });
          const ontologyContent = yield* storage.getOption(stripGsPrefix(input.ontologyUri)).pipe(
            Effect.flatMap((content) => requireContent(content, input.ontologyUri)),
            Effect.tapCause((cause) =>
              Effect.logError("Validation: Failed to load ontology", {
                activity: "validation",
                batchId: input.batchId,
                ontologyUri: input.ontologyUri,
                cause: Cause.pretty(cause),
              })
            )
          );
          const ontologyStore = yield* rdf.parseTurtle(ontologyContent);
          return yield* shacl.generateShapesFromOntology(ontologyStore);
        },
        Effect.tapCause((cause) =>
          Effect.logError("Validation: Failed to load or generate shapes", {
            activity: "validation",
            batchId: input.batchId,
            cause: Cause.pretty(cause),
          })
        )
      );

      // Apply validation policy from input or config
      // Config defaults: logOnly=false, failOnViolation=true, failOnWarning=false
      // For development, set VALIDATION_LOG_ONLY=true to allow workflows to complete
      const policy = input.validationPolicy;

      // Run validation with policy - this will fail if policy is violated
      const shapes = yield* shapesStore();
      const report = yield* shacl.validateWithPolicy(dataStore, shapes, policy).pipe(
        Effect.tapCause((cause) =>
          Effect.logError("Validation: SHACL validation failed", {
            activity: "validation",
            batchId: input.batchId,
            cause: Cause.pretty(cause),
          })
        )
      );

      const validationGraphPath = PathLayout.batch.validationGraph(input.batchId);
      yield* storage.set(validationGraphPath, resolvedGraph);

      const reportPath = PathLayout.batch.validationReport(input.batchId);
      const reportJson = yield* PrettyShaclValidationReportFromJsonString.encodeEffect(report);
      yield* storage.set(reportPath, reportJson);

      const end = yield* DateTime.now;

      yield* Effect.logInfo("Validation activity complete", {
        batchId: input.batchId,
        conforms: report.validation.conforms,
        violations: NonNegativeInt.make(report.validation.violations.length),
        policyApplied: policy,
        durationMs: Duration.toMillis(DateTime.distance(start, end)),
      });

      return {
        validatedUri: GcsUri.decodeUnknownSync(`gs://${bucket}/${validationGraphPath}`),
        conforms: report.validation.conforms,
        violations: NonNegativeInt.make(report.validation.violations.length),
        violationSummary: P.isTruthy(report.validation.violations.length)
          ? summarizeViolations(report.validation.violations)
          : [],
        reportUri: GcsUri.decodeUnknownSync(`gs://${bucket}/${reportPath}`),
        durationMs: Duration.toMillis(DateTime.distance(start, end)),
      };
    }).pipe(Effect.mapError(preserveActivityError)),
    interruptRetryPolicy: activityRetryPolicy,
  });

/**
 * Durable Ingestion Activity
 *
 * **Details**
 *
 * Ingests the validated graph into the canonical store.
 * Journaled by WorkflowEngine for crash recovery.
 *
 * **Example** (Name an ingestion activity)
 *
 * ```ts
 * import { BatchId, GcsUri, Namespace } from "@effect-ontology/Identity"
 * import { IngestionActivityInput } from "@effect-ontology/Schema/Batch"
 * import { makeIngestionActivity } from "@effect-ontology/Workflow/DurableActivities"
 * import * as S from "effect/Schema"
 *
 * const activity = makeIngestionActivity(
 *   IngestionActivityInput.make({
 *     batchId: BatchId.make("batch-deadbeefcafe"),
 *     validatedGraphUri: S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/graphs/validated.ttl"),
 *     targetNamespace: Namespace.make("foaf")
 *   })
 * )
 * console.log(activity.name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeIngestionActivity = (input: IngestionActivityInput) =>
  Activity.make({
    name: `ingestion-${input.batchId}`,
    success: IngestionOutput,
    error: ActivityError,
    execute: Effect.gen(function* () {
      const start = yield* DateTime.now;
      const storage = yield* StorageService;
      const config = yield* ConfigService;
      const rdf = yield* RdfBuilder;
      const bucket = resolveBucket(config);

      yield* Effect.logInfo("Ingestion activity starting", {
        batchId: input.batchId,
        targetNamespace: input.targetNamespace,
      });

      const validatedGraph = yield* storage.getOption(stripGsPrefix(input.validatedGraphUri)).pipe(
        Effect.flatMap((content) => requireContent(content, input.validatedGraphUri)),
        Effect.tapCause((cause) =>
          Effect.logError("Ingestion: Failed to load validated graph", {
            activity: "ingestion",
            batchId: input.batchId,
            cause: Cause.pretty(cause),
          })
        )
      );

      const stats = yield* parseTurtleStats(validatedGraph).pipe(
        Effect.catch(
          Effect.fnUntraced(function* (error) {
            yield* Effect.logError("Ingestion: Failed to parse validated graph for stats", {
              activity: "ingestion",
              batchId: input.batchId,
              error: Inspectable.toStringUnknown(error),
            });
            // Return zeros but the error is logged - consider making this fail
            return { entityCount: 0, tripleCount: 0 };
          })
        )
      );

      // Save batch-specific canonical graph (always overwrite - one batch = one file)
      const canonicalPath = PathLayout.batch.canonical(input.batchId);
      yield* storage.set(canonicalPath, validatedGraph);

      // Namespace canonical graph: optimistic locking for concurrent batch safety
      const namespaceCanonicalPath = PathLayout.canonical(input.targetNamespace).entities;

      // Parse the new graph we want to merge
      const newStore = yield* rdf.parseTurtle(validatedGraph).pipe(
        Effect.mapError((error) =>
          ActivityGenericError.make({
            message: `Failed to parse new graph: ${error.message}`,
            cause: O.some(Inspectable.toStringUnknown(error)),
          })
        )
      );
      const newTripleCount = rdfStoreSize(newStore);

      // Optimistic locking merge with retry on conflict
      // This prevents concurrent batches from overwriting each other's data
      const mergeWithOptimisticLocking = Effect.gen(function* () {
        // Try to load existing namespace canonical graph with generation for optimistic locking
        const existingGraphOpt = yield* storage.getWithGeneration(namespaceCanonicalPath);

        let mergedGraph: string;
        const mergedStats = {
          existingTriples: 0,
          newTriples: newTripleCount,
          addedTriples: 0,
        };
        const generation = O.map(existingGraphOpt, (existing) => existing.generation);

        if (O.isSome(existingGraphOpt)) {
          // Merge with existing graph
          const existingStore = yield* rdf.parseTurtle(existingGraphOpt.value.content).pipe(
            Effect.mapError((error) =>
              ActivityGenericError.make({
                message: `Failed to parse existing graph: ${error.message}`,
                cause: O.some(Inspectable.toStringUnknown(error)),
              })
            )
          );
          mergedStats.existingTriples = rdfStoreSize(existingStore);

          // Re-parse new graph for merge (since we can't clone N3 stores)
          const newStoreForMerge = yield* rdf.parseTurtle(validatedGraph).pipe(
            Effect.mapError((error) =>
              ActivityGenericError.make({
                message: `Failed to parse new graph for merge: ${error.message}`,
                cause: O.some(Inspectable.toStringUnknown(error)),
              })
            )
          );

          // Merge new into existing (union semantics)
          mergedStats.addedTriples = yield* rdf.mergeStores(existingStore, newStoreForMerge);

          // Validate merge integrity: addedTriples should never exceed newTriples
          if (mergedStats.addedTriples > mergedStats.newTriples) {
            yield* Effect.logError("Ingestion: Merge integrity violation - added more triples than source had", {
              batchId: input.batchId,
              newTriples: mergedStats.newTriples,
              addedTriples: mergedStats.addedTriples,
            });
            const errorMessage = `Merge integrity violation: added ${mergedStats.addedTriples} triples but source only had ${mergedStats.newTriples}`;
            return yield* Effect.fail(
              ActivityGenericError.make({
                message: errorMessage,
              })
            );
          }

          // Calculate deduplicated triples
          const deduplicatedTriples = mergedStats.newTriples - mergedStats.addedTriples;

          // Log deduplication stats
          if (deduplicatedTriples > 0) {
            const deduplicationRatio = (deduplicatedTriples / mergedStats.newTriples) * 100;

            if (deduplicationRatio > 50) {
              yield* Effect.logWarning(
                "Ingestion: High triple deduplication detected - possible IRI collision or duplicate documents",
                {
                  batchId: input.batchId,
                  namespace: input.targetNamespace,
                  deduplicatedTriples,
                  newTriples: mergedStats.newTriples,
                  deduplicationRatio: `${deduplicationRatio.toFixed(1)}%`,
                }
              );
            } else {
              yield* Effect.logDebug("Ingestion: Triple deduplication during merge", {
                batchId: input.batchId,
                deduplicatedTriples,
                newTriples: mergedStats.newTriples,
                deduplicationRatio: `${deduplicationRatio.toFixed(1)}%`,
              });
            }
          }

          // Serialize merged graph
          mergedGraph = yield* rdf.toTurtle(existingStore);

          yield* Effect.logInfo("Ingestion: Merged with existing namespace graph", {
            batchId: input.batchId,
            namespace: input.targetNamespace,
            existingTriples: mergedStats.existingTriples,
            newTriples: mergedStats.newTriples,
            addedTriples: mergedStats.addedTriples,
            deduplicatedTriples,
            totalTriples: rdfStoreSize(existingStore),
          });
        } else {
          // No existing graph - use new graph as-is
          mergedGraph = validatedGraph;
          mergedStats.addedTriples = newTripleCount;

          yield* Effect.logInfo("Ingestion: Creating new namespace graph", {
            batchId: input.batchId,
            namespace: input.targetNamespace,
            tripleCount: newTripleCount,
          });
        }

        // Generation zero is the backend-neutral create-only precondition.
        // Existing objects retain their exact generation token end-to-end.
        yield* storage.setIfGenerationMatch(
          namespaceCanonicalPath,
          mergedGraph,
          O.getOrElse(generation, () => "0")
        );

        return mergedStats;
      });

      // Retry on generation mismatch (concurrent write detected)
      const maxRetries = 3;
      yield* mergeWithOptimisticLocking.pipe(
        Effect.retry({
          while: GenerationMismatchError.is,
          times: maxRetries,
          schedule: Schedule.exponential("100 millis").pipe(Schedule.jittered),
        }),
        Effect.tapError((error) => {
          if (GenerationMismatchError.is(error)) {
            return Effect.logError("Ingestion: Failed after max retries due to concurrent writes", {
              batchId: input.batchId,
              namespace: input.targetNamespace,
              maxRetries,
              key: error.key,
            });
          }
          return Effect.void;
        })
      );

      const end = yield* DateTime.now;

      return {
        canonicalUri: GcsUri.decodeUnknownSync(`gs://${bucket}/${canonicalPath}`),
        triplesIngested: NonNegativeInt.make(stats.tripleCount),
        durationMs: NonNegNum.make(Duration.toMillis(DateTime.distance(start, end))),
      };
    }).pipe(Effect.mapError(preserveActivityError)),
    interruptRetryPolicy: activityRetryPolicy,
  });

// -----------------------------------------------------------------------------
// Claim Persistence Activity (runs after validation)
// -----------------------------------------------------------------------------

/**
 * Input for ClaimPersistence activity
 *
 * **Example** (Decode a claim-persistence input)
 *
 * ```ts
 * import { ClaimPersistenceInput } from "@effect-ontology/Workflow/DurableActivities"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(ClaimPersistenceInput)({
 *   batchId: "batch-deadbeefcafe",
 *   ontologyId: "foaf",
 *   documentGraphUris: ["gs://beep-ontology-state/docs/doc-deadbeefcafe.ttl"],
 *   targetNamespace: "foaf"
 * })
 * console.log(O.map(decoded, (input) => input.ontologyId))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimPersistenceInput = S.Struct({
  /** Batch ID for logging */
  batchId: BatchId,
  /** Ontology ID for namespace scoping (e.g., "seattle") */
  ontologyId: S.String,
  /** URIs of document graphs to process */
  documentGraphUris: S.Array(S.String),
  /** Target namespace for IRI construction */
  targetNamespace: S.String,
  /** Optional article metadata per document */
  documentMetadata: S.Array(
    S.Struct({
      documentId: S.String,
      sourceUri: S.String,
      eventTime: S.DateTimeUtc.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
      headline: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    })
  ).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}).pipe(
  $I.annoteSchema("ClaimPersistenceInput", {
    description: "Batch, ontology, document graph URIs, and namespace used to persist validated claims.",
  })
);

/**
 * Decoded claim-persistence input produced by {@link ClaimPersistenceInput}.
 *
 * @see {@link ClaimPersistenceInput} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimPersistenceInput = typeof ClaimPersistenceInput.Type;

/**
 * Durable Claim Persistence Activity
 *
 * **Details**
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
 * **Example** (Name a claim-persistence activity)
 *
 * ```ts
 * import { ClaimPersistenceInput, makeClaimPersistenceActivity } from "@effect-ontology/Workflow/DurableActivities"
 * import * as S from "effect/Schema"
 *
 * const activity = makeClaimPersistenceActivity(
 *   S.decodeUnknownSync(ClaimPersistenceInput)({
 *     batchId: "batch-deadbeefcafe",
 *     ontologyId: "foaf",
 *     documentGraphUris: ["gs://beep-ontology-state/docs/doc-deadbeefcafe.ttl"],
 *     targetNamespace: "foaf"
 *   })
 * )
 * console.log(activity.name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeClaimPersistenceActivity = (input: ClaimPersistenceInput) =>
  Activity.make({
    name: `claim-persistence-${input.batchId}`,
    success: ClaimPersistenceOutput,
    error: ActivityError,
    execute: Effect.gen(function* () {
      const start = yield* DateTime.now;
      const storage = yield* StorageService;
      const rdf = yield* RdfBuilder;
      const config = yield* ConfigService;
      const claimPersistence = yield* Effect.serviceOption(ClaimPersistenceService);

      if (O.isNone(claimPersistence)) {
        yield* Effect.logInfo("Claim persistence skipped - PostgreSQL not configured", {
          batchId: input.batchId,
        });
        const end = yield* DateTime.now;
        return {
          claimsPersisted: NonNegativeInt.make(0),
          documentsProcessed: NonNegativeInt.make(0),
          documentsFailed: NonNegativeInt.make(0),
          durationMs: NonNegNum.make(Duration.toMillis(DateTime.distance(start, end))),
        };
      }

      yield* Effect.logInfo("Claim persistence activity starting", {
        batchId: input.batchId,
        documentCount: input.documentGraphUris.length,
      });

      // Build metadata lookup
      const metadataMap = MutableHashMap.empty<
        string,
        {
          documentId: string;
          sourceUri: string;
          eventTime: O.Option<DateTime.Utc>;
          headline: O.Option<string>;
        }
      >();

      for (const meta of O.getOrElse(input.documentMetadata, () => [])) {
        MutableHashMap.set(metadataMap, meta.sourceUri, meta);
        MutableHashMap.set(metadataMap, meta.documentId, meta);
      }

      let totalClaimsPersisted = 0;
      let documentsProcessed = 0;
      let documentsFailed = 0;

      // Process each document graph
      for (const graphUri of input.documentGraphUris) {
        const result = yield* Effect.gen(function* () {
          const graphPath = stripGsPrefix(graphUri);
          const graphContent = yield* storage
            .getOption(graphPath)
            .pipe(Effect.flatMap((content) => requireContent(content, graphPath)));

          // Parse TriG to extract entities and relations (preserves named graphs)
          const store = yield* rdf.parseTriG(graphContent);
          const knowledgeGraph = yield* storeToKnowledgeGraph(store);
          const extractionArtifact = yield* claimExtractionArtifactFromQuads(yield* rdf.queryStore(store, {}));

          // Get metadata for this document
          // Try to find metadata by matching graph URI path to sourceUri
          const pathMatch = graphPath.match(/documents\/([^/]+)\//);
          const documentIdFromPath = pathMatch?.[1];
          let docMeta = P.isNotUndefined(documentIdFromPath)
            ? O.getOrUndefined(MutableHashMap.get(metadataMap, documentIdFromPath))
            : undefined;
          if (P.isUndefined(docMeta)) {
            docMeta = O.getOrUndefined(MutableHashMap.get(metadataMap, graphUri));
          }
          if (P.isUndefined(docMeta)) {
            docMeta = {
              documentId: documentIdFromPath ?? graphPath,
              sourceUri: graphUri,
              eventTime: O.none(),
              headline: O.none(),
            };
          }

          // Convert to claims
          // Convert Namespace identifier to full IRI
          const match = config.rdf.baseNamespace.match(/^https?:\/\/[^/]+\//);
          const baseDomain = P.isNotNull(match) ? match[0] : "https://example.org/";
          const baseNamespace = `${baseDomain}${input.targetNamespace}/`;
          const claims = O.match(extractionArtifact, {
            onNone: () =>
              knowledgeGraphToClaims(knowledgeGraph.entities, knowledgeGraph.relations, {
                baseNamespace,
                documentId: docMeta.documentId,
                ontologyId: input.ontologyId,
                defaultConfidence: Confidence.make(0.85),
              }),
            onSome: (artifact) => artifact.claims,
          });

          if (claims.length === 0) {
            yield* Effect.logDebug("No claims to persist for document", {
              batchId: input.batchId,
              documentId: docMeta.documentId,
            });
            return { persisted: 0, documentId: docMeta.documentId };
          }

          // Persist to PostgreSQL
          const publishedAt = yield* O.match(docMeta.eventTime, {
            onNone: () => DateTime.now,
            onSome: Effect.succeed,
          });
          const persistResult = yield* claimPersistence.value.persistClaims(
            claims,
            {
              uri: docMeta.sourceUri,
              ontologyId: input.ontologyId,
              ...(O.isSome(docMeta.headline) ? { headline: docMeta.headline.value } : {}),
              publishedAt: DateTime.toDate(publishedAt),
            },
            graphUri
          );

          yield* Effect.logDebug("Claims persisted for document", {
            batchId: input.batchId,
            documentId: docMeta.documentId,
            claimsInserted: persistResult.claimsInserted,
            claimsTotal: persistResult.claimsTotal,
          });

          return {
            persisted: persistResult.claimsInserted,
            documentId: docMeta.documentId,
          };
        }).pipe(
          Effect.catch(
            Effect.fnUntraced(function* (error) {
              yield* Effect.logWarning("Failed to persist claims for document", {
                batchId: input.batchId,
                graphUri,
                error: Inspectable.toStringUnknown(error),
              });
              if (config.extraction.strictPersistence) {
                return yield* Effect.fail(error);
              }
              return { persisted: 0, failed: true, graphUri };
            })
          )
        );

        if ("failed" in result && result.failed) {
          documentsFailed++;
        } else {
          documentsProcessed++;
          totalClaimsPersisted += result.persisted;
        }
      }

      const end = yield* DateTime.now;

      yield* Effect.logInfo("Claim persistence activity complete", {
        batchId: input.batchId,
        claimsPersisted: totalClaimsPersisted,
        documentsProcessed,
        documentsFailed,
        durationMs: Duration.toMillis(DateTime.distance(start, end)),
      });

      return {
        claimsPersisted: NonNegativeInt.make(totalClaimsPersisted),
        documentsProcessed: NonNegativeInt.make(documentsProcessed),
        documentsFailed: NonNegativeInt.make(documentsFailed),
        durationMs: NonNegNum.make(Duration.toMillis(DateTime.distance(start, end))),
      };
    }).pipe(Effect.mapError(preserveActivityError)),
    interruptRetryPolicy: activityRetryPolicy,
  });

// -----------------------------------------------------------------------------
// Cross-Batch Entity Resolution Activity
// -----------------------------------------------------------------------------

/**
 * Durable Cross-Batch Entity Resolution Activity
 *
 * **Details**
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
 * **Example** (Name a cross-batch resolution activity)
 *
 * ```ts
 * import { BatchId, GcsUri, OntologyName } from "@effect-ontology/Identity"
 * import { CrossBatchResolutionInput, makeCrossBatchResolutionActivity } from "@effect-ontology/Workflow/DurableActivities"
 * import * as S from "effect/Schema"
 *
 * const activity = makeCrossBatchResolutionActivity(
 *   CrossBatchResolutionInput.make({
 *     batchId: BatchId.make("batch-deadbeefcafe"),
 *     resolvedGraphUri: S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/graphs/resolved.ttl"),
 *     enabled: true,
 *     ontologyId: OntologyName.make("foaf")
 *   })
 * )
 * console.log(activity.name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeCrossBatchResolutionActivity = (input: CrossBatchResolutionInput) =>
  Activity.make({
    name: `cross-batch-resolution-${input.batchId}`,
    success: CrossBatchResolutionOutput,
    error: ActivityError,
    execute: Effect.gen(function* () {
      const start = yield* DateTime.now;

      // Skip if not enabled
      if (!input.enabled) {
        yield* Effect.logInfo("Cross-batch resolution skipped - not enabled", {
          batchId: input.batchId,
        });
        const end = yield* DateTime.now;
        return {
          entitiesTotal: NonNegativeInt.make(0),
          matchedToExisting: NonNegativeInt.make(0),
          newCanonicals: NonNegativeInt.make(0),
          candidatesEvaluated: NonNegativeInt.make(0),
          duration: DateTime.distance(start, end),
        };
      }

      // Runtime compositions outside the server may omit the resolver, so the
      // enabled path must fail explicitly rather than reporting false success.
      const resolverOpt = yield* Effect.serviceOption(CrossBatchEntityResolver);
      const resolver = yield* Effect.fromOption(resolverOpt, () =>
        ActivityError.serviceFailure(
          "CrossBatchEntityResolver",
          "resolve enabled batch",
          "Cross-batch resolution is enabled but its resolver service is unavailable.",
          false
        )
      );
      const storage = yield* StorageService;
      const rdf = yield* RdfBuilder;

      yield* Effect.logInfo("Cross-batch entity resolution starting", {
        batchId: input.batchId,
        resolvedGraphUri: input.resolvedGraphUri,
      });

      // Load resolved graph
      const graphPath = stripGsPrefix(input.resolvedGraphUri);
      const graphContent = yield* storage
        .getOption(graphPath)
        .pipe(Effect.flatMap((content) => requireContent(content, graphPath)));

      // Parse graph and extract entities
      const store = yield* rdf.parseTurtle(graphContent);
      const knowledgeGraph = yield* storeToKnowledgeGraph(store);

      yield* Effect.logDebug("Loaded resolved graph for cross-batch resolution", {
        batchId: input.batchId,
        entityCount: knowledgeGraph.entities.length,
        relationCount: knowledgeGraph.relations.length,
      });

      // Resolve against registry
      const config = CrossBatchResolverConfig.make({});
      const result = yield* resolver.resolve(input.ontologyId, knowledgeGraph.entities, input.batchId, config);

      const end = yield* DateTime.now;

      yield* Effect.logInfo("Cross-batch entity resolution complete", {
        batchId: input.batchId,
        entitiesTotal: result.stats.totalEntities,
        matchedToExisting: result.stats.matchedToExisting,
        newCanonicals: result.stats.createdNew,
        candidatesEvaluated: result.stats.candidatesEvaluated,
        durationMs: Duration.toMillis(DateTime.distance(start, end)),
      });

      return {
        entitiesTotal: NonNegativeInt.make(result.stats.totalEntities),
        matchedToExisting: NonNegativeInt.make(result.stats.matchedToExisting),
        newCanonicals: NonNegativeInt.make(result.stats.createdNew),
        candidatesEvaluated: NonNegativeInt.make(result.stats.candidatesEvaluated),
        duration: DateTime.distance(start, end),
      };
    }).pipe(Effect.mapError(preserveActivityError)),
    interruptRetryPolicy: activityRetryPolicy,
  });

// -----------------------------------------------------------------------------
// RDFS Inference Activity
// -----------------------------------------------------------------------------

/**
 * Input for Inference activity
 *
 * **Example** (Decode an inference input)
 *
 * ```ts
 * import { InferenceInput } from "@effect-ontology/Workflow/DurableActivities"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(InferenceInput)({
 *   batchId: "batch-deadbeefcafe",
 *   resolvedGraphUri: "gs://beep-ontology-state/graphs/resolved.ttl",
 *   profile: "rdfs",
 *   enabled: true
 * })
 * console.log(O.map(decoded, (input) => input.profile))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const InferenceInput = S.Struct({
  /** Batch ID for logging and provenance */
  batchId: BatchId,
  /** URI of the resolved graph to reason over */
  resolvedGraphUri: S.String,
  /** Reasoning profile to use (default: rdfs) */
  profile: S.Literals(["rdfs", "rdfs-subclass", "owl-sameas", "custom"]).pipe(
    S.OptionFromOptionalKey,
    SchemaUtils.withNoneDefault
  ),
  /** Whether inference is enabled (default: true) */
  enabled: S.Boolean.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}).pipe(
  $I.annoteSchema("InferenceInput", {
    description: "Batch, resolved graph URI, reasoning profile, and enablement flag for RDFS inference.",
  })
);

/**
 * Decoded inference activity input produced by {@link InferenceInput}.
 *
 * @see {@link InferenceInput} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type InferenceInput = typeof InferenceInput.Type;

/**
 * Output for Inference activity
 *
 * **Example** (Decode an inference output)
 *
 * ```ts
 * import { InferenceOutput } from "@effect-ontology/Workflow/DurableActivities"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(InferenceOutput)({
 *   enrichedGraphUri: "gs://beep-ontology-state/graphs/enriched.ttl",
 *   inferredTripleCount: 3,
 *   totalTripleCount: 15,
 *   provenanceQuadCount: 3,
 *   rulesApplied: 2,
 *   durationMs: 11
 * })
 * console.log(O.map(decoded, (output) => output.inferredTripleCount))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const InferenceOutput = S.Struct({
  /** URI of the enriched graph with inferences */
  enrichedGraphUri: GcsUri,
  /** Number of triples inferred */
  inferredTripleCount: NonNegativeInt,
  /** Total triples after inference */
  totalTripleCount: NonNegativeInt,
  /** Number of provenance quads added */
  provenanceQuadCount: NonNegativeInt,
  /** Number of rules applied */
  rulesApplied: NonNegativeInt,
  /** Duration in milliseconds */
  durationMs: NonNegNum,
}).pipe(
  $I.annoteSchema("InferenceOutput", {
    description: "Enriched graph URI, inferred triple counts, provenance quads, and elapsed milliseconds.",
  })
);

/**
 * Decoded inference activity output produced by {@link InferenceOutput}.
 *
 * @see {@link InferenceOutput} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type InferenceOutput = typeof InferenceOutput.Type;

/**
 * Durable RDFS Inference Activity
 *
 * **Details**
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
 * **Example** (Name an inference activity)
 *
 * ```ts
 * import { InferenceInput, makeInferenceActivity } from "@effect-ontology/Workflow/DurableActivities"
 * import * as S from "effect/Schema"
 *
 * const activity = makeInferenceActivity(
 *   S.decodeUnknownSync(InferenceInput)({
 *     batchId: "batch-deadbeefcafe",
 *     resolvedGraphUri: "gs://beep-ontology-state/graphs/resolved.ttl"
 *   })
 * )
 * console.log(activity.name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeInferenceActivity = (input: InferenceInput) =>
  Activity.make({
    name: `inference-${input.batchId}`,
    success: InferenceOutput,
    error: ActivityError,
    execute: Effect.gen(function* () {
      const start = yield* DateTime.now;
      const storage = yield* StorageService;
      const config = yield* ConfigService;
      const rdf = yield* RdfBuilder;
      const reasoner = yield* Reasoner;
      const bucket = resolveBucket(config);

      // Skip if not enabled
      const enabled = input.enabled ?? true;
      if (O.isNone(enabled)) {
        yield* Effect.logInfo("Inference skipped - not enabled", {
          batchId: input.batchId,
        });
        const end = yield* DateTime.now;
        return {
          enrichedGraphUri: GcsUri.decodeUnknownSync(input.resolvedGraphUri),
          inferredTripleCount: NonNegativeInt.make(0),
          totalTripleCount: NonNegativeInt.make(0),
          provenanceQuadCount: NonNegativeInt.make(0),
          rulesApplied: NonNegativeInt.make(0),
          durationMs: NonNegNum.make(Duration.toMillis(DateTime.distance(start, end))),
        };
      }

      yield* Effect.logInfo("Inference activity starting", {
        batchId: input.batchId,
        profile: input.profile ?? "rdfs",
      });

      // 1. Load resolved graph
      const graphPath = stripGsPrefix(input.resolvedGraphUri);
      const graphContent = yield* storage
        .getOption(graphPath)
        .pipe(Effect.flatMap((content) => requireContent(content, graphPath)));
      const originalStore = yield* rdf.parseTurtle(graphContent);

      // 2. Apply reasoning (creates a copy, doesn't mutate original)
      const profile: ReasoningConfig["profile"] = O.getOrElse(input.profile, () => "rdfs");
      const reasoningConfig = ReasoningConfig.make({ profile });
      const { result: reasoningResult, store: enrichedStore } = yield* reasoner.reasonCopy(
        originalStore,
        reasoningConfig
      );

      yield* Effect.logInfo("Reasoning complete", {
        batchId: input.batchId,
        inferredTriples: reasoningResult.inferredTripleCount,
        totalTriples: reasoningResult.totalTripleCount,
        rulesApplied: reasoningResult.rulesApplied,
      });

      // 3. Compute delta (new triples only)
      const delta = yield* computeQuadDelta(originalStore, enrichedStore);

      // 4. Add PROV provenance for the inference activity
      let provenanceQuadCount = 0;
      if (delta.deltaCount > 0) {
        const inferenceActivityIri = `urn:provenance:inference:${input.batchId}`;
        // Helper to add a quad to the enriched store
        const addQuad = (s: string, p: string, o: string) => {
          rdfStoreAddQuad(
            enrichedStore,
            makeQuad(
              makeNamedNode(s),
              makeNamedNode(p),
              Str.startsWith("http")(o) || Str.startsWith("urn:")(o)
                ? makeNamedNode(o)
                : makeLiteral(o, "https://www.w3.org/2001/XMLSchema#string")
            )
          );
        };

        // Add inference activity metadata
        addQuad(inferenceActivityIri, RDF_TYPE.value, PROV_ACTIVITY.value);
        addQuad(inferenceActivityIri, PROV_GENERATED_AT_TIME.value, DateTime.formatIso(start));
        addQuad(inferenceActivityIri, PROV_USED.value, input.resolvedGraphUri);
        provenanceQuadCount += 3;

        // For each inferred triple, add prov:wasGeneratedBy linking to the activity
        // We use RDF reification (rdf:Statement) to reference the inferred triples
        for (const quad of delta.newQuads) {
          // Create a statement IRI based on hash of the quad
          const quadHash = `${quad.subject.value}|${quad.predicate.value}|${quad.object.value}`
            .split("")
            .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
          const statementIri = `${inferenceActivityIri}/stmt/${Math.abs(quadHash).toString(16)}`;

          // Reify the statement
          addQuad(statementIri, RDF_TYPE.value, RDF_STATEMENT.value);
          addQuad(statementIri, RDF_SUBJECT.value, quad.subject.value);
          addQuad(statementIri, RDF_PREDICATE.value, quad.predicate.value);
          addQuad(
            statementIri,
            RDF_OBJECT.value,
            quad.object.termType === "Literal" ? `"${quad.object.value}"` : quad.object.value
          );
          addQuad(statementIri, PROV_WAS_GENERATED_BY.value, inferenceActivityIri);
          provenanceQuadCount += 5;
        }

        yield* Effect.logInfo("Added provenance for inferred triples", {
          batchId: input.batchId,
          inferredTriples: delta.deltaCount,
          provenanceQuads: provenanceQuadCount,
        });
      }

      // 5. Save enriched graph
      const enrichedTurtle = yield* rdf.toTurtle(enrichedStore);
      const enrichedPath = PathLayout.batch.inference(input.batchId);
      yield* storage.set(enrichedPath, enrichedTurtle);

      const end = yield* DateTime.now;

      yield* Effect.logInfo("Inference activity complete", {
        batchId: input.batchId,
        inferredTriples: delta.deltaCount,
        totalTriples: rdfStoreSize(enrichedStore),
        provenanceQuads: provenanceQuadCount,
        durationMs: Duration.toMillis(DateTime.distance(start, end)),
      });

      return {
        enrichedGraphUri: GcsUri.decodeUnknownSync(`gs://${bucket}/${enrichedPath}`),
        inferredTripleCount: NonNegativeInt.make(delta.deltaCount),
        totalTripleCount: NonNegativeInt.make(rdfStoreSize(enrichedStore)),
        provenanceQuadCount: NonNegativeInt.make(provenanceQuadCount),
        rulesApplied: reasoningResult.rulesApplied,
        durationMs: NonNegNum.make(Duration.toMillis(DateTime.distance(start, end))),
      };
    }).pipe(Effect.mapError(preserveActivityError)),
    interruptRetryPolicy: activityRetryPolicy,
  });

// -----------------------------------------------------------------------------
// Compute Ontology Embeddings Activity
// -----------------------------------------------------------------------------

/**
 * Input for ComputeOntologyEmbeddings activity
 *
 * **Example** (Decode a compute-embeddings input)
 *
 * ```ts
 * import { ComputeEmbeddingsInput } from "@effect-ontology/Workflow/DurableActivities"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(ComputeEmbeddingsInput)({
 *   ontologyUri: "gs://beep-ontology-state/ontologies/foaf.ttl",
 *   model: "nomic-embed-text"
 * })
 * console.log(O.map(decoded, (input) => input.ontologyUri))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ComputeEmbeddingsInput = S.Struct({
  /** URI of the ontology (e.g., "gs://bucket/ontologies/football/ontology.ttl") */
  ontologyUri: S.String,
  /** Embedding model to use */
  model: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}).pipe(
  $I.annoteSchema("ComputeEmbeddingsInput", {
    description: "Ontology URI and optional embedding model used to pre-compute class and property vectors.",
  })
);

/**
 * Decoded compute-embeddings input produced by {@link ComputeEmbeddingsInput}.
 *
 * @see {@link ComputeEmbeddingsInput} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ComputeEmbeddingsInput = typeof ComputeEmbeddingsInput.Type;

/**
 * Output for ComputeOntologyEmbeddings activity
 *
 * **Example** (Decode a compute-embeddings output)
 *
 * ```ts
 * import { ComputeEmbeddingsOutput } from "@effect-ontology/Workflow/DurableActivities"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(ComputeEmbeddingsOutput)({
 *   embeddingsUri: "gs://beep-ontology-state/ontologies/foaf.embeddings.json",
 *   version: "e3b0c44298fc",
 *   classCount: 12,
 *   propertyCount: 8,
 *   dimension: 768,
 *   durationMs: 90
 * })
 * console.log(O.map(decoded, (output) => output.dimension))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ComputeEmbeddingsOutput = S.Struct({
  /** URI of the stored embeddings blob */
  embeddingsUri: GcsUri,
  /** Version hash of the ontology */
  version: S.String,
  /** Number of class embeddings */
  classCount: NonNegativeInt,
  /** Number of property embeddings */
  propertyCount: NonNegativeInt,
  /** Embedding dimension */
  dimension: NonNegativeInt,
  /** Duration in milliseconds */
  durationMs: NonNegNum,
}).pipe(
  $I.annoteSchema("ComputeEmbeddingsOutput", {
    description: "Stored embeddings URI, ontology version, class/property counts, vector dimension, and duration.",
  })
);

/**
 * Decoded compute-embeddings output produced by {@link ComputeEmbeddingsOutput}.
 *
 * @see {@link ComputeEmbeddingsOutput} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ComputeEmbeddingsOutput = typeof ComputeEmbeddingsOutput.Type;

/**
 * Durable Compute Ontology Embeddings Activity
 *
 * **Details**
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
 *
 * **Example** (Name a compute-embeddings activity)
 *
 * ```ts
 * import { ComputeEmbeddingsInput, makeComputeEmbeddingsActivity } from "@effect-ontology/Workflow/DurableActivities"
 * import * as S from "effect/Schema"
 *
 * const activity = makeComputeEmbeddingsActivity(
 *   S.decodeUnknownSync(ComputeEmbeddingsInput)({
 *     ontologyUri: "gs://beep-ontology-state/ontologies/foaf.ttl"
 *   })
 * )
 * console.log(activity.name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeComputeEmbeddingsActivity = (input: ComputeEmbeddingsInput) =>
  Activity.make({
    name: "compute-ontology-embeddings",
    success: ComputeEmbeddingsOutput,
    error: ActivityError,
    execute: Effect.gen(function* () {
      const start = yield* DateTime.now;
      const storage = yield* StorageService;
      const config = yield* ConfigService;
      const rdf = yield* RdfBuilder;
      const embedding = yield* EmbeddingService;
      const bucket = resolveBucket(config);

      // Get actual provider metadata for accurate model tracking
      const providerMetadata = yield* embedding.getProviderMetadata;

      yield* Effect.logInfo("Computing ontology embeddings", {
        ontologyUri: input.ontologyUri,
        provider: providerMetadata.providerId,
        model: providerMetadata.modelId,
      });

      // 1. Load ontology content
      const ontologyPath = stripGsPrefix(input.ontologyUri);
      const ontologyContent = yield* storage
        .getOption(ontologyPath)
        .pipe(Effect.flatMap((content) => requireContent(content, ontologyPath)));

      // 2. Compute version hash
      const version = yield* OntologyEmbeddings.computeVersion(ontologyContent);

      // 3. Parse ontology and extract classes/properties
      const store = yield* rdf.parseTurtle(ontologyContent);
      const { classes, properties } = yield* parseOntologyFromStore(rdf, store, ontologyPath);

      yield* Effect.logInfo("Ontology loaded", {
        classCount: Chunk.size(classes),
        propertyCount: Chunk.size(properties),
        version,
      });

      // 4. Embed all classes (parallelized for ~5x speedup)
      // Concurrency limited to 5 to respect embedding service rate limits
      const classEmbeddings = yield* Effect.forEach(
        Chunk.toReadonlyArray(classes),
        (cls) =>
          Effect.gen(function* () {
            const text = ElementEmbedding.buildText(cls.label, cls.definition ?? cls.comment, cls.altLabels ?? []);
            const emb = yield* embedding.embed(text, "search_document");
            return yield* ElementEmbedding.decodeUnknownEffect({
              iri: cls.id,
              text,
              embedding: A.fromIterable(emb),
            });
          }),
        { concurrency: 5 }
      );

      // 5. Embed all properties (parallelized for ~5x speedup)
      const propertyEmbeddings = yield* Effect.forEach(
        Chunk.toReadonlyArray(properties),

        Effect.fnUntraced(function* (prop) {
          const text = ElementEmbedding.buildText(prop.label, prop.comment, []);
          const emb = yield* embedding.embed(text, "search_document");
          return yield* ElementEmbedding.decodeUnknownEffect({
            iri: prop.id,
            text,
            embedding: A.fromIterable(emb),
          });
        }),
        { concurrency: 5 }
      );

      // 6. Determine dimension from first embedding
      const dimension = classEmbeddings[0]?.embedding.length ?? propertyEmbeddings[0]?.embedding.length ?? 0;

      // 7. Build OntologyEmbeddings blob
      // Use actual provider model from metadata, not hardcoded fallback
      const ontologyUri = GcsUri.decodeUnknownSync(input.ontologyUri);
      const embeddingsBlob = yield* OntologyEmbeddings.decodeUnknownEffect({
        ontologyUri,
        version: ContentHash.make(version),
        model: O.getOrElse(input.model, () => providerMetadata.modelId),
        dimension: NonNegativeInt.make(dimension),
        createdAt: start,
        classes: classEmbeddings,
        properties: propertyEmbeddings,
      });

      // 8. Serialize and store
      const embeddingsJson = yield* OntologyEmbeddingsJson.encodeEffect(embeddingsBlob);
      const embeddingsPath = stripGsPrefix(OntologyEmbeddings.storagePathFor(ontologyUri));
      yield* storage.set(embeddingsPath, embeddingsJson);

      const end = yield* DateTime.now;

      yield* Effect.logInfo("Ontology embeddings computed and stored", {
        embeddingsPath,
        classCount: classEmbeddings.length,
        propertyCount: propertyEmbeddings.length,
        dimension,
        durationMs: Duration.toMillis(DateTime.distance(start, end)),
      });

      return {
        embeddingsUri: GcsUri.decodeUnknownSync(`gs://${bucket}/${embeddingsPath}`),
        version,
        classCount: NonNegativeInt.make(classEmbeddings.length),
        propertyCount: NonNegativeInt.make(propertyEmbeddings.length),
        dimension: NonNegativeInt.make(dimension),
        durationMs: NonNegNum.make(Duration.toMillis(DateTime.distance(start, end))),
      };
    }).pipe(Effect.mapError(preserveActivityError)),
    interruptRetryPolicy: activityRetryPolicy,
  });

// -----------------------------------------------------------------------------
// LLM Verification Activity (Entity Resolution Enhancement)
// -----------------------------------------------------------------------------

/**
 * Entity pair for LLM verification
 *
 * **Example** (Decode an entity pair)
 *
 * ```ts
 * import { EntityPair } from "@effect-ontology/Workflow/DurableActivities"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(EntityPair)({
 *   entityA: "eze",
 *   entityB: "eberechi_eze",
 *   mentionA: "Eze",
 *   mentionB: "Eberechi Eze",
 *   typesA: ["https://schema.org/Person"],
 *   typesB: ["https://schema.org/Person"],
 *   similarity: 0.62
 * })
 * console.log(O.map(decoded, (pair) => pair.mentionB))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EntityPair = S.Struct({
  /** First entity ID */
  entityA: S.String,
  /** Second entity ID */
  entityB: S.String,
  /** Mention text for entity A */
  mentionA: S.String,
  /** Mention text for entity B */
  mentionB: S.String,
  /** Types for entity A */
  typesA: S.Array(S.String),
  /** Types for entity B */
  typesB: S.Array(S.String),
  /** Initial similarity score from embedding/string matching */
  similarity: UnitInterval,
}).pipe(
  $I.annoteSchema("EntityPair", {
    description: "Two entity mentions, types, and a similarity score presented to the LLM verifier.",
  })
);

/**
 * Decoded entity pair produced by {@link EntityPair}.
 *
 * @see {@link EntityPair} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type EntityPair = typeof EntityPair.Type;

/**
 * Input for LLM verification activity
 *
 * **Example** (Decode an LLM verification input)
 *
 * ```ts
 * import { LlmVerificationInput } from "@effect-ontology/Workflow/DurableActivities"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(LlmVerificationInput)({
 *   batchId: "batch-deadbeefcafe",
 *   entityPairs: [{
 *     entityA: "eze",
 *     entityB: "eberechi_eze",
 *     mentionA: "Eze",
 *     mentionB: "Eberechi Eze",
 *     typesA: ["https://schema.org/Person"],
 *     typesB: ["https://schema.org/Person"],
 *     similarity: 0.62
 *   }],
 *   verificationThreshold: 0.7
 * })
 * console.log(O.map(decoded, (input) => input.entityPairs.length))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LlmVerificationInput = S.Struct({
  /** Batch ID for context */
  batchId: BatchId,
  /** Entity pairs with low confidence to verify */
  entityPairs: S.Array(EntityPair),
  /** Similarity threshold below which to verify (default: 0.7) */
  verificationThreshold: UnitInterval.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}).pipe(
  $I.annoteSchema("LlmVerificationInput", {
    description: "Batch identity, uncertain entity pairs, and optional similarity threshold for LLM verification.",
  })
);

/**
 * Decoded LLM verification input produced by {@link LlmVerificationInput}.
 *
 * @see {@link LlmVerificationInput} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type LlmVerificationInput = typeof LlmVerificationInput.Type;

/**
 * Verified entity pair result
 *
 * **Example** (Decode a verified pair)
 *
 * ```ts
 * import { VerifiedPair } from "@effect-ontology/Workflow/DurableActivities"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(VerifiedPair)({
 *   entityA: "eze",
 *   entityB: "eberechi_eze",
 *   sameEntity: true,
 *   confidence: 0.91,
 *   originalSimilarity: 0.62
 * })
 * console.log(O.map(decoded, (pair) => pair.sameEntity))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VerifiedPair = S.Struct({
  /** First entity ID */
  entityA: S.String,
  /** Second entity ID */
  entityB: S.String,
  /** Whether LLM confirmed these are the same entity */
  sameEntity: S.Boolean,
  /** LLM confidence in the verification */
  confidence: Confidence,
  /** Original similarity score */
  originalSimilarity: UnitInterval,
}).pipe(
  $I.annoteSchema("VerifiedPair", {
    description: "LLM same-entity decision, confidence, and original similarity for one candidate pair.",
  })
);

/**
 * Decoded verified pair produced by {@link VerifiedPair}.
 *
 * @see {@link VerifiedPair} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type VerifiedPair = typeof VerifiedPair.Type;

/**
 * Output for LLM verification activity
 *
 * **Example** (Decode an LLM verification output)
 *
 * ```ts
 * import { LlmVerificationOutput } from "@effect-ontology/Workflow/DurableActivities"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(LlmVerificationOutput)({
 *   verified: [],
 *   rejected: [],
 *   skipped: 1,
 *   totalProcessed: 1,
 *   durationMs: 30
 * })
 * console.log(O.map(decoded, (output) => output.skipped))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LlmVerificationOutput = S.Struct({
  /** Pairs verified as same entity */
  verified: S.Array(VerifiedPair),
  /** Pairs rejected as different entities */
  rejected: S.Array(VerifiedPair),
  /** Pairs skipped (above threshold) */
  skipped: NonNegativeInt,
  /** Total pairs processed */
  totalProcessed: NonNegativeInt,
  /** Duration in milliseconds */
  durationMs: NonNegNum,
}).pipe(
  $I.annoteSchema("LlmVerificationOutput", {
    description: "Verified, rejected, and skipped pair counts produced by LLM entity verification.",
  })
);
/**
 * Decoded LLM verification output produced by {@link LlmVerificationOutput}.
 *
 * @see {@link LlmVerificationOutput} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type LlmVerificationOutput = typeof LlmVerificationOutput.Type;

/**
 * Schema for single LLM entity comparison response
 */
const EntityComparisonSchema = S.Struct({
  sameEntity: S.Boolean.annotate({
    description: "True if these refer to the same real-world entity",
  }),
  confidence: Confidence.annotate({
    description: "Confidence in the decision (0-1)",
  }),
  reasoning: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
    description: "Brief explanation of the decision",
  }),
}).annotate({
  identifier: "EntityComparison",
  description: "LLM decision on whether two entities are the same",
});

/**
 * Schema for batch entity comparison response
 */
const BatchComparisonSchema = S.Struct({
  results: S.Array(
    S.Struct({
      index: NonNegativeInt.annotate({
        description: "Index of the pair in the input list (0-based)",
      }),
      sameEntity: S.Boolean.annotate({
        description: "True if these refer to the same real-world entity",
      }),
      confidence: Confidence.annotate({
        description: "Confidence in the decision (0-1)",
      }),
    })
  ),
}).annotate({
  identifier: "BatchEntityComparison",
  description: "LLM decisions for multiple entity pairs",
});

const formatEntityTypeLabels = (types: ReadonlyArray<string>): string =>
  A.join(A.map(types, extractLocalNameFromIri), ", ");

/**
 * Build prompt for single entity comparison
 * @internal
 */
const buildComparisonPrompt = (pair: EntityPair): string => {
  const typeLabelsA = formatEntityTypeLabels(pair.typesA);
  const typeLabelsB = formatEntityTypeLabels(pair.typesB);

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
- confidence should reflect how certain you are about the decision`;
};

/**
 * Build prompt for batch entity comparison
 * @internal
 */
const buildBatchComparisonPrompt = (pairs: ReadonlyArray<EntityPair>): string => {
  const pairsFormatted = pairs
    .map((pair, i) => {
      const typeLabelsA = formatEntityTypeLabels(pair.typesA);
      const typeLabelsB = formatEntityTypeLabels(pair.typesB);
      return `${i}. Entity A: "${pair.mentionA}" (${typeLabelsA || "?"})\n   Entity B: "${pair.mentionB}" (${
        typeLabelsB || "?"
      })\n   Similarity: ${pair.similarity.toFixed(2)}`;
    })
    .join("\n\n");

  return `You are an entity resolution expert. For each pair, determine if the two mentions refer to the same real-world entity.

Pairs to evaluate:
${pairsFormatted}

Instructions:
- For each pair, decide: Do these mentions refer to the SAME real-world entity?
- Consider: nicknames, abbreviations, alternate spellings, naming variations
- If types don't overlap, they're likely different entities
- Return JSON with "results" array, each having: { "index": <pair number>, "sameEntity": boolean, "confidence": number (0-1) }
- Return results for ALL pairs in order`;
};

/**
 * Default verification threshold (verify pairs below this similarity)
 */
const DEFAULT_VERIFICATION_THRESHOLD = 0.7;

/**
 * Batch size for LLM verification
 */
const VERIFICATION_BATCH_SIZE = 5;

/**
 * Durable LLM Verification Activity
 *
 * **Details**
 *
 * Verifies low-confidence entity pairs using LLM to improve resolution accuracy.
 * This is an optional post-clustering step for entity resolution.
 *
 * Use cases:
 * - Verify uncertain matches (similarity 0.5-0.7) before merging
 * - Catch false negatives from pure string/embedding matching
 * - Improve recall for entities with very different surface forms
 *
 * **Example** (Name an LLM verification activity)
 *
 * ```ts
 * import { LlmVerificationInput, makeLlmVerificationActivity } from "@effect-ontology/Workflow/DurableActivities"
 * import * as S from "effect/Schema"
 *
 * const activity = makeLlmVerificationActivity(
 *   S.decodeUnknownSync(LlmVerificationInput)({
 *     batchId: "batch-deadbeefcafe",
 *     entityPairs: []
 *   })
 * )
 * console.log(activity.name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeLlmVerificationActivity = (input: LlmVerificationInput) =>
  Activity.make({
    name: `llm-verification-${input.batchId}`,
    success: LlmVerificationOutput,
    error: ActivityError,
    execute: Effect.gen(function* () {
      const start = yield* DateTime.now;
      const config = yield* ConfigService;
      const llm = yield* LanguageModel.LanguageModel;

      const threshold = O.getOrElse(input.verificationThreshold, () => DEFAULT_VERIFICATION_THRESHOLD);

      // Filter pairs that need verification (below threshold)
      const pairsToVerify = input.entityPairs.filter((p) => p.similarity < threshold);
      const skippedCount = input.entityPairs.length - pairsToVerify.length;

      yield* Effect.logInfo("LLM verification activity starting", {
        batchId: input.batchId,
        totalPairs: input.entityPairs.length,
        pairsToVerify: pairsToVerify.length,
        skipped: skippedCount,
        threshold,
      });

      if (pairsToVerify.length === 0) {
        const end = yield* DateTime.now;
        return {
          verified: [],
          rejected: [],
          skipped: NonNegativeInt.make(skippedCount),
          totalProcessed: NonNegativeInt.make(0),
          durationMs: NonNegNum.make(Duration.toMillis(DateTime.distance(start, end))),
        };
      }

      const verified: Array<VerifiedPair> = [];
      const rejected: Array<VerifiedPair> = [];

      // Process in batches
      for (let i = 0; i < pairsToVerify.length; i += VERIFICATION_BATCH_SIZE) {
        const batch = pairsToVerify.slice(i, i + VERIFICATION_BATCH_SIZE);

        if (batch.length === 1) {
          // Single pair: use focused prompt
          const pair = batch[0];
          const prompt = buildComparisonPrompt(pair);

          const result = yield* generateObjectWithRetry({
            prompt,
            schema: EntityComparisonSchema,
            objectName: "EntityComparison",
            serviceName: "LlmVerification",
            model: config.llm.model,
            provider: config.llm.provider,
            retryPolicy: config.llm.retryPolicy,
            spanAttributes: {
              [LlmAttributes.PROMPT_LENGTH]: prompt.length,
              "verification.pair_index": i,
            },
          }).pipe(Effect.provideService(LanguageModel.LanguageModel, llm));

          const verifiedPair: VerifiedPair = {
            entityA: pair.entityA,
            entityB: pair.entityB,
            sameEntity: result.value.sameEntity,
            confidence: result.value.confidence,
            originalSimilarity: pair.similarity,
          };

          if (result.value.sameEntity) {
            verified.push(verifiedPair);
          } else {
            rejected.push(verifiedPair);
          }
        } else {
          // Batch verification
          const prompt = buildBatchComparisonPrompt(batch);

          const result = yield* generateObjectWithRetry({
            prompt,
            schema: BatchComparisonSchema,
            objectName: "BatchEntityComparison",
            serviceName: "LlmVerification",
            model: config.llm.model,
            provider: config.llm.provider,
            retryPolicy: config.llm.retryPolicy,
            spanAttributes: {
              [LlmAttributes.PROMPT_LENGTH]: prompt.length,
              "verification.batch_size": batch.length,
              "verification.batch_start": i,
            },
          }).pipe(Effect.provideService(LanguageModel.LanguageModel, llm));

          // Map results back to pairs
          const resultsMap = HashMap.fromIterable(result.value.results.map((r) => [r.index, r]));

          batch.forEach((pair, idx) => {
            const llmResult = HashMap.get(resultsMap, NonNegativeInt.make(idx));
            const verifiedPair: VerifiedPair = {
              entityA: pair.entityA,
              entityB: pair.entityB,
              sameEntity: O.match(llmResult, {
                onNone: () => false,
                onSome: (value) => value.sameEntity,
              }),
              confidence: O.match(llmResult, {
                onNone: () => Confidence.make(0),
                onSome: (value) => value.confidence,
              }),
              originalSimilarity: pair.similarity,
            };

            if (O.isSome(llmResult)) {
              verified.push(verifiedPair);
            } else {
              rejected.push(verifiedPair);
            }
          });
        }
      }

      const end = yield* DateTime.now;

      yield* Effect.logInfo("LLM verification activity complete", {
        batchId: input.batchId,
        verified: verified.length,
        rejected: rejected.length,
        skipped: skippedCount,
        totalProcessed: pairsToVerify.length,
        durationMs: Duration.toMillis(DateTime.distance(start, end)),
      });

      return {
        verified,
        rejected,
        skipped: NonNegativeInt.make(skippedCount),
        totalProcessed: NonNegativeInt.make(pairsToVerify.length),
        durationMs: NonNegNum.make(Duration.toMillis(DateTime.distance(start, end))),
      };
    }).pipe(Effect.mapError(preserveActivityError)),
    interruptRetryPolicy: activityRetryPolicy,
  });

// -----------------------------------------------------------------------------
// Document Preprocessing Activity
// -----------------------------------------------------------------------------

/**
 * Output schema for preprocessing activity
 *
 * **Example** (Decode a preprocessing output)
 *
 * ```ts
 * import { PreprocessingOutput } from "@effect-ontology/Workflow/DurableActivities"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(PreprocessingOutput)({
 *   enrichedManifestUri: "gs://beep-ontology-state/batches/batch-deadbeefcafe/enriched.json",
 *   totalDocuments: 3,
 *   classifiedCount: 3,
 *   failedCount: 0,
 *   totalEstimatedTokens: 1200,
 *   averageComplexity: 0.4,
 *   durationMs: 55
 * })
 * console.log(O.map(decoded, (output) => output.classifiedCount))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PreprocessingOutput = S.Struct({
  enrichedManifestUri: GcsUri,
  totalDocuments: NonNegativeInt,
  classifiedCount: NonNegativeInt,
  failedCount: NonNegativeInt,
  totalEstimatedTokens: NonNegativeInt,
  averageComplexity: UnitInterval,
  durationMs: NonNegNum,
}).pipe(
  $I.annoteSchema("PreprocessingOutput", {
    description: "Enriched manifest URI, classification counts, token estimates, complexity, and duration.",
  })
);

/**
 * Decoded preprocessing output produced by {@link PreprocessingOutput}.
 *
 * @see {@link PreprocessingOutput} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type PreprocessingOutput = typeof PreprocessingOutput.Type;

/** Preview size in bytes for classification */
const PREVIEW_SIZE = 4096;

/** Batch size for LLM classification calls */
/**
 * Build classification prompt for a batch of document previews
 */
const buildClassificationPrompt = (
  previews: ReadonlyArray<{
    index: number;
    preview: string;
    contentType: string;
  }>
): string => {
  const docSummaries = previews
    .map(({ contentType, index, preview }) => `Document ${index} (${contentType}):\n"""${preview.slice(0, 1500)}"""`)
    .join("\n\n---\n\n");

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

Respond with classifications for each document by index.`;
};

/**
 * Durable Preprocessing Activity
 *
 * **Details**
 *
 * Preprocesses documents in a batch to extract metadata for intelligent batching:
 * - Loads document previews (first ${PREVIEW_SIZE} bytes)
 * - Classifies documents using LLM in batches
 * - Computes chunking strategies and priorities
 * - Creates EnrichedManifest for downstream processing
 *
 * **Example** (Name a preprocessing activity)
 *
 * ```ts
 * import { BatchId, GcsUri } from "@effect-ontology/Identity"
 * import { PreprocessingActivityInput } from "@effect-ontology/Schema/DocumentMetadata"
 * import { makePreprocessingActivity } from "@effect-ontology/Workflow/DurableActivities"
 * import * as S from "effect/Schema"
 *
 * const activity = makePreprocessingActivity(
 *   PreprocessingActivityInput.make({
 *     batchId: BatchId.make("batch-deadbeefcafe"),
 *     manifestUri: S.decodeUnknownSync(GcsUri)("gs://beep-ontology-state/batches/batch-deadbeefcafe/manifest.json")
 *   })
 * )
 * console.log(activity.name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makePreprocessingActivity = (input: PreprocessingActivityInput) =>
  Activity.make({
    name: `preprocessing-${input.batchId}`,
    success: PreprocessingOutput,
    error: ActivityError,
    execute: Effect.gen(function* () {
      const start = yield* DateTime.now;
      const storage = yield* StorageService;
      const config = yield* ConfigService;
      const llm = yield* LanguageModel.LanguageModel;
      const bucket = resolveBucket(config);

      // Resolve preprocessing options (use defaults if not provided)
      // Support both new preprocessing options and deprecated skipClassification
      const shouldClassify = input.preprocessing.classifyDocuments;
      const options = {
        classifyDocuments: shouldClassify,
        adaptiveChunking: input.preprocessing.adaptiveChunking,
        priorityOrdering: input.preprocessing.priorityOrdering,
        chunkingStrategyOverride: input.preprocessing.chunkingStrategyOverride,
        classificationBatchSize: input.preprocessing.classificationBatchSize,
      };

      yield* Effect.logInfo("Preprocessing activity starting", {
        batchId: input.batchId,
        manifestUri: input.manifestUri,
        options,
      });

      // 1. Load the batch manifest
      const manifestPath = stripGsPrefix(input.manifestUri);
      const manifestContent = yield* storage
        .getOption(manifestPath)
        .pipe(Effect.flatMap((content) => requireContent(content, manifestPath)));
      const manifest = yield* BatchManifest.decodeEffectFromJsonString(manifestContent).pipe(
        Effect.mapError((e) => notFoundError("BatchManifest", `Parse error: ${e}`))
      );

      yield* Effect.logInfo("Manifest loaded", {
        batchId: input.batchId,
        documentCount: manifest.documents.length,
      });

      // 2. Load document previews (first PREVIEW_SIZE bytes of each)
      const previews = yield* Effect.forEach(
        manifest.documents,
        (doc, index) =>
          Effect.gen(function* () {
            const sourcePath = stripGsPrefix(doc.sourceUri);
            const content = yield* storage.getOption(sourcePath).pipe(
              Effect.tap((content) =>
                O.match(content, {
                  onNone: () =>
                    Effect.logWarning("Document is absent while loading preprocessing preview", {
                      documentId: doc.documentId,
                      sourcePath,
                    }),
                  onSome: () => Effect.void,
                })
              ),
              Effect.catch((error) =>
                Effect.gen(function* () {
                  yield* Effect.logWarning("Failed to load document for preview", {
                    documentId: doc.documentId,
                    sourcePath,
                    error: Inspectable.toStringUnknown(error),
                  });
                  return O.none<string>();
                })
              )
            );
            return {
              index,
              documentId: doc.documentId,
              sourceUri: doc.sourceUri,
              contentType: doc.contentType,
              sizeBytes: doc.sizeBytes,
              preview: O.map(content, Str.slice(0, PREVIEW_SIZE)),
            };
          }),
        { concurrency: 10 }
      );

      yield* Effect.logInfo("Document previews loaded", {
        batchId: input.batchId,
        previewCount: previews.length,
      });

      // 3. Classify documents (skip if requested)
      const preprocessedAt = yield* DateTime.now;

      let documentMetadata: Array<DocumentMetadata>;
      let classifiedCount = 0;
      let failedCount = 0;

      if (!options.classifyDocuments) {
        // Use defaults for all documents (no classification)
        // Apply chunkingStrategyOverride if provided
        const overrideStrategy = options.chunkingStrategyOverride;
        documentMetadata = previews.map((p) => {
          const fallback = DocumentMetadata.fallback({
            documentId: p.documentId,
            sourceUri: p.sourceUri,
            contentType: p.contentType,
            sizeBytes: NonNegativeInt.make(p.sizeBytes),
            preprocessedAt,
          });
          return O.match(overrideStrategy, {
            onNone: () => fallback,
            onSome: (strategy) => {
              const params = ChunkingStrategy.parameters(strategy);
              return DocumentMetadata.make({
                ...fallback,
                chunkingStrategy: strategy,
                suggestedChunkSize: params.chunkSize,
                suggestedOverlap: params.overlapSentences,
              });
            },
          });
        });
        failedCount = previews.length;
      } else {
        // Batch LLM classification
        const classifications = MutableHashMap.empty<number, DocumentClassification>();

        // Process in batches (use configurable batch size)
        const batchSize = options.classificationBatchSize;
        for (let i = 0; i < previews.length; i += batchSize) {
          const batch = previews.slice(i, i + batchSize);
          const batchPreviews = A.getSomes(
            A.map(batch, (preview) =>
              O.map(preview.preview, (text) => ({
                index: preview.index,
                preview: text,
                contentType: preview.contentType,
              }))
            )
          );

          yield* Effect.logDebug("Classifying batch", {
            batchId: input.batchId,
            batchStart: i,
            batchSize: batch.length,
          });

          const result = yield* generateObjectWithRetry({
            prompt: buildClassificationPrompt(batchPreviews),
            schema: BatchClassificationResponse,
            objectName: "batch_classification",
            serviceName: "Preprocessing",
            model: config.llm.model,
            provider: config.llm.provider,
            retryPolicy: config.llm.retryPolicy,
            spanAttributes: {
              "preprocessing.batch_id": input.batchId,
              "preprocessing.batch_start": i,
              "preprocessing.batch_size": batch.length,
            },
          }).pipe(
            Effect.provideService(LanguageModel.LanguageModel, llm),
            Effect.catch((error) =>
              Effect.gen(function* () {
                yield* Effect.logWarning("Classification batch failed, using defaults", {
                  batchId: input.batchId,
                  batchStart: i,
                  error: Inspectable.toStringUnknown(error),
                });
                return { value: { classifications: [] } };
              })
            )
          );

          // Store classifications by index
          for (const item of result.value.classifications) {
            MutableHashMap.set(classifications, item.index, item.classification);
          }
        }

        // 4. Build DocumentMetadata for each document
        documentMetadata = previews.map((p) => {
          const classification = MutableHashMap.get(classifications, p.index);

          if (O.isSome(classification)) {
            classifiedCount++;
            const tokens = DocumentMetadata.estimateTokens(p.sizeBytes);

            const complexityScore = UnitInterval.make(classification.value.complexityScore);
            const strategy = O.getOrElse(options.chunkingStrategyOverride, () =>
              options.adaptiveChunking
                ? ChunkingStrategy.recommend(
                    classification.value.documentType,
                    classification.value.entityDensity,
                    complexityScore
                  )
                : ChunkingStrategy.Enum.standard
            );
            const chunkParameters = ChunkingStrategy.parameters(strategy);

            const priority = DocumentMetadata.computePriority(
              complexityScore,
              tokens,
              classification.value.entityDensity
            );

            return DocumentMetadata.make({
              documentId: p.documentId,
              sourceUri: p.sourceUri,
              contentType: p.contentType,
              sizeBytes: NonNegativeInt.make(p.sizeBytes),
              eventTime: O.none(),
              publishedAt: O.none(),
              ingestedAt: preprocessedAt,
              preprocessedAt,
              title: classification.value.title,
              language: LanguageCode.make(O.getOrElse(classification.value.language, () => "en")),
              estimatedTokens: tokens,
              documentType: classification.value.documentType,
              domainTags: classification.value.domainTags,
              complexityScore,
              entityDensityHint: classification.value.entityDensity,
              chunkingStrategy: strategy,
              suggestedChunkSize: chunkParameters.chunkSize,
              suggestedOverlap: chunkParameters.overlapSentences,
              priority,
              estimatedExtractionCost: NonNegativeInt.make(tokens * 2),
            });
          } else {
            // Use defaults for failed classifications
            failedCount++;
            return DocumentMetadata.fallback({
              documentId: p.documentId,
              sourceUri: p.sourceUri,
              contentType: p.contentType,
              sizeBytes: NonNegativeInt.make(p.sizeBytes),
              preprocessedAt,
            });
          }
        });
      }

      // 5. Sort by priority if enabled (lower = process first)
      if (options.priorityOrdering) {
        documentMetadata = A.sort(documentMetadata, DocumentPriorityOrder);
      }

      // 6. Compute stats
      const totalEstimatedTokens = documentMetadata.reduce((sum, d) => sum + d.estimatedTokens, 0);
      const avgComplexity = documentMetadata.reduce((sum, d) => sum + d.complexityScore, 0) / documentMetadata.length;
      const typeDistribution: Record<string, NonNegativeInt> = {};
      for (const d of documentMetadata) {
        typeDistribution[d.documentType] = NonNegativeInt.make((typeDistribution[d.documentType] ?? 0) + 1);
      }

      // 7. Compute duration and create EnrichedManifest
      const end = yield* DateTime.now;
      const durationMs = Duration.toMillis(DateTime.distance(start, end));

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
          documentTypeDistribution: typeDistribution,
        },
      };

      // 8. Write enriched manifest to storage
      const enrichedManifestPath = PathLayout.batch.enrichedManifest(input.batchId);
      const enrichedManifestJson = yield* EnrichedManifest.encodeEffectFromJsonStringFormatted(enrichedManifest);
      yield* storage.set(enrichedManifestPath, enrichedManifestJson);

      yield* Effect.logInfo("Preprocessing activity complete", {
        batchId: input.batchId,
        totalDocuments: documentMetadata.length,
        classifiedCount,
        failedCount,
        totalEstimatedTokens,
        averageComplexity: avgComplexity,
        durationMs,
      });

      return {
        enrichedManifestUri: GcsUri.decodeUnknownSync(`gs://${bucket}/${enrichedManifestPath}`),
        totalDocuments: NonNegativeInt.make(documentMetadata.length),
        classifiedCount: NonNegativeInt.make(classifiedCount),
        failedCount: NonNegativeInt.make(failedCount),
        totalEstimatedTokens: NonNegativeInt.make(totalEstimatedTokens),
        averageComplexity: UnitInterval.make(avgComplexity),
        durationMs: NonNegNum.make(durationMs),
      };
    }).pipe(Effect.mapError(preserveActivityError)),
    interruptRetryPolicy: activityRetryPolicy,
  });
