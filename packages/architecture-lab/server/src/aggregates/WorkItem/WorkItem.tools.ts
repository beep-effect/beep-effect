/**
 * WorkItem tool handlers.
 *
 * @packageDocumentation
 * @category tools
 * @since 0.0.0
 */

import type { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public";

/**
 * WorkItem tool names exposed by the architecture lab proof.
 *
 * **Example** (Access create tool name)
 *
 * ```ts
 * import { WorkItemToolNames } from "@beep/architecture-lab-server/aggregates/WorkItem"
 *
 * const createToolName = WorkItemToolNames.create
 *
 * console.log(createToolName) // "architecture_lab.work_item.create"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const WorkItemToolNames = {
  create: "architecture_lab.work_item.create",
  assign: "architecture_lab.work_item.assign",
  complete: "architecture_lab.work_item.complete",
  reopen: "architecture_lab.work_item.reopen",
  archive: "architecture_lab.work_item.archive",
  get: "architecture_lab.work_item.get",
  list: "architecture_lab.work_item.list",
} as const;

/**
 * Build tool-style WorkItem handlers from the public use-case facade.
 *
 * **Example** (Build and invoke handlers)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { makeWorkItemToolHandlers } from "@beep/architecture-lab-server/aggregates/WorkItem"
 * import { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 * const workItem = DomainWorkItem.create(
 *   DomainWorkItem.CreateWorkItemInput.make({
 *     id,
 *     title: "Expose tool handlers",
 *     priority: O.none()
 *   })
 * )
 * const tools = makeWorkItemToolHandlers({
 *   archive: () => Effect.succeed(workItem),
 *   assign: () => Effect.succeed(workItem),
 *   complete: () => Effect.succeed(workItem),
 *   create: () => Effect.succeed(workItem),
 *   get: () => Effect.succeed(workItem),
 *   list: () => Effect.succeed([workItem]),
 *   reopen: () => Effect.succeed(workItem)
 * })
 *
 * Effect.runPromise(
 *   tools["architecture_lab.work_item.get"](WorkItemUseCases.GetWorkItemQuery.make({ id }))
 * ).then((found) => console.log(found.title)) // "Expose tool handlers"
 * ```
 *
 * @effects Returned handlers execute the injected WorkItem use-case effects
 * under stable architecture-lab tool names.
 * @category tools
 * @since 0.0.0
 */
export const makeWorkItemToolHandlers = (useCases: WorkItemUseCases.WorkItemUseCasesShape) => ({
  [WorkItemToolNames.create]: useCases.create,
  [WorkItemToolNames.assign]: useCases.assign,
  [WorkItemToolNames.complete]: useCases.complete,
  [WorkItemToolNames.reopen]: useCases.reopen,
  [WorkItemToolNames.archive]: useCases.archive,
  [WorkItemToolNames.get]: useCases.get,
  [WorkItemToolNames.list]: useCases.list,
});
