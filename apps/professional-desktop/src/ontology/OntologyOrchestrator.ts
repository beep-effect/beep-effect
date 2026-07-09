/**
 * Ontology workbench sidecar orchestration handlers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { applyChangeOperationsWithDelta } from "@beep/ontology-domain/aggregates/Session";
import {
  ApplyOntologyBatchResult,
  buildOntologySnapshot,
  OntologyActionError,
  OntologyReasoner,
  OntologyRpcs,
  OntologySparqlRunner,
  OpenOntologyDocumentResult,
  OpenOntologyFileCommand,
  PreviewOntologyTurtleResult,
  SaveOntologyDocumentResult,
  SaveOntologyFileCommand,
  SerializeOntologySessionCommand,
  SessionUseCases,
} from "@beep/ontology-use-cases/aggregates/Session";
import { Effect } from "effect";
import type {
  ApplyOntologyBatchCommand,
  OntologyFilePath,
  OpenOntologyDocumentResult as OpenOntologyDocumentResultType,
} from "@beep/ontology-use-cases/aggregates/Session";

const toOntologyActionError =
  (context: string) =>
  (error: { readonly _tag?: string }): Effect.Effect<never, OntologyActionError> =>
    Effect.logWarning("ontology action dropped internal failure", { context, detail: error }).pipe(
      Effect.andThen(OntologyActionError.failEffect(context))
    );

/**
 * Build ontology sidecar operations over the session use-case service.
 */
const makeOntologyOperations = (
  useCases: SessionUseCases["Service"],
  reasoner: OntologyReasoner["Service"],
  sparql: OntologySparqlRunner["Service"]
) => ({
  openDocument: (
    command: OpenOntologyFileCommand
  ): Effect.Effect<OpenOntologyDocumentResultType, OntologyActionError> =>
    useCases.openFile(command).pipe(
      Effect.map((opened) =>
        OpenOntologyDocumentResult.make({
          session: opened.session,
          path: opened.path,
          source: opened.source,
          snapshot: buildOntologySnapshot(opened.session),
        })
      ),
      Effect.catch(toOntologyActionError("OpenOntologyDocument")),
      Effect.withSpan("ontology.open_document")
    ),

  saveDocument: (path: OntologyFilePath, session: SaveOntologyFileCommand["session"]) =>
    useCases.saveFile(SaveOntologyFileCommand.make({ path, session })).pipe(
      Effect.map((saved) =>
        SaveOntologyDocumentResult.make({
          path: saved.path,
          source: saved.source,
        })
      ),
      Effect.catch(toOntologyActionError("SaveOntologyDocument")),
      Effect.withSpan("ontology.save_document")
    ),

  previewTurtle: (session: SerializeOntologySessionCommand["session"]) =>
    useCases.serialize(SerializeOntologySessionCommand.make({ session })).pipe(
      Effect.map((serialized) => PreviewOntologyTurtleResult.make({ source: serialized.source })),
      Effect.catch(toOntologyActionError("PreviewOntologyTurtle")),
      Effect.withSpan("ontology.preview_turtle")
    ),

  applyBatch: (command: ApplyOntologyBatchCommand) =>
    Effect.sync(() => {
      const applied = applyChangeOperationsWithDelta(command.session, command.operations);
      return ApplyOntologyBatchResult.make({
        session: applied.session,
        delta: applied.delta,
        operations: applied.operations,
      });
    }).pipe(Effect.withSpan("ontology.apply_batch")),

  getSnapshot: (session: SerializeOntologySessionCommand["session"]) =>
    Effect.sync(() => buildOntologySnapshot(session)).pipe(Effect.withSpan("ontology.get_snapshot")),

  runInference: (input: Parameters<OntologyReasoner["Service"]["infer"]>[0]) =>
    reasoner.infer(input).pipe(Effect.withSpan("ontology.run_inference")),

  runSparql: (input: Parameters<OntologySparqlRunner["Service"]["run"]>[0]) =>
    sparql
      .run(input)
      .pipe(Effect.catch(toOntologyActionError("RunOntologySparql")), Effect.withSpan("ontology.run_sparql")),
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
    ApplyOntologyBatch: (payload) => operations.applyBatch(payload),
    GetOntologySnapshot: ({ session }) => operations.getSnapshot(session),
    RunOntologyInference: (payload) => operations.runInference(payload),
    RunOntologySparql: (payload) => operations.runSparql(payload),
  });

/**
 * Live ontology workbench handler layer for the {@link OntologyRpcs} group.
 *
 * @example
 * ```ts
 * import { OntologyHandlersLive } from "@/ontology/OntologyOrchestrator"
 *
 * console.log(OntologyHandlersLive)
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
    return makeOntologyHandlers(makeOntologyOperations(useCases, reasoner, sparql));
  })
);
