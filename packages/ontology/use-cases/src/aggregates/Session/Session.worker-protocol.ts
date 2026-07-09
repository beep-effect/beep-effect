/**
 * Effect-Schema typed worker protocol for ontology parse and diff workers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { make as makeIdentity } from "@beep/identity";
import { ChangeOperation } from "@beep/ontology-domain/aggregates/Session";
import { Dataset } from "@beep/rdf/Rdf";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { ParseTurtleRequest, ParseTurtleResult } from "./Session.ports.js";

const { $OntologyUseCasesId } = makeIdentity("ontology-use-cases");
const $I = $OntologyUseCasesId.create("aggregates/Session/Session.worker-protocol");

const WorkerCommandKind = LiteralKit(["parseTurtle", "diffDatasets"]);

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

const WorkerResultKind = LiteralKit(["parseTurtleSucceeded", "diffDatasetsSucceeded"]);

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
