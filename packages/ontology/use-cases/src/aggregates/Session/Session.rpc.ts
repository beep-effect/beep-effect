/**
 * Ontology workbench wire contract for the desktop sidecar.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyUseCasesId } from "@beep/identity/packages";
import { ChangeOperation, Session, SessionChangeDelta, SessionId } from "@beep/ontology-domain/aggregates/Session";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as S from "effect/Schema";
import { OntologyFilePath, TurtleDocumentText } from "./Session.ports.ts";
import { OntologySnapshot } from "./Session.projections.ts";
import { InferOntologySessionInput, OntologyInferenceResult } from "./Session.reasoner.ts";
import { RunOntologySparqlInput, RunOntologySparqlResult } from "./Session.sparql.ts";
import {
  ExportOntologyProvenanceCommand,
  ExportOntologyProvenanceResult,
  RunOntologyValidationInput,
  RunOntologyValidationResult,
} from "./Session.validation.ts";

const $I = $OntologyUseCasesId.create("aggregates/Session/Session.rpc");

/**
 * Client-safe ontology action failure carried on every ontology RPC request.
 *
 * **Example** (Create action error)
 *
 * ```ts
 * import { OntologyActionError } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const error = OntologyActionError.new("OpenOntologyDocument")
 *
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OntologyActionError extends S.TaggedError<OntologyActionError, { readonly brand: unique symbol }>(
  $I`OntologyActionError`
)(
  "OntologyActionError",
  {
    message: S.String,
  },
  $I.annoteError<OntologyActionError>("OntologyActionError", {
    description: "Client-safe failure raised when an ontology workbench action cannot be completed.",
  })
) {
  static readonly new = (message: string) => OntologyActionError.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);
}

/**
 * **Example** (Build open document result)
 *
 * ```ts
 * import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { OntologyFilePath, OntologyMetrics, OntologySnapshot, OpenOntologyDocumentResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const result = OpenOntologyDocumentResult.make({
 *   session: createSession(
 *     CreateSessionInput.make({
 *       id: S.decodeUnknownSync(SessionId)("session-1"),
 *       baseDataset: makeDataset([])
 *     })
 *   ),
 *   path: S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl"),
 *   source: "@prefix ex: <https://example.test/> .",
 *   snapshot: OntologySnapshot.make({
 *     sessionId: "session-1",
 *     resources: [],
 *     hierarchy: [],
 *     metrics: OntologyMetrics.make({
 *       quadCount: 0,
 *       resourceCount: 0,
 *       classCount: 0,
 *       propertyCount: 0,
 *       individualCount: 0,
 *       tboxCount: 0,
 *       aboxCount: 0
 *     })
 *   })
 * })
 *
 * console.log(result.snapshot.resources.length)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class OpenOntologyDocumentResult extends S.Opaque<
  OpenOntologyDocumentResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    session: Session,
    path: OntologyFilePath,
    source: TurtleDocumentText,
    snapshot: OntologySnapshot,
  }).pipe(
    $I.annoteSchema("OpenOntologyDocumentResult", {
      description: "Result returned after opening a Turtle document through the sidecar.",
    })
  )
) {}

/**
 * **Example** (Build save document result)
 *
 * ```ts
 * import { OntologyFilePath, SaveOntologyDocumentResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const result = SaveOntologyDocumentResult.make({
 *   path: S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl"),
 *   source: "@prefix ex: <https://example.test/> ."
 * })
 *
 * console.log(result.source)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class SaveOntologyDocumentResult extends S.Opaque<
  SaveOntologyDocumentResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    path: OntologyFilePath,
    source: TurtleDocumentText,
  }).pipe(
    $I.annoteSchema("SaveOntologyDocumentResult", {
      description: "Result returned after saving a Turtle document through the sidecar.",
    })
  )
) {}

/**
 * **Example** (Build preview turtle result)
 *
 * ```ts
 * import { PreviewOntologyTurtleResult } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const result = PreviewOntologyTurtleResult.make({
 *   source: "@prefix ex: <https://example.test/> ."
 * })
 *
 * console.log(result.source)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class PreviewOntologyTurtleResult extends S.Opaque<
  PreviewOntologyTurtleResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    source: TurtleDocumentText,
  }).pipe(
    $I.annoteSchema("PreviewOntologyTurtleResult", {
      description: "Result returned after previewing Turtle serialization.",
    })
  )
) {}

/**
 * **Example** (Build batch command)
 *
 * ```ts
 * import { ChangeOperation, CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { ApplyOntologyBatchCommand } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const command = ApplyOntologyBatchCommand.make({
 *   session: createSession(
 *     CreateSessionInput.make({
 *       id: S.decodeUnknownSync(SessionId)("session-1"),
 *       baseDataset: makeDataset([])
 *     })
 *   ),
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
 * console.log(command.operations.length)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class ApplyOntologyBatchCommand extends S.Opaque<ApplyOntologyBatchCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    session: Session,
    operations: S.Array(ChangeOperation),
  }).pipe(
    $I.annoteSchema("ApplyOntologyBatchCommand", {
      description: "Batch operation payload accepted by the ontology sidecar.",
    })
  )
) {}

/**
 * **Example** (Build batch result)
 *
 * ```ts
 * import { CreateSessionInput, createSession, emptySessionChangeDelta, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { ApplyOntologyBatchResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const result = ApplyOntologyBatchResult.make({
 *   session: createSession(
 *     CreateSessionInput.make({
 *       id: S.decodeUnknownSync(SessionId)("session-1"),
 *       baseDataset: makeDataset([])
 *     })
 *   ),
 *   delta: emptySessionChangeDelta(),
 *   operations: []
 * })
 *
 * console.log(result.delta.added.length)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class ApplyOntologyBatchResult extends S.Opaque<ApplyOntologyBatchResult, { readonly brand: unique symbol }>()(
  S.Struct({
    session: Session,
    delta: SessionChangeDelta,
    operations: S.Array(ChangeOperation),
  }).pipe(
    $I.annoteSchema("ApplyOntologyBatchResult", {
      description: "Batch operation result carrying the updated session and real RDF delta.",
    })
  )
) {}

/**
 * **Example** (Open a Turtle file with a base IRI)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OpenOntologyDocumentPayload } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const payload = S.decodeUnknownSync(OpenOntologyDocumentPayload)({
 *   sessionId: "session-1",
 *   path: "ontologies/patent-claims.ttl",
 *   baseIri: "https://oip.law/ontology/claims#"
 * })
 *
 * console.log(payload.path) // => "ontologies/patent-claims.ttl"
 * console.log(O.getOrUndefined(payload.baseIri)) // => "https://oip.law/ontology/claims#"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenOntologyDocumentPayload extends S.Opaque<
  OpenOntologyDocumentPayload,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    sessionId: SessionId,
    path: OntologyFilePath,
    baseIri: S.OptionFromOptionalKey(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("OpenOntologyDocumentPayload", {
      description: "Wire payload for opening an ontology document from the desktop sidecar.",
    })
  )
) {}

/**
 * **Example** (Save an empty session to a Turtle file)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Session, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { OntologyFilePath, SaveOntologyDocumentPayload } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 *
 * const session = Session.make({
 *   id: S.decodeUnknownSync(SessionId)("session-1"),
 *   baseDataset: makeDataset([]),
 *   changeLog: []
 * })
 * const payload = SaveOntologyDocumentPayload.make({
 *   path: S.decodeUnknownSync(OntologyFilePath)("ontologies/patent-claims.ttl"),
 *   session
 * })
 *
 * console.log(payload.session.id) // => "session-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SaveOntologyDocumentPayload extends S.Opaque<
  SaveOntologyDocumentPayload,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    path: OntologyFilePath,
    session: Session,
  }).pipe(
    $I.annoteSchema("SaveOntologyDocumentPayload", {
      description: "Wire payload for saving an ontology document from the desktop sidecar.",
    })
  )
) {}

/**
 * **Example** (Preview Turtle for a session without writing it)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Session, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { PreviewOntologyTurtlePayload } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 *
 * const payload = PreviewOntologyTurtlePayload.make({
 *   session: Session.make({
 *     id: S.decodeUnknownSync(SessionId)("session-2"),
 *     baseDataset: makeDataset([]),
 *     changeLog: []
 *   })
 * })
 *
 * console.log(payload.session.changeLog.length) // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PreviewOntologyTurtlePayload extends S.Opaque<
  PreviewOntologyTurtlePayload,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    session: Session,
  }).pipe(
    $I.annoteSchema("PreviewOntologyTurtlePayload", {
      description: "Wire payload for previewing Turtle serialization in the desktop sidecar.",
    })
  )
) {}

/**
 * **Example** (Request the explorer snapshot for a session)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Session, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { GetOntologySnapshotPayload } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 *
 * const session = Session.make({
 *   id: S.decodeUnknownSync(SessionId)("session-3"),
 *   baseDataset: makeDataset([]),
 *   changeLog: []
 * })
 * const payload = GetOntologySnapshotPayload.make({ session })
 *
 * console.log(payload.session === session) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GetOntologySnapshotPayload extends S.Opaque<
  GetOntologySnapshotPayload,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    session: Session,
  }).pipe(
    $I.annoteSchema("GetOntologySnapshotPayload", {
      description: "Wire payload for building the current ontology explorer snapshot.",
    })
  )
) {}

/**
 * Opens a Turtle document into an ontology session.
 *
 * **Example** (Inspect open document RPC)
 *
 * ```ts
 * import { OpenOntologyDocumentRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(OpenOntologyDocumentRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const OpenOntologyDocumentRpc = Rpc.make("OpenOntologyDocument", {
  payload: OpenOntologyDocumentPayload,
  success: OpenOntologyDocumentResult,
  error: OntologyActionError,
});

/**
 * Saves the asserted session graph to a Turtle document.
 *
 * **Example** (Inspect save document RPC)
 *
 * ```ts
 * import { SaveOntologyDocumentRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(SaveOntologyDocumentRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const SaveOntologyDocumentRpc = Rpc.make("SaveOntologyDocument", {
  payload: SaveOntologyDocumentPayload,
  success: SaveOntologyDocumentResult,
  error: OntologyActionError,
});

/**
 * Serializes the asserted session graph without writing it.
 *
 * **Example** (Inspect preview turtle RPC)
 *
 * ```ts
 * import { PreviewOntologyTurtleRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(PreviewOntologyTurtleRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const PreviewOntologyTurtleRpc = Rpc.make("PreviewOntologyTurtle", {
  payload: PreviewOntologyTurtlePayload,
  success: PreviewOntologyTurtleResult,
  error: OntologyActionError,
});

/**
 * Applies typed ontology change operations and returns the real RDF delta.
 *
 * **Example** (Inspect apply batch RPC)
 *
 * ```ts
 * import { ApplyOntologyBatchRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(ApplyOntologyBatchRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ApplyOntologyBatchRpc = Rpc.make("ApplyOntologyBatch", {
  payload: ApplyOntologyBatchCommand,
  success: ApplyOntologyBatchResult,
  error: OntologyActionError,
});

/**
 * Builds the current ontology explorer snapshot.
 *
 * **Example** (Inspect snapshot RPC)
 *
 * ```ts
 * import { GetOntologySnapshotRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(GetOntologySnapshotRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const GetOntologySnapshotRpc = Rpc.make("GetOntologySnapshot", {
  payload: GetOntologySnapshotPayload,
  success: OntologySnapshot,
  error: OntologyActionError,
});

/**
 * Runs structural inference over an ontology session.
 *
 * **Example** (Inspect inference RPC)
 *
 * ```ts
 * import { RunOntologyInferenceRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(RunOntologyInferenceRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const RunOntologyInferenceRpc = Rpc.make("RunOntologyInference", {
  payload: InferOntologySessionInput,
  success: OntologyInferenceResult,
  error: OntologyActionError,
});

/**
 * Executes a safeguarded SPARQL query over an ontology session.
 *
 * **Example** (Inspect SPARQL RPC)
 *
 * ```ts
 * import { RunOntologySparqlRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(RunOntologySparqlRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const RunOntologySparqlRpc = Rpc.make("RunOntologySparql", {
  payload: RunOntologySparqlInput,
  success: RunOntologySparqlResult,
  error: OntologyActionError,
});

/**
 * Runs SHACL validation and returns verified repair proposals.
 *
 * **Example** (Inspect validation RPC)
 *
 * ```ts
 * import { RunOntologyValidationRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(RunOntologyValidationRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const RunOntologyValidationRpc = Rpc.make("RunOntologyValidation", {
  payload: RunOntologyValidationInput,
  success: RunOntologyValidationResult,
  error: OntologyActionError,
});

/**
 * Exports PROV-O journal and VoID/DCAT dataset description artifacts.
 *
 * **Example** (Inspect provenance export RPC)
 *
 * ```ts
 * import { ExportOntologyProvenanceRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(ExportOntologyProvenanceRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ExportOntologyProvenanceRpc = Rpc.make("ExportOntologyProvenance", {
  payload: ExportOntologyProvenanceCommand,
  success: ExportOntologyProvenanceResult,
  error: OntologyActionError,
});

/**
 * Ontology workbench RPC group registered by the desktop sidecar.
 *
 * **Example** (Inspect ontology RPC group)
 *
 * ```ts
 * import { OntologyRpcs } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(OntologyRpcs)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const OntologyRpcs = RpcGroup.make(
  OpenOntologyDocumentRpc,
  SaveOntologyDocumentRpc,
  PreviewOntologyTurtleRpc,
  ApplyOntologyBatchRpc,
  GetOntologySnapshotRpc,
  RunOntologyInferenceRpc,
  RunOntologySparqlRpc,
  RunOntologyValidationRpc,
  ExportOntologyProvenanceRpc
);
