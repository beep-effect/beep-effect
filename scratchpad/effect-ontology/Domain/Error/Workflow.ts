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
import { ErrorMessage, makeOntologyErrorClass, OptionalErrorCause, OptionalErrorMessage } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Workflow");

/**
 * General workflow runtime failure.
 *
 * **Example** (Use WorkflowError)
 * ```ts
 * import { WorkflowError } from "@effect-ontology/Error/Workflow.ts"
 *
 * const error = WorkflowError.make({ message: "Workflow runtime failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const WorkflowError = makeOntologyErrorClass.make(
  $I`WorkflowError`,
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
);

/**
 * Runtime value decoded by {@link WorkflowError}.
 *
 * **Example** (Use WorkflowError)
 * ```ts
 * import { WorkflowError, type WorkflowError as Failure } from "@effect-ontology/Error/Workflow.ts"
 *
 * const error: Failure = WorkflowError.make({ message: "Failed." })
 * console.log(error.message)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type WorkflowError = typeof WorkflowError.Type;

/**
 * Indicates that a workflow execution identifier could not be resolved.
 *
 * **Example** (Use WorkflowNotFoundError)
 * ```ts
 * import { WorkflowNotFoundError } from "@effect-ontology/Error/Workflow.ts"
 *
 * const error = WorkflowNotFoundError.make({
 *   message: "Workflow execution was not found.",
 *   executionId: "execution-42"
 * })
 * console.log(error.executionId)
 * ```
 *
 * @invariant `executionId` and `message` are non-empty.
 * @category errors
 * @since 0.0.0
 */
export const WorkflowNotFoundError = makeOntologyErrorClass.make(
  $I`WorkflowNotFoundError`,
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
);

/**
 * Runtime value decoded by {@link WorkflowNotFoundError}.
 *
 * **Example** (Use WorkflowNotFoundError)
 * ```ts
 * import { WorkflowNotFoundError, type WorkflowNotFoundError as Missing } from "@effect-ontology/Error/Workflow.ts"
 *
 * const error: Missing = WorkflowNotFoundError.make({
 *   message: "Missing.",
 *   executionId: "execution-42"
 * })
 * console.log(error.executionId)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type WorkflowNotFoundError = typeof WorkflowNotFoundError.Type;

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
 * import { WorkflowSuspendedError } from "@effect-ontology/Error/Workflow.ts"
 *
 * const error = WorkflowSuspendedError.make({ message: "Approval is required." })
 * console.log(error.isResumable) // false
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const WorkflowSuspendedError = makeOntologyErrorClass.make(
  $I`WorkflowSuspendedError`,
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
);

/**
 * Runtime value decoded by {@link WorkflowSuspendedError}.
 *
 * **Example** (Use WorkflowSuspendedError)
 * ```ts
 * import { WorkflowSuspendedError, type WorkflowSuspendedError as Suspended } from "@effect-ontology/Error/Workflow.ts"
 *
 * const error: Suspended = WorkflowSuspendedError.make({ message: "Paused." })
 * console.log(error.isResumable)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type WorkflowSuspendedError = typeof WorkflowSuspendedError.Type;

const AnyWorkflowErrorDefinition = S.Union([WorkflowError, WorkflowNotFoundError, WorkflowSuspendedError]).pipe(
  S.toTaggedUnion("_tag")
);

/**
 * Exhaustive tagged union of workflow failures.
 *
 * **Example** (Use AnyWorkflowError)
 * ```ts
 * import { AnyWorkflowError, WorkflowSuspendedError } from "@effect-ontology/Error/Workflow.ts"
 *
 * const error = WorkflowSuspendedError.make({ message: "Paused." })
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
 * import { WorkflowError, type AnyWorkflowError } from "@effect-ontology/Error/Workflow.ts"
 *
 * const error: AnyWorkflowError = WorkflowError.make({ message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnyWorkflowError = typeof AnyWorkflowError.Type;
