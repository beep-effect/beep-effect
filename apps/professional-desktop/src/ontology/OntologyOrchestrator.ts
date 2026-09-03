/**
 * Ontology workbench sidecar orchestration handlers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import { observeWorkflow } from "@beep/observability/Metric";
import { applyChangeOperationsWithDelta } from "@beep/ontology-domain/aggregates/Session";
import {
  ApplyOntologyBatchResult,
  buildOntologySnapshot,
  OntologyActionError,
  OntologyReasoner,
  OntologyRpcs,
  OntologySparqlRunner,
  OntologyValidationRunner,
  OpenOntologyDocumentResult,
  OpenOntologyFileCommand,
  PreviewOntologyTurtleResult,
  SaveOntologyDocumentResult,
  SaveOntologyFileCommand,
  SerializeOntologySessionCommand,
  SessionUseCases,
} from "@beep/ontology-use-cases/public";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Metric from "effect/Metric";
import type {
  ApplyOntologyBatchCommand,
  OntologyFilePath,
  OpenOntologyDocumentResult as OpenOntologyDocumentResultType,
} from "@beep/ontology-use-cases/public";

const ontologyStarted = Metric.counter("desktop_ontology_operations_started_total", { incremental: true });
const ontologyCompleted = Metric.counter("desktop_ontology_operations_completed_total", { incremental: true });
const ontologyFailed = Metric.counter("desktop_ontology_operations_failed_total", { incremental: true });
const ontologyInterrupted = Metric.counter("desktop_ontology_operations_interrupted_total", { incremental: true });
const ontologyDuration = Metric.timer("desktop_ontology_operation_duration");

const observeOntologyOperation = Effect.fnUntraced(function* <A, E, R>(
  operation: string,
  effect: Effect.Effect<A, E, R>
): Effect.fn.Return<A, E, R> {
  return yield* observeWorkflow(effect, {
    name: `ontology.${operation}`,
    attributes: { operation },
    started: ontologyStarted,
    completed: ontologyCompleted,
    failed: ontologyFailed,
    interrupted: ontologyInterrupted,
    duration: ontologyDuration,
  }).pipe(Effect.withSpan(`ontology.${operation}`));
});

const toOntologyActionError = (context: string) =>
  Effect.fnUntraced(function* (error: { readonly _tag?: string }): Effect.fn.Return<never, OntologyActionError> {
    yield* logRedactedCause(
      Cause.fail(error),
      LogRedactedCauseOptions.make({
        message: "ontology action dropped internal failure",
        level: "Warn",
        attributes: { context, subsystem: "ontology" },
      })
    );
    return yield* OntologyActionError.failEffect(context);
  });

/**
 * Build ontology sidecar operations over the session use-case service.
 */
const makeOntologyOperations = (
  useCases: SessionUseCases["Service"],
  reasoner: OntologyReasoner["Service"],
  sparql: OntologySparqlRunner["Service"],
  validation: OntologyValidationRunner["Service"]
) => ({
  openDocument: (
    command: OpenOntologyFileCommand
  ): Effect.Effect<OpenOntologyDocumentResultType, OntologyActionError> =>
    observeOntologyOperation(
      "open_document",
      useCases.openFile(command).pipe(
        Effect.map((opened) =>
          OpenOntologyDocumentResult.make({
            session: opened.session,
            path: opened.path,
            source: opened.source,
            snapshot: buildOntologySnapshot(opened.session),
          })
        ),
        Effect.catch(toOntologyActionError("OpenOntologyDocument"))
      )
    ),

  saveDocument: (path: OntologyFilePath, session: SaveOntologyFileCommand["session"]) =>
    observeOntologyOperation(
      "save_document",
      useCases.saveFile(SaveOntologyFileCommand.make({ path, session })).pipe(
        Effect.map((saved) =>
          SaveOntologyDocumentResult.make({
            path: saved.path,
            source: saved.source,
          })
        ),
        Effect.catch(toOntologyActionError("SaveOntologyDocument"))
      )
    ),

  previewTurtle: (session: SerializeOntologySessionCommand["session"]) =>
    observeOntologyOperation(
      "preview_turtle",
      useCases.serialize(SerializeOntologySessionCommand.make({ session })).pipe(
        Effect.map((serialized) => PreviewOntologyTurtleResult.make({ source: serialized.source })),
        Effect.catch(toOntologyActionError("PreviewOntologyTurtle"))
      )
    ),

  applyBatch: (command: ApplyOntologyBatchCommand) =>
    observeOntologyOperation(
      "apply_batch",
      Effect.sync(() => {
        const applied = applyChangeOperationsWithDelta(command.session, command.operations);
        return ApplyOntologyBatchResult.make({
          session: applied.session,
          delta: applied.delta,
          operations: applied.operations,
        });
      })
    ),

  getSnapshot: (session: SerializeOntologySessionCommand["session"]) =>
    observeOntologyOperation(
      "get_snapshot",
      Effect.sync(() => buildOntologySnapshot(session))
    ),

  runInference: (input: Parameters<OntologyReasoner["Service"]["infer"]>[0]) =>
    observeOntologyOperation("run_inference", reasoner.infer(input)),

  runSparql: (input: Parameters<OntologySparqlRunner["Service"]["run"]>[0]) =>
    sparql
      .run(input)
      .pipe(Effect.catch(toOntologyActionError("RunOntologySparql")), (effect) =>
        observeOntologyOperation("run_sparql", effect)
      ),

  runValidation: (input: Parameters<OntologyValidationRunner["Service"]["run"]>[0]) =>
    validation
      .run(input)
      .pipe(Effect.catch(toOntologyActionError("RunOntologyValidation")), (effect) =>
        observeOntologyOperation("run_validation", effect)
      ),

  exportProvenance: (command: Parameters<OntologyValidationRunner["Service"]["exportProvenance"]>[0]) =>
    validation
      .exportProvenance(command)
      .pipe(Effect.catch(toOntologyActionError("ExportOntologyProvenance")), (effect) =>
        observeOntologyOperation("export_provenance", effect)
      ),
});

/**
 * Runtime type for the ontology orchestration operations.
 */
type OntologyOperations = ReturnType<typeof makeOntologyOperations>;

/**
 * Adapt ontology operations onto the {@link OntologyRpcs} handler record.
 *
 * @category constructors
 * @since 0.0.0
 */
const makeOntologyHandlers = (operations: OntologyOperations) =>
  OntologyRpcs.of({
    OpenOntologyDocument: (payload) =>
      operations.openDocument(
        OpenOntologyFileCommand.make({
          sessionId: payload.sessionId,
          path: payload.path,
          baseIri: payload.baseIri,
        })
      ),
    SaveOntologyDocument: ({ path, session }) => operations.saveDocument(path, session),
    PreviewOntologyTurtle: ({ session }) => operations.previewTurtle(session),
    ApplyOntologyBatch: operations.applyBatch,
    GetOntologySnapshot: ({ session }) => operations.getSnapshot(session),
    RunOntologyInference: operations.runInference,
    RunOntologySparql: operations.runSparql,
    RunOntologyValidation: operations.runValidation,
    ExportOntologyProvenance: operations.exportProvenance,
  });

/**
 * Live ontology workbench handler layer for the {@link OntologyRpcs} group.
 *
 * **Example** (Confirming ontology Layer)
 *
 * ```ts
 * import { OntologyHandlersLive } from "@/ontology/OntologyOrchestrator"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(OntologyHandlersLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const OntologyHandlersLive = OntologyRpcs.toLayer(
  Effect.gen(function* () {
    const useCases = yield* SessionUseCases;
    const reasoner = yield* OntologyReasoner;
    const sparql = yield* OntologySparqlRunner;
    const validation = yield* OntologyValidationRunner;
    return makeOntologyHandlers(makeOntologyOperations(useCases, reasoner, sparql, validation));
  })
);
