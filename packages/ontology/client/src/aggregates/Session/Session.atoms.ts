/**
 * Ontology workbench client atoms backed by the sidecar RPC contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { make as makeIdentity } from "@beep/identity";
import {
  appendChange,
  ChangeOperation,
  invertChangeOperation,
  Session,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import {
  ApplyOntologyBatchCommand,
  buildOntologySnapshot,
  OntologyActionError,
  OntologyFilePath,
  OntologyMetrics,
  OntologyRpcs,
  OntologySnapshot,
  resourceVisibleInViewMode,
  searchOntologyResources,
} from "@beep/ontology-use-cases/aggregates/Session";
import { SchemaUtils } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { Effect, Layer, pipe } from "effect";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import { Atom, AtomRpc, Reactivity } from "effect/unstable/reactivity";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import type { OntologyViewMode } from "@beep/ontology-use-cases/aggregates/Session";

const { $OntologyClientId } = makeIdentity("ontology-client");
const $I = $OntologyClientId.create("aggregates/Session/Session.atoms");

const SERVER_URL = ((): string => {
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (Str.startsWith(origin, "http://") || Str.startsWith(origin, "https://")) {
      return new URL("/rpc", origin).toString();
    }
  }
  return "http://127.0.0.1:3939/rpc";
})();

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
export const HttpOntologyProtocolLive: Layer.Layer<RpcClient.Protocol> = RpcClient.layerProtocolHttp({
  url: SERVER_URL,
}).pipe(Layer.provide([RpcSerialization.layerNdjson, FetchHttpClient.layer]));

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
export const ontologyProtocolLayerAtom: Atom.Writable<Layer.Layer<RpcClient.Protocol>> =
  Atom.make(HttpOntologyProtocolLive);

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
    metrics: OntologyMetrics.make({
      quadCount: 0,
      resourceCount: 0,
      classCount: 0,
      propertyCount: 0,
      individualCount: 0,
      tboxCount: 0,
      aboxCount: 0,
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
  pipe(get(ontologySessionAtom), O.map(buildOntologySnapshot), O.getOrElse(emptyOntologySnapshot))
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
      onSome: (session) => session.changeLog.length !== get(ontologySavedChangeCountAtom),
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

const noOpenSessionError = OntologyActionError.new("No ontology session is open.");

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
    ctx.set(ontologyRedoStackAtom, []);
    ctx.set(selectedOntologyResourceIriAtom, O.none());
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
      [SESSION_KEY]
    );
    ctx.set(ontologySessionAtom, O.some(applied.session));
    ctx.set(ontologyRedoStackAtom, []);
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
    const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
    yield* pipe(
      A.last(session.changeLog),
      O.match({
        onNone: () => Effect.void,
        onSome: (change) =>
          Effect.sync(() => {
            ctx.set(
              ontologySessionAtom,
              O.some(
                Session.make({
                  ...session,
                  changeLog: A.dropRight(session.changeLog, 1),
                })
              )
            );
            ctx.set(ontologyRedoStackAtom, pipe(ctx(ontologyRedoStackAtom), A.prepend(change)));
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
    const session = yield* ctx.some(ontologySessionAtom).pipe(Effect.mapError(() => noOpenSessionError));
    yield* pipe(
      A.head(ctx(ontologyRedoStackAtom)),
      O.match({
        onNone: () => Effect.void,
        onSome: (change) =>
          Effect.sync(() => {
            ctx.set(ontologySessionAtom, O.some(appendChange(session, change)));
            ctx.set(ontologyRedoStackAtom, A.drop(ctx(ontologyRedoStackAtom), 1));
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
