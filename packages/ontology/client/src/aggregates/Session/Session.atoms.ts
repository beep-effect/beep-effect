/**
 * Ontology workbench client atoms backed by the sidecar RPC contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { chatProtocolLayerAtom, HttpChatProtocolLive } from "@beep/agents-client";
import { CosmosGraphProjection, renderCosmosGraph } from "@beep/cosmos";
import { make as makeIdentity } from "@beep/identity";
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
  defaultOntologyGraphProjectionOptions,
  defaultOntologySparqlQuery,
  ExportOntologyProvenanceCommand,
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
import { Cause, Effect, flow, Order, pipe } from "effect";
import * as S from "effect/Schema";
import { Atom, AtomRpc, Reactivity } from "effect/unstable/reactivity";
import type { CosmosBackend, CosmosRenderHandle } from "@beep/cosmos";
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

const { $OntologyClientId } = makeIdentity("ontology-client");
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
export const ontologySessionAtom = Atom.make<O.Option<Session>>(O.none());

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
export const ontologyPathAtom = Atom.make<O.Option<OntologyFilePath>>(O.none());

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
export const ontologySourceAtom = Atom.make("");

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
export const ontologySavedChangeCountAtom = Atom.make(0);

const changeLogSignature: (changes: ReadonlyArray<ChangeOperation>) => string = flow(
  A.map((change: ChangeOperation) => `${change.kind}:${change.partition}:${serializeQuad(change.quad)}`),
  A.join("\n")
);

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
export const ontologySavedChangeLogSignatureAtom = Atom.make(changeLogSignature([]));

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
export const ontologyRedoStackAtom = Atom.make<ReadonlyArray<ChangeOperation>>([]);

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
export const ontologyViewModeAtom = Atom.make<OntologyViewMode>("all");

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
export const ontologyFoldLevelAtom = Atom.make<OntologyFoldLevel>("L2");

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
export const ontologyInferredViewAtom = Atom.make(false);

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
export const ontologyInferenceResultAtom = Atom.make<O.Option<OntologyInferenceResult>>(O.none());

const ontologyInferenceInputSignatureAtom = Atom.make<O.Option<string>>(O.none());

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
export const ontologyInferenceErrorAtom = Atom.make<O.Option<string>>(O.none());

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

const validationFailureMessage = (label: string, cause: Cause.Cause<unknown>): string =>
  `${label} failed: ${Cause.pretty(cause)}`;

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
export const ontologySparqlProfileAtom = Atom.make<OntologySparqlPanelProfile>("select");

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
export const ontologySparqlQueryAtom = Atom.make("SELECT ?s ?p ?o WHERE {\n  ?s ?p ?o\n}");

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
export const ontologySparqlResultAtom = Atom.make<O.Option<RunOntologySparqlResult>>(O.none());

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
export const ontologySparqlErrorAtom = Atom.make<O.Option<string>>(O.none());

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
export const ontologyValidationResultAtom = Atom.make<O.Option<RunOntologyValidationResult>>(O.none());

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
export const ontologyValidationStatusAtom = Atom.make<OntologyValidationStatus>("idle");

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
export const ontologyValidationErrorAtom = Atom.make<O.Option<string>>(O.none());

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
    return;
  }

  let worker: O.Option<Worker> = O.none();
  let previousProjection: O.Option<OntologyGraphProjection> = O.none();

  const terminateWorker = (): void => {
    pipe(worker, O.match({ onNone: () => undefined, onSome: (currentWorker) => currentWorker.terminate() }));
    worker = O.none();
  };

  const failWorker = (message: string): void => {
    previousProjection = O.none();
    get.set(ontologyGraphProjectionAtom, O.none());
    get.set(ontologyGraphDeltaAtom, O.none());
    get.set(ontologyGraphBackendAtom, O.none());
    get.set(ontologyGraphErrorAtom, O.some(message));
    terminateWorker();
  };

  const makeWorker = (): Worker => {
    const nextWorker = new WorkerCtor(new URL("./Session.visualizer.worker.ts", import.meta.url), { type: "module" });
    nextWorker.addEventListener("message", (event: MessageEvent<WorkerResult>) => {
      WorkerResult.match(event.data, {
        parseTurtleSucceeded: () => undefined,
        diffDatasetsSucceeded: () => undefined,
        computeSnapshotSucceeded: () => undefined,
        projectGraphSucceeded: ({ result }) => {
          get.set(ontologyGraphErrorAtom, O.none());
          previousProjection = O.some(result);
          get.set(ontologyGraphProjectionAtom, O.some(result));
        },
        applyGraphDeltaSucceeded: ({ result }) => {
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
      get.set(ontologyGraphErrorAtom, O.none());
      activeWorker.postMessage(command);
      get.set(ontologyGraphDeltaAtom, O.none());
    },
    { immediate: true }
  );

  get.addFinalizer(terminateWorker);
});

const cosmosProjectionFromOntology = (projection: OntologyGraphProjection): CosmosGraphProjection =>
  CosmosGraphProjection.make({
    nodeCount: projection.nodeCount,
    edgeCount: projection.edgeCount,
    nodeIds: projection.nodeIds,
    pointPositions: projection.pointPositions,
    links: projection.links,
  });

const renderRequestAtom = Atom.make((get) => ({
  container: get(ontologyGraphContainerAtom),
  projection: get(ontologyGraphProjectionAtom),
}));

/**
 * Side-effect atom that mounts and updates the cosmos viewport.
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
  let handle: O.Option<CosmosRenderHandle> = O.none();
  let renderToken = 0;

  get.subscribe(
    renderRequestAtom,
    ({ container, projection }) => {
      if (O.isNone(container) || O.isNone(projection)) {
        pipe(handle, O.match({ onNone: () => undefined, onSome: (mounted) => mounted.destroy() }));
        handle = O.none();
        get.set(ontologyGraphBackendAtom, O.none());
        return;
      }

      const cosmosProjection = cosmosProjectionFromOntology(projection.value);

      pipe(
        handle,
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
                handle = O.some(mounted);
                get.set(ontologyGraphBackendAtom, O.some(mounted.backend));
              },
              () => {
                if (token === renderToken) {
                  handle = O.none();
                  get.set(ontologyGraphBackendAtom, O.none());
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

  get.addFinalizer(() => {
    renderToken += 1;
    pipe(handle, O.match({ onNone: () => undefined, onSome: (mounted) => mounted.destroy() }));
  });
});

const noOpenSessionError = OntologyActionError.new("No ontology session is open.");

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
    const client = yield* OntologyClient;
    const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
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
    ctx.set(ontologySparqlResultAtom, O.some(result));
    ctx.set(ontologySparqlErrorAtom, O.none());
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
    const client = yield* OntologyClient;
    const opened = yield* Reactivity.mutation(client("OpenOntologyDocument", input), [SESSION_KEY, SOURCE_KEY]);
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
    const client = yield* OntologyClient;
    const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
    const saved = yield* Reactivity.mutation(client("SaveOntologyDocument", { path: input.path, session }), [
      SESSION_KEY,
      SOURCE_KEY,
    ]);
    ctx.set(ontologyPathAtom, O.some(saved.path));
    ctx.set(ontologySourceAtom, saved.source);
    ctx.set(ontologySavedChangeCountAtom, session.changeLog.length);
    ctx.set(ontologySavedChangeLogSignatureAtom, changeLogSignature(session.changeLog));
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
    const client = yield* OntologyClient;
    const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
    const preview = yield* Reactivity.mutation(client("PreviewOntologyTurtle", { session }), [SOURCE_KEY]);
    ctx.set(ontologySourceAtom, preview.source);
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
