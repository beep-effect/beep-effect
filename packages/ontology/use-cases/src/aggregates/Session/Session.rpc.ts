/**
 * Ontology workbench wire contract for the desktop sidecar.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { make as makeIdentity } from "@beep/identity";
import { ChangeOperation, Session, SessionChangeDelta, SessionId } from "@beep/ontology-domain/aggregates/Session";
import { SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Effect, flow } from "effect";
import * as S from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import { OntologyFilePath, TurtleDocumentText } from "./Session.ports.js";
import { OntologySnapshot } from "./Session.projections.js";
import { InferOntologySessionInput, OntologyInferenceResult } from "./Session.reasoner.js";
import { RunOntologySparqlInput, RunOntologySparqlResult } from "./Session.sparql.js";

const { $OntologyUseCasesId } = makeIdentity("ontology-use-cases");
const $I = $OntologyUseCasesId.create("aggregates/Session/Session.rpc");

/**
 * Client-safe ontology action failure carried on every ontology RPC request.
 *
 * @example
 * ```ts
 * import { OntologyActionError } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const error = OntologyActionError.new("OpenOntologyDocument")
 *
 * console.log(error.message)
 * ```
 *
 * @since 0.0.0
 * @category errors
 */
export class OntologyActionError extends TaggedErrorClass<OntologyActionError>($I`OntologyActionError`)(
  "OntologyActionError",
  {
    message: S.String,
  },
  $I.annote("OntologyActionError", {
    description: "Client-safe failure raised when an ontology workbench action cannot be completed.",
  })
) {
  static readonly new = (message: string) => OntologyActionError.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);

  static readonly failEffectThunk = flow(this.failEffect, (effect) => () => effect);
}

/**
 * Result returned after opening a Turtle document through the sidecar.
 *
 * @example
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
 * @since 0.0.0
 * @category protocols
 */
export class OpenOntologyDocumentResult extends S.Class<OpenOntologyDocumentResult>($I`OpenOntologyDocumentResult`)(
  {
    session: Session,
    path: OntologyFilePath,
    source: TurtleDocumentText,
    snapshot: OntologySnapshot,
  },
  $I.annote("OpenOntologyDocumentResult", {
    description: "Result returned after opening a Turtle document through the sidecar.",
  })
) {}

/**
 * Result returned after saving a Turtle document through the sidecar.
 *
 * @example
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
 * @since 0.0.0
 * @category protocols
 */
export class SaveOntologyDocumentResult extends S.Class<SaveOntologyDocumentResult>($I`SaveOntologyDocumentResult`)(
  {
    path: OntologyFilePath,
    source: TurtleDocumentText,
  },
  $I.annote("SaveOntologyDocumentResult", {
    description: "Result returned after saving a Turtle document through the sidecar.",
  })
) {}

/**
 * Result returned after previewing Turtle serialization.
 *
 * @example
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
 * @since 0.0.0
 * @category protocols
 */
export class PreviewOntologyTurtleResult extends S.Class<PreviewOntologyTurtleResult>($I`PreviewOntologyTurtleResult`)(
  {
    source: TurtleDocumentText,
  },
  $I.annote("PreviewOntologyTurtleResult", {
    description: "Result returned after previewing Turtle serialization.",
  })
) {}

/**
 * Batch operation payload accepted by the ontology sidecar.
 *
 * @example
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
 * @since 0.0.0
 * @category protocols
 */
export class ApplyOntologyBatchCommand extends S.Class<ApplyOntologyBatchCommand>($I`ApplyOntologyBatchCommand`)(
  {
    session: Session,
    operations: S.Array(ChangeOperation),
  },
  $I.annote("ApplyOntologyBatchCommand", {
    description: "Batch operation payload accepted by the ontology sidecar.",
  })
) {}

/**
 * Batch operation result carrying the updated session and real delta.
 *
 * @example
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
 * @since 0.0.0
 * @category protocols
 */
export class ApplyOntologyBatchResult extends S.Class<ApplyOntologyBatchResult>($I`ApplyOntologyBatchResult`)(
  {
    session: Session,
    delta: SessionChangeDelta,
    operations: S.Array(ChangeOperation),
  },
  $I.annote("ApplyOntologyBatchResult", {
    description: "Batch operation result carrying the updated session and real RDF delta.",
  })
) {}

class OpenOntologyDocumentPayload extends S.Class<OpenOntologyDocumentPayload>($I`OpenOntologyDocumentPayload`)(
  {
    sessionId: SessionId,
    path: OntologyFilePath,
    baseIri: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("OpenOntologyDocumentPayload", {
    description: "Wire payload for opening an ontology document from the desktop sidecar.",
  })
) {}

class SaveOntologyDocumentPayload extends S.Class<SaveOntologyDocumentPayload>($I`SaveOntologyDocumentPayload`)(
  {
    path: OntologyFilePath,
    session: Session,
  },
  $I.annote("SaveOntologyDocumentPayload", {
    description: "Wire payload for saving an ontology document from the desktop sidecar.",
  })
) {}

class PreviewOntologyTurtlePayload extends S.Class<PreviewOntologyTurtlePayload>($I`PreviewOntologyTurtlePayload`)(
  {
    session: Session,
  },
  $I.annote("PreviewOntologyTurtlePayload", {
    description: "Wire payload for previewing Turtle serialization in the desktop sidecar.",
  })
) {}

class GetOntologySnapshotPayload extends S.Class<GetOntologySnapshotPayload>($I`GetOntologySnapshotPayload`)(
  {
    session: Session,
  },
  $I.annote("GetOntologySnapshotPayload", {
    description: "Wire payload for building the current ontology explorer snapshot.",
  })
) {}

/**
 * Opens a Turtle document into an ontology session.
 *
 * @example
 * ```ts
 * import { OpenOntologyDocumentRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(OpenOntologyDocumentRpc)
 * ```
 *
 * @since 0.0.0
 * @category protocols
 */
export const OpenOntologyDocumentRpc = Rpc.make("OpenOntologyDocument", {
  payload: OpenOntologyDocumentPayload,
  success: OpenOntologyDocumentResult,
  error: OntologyActionError,
});

/**
 * Saves the asserted session graph to a Turtle document.
 *
 * @example
 * ```ts
 * import { SaveOntologyDocumentRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(SaveOntologyDocumentRpc)
 * ```
 *
 * @since 0.0.0
 * @category protocols
 */
export const SaveOntologyDocumentRpc = Rpc.make("SaveOntologyDocument", {
  payload: SaveOntologyDocumentPayload,
  success: SaveOntologyDocumentResult,
  error: OntologyActionError,
});

/**
 * Serializes the asserted session graph without writing it.
 *
 * @example
 * ```ts
 * import { PreviewOntologyTurtleRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(PreviewOntologyTurtleRpc)
 * ```
 *
 * @since 0.0.0
 * @category protocols
 */
export const PreviewOntologyTurtleRpc = Rpc.make("PreviewOntologyTurtle", {
  payload: PreviewOntologyTurtlePayload,
  success: PreviewOntologyTurtleResult,
  error: OntologyActionError,
});

/**
 * Applies typed ontology change operations and returns the real RDF delta.
 *
 * @example
 * ```ts
 * import { ApplyOntologyBatchRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(ApplyOntologyBatchRpc)
 * ```
 *
 * @since 0.0.0
 * @category protocols
 */
export const ApplyOntologyBatchRpc = Rpc.make("ApplyOntologyBatch", {
  payload: ApplyOntologyBatchCommand,
  success: ApplyOntologyBatchResult,
  error: OntologyActionError,
});

/**
 * Builds the current ontology explorer snapshot.
 *
 * @example
 * ```ts
 * import { GetOntologySnapshotRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(GetOntologySnapshotRpc)
 * ```
 *
 * @since 0.0.0
 * @category protocols
 */
export const GetOntologySnapshotRpc = Rpc.make("GetOntologySnapshot", {
  payload: GetOntologySnapshotPayload,
  success: OntologySnapshot,
  error: OntologyActionError,
});

/**
 * Runs structural inference over an ontology session.
 *
 * @example
 * ```ts
 * import { RunOntologyInferenceRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(RunOntologyInferenceRpc)
 * ```
 *
 * @since 0.0.0
 * @category protocols
 */
export const RunOntologyInferenceRpc = Rpc.make("RunOntologyInference", {
  payload: InferOntologySessionInput,
  success: OntologyInferenceResult,
  error: OntologyActionError,
});

/**
 * Executes a safeguarded SPARQL query over an ontology session.
 *
 * @example
 * ```ts
 * import { RunOntologySparqlRpc } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(RunOntologySparqlRpc)
 * ```
 *
 * @since 0.0.0
 * @category protocols
 */
export const RunOntologySparqlRpc = Rpc.make("RunOntologySparql", {
  payload: RunOntologySparqlInput,
  success: RunOntologySparqlResult,
  error: OntologyActionError,
});

/**
 * Ontology workbench RPC group registered by the desktop sidecar.
 *
 * @example
 * ```ts
 * import { OntologyRpcs } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(OntologyRpcs)
 * ```
 *
 * @since 0.0.0
 * @category protocols
 */
export const OntologyRpcs = RpcGroup.make(
  OpenOntologyDocumentRpc,
  SaveOntologyDocumentRpc,
  PreviewOntologyTurtleRpc,
  ApplyOntologyBatchRpc,
  GetOntologySnapshotRpc,
  RunOntologyInferenceRpc,
  RunOntologySparqlRpc
);
