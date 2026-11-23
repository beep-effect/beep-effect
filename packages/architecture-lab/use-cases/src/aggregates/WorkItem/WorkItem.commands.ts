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
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import * as Effect from "effect/Effect";
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
export class CreateWorkItemCommand extends S.Opaque<CreateWorkItemCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    id: DomainWorkItem.WorkItemId.annotateKey({
      description: "WorkItem identity assigned by the caller.",
    }),
    title: DomainWorkItem.WorkItemTitle.annotateKey({
      description: "Human-readable WorkItem title.",
    }),
    priority: S.OptionFromOptionalKey(DomainWorkPriority.WorkPriority)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Optional requested WorkItem priority.",
      }),
  }).pipe(
    $I.annoteSchema("CreateWorkItemCommand", {
      title: "Create WorkItem command",
      description: "Public command for creating a canonical architecture lab WorkItem.",
    })
  )
) {}

/**
 * **Example** (Assign WorkItem to Worker)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { AssignWorkItemCommand } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab"
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
export class AssignWorkItemCommand extends S.Opaque<AssignWorkItemCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    id: DomainWorkItem.WorkItemId.annotateKey({
      description: "WorkItem identity to assign.",
    }),
    assignee: ArchitectureLabIdentity.WorkerId.annotateKey({
      description: "Worker identity receiving the WorkItem assignment.",
    }),
  }).pipe(
    $I.annoteSchema("AssignWorkItemCommand", {
      title: "Assign WorkItem command",
      description: "Public command for assigning a canonical architecture lab WorkItem.",
    })
  )
) {}

/**
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
export class CompleteWorkItemCommand extends S.Opaque<CompleteWorkItemCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    id: DomainWorkItem.WorkItemId.annotateKey({
      description: "WorkItem identity to complete.",
    }),
  }).pipe(
    $I.annoteSchema("CompleteWorkItemCommand", {
      title: "Complete WorkItem command",
      description: "Public command for completing a canonical architecture lab WorkItem.",
    })
  )
) {}

/**
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
export class ReopenWorkItemCommand extends S.Opaque<ReopenWorkItemCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    id: DomainWorkItem.WorkItemId.annotateKey({
      description: "WorkItem identity to reopen.",
    }),
  }).pipe(
    $I.annoteSchema("ReopenWorkItemCommand", {
      title: "Reopen WorkItem command",
      description: "Public command for reopening a completed canonical architecture lab WorkItem.",
    })
  )
) {}

/**
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
export class ArchiveWorkItemCommand extends S.Opaque<ArchiveWorkItemCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    id: DomainWorkItem.WorkItemId.annotateKey({
      description: "WorkItem identity to archive.",
    }),
  }).pipe(
    $I.annoteSchema("ArchiveWorkItemCommand", {
      title: "Archive WorkItem command",
      description: "Public command for archiving a canonical architecture lab WorkItem.",
    })
  )
) {}

/**
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
export class GetWorkItemQuery extends S.Opaque<GetWorkItemQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    id: DomainWorkItem.WorkItemId.annotateKey({
      description: "WorkItem identity to load.",
    }),
  }).pipe(
    $I.annoteSchema("GetWorkItemQuery", {
      title: "Get WorkItem query",
      description: "Public query for loading one canonical architecture lab WorkItem.",
    })
  )
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
export class ListWorkItemsQuery extends S.Opaque<ListWorkItemsQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.OptionFromOptionalKey(DomainWorkItem.WorkItemStatus)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Optional lifecycle status filter applied after repository listing.",
      }),
  }).pipe(
    $I.annoteSchema("ListWorkItemsQuery", {
      title: "List WorkItems query",
      description: "Public query for listing canonical architecture lab WorkItems.",
    })
  )
) {}
