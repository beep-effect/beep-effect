/**
 * Service: OntologyAgent
 *
 * **Details**
 *
 * Unified abstraction layer for ontology-guided LLM operations.
 * Wraps extraction, validation, querying, and reasoning services
 * into a single composable interface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { DrizzleError } from "@beep/drizzle";
import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import type { ShaclValidationError, ShaclValidationViolation } from "@beep/semantic-web/services/shacl-validation";
import type { SparqlQueryProfile, SparqlQueryResult } from "@beep/semantic-web/services/sparql-query";
import { SparqlQueryRequest, SparqlQueryService } from "@beep/semantic-web/services/sparql-query";
import { Chunk, Context, DateTime, Duration, Effect, Inspectable, Layer, Match, MutableHashMap, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LanguageModel } from "effect/unstable/ai";
import { ErrorMessage, OptionalErrorCause } from "../Domain/Error/Base.ts";
import type { ExtractionError } from "../Domain/Error/Extraction.ts";
import type { OntologyFileNotFound, OntologyParsingFailed } from "../Domain/Error/Ontology.ts";
import type { ParsingFailed, RdfError, SerializationFailed } from "../Domain/Error/Rdf.ts";
import type { ValidationPolicyError, ValidationReportError } from "../Domain/Error/Shacl.ts";
import { ContentHash, Namespace, OntologyName } from "../Domain/Identity.ts";
import { LlmConfig, RunConfig } from "../Domain/Model/ExtractionRun.ts";
import type { ExtractionOutcome } from "../Domain/Model/ExtractionTelemetry.ts";
import { OntologyRef } from "../Domain/Model/Ontology.ts";
import type { ExtractWithClaimsOptions } from "../Domain/Model/OntologyAgent.ts";
import {
  EnhancedValidationReport,
  ExtractionMetrics,
  ExtractionResult,
  ExtractWithClaimsResult,
  OntologyAgentConfig,
  QueryBinding,
  QueryResult,
  ViolationExplanation,
  ViolationsByLevel,
} from "../Domain/Model/OntologyAgent.ts";
import type { CreateClaimInput } from "./Claim.ts";
import { ClaimService } from "./Claim.ts";
import type { AppConfig } from "./Config.ts";
import { ConfigService } from "./Config.ts";
import { ExtractionWorkflow } from "./ExtractionWorkflow.ts";
import { OntologyService } from "./Ontology.ts";
import type { RdfStore } from "./Rdf.ts";
import { RdfBuilder, rdfStoreSize, rdfStoreToDataset } from "./Rdf.ts";
import type { ReasoningError, ReasoningResult, RuleParseError } from "./Reasoner.ts";
import { Reasoner, ReasoningConfig } from "./Reasoner.ts";
import type { RetryPolicyInput } from "./Retry.ts";
import { retryEffect } from "./Retry.ts";
import type { ShaclValidationReport } from "./Shacl.ts";
import { ShaclWorkflowService, ValidationPolicy } from "./Shacl.ts";
import type { SparqlGenerationError } from "./SparqlGenerator.ts";
import { SparqlGenerator } from "./SparqlGenerator.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/OntologyAgent");

type OntologyExtractionError = ExtractionError | RdfError | SerializationFailed | OntologyAgentError;
type OntologyClaimExtractionError = OntologyExtractionError | DrizzleError;
type OntologyValidatedExtractionError =
  | OntologyExtractionError
  | OntologyAgentError
  | ValidationReportError
  | ShaclValidationError;
type OntologyGraphValidationError =
  | OntologyAgentError
  | ValidationReportError
  | ShaclValidationError
  | ValidationPolicyError;
type OntologyQueryError =
  | OntologyFileNotFound
  | OntologyParsingFailed
  | ParsingFailed
  | RdfError
  | SparqlGenerationError
  | OntologyAgentError;

/**
 * Failure while orchestrating an ontology-agent operation.
 *
 * **Example** (Inspect ontology agent error)
 *
 * ```ts
 * import { OntologyAgentError } from "@effect-ontology/Service/OntologyAgent"
 *
 * console.log(OntologyAgentError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OntologyAgentError extends S.TaggedError<OntologyAgentError>($I`OntologyAgentError`)(
  "OntologyAgentError",
  {
    operation: S.Literals(["loadOntology", "parseOntology", "decodeResult", "formatAnswer"]).annotateKey({
      description: "Ontology-agent operation that failed.",
    }),
    message: ErrorMessage.annotateKey({
      description: "Human-readable ontology-agent failure diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying ontology, RDF, or language-model defect.",
    }),
  },
  $I.annote("OntologyAgentError", {
    description: "Failure while orchestrating an ontology-agent operation.",
  })
) {
  static readonly is = S.is(this);
}

const decodeAgentModel = <A, I>(
  schema: S.Codec<A, I>,
  input: unknown,
  model: string
): Effect.Effect<A, OntologyAgentError> =>
  S.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError((cause) =>
      OntologyAgentError.make({
        operation: "decodeResult",
        message: `Failed to construct ${model}`,
        cause: O.some(cause),
      })
    )
  );

const makeExtractionMetrics = (outcome: ExtractionOutcome, duration: Duration.Duration): ExtractionMetrics =>
  ExtractionMetrics.make({
    entityCount: NonNegativeInt.make(outcome.graph.entities.length),
    relationCount: NonNegativeInt.make(outcome.graph.relations.length),
    chunkCount: outcome.telemetry.chunkCount,
    usage: outcome.telemetry.usage,
    duration,
  });

/**
 * OntologyAgent - Unified interface for ontology-guided operations
 *
 * **Details**
 *
 * Provides a higher-level abstraction that combines extraction, validation,
 * querying, and reasoning into a single composable service.
 *
 * **Capabilities**:
 * - `extract` - Extract entities/relations from text, grounded to ontology
 * - `validate` - SHACL validation with explainable violations
 * - `validateWithPolicy` - Policy-based validation for workflow control
 * - `explainViolations` - Convert SHACL violations to LLM-friendly explanations
 *
 * **Example** (Inspect the ontology-agent layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { OntologyAgent } from "@effect-ontology/Service/OntologyAgent"
 *
 * console.log(Layer.isLayer(OntologyAgent.Default)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OntologyAgent extends Context.Service<OntologyAgent>()($I`OntologyAgent`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const ontologyService = yield* OntologyService;
    const extractionWorkflow = yield* ExtractionWorkflow;
    const claimService = yield* ClaimService;
    const shaclService = yield* ShaclWorkflowService;
    const rdfBuilder = yield* RdfBuilder;
    const sparqlGenerator = yield* SparqlGenerator;
    const sparqlService = yield* SparqlQueryService;
    const reasoner = yield* Reasoner;
    const llm = yield* LanguageModel.LanguageModel;
    const storage = yield* StorageService;

    const sparqlResultTriples = Match.type<SparqlQueryResult>().pipe(
      Match.discriminatorsExhaustive("profile")({
        select: ({ rows }) =>
          A.flatMap(rows, (row) =>
            A.map(R.toEntries(row), ([variable, value]) => ({
              subject: "result",
              predicate: variable,
              object: value.termType === "Literal" ? value.value : extractLocalName(value.value),
            }))
          ),
        construct: ({ dataset }) =>
          A.map(dataset.quads, (quad) => ({
            subject: extractLocalName(quad.subject.value),
            predicate: extractLocalName(quad.predicate.value),
            object: quad.object.termType === "Literal" ? quad.object.value : extractLocalName(quad.object.value),
          })),
        ask: ({ value }) => [{ subject: "query", predicate: "result", object: value ? "true" : "false" }],
      })
    );

    // Cache the parsed ontology RDF store for SHACL shape generation
    // Uses StorageService for cloud-native loading (GCS/local)
    const getOntologyStore = yield* Effect.cached(
      Effect.gen(function* () {
        const ontologyPath = config.ontology.path;

        yield* Effect.logDebug("Loading ontology for SHACL shapes", { ontologyPath });

        // Load from storage (GCS or local filesystem via StorageService)
        const contentOpt = yield* storage.getOption(ontologyPath).pipe(
          Effect.mapError((cause) =>
            OntologyAgentError.make({
              operation: "loadOntology",
              message: `Failed to load ontology from storage: ${cause.message}`,
              cause: O.some(cause),
            })
          )
        );

        if (O.isNone(contentOpt)) {
          return yield* OntologyAgentError.make({
            operation: "loadOntology",
            message: `Ontology file not found at ${ontologyPath}`,
          });
        }

        // Parse Turtle to RDF store
        const ontologyStore = yield* rdfBuilder.parseTurtle(contentOpt.value).pipe(
          Effect.mapError((cause) =>
            OntologyAgentError.make({
              operation: "parseOntology",
              message: `Failed to parse ontology: ${cause.message}`,
              cause: O.some(cause),
            })
          )
        );

        yield* Effect.logInfo("Ontology store loaded for SHACL shapes", {
          ontologyPath,
          tripleCount: rdfStoreSize(ontologyStore),
        });

        return ontologyStore;
      })
    );

    return {
      /**
       * Extract entities and relations from text using ontology-guided LLM
       *
       * Wraps the streaming extraction workflow with a simpler interface.
       * Returns ExtractionResult containing the knowledge graph, RDF turtle, and metrics.
       *
       * The extraction pipeline:
       * 1. Chunks text based on config (handles large documents)
       * 2. Extracts entities using ontology-guided LLM prompts
       * 3. Extracts relations between entities
       * 4. Merges results across chunks
       * 5. Builds RDF graph and serializes to Turtle
       *
       * @param text - Source text to extract from
       * @param agentConfig - Optional configuration overrides
       * @returns ExtractionResult with graph, turtle, and metrics
       */
      extract: (
        text: string,
        agentConfig?: OntologyAgentConfig
      ): Effect.Effect<ExtractionResult, OntologyExtractionError> =>
        Effect.gen(function* () {
          const startTime = yield* DateTime.now;

          // Build RunConfig from OntologyAgentConfig and defaults
          const runConfig = yield* buildRunConfig(config, agentConfig);

          yield* Effect.logInfo("OntologyAgent.extract starting", {
            textLength: text.length,
            concurrency: runConfig.concurrency,
            maxChunkSize: runConfig.chunking.maxChunkSize,
          });

          // Execute extraction workflow
          const outcome = yield* extractionWorkflow.extract(text, runConfig);
          const { graph } = outcome;

          yield* Effect.logDebug("Extraction complete, building RDF store", {
            entityCount: graph.entities.length,
            relationCount: graph.relations.length,
          });

          // Build RDF store from extracted entities and relations
          const store = yield* rdfBuilder.createStore;
          yield* rdfBuilder.addEntities(store, graph.entities);
          yield* rdfBuilder.addRelations(store, graph.relations);

          // Serialize to Turtle format
          const turtle = yield* rdfBuilder.toTurtle(store);

          const endTime = yield* DateTime.now;
          const duration = DateTime.distance(startTime, endTime);

          // Build metrics from graph
          const metrics = makeExtractionMetrics(outcome, duration);

          yield* Effect.logInfo("OntologyAgent.extract complete", {
            entityCount: metrics.entityCount,
            relationCount: metrics.relationCount,
            turtleLength: turtle.length,
            durationMs: Duration.toMillis(metrics.duration),
          });

          return yield* decodeAgentModel(
            ExtractionResult,
            {
              graph,
              metrics,
              turtle,
            },
            "extraction result"
          );
        }),

      /**
       * Extract entities and relations from text, creating claims with provenance
       *
       * Performs extraction like `extract`, but additionally creates claims from
       * each extracted relation. Claims are reified statements with full provenance
       * including source article, confidence scores, and evidence spans.
       *
       * The extraction pipeline:
       * 1. Performs standard extraction (entities + relations)
       * 2. Creates claims from relations using ClaimService
       * 3. Each relation becomes a claim with:
       *    - Subject/predicate/object from the relation
       *    - Confidence from relation or default
       *    - Evidence from relation.evidence field (text, start, end)
       *    - Article ID for source provenance
       *
       * @param text - Source text to extract from
       * @param options - Options including articleId and agent config overrides
       * @returns ExtractWithClaimsResult with graph, metrics, and claim count
       *
       * **Example** (Use extractWithClaims)
       * ```ts
       * const result = yield* agent.extractWithClaims(text, {
       *   articleId: "article-001",
       *   defaultConfidence: 0.85
       * })
       * console.log(`Created ${result.claimCount} claims from ${result.relations.length} relations`)
       * ```
       */
      extractWithClaims: (
        text: string,
        options: ExtractWithClaimsOptions
      ): Effect.Effect<ExtractWithClaimsResult, OntologyClaimExtractionError> =>
        Effect.gen(function* () {
          const startTime = yield* DateTime.now;

          // Build RunConfig from OntologyAgentConfig and defaults
          const runConfig = yield* buildRunConfig(config, O.getOrUndefined(options.agentConfig));

          yield* Effect.logInfo("OntologyAgent.extractWithClaims starting", {
            textLength: text.length,
            articleId: options.articleId,
            defaultConfidence: options.defaultConfidence,
            targetNamespace: O.getOrElse(options.targetNamespace, () => config.rdf.baseNamespace),
          });

          // Execute extraction workflow
          const outcome = yield* extractionWorkflow.extract(text, runConfig);
          const { graph } = outcome;

          yield* Effect.logDebug("Extraction complete, creating claims from relations", {
            entityCount: graph.entities.length,
            relationCount: graph.relations.length,
          });

          // Build RDF store from extracted entities and relations
          const store = yield* rdfBuilder.createStore;
          yield* rdfBuilder.addEntities(store, graph.entities);
          yield* rdfBuilder.addRelations(store, graph.relations);

          // Serialize to Turtle format
          const turtle = yield* rdfBuilder.toTurtle(store);

          // Create claims from each relation
          const defaultConfidence = options.defaultConfidence;
          let claimCount = 0;

          // Build entity ID -> IRI map for resolving subject/object references
          // Use targetNamespace option, falling back to config.rdf.baseNamespace
          // This ensures entities are minted in the local ontology namespace,
          // NOT borrowed from class namespaces (e.g., foaf:, org:)
          // Convert Namespace identifier to full IRI if targetNamespace is provided
          const baseNamespace = O.isSome(options.targetNamespace)
            ? (() => {
                // Extract protocol://domain/ from config.rdf.baseNamespace
                const match = config.rdf.baseNamespace.match(/^https?:\/\/[^/]+\//);
                const baseDomain = P.isNotNull(match) ? match[0] : "https://example.org/";
                return `${baseDomain}${options.targetNamespace.value}/`;
              })()
            : config.rdf.baseNamespace;
          const entityIriMap = MutableHashMap.empty<string, string>();
          for (const entity of graph.entities) {
            MutableHashMap.set(entityIriMap, entity.id, `${baseNamespace}${entity.id}`);
          }

          for (const relation of graph.relations) {
            // Resolve subject IRI from entity ID (use baseNamespace for fallback too)
            const subjectIri = O.getOrElse(
              MutableHashMap.get(entityIriMap, relation.subjectId),
              () => `${baseNamespace}${relation.subjectId}`
            );

            // Determine if object is entity reference or literal
            const isEntityRef = P.isString(relation.object) && relation.isEntityReference;
            const objectValue = isEntityRef
              ? O.getOrElse(
                  MutableHashMap.get(entityIriMap, relation.object),
                  () => `${baseNamespace}${relation.object}`
                )
              : String(relation.object);
            const objectType = isEntityRef ? "iri" : "literal";

            // Get confidence from evidence span if available
            const confidence = O.match(relation.evidence, {
              onNone: () => defaultConfidence,
              onSome: (evidence) => O.getOrElse(evidence.confidence, () => defaultConfidence),
            });

            // Build claim input from relation
            const claimInput: CreateClaimInput = {
              ontologyId: options.ontologyId,
              subjectIri,
              predicateIri: relation.predicate,
              objectValue,
              objectType,
              articleId: options.articleId,
              confidence,
              ...(O.isSome(relation.evidence)
                ? {
                    evidence: {
                      text: relation.evidence.value.quote,
                      startOffset: relation.evidence.value.startChar,
                      endOffset: relation.evidence.value.endChar,
                    },
                  }
                : {}),
            };

            yield* claimService.createClaim(claimInput);
            claimCount++;
          }

          const endTime = yield* DateTime.now;
          const duration = DateTime.distance(startTime, endTime);

          // Build metrics from graph
          const metrics = makeExtractionMetrics(outcome, duration);

          yield* Effect.logInfo("OntologyAgent.extractWithClaims complete", {
            entityCount: metrics.entityCount,
            relationCount: metrics.relationCount,
            claimCount: NonNegativeInt.make(claimCount),
            durationMs: Duration.toMillis(metrics.duration),
          });

          return yield* decodeAgentModel(
            ExtractWithClaimsResult,
            {
              graph,
              metrics,
              turtle,
              claimCount,
              articleId: options.articleId,
            },
            "claim extraction result"
          );
        }),

      /**
       * Extract with RDFS reasoning (without validation)
       *
       * Performs extraction and applies RDFS reasoning to materialize
       * inferred triples. Useful when you want type hierarchy inference
       * but don't need full SHACL validation.
       *
       * The extraction pipeline:
       * 1. Chunks text based on config
       * 2. Extracts entities using ontology-guided LLM prompts
       * 3. Extracts relations between entities
       * 4. Builds RDF graph
       * 5. Applies RDFS reasoning (subClassOf transitivity, domain/range)
       * 6. Serializes to Turtle (includes inferred triples)
       *
       * @param text - Source text to extract from
       * @param agentConfig - Optional configuration overrides
       * @param reasoningConfig - Optional reasoning configuration (defaults to subclass-only)
       * @returns ExtractionResult with graph containing inferred types
       *
       * **Example** (Use extractWithReasoning)
       * ```ts
       * const result = yield* agent.extractWithReasoning(text)
       * // Turtle now includes inferred type assertions from rdfs:subClassOf
       * console.log(`Inferred triples included in RDF output`)
       * ```
       */
      extractWithReasoning: (
        text: string,
        agentConfig?: OntologyAgentConfig,
        reasoningConfig?: ReasoningConfig
      ): Effect.Effect<ExtractionResult, OntologyExtractionError> =>
        Effect.gen(function* () {
          const startTime = yield* DateTime.now;

          // Build RunConfig from OntologyAgentConfig and defaults
          const runConfig = yield* buildRunConfig(config, agentConfig);

          yield* Effect.logInfo("OntologyAgent.extractWithReasoning starting", {
            textLength: text.length,
            concurrency: runConfig.concurrency,
          });

          // Execute extraction workflow
          const outcome = yield* extractionWorkflow.extract(text, runConfig);
          const { graph } = outcome;

          yield* Effect.logDebug("Extraction complete, building RDF store", {
            entityCount: graph.entities.length,
            relationCount: graph.relations.length,
          });

          // Build RDF store from extracted entities and relations
          const store = yield* rdfBuilder.createStore;
          yield* rdfBuilder.addEntities(store, graph.entities);
          yield* rdfBuilder.addRelations(store, graph.relations);

          const tripleCountBeforeReasoning = rdfStoreSize(store);

          // Apply RDFS reasoning (default to subclass-only for efficiency)
          const effectiveReasoningConfig = reasoningConfig ?? ReasoningConfig.subclassOnly();
          const reasoningResult = yield* reasoner.reason(store, effectiveReasoningConfig).pipe(
            Effect.catch((error) =>
              Effect.logWarning("Reasoning failed, continuing with unaugmented graph", {
                error: Inspectable.toStringUnknown(error),
              }).pipe(
                Effect.map(() => ({
                  inferredTripleCount: NonNegativeInt.make(0),
                  rulesApplied: [],
                  durationMs: 0,
                }))
              )
            )
          );

          yield* Effect.logDebug("RDFS reasoning complete", {
            inferredTripleCount: reasoningResult.inferredTripleCount,
            rulesApplied: reasoningResult.rulesApplied,
            tripleCountBefore: tripleCountBeforeReasoning,
            tripleCountAfter: rdfStoreSize(store),
          });

          // Serialize to Turtle format (includes inferred triples)
          const turtle = yield* rdfBuilder.toTurtle(store);

          const endTime = yield* DateTime.now;
          const duration = DateTime.distance(startTime, endTime);

          // Build metrics from graph
          const metrics = makeExtractionMetrics(outcome, duration);

          yield* Effect.logInfo("OntologyAgent.extractWithReasoning complete", {
            entityCount: metrics.entityCount,
            relationCount: metrics.relationCount,
            inferredTripleCount: reasoningResult.inferredTripleCount,
            turtleLength: turtle.length,
            durationMs: Duration.toMillis(metrics.duration),
          });

          return yield* decodeAgentModel(
            ExtractionResult,
            {
              graph,
              metrics,
              turtle,
            },
            "reasoned extraction result"
          );
        }),

      /**
       * Extract with automatic SHACL validation
       *
       * Performs extraction followed by SHACL validation against
       * auto-generated shapes from the ontology.
       *
       * @param text - Source text to extract from
       * @param agentConfig - Optional configuration overrides
       * @returns ExtractionResult with graph, turtle, metrics, and validation report
       */
      extractAndValidate: (
        text: string,
        agentConfig?: OntologyAgentConfig
      ): Effect.Effect<ExtractionResult, OntologyValidatedExtractionError> =>
        Effect.gen(function* () {
          const startTime = yield* DateTime.now;

          // Build RunConfig
          const runConfig = yield* buildRunConfig(config, agentConfig);

          yield* Effect.logInfo("OntologyAgent.extractAndValidate starting", {
            textLength: text.length,
          });

          // Execute extraction
          const outcome = yield* extractionWorkflow.extract(text, runConfig);
          const { graph } = outcome;

          // Build RDF store from extracted graph
          const rdfStore = yield* rdfBuilder.createStore;
          yield* rdfBuilder.addEntities(rdfStore, graph.entities);
          yield* rdfBuilder.addRelations(rdfStore, graph.relations);

          const tripleCountBeforeReasoning = rdfStoreSize(rdfStore);

          // Apply RDFS reasoning to materialize type hierarchy inferences
          // This enables SHACL validation to correctly check inherited type constraints
          const reasoningResult = yield* reasoner.reasonForValidation(rdfStore).pipe(
            Effect.catch((error) =>
              // Log reasoning error but continue with validation on raw graph
              Effect.logWarning("Reasoning failed, continuing with unaugmented graph", {
                error: Inspectable.toStringUnknown(error),
              }).pipe(
                Effect.map(() => ({
                  inferredTripleCount: 0,
                  rulesApplied: [],
                  durationMs: 0,
                }))
              )
            )
          );

          yield* Effect.logDebug("RDFS reasoning complete", {
            inferredTripleCount: reasoningResult.inferredTripleCount,
            rulesApplied: reasoningResult.rulesApplied,
            tripleCountBefore: tripleCountBeforeReasoning,
            tripleCountAfter: rdfStoreSize(rdfStore),
          });

          // Serialize to Turtle (includes inferred triples)
          const turtle = yield* rdfBuilder.toTurtle(rdfStore);

          // Load ontology and generate SHACL shapes for validation
          const ontologyStore = yield* getOntologyStore;
          const shapesStore = yield* shaclService.generateShapesFromOntology(ontologyStore);
          const report = yield* shaclService.validateWithReport(rdfStore, shapesStore);

          const endTime = yield* DateTime.now;
          const duration = DateTime.distance(startTime, endTime);

          // Build metrics
          const metrics = makeExtractionMetrics(outcome, duration);

          yield* Effect.logInfo("OntologyAgent.extractAndValidate complete", {
            entityCount: metrics.entityCount,
            relationCount: metrics.relationCount,
            inferredTripleCount: reasoningResult.inferredTripleCount,
            conforms: report.validation.conforms,
            violationCount: report.validation.violations.length,
          });

          return yield* decodeAgentModel(
            ExtractionResult,
            {
              graph,
              metrics,
              turtle,
              validationReport: report,
            },
            "validated extraction result"
          );
        }),

      /**
       * Validate an RDF store against SHACL shapes
       *
       * @param dataStore - RDF store containing data to validate
       * @param shapesStore - SHACL shapes store
       * @returns Validation report
       */
      validate: (
        dataStore: RdfStore,
        shapesStore: RdfStore
      ): Effect.Effect<ShaclValidationReport, ShaclValidationError> =>
        shaclService.validateWithReport(dataStore, shapesStore),

      /**
       * Validate with policy-based control
       *
       * Performs SHACL validation and applies policy to determine
       * whether to fail based on violation severity.
       *
       * @param dataStore - RDF store containing data to validate
       * @param shapesStore - SHACL shapes store
       * @param policy - Validation policy
       * @returns Validation report or policy error
       */
      validateWithPolicy: (
        dataStore: RdfStore,
        shapesStore: RdfStore,
        policy: ValidationPolicy
      ): Effect.Effect<ShaclValidationReport, ShaclValidationError | ValidationPolicyError> =>
        shaclService.validateWithPolicy(dataStore, shapesStore, policy),

      /**
       * Generate SHACL shapes from ontology
       *
       * Creates SHACL NodeShape and PropertyShape constraints
       * from OWL class and property definitions.
       *
       * @param ontologyStore - RDF store containing ontology
       * @returns N3 store with generated SHACL shapes
       */
      generateShapes: (
        ontologyStore: RdfStore
      ): Effect.Effect<RdfStore, import("../Domain/Error/Shacl.ts").ValidationReportError> =>
        shaclService.generateShapesFromOntology(ontologyStore),

      /**
       * Convert SHACL violations to LLM-friendly explanations
       *
       * Transforms technical SHACL violation reports into clear,
       * actionable explanations suitable for LLM correction feedback.
       *
       * @param violations - Array of SHACL violations
       * @returns Array of violation explanations
       */
      explainViolations: (violations: ReadonlyArray<ShaclValidationViolation>): ReadonlyArray<ViolationExplanation> =>
        violations.map((v) =>
          ViolationExplanation.make({
            focusNode: v.focusNode,
            path: O.some(v.path.value),
            explanation: formatViolationExplanation(v),
            suggestion: O.fromNullishOr(generateCorrectionSuggestion(v)),
            severity: v.severity,
          })
        ),

      /**
       * Validate an RDF graph with auto-generated shapes and enhanced reporting
       *
       * High-level validation method that:
       * 1. Loads the configured ontology
       * 2. Auto-generates SHACL shapes from the ontology
       * 3. Validates the data graph against the shapes
       * 4. Applies optional validation policy
       * 5. Groups violations by severity level
       * 6. Generates human-readable explanations
       *
       * This is the recommended validation method for most use cases.
       *
       * @param dataStore - RDF store containing the data graph to validate
       * @param policy - Optional validation policy (defaults to fail on violations only)
       * @returns EnhancedValidationReport with explanations and grouped violations
       *
       * **Example** (Use validateGraph)
       * ```ts
       * const report = yield* agent.validateGraph(rdfStore)
       * if (!report.conforms) {
       *   console.log("Critical:", report.byLevel.violations)
       *   for (const exp of report.explanations) {
       *     console.log(`${exp.severity}: ${exp.explanation}`)
       *   }
       * }
       * ```
       */
      validateGraph: (
        dataStore: RdfStore,
        policy?: ValidationPolicy
      ): Effect.Effect<EnhancedValidationReport, OntologyGraphValidationError> =>
        Effect.gen(function* () {
          const startTime = yield* DateTime.now;

          yield* Effect.logInfo("OntologyAgent.validateGraph starting", {
            dataTripleCount: rdfStoreSize(dataStore),
          });

          // Load ontology from cached store (uses StorageService - GCS/local)
          const ontologyStore = yield* getOntologyStore;

          // Generate SHACL shapes from ontology
          const shapesStore = yield* shaclService.generateShapesFromOntology(ontologyStore);
          const shapesCount = rdfStoreSize(shapesStore);

          yield* Effect.logDebug("Generated SHACL shapes from ontology", {
            shapesCount: NonNegativeInt.make(shapesCount),
          });

          // Validate with policy if provided, otherwise just validate
          const effectivePolicy = policy ?? (yield* decodeAgentModel(ValidationPolicy, {}, "validation policy"));
          const report = yield* shaclService.validateWithPolicy(dataStore, shapesStore, effectivePolicy);

          // Group violations by severity
          const byLevel = yield* groupViolationsBySeverity(report.validation.violations);

          // Generate explanations
          const explanations = report.validation.violations.map((v) =>
            ViolationExplanation.make({
              focusNode: v.focusNode,
              path: O.some(v.path.value),
              explanation: formatViolationExplanation(v),
              suggestion: O.fromNullishOr(generateCorrectionSuggestion(v)),
              severity: v.severity,
            })
          );

          const endTime = yield* DateTime.now;
          const duration = DateTime.distance(startTime, endTime);

          yield* Effect.logInfo("OntologyAgent.validateGraph complete", {
            conforms: report.validation.conforms,
            violationCount: report.validation.violations.length,
            criticalCount: byLevel.violations.length,
            warningCount: byLevel.warnings.length,
            durationMs: Duration.toMillis(duration),
          });

          return yield* decodeAgentModel(
            EnhancedValidationReport,
            {
              conforms: report.validation.conforms,
              violationCount: report.validation.violations.length,
              explanations,
              byLevel,
              duration: Duration.toMillis(duration),
              dataGraphTripleCount: NonNegativeInt.make(report.dataGraphTripleCount),
              shapesCount: NonNegativeInt.make(shapesCount),
            },
            "enhanced validation report"
          );
        }),

      /**
       * Query a knowledge graph using natural language
       *
       * Translates natural language questions to SPARQL, executes
       * against the RDF store, and formats a human-readable answer.
       *
       * The query pipeline:
       * 1. Load ontology context for schema understanding
       * 2. Generate SPARQL from NL question using SparqlGenerator
       * 3. Execute query patterns against the RDF store
       * 4. Format answer from bindings using LLM
       * 5. Return QueryResult with answer, SPARQL, bindings, and confidence
       *
       * @param question - Natural language question
       * @param dataStore - RDF store containing the knowledge graph
       * @returns QueryResult with answer, SPARQL, bindings, and confidence
       *
       * **Example** (Use query)
       * ```ts
       * const result = yield* agent.query(
       *   "Who founded Acme Corp?",
       *   rdfStore
       * )
       * console.log(result.answer) // "John Smith founded Acme Corp."
       * console.log(result.sparql) // "SELECT ?founder WHERE { ... }"
       * ```
       */
      query: (question: string, dataStore: RdfStore): Effect.Effect<QueryResult, OntologyQueryError> =>
        Effect.gen(function* () {
          const startTime = yield* DateTime.now;

          yield* Effect.logInfo("OntologyAgent.query starting", {
            questionLength: question.length,
            dataTripleCount: rdfStoreSize(dataStore),
          });

          // Load ontology for schema context
          const ontology = yield* ontologyService.ontology;

          yield* Effect.logDebug("Loaded ontology for query context", {
            classCount: ontology.classes.length,
            propertyCount: ontology.properties.length,
          });

          // Generate SPARQL from natural language question
          const sparqlResult = yield* sparqlGenerator.generate(question, ontology);

          yield* Effect.logDebug("Generated SPARQL query", {
            sparqlLength: sparqlResult.sparql.length,
            confidence: sparqlResult.confidence,
          });

          const normalizedQuery = Str.toUpperCase(Str.trim(sparqlResult.sparql));
          const profile: SparqlQueryProfile = Str.startsWith("ASK")(normalizedQuery)
            ? "ask"
            : Str.startsWith("CONSTRUCT")(normalizedQuery) || Str.startsWith("DESCRIBE")(normalizedQuery)
              ? "construct"
              : "select";
          const dataset = yield* rdfStoreToDataset(dataStore);
          const execution = yield* sparqlService
            .execute(
              SparqlQueryRequest.make({
                query: sparqlResult.sparql,
                profile,
                dataset,
              })
            )
            .pipe(Effect.result);

          const fallbackTriples = Effect.fn("OntologyAgent.queryFallback")(function* (error: { message: string }) {
            yield* Effect.logWarning("SPARQL execution failed, falling back to all triples", {
              error: error.message,
              profile,
              queryLength: sparqlResult.sparql.length,
            });
            const allQuads = yield* rdfBuilder.queryStore(dataStore, {});
            return A.map(Chunk.toReadonlyArray(allQuads), (quad) => ({
              subject: extractLocalName(quad.subject.value),
              predicate: extractLocalName(quad.predicate.value),
              object: quad.object.termType === "Literal" ? quad.object.value : extractLocalName(quad.object.value),
            }));
          });
          const triplesForLlm = yield* Result.match(execution, {
            onFailure: fallbackTriples,
            onSuccess: (result) => Effect.succeed(sparqlResultTriples(result)),
          });

          yield* Effect.logDebug("SPARQL execution complete", {
            resultType: Result.match(execution, {
              onFailure: () => "fallback",
              onSuccess: (result) => result.profile,
            }),
            tripleCount: triplesForLlm.length,
          });

          // Format answer using LLM
          const answerResult = yield* formatAnswerWithLlm(
            question,
            sparqlResult.sparql,
            triplesForLlm,
            config.llm.retryPolicy
          ).pipe(Effect.provideService(LanguageModel.LanguageModel, llm));

          const endTime = yield* DateTime.now;
          const durationMs = DateTime.distance(startTime, endTime);

          // Create bindings from SPARQL results
          const bindings = O.match(Result.getSuccess(execution), {
            onNone: () =>
              A.map(A.take(triplesForLlm, 10), (triple) =>
                QueryBinding.make({
                  bindings: {
                    subject: triple.subject,
                    predicate: triple.predicate,
                    object: triple.object,
                  },
                })
              ),
            onSome: (result) =>
              result.profile === "select"
                ? A.map(A.take(result.rows, 10), (row) =>
                    QueryBinding.make({
                      bindings: R.map(row, (value) =>
                        value.termType === "Literal" ? value.value : extractLocalName(value.value)
                      ),
                    })
                  )
                : A.map(A.take(triplesForLlm, 10), (triple) => QueryBinding.make({ bindings: triple })),
          });

          // Calculate confidence based on SPARQL generation and result quality
          // Higher confidence for actual SPARQL results vs fallback
          const resultConfidence = Result.match(execution, {
            onFailure: () => (A.isReadonlyArrayNonEmpty(triplesForLlm) ? 0.7 : 0.3),
            onSuccess: (result) =>
              result.profile === "ask"
                ? result.value
                  ? 0.95
                  : 0.85
                : A.isReadonlyArrayNonEmpty(triplesForLlm)
                  ? 0.9
                  : 0.5,
          });
          const confidence = Math.min(sparqlResult.confidence, resultConfidence);

          yield* Effect.logInfo("OntologyAgent.query complete", {
            answerLength: answerResult.length,
            bindingCount: bindings.length,
            confidence,
            durationMs,
          });

          return yield* decodeAgentModel(
            QueryResult,
            {
              answer: answerResult,
              sparql: sparqlResult.sparql,
              bindings,
              confidence: Confidence.make(confidence),
            },
            "query result"
          );
        }),

      /**
       * Get the ontology context for the configured ontology
       *
       * @returns OntologyContext with classes and properties
       */
      getOntology: ontologyService.ontology,

      /**
       * Search for classes matching a query
       *
       * Uses hybrid search (semantic + BM25) for best recall.
       *
       * @param query - Search query
       * @param limit - Maximum results
       * @returns Matching class definitions
       */
      searchClasses: ontologyService.searchClassesHybrid,

      /**
       * Get properties for given class IRIs
       *
       * @param classIris - Class IRIs to get properties for
       * @returns Property definitions
       */
      getPropertiesFor: ontologyService.getPropertiesFor,

      // =========================================================================
      // Reasoning
      // =========================================================================

      /**
       * Apply RDFS reasoning to materialize inferred triples
       *
       * Mutates the input store by adding inferred triples based on
       * RDFS semantics (subClassOf transitivity, domain/range inference).
       *
       * @param store - RDF store to reason over (will be mutated)
       * @param reasoningConfig - Optional reasoning configuration (defaults to full RDFS)
       * @returns Reasoning result with statistics
       *
       * **Example** (Use reason)
       * ```ts
       * const result = yield* agent.reason(rdfStore)
       * console.log(`Inferred ${result.inferredTripleCount} new triples`)
       * ```
       */
      reason: (
        store: RdfStore,
        reasoningConfig?: ReasoningConfig
      ): Effect.Effect<ReasoningResult, ReasoningError | RuleParseError> =>
        reasoner.reason(store, reasoningConfig ?? ReasoningConfig.rdfs()),

      /**
       * Apply reasoning and return a new store (non-mutating)
       *
       * Creates a copy of the store, applies reasoning, and returns
       * the copy with inferred triples.
       *
       * @param store - RDF store to reason over (unchanged)
       * @param reasoningConfig - Optional reasoning configuration
       * @returns New store with inferred triples and reasoning result
       */
      reasonCopy: (
        store: RdfStore,
        reasoningConfig?: ReasoningConfig
      ): Effect.Effect<{ store: RdfStore; result: ReasoningResult }, ReasoningError | RuleParseError> =>
        reasoner.reasonCopy(store, reasoningConfig ?? ReasoningConfig.rdfs()),

      /**
       * Apply targeted reasoning for SHACL validation
       *
       * Only applies the minimal set of rules needed for validation
       * (primarily rdfs:subClassOf transitivity for type inference).
       * More efficient than full RDFS materialization.
       *
       * @param store - RDF store to reason over (will be mutated)
       * @returns Reasoning result
       */
      reasonForValidation: (store: RdfStore): Effect.Effect<ReasoningResult, ReasoningError | RuleParseError> =>
        reasoner.reasonForValidation(store),

      /**
       * Check if reasoning would add any inferences
       *
       * Useful for checking if a graph needs reasoning without mutating it.
       *
       * @param store - RDF store to check
       * @param reasoningConfig - Optional reasoning configuration
       * @returns True if reasoning would add new triples
       */
      wouldInfer: (
        store: RdfStore,
        reasoningConfig?: ReasoningConfig
      ): Effect.Effect<boolean, ReasoningError | RuleParseError> =>
        reasoner.wouldInfer(store, reasoningConfig ?? ReasoningConfig.rdfs()),
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([
      // Effect.Service deps with self-contained defaults
      OntologyService.Default, // Includes RdfBuilder.Default, NlpService.Default
      OxigraphSparqlQueryServiceLive,
      SparqlGenerator.Default, // No deps
      Reasoner.Default, // No deps
      // Parent scope provides (via WorkflowLayers):
      // - ExtractionWorkflow (Context.GenericTag)
      // - ClaimService (needs ClaimRepository/database)
      // - ShaclService.Default (needs StorageService)
      // - LanguageModel.LanguageModel (runtime-selected)
      // - StorageService (runtime-selected GCS/local)
      // - ConfigService (via nested deps)
    ])
  );
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Build RunConfig from OntologyAgentConfig and defaults
 */
const buildRunConfig = (configService: AppConfig, agentConfig?: OntologyAgentConfig): Effect.Effect<RunConfig> =>
  Effect.sync(() => {
    const resolvedAgentConfig = O.getOrElse(O.fromUndefinedOr(agentConfig), OntologyAgentConfig.default);
    const ontologyRef = O.getOrElse(resolvedAgentConfig.ontology, () =>
      OntologyRef.make({
        namespace: Namespace.make("default"),
        name: OntologyName.make("ontology"),
        contentHash: ContentHash.make(Str.repeat(64)("0")),
      })
    );

    // Build LLM config from service config
    const llmConfig = LlmConfig.make({
      model: configService.llm.model,
      temperature: configService.llm.temperature,
      maxTokens: PosInt.make(configService.llm.maxTokens),
      timeout: configService.llm.retryPolicy.attemptTimeout,
    });

    return RunConfig.make({
      ontology: ontologyRef,
      chunking: resolvedAgentConfig.chunking,
      llm: llmConfig,
      concurrency: resolvedAgentConfig.concurrency,
    });
  });

/**
 * Format SHACL violation into human-readable explanation
 */
const formatViolationExplanation = (violation: ShaclValidationViolation): string => {
  const path = ` for property "${extractLocalName(violation.path.value)}"`;
  const value = O.isSome(violation.value) ? ` (value: "${violation.value.value.value}")` : "";
  return `${violation.severity}: ${violation.message}${path}${value}`;
};

/**
 * Generate correction suggestion from SHACL violation
 */
const generateCorrectionSuggestion = (violation: ShaclValidationViolation): string | undefined => {
  const message = Str.toLowerCase(violation.message);

  if (message.includes("mincount") || message.includes("required")) {
    return `Add a value for the missing property`;
  }
  if (message.includes("maxcount")) {
    return `Remove extra values - only one is allowed`;
  }
  if (message.includes("datatype")) {
    return `Ensure the value has the correct data type`;
  }
  if (message.includes("class")) {
    return `Ensure the referenced entity has the correct type`;
  }

  return undefined;
};

/**
 * Group violations by severity level
 *
 * Categorizes SHACL violations into violations (critical), warnings, and info.
 */
type GroupedViolations = {
  readonly violations: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly info: ReadonlyArray<string>;
};

const appendViolationBySeverity = Match.type<ShaclValidationViolation["severity"]>().pipe(
  Match.when("violation", () => (byLevel: GroupedViolations, message: string) => ({
    ...byLevel,
    violations: A.append(byLevel.violations, message),
  })),
  Match.when("warning", () => (byLevel: GroupedViolations, message: string) => ({
    ...byLevel,
    warnings: A.append(byLevel.warnings, message),
  })),
  Match.when("info", () => (byLevel: GroupedViolations, message: string) => ({
    ...byLevel,
    info: A.append(byLevel.info, message),
  })),
  Match.exhaustive
);

const groupViolationsBySeverity = Effect.fn("OntologyAgent.groupViolationsBySeverity")(function* (
  violations: ReadonlyArray<ShaclValidationViolation>
) {
  const grouped = A.reduce<ShaclValidationViolation, GroupedViolations>(
    violations,
    { violations: A.empty(), warnings: A.empty(), info: A.empty() },
    (byLevel, violation) => {
      const message = formatViolationExplanation(violation);
      return appendViolationBySeverity(violation.severity)(byLevel, message);
    }
  );

  return yield* decodeAgentModel(ViolationsByLevel, grouped, "grouped validation violations");
});

/**
 * Extract local name from IRI
 */
const extractLocalName = (iri: string): string => {
  const hashIndex = iri.lastIndexOf("#");
  if (hashIndex >= 0) return iri.slice(hashIndex + 1);
  const slashIndex = iri.lastIndexOf("/");
  if (slashIndex >= 0) return iri.slice(slashIndex + 1);
  return iri;
};

/**
 * Triple representation for LLM answer formatting
 */
interface TripleForLlm {
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
}

/**
 * Format answer from query results using LLM
 *
 * Takes the question, SPARQL query, and retrieved triples,
 * and uses LLM to generate a natural language answer.
 */
const formatAnswerWithLlm = (
  question: string,
  sparql: string,
  triples: ReadonlyArray<TripleForLlm>,
  retryPolicy: RetryPolicyInput
): Effect.Effect<string, OntologyAgentError, LanguageModel.LanguageModel> =>
  Effect.gen(function* () {
    // If no triples, return a "no results" answer
    if (triples.length === 0) {
      return "I couldn't find any information in the knowledge graph to answer that question.";
    }

    // Format triples as a simple table for LLM
    const triplesText = triples
      .slice(0, 50) // Limit to 50 triples for context window
      .map((t) => `${t.subject} --[${t.predicate}]--> ${t.object}`)
      .join("\n");

    const prompt = `You are a knowledge graph question answering system.

Given the following question:
"${question}"

And the SPARQL query that was generated:
\`\`\`sparql
${sparql}
\`\`\`

And the following triples from the knowledge graph:
${triplesText}

Please provide a concise, natural language answer to the question based on the knowledge graph data.
If the data doesn't contain enough information to fully answer the question, say so.
Keep the answer brief and factual.`;

    const llm = yield* LanguageModel.LanguageModel;
    const response = yield* llm
      .generateText({
        prompt,
      })
      .pipe(
        retryEffect(retryPolicy),
        Effect.mapError((cause) =>
          OntologyAgentError.make({
            operation: "formatAnswer",
            message: `Failed to format answer: ${cause}`,
            cause: O.some(cause),
          })
        )
      );

    return response.text.trim();
  });
