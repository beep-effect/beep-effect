/**
 * GraphOperations/Errors - failures raised during graph-operation execution.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * each `Data.TaggedError` becomes `S.TaggedError` from `effect/Schema`, scoped
 * by a `$NlpProcessingId` composer, `unknown` cause fields become
 * `S.Defect({ includeStack: true })`, and node-scoped failures carry the `NodeId` schema.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { NodeId } from "../EffectGraph.ts";

const $I = $NlpProcessingId.create("Graph/GraphOperations/Errors");

const ValidationErrorFields = {
  errors: S.Array(S.String),
  nodeId: NodeId,
  operationName: S.String,
} satisfies S.Struct.Fields;
const sameValidationErrorFields = S.toEquivalence(S.TaggedStruct("ValidationError", ValidationErrorFields));
const sameValidationError = (self: ValidationError, that: ValidationError): boolean =>
  sameValidationErrorFields(self, that);

/**
 * Failure raised when validation rejects an operation for a source node.
 *
 * **Example** (Construct ValidationError instance)
 *
 * ```ts
 * import { NodeId } from "@beep/nlp-processing/Graph/EffectGraph"
 * import { ValidationError } from "@beep/nlp-processing/Graph/GraphOperations/Errors"
 *
 * const error = ValidationError.make({
 *   operationName: "tokenize",
 *   nodeId: NodeId.make("node-empty"),
 *   errors: ["Node text is empty"]
 * })
 *
 * console.log(error._tag) // "ValidationError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ValidationError extends S.TaggedError<ValidationError>($I`ValidationError`)(
  "ValidationError",
  ValidationErrorFields,
  $I.annoteClass<
    S.declare<ValidationError>,
    readonly [S.TaggedStruct<"ValidationError", typeof ValidationErrorFields>]
  >("ValidationError", {
    description: "Raised when a graph operation cannot validly be applied to a node.",

    toEquivalence: () => sameValidationError,
  })
) {}

const TimeoutErrorFields = {
  nodeId: NodeId,
  operationName: S.String,
  timeoutMs: S.Finite,
} satisfies S.Struct.Fields;
const sameTimeoutErrorFields = S.toEquivalence(S.TaggedStruct("TimeoutError", TimeoutErrorFields));
const sameTimeoutError = (self: TimeoutError, that: TimeoutError): boolean => sameTimeoutErrorFields(self, that);

/**
 * Failure raised when an operation exceeds its configured timeout.
 *
 * **Example** (Construct TimeoutError instance)
 *
 * ```ts
 * import { NodeId } from "@beep/nlp-processing/Graph/EffectGraph"
 * import { TimeoutError } from "@beep/nlp-processing/Graph/GraphOperations/Errors"
 *
 * const error = TimeoutError.make({
 *   operationName: "extractEntities",
 *   nodeId: NodeId.make("node-1"),
 *   timeoutMs: 1_000
 * })
 *
 * console.log(error.timeoutMs) // 1000
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TimeoutError extends S.TaggedError<TimeoutError>($I`TimeoutError`)(
  "TimeoutError",
  TimeoutErrorFields,
  $I.annoteClass<S.declare<TimeoutError>, readonly [S.TaggedStruct<"TimeoutError", typeof TimeoutErrorFields>]>(
    "TimeoutError",
    {
      description: "Raised when a graph operation exceeds its configured time limit.",

      toEquivalence: () => sameTimeoutError,
    }
  )
) {}

const OperationErrorFields = {
  cause: S.Defect({ includeStack: true }),
  nodeId: NodeId,
  operationName: S.String,
} satisfies S.Struct.Fields;
const OperationErrorEquivalenceFields = {
  // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
  nodeId: OperationErrorFields.nodeId,
  operationName: OperationErrorFields.operationName,
} satisfies S.Struct.Fields;
const sameOperationErrorFields = S.toEquivalence(S.TaggedStruct("OperationError", OperationErrorEquivalenceFields));
const sameOperationError = (self: OperationError, that: OperationError): boolean =>
  sameOperationErrorFields(self, that);

/**
 * Failure raised when a node-level operation application defects.
 *
 * **Details**
 *
 * Recoverable operation failures should normally live in the operation's typed
 * error channel and become per-node result errors. Use this error for defects or
 * bridge failures that must be represented as graph-operation failures.
 *
 * **Example** (Construct OperationError instance)
 *
 * ```ts
 * import { NodeId } from "@beep/nlp-processing/Graph/EffectGraph"
 * import { OperationError } from "@beep/nlp-processing/Graph/GraphOperations/Errors"
 *
 * const error = OperationError.make({
 *   operationName: "posTag",
 *   nodeId: NodeId.make("node-1"),
 *   cause: new Error("backend defect")
 * })
 *
 * console.log(error.operationName) // "posTag"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OperationError extends S.TaggedError<OperationError>($I`OperationError`)(
  "OperationError",
  OperationErrorFields,
  $I.annoteClass<S.declare<OperationError>, readonly [S.TaggedStruct<"OperationError", typeof OperationErrorFields>]>(
    "OperationError",
    {
      description: "Raised when a graph operation fails while being applied to a node.",

      toEquivalence: () => sameOperationError,
    }
  )
) {}

const GraphErrorFields = {
  message: S.String,
  nodeId: S.OptionFromOptionalKey(NodeId),
} satisfies S.Struct.Fields;
const sameGraphErrorFields = S.toEquivalence(S.TaggedStruct("GraphError", GraphErrorFields));
const sameGraphError = (self: GraphError, that: GraphError): boolean => sameGraphErrorFields(self, that);

/**
 * Failure raised when graph structure is invalid for an operation.
 *
 * **Example** (Construct GraphError instance)
 *
 * ```ts
 * import { NodeId } from "@beep/nlp-processing/Graph/EffectGraph"
 * import { GraphError } from "@beep/nlp-processing/Graph/GraphOperations/Errors"
 * import * as O from "effect/Option"
 *
 * const error = GraphError.make({
 *   message: "Expected at least one leaf node",
 *   nodeId: O.some(NodeId.make("node-root"))
 * })
 *
 * console.log(error.message) // "Expected at least one leaf node"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GraphError extends S.TaggedError<GraphError>($I`GraphError`)(
  "GraphError",
  GraphErrorFields,
  $I.annoteClass<S.declare<GraphError>, readonly [S.TaggedStruct<"GraphError", typeof GraphErrorFields>]>(
    "GraphError",
    {
      description: "Raised when a graph has an invalid structure for the requested operation.",

      toEquivalence: () => sameGraphError,
    }
  )
) {}

const StorageErrorFields = {
  cause: S.Defect({ includeStack: true }),
  operation: S.Literals(["store", "retrieve", "delete", "query"]),
} satisfies S.Struct.Fields;
const StorageErrorEquivalenceFields = {
  // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
  operation: StorageErrorFields.operation,
} satisfies S.Struct.Fields;
const sameStorageErrorFields = S.toEquivalence(S.TaggedStruct("StorageError", StorageErrorEquivalenceFields));
const sameStorageError = (self: StorageError, that: StorageError): boolean => sameStorageErrorFields(self, that);

/**
 * Failure raised by a result-store backend.
 *
 * **Details**
 *
 * The current in-memory store is total in ordinary use, but the service contract
 * keeps storage failures typed so durable stores can report backend problems.
 *
 * **Example** (Construct StorageError instance)
 *
 * ```ts
 * import { StorageError } from "@beep/nlp-processing/Graph/GraphOperations/Errors"
 *
 * const error = StorageError.make({
 *   operation: "retrieve",
 *   cause: new Error("cache unavailable")
 * })
 *
 * console.log(error.operation) // "retrieve"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class StorageError extends S.TaggedError<StorageError>($I`StorageError`)(
  "StorageError",
  StorageErrorFields,
  $I.annoteClass<S.declare<StorageError>, readonly [S.TaggedStruct<"StorageError", typeof StorageErrorFields>]>(
    "StorageError",
    {
      description: "Raised when the result store fails to store, retrieve, delete, or query a result.",

      toEquivalence: () => sameStorageError,
    }
  )
) {}

const ExecutionErrorFields = {
  cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })),
  message: S.String,
} satisfies S.Struct.Fields;
const ExecutionErrorEquivalenceFields = {
  // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
  message: ExecutionErrorFields.message,
} satisfies S.Struct.Fields;
const sameExecutionErrorFields = S.toEquivalence(S.TaggedStruct("ExecutionError", ExecutionErrorEquivalenceFields));
const sameExecutionError = (self: ExecutionError, that: ExecutionError): boolean =>
  sameExecutionErrorFields(self, that);

/**
 * Failure raised by the executor for orchestration problems.
 *
 * **Example** (Construct ExecutionError instance)
 *
 * ```ts
 * import { ExecutionError } from "@beep/nlp-processing/Graph/GraphOperations/Errors"
 * import * as O from "effect/Option"
 *
 * const error = ExecutionError.make({
 *   cause: O.none(),
 *   message: "Storage retrieve failed"
 * })
 *
 * console.log(error.message) // "Storage retrieve failed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ExecutionError extends S.TaggedError<ExecutionError>($I`ExecutionError`)(
  "ExecutionError",
  ExecutionErrorFields,
  $I.annoteClass<S.declare<ExecutionError>, readonly [S.TaggedStruct<"ExecutionError", typeof ExecutionErrorFields>]>(
    "ExecutionError",
    {
      description: "Raised on a general graph-operation execution failure (e.g. an unknown strategy).",

      toEquivalence: () => sameExecutionError,
    }
  )
) {}

/**
 * Schema union covering every graph-operation failure variant.
 *
 * **Details**
 *
 * Use this schema when decoding or matching errors at a graph-operation boundary
 * where validation, timeout, execution, graph, storage, and executor failures all
 * need to be accepted.
 *
 * **Example** (Check GraphOperationError membership)
 *
 * ```ts
 * import { GraphError, GraphOperationError } from "@beep/nlp-processing/Graph/GraphOperations/Errors"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = GraphError.make({ message: "Missing root", nodeId: O.none() })
 * console.log(S.is(GraphOperationError)(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const GraphOperationError = S.Union([
  ValidationError,
  TimeoutError,
  OperationError,
  GraphError,
  StorageError,
  ExecutionError,
]).pipe(
  $I.annoteSchema("GraphOperationError", {
    description: "Union of all graph-operation failures.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type represented by {@link GraphOperationError}.
 *
 * **Example** (Assign GraphOperationError type)
 *
 * ```ts
 * import type { GraphOperationError } from "@beep/nlp-processing/Graph/GraphOperations/Errors"
 * import { GraphError } from "@beep/nlp-processing/Graph/GraphOperations/Errors"
 * import * as O from "effect/Option"
 *
 * const error: GraphOperationError = GraphError.make({ message: "Missing root", nodeId: O.none() })
 * console.log(error._tag) // "GraphError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type GraphOperationError = typeof GraphOperationError.Type;
