/**
 * Service: AgentKit
 *
 * Provides built-in Agent adapters that operate on AgentTask as a shared
 * pipeline envelope. This reduces API surface area by standardizing the
 * inputs/outputs across ingestion, extraction, validation, and correction.
 *
 * @since 2.0.0
 * @module Service/Agent/AgentKit
 */

import { Data, Effect, Option, Context, Layer } from "effect"
import { AgentId, AgentMetadata, ValidationResult } from "../../Domain/Model/Agent.ts"
import type { Agent } from "../../Domain/Model/Agent.ts"
import type { KnowledgeGraph } from "../../Domain/Model/Entity.ts"
import type { OntologyAgentConfig } from "../../Domain/Model/OntologyAgent.ts"
import { ConfigService, ConfigServiceDefault } from "../Config.ts"
import { LinkIngestionService } from "../LinkIngestionService.ts"
import { OntologyService } from "../Ontology.ts"
import { OntologyAgent } from "../OntologyAgent.ts"
import { RdfBuilder, type RdfStore } from "../Rdf.ts"
import { ShaclService } from "../Shacl.ts"
import { StorageService, StorageServiceLive } from "../Storage.ts"
import { AgentCoordinator } from "./AgentCoordinator.ts"
import { CorrectorAgent } from "./CorrectorAgent.ts"
import { AgentTask } from "./types.ts"
import { $ScratchpadId } from "@beep/identity";
import * as O from "effect/Option";
const $I = $ScratchpadId.create("effect-ontology/Service/Agent/AgentKit");

// =============================================================================
// Errors
// =============================================================================

export class AgentInputError extends Data.TaggedError("AgentInputError")<{
  readonly taskId: string
  readonly message: string
  readonly missing?: ReadonlyArray<string>
}> {}

// =============================================================================
// Helpers
// =============================================================================

const mergeTask = (task: AgentTask, updates: Partial<AgentTask>): AgentTask => AgentTask.make({ ...task, ...updates })

const isRdfStore = (value: unknown): value is RdfStore =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  (value as { _tag?: string })._tag === "RdfStore"

const isKnowledgeGraph = (value: unknown): value is KnowledgeGraph =>
  typeof value === "object" &&
  value !== null &&
  "entities" in value &&
  "relations" in value

// =============================================================================
// Service Definition
// =============================================================================

export class AgentKit extends Context.Service<AgentKit>()($I`AgentKit`, {
  make: Effect.gen(function*() {
    const config = yield* ConfigService
    const ontologyAgent = yield* OntologyAgent
    const ontologyService = yield* OntologyService
    const rdfBuilder = yield* RdfBuilder
    const shaclService = yield* ShaclService
    const ingestionOpt = yield* Effect.serviceOption(LinkIngestionService)
    const storage = yield* StorageService
    const corrector = yield* CorrectorAgent

    const getOntologyStore = yield* Effect.cached(
      Effect.gen(function*() {
        const ontologyPath = config.ontology.path
        const contentOpt = yield* storage.get(ontologyPath)
        if ((contentOpt === undefined)) {
          return yield* Effect.fail(
            new Error(`Ontology not found at ${ontologyPath}`)
          )
        }
        return yield* rdfBuilder.parseTurtle(contentOpt)
      })
    )

    const getShapesStore = yield* Effect.cached(
      Effect.gen(function*() {
        const ontologyStore = yield* getOntologyStore
        return yield* shaclService.generateShapesFromOntology(ontologyStore._store)
      })
    )

    const buildStoreFromGraph = (graph: KnowledgeGraph) =>
      Effect.gen(function*() {
        const store = yield* rdfBuilder.createStore
        yield* rdfBuilder.addEntities(store, graph.entities)
        yield* rdfBuilder.addRelations(store, graph.relations)
        return store
      })

    const resolveStore = (task: AgentTask) =>
      Effect.gen(function*() {
        if (task.rdfStore && isRdfStore(task.rdfStore)) {
          return task.rdfStore
        }

        if (typeof task.turtle === "string") {
          return yield* rdfBuilder.parseTurtle(task.turtle)
        }

        if (task.knowledgeGraph) {
          return yield* buildStoreFromGraph(task.knowledgeGraph)
        }

        if (task.graph && isRdfStore(task.graph)) {
          return task.graph
        }

        if (task.graph && isKnowledgeGraph(task.graph)) {
          return yield* buildStoreFromGraph(task.graph)
        }

        return yield* Effect.fail(
          new AgentInputError({
            taskId: task.taskId,
            message: "Validation requires rdfStore, turtle, or knowledgeGraph",
            missing: ["rdfStore", "turtle", "knowledgeGraph"]
          })
        )
      })

    const ingestor: Agent<AgentTask, AgentTask, AgentInputError | unknown> = Option.match(ingestionOpt, {
      onNone: () => ({
        metadata: AgentMetadata.make({
          id: AgentId.make("ingestor"),
          name: "Link Ingestor",
          description: "Fetches and stores source content, returning enriched text for downstream agents",
          type: "ingestor",
          version: O.some("1.0.0")
        }),
        validate: () =>
          Effect.succeed(
            ValidationResult.fail(["LinkIngestionService is not available"])
          ),
        execute: (task) =>
          Effect.fail(
            new AgentInputError({
              taskId: task.taskId,
              message: "LinkIngestionService is not available"
            })
          )
      }),
      onSome: (ingestion) => ({
        metadata: AgentMetadata.make({
          id: AgentId.make("ingestor"),
          name: "Link Ingestor",
          description: "Fetches and stores source content, returning enriched text for downstream agents",
          type: "ingestor",
          version: O.some("1.0.0")
        }),
        validate: (task) =>
          Effect.succeed(
            task.sourceUrl
              ? ValidationResult.pass()
              : ValidationResult.fail(["sourceUrl is required"])
          ),
        execute: (task) =>
          Effect.gen(function*() {
            if (!task.sourceUrl) {
              return yield* Effect.fail(
                new AgentInputError({
                  taskId: task.taskId,
                  message: "Ingestion requires sourceUrl",
                  missing: ["sourceUrl"]
                })
              )
            }

            if (!task.ontologyId) {
              return yield* Effect.fail(
                new AgentInputError({
                  taskId: task.taskId,
                  message: "Ingestion requires ontologyId",
                  missing: ["ontologyId"]
                })
              )
            }

            const extraOptions = (task.ingestionOptions ?? {}) as Record<string, unknown>
            const ingestResult = yield* ingestion.ingestUrl(task.sourceUrl, {
              ontologyId: task.ontologyId,
              ...extraOptions
            })
            const contentOpt = yield* storage.get(ingestResult.storageUri)

            if ((contentOpt === undefined)) {
              return yield* Effect.fail(
                new AgentInputError({
                  taskId: task.taskId,
                  message: `Ingested content missing at ${ingestResult.storageUri}`
                })
              )
            }

            return mergeTask(task, {
              text: contentOpt,
              ingestionResult: O.some(ingestResult),
              documentId: task.documentId ?? ingestResult.id
            })
          })
      })
    })

    const extractor: Agent<AgentTask, AgentTask, AgentInputError | unknown> = {
      metadata: AgentMetadata.make({
        id: AgentId.make("extractor"),
        name: "Ontology Extractor",
        description: "Extracts entities/relations using ontology-guided LLM prompts",
        type: "extractor",
        version: O.some("1.0.0")
      }),
      validate: O.some((task) =>
        Effect.succeed(
          task.text
            ? ValidationResult.pass()
            : ValidationResult.fail(["text is required"])
        )),
      execute: (task): Effect.Effect<AgentTask, AgentInputError | unknown, never> =>
        Effect.gen(function*() {
          if (!task.text) {
            return yield* Effect.fail(
              new AgentInputError({
                taskId: task.taskId,
                message: "Extraction requires text",
                missing: ["text"]
              })
            )
          }

          const agentConfig = task.agentConfig as OntologyAgentConfig | undefined
          const result = yield* ontologyAgent.extract(task.text, agentConfig)
          const rdfStore = yield* buildStoreFromGraph(result.graph)
          const ontologyContext = task.ontologyContext ?? (yield* ontologyService.ontology)

          return mergeTask(task, {
            knowledgeGraph: O.some(result.graph),
            graph: O.some(result.graph),
            rdfStore: O.some(rdfStore),
            turtle: result.turtle,
            ontologyContext
          })
        })
    }

    const validator: Agent<AgentTask, AgentTask, AgentInputError | unknown> = {
      metadata: AgentMetadata.make({
        id: AgentId.make("validator"),
        name: "SHACL Validator",
        description: "Validates RDF graphs against ontology-derived SHACL shapes",
        type: "validator",
        version: O.some("1.0.0")
      }),
      validate: O.some((task) =>
        Effect.succeed(
          task.rdfStore || task.turtle || task.knowledgeGraph || task.graph
            ? ValidationResult.pass()
            : ValidationResult.fail(["rdfStore, turtle, or knowledgeGraph is required"])
        )),
      execute: (task): Effect.Effect<AgentTask, AgentInputError | unknown, never> =>
        Effect.gen(function*() {
          const rdfStore = yield* resolveStore(task)
          const shapesStore = yield* getShapesStore
          const report = yield* shaclService.validate(rdfStore._store, shapesStore)
          const explanations = ontologyAgent.explainViolations(report.violations)

          return mergeTask(task, {
            rdfStore: O.some(rdfStore),
            validationReport: O.some(report),
            validationExplanations: O.some(explanations)
          })
        })
    }

    const correctorAgent: Agent<AgentTask, AgentTask, AgentInputError | unknown> = {
      metadata: AgentMetadata.make({
        id: AgentId.make("corrector"),
        name: "SHACL Corrector",
        description: "Applies LLM-guided corrections to SHACL violations",
        type: "corrector",
        version: O.some("1.0.0")
      }),
      validate: O.some((task) =>
        Effect.succeed(
          task.validationReport
            ? ValidationResult.pass()
            : ValidationResult.fail(["validationReport is required"])
        )),
      execute: (task): Effect.Effect<AgentTask, AgentInputError | unknown, never> =>
        Effect.gen(function*() {
          if (!task.validationReport) {
            return yield* Effect.fail(
              new AgentInputError({
                taskId: task.taskId,
                message: "Correction requires validationReport",
                missing: ["validationReport"]
              })
            )
          }

          const rdfStore = yield* resolveStore(task)
          const ontologyContext = task.ontologyContext ?? (yield* ontologyService.ontology)
          const result = yield* corrector.correctAll(task.validationReport, rdfStore, ontologyContext)
          const turtle = yield* rdfBuilder.toTurtle(rdfStore)

          return mergeTask(task, {
            rdfStore: O.some(rdfStore),
            turtle: O.some(turtle),
            correctionResult: O.some(result)
          })
        })
    }

    const registerDefaults = () =>
      Effect.gen(function*() {
        const coordinator = yield* AgentCoordinator
        if (Option.isSome(ingestionOpt)) {
          yield* coordinator.register(ingestor)
        }
        yield* coordinator.register(extractor)
        yield* coordinator.register(validator)
        yield* coordinator.register(correctorAgent)
      })

    return {
      ingestor,
      extractor,
      validator,
      corrector: correctorAgent,
      registerDefaults
    }
  }),
}) {
    static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([
            ConfigServiceDefault,
            OntologyAgent.Default,
            OntologyService.Default,
            RdfBuilder.Default,
            ShaclService.Default,
            StorageServiceLive,
            CorrectorAgent.Default,
            AgentCoordinator.Default
          ]));
}
