/**
 * Service: AgentKit
 *
 * Provides built-in Agent adapters that operate on AgentTask as a shared
 * pipeline envelope. This reduces API surface area by standardizing the
 * inputs/outputs across ingestion, extraction, validation, and correction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Data, Effect, Layer, Option } from "effect";
import * as O from "effect/Option";
import type { Agent } from "../../Domain/Model/Agent.ts";
import { AgentId, AgentMetadata, ValidationResult } from "../../Domain/Model/Agent.ts";
import type { KnowledgeGraph } from "../../Domain/Model/Entity.ts";
import type { OntologyAgentConfig } from "../../Domain/Model/OntologyAgent.ts";
import { ConfigService, ConfigServiceDefault } from "../Config.ts";
import { LinkIngestionService } from "../LinkIngestionService.ts";
import { OntologyService } from "../Ontology.ts";
import { OntologyAgent } from "../OntologyAgent.ts";
import { isRdfStore, RdfBuilder } from "../Rdf.ts";
import { ShaclWorkflowService } from "../Shacl.ts";
import { StorageService, StorageServiceLive } from "../Storage.ts";
import { AgentCoordinator } from "./AgentCoordinator.ts";
import { CorrectorAgent } from "./CorrectorAgent.ts";
import { AgentTask } from "./types.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Agent/AgentKit");

// =============================================================================
// Errors
// =============================================================================

export class AgentInputError extends Data.TaggedError("AgentInputError")<{
  readonly taskId: string;
  readonly message: string;
  readonly missing?: ReadonlyArray<string>;
}> {}

// =============================================================================
// Helpers
// =============================================================================

const mergeTask = (task: AgentTask, updates: Partial<AgentTask>): AgentTask => AgentTask.make({ ...task, ...updates });

const isKnowledgeGraph = (value: unknown): value is KnowledgeGraph =>
  typeof value === "object" && value !== null && "entities" in value && "relations" in value;

// =============================================================================
// Service Definition
// =============================================================================

export class AgentKit extends Context.Service<AgentKit>()($I`AgentKit`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const ontologyAgent = yield* OntologyAgent;
    const ontologyService = yield* OntologyService;
    const rdfBuilder = yield* RdfBuilder;
    const shaclService = yield* ShaclWorkflowService;
    const ingestionOpt = yield* Effect.serviceOption(LinkIngestionService);
    const storage = yield* StorageService;
    const corrector = yield* CorrectorAgent;
    const getOntologyStore = yield* Effect.cached(
      Effect.gen(function* () {
        const ontologyPath = config.ontology.path;
        const contentOpt = yield* storage.get(ontologyPath);
        if (contentOpt === undefined) {
          return yield* new AgentInputError({
            taskId: "agent-kit",
            message: `Ontology not found at ${ontologyPath}`,
            missing: [ontologyPath],
          });
        }
        return yield* rdfBuilder.parseTurtle(contentOpt);
      })
    );
    const getShapesStore = yield* Effect.cached(
      Effect.gen(function* () {
        const ontologyStore = yield* getOntologyStore;
        return yield* shaclService.generateShapesFromOntology(ontologyStore);
      })
    );
    const buildStoreFromGraph = Effect.fn("buildStoreFromGraph")(function* (graph: KnowledgeGraph) {
      const store = yield* rdfBuilder.createStore;
      yield* rdfBuilder.addEntities(store, graph.entities);
      yield* rdfBuilder.addRelations(store, graph.relations);
      return store;
    });
    const resolveStore = Effect.fn("resolveStore")(function* (task: AgentTask) {
      if (O.isSome(task.rdfStore) && isRdfStore(task.rdfStore.value)) {
        return task.rdfStore.value;
      }
      if (O.isSome(task.turtle)) {
        return yield* rdfBuilder.parseTurtle(task.turtle.value);
      }
      if (O.isSome(task.knowledgeGraph)) {
        return yield* buildStoreFromGraph(task.knowledgeGraph.value);
      }
      if (O.isSome(task.graph) && isRdfStore(task.graph.value)) {
        return task.graph.value;
      }
      if (O.isSome(task.graph) && isKnowledgeGraph(task.graph.value)) {
        return yield* buildStoreFromGraph(task.graph.value);
      }
      return yield* new AgentInputError({
        taskId: task.taskId,
        message: "Validation requires rdfStore, turtle, or knowledgeGraph",
        missing: ["rdfStore", "turtle", "knowledgeGraph"],
      });
    });
    const executeIngestion = Effect.fn("AgentKit.ingestor.execute")(function* (task: AgentTask) {
      if (O.isNone(ingestionOpt)) {
        return yield* new AgentInputError({
          taskId: task.taskId,
          message: "Link ingestion service is unavailable",
          missing: ["LinkIngestionService"],
        });
      }
      if (O.isNone(task.sourceUrl)) {
        return yield* new AgentInputError({
          taskId: task.taskId,
          message: "Ingestion requires sourceUrl",
          missing: ["sourceUrl"],
        });
      }
      if (O.isNone(task.ontologyId)) {
        return yield* new AgentInputError({
          taskId: task.taskId,
          message: "Ingestion requires ontologyId",
          missing: ["ontologyId"],
        });
      }
      const extraOptions = O.match(task.ingestionOptions, {
        onNone: () => ({}),
        onSome: (value): Record<string, unknown> =>
          typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {},
      });
      const ingestResult = yield* ingestionOpt.value.ingestUrl(task.sourceUrl.value, {
        ontologyId: task.ontologyId.value,
        ...extraOptions,
      });
      const contentOpt = yield* storage.get(ingestResult.storageUri);
      if (contentOpt === undefined) {
        return yield* new AgentInputError({
          taskId: task.taskId,
          message: `Ingested content missing at ${ingestResult.storageUri}`,
        });
      }
      return mergeTask(task, {
        text: O.some(contentOpt),
        ingestionResult: O.some(ingestResult),
        documentId: O.orElse(task.documentId, () => O.some(ingestResult.id)),
      });
    });
    const ingestor: Agent<AgentTask, AgentTask, Effect.Error<ReturnType<typeof executeIngestion>>> = {
      metadata: AgentMetadata.make({
        id: AgentId.make("ingestor"),
        name: "Link Ingestor",
        description: "Fetches and stores source content for downstream agents",
        type: "ingestor",
        version: O.some("1.0.0"),
      }),
      validate: O.some((task) =>
        Effect.succeed(
          O.isSome(task.sourceUrl) && O.isSome(task.ontologyId)
            ? ValidationResult.pass()
            : ValidationResult.fail(["sourceUrl and ontologyId are required"])
        )
      ),
      execute: executeIngestion,
    };
    const extractor: Agent<AgentTask, AgentTask, AgentInputError | unknown> = {
      metadata: AgentMetadata.make({
        id: AgentId.make("extractor"),
        name: "Ontology Extractor",
        description: "Extracts entities/relations using ontology-guided LLM prompts",
        type: "extractor",
        version: O.some("1.0.0"),
      }),
      validate: O.some((task) =>
        Effect.succeed(O.isSome(task.text) ? ValidationResult.pass() : ValidationResult.fail(["text is required"]))
      ),
      execute: Effect.fn(function* (task): Effect.fn.Return<AgentTask, AgentInputError | unknown, never> {
        if (O.isNone(task.text)) {
          return yield* new AgentInputError({
            taskId: task.taskId,
            message: "Extraction requires text",
            missing: ["text"],
          });
        }
        const agentConfig: OntologyAgentConfig | undefined = O.getOrUndefined(task.agentConfig);
        const result = yield* ontologyAgent.extract(task.text.value, agentConfig);
        const rdfStore = yield* buildStoreFromGraph(result.graph);
        const ontologyContext = O.isSome(task.ontologyContext)
          ? task.ontologyContext.value
          : yield* ontologyService.ontology;
        return mergeTask(task, {
          knowledgeGraph: O.some(result.graph),
          graph: O.some(result.graph),
          rdfStore: O.some(rdfStore),
          turtle: result.turtle,
          ontologyContext: O.some(ontologyContext),
        });
      }),
    };
    const validator: Agent<AgentTask, AgentTask, AgentInputError | unknown> = {
      metadata: AgentMetadata.make({
        id: AgentId.make("validator"),
        name: "SHACL Validator",
        description: "Validates RDF graphs against ontology-derived SHACL shapes",
        type: "validator",
        version: O.some("1.0.0"),
      }),
      validate: O.some((task) =>
        Effect.succeed(
          O.isSome(task.rdfStore) || O.isSome(task.turtle) || O.isSome(task.knowledgeGraph) || O.isSome(task.graph)
            ? ValidationResult.pass()
            : ValidationResult.fail(["rdfStore, turtle, or knowledgeGraph is required"])
        )
      ),
      execute: Effect.fn(function* (task): Effect.fn.Return<AgentTask, AgentInputError | unknown, never> {
        const rdfStore = yield* resolveStore(task);
        const shapesStore = yield* getShapesStore;
        const report = yield* shaclService.validateWithReport(rdfStore, shapesStore);
        const explanations = ontologyAgent.explainViolations(report.validation.violations);
        return mergeTask(task, {
          rdfStore: O.some(rdfStore),
          validationReport: O.some(report),
          validationExplanations: O.some(explanations),
        });
      }),
    };
    const correctorAgent: Agent<AgentTask, AgentTask, AgentInputError | unknown> = {
      metadata: AgentMetadata.make({
        id: AgentId.make("corrector"),
        name: "SHACL Corrector",
        description: "Applies LLM-guided corrections to SHACL violations",
        type: "corrector",
        version: O.some("1.0.0"),
      }),
      validate: O.some((task) =>
        Effect.succeed(
          O.isSome(task.validationReport)
            ? ValidationResult.pass()
            : ValidationResult.fail(["validationReport is required"])
        )
      ),
      execute: Effect.fn(function* (task): Effect.fn.Return<AgentTask, AgentInputError | unknown, never> {
        if (O.isNone(task.validationReport)) {
          return yield* new AgentInputError({
            taskId: task.taskId,
            message: "Correction requires validationReport",
            missing: ["validationReport"],
          });
        }
        const rdfStore = yield* resolveStore(task);
        const ontologyContext = O.isSome(task.ontologyContext)
          ? task.ontologyContext.value
          : yield* ontologyService.ontology;
        const result = yield* corrector.correctAll(task.validationReport.value, rdfStore, ontologyContext);
        const turtle = yield* rdfBuilder.toTurtle(rdfStore);
        return mergeTask(task, {
          rdfStore: O.some(rdfStore),
          turtle: O.some(turtle),
          correctionResult: O.some(result),
        });
      }),
    };
    const registerDefaults = Effect.fn("registerDefaults")(function* () {
      const coordinator = yield* AgentCoordinator;
      if (Option.isSome(ingestionOpt)) {
        yield* coordinator.register(ingestor);
      }
      yield* coordinator.register(extractor);
      yield* coordinator.register(validator);
      yield* coordinator.register(correctorAgent);
    });
    return {
      ingestor,
      extractor,
      validator,
      corrector: correctorAgent,
      registerDefaults,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([
      ConfigServiceDefault,
      OntologyAgent.Default,
      OntologyService.Default,
      RdfBuilder.Default,
      ShaclWorkflowService.Default,
      StorageServiceLive,
      CorrectorAgent.Default,
      AgentCoordinator.Default,
    ])
  );
}
