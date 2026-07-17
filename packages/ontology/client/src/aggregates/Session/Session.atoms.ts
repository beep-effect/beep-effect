/**
 * Ontology workbench client atoms backed by the sidecar RPC contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { chatProtocolLayerAtom, HttpChatProtocolLive } from "@beep/agents-client";
import { CosmosGraphProjection, renderCosmosGraph } from "@beep/cosmos";
import { Graph3DProjection, Graph3DRenderOptions, renderGraph3D } from "@beep/graph-3d/browser";
import { $OntologyClientId } from "@beep/identity/packages";
import {
  appendChange,
  ChangeOperation,
  deriveSessionGraphPartitions,
  invertChangeOperation,
  Session,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import {
  ApplyOntologyBatchCommand,
  buildOntologySnapshot,
  buildOntologySnapshotWithInference,
  decodeWorkerResult,
  defaultOntologyGraphProjectionOptions,
  defaultOntologySparqlQuery,
  ExportOntologyProvenanceCommand,
  encodeWorkerCommand,
  graphGestureChangeOperations,
  InferOntologySessionInput,
  OntologyActionError,
  OntologyFilePath,
  OntologyGraphGesture,
  OntologyGraphProjectionOptions,
  OntologyMetrics,
  OntologyRpcs,
  OntologySnapshot,
  ontologySparqlExamples,
  predicateAutocompleteSuggestions,
  RunOntologySparqlInput,
  RunOntologyValidationInput,
  resourceVisibleInViewMode,
  searchOntologyResources,
  WorkerCommand,
  WorkerResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import { serializeQuad } from "@beep/rdf/Rdf";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, O, P, Str } from "@beep/utils";
import { Cause, Duration, Effect, Fiber, flow, Order, pipe, Result, Semaphore } from "effect";
import * as S from "effect/Schema";
import { Atom, AtomRpc, Reactivity } from "effect/unstable/reactivity";
import type { CosmosBackend, CosmosRenderHandle } from "@beep/cosmos";
import type { Graph3DDriverError, Graph3DRenderHandle } from "@beep/graph-3d/browser";
import type { SessionChangeDelta } from "@beep/ontology-domain/aggregates/Session";
import type {
  ExportOntologyProvenanceResult,
  OntologyFoldLevel,
  OntologyGraphProjection,
  OntologyInferenceResult,
  OntologyRepairProposal,
  OntologySparqlPanelProfile,
  OntologyViewMode,
  RunOntologySparqlResult,
  RunOntologyValidationResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import type { Layer } from "effect";
import type { RpcClient } from "effect/unstable/rpc";

const $I = $OntologyClientId.create("aggregates/Session/Session.atoms");

/**
 * Default HTTP protocol used by browser and non-IPC desktop sessions.
 *
 * @example
 * ```ts
 * import { HttpOntologyProtocolLive } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(HttpOntologyProtocolLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const HttpOntologyProtocolLive: Layer.Layer<RpcClient.Protocol> = HttpChatProtocolLive;

/**
 * Writable transport selector consumed by {@link OntologyClient}.
 *
 * @example
 * ```ts
 * import { ontologyProtocolLayerAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyProtocolLayerAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyProtocolLayerAtom: Atom.Writable<Layer.Layer<RpcClient.Protocol>> = chatProtocolLayerAtom;

/**
 * Flattened RPC client for {@link OntologyRpcs}, integrated with atom reactivity.
 *
 * @example
 * ```ts
 * import { OntologyClient } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(OntologyClient)
 * ```
 *
 * @category clients
 * @since 0.0.0
 */
export class OntologyClient extends AtomRpc.Service<OntologyClient>()("OntologyClient", {
  group: OntologyRpcs,
  protocol: (get) => get(ontologyProtocolLayerAtom),
}) {}

const SESSION_KEY = "ontology-session" as const;
const SOURCE_KEY = "ontology-source" as const;
const GRAPH_KEY = "ontology-graph" as const;
const INFERENCE_KEY = "ontology-inference" as const;
const SPARQL_KEY = "ontology-sparql" as const;
const VALIDATION_KEY = "ontology-validation" as const;
const PROVENANCE_KEY = "ontology-provenance" as const;
const NO_SHAPES_DETECTED_MESSAGE = "No SHACL shapes detected in this document.";

/**
 * Open ontology document payload for the client atom.
 *
 * @example
 * ```ts
 * import { OpenOntologyDocumentInput } from "@beep/ontology-client/aggregates/Session"
 * import { SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const input = OpenOntologyDocumentInput.make({
 *   sessionId: S.decodeUnknownSync(SessionId)("session-1"),
 *   path: S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl")
 * })
 *
 * console.log(input.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenOntologyDocumentInput extends S.Class<OpenOntologyDocumentInput>($I`OpenOntologyDocumentInput`)(
  {
    sessionId: SessionId,
    path: OntologyFilePath,
    baseIri: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("OpenOntologyDocumentInput", {
    description: "Open ontology document payload for the client atom.",
  })
) {}

/**
 * Save ontology document payload for the client atom.
 *
 * @example
 * ```ts
 * import { SaveOntologyDocumentInput } from "@beep/ontology-client/aggregates/Session"
 * import { OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const input = SaveOntologyDocumentInput.make({
 *   path: S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl")
 * })
 *
 * console.log(input.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SaveOntologyDocumentInput extends S.Class<SaveOntologyDocumentInput>($I`SaveOntologyDocumentInput`)(
  {
    path: OntologyFilePath,
  },
  $I.annote("SaveOntologyDocumentInput", {
    description: "Save ontology document payload for the client atom.",
  })
) {}

/**
 * Batch operation payload for the client mutation atom.
 *
 * @example
 * ```ts
 * import { ApplyOntologyBatchInput } from "@beep/ontology-client/aggregates/Session"
 * import { ChangeOperation } from "@beep/ontology-domain/aggregates/Session"
 * import { makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 *
 * const input = ApplyOntologyBatchInput.make({
 *   operations: [
 *     ChangeOperation.make({
 *       kind: "addQuad",
 *       partition: "asserted",
 *       quad: makeQuad(
 *         makeNamedNode("https://example.test/alice"),
 *         makeNamedNode("https://example.test/knows"),
 *         makeNamedNode("https://example.test/bob")
 *       )
 *     })
 *   ]
 * })
 *
 * console.log(input.operations.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApplyOntologyBatchInput extends S.Class<ApplyOntologyBatchInput>($I`ApplyOntologyBatchInput`)(
  {
    operations: S.Array(ChangeOperation),
  },
  $I.annote("ApplyOntologyBatchInput", {
    description: "Batch operation payload for the client mutation atom.",
  })
) {}

/**
 * Graph gesture payload for the client mutation atom.
 *
 * @example
 * ```ts
 * import { ApplyOntologyGraphGestureInput } from "@beep/ontology-client/aggregates/Session"
 * import { OntologyGraphGesture } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const input = ApplyOntologyGraphGestureInput.make({
 *   gesture: OntologyGraphGesture.make({
 *     kind: "instantiate",
 *     classIri: "https://example.test/Pizza",
 *     instanceIri: "https://example.test/Margherita"
 *   })
 * })
 *
 * console.log(input.gesture.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApplyOntologyGraphGestureInput extends S.Class<ApplyOntologyGraphGestureInput>(
  $I`ApplyOntologyGraphGestureInput`
)(
  {
    gesture: OntologyGraphGesture,
  },
  $I.annote("ApplyOntologyGraphGestureInput", {
    description: "Graph gesture payload converted into ontology change operations.",
  })
) {}

const OntologyValidationStatus = LiteralKit(["idle", "running", "blocked", "failed", "complete"]);
/**
 * Current lifecycle state for ontology validation workbench actions.
 *
 * @example
 * ```ts
 * import type { OntologyValidationStatus } from "@beep/ontology-client/aggregates/Session"
 *
 * const status: OntologyValidationStatus = "idle"
 *
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OntologyValidationStatus = typeof OntologyValidationStatus.Type;

/**
 * Workbench state that outlives the view showing it.
 *
 * The registry disposes any atom with no listeners and no dependents once its
 * idle TTL elapses, and the desktop sets one. Every atom below is subscribed
 * only from inside `OntologyWorkbench`, which the app unmounts whenever the user
 * switches surface — so leaving the Ontology tab dropped all of them to zero
 * listeners, and thirty seconds later the registry swept them back to their
 * defaults. The open document, every unsaved change in its change log, the
 * dirty-tracking signature, and the redo stack were all destroyed in silence:
 * the workbench simply came back saying "no file open".
 *
 * This is application state, not view state. Keeping it alive says so. These are
 * singletons, so there is nothing to leak — unlike a per-editor family, where
 * keeping values alive would pin every editor ever created.
 *
 * @category atoms
 * @since 0.0.0
 */
const workbenchState = <A>(initialValue: A) => Atom.keepAlive(Atom.make(initialValue));

/**
 * Current open ontology session, if any.
 *
 * @example
 * ```ts
 * import { ontologySessionAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologySessionAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologySessionAtom = workbenchState<O.Option<Session>>(O.none());

/**
 * Current open ontology path, if any.
 *
 * @example
 * ```ts
 * import { ontologyPathAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyPathAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyPathAtom = workbenchState<O.Option<OntologyFilePath>>(O.none());

/**
 * Latest Turtle source shown by the source view.
 *
 * @example
 * ```ts
 * import { ontologySourceAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologySourceAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologySourceAtom = workbenchState("");

/**
 * Change-log length after the last successful save/open.
 *
 * @example
 * ```ts
 * import { ontologySavedChangeCountAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologySavedChangeCountAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologySavedChangeCountAtom = workbenchState(0);

const changeLogSignature: (changes: ReadonlyArray<ChangeOperation>) => string = flow(
  A.map((change: ChangeOperation) => `${change.kind}:${change.partition}:${serializeQuad(change.quad)}`),
  A.join("\n")
);

/** Identifies the exact session a read was computed from. */
const sessionSignature = (session: Session): string => `${session.id}:${changeLogSignature(session.changeLog)}`;

/**
 * True when the open session is no longer the one a read started against.
 *
 * SPARQL and validation deliberately do not hold the mutation lock — a slow read
 * must never block editing — so the user can apply a triple, undo, or redo while
 * one is in flight. A result computed from the session as it was is not an answer
 * about the ontology as it is: publishing it anyway put rows and verdicts from the
 * old ontology on screen as the current ones, which is worse than no answer.
 */
const sessionMoved = (current: O.Option<Session>, signature: string): boolean =>
  O.match(current, {
    onNone: () => true,
    onSome: (session) => sessionSignature(session) !== signature,
  });

const STALE_READ_MESSAGE = "The ontology changed while this was running. Run it again for a current result.";

/**
 * Change-log signature after the last successful save/open.
 *
 * @example
 * ```ts
 * import { ontologySavedChangeLogSignatureAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologySavedChangeLogSignatureAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologySavedChangeLogSignatureAtom = workbenchState(changeLogSignature([]));

/**
 * Redo stack for client-local undo/redo.
 *
 * @example
 * ```ts
 * import { ontologyRedoStackAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyRedoStackAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyRedoStackAtom = workbenchState<ReadonlyArray<ChangeOperation>>([]);

/**
 * Current explorer view mode.
 *
 * @example
 * ```ts
 * import { ontologyViewModeAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyViewModeAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyViewModeAtom = workbenchState<OntologyViewMode>("all");

/**
 * Current visualizer fold level.
 *
 * @example
 * ```ts
 * import { ontologyFoldLevelAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyFoldLevelAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyFoldLevelAtom = workbenchState<OntologyFoldLevel>("L2");

/**
 * Whether explorer projections include the derived inferred graph partition.
 *
 * @example
 * ```ts
 * import { ontologyInferredViewAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyInferredViewAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyInferredViewAtom = workbenchState(false);

/**
 * Latest structural inference result for the open session.
 *
 * @example
 * ```ts
 * import { ontologyInferenceResultAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyInferenceResultAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyInferenceResultAtom = workbenchState<O.Option<OntologyInferenceResult>>(O.none());

const ontologyInferenceInputSignatureAtom = workbenchState<O.Option<string>>(O.none());

/**
 * Latest structural inference failure, if any.
 *
 * @example
 * ```ts
 * import { ontologyInferenceErrorAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyInferenceErrorAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyInferenceErrorAtom = workbenchState<O.Option<string>>(O.none());

const inferenceInputSignature = (session: Session): string => {
  const partitions = deriveSessionGraphPartitions(session);
  const quads = pipe(
    partitions.asserted.quads,
    A.appendAll(partitions.ontologies.quads),
    A.map(serializeQuad),
    A.sort(Order.String)
  );

  return pipe([session.id, `changes:${session.changeLog.length}`, ...quads], A.join("\n"));
};

const resetOntologyInference = (ctx: Atom.FnContext): void => {
  ctx.set(ontologyInferenceResultAtom, O.none());
  ctx.set(ontologyInferenceInputSignatureAtom, O.none());
  ctx.set(ontologyInferenceErrorAtom, O.none());
};

const resetOntologyValidation = (ctx: Atom.FnContext): void => {
  ctx.set(ontologyValidationStatusAtom, "idle");
  ctx.set(ontologyValidationResultAtom, O.none());
  ctx.set(ontologyValidationErrorAtom, O.none());
};

/**
 * What to tell the user when an ontology action fails.
 *
 * The workbench used to print `Cause.pretty(cause)` straight into its panels: an
 * internal Effect cause, complete with stack frames and module paths, shown to
 * someone who mistyped a SPARQL query. It told them nothing they could act on, and
 * it leaked the shape of the program to do it.
 *
 * Every failure that crosses the RPC boundary is a typed `OntologyActionError`
 * carrying a `message` written for a person — so that message is what gets shown.
 * The full cause still goes to the log, where the detail is useful and the reader is
 * a developer.
 */
const actionFailureMessage = (label: string, cause: Cause.Cause<unknown>): string =>
  pipe(
    Cause.findErrorOption(cause),
    O.filter((error) => P.hasProperty(error, "message") && P.isString(error.message)),
    O.map((error) => String((error as { readonly message: string }).message)),
    O.filter(Str.isNonEmpty),
    O.getOrElse(() => `${label} failed. See the log for details.`)
  );

const reportFailure = (label: string, cause: Cause.Cause<unknown>): void => {
  Effect.runFork(Effect.logError(`${label} failed`, cause));
};

const validationFailureMessage = (label: string, cause: Cause.Cause<unknown>): string =>
  actionFailureMessage(label, cause);

const setValidationFailure = (ctx: Atom.FnContext, label: string, cause: Cause.Cause<unknown>): void => {
  ctx.set(ontologyValidationStatusAtom, "failed");
  ctx.set(ontologyValidationResultAtom, O.none());
  ctx.set(ontologyValidationErrorAtom, O.some(validationFailureMessage(label, cause)));
};

const hasValidationShapes = (session: Session): boolean =>
  deriveSessionGraphPartitions(session).shapes.quads.length > 0;

const ensureOntologyInference = Effect.fn("ensureOntologyInference")(function* (
  client: OntologyClient["Service"],
  session: Session,
  ctx: Atom.FnContext
) {
  const signature = inferenceInputSignature(session);
  const previousSignature = ctx(ontologyInferenceInputSignatureAtom);
  const previous = ctx(ontologyInferenceResultAtom);

  if (O.isSome(previousSignature) && previousSignature.value === signature && O.isSome(previous)) {
    return previous.value;
  }

  const inference = yield* Reactivity.mutation(
    client(
      "RunOntologyInference",
      InferOntologySessionInput.make({
        session,
        previous,
      })
    ),
    [INFERENCE_KEY, GRAPH_KEY]
  );
  ctx.set(ontologyInferenceResultAtom, O.some(inference));
  ctx.set(ontologyInferenceInputSignatureAtom, O.some(signature));
  ctx.set(ontologyInferenceErrorAtom, O.none());
  return inference;
});

/**
 * Current SPARQL panel profile.
 *
 * @example
 * ```ts
 * import { ontologySparqlProfileAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologySparqlProfileAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologySparqlProfileAtom = workbenchState<OntologySparqlPanelProfile>("select");

/**
 * Current SPARQL query text.
 *
 * @example
 * ```ts
 * import { ontologySparqlQueryAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologySparqlQueryAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologySparqlQueryAtom = workbenchState("SELECT ?s ?p ?o WHERE {\n  ?s ?p ?o\n}");

/**
 * Built-in SPARQL example library for the workbench panel.
 *
 * @example
 * ```ts
 * import { ontologySparqlExamplesAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologySparqlExamplesAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologySparqlExamplesAtom = Atom.make(ontologySparqlExamples());

/**
 * Latest safeguarded SPARQL query result.
 *
 * @example
 * ```ts
 * import { ontologySparqlResultAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologySparqlResultAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologySparqlResultAtom = workbenchState<O.Option<RunOntologySparqlResult>>(O.none());

/**
 * Latest SPARQL query failure, if any.
 *
 * @example
 * ```ts
 * import { ontologySparqlErrorAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologySparqlErrorAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologySparqlErrorAtom = workbenchState<O.Option<string>>(O.none());

/**
 * Latest open/save/preview failure, if any.
 *
 * Document operations are the workbench's entry gate: with nowhere to render
 * their failures, a rejected path or an unreadable file made Open look like a
 * dead button, and a failed Save left the "Saved" badge asserting a write that
 * never landed.
 *
 * @example
 * ```ts
 * import { ontologyDocumentErrorAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyDocumentErrorAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyDocumentErrorAtom = workbenchState<O.Option<string>>(O.none());

/**
 * Latest SHACL validation result, if one has been requested.
 *
 * @example
 * ```ts
 * import { ontologyValidationResultAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyValidationResultAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyValidationResultAtom = workbenchState<O.Option<RunOntologyValidationResult>>(O.none());

/**
 * Current SHACL validation panel state.
 *
 * @example
 * ```ts
 * import { ontologyValidationStatusAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyValidationStatusAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyValidationStatusAtom = workbenchState<OntologyValidationStatus>("idle");

/**
 * Latest SHACL validation failure, if any.
 *
 * @example
 * ```ts
 * import { ontologyValidationErrorAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyValidationErrorAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyValidationErrorAtom = workbenchState<O.Option<string>>(O.none());

/**
 * Latest provenance export result, if one has been produced.
 *
 * @example
 * ```ts
 * import { ontologyProvenanceExportAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyProvenanceExportAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyProvenanceExportAtom = Atom.make<O.Option<ExportOntologyProvenanceResult>>(O.none());

/**
 * Current resource search query.
 *
 * @example
 * ```ts
 * import { ontologySearchQueryAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologySearchQueryAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologySearchQueryAtom = Atom.make("");

/**
 * Selected resource IRI for inspector focus.
 *
 * @example
 * ```ts
 * import { selectedOntologyResourceIriAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(selectedOntologyResourceIriAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const selectedOntologyResourceIriAtom = Atom.make<O.Option<string>>(O.none());

/**
 * Workbench toggle selecting the 2D cosmos or 3D graph renderer.
 *
 * @example
 * ```ts
 * import { ontologyGraphRendererAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyGraphRendererAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyGraphRendererAtom = Atom.make<"cosmos" | "graph3d">("cosmos");

/**
 * Latest worker graph projection, if one has completed.
 *
 * @example
 * ```ts
 * import { ontologyGraphProjectionAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyGraphProjectionAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyGraphProjectionAtom = Atom.make<O.Option<OntologyGraphProjection>>(O.none());

/**
 * Latest session delta available for incremental graph projection.
 *
 * @example
 * ```ts
 * import { ontologyGraphDeltaAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyGraphDeltaAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyGraphDeltaAtom = Atom.make<O.Option<SessionChangeDelta>>(O.none());

/**
 * Visualizer mount container supplied by the UI package.
 *
 * @example
 * ```ts
 * import { ontologyGraphContainerAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyGraphContainerAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyGraphContainerAtom = Atom.make<O.Option<HTMLElement>>(O.none());

/**
 * Current visualizer backend selected by capability detection.
 *
 * @example
 * ```ts
 * import { ontologyGraphBackendAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyGraphBackendAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyGraphBackendAtom = Atom.make<O.Option<CosmosBackend>>(O.none());

/**
 * Latest visualizer worker failure, if worker setup or message transfer failed.
 *
 * @example
 * ```ts
 * import { ontologyGraphErrorAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyGraphErrorAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyGraphErrorAtom = Atom.make<O.Option<string>>(O.none());

/**
 * Empty ontology snapshot used before a document is opened.
 *
 * @example
 * ```ts
 * import { emptyOntologySnapshot } from "@beep/ontology-client/aggregates/Session"
 *
 * const snapshot = emptyOntologySnapshot()
 *
 * console.log(snapshot.metrics.quadCount)
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const emptyOntologySnapshot = (): OntologySnapshot =>
  OntologySnapshot.make({
    sessionId: "",
    resources: [],
    hierarchy: [],
    relationships: [],
    metrics: OntologyMetrics.make({
      quadCount: 0,
      resourceCount: 0,
      classCount: 0,
      propertyCount: 0,
      individualCount: 0,
      tboxCount: 0,
      aboxCount: 0,
      disjointnessViolationCount: 0,
    }),
  });

/**
 * Current ontology snapshot derived from the open session.
 *
 * @example
 * ```ts
 * import { ontologySnapshotAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologySnapshotAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologySnapshotAtom = Atom.make((get) =>
  pipe(
    get(ontologySessionAtom),
    O.map((session) => {
      const inference = get(ontologyInferenceResultAtom);
      return get(ontologyInferredViewAtom) && O.isSome(inference)
        ? buildOntologySnapshotWithInference(session, inference.value)
        : buildOntologySnapshot(session);
    }),
    O.getOrElse(emptyOntologySnapshot)
  )
);

/**
 * Whether the current session has unsaved authored changes.
 *
 * @example
 * ```ts
 * import { ontologyDirtyAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyDirtyAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyDirtyAtom = Atom.make((get) =>
  pipe(
    get(ontologySessionAtom),
    O.match({
      onNone: () => false,
      onSome: (session) => changeLogSignature(session.changeLog) !== get(ontologySavedChangeLogSignatureAtom),
    })
  )
);

/**
 * Search results filtered through the shared ABox/TBox view rule.
 *
 * @example
 * ```ts
 * import { ontologySearchResultsAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologySearchResultsAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologySearchResultsAtom = Atom.make((get) =>
  searchOntologyResources(get(ontologySnapshotAtom), {
    mode: get(ontologyViewModeAtom),
    query: get(ontologySearchQueryAtom),
  })
);

/**
 * Selected resource summary, if a resource is selected.
 *
 * @example
 * ```ts
 * import { selectedOntologyResourceAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(selectedOntologyResourceAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const selectedOntologyResourceAtom = Atom.make((get) =>
  pipe(
    get(selectedOntologyResourceIriAtom),
    O.flatMap((iri) =>
      pipe(
        get(ontologySnapshotAtom).resources,
        A.findFirst((resource) => resource.iri === iri)
      )
    )
  )
);

/**
 * Resources visible in the current explorer mode.
 *
 * @example
 * ```ts
 * import { visibleOntologyResourcesAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(visibleOntologyResourcesAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const visibleOntologyResourcesAtom = Atom.make((get) =>
  pipe(
    get(ontologySnapshotAtom).resources,
    A.filter((resource) => resourceVisibleInViewMode(resource, get(ontologyViewModeAtom)))
  )
);

/**
 * Worker graph projection options derived from current viewport state.
 *
 * @example
 * ```ts
 * import { ontologyGraphProjectionOptionsAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyGraphProjectionOptionsAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyGraphProjectionOptionsAtom = Atom.make((get) =>
  OntologyGraphProjectionOptions.make({
    ...defaultOntologyGraphProjectionOptions(),
    viewMode: get(ontologyViewModeAtom),
    foldLevel: get(ontologyFoldLevelAtom),
    focusIri: get(selectedOntologyResourceIriAtom),
  })
);

/**
 * Predicate suggestions for graph halo autocomplete.
 *
 * @example
 * ```ts
 * import { ontologyPredicateSuggestionsAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyPredicateSuggestionsAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyPredicateSuggestionsAtom = Atom.make((get) =>
  predicateAutocompleteSuggestions(get(ontologySnapshotAtom), get(ontologySearchQueryAtom))
);

const graphRequestAtom = Atom.make((get) => ({
  snapshot: get(ontologySnapshotAtom),
  options: get(ontologyGraphProjectionOptionsAtom),
  delta: get(ontologyGraphDeltaAtom),
}));

const graphWorkerErrorMessage = (event: ErrorEvent): string =>
  Str.isNonEmpty(event.message) ? event.message : "Ontology graph worker failed.";

const graphWorkerMessageError = (event: MessageEvent<unknown>): string =>
  P.hasProperty(event, "type") && event.type === "messageerror"
    ? "Ontology graph worker message failed to deserialize."
    : "Ontology graph worker failed.";

const GRAPH_WORKER_UNAVAILABLE_MESSAGE = "Graph projection is unavailable: this environment has no web worker.";

const GRAPH_WORKER_UNREADABLE_RESULT_MESSAGE = "The graph worker returned a result this app could not read.";

const GRAPH_WORKER_TIMEOUT_MESSAGE = "The graph worker did not respond. The diagram could not be drawn.";

/**
 * How long a projection may take before the worker is treated as dead.
 *
 * There was no watchdog at all, and a worker that simply never answers is the one
 * failure the error handlers cannot see: `error` and `messageerror` never fire, so
 * the workbench sat on "pending" forever with nothing to explain it. That is the
 * shape this very bug took. A silence this long is a failure, and it now says so.
 */
const GRAPH_WORKER_TIMEOUT = Duration.seconds(20);

/**
 * Side-effect atom that owns the visualizer projection worker.
 *
 * @example
 * ```ts
 * import { ontologyGraphWorkerBridgeAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyGraphWorkerBridgeAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyGraphWorkerBridgeAtom = Atom.make((get) => {
  const WorkerCtor = globalThis.Worker;

  if (P.isUndefined(WorkerCtor)) {
    // No worker, no projection — but say so. Returning quietly left the graph on
    // "pending" forever with nothing to explain it.
    get.set(ontologyGraphErrorAtom, O.some(GRAPH_WORKER_UNAVAILABLE_MESSAGE));
    return;
  }

  let worker: O.Option<Worker> = O.none();
  let previousProjection: O.Option<OntologyGraphProjection> = O.none();
  let lastProjectionRequest: O.Option<WorkerCommand> = O.none();
  let requeuedAfterFailure = false;
  let watchdog: O.Option<Fiber.Fiber<void>> = O.none();

  const disarmWatchdog = (): void => {
    pipe(
      watchdog,
      O.match({ onNone: () => undefined, onSome: (fiber) => void Effect.runFork(Fiber.interrupt(fiber)) })
    );
    watchdog = O.none();
  };

  // Armed on every request, disarmed by any answer. A worker that never replies
  // fires neither `error` nor `messageerror`, so without this the graph waits
  // forever and says nothing — which is precisely how this bug hid.
  const armWatchdog = (): void => {
    disarmWatchdog();
    watchdog = O.some(
      Effect.runFork(
        Effect.sleep(GRAPH_WORKER_TIMEOUT).pipe(Effect.map(() => failWorker(GRAPH_WORKER_TIMEOUT_MESSAGE)))
      )
    );
  };

  const terminateWorker = (): void => {
    pipe(worker, O.match({ onNone: () => undefined, onSome: (currentWorker) => currentWorker.terminate() }));
    worker = O.none();
  };

  const failWorker = (message: string): void => {
    disarmWatchdog();
    previousProjection = O.none();
    get.set(ontologyGraphProjectionAtom, O.none());
    get.set(ontologyGraphDeltaAtom, O.none());
    get.set(ontologyGraphBackendAtom, O.none());
    get.set(ontologyGraphErrorAtom, O.some(message));
    terminateWorker();
    requeueLastProjectionRequest();
  };

  const makeWorker = (): Worker => {
    const nextWorker = new WorkerCtor(new URL("./Session.visualizer.worker.ts", import.meta.url), { type: "module" });
    nextWorker.addEventListener("message", (event: MessageEvent<unknown>) => {
      // The worker posts the ENCODED result: a structured clone drops prototypes,
      // so what arrives is plain data until it is decoded back into the domain.
      disarmWatchdog();
      const received = decodeWorkerResult(event.data);
      if (!Result.isSuccess(received)) {
        failWorker(GRAPH_WORKER_UNREADABLE_RESULT_MESSAGE);
        return;
      }
      WorkerResult.match(received.success, {
        parseTurtleSucceeded: () => undefined,
        diffDatasetsSucceeded: () => undefined,
        computeSnapshotSucceeded: () => undefined,
        projectGraphSucceeded: ({ result }) => {
          requeuedAfterFailure = false;
          get.set(ontologyGraphErrorAtom, O.none());
          previousProjection = O.some(result);
          get.set(ontologyGraphProjectionAtom, O.some(result));
        },
        applyGraphDeltaSucceeded: ({ result }) => {
          requeuedAfterFailure = false;
          get.set(ontologyGraphErrorAtom, O.none());
          previousProjection = O.some(result);
          get.set(ontologyGraphProjectionAtom, O.some(result));
        },
      });
    });
    nextWorker.addEventListener("error", (event) => {
      event.preventDefault();
      failWorker(graphWorkerErrorMessage(event));
    });
    nextWorker.addEventListener("messageerror", (event) => {
      failWorker(graphWorkerMessageError(event));
    });
    return nextWorker;
  };

  const currentWorker = (): Worker =>
    pipe(
      worker,
      O.getOrElse(() => {
        const nextWorker = makeWorker();
        worker = O.some(nextWorker);
        return nextWorker;
      })
    );

  const requeueLastProjectionRequest = (): void => {
    if (requeuedAfterFailure) {
      return;
    }
    pipe(
      lastProjectionRequest,
      O.match({
        onNone: () => undefined,
        onSome: (command) => {
          requeuedAfterFailure = true;
          armWatchdog();
          currentWorker().postMessage(encodeWorkerCommand(command));
        },
      })
    );
  };

  get.subscribe(
    graphRequestAtom,
    ({ snapshot, options, delta }) => {
      const activeWorker = currentWorker();
      const command = pipe(
        previousProjection,
        O.flatMap((previous) =>
          pipe(
            delta,
            O.map((currentDelta) =>
              WorkerCommand.make({
                kind: "applyGraphDelta",
                snapshot,
                previous,
                delta: currentDelta,
                options,
              })
            )
          )
        ),
        O.getOrElse(() =>
          WorkerCommand.make({
            kind: "projectGraph",
            snapshot,
            options,
          })
        )
      );
      lastProjectionRequest = O.some(command);
      requeuedAfterFailure = false;
      get.set(ontologyGraphErrorAtom, O.none());
      armWatchdog();
      activeWorker.postMessage(encodeWorkerCommand(command));
      get.set(ontologyGraphDeltaAtom, O.none());
    },
    { immediate: true }
  );

  get.addFinalizer(() => {
    disarmWatchdog();
    terminateWorker();
  });
});

/**
 * Maps the worker's ontology projection onto the renderer's projection.
 *
 * @example
 * ```ts
 * import { cosmosProjectionFromOntology } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(typeof cosmosProjectionFromOntology)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const cosmosProjectionFromOntology = (projection: OntologyGraphProjection): CosmosGraphProjection =>
  CosmosGraphProjection.make({
    nodeCount: projection.nodeCount,
    edgeCount: projection.edgeCount,
    nodeIds: projection.nodeIds,
    pointPositions: projection.pointPositions,
    links: projection.links,
    // The projection has always carried a label for every node, and the fold level
    // has always decided how many to show — and then the renderer dropped the lot,
    // so a graph of named classes drew as a field of anonymous dots. The names reach
    // the canvas now; `hidden` still means hidden.
    ...(projection.labelDetail === "hidden" ? {} : { labels: A.map(projection.nodes, (node) => node.label) }),
  });

const buildGraphAdjacency = (
  nodeCount: number,
  links: Float32Array,
  includesEdge: (source: number, target: number) => boolean
): Array<Array<number>> => {
  const adjacency = A.makeBy(nodeCount, (): Array<number> => []);
  let edgeOffset = 0;

  while (edgeOffset < links.length) {
    const source = links[edgeOffset] ?? -1;
    const target = links[edgeOffset + 1] ?? -1;
    if (includesEdge(source, target)) {
      adjacency[source]?.push(target);
      adjacency[target]?.push(source);
    }
    edgeOffset += 2;
  }

  return adjacency;
};

const includesEveryGraphEdge = (_source: number, _target: number): boolean => true;

const graphArrayValue = (values: ArrayLike<number>, index: number, fallback: number): number =>
  values[index] ?? fallback;

const graphNeighbors = (adjacency: ReadonlyArray<ReadonlyArray<number>>, node: number): ReadonlyArray<number> =>
  adjacency[node] ?? [];

const visitGraphNeighbor = (
  node: number,
  neighbor: number,
  distances: Int32Array,
  pathCounts: Float64Array,
  predecessors: ReadonlyArray<Array<number>>,
  queue: Array<number>
): void => {
  const nodeDistance = graphArrayValue(distances, node, 0);
  if (graphArrayValue(distances, neighbor, -1) < 0) {
    distances[neighbor] = nodeDistance + 1;
    queue.push(neighbor);
  }
  if (graphArrayValue(distances, neighbor, -1) === nodeDistance + 1) {
    pathCounts[neighbor] = graphArrayValue(pathCounts, neighbor, 0) + graphArrayValue(pathCounts, node, 0);
    predecessors[neighbor]?.push(node);
  }
};

const graphShortestPathsFromSource = (
  source: number,
  nodeCount: number,
  adjacency: ReadonlyArray<ReadonlyArray<number>>
): readonly [ReadonlyArray<ReadonlyArray<number>>, Float64Array<ArrayBuffer>, ReadonlyArray<number>] => {
  const predecessors = A.makeBy(nodeCount, (): Array<number> => []);
  const pathCounts = new Float64Array(nodeCount);
  const distances = new Int32Array(nodeCount);
  distances.fill(-1);
  pathCounts[source] = 1;
  distances[source] = 0;

  const queue: Array<number> = [source];
  const stack: Array<number> = [];
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const node = graphArrayValue(queue, queueIndex, source);
    queueIndex += 1;
    stack.push(node);
    const neighbors = graphNeighbors(adjacency, node);
    let neighborIndex = 0;

    while (neighborIndex < neighbors.length) {
      const neighbor = graphArrayValue(neighbors, neighborIndex, node);
      visitGraphNeighbor(node, neighbor, distances, pathCounts, predecessors, queue);
      neighborIndex += 1;
    }
  }

  return [predecessors, pathCounts, stack];
};

const graphDependencyCoefficient = (node: number, pathCounts: Float64Array, dependency: Float64Array): number => {
  const nodePathCount = graphArrayValue(pathCounts, node, 0);
  return nodePathCount === 0 ? 0 : (1 + graphArrayValue(dependency, node, 0)) / nodePathCount;
};

const accumulateGraphPredecessors = (
  node: number,
  predecessors: ReadonlyArray<ReadonlyArray<number>>,
  pathCounts: Float64Array,
  dependency: Float64Array,
  coefficient: number
): void => {
  const nodePredecessors = graphNeighbors(predecessors, node);
  let predecessorIndex = 0;

  while (predecessorIndex < nodePredecessors.length) {
    const predecessor = graphArrayValue(nodePredecessors, predecessorIndex, node);
    dependency[predecessor] =
      graphArrayValue(dependency, predecessor, 0) + graphArrayValue(pathCounts, predecessor, 0) * coefficient;
    predecessorIndex += 1;
  }
};

const accumulateGraphDependencyForNode = (
  source: number,
  node: number,
  predecessors: ReadonlyArray<ReadonlyArray<number>>,
  pathCounts: Float64Array,
  dependency: Float64Array,
  centrality: Float64Array
): void => {
  const coefficient = graphDependencyCoefficient(node, pathCounts, dependency);
  accumulateGraphPredecessors(node, predecessors, pathCounts, dependency, coefficient);
  if (node !== source) {
    centrality[node] = graphArrayValue(centrality, node, 0) + graphArrayValue(dependency, node, 0);
  }
};

const accumulateGraphDependencies = (
  source: number,
  nodeCount: number,
  predecessors: ReadonlyArray<ReadonlyArray<number>>,
  pathCounts: Float64Array,
  stack: ReadonlyArray<number>,
  centrality: Float64Array
): void => {
  const dependency = new Float64Array(nodeCount);
  let stackIndex = stack.length - 1;

  while (stackIndex >= 0) {
    const node = graphArrayValue(stack, stackIndex, source);
    accumulateGraphDependencyForNode(source, node, predecessors, pathCounts, dependency, centrality);
    stackIndex -= 1;
  }
};

const maximumGraphCentrality = (centrality: Float64Array): number => {
  let maximum = 0;
  let nodeIndex = 0;

  while (nodeIndex < centrality.length) {
    const value = centrality[nodeIndex] ?? 0;
    if (value > maximum) {
      maximum = value;
    }
    nodeIndex += 1;
  }

  return maximum;
};

const normalizeGraphCentrality = (centrality: Float64Array): Float32Array<ArrayBuffer> => {
  const normalized = new Float32Array(centrality.length);
  const maximum = maximumGraphCentrality(centrality);

  if (maximum > 0) {
    let nodeIndex = 0;
    while (nodeIndex < centrality.length) {
      normalized[nodeIndex] = (centrality[nodeIndex] ?? 0) / maximum;
      nodeIndex += 1;
    }
  }

  return normalized;
};

const graphBetweennessCentrality = (
  nodeCount: number,
  adjacency: ReadonlyArray<ReadonlyArray<number>>
): Float32Array<ArrayBuffer> => {
  const centrality = new Float64Array(nodeCount);
  let source = 0;

  while (source < nodeCount) {
    const [predecessors, pathCounts, stack] = graphShortestPathsFromSource(source, nodeCount, adjacency);
    accumulateGraphDependencies(source, nodeCount, predecessors, pathCounts, stack, centrality);
    source += 1;
  }

  return normalizeGraphCentrality(centrality);
};

/**
 * Minimum normalized endpoint betweenness above which an edge counts as an
 * inter-cluster artery. Only edges whose BOTH endpoints are strong bridges are
 * cut, so hub-to-leaf star edges survive (leaf bc is ~0) while hub-to-hub
 * arteries separate clusters. Product-tuned.
 */
const communityArteryThreshold = 0.4;

const includesCommunityEdge = (importance: Float32Array, source: number, target: number): boolean =>
  Math.min(importance[source] ?? 0, importance[target] ?? 0) <= communityArteryThreshold;

const labelGraphComponent = (
  seed: number,
  componentId: number,
  adjacency: ReadonlyArray<ReadonlyArray<number>>,
  communities: Uint32Array,
  queue: Array<number>
): void => {
  communities[seed] = componentId;
  queue.length = 0;
  queue.push(seed);
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const current = queue[queueIndex] ?? seed;
    queueIndex += 1;
    for (const neighbor of adjacency[current] ?? []) {
      if (communities[neighbor] === 0xffffffff) {
        communities[neighbor] = componentId;
        queue.push(neighbor);
      }
    }
  }
};

const labelGraphComponents = (
  nodeCount: number,
  adjacency: ReadonlyArray<ReadonlyArray<number>>
): Uint32Array<ArrayBuffer> => {
  const communities = new Uint32Array(nodeCount).fill(0xffffffff);
  let componentId = 0;
  const queue: Array<number> = [];

  for (let seed = 0; seed < nodeCount; seed += 1) {
    if (communities[seed] !== 0xffffffff) {
      continue;
    }
    labelGraphComponent(seed, componentId, adjacency, communities, queue);
    componentId += 1;
  }

  return communities;
};

const compressCommunityOrdinals = (communities: Uint32Array): Uint16Array<ArrayBuffer> => {
  const ordinals = new Uint16Array(communities.length);
  const ordinalByCommunity = new Uint16Array(communities.length);
  const seen = new Uint8Array(communities.length);
  let distinctCount = 0;
  let nodeIndex = 0;

  while (nodeIndex < communities.length) {
    const community = communities[nodeIndex] ?? nodeIndex;
    if ((seen[community] ?? 0) === 0) {
      seen[community] = 1;
      ordinalByCommunity[community] = distinctCount % 65_535;
      distinctCount += 1;
    }
    ordinals[nodeIndex] = ordinalByCommunity[community] ?? 0;
    nodeIndex += 1;
  }

  return ordinals;
};

const graphCommunities = (
  nodeCount: number,
  links: Float32Array,
  importance: Float32Array
): Uint16Array<ArrayBuffer> => {
  // One-shot Girvan–Newman on the betweenness channel we already compute:
  // drop artery edges (min endpoint bc above the threshold), then color
  // connected components. Deterministic; label propagation was rejected —
  // synchronous updates two-color the tree-heavy ontology graphs and
  // asynchronous updates flood through bridge nodes.
  const adjacency = buildGraphAdjacency(nodeCount, links, (source, target) =>
    includesCommunityEdge(importance, source, target)
  );
  return compressCommunityOrdinals(labelGraphComponents(nodeCount, adjacency));
};

let graph3dProjectionChannelCache: O.Option<
  readonly [number, Float32Array<ArrayBuffer>, Uint16Array<ArrayBuffer>, Float32Array<ArrayBuffer>]
> = O.none();

const graph3dProjectionChannels = (
  projection: OntologyGraphProjection
): readonly [Float32Array<ArrayBuffer>, Uint16Array<ArrayBuffer>, Float32Array<ArrayBuffer>] =>
  pipe(
    graph3dProjectionChannelCache,
    O.filter(([revision]) => revision === projection.revision),
    O.match({
      onNone: () => {
        const adjacency = pipe(
          buildGraphAdjacency(projection.nodeCount, projection.links, includesEveryGraphEdge),
          A.map(flow(A.sort(Order.Number), A.dedupe))
        );
        const nodeImportance = graphBetweennessCentrality(projection.nodeCount, adjacency);
        const nodeCommunities = graphCommunities(projection.nodeCount, projection.links, nodeImportance);
        const edgeWeights = new Float32Array(projection.edgeCount);
        let edgeIndex = 0;

        while (edgeIndex < projection.edgeCount) {
          const source = projection.links[edgeIndex * 2] ?? 0;
          const target = projection.links[edgeIndex * 2 + 1] ?? 0;
          edgeWeights[edgeIndex] = ((nodeImportance[source] ?? 0) + (nodeImportance[target] ?? 0)) / 2;
          edgeIndex += 1;
        }

        graph3dProjectionChannelCache = O.some([projection.revision, nodeImportance, nodeCommunities, edgeWeights]);
        return [nodeImportance, nodeCommunities, edgeWeights];
      },
      onSome: ([, nodeImportance, nodeCommunities, edgeWeights]) => [nodeImportance, nodeCommunities, edgeWeights],
    })
  );

/**
 * Maps an ontology worker projection into the deterministic 3D renderer contract.
 *
 * @example
 * ```ts
 * import { graph3dProjectionFromOntology } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(typeof graph3dProjectionFromOntology)
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const graph3dProjectionFromOntology = (projection: OntologyGraphProjection): Graph3DProjection => {
  const pointDepths =
    P.hasProperty(projection, "pointDepths") && projection.pointDepths instanceof Float32Array
      ? projection.pointDepths
      : new Float32Array(0);
  const pointPositions = new Float32Array(projection.nodeCount * 3);
  let nodeIndex = 0;

  while (nodeIndex < projection.nodeCount) {
    pointPositions[nodeIndex * 3] = projection.pointPositions[nodeIndex * 2] ?? 0;
    pointPositions[nodeIndex * 3 + 1] = projection.pointPositions[nodeIndex * 2 + 1] ?? 0;
    pointPositions[nodeIndex * 3 + 2] = pointDepths[nodeIndex] ?? 0;
    nodeIndex += 1;
  }

  const [nodeImportance, nodeCommunities, edgeWeights] = graph3dProjectionChannels(projection);
  return Graph3DProjection.make({
    nodeCount: projection.nodeCount,
    edgeCount: projection.edgeCount,
    nodeIds: projection.nodeIds,
    pointPositions,
    links: projection.links,
    nodeCommunities,
    nodeImportance,
    edgeWeights,
    ...(projection.labelDetail === "hidden" ? {} : { labels: A.map(projection.nodes, (node) => node.label) }),
  });
};

const renderRequestAtom = Atom.make((get) => ({
  container: get(ontologyGraphContainerAtom),
  projection: get(ontologyGraphProjectionAtom),
  renderer: get(ontologyGraphRendererAtom),
}));

const graphRenderFailureMessage = (cause: unknown): string =>
  `The graph could not be drawn: ${cause instanceof Error ? cause.message : String(cause)}`;

/**
 * Side-effect atom that mounts and updates the selected graph viewport.
 *
 * @example
 * ```ts
 * import { ontologyGraphRenderBridgeAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyGraphRenderBridgeAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyGraphRenderBridgeAtom = Atom.make((get) => {
  let cosmosHandle: O.Option<CosmosRenderHandle> = O.none();
  let graph3dHandle: O.Option<Graph3DRenderHandle> = O.none();
  let graph3dOntologyProjection: O.Option<OntologyGraphProjection> = O.none();
  let activeRenderer: "cosmos" | "graph3d" = "cosmos";
  let renderToken = 0;

  const selectedNodeIndex = (projection: OntologyGraphProjection, selectedIri: O.Option<string>): number | undefined =>
    pipe(
      selectedIri,
      O.flatMap((iri) =>
        pipe(
          projection.nodes,
          A.findFirstIndex((node) => node.iri === iri)
        )
      ),
      O.getOrUndefined
    );

  const destroyMountedRenderers = (): void => {
    pipe(cosmosHandle, O.match({ onNone: () => undefined, onSome: (mounted) => mounted.destroy() }));
    pipe(graph3dHandle, O.match({ onNone: () => undefined, onSome: (mounted) => mounted.destroy() }));
    cosmosHandle = O.none();
    graph3dHandle = O.none();
    graph3dOntologyProjection = O.none();
  };

  get.subscribe(
    renderRequestAtom,
    ({ container, projection, renderer }) => {
      if (renderer !== activeRenderer) {
        renderToken += 1;
        destroyMountedRenderers();
        activeRenderer = renderer;
      }

      if (O.isNone(container) || O.isNone(projection)) {
        renderToken += 1;
        destroyMountedRenderers();
        get.set(ontologyGraphBackendAtom, O.none());
        return;
      }

      // A fresh attempt clears the last failure, so a recovered graph stops
      // claiming to be broken.
      get.set(ontologyGraphErrorAtom, O.none());

      if (renderer === "graph3d") {
        get.set(ontologyGraphBackendAtom, O.none());
        const ontologyProjection = projection.value;
        const graph3dProjection = graph3dProjectionFromOntology(ontologyProjection);
        graph3dOntologyProjection = O.some(ontologyProjection);

        pipe(
          graph3dHandle,
          O.match({
            onNone: () => {
              renderToken += 1;
              const token = renderToken;
              const options = Graph3DRenderOptions.make({
                onNodeSelect: (nodeIndex: number | undefined) => {
                  get.set(
                    selectedOntologyResourceIriAtom,
                    pipe(
                      graph3dOntologyProjection,
                      O.flatMap((currentProjection) =>
                        P.isUndefined(nodeIndex)
                          ? O.none()
                          : pipe(
                              currentProjection.nodes,
                              A.get(nodeIndex),
                              O.map((node) => node.iri)
                            )
                      )
                    )
                  );
                },
                onRuntimeError: (error: Graph3DDriverError) => {
                  get.set(ontologyGraphErrorAtom, O.some(graphRenderFailureMessage(error)));
                },
              });
              void Effect.runPromise(renderGraph3D(container.value, graph3dProjection, options)).then(
                (mounted) => {
                  if (token !== renderToken) {
                    mounted.destroy();
                    return;
                  }
                  graph3dHandle = O.some(mounted);
                  mounted.select(selectedNodeIndex(ontologyProjection, get(selectedOntologyResourceIriAtom)));
                },
                (cause: unknown) => {
                  if (token === renderToken) {
                    graph3dHandle = O.none();
                    graph3dOntologyProjection = O.none();
                    get.set(ontologyGraphBackendAtom, O.none());
                    get.set(ontologyGraphErrorAtom, O.some(graphRenderFailureMessage(cause)));
                  }
                }
              );
            },
            onSome: (mounted) => {
              mounted.update(graph3dProjection);
              mounted.select(selectedNodeIndex(ontologyProjection, get(selectedOntologyResourceIriAtom)));
            },
          })
        );
        return;
      }

      const cosmosProjection = cosmosProjectionFromOntology(projection.value);

      pipe(
        cosmosHandle,
        O.match({
          onNone: () => {
            renderToken += 1;
            const token = renderToken;
            void Effect.runPromise(renderCosmosGraph(container.value, cosmosProjection)).then(
              (mounted) => {
                if (token !== renderToken) {
                  mounted.destroy();
                  return;
                }
                cosmosHandle = O.some(mounted);
                get.set(ontologyGraphBackendAtom, O.some(mounted.backend));
              },
              (cause: unknown) => {
                if (token === renderToken) {
                  cosmosHandle = O.none();
                  get.set(ontologyGraphBackendAtom, O.none());
                  // The renderer's failure used to be dropped on the floor: the
                  // backend went back to `none`, the badge read "pending", and the
                  // reason — a lost WebGL context, a container with no size — was
                  // never spoken. A graph that cannot be drawn has to say so.
                  get.set(ontologyGraphErrorAtom, O.some(graphRenderFailureMessage(cause)));
                }
              }
            );
          },
          onSome: (mounted) => mounted.update(cosmosProjection),
        })
      );
    },
    { immediate: true }
  );

  get.subscribe(
    selectedOntologyResourceIriAtom,
    (selectedIri) => {
      pipe(
        graph3dHandle,
        O.match({
          onNone: () => undefined,
          onSome: (mounted) =>
            mounted.select(
              pipe(
                graph3dOntologyProjection,
                O.map((projection) => selectedNodeIndex(projection, selectedIri)),
                O.getOrUndefined
              )
            ),
        })
      );
    },
    { immediate: true }
  );

  get.addFinalizer(() => {
    renderToken += 1;
    destroyMountedRenderers();
  });
});

const noOpenSessionError = OntologyActionError.new("No ontology session is open.");

/**
 * Serializes every session-authoring mutation.
 *
 * Each mutation reads the open session, awaits an RPC that returns a *whole new
 * session*, then writes it back. Two mutations in flight therefore both start
 * from session S, come back with S+A and S+B, and whichever lands last silently
 * discards the other author's change — a double-clicked Apply, or a graph
 * gesture fired while Apply was pending, loses work with no error anywhere.
 *
 * Holding the permit across the read means a queued mutation observes the
 * previous one's committed session, so changes compose instead of racing. The
 * server-side tool service already serializes its own mutations the same way
 * ({@link OntologyToolService}); this closes the client path.
 *
 * @category concurrency
 * @since 0.0.0
 */
const sessionMutationSemaphore = Semaphore.makeUnsafe(1);

/**
 * Toggle inferred view and refresh inference when enabling it.
 *
 * @example
 * ```ts
 * import { toggleOntologyInferredViewAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(toggleOntologyInferredViewAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const toggleOntologyInferredViewAtom = OntologyClient.runtime.fn<boolean>()(
  Effect.fn("toggleOntologyInferredView")(function* (enabled, ctx) {
    ctx.set(ontologyInferredViewAtom, enabled);
    ctx.set(ontologyGraphProjectionAtom, O.none());
    ctx.set(ontologyGraphDeltaAtom, O.none());

    if (!enabled) {
      ctx.set(ontologyInferenceErrorAtom, O.none());
      return;
    }

    const client = yield* OntologyClient;
    const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
    yield* ensureOntologyInference(client, session, ctx);
  })
);

/**
 * Apply a built-in SPARQL example to the query editor.
 *
 * @example
 * ```ts
 * import { applyOntologySparqlExampleAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(applyOntologySparqlExampleAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const applyOntologySparqlExampleAtom = OntologyClient.runtime.fn<string>()(
  Effect.fn("applyOntologySparqlExample")(function* (id, ctx) {
    yield* pipe(
      ctx(ontologySparqlExamplesAtom),
      A.findFirst((example) => example.id === id),
      O.match({
        onNone: () => Effect.void,
        onSome: (example) =>
          Effect.sync(() => {
            ctx.set(ontologySparqlProfileAtom, example.profile);
            ctx.set(ontologySparqlQueryAtom, example.query);
            ctx.set(ontologySparqlResultAtom, O.none());
            ctx.set(ontologySparqlErrorAtom, O.none());
          }),
      })
    );
  })
);

/**
 * Execute the current SPARQL query through the sidecar safeguards.
 *
 * @example
 * ```ts
 * import { runOntologySparqlAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(runOntologySparqlAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const runOntologySparqlAtom = OntologyClient.runtime.fn<void>()(
  Effect.fn("runOntologySparql")(function* (_, ctx) {
    yield* Effect.gen(function* () {
      const client = yield* OntologyClient;
      const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
      const signature = sessionSignature(session);
      // Drop the previous verdict before running: an invalid or failing query
      // used to leave the last successful result table on screen with no error,
      // so the panel appeared to answer a query it had actually rejected.
      ctx.set(ontologySparqlResultAtom, O.none());
      ctx.set(ontologySparqlErrorAtom, O.none());
      let inference = ctx(ontologyInferenceResultAtom);

      if (ctx(ontologyInferredViewAtom)) {
        const refreshed = yield* ensureOntologyInference(client, session, ctx);
        inference = O.some(refreshed);
      }

      const result = yield* Reactivity.mutation(
        client(
          "RunOntologySparql",
          RunOntologySparqlInput.make({
            session,
            profile: ctx(ontologySparqlProfileAtom),
            query: ctx(ontologySparqlQueryAtom),
            includeInferred: ctx(ontologyInferredViewAtom),
            inference,
          })
        ),
        [SPARQL_KEY]
      );
      if (sessionMoved(ctx(ontologySessionAtom), signature)) {
        ctx.set(ontologySparqlErrorAtom, O.some(STALE_READ_MESSAGE));
        return;
      }
      ctx.set(ontologySparqlResultAtom, O.some(result));
      ctx.set(ontologySparqlErrorAtom, O.none());
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          reportFailure("SPARQL", cause);
          ctx.set(ontologySparqlErrorAtom, O.some(actionFailureMessage("The query", cause)));
        })
      )
    );
  })
);

/**
 * Run SHACL validation over asserted and inferred graphs.
 *
 * @example
 * ```ts
 * import { runOntologyValidationAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(runOntologyValidationAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const runOntologyValidationAtom = OntologyClient.runtime.fn<void>()(
  Effect.fn("runOntologyValidation")(function* (_, ctx) {
    yield* pipe(
      Effect.gen(function* () {
        const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
        const signature = sessionSignature(session);
        if (!hasValidationShapes(session)) {
          ctx.set(ontologyValidationStatusAtom, "blocked");
          ctx.set(ontologyValidationResultAtom, O.none());
          ctx.set(ontologyValidationErrorAtom, O.some(NO_SHAPES_DETECTED_MESSAGE));
          return;
        }

        ctx.set(ontologyValidationStatusAtom, "running");
        ctx.set(ontologyValidationResultAtom, O.none());
        ctx.set(ontologyValidationErrorAtom, O.none());
        const client = yield* OntologyClient;
        const inference = yield* ensureOntologyInference(client, session, ctx);
        const result = yield* Reactivity.mutation(
          client(
            "RunOntologyValidation",
            RunOntologyValidationInput.make({
              session,
              inference: O.some(inference),
            })
          ),
          [VALIDATION_KEY]
        );
        // A verdict for the session as it WAS is not a verdict on the session as it
        // IS. Applying a triple mid-validation used to land the older run afterwards
        // and present it as `complete` for the newer ontology — a clean bill of
        // health for a document that had changed underneath it.
        if (sessionMoved(ctx(ontologySessionAtom), signature)) {
          ctx.set(ontologyValidationStatusAtom, "idle");
          ctx.set(ontologyValidationResultAtom, O.none());
          ctx.set(ontologyValidationErrorAtom, O.some(STALE_READ_MESSAGE));
          return;
        }
        ctx.set(ontologyValidationStatusAtom, "complete");
        ctx.set(ontologyValidationResultAtom, O.some(result));
        ctx.set(ontologyValidationErrorAtom, O.none());
      }),
      Effect.catchCause((cause) => Effect.sync(() => setValidationFailure(ctx, "Validation", cause)))
    );
  })
);

/**
 * Apply one verified SHACL repair through the standard batch change pipeline.
 *
 * @example
 * ```ts
 * import { applyOntologyRepairAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(applyOntologyRepairAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const applyOntologyRepairAtom = OntologyClient.runtime.fn<OntologyRepairProposal>()(
  Effect.fn("applyOntologyRepair")(function* (proposal, ctx) {
    yield* sessionMutationSemaphore.withPermit(
      Effect.gen(function* () {
        const client = yield* OntologyClient;
        const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
        const applied = yield* Reactivity.mutation(
          client("ApplyOntologyBatch", ApplyOntologyBatchCommand.make({ session, operations: proposal.operations })),
          [SESSION_KEY, GRAPH_KEY, VALIDATION_KEY]
        );
        ctx.set(ontologySessionAtom, O.some(applied.session));
        ctx.set(ontologyRedoStackAtom, []);
        ctx.set(ontologySparqlResultAtom, O.none());
        ctx.set(ontologyGraphProjectionAtom, O.none());
        ctx.set(ontologyGraphDeltaAtom, O.none());
        // The repair is already committed. Clear the pre-repair verdict now and
        // mark validation running: if revalidation below fails, the panel must
        // not keep showing violations the repair already resolved (still
        // offering the same repair button), as though nothing had happened.
        ctx.set(ontologyValidationStatusAtom, "running");
        ctx.set(ontologyValidationResultAtom, O.none());
        ctx.set(ontologyValidationErrorAtom, O.none());
        const inference = yield* ensureOntologyInference(client, applied.session, ctx);
        const validation = yield* Reactivity.mutation(
          client(
            "RunOntologyValidation",
            RunOntologyValidationInput.make({
              session: applied.session,
              inference: O.some(inference),
            })
          ),
          [VALIDATION_KEY]
        );
        ctx.set(ontologyValidationStatusAtom, "complete");
        ctx.set(ontologyValidationResultAtom, O.some(validation));
        ctx.set(ontologyValidationErrorAtom, O.none());
      }).pipe(
        // A failure after the batch landed leaves the ontology repaired but
        // unvalidated; say so instead of failing silently.
        Effect.tapCause((cause) =>
          Effect.sync(() => {
            ctx.set(ontologyValidationStatusAtom, "failed");
            reportFailure("Validation", cause);
            ctx.set(ontologyValidationErrorAtom, O.some(actionFailureMessage("Validation", cause)));
          })
        )
      )
    );
  })
);

/**
 * Export PROV-O journal and VoID/DCAT dataset description files.
 *
 * @example
 * ```ts
 * import { exportOntologyProvenanceAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(exportOntologyProvenanceAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const exportOntologyProvenanceAtom = OntologyClient.runtime.fn<void>()(
  Effect.fn("exportOntologyProvenance")(function* (_, ctx) {
    yield* pipe(
      Effect.gen(function* () {
        const client = yield* OntologyClient;
        const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
        const basePath = O.getOrElse(ctx(ontologyPathAtom), () =>
          OntologyFilePath.fromUnknown(`tmp/${session.id}.ttl`)
        );
        const exported = yield* Reactivity.mutation(
          client(
            "ExportOntologyProvenance",
            ExportOntologyProvenanceCommand.make({
              session,
              provPath: OntologyFilePath.fromUnknown(`${basePath}.prov.ttl`),
              datasetPath: OntologyFilePath.fromUnknown(`${basePath}.dataset.ttl`),
            })
          ),
          [PROVENANCE_KEY]
        );
        ctx.set(ontologyProvenanceExportAtom, O.some(exported));
        ctx.set(ontologyValidationErrorAtom, O.none());
      }),
      Effect.catchCause((cause) => Effect.sync(() => setValidationFailure(ctx, "Export", cause)))
    );
  })
);

/**
 * Open a Turtle document through the sidecar.
 *
 * @example
 * ```ts
 * import { openOntologyDocumentAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(openOntologyDocumentAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const openOntologyDocumentAtom = OntologyClient.runtime.fn<OpenOntologyDocumentInput>()(
  Effect.fn("openOntologyDocument")(function* (input, ctx) {
    yield* sessionMutationSemaphore
      .withPermit(
        Effect.gen(function* () {
          const client = yield* OntologyClient;
          const opened = yield* Reactivity.mutation(client("OpenOntologyDocument", input), [SESSION_KEY, SOURCE_KEY]);
          ctx.set(ontologyDocumentErrorAtom, O.none());
          ctx.set(ontologySessionAtom, O.some(opened.session));
          ctx.set(ontologyPathAtom, O.some(opened.path));
          ctx.set(ontologySourceAtom, opened.source);
          ctx.set(ontologySavedChangeCountAtom, opened.session.changeLog.length);
          ctx.set(ontologySavedChangeLogSignatureAtom, changeLogSignature(opened.session.changeLog));
          ctx.set(ontologyRedoStackAtom, []);
          ctx.set(selectedOntologyResourceIriAtom, O.none());
          ctx.set(ontologyGraphProjectionAtom, O.none());
          ctx.set(ontologyGraphDeltaAtom, O.none());
          ctx.set(ontologyGraphErrorAtom, O.none());
          resetOntologyInference(ctx);
          ctx.set(ontologySparqlQueryAtom, defaultOntologySparqlQuery(opened.session));
          ctx.set(ontologySparqlResultAtom, O.none());
          ctx.set(ontologySparqlErrorAtom, O.none());
          resetOntologyValidation(ctx);
          ctx.set(ontologyProvenanceExportAtom, O.none());
          if (ctx(ontologyInferredViewAtom)) {
            yield* ensureOntologyInference(client, opened.session, ctx);
          }
        })
      )
      .pipe(
        // Without this, a rejected path or unreadable file made Open a no-op:
        // the RPC failed, nothing rendered, and the workbench sat at "No file open".
        Effect.tapCause((cause) =>
          Effect.sync(() => {
            reportFailure("Ontology document", cause);
            ctx.set(ontologyDocumentErrorAtom, O.some(actionFailureMessage("The document", cause)));
          })
        )
      );
  })
);

/**
 * Save the current ontology session through the sidecar.
 *
 * @example
 * ```ts
 * import { saveOntologyDocumentAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(saveOntologyDocumentAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const saveOntologyDocumentAtom = OntologyClient.runtime.fn<SaveOntologyDocumentInput>()(
  Effect.fn("saveOntologyDocument")(function* (input, ctx) {
    yield* sessionMutationSemaphore
      .withPermit(
        Effect.gen(function* () {
          const client = yield* OntologyClient;
          const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
          const saved = yield* Reactivity.mutation(client("SaveOntologyDocument", { path: input.path, session }), [
            SESSION_KEY,
            SOURCE_KEY,
          ]);
          ctx.set(ontologyDocumentErrorAtom, O.none());
          ctx.set(ontologyPathAtom, O.some(saved.path));
          ctx.set(ontologySourceAtom, saved.source);
          // Only after the write lands: marking the log saved on a failed save
          // would flip the badge to "Saved" for data still only in memory.
          ctx.set(ontologySavedChangeCountAtom, session.changeLog.length);
          ctx.set(ontologySavedChangeLogSignatureAtom, changeLogSignature(session.changeLog));
        })
      )
      .pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => {
            reportFailure("Ontology document", cause);
            ctx.set(ontologyDocumentErrorAtom, O.some(actionFailureMessage("The document", cause)));
          })
        )
      );
  })
);

/**
 * Refresh the Turtle source view from the current session without saving.
 *
 * @example
 * ```ts
 * import { previewOntologyTurtleAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(previewOntologyTurtleAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const previewOntologyTurtleAtom = OntologyClient.runtime.fn<void>()(
  Effect.fn("previewOntologyTurtle")(function* (_, ctx) {
    yield* Effect.gen(function* () {
      const client = yield* OntologyClient;
      const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
      const preview = yield* Reactivity.mutation(client("PreviewOntologyTurtle", { session }), [SOURCE_KEY]);
      ctx.set(ontologyDocumentErrorAtom, O.none());
      ctx.set(ontologySourceAtom, preview.source);
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          reportFailure("Ontology document", cause);
          ctx.set(ontologyDocumentErrorAtom, O.some(actionFailureMessage("The document", cause)));
        })
      )
    );
  })
);

/**
 * Apply typed ontology changes through the sidecar batch endpoint.
 *
 * @example
 * ```ts
 * import { applyOntologyBatchAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(applyOntologyBatchAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const applyOntologyBatchAtom = OntologyClient.runtime.fn<ApplyOntologyBatchInput>()(
  Effect.fn("applyOntologyBatch")(function* (input, ctx) {
    // The session read must happen under the permit — see sessionMutationSemaphore.
    yield* sessionMutationSemaphore.withPermit(
      Effect.gen(function* () {
        const client = yield* OntologyClient;
        const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
        const applied = yield* Reactivity.mutation(
          client("ApplyOntologyBatch", ApplyOntologyBatchCommand.make({ session, operations: input.operations })),
          [SESSION_KEY, GRAPH_KEY]
        );
        ctx.set(ontologySessionAtom, O.some(applied.session));
        ctx.set(ontologyRedoStackAtom, []);
        ctx.set(ontologySparqlResultAtom, O.none());
        resetOntologyValidation(ctx);
        if (ctx(ontologyInferredViewAtom)) {
          yield* ensureOntologyInference(client, applied.session, ctx);
          ctx.set(ontologyGraphProjectionAtom, O.none());
          ctx.set(ontologyGraphDeltaAtom, O.none());
        } else {
          resetOntologyInference(ctx);
          ctx.set(ontologyGraphDeltaAtom, O.some(applied.delta));
        }
      })
    );
  })
);

/**
 * Apply a graph halo gesture through the same batch change pipeline as inspector edits.
 *
 * @example
 * ```ts
 * import { applyOntologyGraphGestureAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(applyOntologyGraphGestureAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const applyOntologyGraphGestureAtom = OntologyClient.runtime.fn<ApplyOntologyGraphGestureInput>()(
  Effect.fn("applyOntologyGraphGesture")(function* (input, ctx) {
    yield* sessionMutationSemaphore.withPermit(
      Effect.gen(function* () {
        const client = yield* OntologyClient;
        const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
        const operations = graphGestureChangeOperations(input.gesture);
        const applied = yield* Reactivity.mutation(
          client("ApplyOntologyBatch", ApplyOntologyBatchCommand.make({ session, operations })),
          [SESSION_KEY, GRAPH_KEY]
        );
        ctx.set(ontologySessionAtom, O.some(applied.session));
        ctx.set(ontologyRedoStackAtom, []);
        ctx.set(ontologySparqlResultAtom, O.none());
        resetOntologyValidation(ctx);
        if (ctx(ontologyInferredViewAtom)) {
          yield* ensureOntologyInference(client, applied.session, ctx);
          ctx.set(ontologyGraphProjectionAtom, O.none());
          ctx.set(ontologyGraphDeltaAtom, O.none());
        } else {
          resetOntologyInference(ctx);
          ctx.set(ontologyGraphDeltaAtom, O.some(applied.delta));
        }
      })
    );
  })
);

/**
 * Undo the last authored session change locally.
 *
 * @example
 * ```ts
 * import { undoOntologyChangeAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(undoOntologyChangeAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const undoOntologyChangeAtom = OntologyClient.runtime.fn<void>()(
  Effect.fn("undoOntologyChange")(function* (_, ctx) {
    // Undo/redo rewrite the session wholesale from a snapshot too, so spamming
    // them alongside an in-flight Apply raced the same way.
    yield* sessionMutationSemaphore.withPermit(
      Effect.gen(function* () {
        const client = yield* OntologyClient;
        const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
        yield* pipe(
          A.last(session.changeLog),
          O.match({
            onNone: () => Effect.void,
            onSome: Effect.fn("undoOntologyChange.onSome")(function* (change) {
              const nextSession = Session.make({
                ...session,
                changeLog: A.dropRight(session.changeLog, 1),
              });
              ctx.set(ontologySessionAtom, O.some(nextSession));
              ctx.set(ontologyRedoStackAtom, pipe(ctx(ontologyRedoStackAtom), A.prepend(change)));
              ctx.set(ontologySparqlResultAtom, O.none());
              resetOntologyValidation(ctx);
              ctx.set(ontologyGraphProjectionAtom, O.none());
              ctx.set(ontologyGraphDeltaAtom, O.none());
              if (ctx(ontologyInferredViewAtom)) {
                yield* ensureOntologyInference(client, nextSession, ctx);
              } else {
                resetOntologyInference(ctx);
              }
            }),
          })
        );
      })
    );
  })
);

/**
 * Redo the most recently undone authored change locally.
 *
 * @example
 * ```ts
 * import { redoOntologyChangeAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(redoOntologyChangeAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const redoOntologyChangeAtom = OntologyClient.runtime.fn<void>()(
  Effect.fn("redoOntologyChange")(function* (_, ctx) {
    yield* sessionMutationSemaphore.withPermit(
      Effect.gen(function* () {
        const client = yield* OntologyClient;
        const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
        yield* pipe(
          A.head(ctx(ontologyRedoStackAtom)),
          O.match({
            onNone: () => Effect.void,
            onSome: Effect.fn("redoOntologyChange.onSome")(function* (change) {
              const nextSession = appendChange(session, change);
              ctx.set(ontologySessionAtom, O.some(nextSession));
              ctx.set(ontologyRedoStackAtom, A.drop(ctx(ontologyRedoStackAtom), 1));
              ctx.set(ontologySparqlResultAtom, O.none());
              resetOntologyValidation(ctx);
              ctx.set(ontologyGraphProjectionAtom, O.none());
              ctx.set(ontologyGraphDeltaAtom, O.none());
              if (ctx(ontologyInferredViewAtom)) {
                yield* ensureOntologyInference(client, nextSession, ctx);
              } else {
                resetOntologyInference(ctx);
              }
            }),
          })
        );
      })
    );
  })
);

/**
 * Invert a change operation for UI preview labels.
 *
 * @example
 * ```ts
 * import { invertOntologyChange } from "@beep/ontology-client/aggregates/Session"
 * import { ChangeOperation } from "@beep/ontology-domain/aggregates/Session"
 * import { makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 *
 * const inverted = invertOntologyChange(
 *   ChangeOperation.make({
 *     kind: "addQuad",
 *     partition: "asserted",
 *     quad: makeQuad(
 *       makeNamedNode("https://example.test/alice"),
 *       makeNamedNode("https://example.test/knows"),
 *       makeNamedNode("https://example.test/bob")
 *     )
 *   })
 * )
 *
 * console.log(inverted.kind)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const invertOntologyChange = invertChangeOperation;
