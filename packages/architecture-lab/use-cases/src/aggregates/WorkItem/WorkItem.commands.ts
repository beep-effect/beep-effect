/**
 * WorkItem commands and queries.
 *
 * @packageDocumentation
 * @category commands
 * @since 0.0.0
 */

import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import * as DomainWorkPriority from "@beep/architecture-lab-domain/values/WorkPriority";
import { $ArchitectureLabUseCasesId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import * as S from "effect/Schema";

const $I = $ArchitectureLabUseCasesId.create("aggregates/WorkItem/WorkItem.commands");

/**
 * Command payload accepted by the WorkItem creation use case.
 *
 * **Example** (Create with optional priority)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { CreateWorkItemCommand } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const command = CreateWorkItemCommand.make({
 *   id: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1"),
 *   title: "Review architecture slice",
 *   priority: O.some("high")
 * })
 *
 * console.log(O.getOrUndefined(command.priority)) // "high"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class CreateWorkItemCommand extends S.Class<CreateWorkItemCommand>($I`CreateWorkItemCommand`)(
  {
    id: DomainWorkItem.WorkItemId.annotateKey({
      description: "WorkItem identity assigned by the caller.",
    }),
    title: DomainWorkItem.WorkItemTitle.annotateKey({
      description: "Human-readable WorkItem title.",
    }),
    priority: S.OptionFromOptionalKey(DomainWorkPriority.WorkPriority).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional requested WorkItem priority.",
    }),
  },
  $I.annote("CreateWorkItemCommand", {
    title: "Create WorkItem command",
    description: "Public command for creating a canonical architecture lab WorkItem.",
  })
) {}

/**
 * Command payload for assigning a WorkItem to a Worker.
 *
 * **Example** (Assign WorkItem to Worker)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker"
 * import { AssignWorkItemCommand } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const command = AssignWorkItemCommand.make({
 *   id: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1"),
 *   assignee: S.decodeUnknownSync(ArchitectureLabIdentity.WorkerId)(1)
 * })
 *
 * console.log(command.assignee) // 1
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class AssignWorkItemCommand extends S.Class<AssignWorkItemCommand>($I`AssignWorkItemCommand`)(
  {
    id: DomainWorkItem.WorkItemId.annotateKey({
      description: "WorkItem identity to assign.",
    }),
    assignee: ArchitectureLabIdentity.WorkerId.annotateKey({
      description: "Worker identity receiving the WorkItem assignment.",
    }),
  },
  $I.annote("AssignWorkItemCommand", {
    title: "Assign WorkItem command",
    description: "Public command for assigning a canonical architecture lab WorkItem.",
  })
) {}

/**
 * Command payload for completing a WorkItem.
 *
 * **Example** (Complete WorkItem by id)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { CompleteWorkItemCommand } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const command = CompleteWorkItemCommand.make({
 *   id: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 * })
 *
 * console.log(command.id) // "work-item-1"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class CompleteWorkItemCommand extends S.Class<CompleteWorkItemCommand>($I`CompleteWorkItemCommand`)(
  {
    id: DomainWorkItem.WorkItemId.annotateKey({
      description: "WorkItem identity to complete.",
    }),
  },
  $I.annote("CompleteWorkItemCommand", {
    title: "Complete WorkItem command",
    description: "Public command for completing a canonical architecture lab WorkItem.",
  })
) {}

/**
 * Command payload for reopening a completed WorkItem.
 *
 * **Example** (Reopen completed WorkItem)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { ReopenWorkItemCommand } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const command = ReopenWorkItemCommand.make({
 *   id: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 * })
 *
 * console.log(command.id) // "work-item-1"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ReopenWorkItemCommand extends S.Class<ReopenWorkItemCommand>($I`ReopenWorkItemCommand`)(
  {
    id: DomainWorkItem.WorkItemId.annotateKey({
      description: "WorkItem identity to reopen.",
    }),
  },
  $I.annote("ReopenWorkItemCommand", {
    title: "Reopen WorkItem command",
    description: "Public command for reopening a completed canonical architecture lab WorkItem.",
  })
) {}

/**
 * Command payload for archiving a WorkItem.
 *
 * **Example** (Archive WorkItem by id)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { ArchiveWorkItemCommand } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const command = ArchiveWorkItemCommand.make({
 *   id: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 * })
 *
 * console.log(command.id) // "work-item-1"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ArchiveWorkItemCommand extends S.Class<ArchiveWorkItemCommand>($I`ArchiveWorkItemCommand`)(
  {
    id: DomainWorkItem.WorkItemId.annotateKey({
      description: "WorkItem identity to archive.",
    }),
  },
  $I.annote("ArchiveWorkItemCommand", {
    title: "Archive WorkItem command",
    description: "Public command for archiving a canonical architecture lab WorkItem.",
  })
) {}

/**
 * Query payload for loading a single WorkItem.
 *
 * **Example** (Load WorkItem by id)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { GetWorkItemQuery } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const query = GetWorkItemQuery.make({
 *   id: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 * })
 *
 * console.log(query.id) // "work-item-1"
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export class GetWorkItemQuery extends S.Class<GetWorkItemQuery>($I`GetWorkItemQuery`)(
  {
    id: DomainWorkItem.WorkItemId.annotateKey({
      description: "WorkItem identity to load.",
    }),
  },
  $I.annote("GetWorkItemQuery", {
    title: "Get WorkItem query",
    description: "Public query for loading one canonical architecture lab WorkItem.",
  })
) {}

/**
 * Query payload for listing WorkItems, optionally constrained by lifecycle status.
 *
 * **Example** (List by lifecycle status)
 *
 * ```ts
 * import { ListWorkItemsQuery } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import * as O from "effect/Option"
 *
 * const query = ListWorkItemsQuery.make({ status: O.some("assigned") })
 *
 * console.log(O.getOrUndefined(query.status)) // "assigned"
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export class ListWorkItemsQuery extends S.Class<ListWorkItemsQuery>($I`ListWorkItemsQuery`)(
  {
    status: S.OptionFromOptionalKey(DomainWorkItem.WorkItemStatus).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional lifecycle status filter applied after repository listing.",
    }),
  },
  $I.annote("ListWorkItemsQuery", {
    title: "List WorkItems query",
    description: "Public query for listing canonical architecture lab WorkItems.",
  })
) {}
