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
import { LogRedactedCauseOptions, logRedactedCause, redactCauseForClient } from "@beep/observability";
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
  OntologyResourceSummary,
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
import { IRI } from "@beep/rdf/Iri";
import { makeLiteral, makeNamedNode, makeQuad, serializeQuad } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, O, P, Str } from "@beep/utils";
import { Cause, Duration, Effect, flow, Layer, Order, pipe, Result, Semaphore } from "effect";
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
import type { RpcClient } from "effect/unstable/rpc";

const $I = $OntologyClientId.create("aggregates/Session/Session.atoms");

/**
 * Default HTTP protocol used by browser and non-IPC desktop sessions.
 *
 * **Example** (Log default HTTP protocol)
 *
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
 * **Example** (Log protocol layer atom)
 *
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
 * **Example** (Log OntologyClient export)
 *
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

const ontologyBrowserRuntime = OntologyClient.runtime.factory(Layer.empty);

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
 * **Example** (Make open document input)
 *
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
 * **Example** (Make save document input)
 *
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
 * **Example** (Make batch operations input)
 *
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
 * **Example** (Make graph gesture input)
 *
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

/**
 * Inspector-facing resource read model re-exported through the client boundary.
 *
 * **Example** (Log inspector resource fields)
 *
 * ```ts
 * import { OntologyInspectorResource } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(OntologyInspectorResource.fields.iri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OntologyInspectorResource = OntologyResourceSummary;

/**
 * Runtime type for {@link OntologyInspectorResource}.
 *
 * **Example** (Read resource iri property)
 *
 * ```ts
 * import type { OntologyInspectorResource } from "@beep/ontology-client/aggregates/Session"
 *
 * const resourceIri = (resource: OntologyInspectorResource) => resource.iri
 * console.log(resourceIri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OntologyInspectorResource = typeof OntologyInspectorResource.Type;

/**
 * RDF object term variants supported by the inspector form.
 *
 * **Example** (Guard iri object kind)
 *
 * ```ts
 * import { OntologyInspectorObjectKind } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(OntologyInspectorObjectKind.is.iri("iri")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OntologyInspectorObjectKind = LiteralKit(["iri", "literal"]).pipe(
  $I.annoteSchema("OntologyInspectorObjectKind", {
    description: "RDF object term variants accepted by the ontology inspector.",
  })
);

/**
 * Runtime type for {@link OntologyInspectorObjectKind}.
 *
 * **Example** (Type literal object kind)
 *
 * ```ts
 * import type { OntologyInspectorObjectKind } from "@beep/ontology-client/aggregates/Session"
 *
 * const kind: OntologyInspectorObjectKind = "literal"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OntologyInspectorObjectKind = typeof OntologyInspectorObjectKind.Type;

/**
 * User intents emitted by inspector controls.
 *
 * **Example** (Guard addTriple action)
 *
 * ```ts
 * import { OntologyInspectorAction } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(OntologyInspectorAction.is.addTriple("addTriple")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OntologyInspectorAction = LiteralKit(["addTriple", "connect", "delete", "expand", "instantiate"]).pipe(
  $I.annoteSchema("OntologyInspectorAction", {
    description: "Exhaustive inspector intents converted into ontology commands by the client runtime.",
  })
);

/**
 * Runtime type for {@link OntologyInspectorAction}.
 *
 * **Example** (Type expand action value)
 *
 * ```ts
 * import type { OntologyInspectorAction } from "@beep/ontology-client/aggregates/Session"
 *
 * const action: OntologyInspectorAction = "expand"
 * console.log(action)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OntologyInspectorAction = typeof OntologyInspectorAction.Type;

/**
 * Validated display state for the inspector triple form.
 *
 * **Example** (Log form state fields)
 *
 * ```ts
 * import { OntologyInspectorFormState } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(OntologyInspectorFormState.fields.subject)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyInspectorFormState extends S.Class<OntologyInspectorFormState>($I`OntologyInspectorFormState`)(
  {
    object: S.String,
    objectKind: OntologyInspectorObjectKind,
    predicate: S.String,
    subject: S.String,
    objectValid: S.Boolean,
    predicateValid: S.Boolean,
    subjectValid: S.Boolean,
    canApplyTriple: S.Boolean,
    canApplyGraphGesture: S.Boolean,
    showObjectError: S.Boolean,
    showPredicateError: S.Boolean,
    showSubjectError: S.Boolean,
  },
  $I.annote("OntologyInspectorFormState", {
    description: "Inspector draft values and schema-derived validation flags rendered by the UI.",
  })
) {}

const OntologyValidationStatus = LiteralKit(["idle", "running", "blocked", "failed", "complete"]);
/**
 * Current lifecycle state for ontology validation workbench actions.
 *
 * **Example** (Type idle validation status)
 *
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
 * Workspace-relative path of the seeded tutorial document.
 *
 * **Details**
 *
 * The professional-desktop sidecar materializes the pizza tutorial at this
 * path on boot (never overwriting an existing file), so it is the one
 * document a fresh install is guaranteed to have. The Document toolbar's
 * path draft and the first-run auto-open bootstrap both derive from this
 * constant.
 *
 * **Example** (Log the seeded tutorial path)
 *
 * ```ts
 * import { ontologyWorkbenchSeedPath } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyWorkbenchSeedPath) // "tmp/ontology-workbench/pizza-tutorial.ttl"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ontologyWorkbenchSeedPath: OntologyFilePath = OntologyFilePath.fromUnknown(
  "tmp/ontology-workbench/pizza-tutorial.ttl"
);

/**
 * Derives the deterministic workbench session id for a document path.
 *
 * **Details**
 *
 * The Document toolbar's Open button and the first-run auto-open bootstrap
 * must mint the same id for the same path, so reopening a document resumes
 * one session identity instead of forking one per caller.
 *
 * **Example** (Derive a session id from the seed path)
 *
 * ```ts
 * import { ontologySessionIdForPath, ontologyWorkbenchSeedPath } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologySessionIdForPath(ontologyWorkbenchSeedPath)) // "ontology:tmp/ontology-workbench/pizza-tutorial.ttl"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const ontologySessionIdForPath = (path: OntologyFilePath): SessionId =>
  SessionId.fromUnknown(`ontology:${path}`);

/**
 * Workspace-relative path entered in the ontology document toolbar.
 *
 * **Gotchas**
 *
 * Deliberately NOT `workbenchState`/keep-alive, matching its
 * behavior before relocation from the UI file: this is a form draft, not
 * session truth (`ontologyPathAtom` holds the open document's path), so it
 * may reset to the seed default after the idle TTL when the workbench
 * unmounts. The M3 dock shell keeps panels alive, which retires the
 * unmount-reset path; revisit lifetimes then if the draft should survive
 * a panel close.
 *
 * **Example** (Log open path input)
 *
 * ```ts
 * import { openPathInputAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(openPathInputAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const openPathInputAtom = Atom.make<string>(ontologyWorkbenchSeedPath);

/**
 * Subject IRI entered in the ontology Add Triple form.
 *
 * **Example** (Log subject input atom)
 *
 * ```ts
 * import { subjectInputAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(subjectInputAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const subjectInputAtom = Atom.make("https://example.org/pizza#Pizza");

/**
 * Predicate IRI entered in the ontology Add Triple form.
 *
 * **Example** (Log predicate input atom)
 *
 * ```ts
 * import { predicateInputAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(predicateInputAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const predicateInputAtom = Atom.make("http://www.w3.org/2000/01/rdf-schema#label");

/**
 * Object value entered in the ontology Add Triple form.
 *
 * **Example** (Log object input atom)
 *
 * ```ts
 * import { objectInputAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(objectInputAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const objectInputAtom = Atom.make("Pizza");

/**
 * Inspector draft fields whose writes are owned by runtime actions.
 *
 * **Example** (Guard subject input field)
 *
 * ```ts
 * import { OntologyInspectorInputField } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(OntologyInspectorInputField.is.subject("subject")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OntologyInspectorInputField = LiteralKit(["subject", "predicate", "object"]).pipe(
  $I.annoteSchema("OntologyInspectorInputField", {
    description: "Inspector draft fields updated by the ontology client runtime.",
  })
);

/**
 * Runtime type for {@link OntologyInspectorInputField}.
 *
 * **Example** (Type predicate input field)
 *
 * ```ts
 * import type { OntologyInspectorInputField } from "@beep/ontology-client/aggregates/Session"
 *
 * const field: OntologyInspectorInputField = "predicate"
 * console.log(field)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OntologyInspectorInputField = typeof OntologyInspectorInputField.Type;

/**
 * Object term kind selected in the ontology Add Triple form.
 *
 * **Example** (Log object kind atom)
 *
 * ```ts
 * import { objectKindAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(objectKindAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const objectKindAtom = Atom.make<OntologyInspectorObjectKind>("literal");

const decodeOntologyInspectorIri = flow(Str.trim, S.decodeUnknownOption(IRI));

/**
 * Schema-derived inspector form values and validation flags.
 *
 * **Example** (Log form state atom)
 *
 * ```ts
 * import { ontologyInspectorFormStateAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyInspectorFormStateAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyInspectorFormStateAtom = Atom.make((get) => {
  const object = get(objectInputAtom);
  const objectKind = get(objectKindAtom);
  const predicate = get(predicateInputAtom);
  const subject = get(subjectInputAtom);
  const subjectValid = O.isSome(decodeOntologyInspectorIri(subject));
  const predicateValid = O.isSome(decodeOntologyInspectorIri(predicate));
  const showSubjectError = Str.isNonEmpty(Str.trim(subject)) && !subjectValid;
  const showPredicateError = Str.isNonEmpty(Str.trim(predicate)) && !predicateValid;
  const objectValid = OntologyInspectorObjectKind.$match(objectKind, {
    iri: () => O.isSome(decodeOntologyInspectorIri(object)),
    literal: () => Str.isNonEmpty(Str.trim(object)),
  });
  const showObjectError =
    OntologyInspectorObjectKind.is.iri(objectKind) && Str.isNonEmpty(Str.trim(object)) && !objectValid;
  const canApplyTriple = O.isSome(get(ontologySessionAtom)) && subjectValid && predicateValid && objectValid;

  return OntologyInspectorFormState.make({
    object,
    objectKind,
    predicate,
    subject,
    objectValid,
    predicateValid,
    subjectValid,
    canApplyTriple,
    canApplyGraphGesture: canApplyTriple && OntologyInspectorObjectKind.is.iri(objectKind),
    showObjectError,
    showPredicateError,
    showSubjectError,
  });
});

/**
 * Runtime action family for inspector text-field updates.
 *
 * **Example** (Select subject input setter)
 *
 * ```ts
 * import { setOntologyInspectorInputAtoms } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(setOntologyInspectorInputAtoms("subject"))
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const setOntologyInspectorInputAtoms = Atom.family((field: OntologyInspectorInputField) =>
  ontologyBrowserRuntime.fn<string>()(
    Effect.fnUntraced(function* (value, ctx) {
      OntologyInspectorInputField.$match(field, {
        object: () => ctx.set(objectInputAtom, value),
        predicate: () => ctx.set(predicateInputAtom, value),
        subject: () => ctx.set(subjectInputAtom, value),
      });
    })
  )
);

const decodeOntologyInspectorObjectKind = S.decodeUnknownOption(OntologyInspectorObjectKind);

/**
 * Runtime setter that accepts a DOM select value and retains only supported
 * inspector object kinds.
 *
 * **Example** (Log object kind setter)
 *
 * ```ts
 * import { setOntologyInspectorObjectKindAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(setOntologyInspectorObjectKindAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const setOntologyInspectorObjectKindAtom = ontologyBrowserRuntime.fn<string>()(
  Effect.fnUntraced(function* (value, ctx) {
    O.match(decodeOntologyInspectorObjectKind(value), {
      onNone: () => undefined,
      onSome: (kind) => ctx.set(objectKindAtom, kind),
    });
  })
);

/**
 * Current open ontology session, if any.
 *
 * **Example** (Log session atom)
 *
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
 * **Example** (Log path atom)
 *
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
 * **Example** (Log source atom)
 *
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
 * **Example** (Log saved change count)
 *
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
 * **Example** (Log change log signature)
 *
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
 * **Example** (Log redo stack atom)
 *
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
 * **Example** (Log view mode atom)
 *
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
 * **Example** (Log fold level atom)
 *
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
 * **Example** (Log inferred view atom)
 *
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
 * **Example** (Log inference result atom)
 *
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
 * **Example** (Log inference error atom)
 *
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
const isOntologyActionError = S.is(OntologyActionError);

const actionFailureMessage = (label: string, cause: Cause.Cause<unknown>): string =>
  pipe(
    Cause.findErrorOption(cause),
    O.filter(isOntologyActionError),
    O.map((error) => error.message),
    O.filter(Str.isNonEmpty),
    O.getOrElse(() => `${label} failed. ${redactCauseForClient(cause).message}`)
  );

const reportFailure = Effect.fnUntraced(function* (label: string, cause: Cause.Cause<unknown>) {
  yield* logRedactedCause(
    cause,
    LogRedactedCauseOptions.make({
      message: `${label} failed`,
      level: "Error",
      attributes: {
        "ontology.action": label,
        subsystem: "ontology_client",
      },
    })
  );
});

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
 * **Example** (Log SPARQL profile atom)
 *
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
 * **Example** (Log SPARQL query atom)
 *
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
 * **Example** (Log SPARQL examples atom)
 *
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
 * **Example** (Log SPARQL result atom)
 *
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
 * **Example** (Log SPARQL error atom)
 *
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
 * **Details**
 *
 * Document operations are the workbench's entry gate: with nowhere to render
 * their failures, a rejected path or an unreadable file made Open look like a
 * dead button, and a failed Save left the "Saved" badge asserting a write that
 * never landed.
 *
 * **Example** (Log document error atom)
 *
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
 * **Example** (Log validation result atom)
 *
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
 * **Example** (Log validation status atom)
 *
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
 * **Example** (Log validation error atom)
 *
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
 * **Example** (Log provenance export atom)
 *
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
 * **Example** (Log search query atom)
 *
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
 * **Example** (Log selected resource IRI)
 *
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
 * Supported ontology graph renderers.
 *
 * **Example** (Guard cosmos renderer kind)
 *
 * ```ts
 * import { OntologyGraphRenderer } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(OntologyGraphRenderer.is.cosmos("cosmos")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OntologyGraphRenderer = LiteralKit(["cosmos", "graph3d"]).pipe(
  $I.annoteSchema("OntologyGraphRenderer", {
    description: "Graph renderer selected by the ontology workbench.",
  })
);

/**
 * Runtime type for {@link OntologyGraphRenderer}.
 *
 * **Example** (Type graph3d renderer)
 *
 * ```ts
 * import type { OntologyGraphRenderer } from "@beep/ontology-client/aggregates/Session"
 *
 * const renderer: OntologyGraphRenderer = "graph3d"
 * console.log(renderer)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OntologyGraphRenderer = typeof OntologyGraphRenderer.Type;

/**
 * Workbench toggle selecting the 2D cosmos or 3D graph renderer.
 *
 * **Example** (Log graph renderer atom)
 *
 * ```ts
 * import { ontologyGraphRendererAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyGraphRendererAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyGraphRendererAtom = Atom.make<OntologyGraphRenderer>("cosmos");

/**
 * Runtime action that maps the graph toggle to its renderer state.
 *
 * **Example** (Log renderer setter atom)
 *
 * ```ts
 * import { setOntologyGraphRendererAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(setOntologyGraphRendererAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const setOntologyGraphRendererAtom = ontologyBrowserRuntime.fn<boolean>()(
  Effect.fnUntraced(function* (enabled, ctx) {
    ctx.set(ontologyGraphRendererAtom, enabled ? "graph3d" : "cosmos");
  })
);

/**
 * Latest worker graph projection, if one has completed.
 *
 * **Example** (Log graph projection atom)
 *
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
 * **Example** (Log graph delta atom)
 *
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
 * **Example** (Log graph container atom)
 *
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

const ontologyGraphContainerElementAtom = Atom.make<O.Option<HTMLElement>>(O.none());

/**
 * Runtime action used as the graph container's React callback ref.
 *
 * **Example** (Bind container callback ref)
 *
 * ```tsx
 * import { setOntologyGraphContainerElementAtom } from "@beep/ontology-client/aggregates/Session"
 * import { useAtomSet } from "@effect/atom-react"
 *
 * const setContainer = useAtomSet(setOntologyGraphContainerElementAtom)
 * console.log(typeof setContainer)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const setOntologyGraphContainerElementAtom = ontologyBrowserRuntime.fn<HTMLElement | null>()(
  Effect.fnUntraced(function* (element, ctx) {
    ctx.set(ontologyGraphContainerElementAtom, O.fromNullishOr(element));
  })
);

/**
 * Mounted lifecycle that publishes a measurable graph container and releases
 * its `ResizeObserver` when the element changes or the graph UI unmounts.
 *
 * **Example** (Mount container binding atom)
 *
 * ```tsx
 * import { ontologyGraphContainerBindingAtom } from "@beep/ontology-client/aggregates/Session"
 * import { useAtomMount } from "@effect/atom-react"
 *
 * useAtomMount(ontologyGraphContainerBindingAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyGraphContainerBindingAtom = ontologyBrowserRuntime.atom((get) =>
  O.match(get(ontologyGraphContainerElementAtom), {
    onNone: () => Effect.sync(() => get.set(ontologyGraphContainerAtom, O.none())),
    onSome: (element) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const publishIfReady = (): boolean => {
            if (element.clientWidth <= 0 || element.clientHeight <= 0) return false;
            get.set(ontologyGraphContainerAtom, O.some(element));
            return true;
          };
          if (publishIfReady()) return O.none<ResizeObserver>();

          const observer = new ResizeObserver(() => {
            if (publishIfReady()) observer.disconnect();
          });
          observer.observe(element);
          return O.some(observer);
        }),
        (observer) =>
          Effect.sync(() => {
            O.getOrUndefined(observer)?.disconnect();
            get.set(ontologyGraphContainerAtom, O.none());
          })
      ),
  })
);

/**
 * Current visualizer backend selected by capability detection.
 *
 * **Example** (Log graph backend atom)
 *
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
 * **Example** (Log graph error atom)
 *
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
 * **Example** (Create empty snapshot)
 *
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
 * **Example** (Log snapshot atom)
 *
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
 * **Example** (Log dirty flag atom)
 *
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
 * **Example** (Log search results atom)
 *
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
 * **Example** (Log selected resource atom)
 *
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
 * **Example** (Log visible resources atom)
 *
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
 * **Example** (Log projection options atom)
 *
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
 * **Example** (Log predicate suggestions)
 *
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

const GRAPH_WORKER_UNAVAILABLE_MESSAGE = "Graph projection is unavailable: this environment has no web worker.";

const GRAPH_WORKER_UNREADABLE_RESULT_MESSAGE = "The graph worker returned a result this app could not read.";

const GRAPH_WORKER_MESSAGE_ERROR = "Ontology graph worker message failed to deserialize.";

const GRAPH_WORKER_TIMEOUT_MESSAGE = "The graph worker did not respond. The diagram could not be drawn.";

/**
 * Failure raised when ontology graph projection exceeds the worker response deadline.
 *
 * **Example** (Construct the timeout failure surfaced to the session)
 *
 * ```ts
 * import { OntologyGraphWorkerTimeoutError } from "@beep/ontology-client/aggregates/Session"
 *
 * const failure = OntologyGraphWorkerTimeoutError.make({ message: "The graph worker did not respond." })
 * console.log(failure._tag) // "OntologyGraphWorkerTimeoutError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OntologyGraphWorkerTimeoutError extends S.TaggedError<OntologyGraphWorkerTimeoutError>(
  $I`OntologyGraphWorkerTimeoutError`
)(
  "OntologyGraphWorkerTimeoutError",
  {
    message: S.NonEmptyString,
  },
  $I.annoteError<OntologyGraphWorkerTimeoutError>("OntologyGraphWorkerTimeoutError", {
    description: "The ontology graph projection worker exceeded its response deadline.",
  })
) {}

/**
 * How long a projection may take before the worker is treated as dead.
 *
 * There was no watchdog at all, and a worker that simply never answers is the one
 * failure the error handlers cannot see: `error` and `messageerror` never fire, so
 * the workbench sat on "pending" forever with nothing to explain it. That is the
 * shape this very bug took. A silence this long is a failure, and it now says so.
 */
const GRAPH_WORKER_TIMEOUT = Duration.seconds(20);

type GraphWorkerWatchdog = () => void;
type GraphWorkerFailure = readonly [cause: unknown, clientMessage: O.Option<string>];
type GraphWorkerBoundary = readonly [run: () => void, onFailure: (cause: unknown) => void];
type GraphWorkerRequest<A> = readonly [sequence: number, request: O.Option<A>];

const graphWorkerWatchdogRequestAtom = Atom.make<GraphWorkerRequest<GraphWorkerWatchdog>>([0, O.none()]);
const graphWorkerFailureRequestAtom = Atom.make<GraphWorkerRequest<GraphWorkerFailure>>([0, O.none()]);
const graphWorkerBoundaryRequestAtom = Atom.make<GraphWorkerRequest<GraphWorkerBoundary>>([0, O.none()]);

const ontologyGraphWorkerWatchdogAtom = ontologyBrowserRuntime.atom((get) =>
  O.match(get(graphWorkerWatchdogRequestAtom)[1], {
    onNone: () => Effect.void,
    onSome: (onTimeout) => Effect.sleep(GRAPH_WORKER_TIMEOUT).pipe(Effect.andThen(Effect.sync(onTimeout))),
  })
);

const reportGraphWorkerFailureAtom = ontologyBrowserRuntime.atom((get) =>
  O.match(get(graphWorkerFailureRequestAtom)[1], {
    onNone: () => Effect.void,
    onSome: ([cause, clientMessage]) =>
      Effect.sync(() =>
        get.set(
          ontologyGraphErrorAtom,
          O.some(
            O.getOrElse(clientMessage, () => `The ontology graph worker failed: ${redactCauseForClient(cause).message}`)
          )
        )
      ).pipe(
        Effect.andThen(
          logRedactedCause(
            cause,
            LogRedactedCauseOptions.make({
              message: "ontology graph worker failed",
              level: "Error",
              attributes: {
                subsystem: "ontology_graph_worker",
              },
            })
          )
        )
      ),
  })
);

const runGraphWorkerBoundaryAtom = ontologyBrowserRuntime.atom((get) =>
  O.match(get(graphWorkerBoundaryRequestAtom)[1], {
    onNone: () => Effect.void,
    onSome: ([run, onFailure]) =>
      Effect.sync(() =>
        Result.try({
          try: run,
          catch: (cause) => cause,
        })
      ).pipe(
        Effect.flatMap(
          Result.match({
            onFailure: (cause) => Effect.sync(() => onFailure(cause)),
            onSuccess: () => Effect.void,
          })
        )
      ),
  })
);

/**
 * Side-effect atom that owns the visualizer projection worker.
 *
 * **Example** (Log worker bridge atom)
 *
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
  get.mount(ontologyGraphWorkerWatchdogAtom);
  get.mount(reportGraphWorkerFailureAtom);
  get.mount(runGraphWorkerBoundaryAtom);

  const disarmWatchdog = (): void => {
    get.set(graphWorkerWatchdogRequestAtom, [get.registry.get(graphWorkerWatchdogRequestAtom)[0] + 1, O.none()]);
  };

  // Armed on every request, disarmed by any answer. A worker that never replies
  // fires neither `error` nor `messageerror`, so without this the graph waits
  // forever and says nothing — which is precisely how this bug hid.
  const armWatchdog = (): void => {
    disarmWatchdog();
    get.set(graphWorkerWatchdogRequestAtom, [
      get.registry.get(graphWorkerWatchdogRequestAtom)[0] + 1,
      O.some(() =>
        failWorkerCause(
          OntologyGraphWorkerTimeoutError.make({ message: GRAPH_WORKER_TIMEOUT_MESSAGE }),
          O.some(GRAPH_WORKER_TIMEOUT_MESSAGE)
        )
      ),
    ]);
  };

  const terminateWorker = (): void => {
    pipe(worker, O.match({ onNone: () => undefined, onSome: (currentWorker) => currentWorker.terminate() }));
    worker = O.none();
  };

  const resetFailedWorker = (): void => {
    disarmWatchdog();
    previousProjection = O.none();
    get.set(ontologyGraphProjectionAtom, O.none());
    get.set(ontologyGraphDeltaAtom, O.none());
    get.set(ontologyGraphBackendAtom, O.none());
    terminateWorker();
    requeueLastProjectionRequest();
  };

  const failWorkerCause = (cause: unknown, clientMessage: O.Option<string> = O.none()): void => {
    resetFailedWorker();
    get.set(graphWorkerFailureRequestAtom, [
      get.registry.get(graphWorkerFailureRequestAtom)[0] + 1,
      O.some<GraphWorkerFailure>([cause, clientMessage]),
    ]);
  };

  const makeWorker = (): Worker => {
    // Keep the global constructor literal at the bundler boundary. Vite only
    // recognizes this exact shape as a module-worker entry; constructing through
    // the captured alias turns the TypeScript source into a `data:` asset, which
    // a restrictive packaged CSP correctly rejects.
    const nextWorker = new Worker(new URL("./Session.visualizer.worker.ts", import.meta.url), { type: "module" });
    nextWorker.addEventListener("message", (event: MessageEvent<unknown>) => {
      // The worker posts the ENCODED result: a structured clone drops prototypes,
      // so what arrives is plain data until it is decoded back into the domain.
      disarmWatchdog();
      const received = decodeWorkerResult(event.data);
      if (!Result.isSuccess(received)) {
        failWorkerCause(received.failure, O.some(GRAPH_WORKER_UNREADABLE_RESULT_MESSAGE));
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
      failWorkerCause(
        pipe(
          O.fromNullishOr(event.error),
          O.getOrElse(() => event.message)
        )
      );
    });
    nextWorker.addEventListener("messageerror", (event) => {
      failWorkerCause(event, O.some(GRAPH_WORKER_MESSAGE_ERROR));
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

  const dispatchWorkerCommand = (command: WorkerCommand): void => {
    get.set(graphWorkerBoundaryRequestAtom, [
      get.registry.get(graphWorkerBoundaryRequestAtom)[0] + 1,
      O.some<GraphWorkerBoundary>([() => currentWorker().postMessage(encodeWorkerCommand(command)), failWorkerCause]),
    ]);
  };

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
          dispatchWorkerCommand(command);
        },
      })
    );
  };

  get.subscribe(
    graphRequestAtom,
    ({ snapshot, options, delta }) => {
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
      dispatchWorkerCommand(command);
      get.set(ontologyGraphDeltaAtom, O.none());
    },
    { immediate: true }
  );

  get.addFinalizer(() => {
    disarmWatchdog();
    get.set(graphWorkerBoundaryRequestAtom, [get.registry.get(graphWorkerBoundaryRequestAtom)[0] + 1, O.none()]);
    get.set(graphWorkerFailureRequestAtom, [get.registry.get(graphWorkerFailureRequestAtom)[0] + 1, O.none()]);
    terminateWorker();
  });
});

/**
 * Maps the worker's ontology projection onto the renderer's projection.
 *
 * **Example** (Inspect cosmos projection mapper)
 *
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

const graphBetweennessExactNodeLimit = 1_500;
const graphBetweennessSampleSourceLimit = 512;

const graphBetweennessCentrality = (
  nodeCount: number,
  adjacency: ReadonlyArray<ReadonlyArray<number>>
): Float32Array<ArrayBuffer> => {
  const centrality = new Float64Array(nodeCount);
  const sourceStride =
    nodeCount > graphBetweennessExactNodeLimit ? Math.ceil(nodeCount / graphBetweennessSampleSourceLimit) : 1;
  let source = 0;

  while (source < nodeCount) {
    const [predecessors, pathCounts, stack] = graphShortestPathsFromSource(source, nodeCount, adjacency);
    accumulateGraphDependencies(source, nodeCount, predecessors, pathCounts, stack, centrality);
    source += sourceStride;
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
      // Uint16 holds 0..65_535, so the ordinal wrap is modulo 65_536.
      ordinalByCommunity[community] = distinctCount % 65_536;
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
  readonly [OntologyGraphProjection, Float32Array<ArrayBuffer>, Uint16Array<ArrayBuffer>, Float32Array<ArrayBuffer>]
> = O.none();

const graph3dProjectionChannels = (
  projection: OntologyGraphProjection
): readonly [Float32Array<ArrayBuffer>, Uint16Array<ArrayBuffer>, Float32Array<ArrayBuffer>] =>
  pipe(
    graph3dProjectionChannelCache,
    O.filter(([cachedProjection]) => cachedProjection === projection),
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

        graph3dProjectionChannelCache = O.some([projection, nodeImportance, nodeCommunities, edgeWeights]);
        return [nodeImportance, nodeCommunities, edgeWeights];
      },
      onSome: ([, nodeImportance, nodeCommunities, edgeWeights]) => [nodeImportance, nodeCommunities, edgeWeights],
    })
  );

/**
 * Maps an ontology worker projection into the deterministic 3D renderer contract.
 *
 * **Example** (Inspect 3D projection mapper)
 *
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
  `The graph could not be drawn: ${redactCauseForClient(cause).message}`;

const reportGraphRenderFailure = Effect.fn("ontology.graph.report_render_failure")(function* (cause: unknown) {
  yield* logRedactedCause(
    cause,
    LogRedactedCauseOptions.make({
      message: "ontology graph renderer failed",
      level: "Error",
      attributes: {
        subsystem: "ontology_graph",
      },
    })
  );
});

const cosmosGraphRenderHandleAtom = Atom.make<O.Option<CosmosRenderHandle>>(O.none());
const graph3dGraphRenderHandleAtom = Atom.make<O.Option<Graph3DRenderHandle>>(O.none());
const graph3dOntologyProjectionAtom = Atom.make<O.Option<OntologyGraphProjection>>(O.none());
const activeGraphRendererAtom = Atom.make<Atom.Type<typeof ontologyGraphRendererAtom>>("cosmos");

const reportGraphRuntimeFailureAtom = ontologyBrowserRuntime.fn<unknown>()(
  Effect.fnUntraced(function* (cause, ctx) {
    ctx.set(ontologyGraphErrorAtom, O.some(graphRenderFailureMessage(cause)));
    yield* reportGraphRenderFailure(cause);
  })
);

const selectedGraphNodeIndex = (
  projection: OntologyGraphProjection,
  selectedIri: O.Option<string>
): number | undefined =>
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

const destroyOntologyGraphRenderers = Effect.fnUntraced(function* (ctx: Atom.FnContext) {
  yield* Effect.sync(() => {
    pipe(
      ctx.registry.get(cosmosGraphRenderHandleAtom),
      O.match({ onNone: () => undefined, onSome: (mounted) => mounted.destroy() })
    );
    pipe(
      ctx.registry.get(graph3dGraphRenderHandleAtom),
      O.match({ onNone: () => undefined, onSome: (mounted) => mounted.destroy() })
    );
  });
  ctx.set(cosmosGraphRenderHandleAtom, O.none());
  ctx.set(graph3dGraphRenderHandleAtom, O.none());
  ctx.set(graph3dOntologyProjectionAtom, O.none());
});

const applyOntologyGraphRenderRequestAtom = ontologyBrowserRuntime.fn<Atom.Type<typeof renderRequestAtom>>()(
  Effect.fn("ontology.graph.apply_render_request")(function* (request, ctx) {
    if (request.renderer !== ctx.registry.get(activeGraphRendererAtom)) {
      yield* destroyOntologyGraphRenderers(ctx);
      ctx.set(activeGraphRendererAtom, request.renderer);
    }

    if (O.isNone(request.container) || O.isNone(request.projection)) {
      yield* destroyOntologyGraphRenderers(ctx);
      ctx.set(ontologyGraphBackendAtom, O.none());
      return;
    }

    // A fresh attempt clears the last failure, so a recovered graph stops
    // claiming to be broken.
    ctx.set(ontologyGraphErrorAtom, O.none());
    const container = request.container.value;
    const projection = request.projection.value;

    if (request.renderer === "graph3d") {
      ctx.set(ontologyGraphBackendAtom, O.none());
      const ontologyProjection = projection;
      const graph3dProjection = graph3dProjectionFromOntology(ontologyProjection);
      ctx.set(graph3dOntologyProjectionAtom, O.some(ontologyProjection));

      yield* O.match(ctx.registry.get(graph3dGraphRenderHandleAtom), {
        onNone: () => {
          const options = Graph3DRenderOptions.make({
            onNodeSelect: (nodeIndex: number | undefined) => {
              ctx.set(
                selectedOntologyResourceIriAtom,
                pipe(
                  ctx.registry.get(graph3dOntologyProjectionAtom),
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
              ctx.registry.set(reportGraphRuntimeFailureAtom, error);
            },
          });

          return pipe(
            renderGraph3D(container, graph3dProjection, options),
            Effect.matchCauseEffect({
              onFailure: (cause) =>
                Cause.hasInterruptsOnly(cause)
                  ? Effect.interrupt
                  : Effect.gen(function* () {
                      if (ctx.registry.get(renderRequestAtom) !== request) return;
                      ctx.set(graph3dGraphRenderHandleAtom, O.none());
                      ctx.set(graph3dOntologyProjectionAtom, O.none());
                      ctx.set(ontologyGraphBackendAtom, O.none());
                      const failure = Cause.squash(cause);
                      ctx.set(ontologyGraphErrorAtom, O.some(graphRenderFailureMessage(failure)));
                      yield* reportGraphRenderFailure(cause);
                    }),
              onSuccess: (mounted) =>
                Effect.sync(() => {
                  if (ctx.registry.get(renderRequestAtom) !== request) {
                    mounted.destroy();
                    return;
                  }
                  ctx.set(graph3dGraphRenderHandleAtom, O.some(mounted));
                  mounted.select(
                    selectedGraphNodeIndex(ontologyProjection, ctx.registry.get(selectedOntologyResourceIriAtom))
                  );
                }),
            })
          );
        },
        onSome: (mounted) =>
          Effect.sync(() => {
            mounted.update(graph3dProjection);
            mounted.select(
              selectedGraphNodeIndex(ontologyProjection, ctx.registry.get(selectedOntologyResourceIriAtom))
            );
          }),
      });
      return;
    }

    const cosmosProjection = cosmosProjectionFromOntology(projection);
    yield* O.match(ctx.registry.get(cosmosGraphRenderHandleAtom), {
      onNone: () =>
        pipe(
          renderCosmosGraph(container, cosmosProjection),
          Effect.matchCauseEffect({
            onFailure: (cause) =>
              Cause.hasInterruptsOnly(cause)
                ? Effect.interrupt
                : Effect.gen(function* () {
                    if (ctx.registry.get(renderRequestAtom) !== request) return;
                    ctx.set(cosmosGraphRenderHandleAtom, O.none());
                    ctx.set(ontologyGraphBackendAtom, O.none());
                    const failure = Cause.squash(cause);
                    ctx.set(ontologyGraphErrorAtom, O.some(graphRenderFailureMessage(failure)));
                    yield* reportGraphRenderFailure(cause);
                  }),
            onSuccess: (mounted) =>
              Effect.sync(() => {
                if (ctx.registry.get(renderRequestAtom) !== request) {
                  mounted.destroy();
                  return;
                }
                ctx.set(cosmosGraphRenderHandleAtom, O.some(mounted));
                ctx.set(ontologyGraphBackendAtom, O.some(mounted.backend));
              }),
          })
        ),
      onSome: (mounted) => Effect.sync(() => mounted.update(cosmosProjection)),
    });
  })
);

const disposeOntologyGraphRenderersAtom = ontologyBrowserRuntime.fn<void>()(
  Effect.fnUntraced(function* (_, ctx) {
    yield* destroyOntologyGraphRenderers(ctx);
    ctx.set(ontologyGraphBackendAtom, O.none());
  })
);

/**
 * Side-effect atom that mounts and updates the selected graph viewport.
 *
 * **Example** (Log render bridge atom)
 *
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
  get.mount(cosmosGraphRenderHandleAtom);
  get.mount(graph3dGraphRenderHandleAtom);
  get.mount(graph3dOntologyProjectionAtom);
  get.mount(activeGraphRendererAtom);
  get.mount(applyOntologyGraphRenderRequestAtom);
  get.mount(disposeOntologyGraphRenderersAtom);
  get.mount(reportGraphRuntimeFailureAtom);

  get.subscribe(renderRequestAtom, (request) => get.set(applyOntologyGraphRenderRequestAtom, request), {
    immediate: true,
  });

  get.subscribe(
    selectedOntologyResourceIriAtom,
    (selectedIri) => {
      pipe(
        get.registry.get(graph3dGraphRenderHandleAtom),
        O.match({
          onNone: () => undefined,
          onSome: (mounted) =>
            mounted.select(
              pipe(
                get.registry.get(graph3dOntologyProjectionAtom),
                O.map((projection) => selectedGraphNodeIndex(projection, selectedIri)),
                O.getOrUndefined
              )
            ),
        })
      );
    },
    { immediate: true }
  );

  get.addFinalizer(() => {
    get.set(applyOntologyGraphRenderRequestAtom, Atom.Interrupt);
    get.set(disposeOntologyGraphRenderersAtom, undefined);
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
 * **Example** (Log inferred view toggle)
 *
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
 * **Example** (Log SPARQL example applier)
 *
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
 * **Example** (Log SPARQL runner atom)
 *
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
      Effect.catchCause(
        Effect.fnUntraced(function* (cause) {
          yield* reportFailure("SPARQL", cause);
          ctx.set(ontologySparqlErrorAtom, O.some(actionFailureMessage("The query", cause)));
        })
      )
    );
  })
);

/**
 * Run SHACL validation over asserted and inferred graphs.
 *
 * **Example** (Log validation runner atom)
 *
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
      Effect.catchCause(
        Effect.fnUntraced(function* (cause) {
          yield* reportFailure("Validation", cause);
          setValidationFailure(ctx, "Validation", cause);
        })
      )
    );
  })
);

/**
 * Apply one verified SHACL repair through the standard batch change pipeline.
 *
 * **Example** (Log repair applier atom)
 *
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
        Effect.catchCause(
          Effect.fnUntraced(function* (cause) {
            ctx.set(ontologyValidationStatusAtom, "failed");
            yield* reportFailure("Validation", cause);
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
 * **Example** (Log provenance exporter atom)
 *
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
      Effect.catchCause(
        Effect.fnUntraced(function* (cause) {
          yield* reportFailure("Export", cause);
          setValidationFailure(ctx, "Export", cause);
        })
      )
    );
  })
);

/**
 * Open a Turtle document through the sidecar.
 *
 * **Example** (Log open document atom)
 *
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
        Effect.catchCause(
          Effect.fnUntraced(function* (cause) {
            yield* reportFailure("Ontology document", cause);
            ctx.set(ontologyDocumentErrorAtom, O.some(actionFailureMessage("The document", cause)));
          })
        )
      );
  })
);

// Keep-alive so one attempt spans the whole app session: panel remounts read
// the flag instead of re-opening a document the user closed or replaced.
const ontologyAutoOpenAttemptedAtom = workbenchState(false);

/**
 * First-run bootstrap that opens the seeded tutorial document once.
 *
 * **Details**
 *
 * The sidecar seeds {@link ontologyWorkbenchSeedPath} on boot, but nothing
 * ever dispatched {@link openOntologyDocumentAtom}, so a fresh install showed
 * "No ontology file open" panels beside a Document toolbar pre-filled with
 * the tutorial path. The Document region mounts this atom; on the first mount
 * of an app session with no document open it dispatches the open action for
 * the seed path. The keep-alive attempt flag makes it one attempt per app
 * session: a document the user opened — or later closes — is never
 * overridden, and a failed attempt is not retried. Failure follows the open
 * action's established path: typed error logged, document error strip set,
 * no crash.
 *
 * **Gotchas**
 *
 * The desktop app mounts every ontology region behind its desktop-session
 * gate, so a chat-only browser session never mounts this atom and keeps its
 * "needs desktop session" empty state.
 *
 * **Example** (Log auto-open bootstrap atom)
 *
 * ```ts
 * import { ontologyWorkbenchAutoOpenAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(ontologyWorkbenchAutoOpenAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const ontologyWorkbenchAutoOpenAtom = Atom.make((get): void => {
  // `once`, not `get`: this is a one-shot — subscribing to session/path would
  // recompute the bootstrap on every open, close, and edit.
  if (get.once(ontologyAutoOpenAttemptedAtom)) {
    return;
  }
  get.set(ontologyAutoOpenAttemptedAtom, true);
  if (O.isSome(get.once(ontologySessionAtom)) || O.isSome(get.once(ontologyPathAtom))) {
    return;
  }
  get.set(
    openOntologyDocumentAtom,
    OpenOntologyDocumentInput.make({
      sessionId: ontologySessionIdForPath(ontologyWorkbenchSeedPath),
      path: ontologyWorkbenchSeedPath,
    })
  );
}).pipe(Atom.keepAlive);

/**
 * Save the current ontology session through the sidecar.
 *
 * **Example** (Log save document atom)
 *
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
        Effect.catchCause(
          Effect.fnUntraced(function* (cause) {
            yield* reportFailure("Ontology document", cause);
            ctx.set(ontologyDocumentErrorAtom, O.some(actionFailureMessage("The document", cause)));
          })
        )
      );
  })
);

/**
 * Refresh the Turtle source view from the current session without saving.
 *
 * **Example** (Log turtle preview atom)
 *
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
      Effect.catchCause(
        Effect.fnUntraced(function* (cause) {
          yield* reportFailure("Ontology document", cause);
          ctx.set(ontologyDocumentErrorAtom, O.some(actionFailureMessage("The document", cause)));
        })
      )
    );
  })
);

/**
 * Apply typed ontology changes through the sidecar batch endpoint.
 *
 * **Example** (Log batch applier atom)
 *
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
 * **Example** (Log gesture applier atom)
 *
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
 * Converts one inspector UI intent into schema-owned batch or graph-gesture
 * input after normalizing and validating the current draft.
 *
 * **Example** (Log inspector action atom)
 *
 * ```ts
 * import { applyOntologyInspectorActionAtom } from "@beep/ontology-client/aggregates/Session"
 *
 * console.log(applyOntologyInspectorActionAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const applyOntologyInspectorActionAtom = OntologyClient.runtime.fn<OntologyInspectorAction>()(
  Effect.fn("applyOntologyInspectorAction")(function* (action, ctx) {
    const form = ctx(ontologyInspectorFormStateAtom);
    const permitted = OntologyInspectorAction.$match(action, {
      addTriple: () => form.canApplyTriple,
      connect: () => form.canApplyGraphGesture,
      delete: () => form.canApplyGraphGesture,
      expand: () => form.canApplyGraphGesture,
      instantiate: () => form.canApplyGraphGesture,
    });
    if (!permitted) return;

    const subjectIri = decodeOntologyInspectorIri(form.subject);
    const predicateIri = decodeOntologyInspectorIri(form.predicate);
    const objectIri = decodeOntologyInspectorIri(form.object);

    const applyEdgeGesture = Effect.fnUntraced(function* (kind: "connect" | "delete" | "expand") {
      yield* O.match(O.all({ sourceIri: subjectIri, predicateIri, targetIri: objectIri }), {
        onNone: () => Effect.void,
        onSome: ({ sourceIri, predicateIri, targetIri }) =>
          ctx.setResult(
            applyOntologyGraphGestureAtom,
            ApplyOntologyGraphGestureInput.make({
              gesture: OntologyGraphGesture.cases[kind].make({ sourceIri, predicateIri, targetIri }),
            })
          ),
      });
    });

    yield* OntologyInspectorAction.$match(action, {
      addTriple: () =>
        O.match(
          O.all({
            subject: O.map(subjectIri, makeNamedNode),
            predicate: O.map(predicateIri, makeNamedNode),
            object: OntologyInspectorObjectKind.$match(form.objectKind, {
              iri: () => O.map(objectIri, makeNamedNode),
              literal: () =>
                pipe(
                  Str.trim(form.object),
                  O.liftPredicate(Str.isNonEmpty),
                  O.map(() => makeLiteral(form.object, XSD_STRING.value))
                ),
            }),
          }),
          {
            onNone: () => Effect.void,
            onSome: ({ subject, predicate, object }) =>
              ctx.setResult(
                applyOntologyBatchAtom,
                ApplyOntologyBatchInput.make({
                  operations: [
                    ChangeOperation.make({
                      kind: "addQuad",
                      partition: "asserted",
                      quad: makeQuad(subject, predicate, object),
                    }),
                  ],
                })
              ),
          }
        ),
      connect: () => applyEdgeGesture("connect"),
      delete: () => applyEdgeGesture("delete"),
      expand: () => applyEdgeGesture("expand"),
      instantiate: () =>
        O.match(O.all({ classIri: subjectIri, instanceIri: objectIri }), {
          onNone: () => Effect.void,
          onSome: ({ classIri, instanceIri }) =>
            ctx.setResult(
              applyOntologyGraphGestureAtom,
              ApplyOntologyGraphGestureInput.make({
                gesture: OntologyGraphGesture.cases.instantiate.make({ classIri, instanceIri }),
              })
            ),
        }),
    });
  })
);

/**
 * Undo the last authored session change locally.
 *
 * **Example** (Log undo change atom)
 *
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
 * **Example** (Log redo change atom)
 *
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
 * **Example** (Invert addQuad operation)
 *
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
