/**
 * Schema-backed workflow execution failures.
 *
 * **Details**
 *
 * * The module distinguishes infrastructure failure, missing executions, and
 * resumable suspension so workflow handlers can recover by `_tag`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { ErrorMessage, OptionalErrorCause, OptionalErrorMessage } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Workflow");

/**
 * General workflow runtime failure.
 *
 * **Example** (Use WorkflowError)
 * ```ts
 * import { WorkflowError } from "@effect-ontology/Error/Workflow"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(WorkflowError)({
 *   _tag: "WorkflowError", message: "Workflow runtime failed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkflowError extends S.TaggedError<WorkflowError>($I`WorkflowError`)(
  "WorkflowError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable workflow failure diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional workflow runtime defect.",
    }),
  },
  $I.annote("WorkflowError", {
    description: "General workflow runtime failure.",
  })
) {}

/**
 * Indicates that a workflow execution identifier could not be resolved.
 *
 * **Example** (Use WorkflowNotFoundError)
 * ```ts
 * import { WorkflowNotFoundError } from "@effect-ontology/Error/Workflow"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(WorkflowNotFoundError)({
 *   _tag: "WorkflowNotFoundError",
 *   message: "Workflow execution was not found.",
 *   executionId: "execution-42"
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @invariant `executionId` and `message` are non-empty.
 * @category errors
 * @since 0.0.0
 */
export class WorkflowNotFoundError extends S.TaggedError<WorkflowNotFoundError>($I`WorkflowNotFoundError`)(
  "WorkflowNotFoundError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable missing-execution diagnostic.",
    }),
    executionId: S.NonEmptyString.annotateKey({
      description: "Workflow execution identifier that was not found.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional lookup defect.",
    }),
  },
  $I.annote("WorkflowNotFoundError", {
    description: "Failure to resolve a workflow execution identifier.",
  })
) {}

/**
 * Indicates that workflow execution is suspended.
 *
 * **Details**
 *
 * * `isResumable` defaults to `false`, making the safe behavior explicit when a
 * producer omits resume capability.
 *
 * **Example** (Use WorkflowSuspendedError)
 * ```ts
 * import { WorkflowSuspendedError } from "@effect-ontology/Error/Workflow"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(WorkflowSuspendedError)({
 *   _tag: "WorkflowSuspendedError", message: "Approval is required." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkflowSuspendedError extends S.TaggedError<WorkflowSuspendedError>($I`WorkflowSuspendedError`)(
  "WorkflowSuspendedError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable suspension diagnostic.",
    }),
    cause: OptionalErrorMessage.annotateKey({
      description: "Optional suspension reason, normalized to Option.",
    }),
    isResumable: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)).annotateKey({
      description: "Whether the suspended execution may be resumed.",
    }),
  },
  $I.annote("WorkflowSuspendedError", {
    description: "Workflow suspension with explicit resume capability.",
  })
) {}

const AnyWorkflowErrorDefinition = S.Union([WorkflowError, WorkflowNotFoundError, WorkflowSuspendedError]).pipe(
  S.toTaggedUnion("_tag")
);

/**
 * Exhaustive tagged union of workflow failures.
 *
 * **Example** (Use AnyWorkflowError)
 * ```ts
 * import { AnyWorkflowError, WorkflowSuspendedError } from "@effect-ontology/Error/Workflow"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(WorkflowSuspendedError)({
 *   _tag: "WorkflowSuspendedError", message: "Paused." })
 * console.log(AnyWorkflowError.guards.WorkflowSuspendedError(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AnyWorkflowError = AnyWorkflowErrorDefinition.pipe(
  $I.annoteSchema("AnyWorkflowError", {
    description: "Exhaustive tagged union of workflow execution failures.",
    toArbitrary: () => S.toArbitrary(AnyWorkflowErrorDefinition),
  })
);

/**
 * Runtime failure decoded by {@link AnyWorkflowError}.
 *
 * **Example** (Use AnyWorkflowError)
 * ```ts
 * import { WorkflowError, type AnyWorkflowError } from "@effect-ontology/Error/Workflow"
 *
 * const error: AnyWorkflowError = WorkflowError.make({ message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnyWorkflowError = typeof AnyWorkflowError.Type;
