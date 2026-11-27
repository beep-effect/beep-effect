/**
 * Effect-Schema typed worker protocol for ontology parse and diff workers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyUseCasesId } from "@beep/identity/packages";
import { ChangeOperation, Session, SessionChangeDelta } from "@beep/ontology-domain/aggregates/Session";
import { Dataset } from "@beep/rdf/Rdf";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import { ParseTurtleRequest, ParseTurtleResult } from "./Session.ports.ts";
import { OntologySnapshot } from "./Session.projections.ts";
import { OntologyGraphProjection, OntologyGraphProjectionOptions } from "./Session.visualizer.ts";
import type * as Result from "effect/Result";

const $I = $OntologyUseCasesId.create("aggregates/Session/Session.worker-protocol");

// decision: worker-graph-imports-skip-root-barrels
const WorkerCommandKind = LiteralKit([
  "parseTurtle",
  "diffDatasets",
  "computeSnapshot",
  "projectGraph",
  "applyGraphDelta",
]);

/**
 * **Example** (Construct a parseTurtle worker command)
 *
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
 * **Example** (Construct a computeSnapshot worker command)
 *
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
 * @category models
 * @since 0.0.0
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
  })
);

/**
 * **Example** (Construct a parseTurtle worker command)
 *
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
 * @category models
 * @since 0.0.0
 */
export type WorkerCommand = typeof WorkerCommand.Type;

/**
 * **Example** (Construct a diff worker result)
 *
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
 * @category models
 * @since 0.0.0
 */
export class DiffWorkerResult extends S.Opaque<DiffWorkerResult, { readonly brand: unique symbol }>()(
  S.Struct({
    operations: S.Array(ChangeOperation),
  }).pipe(
    $I.annoteSchema("DiffWorkerResult", {
      description: "Diff worker result expressed as typed change operations.",
    })
  )
) {}

const WorkerResultKind = LiteralKit([
  "parseTurtleSucceeded",
  "diffDatasetsSucceeded",
  "computeSnapshotSucceeded",
  "projectGraphSucceeded",
  "applyGraphDeltaSucceeded",
]);

/**
 * **Example** (Construct a parseTurtleSucceeded worker result)
 *
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
 * **Example** (Construct a computeSnapshotSucceeded worker result)
 *
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
 * @category models
 * @since 0.0.0
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
  })
);

/**
 * **Example** (Construct a diffDatasetsSucceeded worker result)
 *
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
 * @category models
 * @since 0.0.0
 */
export type WorkerResult = typeof WorkerResult.Type;

const encodeWorkerCommandResult = S.encodeResult(WorkerCommand);
const encodeWorkerResultResult = S.encodeResult(WorkerResult);

/**
 * The worker boundary is a `structuredClone`, not a channel that carries types.
 *
 * **Details**
 *
 * A clone copies own enumerable properties and drops prototypes. Effect's
 * `Option.none()` keeps `_tag`/`_id` on its *prototype*, so posting a decoded
 * `WorkerCommand` sends `options.focusIri` as the bare object `{}` — a key that
 * is present but is not the `string | absent` the encoded schema expects. The
 * worker's decode then rejected every command it was ever sent, and the graph sat
 * on "pending" forever: the worker was constructed, it was messaged, and it
 * simply never answered.
 *
 * Both ends must therefore speak the *encoded* form, and both must go through
 * these four functions. Encoding at the boundary is what makes the wire the wire.
 *
 * **Gotchas**
 *
 * Takes no encode options: nothing passes them across a worker boundary. Call
 * `S.encodeResult(WorkerCommand)` directly when options are needed.
 *
 * **Example** (Reference the command codec pair)
 *
 * ```ts
 * import { encodeWorkerCommand, decodeWorkerCommand } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(typeof encodeWorkerCommand)
 * console.log(typeof decodeWorkerCommand)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeWorkerCommand = (
  command: WorkerCommand
): Result.Result<typeof WorkerCommand.Encoded, S.SchemaError> => encodeWorkerCommandResult(command);

/**
 * Decode a `WorkerCommand` that has crossed the worker boundary.
 *
 * **Gotchas**
 *
 * Typed as a one-argument function that takes no `ParseOptions`: with an `unknown`
 * input no predicate could tell a value from an options bag. Call
 * `S.decodeUnknownResult(WorkerCommand)` directly when options are needed.
 *
 * **Example** (Reference the command decoder)
 *
 * ```ts
 * import { decodeWorkerCommand } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(typeof decodeWorkerCommand)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeWorkerCommand: (input: unknown) => Result.Result<WorkerCommand, S.SchemaError> =
  S.decodeUnknownResult(WorkerCommand);

/**
 * Encode a `WorkerResult` for the trip back across the worker boundary.
 *
 * **Details**
 *
 * The return path had the same defect in mirror image: the worker posted the
 * decoded result and the parent never decoded it, so the projection arrived
 * de-prototyped — a plain object wearing the shape of a domain value.
 *
 * **Gotchas**
 *
 * Takes no encode options: nothing passes them across a worker boundary. Call
 * `S.encodeResult(WorkerResult)` directly when options are needed.
 *
 * **Example** (Reference the result encoder)
 *
 * ```ts
 * import { encodeWorkerResult } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(typeof encodeWorkerResult)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeWorkerResult = (result: WorkerResult): Result.Result<typeof WorkerResult.Encoded, S.SchemaError> =>
  encodeWorkerResultResult(result);

/**
 * Decode a `WorkerResult` received from the worker.
 *
 * **Gotchas**
 *
 * Typed as a one-argument function that takes no `ParseOptions`: with an `unknown`
 * input no predicate could tell a value from an options bag. Call
 * `S.decodeUnknownResult(WorkerResult)` directly when options are needed.
 *
 * **Example** (Reference the result decoder)
 *
 * ```ts
 * import { decodeWorkerResult } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(typeof decodeWorkerResult)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeWorkerResult: (input: unknown) => Result.Result<WorkerResult, S.SchemaError> =
  S.decodeUnknownResult(WorkerResult);

/**
 * **Details**
 *
 * Dropping such a command is what made the graph inexplicable: the worker was alive
 * and being messaged, it answered nothing, and the workbench sat on "pending" with no
 * error to show and no way to find out why. Thrown from the worker, this surfaces as
 * an `error` event on the parent and fails the graph out loud.
 *
 * **Example** (Read an ontology worker undecodable command entry)
 *
 * ```ts
 * import { OntologyWorkerUndecodableCommand } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(OntologyWorkerUndecodableCommand.fields.reason !== undefined) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OntologyWorkerUndecodableCommand extends S.TaggedError<
  OntologyWorkerUndecodableCommand,
  { readonly brand: unique symbol }
>($I`OntologyWorkerUndecodableCommand`)(
  "OntologyWorkerUndecodableCommand",
  { reason: S.String },
  $I.annoteError<OntologyWorkerUndecodableCommand>("OntologyWorkerUndecodableCommand", {
    description: "The graph worker received a message it could not decode as a WorkerCommand.",
  })
) {}
