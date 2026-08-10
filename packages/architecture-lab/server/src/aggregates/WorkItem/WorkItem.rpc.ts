/**
 * WorkItem RPC handlers.
 *
 * @packageDocumentation
 * @category handlers
 * @since 0.0.0
 */

import type { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public";

/**
 * Build RPC-style WorkItem handlers from the public use-case facade.
 *
 * **Example** (Mock use-cases and get work item)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { makeWorkItemRpcHandlers } from "@beep/architecture-lab-server/aggregates/WorkItem"
 * import { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 * const workItem = DomainWorkItem.create(
 *   DomainWorkItem.CreateWorkItemInput.make({
 *     id,
 *     title: "Expose RPC handlers",
 *     priority: O.none()
 *   })
 * )
 * const rpc = makeWorkItemRpcHandlers({
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
 *   rpc.getWorkItem(WorkItemUseCases.GetWorkItemQuery.make({ id }))
 * ).then((found) => console.log(found.id)) // "work-item-1"
 * ```
 *
 * @effects Returned handlers execute the injected WorkItem use-case effects
 * without changing their typed success or failure channels.
 * @category handlers
 * @since 0.0.0
 */
export const makeWorkItemRpcHandlers = (useCases: WorkItemUseCases.WorkItemUseCasesShape) => ({
  createWorkItem: useCases.create,
  assignWorkItem: useCases.assign,
  completeWorkItem: useCases.complete,
  reopenWorkItem: useCases.reopen,
  archiveWorkItem: useCases.archive,
  getWorkItem: useCases.get,
  listWorkItems: useCases.list,
});
