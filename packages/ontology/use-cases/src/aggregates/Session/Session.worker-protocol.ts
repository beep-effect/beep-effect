/**
 * Effect-Schema typed worker protocol for ontology parse and diff workers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyUseCasesId } from "@beep/identity/packages";
import { ChangeOperation, Session, SessionChangeDelta } from "@beep/ontology-domain/aggregates/Session";
import { Dataset } from "@beep/rdf/Rdf";
// Subpath imports, never the `@beep/schema` root barrel: this module is in the graph
// worker's import graph, and the barrel drags a markdown stack behind it whose browser
// build calls `document.createElement` at module top level — which kills a real worker.
// BrowserWorkerImportGraph.test.ts guards exactly this.
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as S from "effect/Schema";
import { ParseTurtleRequest, ParseTurtleResult } from "./Session.ports.ts";
import { OntologySnapshot } from "./Session.projections.ts";
import { OntologyGraphProjection, OntologyGraphProjectionOptions } from "./Session.visualizer.ts";
import type * as Result from "effect/Result";

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
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link WorkerCommand}.
 *
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
 * Diff worker result.
 *
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
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link WorkerResult}.
 *
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

// The exported encoders below wrap these rather than being them: `S.encodeSync`
// returns a function carrying an optional options parameter, which the repo's
// This stays local because callers never need a data-last form.
// Nobody passes encode options across a worker boundary.
const encodeWorkerCommandSync = S.encodeSync(WorkerCommand);
const encodeWorkerResultSync = S.encodeSync(WorkerResult);

/**
 * The worker boundary is a `structuredClone`, not a channel that carries types.
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
export const encodeWorkerCommand = (command: WorkerCommand): typeof WorkerCommand.Encoded =>
  encodeWorkerCommandSync(command);

/**
 * Decode a `WorkerCommand` that has crossed the worker boundary.
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
// unary by contract: `options` stays reachable through `S.decodeUnknownResult(WorkerCommand)`;
// a dual is undecidable here because `input` is `unknown`.
export const decodeWorkerCommand: (input: unknown) => Result.Result<WorkerCommand, S.SchemaError> =
  S.decodeUnknownResult(WorkerCommand);

/**
 * Encode a `WorkerResult` for the trip back across the worker boundary.
 *
 * The return path had the same defect in mirror image: the worker posted the
 * decoded result and the parent never decoded it, so the projection arrived
 * de-prototyped — a plain object wearing the shape of a domain value.
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
export const encodeWorkerResult = (result: WorkerResult): typeof WorkerResult.Encoded => encodeWorkerResultSync(result);

/**
 * Decode a `WorkerResult` received from the worker.
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
// unary by contract: `options` stays reachable through `S.decodeUnknownResult(WorkerResult)`;
// a dual is undecidable here because `input` is `unknown`.
export const decodeWorkerResult: (input: unknown) => Result.Result<WorkerResult, S.SchemaError> =
  S.decodeUnknownResult(WorkerResult);

const OntologyWorkerUndecodableCommandFields = { reason: S.String } satisfies S.Struct.Fields;
const sameOntologyWorkerUndecodableCommandFields = S.toEquivalence(
  S.TaggedStruct("OntologyWorkerUndecodableCommand", OntologyWorkerUndecodableCommandFields)
);
const sameOntologyWorkerUndecodableCommand = (
  self: OntologyWorkerUndecodableCommand,
  that: OntologyWorkerUndecodableCommand
): boolean => sameOntologyWorkerUndecodableCommandFields(self, that);

/**
 * A command the graph worker could not decode.
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
export class OntologyWorkerUndecodableCommand extends S.TaggedError<OntologyWorkerUndecodableCommand>(
  $I`OntologyWorkerUndecodableCommand`
)(
  "OntologyWorkerUndecodableCommand",
  OntologyWorkerUndecodableCommandFields,
  $I.annoteClass<
    S.declare<OntologyWorkerUndecodableCommand>,
    readonly [S.TaggedStruct<"OntologyWorkerUndecodableCommand", typeof OntologyWorkerUndecodableCommandFields>]
  >("OntologyWorkerUndecodableCommand", {
    description: "The graph worker received a message it could not decode as a WorkerCommand.",

    toEquivalence: () => sameOntologyWorkerUndecodableCommand,
  })
) {}
