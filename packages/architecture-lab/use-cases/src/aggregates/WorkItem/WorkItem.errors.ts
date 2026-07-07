/**
 * WorkItem use-case errors.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import { $ArchitectureLabUseCasesId } from "@beep/identity/packages";
import { SchemaUtils, TaggedErrorClass } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ArchitectureLabUseCasesId.create("aggregates/WorkItem/WorkItem.errors");

/**
 * Generic public reason used when internal WorkItem repository details are redacted.
 *
 * @example
 * ```ts
 * import {
 *   WORK_ITEM_ACTION_UNAVAILABLE_REASON,
 *   WorkItemActionFailed
 * } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 *
 * const error = WorkItemActionFailed.make({ reason: WORK_ITEM_ACTION_UNAVAILABLE_REASON })
 *
 * console.log(error.reason) // "WorkItem service is unavailable."
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const WORK_ITEM_ACTION_UNAVAILABLE_REASON = "WorkItem service is unavailable." as const;

/**
 * Public failure raised when a requested WorkItem is absent.
 *
 * @example
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { WorkItemNotFound } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const error = WorkItemNotFound.make({
 *   workItemId: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 * })
 *
 * console.log(error._tag) // "WorkItemNotFound"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkItemNotFound extends TaggedErrorClass<WorkItemNotFound>($I`WorkItemNotFound`)(
  "WorkItemNotFound",
  {
    workItemId: DomainWorkItem.WorkItemId,
  },
  $I.annote("WorkItemNotFound", {
    title: "WorkItem not found",
    description: "The requested architecture lab WorkItem does not exist.",
  })
) {}

/**
 * Public failure raised when a command conflicts with persisted state.
 *
 * @example
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { WorkItemConflict } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const error = WorkItemConflict.make({
 *   workItemId: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1"),
 *   reason: "WorkItem already exists"
 * })
 *
 * console.log(error.reason) // "WorkItem already exists"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkItemConflict extends TaggedErrorClass<WorkItemConflict>($I`WorkItemConflict`)(
  "WorkItemConflict",
  {
    workItemId: DomainWorkItem.WorkItemId.annotateKey({
      description: "WorkItem identity whose command conflicted with persisted state.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty public conflict reason.",
    }),
  },
  $I.annote("WorkItemConflict", {
    title: "WorkItem conflict",
    description: "The requested WorkItem command conflicts with persisted state.",
  })
) {}

/**
 * Public failure raised when the domain rejects a WorkItem action.
 *
 * @example
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { WorkItemActionRejected } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const error = WorkItemActionRejected.make({
 *   workItemId: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1"),
 *   reason: "WorkItemAlreadyArchived"
 * })
 *
 * console.log(error._tag) // "WorkItemActionRejected"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkItemActionRejected extends TaggedErrorClass<WorkItemActionRejected>($I`WorkItemActionRejected`)(
  "WorkItemActionRejected",
  {
    workItemId: DomainWorkItem.WorkItemId.annotateKey({
      description: "WorkItem identity whose domain action was rejected.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty public rejection reason.",
    }),
  },
  $I.annote("WorkItemActionRejected", {
    title: "WorkItem action rejected",
    description: "The WorkItem aggregate rejected the requested action.",
  })
) {}

/**
 * Public failure raised when an action cannot be completed.
 *
 * @example
 * ```ts
 * import { WorkItemActionFailed } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 *
 * const error = WorkItemActionFailed.make({ reason: "Repository timeout" })
 *
 * console.log(error.reason) // "Repository timeout"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkItemActionFailed extends TaggedErrorClass<WorkItemActionFailed>($I`WorkItemActionFailed`)(
  "WorkItemActionFailed",
  {
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty public failure reason with internal repository details redacted.",
    }),
  },
  $I.annote("WorkItemActionFailed", {
    title: "WorkItem action failed",
    description: "The WorkItem use-case action could not be completed.",
  })
) {}

/**
 * Public WorkItem use-case failure schema.
 *
 * @example
 * ```ts
 * import {
 *   WorkItemActionError,
 *   WorkItemActionFailed,
 * } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 *
 * const isActionError = WorkItemActionError.is
 *
 * console.log(isActionError(WorkItemActionFailed.make({ reason: "Repository unavailable" }))) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const WorkItemActionError = S.Union([
  WorkItemNotFound,
  WorkItemConflict,
  WorkItemActionRejected,
  WorkItemActionFailed,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("WorkItemActionError", {
    title: "WorkItem action error",
    description: "Tagged union of public WorkItem use-case failures.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link WorkItemActionError}.
 *
 * @example
 * ```ts
 * import {
 *   WorkItemActionFailed,
 *   type WorkItemActionError
 * } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 *
 * const error: WorkItemActionError = WorkItemActionFailed.make({ reason: "Repository unavailable" })
 *
 * console.log(error._tag) // "WorkItemActionFailed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type WorkItemActionError = typeof WorkItemActionError.Type;
