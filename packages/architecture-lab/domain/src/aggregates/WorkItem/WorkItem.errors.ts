/**
 * WorkItem domain errors.
 *
 * @packageDocumentation
 * @category errors
 * @since 0.0.0
 */

import { $ArchitectureLabDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { WorkItemId, WorkItemStatus } from "./WorkItem.values.ts";

const $I = $ArchitectureLabDomainId.create("aggregates/WorkItem/WorkItem.errors");

const WorkItemAlreadyArchivedFields = {
  workItemId: WorkItemId.annotateKey({
    description: "WorkItem aggregate id that is already archived.",
  }),
} satisfies S.Struct.Fields;
const sameWorkItemAlreadyArchivedFields = S.toEquivalence(
  S.TaggedStruct("WorkItemAlreadyArchived", WorkItemAlreadyArchivedFields)
);
const sameWorkItemAlreadyArchived = (self: WorkItemAlreadyArchived, that: WorkItemAlreadyArchived): boolean =>
  sameWorkItemAlreadyArchivedFields(self, that);

/**
 * Failure raised when a command attempts to mutate an archived WorkItem.
 *
 * **Example** (Make archived WorkItem failure)
 *
 * ```ts
 * import { WorkItemAlreadyArchived, WorkItemId } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const error = WorkItemAlreadyArchived.make({
 *   workItemId: S.decodeUnknownSync(WorkItemId)("work-item-1")
 * })
 *
 * if (error._tag !== "WorkItemAlreadyArchived") {
 *   throw new Error("expected archived WorkItem failure")
 * }
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkItemAlreadyArchived extends S.TaggedError<WorkItemAlreadyArchived>($I`WorkItemAlreadyArchived`)(
  "WorkItemAlreadyArchived",
  WorkItemAlreadyArchivedFields,
  $I.annoteClass<
    S.declare<WorkItemAlreadyArchived>,
    readonly [S.TaggedStruct<"WorkItemAlreadyArchived", typeof WorkItemAlreadyArchivedFields>]
  >("WorkItemAlreadyArchived", {
    title: "WorkItem already archived",
    description: "The WorkItem is archived and no further lifecycle transition is allowed.",
    toEquivalence: () => sameWorkItemAlreadyArchived,
  })
) {}

const WorkItemInvalidTransitionFields = {
  workItemId: WorkItemId.annotateKey({
    description: "WorkItem aggregate id whose transition was rejected.",
  }),
  from: WorkItemStatus.annotateKey({
    description: "Current WorkItem lifecycle status.",
  }),
  to: WorkItemStatus.annotateKey({
    description: "Requested WorkItem lifecycle status.",
  }),
} satisfies S.Struct.Fields;
const sameWorkItemInvalidTransitionFields = S.toEquivalence(
  S.TaggedStruct("WorkItemInvalidTransition", WorkItemInvalidTransitionFields)
);
const sameWorkItemInvalidTransition = (self: WorkItemInvalidTransition, that: WorkItemInvalidTransition): boolean =>
  sameWorkItemInvalidTransitionFields(self, that);

/**
 * Failure raised when a command attempts an unsupported lifecycle transition.
 *
 * **Example** (Build invalid transition failure)
 *
 * ```ts
 * import { WorkItemId, WorkItemInvalidTransition } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const error = WorkItemInvalidTransition.fromStatus({
 *   workItemId: S.decodeUnknownSync(WorkItemId)("work-item-1"),
 *   from: "completed",
 *   to: "assigned"
 * })
 *
 * if (error.from !== "completed" || error.to !== "assigned") {
 *   throw new Error("expected transition details")
 * }
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkItemInvalidTransition extends S.TaggedError<WorkItemInvalidTransition>($I`WorkItemInvalidTransition`)(
  "WorkItemInvalidTransition",
  WorkItemInvalidTransitionFields,
  $I.annoteClass<
    S.declare<WorkItemInvalidTransition>,
    readonly [S.TaggedStruct<"WorkItemInvalidTransition", typeof WorkItemInvalidTransitionFields>]
  >("WorkItemInvalidTransition", {
    title: "WorkItem invalid transition",
    description: "The requested lifecycle transition is not valid for the current WorkItem state.",
    toEquivalence: () => sameWorkItemInvalidTransition,
  })
) {
  /**
   * Create a typed WorkItem transition failure from lifecycle values.
   *
   * **Example** (Create failure from statuses)
   *
   * ```ts
   * import { WorkItemId, WorkItemInvalidTransition } from "@beep/architecture-lab-domain/aggregates/WorkItem"
   * import * as S from "effect/Schema"
   *
   * const error = WorkItemInvalidTransition.fromStatus({
   *   workItemId: S.decodeUnknownSync(WorkItemId)("work-item-1"),
   *   from: "archived",
   *   to: "open"
   * })
   *
   * if (error._tag !== "WorkItemInvalidTransition") {
   *   throw new Error("expected transition failure")
   * }
   * ```
   *
   * @category factories
   * @since 0.0.0
   */
  static fromStatus(input: (typeof WorkItemInvalidTransition)["~type.make.in"]) {
    return WorkItemInvalidTransition.make({
      workItemId: input.workItemId,
      from: input.from,
      to: input.to,
    });
  }
}

const WorkItemAssigneeRequiredFields = {
  workItemId: WorkItemId.annotateKey({
    description: "WorkItem aggregate id that requires an assignee.",
  }),
} satisfies S.Struct.Fields;
const sameWorkItemAssigneeRequiredFields = S.toEquivalence(
  S.TaggedStruct("WorkItemAssigneeRequired", WorkItemAssigneeRequiredFields)
);
const sameWorkItemAssigneeRequired = (self: WorkItemAssigneeRequired, that: WorkItemAssigneeRequired): boolean =>
  sameWorkItemAssigneeRequiredFields(self, that);

/**
 * Failure raised when an assignment command omits a valid assignee.
 *
 * **Example** (Make assignee required failure)
 *
 * ```ts
 * import { WorkItemAssigneeRequired, WorkItemId } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const error = WorkItemAssigneeRequired.make({
 *   workItemId: S.decodeUnknownSync(WorkItemId)("work-item-1")
 * })
 *
 * if (error._tag !== "WorkItemAssigneeRequired") {
 *   throw new Error("expected assignee failure")
 * }
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkItemAssigneeRequired extends S.TaggedError<WorkItemAssigneeRequired>($I`WorkItemAssigneeRequired`)(
  "WorkItemAssigneeRequired",
  WorkItemAssigneeRequiredFields,
  $I.annoteClass<
    S.declare<WorkItemAssigneeRequired>,
    readonly [S.TaggedStruct<"WorkItemAssigneeRequired", typeof WorkItemAssigneeRequiredFields>]
  >("WorkItemAssigneeRequired", {
    title: "WorkItem assignee required",
    description: "Assigning a WorkItem requires a valid Worker identity.",
    toEquivalence: () => sameWorkItemAssigneeRequired,
  })
) {}

/**
 * WorkItem aggregate domain failure schema.
 *
 * **Example** (Decode domain error schema)
 *
 * ```ts
 * import { WorkItemDomainError } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownSync(WorkItemDomainError)({
 *   _tag: "WorkItemInvalidTransition",
 *   workItemId: "work-item-1",
 *   from: "completed",
 *   to: "assigned"
 * })
 *
 * if (decoded._tag !== "WorkItemInvalidTransition") {
 *   throw new Error("expected decoded domain error")
 * }
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const WorkItemDomainError = S.Union([
  WorkItemAlreadyArchived,
  WorkItemInvalidTransition,
  WorkItemAssigneeRequired,
]).pipe(
  $I.annoteSchema("WorkItemDomainError", {
    title: "WorkItem domain error",
    description: "Tagged union of WorkItem aggregate domain failures.",
  })
);

/**
 * Runtime type for {@link WorkItemDomainError}.
 *
 * **Example** (Type domain error union member)
 *
 * ```ts
 * import { WorkItemAssigneeRequired, WorkItemId, type WorkItemDomainError } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const error: WorkItemDomainError = WorkItemAssigneeRequired.make({
 *   workItemId: S.decodeUnknownSync(WorkItemId)("work-item-1")
 * })
 *
 * if (error._tag !== "WorkItemAssigneeRequired") {
 *   throw new Error("expected WorkItem domain error union member")
 * }
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type WorkItemDomainError = typeof WorkItemDomainError.Type;
