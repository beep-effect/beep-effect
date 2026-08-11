/**
 * Service: OntologyAgent
 *
 * Unified abstraction layer for ontology-guided LLM operations.
 * Wraps extraction, validation, querying, and reasoning services
 * into a single composable interface.
 *
 * @since 2.0.0
 * @module Service/OntologyAgent
 */

import { LanguageModel } from "effect/unstable/ai"
import { Chunk, DateTime, Duration, Effect, Match, Option, Context, Layer } from "effect"
import type { ShaclValidationError, ValidationPolicyError } from "../Domain/Error/Shacl.ts"
import type { ContentHash, Namespace, OntologyName } from "../Domain/Identity.ts"
import { ChunkingConfig, LlmConfig, RunConfig } from "../Domain/Model/ExtractionRun.ts"
import { OntologyRef } from "../Domain/Model/Ontology.ts"
import {
  EnhancedValidationReport,
  ExtractionMetrics,
  ExtractionResult,
  type ExtractWithClaimsOptions,
  ExtractWithClaimsResult,
  type OntologyAgentConfig,
  QueryBinding,
  QueryResult,
  ViolationExplanation,
  ViolationsByLevel
} from "../Domain/Model/OntologyAgent.ts"
import { ClaimService, type CreateClaimInput } from "./Claim.ts"
import { ConfigService } from "./Config.ts"
import { ExtractionWorkflow } from "./ExtractionWorkflow.ts"
import { OntologyService } from "./Ontology.ts"
import { RdfBuilder, type RdfStore } from "./Rdf.ts"
import {
  Reasoner,
  ReasoningConfig,
  type ReasoningError,
  type ReasoningResult,
  type RuleParseError
} from "./Reasoner.ts"
import { ShaclService, type ShaclValidationReport, type ShaclViolation, type ValidationPolicy } from "./Shacl.ts"
import { FallbackResult, type SparqlBindings, type SparqlQuad, SparqlService } from "./Sparql.ts"
import { type SparqlGenerationError, SparqlGenerator } from "./SparqlGenerator.ts"
import { StorageService } from "./Storage.ts"
import { $ScratchpadId } from "@beep/identity";
import * as O from "effect/Option";
import { NonNegativeInt } from "@beep/schema/Int";
import { UnitInterval } from "@beep/schema/UnitInterval";

const $I = $ScratchpadId.create("effect-ontology/Service/OntologyAgent");

/**
 * OntologyAgent - Unified interface for ontology-guided operations
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
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const agent = yield* OntologyAgent
 *
 *   // Extract from text
 *   const result = yield* agent.extract(text, config)
 *   console.log(`Extracted ${result.metrics.entityCount} entities`)
 *
 *   // Validate the graph
 *   const report = yield* agent.validate(rdfStore, shapesStore)
 *   if (!report.conforms) {
 *     const explanations = agent.explainViolations(report.violations)
 *     // Use explanations for LLM correction feedback
 *   }
 * })
 * ```
 *
 * @since 2.0.0
 * @category Services
 */
export class OntologyAgent extends Context.Service<OntologyAgent>()($I`OntologyAgent`, {
  make: Effect.gen(function*() {
    const config = yield* ConfigService
    const ontologyService = yield* OntologyService
    const extractionWorkflow = yield* ExtractionWorkflow
    const claimService = yield* ClaimService
    const shaclService = yield* ShaclService
    const rdfBuilder = yield* RdfBuilder
    const sparqlGenerator = yield* SparqlGenerator
    const sparqlService = yield* SparqlService
    const reasoner = yield* Reasoner
    const llm = yield* LanguageModel.LanguageModel
    const storage = yield* StorageService

    // Cache the parsed ontology RDF store for SHACL shape generation
    // Uses StorageService for cloud-native loading (GCS/local)
    const getOntologyStore = yield* Effect.cached(
      Effect.gen(function*() {
        const ontologyPath = config.ontology.path

        yield* Effect.logDebug("Loading ontology for SHACL shapes", { ontologyPath })

        // Load from storage (GCS or local filesystem via StorageService)
        const contentOpt = yield* storage.get(ontologyPath).pipe(
          Effect.mapError((error) => new Error(`Failed to load ontology from storage: ${error.message}`))
        )

        if ((contentOpt === undefined)) {
          return yield* Effect.fail(
            new Error(`Ontology file not found at ${ontologyPath}`)
          )
        }

        // Parse Turtle to RDF store
        const ontologyStore = yield* rdfBuilder.parseTurtle(contentOpt).pipe(
          Effect.mapError((error) => new Error(`Failed to parse ontology: ${error.message}`))
        )

        yield* Effect.logInfo("Ontology store loaded for SHACL shapes", {
          ontologyPath,
          tripleCount: ontologyStore._store.size
        })

        return ontologyStore
      })
    )

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
      ): Effect.Effect<ExtractionResult, unknown> =>
        Effect.gen(function*() {
          const startTime = yield* DateTime.now

          // Build RunConfig from OntologyAgentConfig and defaults
          const runConfig = yield* buildRunConfig(config, agentConfig)

          yield* Effect.logInfo("OntologyAgent.extract starting", {
            textLength: text.length,
            concurrency: runConfig.concurrency,
            maxChunkSize: runConfig.chunking.maxChunkSize
          })

          // Execute extraction workflow
          const graph = yield* extractionWorkflow.extract(text, runConfig)

          yield* Effect.logDebug("Extraction complete, building RDF store", {
            entityCount: graph.entities.length,
            relationCount: graph.relations.length
          })

          // Build RDF store from extracted entities and relations
          const store = yield* rdfBuilder.createStore
          yield* rdfBuilder.addEntities(store, graph.entities)
          yield* rdfBuilder.addRelations(store, graph.relations)

          // Serialize to Turtle format
          const turtle = yield* rdfBuilder.toTurtle(store)

          const endTime = yield* DateTime.now
          const durationMs = DateTime.distance(startTime, endTime)

          // Build metrics from graph
          const metrics = ExtractionMetrics.make({
            entityCount: NonNegativeInt.make(graph.entities.length),
            relationCount: NonNegativeInt.make(graph.relations.length),
            chunkCount: NonNegativeInt.make(1), // TODO: Get actual chunk count from workflow
            inputTokens: NonNegativeInt.make(0), // TODO: Track from workflow when available
            outputTokens: NonNegativeInt.make(0),
            durationMs
          })

          yield* Effect.logInfo("OntologyAgent.extract complete", {
            entityCount: metrics.entityCount,
            relationCount: metrics.relationCount,
            turtleLength: turtle.length,
            durationMs: metrics.durationMs
          })

          return ExtractionResult.make({
            graph,
            metrics,
            turtle: O.some(turtle),
            validationReport: O.none()
          })
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
       * @example
       * ```typescript
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
                  ): Effect.Effect<ExtractWithClaimsResult, unknown> =>
                    Effect.gen(function*() {
                      const startTime = yield* DateTime.now

                      // Build RunConfig from OntologyAgentConfig and defaults
                      const runConfig = yield* buildRunConfig(config, options.agentConfig)

                      yield* Effect.logInfo("OntologyAgent.extractWithClaims starting", {
                        textLength: text.length,
                        articleId: options.articleId,
                        defaultConfidence: options.defaultConfidence,
                        targetNamespace: options.targetNamespace ?? config.rdf.baseNamespace
                      })

                      // Execute extraction workflow
                      const graph = yield* extractionWorkflow.extract(text, runConfig)

                      yield* Effect.logDebug("Extraction complete, creating claims from relations", {
                        entityCount: graph.entities.length,
                        relationCount: graph.relations.length
                      })

                      // Build RDF store from extracted entities and relations
                      const store = yield* rdfBuilder.createStore
                      yield* rdfBuilder.addEntities(store, graph.entities)
                      yield* rdfBuilder.addRelations(store, graph.relations)

                      // Serialize to Turtle format
                      const turtle = yield* rdfBuilder.toTurtle(store)

                      // Create claims from each relation
                      const defaultConfidence = options.defaultConfidence ?? 0.8
                      let claimCount = 0

                      // Build entity ID -> IRI map for resolving subject/object references
                      // Use targetNamespace option, falling back to config.rdf.baseNamespace
                      // This ensures entities are minted in the local ontology namespace,
                      // NOT borrowed from class namespaces (e.g., foaf:, org:)
                      // Convert Namespace identifier to full IRI if targetNamespace is provided
                      const baseNamespace = options.targetNamespace
                        ? (() => {
                          // Extract protocol://domain/ from config.rdf.baseNamespace
                          const match = config.rdf.baseNamespace.match(/^https?:\/\/[^/]+\//)
                          const baseDomain = match ? match[0] : "http://example.org/"
                          return `${baseDomain}${options.targetNamespace}/`
                        })()
                        : config.rdf.baseNamespace
                      const entityIriMap = new Map<string, string>()
                      for (const entity of graph.entities) {
                        entityIriMap.set(entity.id, `${baseNamespace}${entity.id}`)
                      }

                      for (const relation of graph.relations) {
                        // Resolve subject IRI from entity ID (use baseNamespace for fallback too)
                        const subjectIri = entityIriMap.get(relation.subjectId) ?? `${baseNamespace}${relation.subjectId}`

                        // Determine if object is entity reference or literal
                        const isEntityRef = typeof relation.object === "string" && relation.isEntityReference
                        const objectValue = isEntityRef
                          ? (entityIriMap.get(relation.object as string) ?? `${baseNamespace}${relation.object}`)
                          : String(relation.object)
                        const objectType = isEntityRef ? "iri" as const : "literal" as const

                        // Get confidence from evidence span if available
                        const confidence = relation.evidence?.confidence ?? defaultConfidence

                        // Build claim input from relation
                        const claimInput: CreateClaimInput = {
                          ontologyId: options.ontologyId,
                          subjectIri,
                          predicateIri: relation.predicate,
                          objectValue,
                          objectType,
                          articleId: options.articleId,
                          confidence,
                          evidence: relation.evidence ?
                            {
                              text: relation.evidence.text,
                              startOffset: NonNegativeInt.make(relation.evidence.startChar),
                              endOffset: relation.evidence.endChar
                            } :
                            undefined
                        }

                        yield* claimService.createClaim(claimInput)
                        claimCount++
                      }

                      const endTime = yield* DateTime.now
                      const durationMs = DateTime.distance(startTime, endTime)

                      // Build metrics from graph
                      const metrics = ExtractionMetrics.make({
                        entityCount: NonNegativeInt.make(graph.entities.length),
                        relationCount: NonNegativeInt.make(graph.relations.length),
                        chunkCount: NonNegativeInt.make(1),
                        inputTokens: NonNegativeInt.make(0),
                        outputTokens: NonNegativeInt.make(0),
                        durationMs
                      })

                      yield* Effect.logInfo("OntologyAgent.extractWithClaims complete", {
                        entityCount: metrics.entityCount,
                        relationCount: metrics.relationCount,
                        claimCount: NonNegativeInt.make(claimCount),
                        durationMs: metrics.durationMs
                      })

                      return ExtractWithClaimsResult.make({
                        graph,
                        metrics,
                        turtle: O.some(turtle),
                        validationReport: O.none(),
                        claimCount,
                        articleId: options.articleId
                      })
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
       * @example
       * ```typescript
       * const result = yield* agent.extractWithReasoning(text)
       * // Turtle now includes inferred type assertions from rdfs:subClassOf
       * console.log(`Inferred triples included in RDF output`)
       * ```
       */
      extractWithReasoning: (
                    text: string,
                    agentConfig?: OntologyAgentConfig,
                    reasoningConfig?: ReasoningConfig
                  ): Effect.Effect<ExtractionResult, unknown> =>
                    Effect.gen(function*() {
                      const startTime = yield* DateTime.now

                      // Build RunConfig from OntologyAgentConfig and defaults
                      const runConfig = yield* buildRunConfig(config, agentConfig)

                      yield* Effect.logInfo("OntologyAgent.extractWithReasoning starting", {
                        textLength: text.length,
                        concurrency: runConfig.concurrency
                      })

                      // Execute extraction workflow
                      const graph = yield* extractionWorkflow.extract(text, runConfig)

                      yield* Effect.logDebug("Extraction complete, building RDF store", {
                        entityCount: graph.entities.length,
                        relationCount: graph.relations.length
                      })

                      // Build RDF store from extracted entities and relations
                      const store = yield* rdfBuilder.createStore
                      yield* rdfBuilder.addEntities(store, graph.entities)
                      yield* rdfBuilder.addRelations(store, graph.relations)

                      const tripleCountBeforeReasoning = store._store.size

                      // Apply RDFS reasoning (default to subclass-only for efficiency)
                      const effectiveReasoningConfig = reasoningConfig ?? ReasoningConfig.subclassOnly()
                      const reasoningResult = yield* reasoner.reason(store, effectiveReasoningConfig).pipe(
                        Effect.catch((error) =>
                          Effect.logWarning("Reasoning failed, continuing with unaugmented graph", {
                            error: String(error)
                          }).pipe(
                            Effect.map(() => ({
                              inferredTripleCount: NonNegativeInt.make(0),
                              rulesApplied: [] as ReadonlyArray<string>,
                              durationMs: 0
                            }))
                          )
                        )
                      )

                      yield* Effect.logDebug("RDFS reasoning complete", {
                        inferredTripleCount: reasoningResult.inferredTripleCount,
                        rulesApplied: reasoningResult.rulesApplied,
                        tripleCountBefore: tripleCountBeforeReasoning,
                        tripleCountAfter: store._store.size
                      })

                      // Serialize to Turtle format (includes inferred triples)
                      const turtle = yield* rdfBuilder.toTurtle(store)

                      const endTime = yield* DateTime.now
                      const durationMs = DateTime.distance(startTime, endTime)

                      // Build metrics from graph
                      const metrics = ExtractionMetrics.make({
                        entityCount: NonNegativeInt.make(graph.entities.length),
                        relationCount: NonNegativeInt.make(graph.relations.length),
                        chunkCount: NonNegativeInt.make(1),
                        inputTokens: NonNegativeInt.make(0),
                        outputTokens: NonNegativeInt.make(0),
                        durationMs
                      })

                      yield* Effect.logInfo("OntologyAgent.extractWithReasoning complete", {
                        entityCount: metrics.entityCount,
                        relationCount: metrics.relationCount,
                        inferredTripleCount: reasoningResult.inferredTripleCount,
                        turtleLength: turtle.length,
                        durationMs: metrics.durationMs
                      })

                      return ExtractionResult.make({
                        graph,
                        metrics,
                        turtle: O.some(turtle),
                        validationReport: O.none()
                      })
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
                  ): Effect.Effect<ExtractionResult, unknown> =>
                    Effect.gen(function*() {
                      const startTime = yield* DateTime.now

                      // Build RunConfig
                      const runConfig = yield* buildRunConfig(config, agentConfig)

                      yield* Effect.logInfo("OntologyAgent.extractAndValidate starting", {
                        textLength: text.length
                      })

                      // Execute extraction
                      const graph = yield* extractionWorkflow.extract(text, runConfig)

                      // Build RDF store from extracted graph
                      const rdfStore = yield* rdfBuilder.createStore
                      yield* rdfBuilder.addEntities(rdfStore, graph.entities)
                      yield* rdfBuilder.addRelations(rdfStore, graph.relations)

                      const tripleCountBeforeReasoning = rdfStore._store.size

                      // Apply RDFS reasoning to materialize type hierarchy inferences
                      // This enables SHACL validation to correctly check inherited type constraints
                      const reasoningResult = yield* reasoner.reasonForValidation(rdfStore).pipe(
                        Effect.catch((error) =>
                          // Log reasoning error but continue with validation on raw graph
                          Effect.logWarning("Reasoning failed, continuing with unaugmented graph", {
                            error: String(error)
                          }).pipe(
                            Effect.map(() => ({
                              inferredTripleCount: 0,
                              rulesApplied: [] as ReadonlyArray<string>,
                              durationMs: 0
                            }))
                          )
                        )
                      )

                      yield* Effect.logDebug("RDFS reasoning complete", {
                        inferredTripleCount: reasoningResult.inferredTripleCount,
                        rulesApplied: reasoningResult.rulesApplied,
                        tripleCountBefore: tripleCountBeforeReasoning,
                        tripleCountAfter: rdfStore._store.size
                      })

                      // Serialize to Turtle (includes inferred triples)
                      const turtle = yield* rdfBuilder.toTurtle(rdfStore)

                      // Load ontology and generate SHACL shapes for validation
                      const ontologyStore = yield* getOntologyStore
                      const shapesStore = yield* shaclService.generateShapesFromOntology(ontologyStore._store)
                      const report = yield* shaclService.validate(rdfStore._store, shapesStore)

                      const endTime = yield* DateTime.now
                      const durationMs = DateTime.distance(startTime, endTime)

                      // Build metrics
                      const metrics = ExtractionMetrics.make({
                        entityCount: NonNegativeInt.make(graph.entities.length),
                        relationCount: NonNegativeInt.make(graph.relations.length),
                        chunkCount: NonNegativeInt.make(1),
                        inputTokens: NonNegativeInt.make(0),
                        outputTokens: NonNegativeInt.make(0),
                        durationMs
                      })

                      yield* Effect.logInfo("OntologyAgent.extractAndValidate complete", {
                        entityCount: metrics.entityCount,
                        relationCount: metrics.relationCount,
                        inferredTripleCount: reasoningResult.inferredTripleCount,
                        conforms: report.conforms,
                        violationCount: report.violations.length
                      })

                      return ExtractionResult.make({
                        graph,
                        metrics,
                        turtle: O.some(turtle),
                        validationReport: O.some(report)
                      })
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
        shapesStore: import("n3").Store
      ): Effect.Effect<ShaclValidationReport, ShaclValidationError> =>
        shaclService.validate(dataStore._store, shapesStore),

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
        shapesStore: import("n3").Store,
        policy: ValidationPolicy
      ): Effect.Effect<ShaclValidationReport, ShaclValidationError | ValidationPolicyError> =>
        shaclService.validateWithPolicy(dataStore._store, shapesStore, policy),

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
      ): Effect.Effect<import("n3").Store, import("../Domain/Error/Shacl.ts").ValidationReportError> =>
        shaclService.generateShapesFromOntology(ontologyStore._store),

      /**
       * Convert SHACL violations to LLM-friendly explanations
       *
       * Transforms technical SHACL violation reports into clear,
       * actionable explanations suitable for LLM correction feedback.
       *
       * @param violations - Array of SHACL violations
       * @returns Array of violation explanations
       */
      explainViolations: (
        violations: ReadonlyArray<ShaclViolation>
      ): ReadonlyArray<ViolationExplanation> =>
        violations.map((v) =>
          ViolationExplanation.make({
            focusNode: v.focusNode,
            path: v.path,
            explanation: formatViolationExplanation(v),
            suggestion: O.fromNullishOr(generateCorrectionSuggestion(v)),
            severity: v.severity
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
       * @example
       * ```typescript
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
                  ): Effect.Effect<EnhancedValidationReport, ShaclValidationError | ValidationPolicyError | unknown> =>
                    Effect.gen(function*() {
                      const startTime = yield* DateTime.now

                      yield* Effect.logInfo("OntologyAgent.validateGraph starting", {
                        dataTripleCount: dataStore._store.size
                      })

                      // Load ontology from cached store (uses StorageService - GCS/local)
                      const ontologyStore = yield* getOntologyStore

                      // Generate SHACL shapes from ontology
                      const shapesStore = yield* shaclService.generateShapesFromOntology(ontologyStore._store)
                      const shapesCount = shapesStore.size

                      yield* Effect.logDebug("Generated SHACL shapes from ontology", {
                        shapesCount: NonNegativeInt.make(shapesCount)
                      })

                      // Validate with policy if provided, otherwise just validate
                      const effectivePolicy = policy ?? { failOnViolation: true, failOnWarning: false }
                      const report = yield* shaclService.validateWithPolicy(
                        dataStore._store,
                        shapesStore,
                        effectivePolicy
                      )

                      // Group violations by severity
                      const byLevel = groupViolationsBySeverity(report.violations)

                      // Generate explanations
                      const explanations = report.violations.map((v: any) =>
                        ViolationExplanation.make({
                          focusNode: v.focusNode,
                          path: v.path,
                          explanation: formatViolationExplanation(v),
                          suggestion: O.fromNullishOr(generateCorrectionSuggestion(v)),
                          severity: v.severity
                        })
                      )

                      const endTime = yield* DateTime.now
                      const durationMs = DateTime.distance(startTime, endTime)

                      yield* Effect.logInfo("OntologyAgent.validateGraph complete", {
                        conforms: report.conforms,
                        violationCount: report.violations.length,
                        criticalCount: byLevel.violations.length,
                        warningCount: byLevel.warnings.length,
                        durationMs
                      })

                      return EnhancedValidationReport.make({
                        conforms: report.conforms,
                        violationCount: report.violations.length,
                        explanations,
                        byLevel,
                        durationMs,
                        dataGraphTripleCount: NonNegativeInt.make(report.dataGraphTripleCount),
                        shapesCount
                      })
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
       * @example
       * ```typescript
       * const result = yield* agent.query(
       *   "Who founded Acme Corp?",
       *   rdfStore
       * )
       * console.log(result.answer) // "John Smith founded Acme Corp."
       * console.log(result.sparql) // "SELECT ?founder WHERE { ... }"
       * ```
       */
      query: (
                    question: string,
                    dataStore: RdfStore
                  ): Effect.Effect<QueryResult, SparqlGenerationError | unknown> =>
                    Effect.gen(function*() {
                      const startTime = yield* DateTime.now

                      yield* Effect.logInfo("OntologyAgent.query starting", {
                        questionLength: question.length,
                        dataTripleCount: dataStore._store.size
                      })

                      // Load ontology for schema context
                      const ontology = yield* ontologyService.ontology

                      yield* Effect.logDebug("Loaded ontology for query context", {
                        classCount: ontology.classes.length,
                        propertyCount: ontology.properties.length
                      })

                      // Generate SPARQL from natural language question
                      const sparqlResult = yield* sparqlGenerator.generate(question, ontology)

                      yield* Effect.logDebug("Generated SPARQL query", {
                        sparqlLength: sparqlResult.sparql.length,
                        confidence: sparqlResult.confidence
                      })

                      // Execute SPARQL query using Oxigraph
                      const sparqlResult_exec = yield* sparqlService.execute(dataStore, sparqlResult.sparql).pipe(
                        Effect.catch((error) =>
                          Effect.gen(function*() {
                            yield* Effect.logWarning("SPARQL execution failed, falling back to all triples", {
                              error: String(error),
                              query: sparqlResult.sparql
                            })
                            // Fallback to all triples if SPARQL execution fails
                            const allQuads = yield* rdfBuilder.queryStore(dataStore, {})
                            const quads: ReadonlyArray<SparqlQuad> = Chunk.toReadonlyArray(allQuads).map((q) => ({
                              subject: q.subject,
                              predicate: q.predicate,
                              object: typeof q.object === "object" && "value" in q.object
                                ? { type: "literal" as const, value: q.object.value }
                                : { type: "uri" as const, value: q.object as string },
                              graph: q.graph
                            }))
                            return new FallbackResult({
                              quads,
                              reason: String(error)
                            })
                          })
                        )
                      )

                      // Convert SPARQL results to triples representation for LLM
                      const triplesForLlm = Match.value(sparqlResult_exec).pipe(
                        Match.tag("FallbackResult", (result) =>
                          // Fallback case - use all quads
                          result.quads.map((quad: any) => ({
                            subject: extractLocalName(quad.subject),
                            predicate: extractLocalName(quad.predicate),
                            object: quad.object.type === "uri"
                              ? extractLocalName(quad.object.value)
                              : quad.object.value
                          }))),
                        Match.tag("SelectResult", (result) =>
                          // SELECT query - convert bindings to triples
                          result.bindings.flatMap((binding: SparqlBindings) => {
                            const entries = Array.from(binding.entries())
                            if (entries.length === 0) return []

                            // Create a pseudo-triple from the binding variables
                            // For queries like SELECT ?name WHERE { ?s schema:name ?name }
                            // we create entries showing the bound values
                            return entries.map(([varName, value]) => ({
                              subject: "result",
                              predicate: varName,
                              object: value.type === "uri"
                                ? extractLocalName(value.value)
                                : value.value
                            }))
                          })),
                        Match.tag("ConstructResult", (result) =>
                          // CONSTRUCT query - use the constructed quads directly
                          result.quads.map((quad: any) => ({
                            subject: extractLocalName(quad.subject),
                            predicate: extractLocalName(quad.predicate),
                            object: quad.object.type === "uri"
                              ? extractLocalName(quad.object.value)
                              : quad.object.value
                          }))),
                        Match.tag("AskResult", (result) => // ASK query - create a single result triple
                        [{
                          subject: "query",
                          predicate: "result",
                          object: result.value ? "true" : "false"
                        }]),
                        Match.exhaustive
                      )

                      yield* Effect.logDebug("SPARQL execution complete", {
                        resultType: sparqlResult_exec._tag,
                        tripleCount: triplesForLlm.length
                      })

                      // Format answer using LLM
                      const answerResult = yield* formatAnswerWithLlm(
                        llm,
                        question,
                        sparqlResult.sparql,
                        triplesForLlm,
                        config.llm.timeoutMs
                      )

                      const endTime = yield* DateTime.now
                      const durationMs = DateTime.distance(startTime, endTime)

                      // Create bindings from SPARQL results
                      const bindings = Match.value(sparqlResult_exec).pipe(
                        Match.tag("SelectResult", (result) =>
                          // Use actual SPARQL bindings for SELECT queries
                          result.bindings.slice(0, 10).map((binding: SparqlBindings) => {
                            const bindingObj: Record<string, string> = {}
                            for (const [key, value] of binding.entries()) {
                              bindingObj[key] = value.type === "uri"
                                ? extractLocalName(value.value)
                                : value.value
                            }
                            return QueryBinding.make({ bindings: bindingObj })
                          })),
                        Match.orElse(() =>
                          // Fallback: create bindings from triples representation
                          triplesForLlm.slice(0, 10).map((t: any) =>
                            QueryBinding.make({
                              bindings: {
                                subject: t.subject,
                                predicate: t.predicate,
                                object: t.object
                              }
                            })
                          )
                        )
                      )

                      // Calculate confidence based on SPARQL generation and result quality
                      // Higher confidence for actual SPARQL results vs fallback
                      const resultConfidence = Match.value(sparqlResult_exec).pipe(
                        Match.tag("FallbackResult", () => triplesForLlm.length > 0 ? 0.7 : 0.3),
                        Match.tag("SelectResult", () => triplesForLlm.length > 0 ? 0.9 : 0.5),
                        Match.tag("ConstructResult", () => triplesForLlm.length > 0 ? 0.9 : 0.5),
                        Match.tag("AskResult", (result) => result.value ? 0.95 : 0.85),
                        Match.exhaustive
                      )
                      const confidence = Math.min(sparqlResult.confidence, resultConfidence)

                      yield* Effect.logInfo("OntologyAgent.query complete", {
                        answerLength: answerResult.length,
                        bindingCount: bindings.length,
                        confidence,
                        durationMs
                      })

                      return QueryResult.make({
                        answer: answerResult,
                        sparql: sparqlResult.sparql,
                        bindings,
                        confidence
                      })
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
       * @example
       * ```typescript
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
      reasonForValidation: (
        store: RdfStore
      ): Effect.Effect<ReasoningResult, ReasoningError | RuleParseError> => reasoner.reasonForValidation(store),

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
        reasoner.wouldInfer(store, reasoningConfig ?? ReasoningConfig.rdfs())
    }
  }),
}) {
    static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([
            // Effect.Service deps with self-contained defaults
            OntologyService.Default, // Includes RdfBuilder.Default, NlpService.Default
            SparqlService.Default, // Includes RdfBuilder.Default
            SparqlGenerator.Default, // No deps
            Reasoner.Default // No deps
            // Parent scope provides (via WorkflowLayers):
            // - ExtractionWorkflow (Context.GenericTag)
            // - ClaimService (needs ClaimRepository/database)
            // - ShaclService.Default (needs StorageService)
            // - LanguageModel.LanguageModel (runtime-selected)
            // - StorageService (runtime-selected GCS/local)
            // - ConfigService (via nested deps)
          ]));
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Build RunConfig from OntologyAgentConfig and defaults
 */
const buildRunConfig = (
  configService: ConfigService,
  agentConfig?: OntologyAgentConfig
): Effect.Effect<RunConfig> =>
  Effect.sync(() => {
    // Build ontology ref from path or use provided
    // Use branded type constructors for identity types
    const ontologyRef = agentConfig?.ontology ?? OntologyRef.make({
      namespace: "default" as Namespace,
      name: "ontology" as OntologyName,
      contentHash: "0000000000000000" as ContentHash // 16 hex chars placeholder
    })

    // Build chunking config
    const chunkingConfig = ChunkingConfig.make({
      maxChunkSize: agentConfig?.chunking?.maxChunkSize ?? 2000,
      preserveSentences: agentConfig?.chunking?.preserveSentences ?? true,
      overlapTokens: 50
    })

    // Build LLM config from service config
    const llmConfig = LlmConfig.make({
      model: configService.llm.model,
      temperature: configService.llm.temperature,
      maxTokens: configService.llm.maxTokens,
      timeoutMs: configService.llm.timeoutMs
    })

    return RunConfig.make({
      ontology: ontologyRef,
      chunking: chunkingConfig,
      llm: llmConfig,
      concurrency: agentConfig?.concurrency ?? 4,
      enableGrounding: true
    })
  })

/**
 * Format SHACL violation into human-readable explanation
 */
const formatViolationExplanation = (violation: ShaclViolation): string => {
  const path = violation.path ? ` for property "${extractLocalName(violation.path)}"` : ""
  const value = violation.value ? ` (value: "${violation.value}")` : ""
  return `${violation.severity}: ${violation.message}${path}${value}`
}

/**
 * Generate correction suggestion from SHACL violation
 */
const generateCorrectionSuggestion = (violation: ShaclViolation): string | undefined => {
  const message = violation.message.toLowerCase()

  if (message.includes("mincount") || message.includes("required")) {
    return `Add a value for the missing property`
  }
  if (message.includes("maxcount")) {
    return `Remove extra values - only one is allowed`
  }
  if (message.includes("datatype")) {
    return `Ensure the value has the correct data type`
  }
  if (message.includes("class")) {
    return `Ensure the referenced entity has the correct type`
  }

  return undefined
}

/**
 * Group violations by severity level
 *
 * Categorizes SHACL violations into violations (critical), warnings, and info.
 */
const groupViolationsBySeverity = (violations: ReadonlyArray<ShaclViolation>): ViolationsByLevel => {
  const grouped = {
    violations: [] as Array<string>,
    warnings: [] as Array<string>,
    info: [] as Array<string>
  }

  for (const v of violations) {
    const message = formatViolationExplanation(v)
    switch (v.severity) {
      case "Violation":
        grouped.violations.push(message)
        break
      case "Warning":
        grouped.warnings.push(message)
        break
      case "Info":
        grouped.info.push(message)
        break
    }
  }

  return ViolationsByLevel.make(grouped)
}

/**
 * Extract local name from IRI
 */
const extractLocalName = (iri: string): string => {
  const hashIndex = iri.lastIndexOf("#")
  if (hashIndex >= 0) return iri.slice(hashIndex + 1)
  const slashIndex = iri.lastIndexOf("/")
  if (slashIndex >= 0) return iri.slice(slashIndex + 1)
  return iri
}

/**
 * Triple representation for LLM answer formatting
 */
interface TripleForLlm {
  readonly subject: string
  readonly predicate: string
  readonly object: string
}

/**
 * Format answer from query results using LLM
 *
 * Takes the question, SPARQL query, and retrieved triples,
 * and uses LLM to generate a natural language answer.
 */
const formatAnswerWithLlm = (
  llm: LanguageModel.Service,
  question: string,
  sparql: string,
  triples: ReadonlyArray<TripleForLlm>,
  timeoutMs: number
): Effect.Effect<string, unknown> =>
  Effect.gen(function*() {
    // If no triples, return a "no results" answer
    if (triples.length === 0) {
      return "I couldn't find any information in the knowledge graph to answer that question."
    }

    // Format triples as a simple table for LLM
    const triplesText = triples
      .slice(0, 50) // Limit to 50 triples for context window
      .map((t) => `${t.subject} --[${t.predicate}]--> ${t.object}`)
      .join("\n")

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
Keep the answer brief and factual.`

    const response = yield* llm.generateText({
      prompt
    }).pipe(
      Effect.timeout(Duration.millis(timeoutMs)),
      Effect.mapError((error) => new Error(`Failed to format answer: ${error}`))
    )

    return response.text.trim()
  })
