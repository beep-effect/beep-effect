/**
 * WorkItem aggregate model.
 *
 * @packageDocumentation
 * @category aggregates
 * @since 0.0.0
 */

import { $ArchitectureLabDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { WorkerId } from "../../entities/Worker/index.ts";
import { defaultWorkPriority, WorkPriority } from "../../values/WorkPriority/index.ts";
import { WorkItemAlreadyArchived, WorkItemAssigneeRequired, WorkItemInvalidTransition } from "./WorkItem.errors.ts";
import { WorkItemId, WorkItemStatus, WorkItemTitle } from "./WorkItem.values.ts";

const $I = $ArchitectureLabDomainId.create("aggregates/WorkItem/WorkItem.model");

/**
 * Aggregate state for a WorkItem moving through the architecture lab workflow.
 *
 * @example
 * ```ts
 * import { WorkItem, WorkItemId, WorkItemTitle, type WorkItemStatus } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { WorkerId } from "@beep/architecture-lab-domain/entities/Worker"
 * import { WorkPriority } from "@beep/architecture-lab-domain/values/WorkPriority"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const workItem = WorkItem.make({
 *   id: S.decodeUnknownSync(WorkItemId)("work-item-1"),
 *   title: S.decodeUnknownSync(WorkItemTitle)("Document topology"),
 *   status: "assigned",
 *   assignee: O.some(S.decodeUnknownSync(WorkerId)(1)),
 *   priority: O.some(WorkPriority.Enum.high)
 * })
 *
 * const status: WorkItemStatus = workItem.status
 * if (status !== "assigned") {
 *   throw new Error("expected assigned WorkItem")
 * }
 * ```
 *
 * @category aggregates
 * @since 0.0.0
 */
export class WorkItem extends S.Class<WorkItem>($I`WorkItem`)(
  {
    id: WorkItemId.annotateKey({
      description: "Stable WorkItem aggregate id.",
    }),
    title: WorkItemTitle.annotateKey({
      description: "Human-readable WorkItem title.",
    }),
    status: WorkItemStatus.annotateKey({
      description: "Current WorkItem lifecycle status.",
    }),
    assignee: S.OptionFromOptionalKey(WorkerId)
      .annotateKey({
        description: "Worker assigned to the WorkItem, when assigned.",
      })
      .pipe(SchemaUtils.withNoneDefault),
    priority: S.OptionFromOptionalKey(WorkPriority)
      .annotateKey({
        description: "Relative WorkItem priority, when explicitly carried.",
      })
      .pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("WorkItem", {
    title: "WorkItem",
    description: "Canonical architecture lab aggregate used to prove slice topology.",
  })
) {}

/**
 * Constructor input for creating an open WorkItem with optional priority.
 *
 * @example
 * ```ts
 * import { CreateWorkItemInput, WorkItemId } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const input = CreateWorkItemInput.make({
 *   id: S.decodeUnknownSync(WorkItemId)("work-item-1"),
 *   title: "Document topology"
 * })
 *
 * if (O.isSome(input.priority)) {
 *   throw new Error("priority is optional at creation time")
 * }
 * ```
 *
 * @category aggregates
 * @since 0.0.0
 */
export class CreateWorkItemInput extends S.Class<CreateWorkItemInput>($I`CreateWorkItemInput`)(
  {
    id: WorkItemId.annotateKey({
      description: "Stable WorkItem aggregate id.",
    }),
    title: WorkItemTitle.annotateKey({
      description: "Human-readable WorkItem title.",
    }),
    priority: S.OptionFromOptionalKey(WorkPriority)
      .annotateKey({
        description: "Optional priority requested for the new WorkItem.",
      })
      .pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("CreateWorkItemInput", {
    title: "Create WorkItem input",
    description: "Input required to create an open architecture lab WorkItem.",
  })
) {}

/**
 * Create a new open WorkItem aggregate and apply the default priority when omitted.
 *
 * @example
 * ```ts
 * import { CreateWorkItemInput, WorkItemId, create } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const workItem = create(
 *   CreateWorkItemInput.make({
 *     id: S.decodeUnknownSync(WorkItemId)("work-item-1"),
 *     title: "Document topology"
 *   })
 * )
 *
 * if (workItem.status !== "open" || O.getOrThrow(workItem.priority) !== "normal") {
 *   throw new Error("expected a new open WorkItem with normal priority")
 * }
 * ```
 *
 * @category aggregates
 * @since 0.0.0
 */
export const create = (input: CreateWorkItemInput): WorkItem =>
  WorkItem.make({
    id: input.id,
    title: input.title,
    status: "open",
    priority: O.some(O.getOrElse(input.priority, () => defaultWorkPriority)),
  });

const isArchived = WorkItemStatus.$match({
  open: () => false,
  assigned: () => false,
  completed: () => false,
  archived: () => true,
});

const isCompleted = WorkItemStatus.$match({
  open: () => false,
  assigned: () => false,
  completed: () => true,
  archived: () => false,
});

const acceptsAssignment = WorkItemStatus.$match({
  open: () => true,
  assigned: () => true,
  completed: () => false,
  archived: () => false,
});

const acceptsCompletion = WorkItemStatus.$match({
  open: () => true,
  assigned: () => true,
  completed: () => true,
  archived: () => false,
});

const acceptsReopen = WorkItemStatus.$match({
  open: () => false,
  assigned: () => false,
  completed: () => true,
  archived: () => false,
});

const requireMutable = (workItem: WorkItem): Effect.Effect<void, WorkItemAlreadyArchived> =>
  isArchived(workItem.status) ? Effect.fail(WorkItemAlreadyArchived.make({ workItemId: workItem.id })) : Effect.void;

const requireTransition = (
  workItem: WorkItem,
  to: WorkItemStatus,
  accepts: (status: WorkItemStatus) => boolean
): Effect.Effect<void, WorkItemInvalidTransition> =>
  accepts(workItem.status)
    ? Effect.void
    : Effect.fail(
        WorkItemInvalidTransition.fromStatus({
          workItemId: workItem.id,
          from: workItem.status,
          to,
        })
      );

/**
 * Assign an open or already assigned WorkItem to a concrete Worker identifier.
 *
 * @example
 * ```ts
 * import { CreateWorkItemInput, WorkItemId, assign, create } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { WorkerId } from "@beep/architecture-lab-domain/entities/Worker"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const assigned = Effect.runSync(
 *   assign(
 *     create(
 *       CreateWorkItemInput.make({
 *         id: S.decodeUnknownSync(WorkItemId)("work-item-1"),
 *         title: "Document topology"
 *       })
 *     ),
 *     S.decodeUnknownSync(WorkerId)(1)
 *   )
 * )
 *
 * if (assigned.status !== "assigned" || O.isNone(assigned.assignee)) {
 *   throw new Error("expected assigned WorkItem")
 * }
 * ```
 *
 * @effects Pure Effect workflow with no service requirements; fails through
 * typed WorkItem domain errors when the item is archived, the assignee is
 * invalid, or the lifecycle transition is unsupported.
 * @category aggregates
 * @since 0.0.0
 */
export const assign = Effect.fn("WorkItem.assign")(function* (workItem: WorkItem, assignee: WorkerId) {
  yield* requireMutable(workItem);
  if (assignee <= 0) {
    return yield* WorkItemAssigneeRequired.make({ workItemId: workItem.id });
  }
  yield* requireTransition(workItem, "assigned", acceptsAssignment);
  return WorkItem.make({
    ...workItem,
    status: "assigned",
    assignee: O.some(assignee),
  });
});

/**
 * Complete an open or assigned WorkItem while leaving an already completed item unchanged.
 *
 * @example
 * ```ts
 * import { CreateWorkItemInput, WorkItemId, complete, create } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const completed = Effect.runSync(
 *   complete(
 *     create(
 *       CreateWorkItemInput.make({
 *         id: S.decodeUnknownSync(WorkItemId)("work-item-1"),
 *         title: "Document topology"
 *       })
 *     )
 *   )
 * )
 *
 * if (completed.status !== "completed") {
 *   throw new Error("expected completed WorkItem")
 * }
 * ```
 *
 * @effects Pure Effect workflow with no service requirements; fails through
 * typed WorkItem domain errors when the item is archived or the lifecycle
 * transition is unsupported.
 * @category aggregates
 * @since 0.0.0
 */
export const complete = Effect.fn("WorkItem.complete")(function* (workItem: WorkItem) {
  yield* requireMutable(workItem);
  if (isCompleted(workItem.status)) {
    return workItem;
  }
  yield* requireTransition(workItem, "completed", acceptsCompletion);
  return WorkItem.make({
    ...workItem,
    status: "completed",
  });
});

/**
 * Reopen a completed WorkItem and clear any assignee carried by the closed aggregate.
 *
 * @example
 * ```ts
 * import { CreateWorkItemInput, WorkItemId, complete, create, reopen } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const reopened = Effect.runSync(
 *   Effect.gen(function* () {
 *     const workItem = create(
 *       CreateWorkItemInput.make({
 *         id: S.decodeUnknownSync(WorkItemId)("work-item-1"),
 *         title: "Document topology"
 *       })
 *     )
 *     const completed = yield* complete(workItem)
 *     return yield* reopen(completed)
 *   })
 * )
 *
 * if (reopened.status !== "open" || O.isSome(reopened.assignee)) {
 *   throw new Error("expected reopened WorkItem without assignee")
 * }
 * ```
 *
 * @effects Pure Effect workflow with no service requirements; fails through
 * typed WorkItem domain errors when the item is archived or the lifecycle
 * transition is unsupported.
 * @category aggregates
 * @since 0.0.0
 */
export const reopen = Effect.fn("WorkItem.reopen")(function* (workItem: WorkItem) {
  yield* requireMutable(workItem);
  yield* requireTransition(workItem, "open", acceptsReopen);
  return WorkItem.make({
    ...workItem,
    status: "open",
  });
});

/**
 * Archive a mutable WorkItem as the terminal lifecycle state.
 *
 * @example
 * ```ts
 * import { CreateWorkItemInput, WorkItemId, archive, create } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const archived = Effect.runSync(
 *   archive(
 *     create(
 *       CreateWorkItemInput.make({
 *         id: S.decodeUnknownSync(WorkItemId)("work-item-1"),
 *         title: "Document topology"
 *       })
 *     )
 *   )
 * )
 *
 * if (archived.status !== "archived") {
 *   throw new Error("expected archived WorkItem")
 * }
 * ```
 *
 * @effects Pure Effect workflow with no service requirements; fails through a
 * typed WorkItem domain error when the item is already archived.
 * @category aggregates
 * @since 0.0.0
 */
export const archive = Effect.fn("WorkItem.archive")(function* (workItem: WorkItem) {
  yield* requireMutable(workItem);
  return WorkItem.make({
    ...workItem,
    status: "archived",
  });
});
