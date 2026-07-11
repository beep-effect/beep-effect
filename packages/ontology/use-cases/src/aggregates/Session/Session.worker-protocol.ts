/**
 * Effect-Schema typed worker protocol for ontology parse and diff workers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { make as makeIdentity } from "@beep/identity";
import { ChangeOperation, Session, SessionChangeDelta } from "@beep/ontology-domain/aggregates/Session";
import { Dataset } from "@beep/rdf/Rdf";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as S from "effect/Schema";
import { ParseTurtleRequest, ParseTurtleResult } from "./Session.ports.js";
import { OntologySnapshot } from "./Session.projections.js";
import { OntologyGraphProjection, OntologyGraphProjectionOptions } from "./Session.visualizer.js";

const { $OntologyUseCasesId } = makeIdentity("ontology-use-cases");
const $I = $OntologyUseCasesId.create("aggregates/Session/Session.worker-protocol");

const WorkerCommandKind = LiteralKit([
  "parseTurtle",
  "diffDatasets",
  "computeSnapshot",
  "projectGraph",
  "applyGraphDelta",
]);

/**
 * Worker command envelope.
 *
 * @example
 * ```ts
 * import { ParseTurtleRequest, WorkerCommand } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const command = WorkerCommand.make({
 *   kind: "parseTurtle",
 *   request: ParseTurtleRequest.make({
 *     source: "@prefix ex: <https://example.test/> ."
 *   })
 * })
 *
 * console.log(command.kind)
 * ```
 *
 * @example
 * ```ts
 * import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { WorkerCommand } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const command = WorkerCommand.make({
 *   kind: "computeSnapshot",
 *   session: createSession(
 *     CreateSessionInput.make({
 *       id: S.decodeUnknownSync(SessionId)("session-1"),
 *       baseDataset: makeDataset([])
 *     })
 *   )
 * })
 *
 * console.log(command.kind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const WorkerCommand = WorkerCommandKind.toTaggedUnion("kind")({
  parseTurtle: {
    request: ParseTurtleRequest,
  },
  diffDatasets: {
    before: Dataset,
    after: Dataset,
  },
  computeSnapshot: {
    session: Session,
  },
  projectGraph: {
    snapshot: OntologySnapshot,
    options: OntologyGraphProjectionOptions,
  },
  applyGraphDelta: {
    snapshot: OntologySnapshot,
    delta: SessionChangeDelta,
    previous: OntologyGraphProjection,
    options: OntologyGraphProjectionOptions,
  },
}).pipe(
  $I.annoteSchema("WorkerCommand", {
    description: "Effect-Schema typed worker command envelope.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link WorkerCommand}.
 *
 * @example
 * ```ts
 * import { ParseTurtleRequest, WorkerCommand } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const command: WorkerCommand = WorkerCommand.make({
 *   kind: "parseTurtle",
 *   request: ParseTurtleRequest.make({
 *     source: "@prefix ex: <https://example.test/> ."
 *   })
 * })
 *
 * console.log(command.kind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type WorkerCommand = typeof WorkerCommand.Type;

/**
 * Diff worker result.
 *
 * @example
 * ```ts
 * import { DiffWorkerResult } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const result = DiffWorkerResult.make({
 *   operations: []
 * })
 *
 * console.log(result.operations.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class DiffWorkerResult extends S.Class<DiffWorkerResult>($I`DiffWorkerResult`)(
  {
    operations: S.Array(ChangeOperation),
  },
  $I.annote("DiffWorkerResult", {
    description: "Diff worker result expressed as typed change operations.",
  })
) {}

const WorkerResultKind = LiteralKit([
  "parseTurtleSucceeded",
  "diffDatasetsSucceeded",
  "computeSnapshotSucceeded",
  "projectGraphSucceeded",
  "applyGraphDeltaSucceeded",
]);

/**
 * Worker result envelope.
 *
 * @example
 * ```ts
 * import { ParseTurtleResult, WorkerResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 *
 * const result = WorkerResult.make({
 *   kind: "parseTurtleSucceeded",
 *   result: ParseTurtleResult.make({
 *     dataset: makeDataset([])
 *   })
 * })
 *
 * console.log(result.kind)
 * ```
 *
 * @example
 * ```ts
 * import { OntologyMetrics, OntologySnapshot, WorkerResult } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const result = WorkerResult.make({
 *   kind: "computeSnapshotSucceeded",
 *   result: OntologySnapshot.make({
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
 * console.log(result.kind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const WorkerResult = WorkerResultKind.toTaggedUnion("kind")({
  parseTurtleSucceeded: {
    result: ParseTurtleResult,
  },
  diffDatasetsSucceeded: {
    result: DiffWorkerResult,
  },
  computeSnapshotSucceeded: {
    result: OntologySnapshot,
  },
  projectGraphSucceeded: {
    result: OntologyGraphProjection,
  },
  applyGraphDeltaSucceeded: {
    result: OntologyGraphProjection,
  },
}).pipe(
  $I.annoteSchema("WorkerResult", {
    description: "Effect-Schema typed worker result envelope.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link WorkerResult}.
 *
 * @example
 * ```ts
 * import { DiffWorkerResult, WorkerResult } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const result: WorkerResult = WorkerResult.make({
 *   kind: "diffDatasetsSucceeded",
 *   result: DiffWorkerResult.make({
 *     operations: []
 *   })
 * })
 *
 * console.log(result.kind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type WorkerResult = typeof WorkerResult.Type;
