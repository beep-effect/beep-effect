/**
 * WorkItem use-case service.
 *
 * @packageDocumentation
 * @category use-cases
 * @since 0.0.0
 */

import { $ArchitectureLabUseCasesId } from "@beep/identity/packages";
import { Context } from "effect";
import type * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import type { Effect } from "effect";
import type {
  ArchiveWorkItemCommand,
  AssignWorkItemCommand,
  CompleteWorkItemCommand,
  CreateWorkItemCommand,
  GetWorkItemQuery,
  ListWorkItemsQuery,
  ReopenWorkItemCommand,
} from "./WorkItem.commands.ts";
import type { WorkItemActionError } from "./WorkItem.errors.ts";

const $I = $ArchitectureLabUseCasesId.create("aggregates/WorkItem/WorkItem.use-cases");

/**
 * Public WorkItem use-case contract exposed to callers.
 *
 * @example
 * ```ts
 * import {
 *   ListWorkItemsQuery,
 *   WorkItemActionFailed,
 *   type WorkItemUseCasesShape
 * } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import { Effect } from "effect"
 *
 * const unavailable = WorkItemActionFailed.make({ reason: "offline" })
 * const useCases: WorkItemUseCasesShape = {
 *   archive: () => Effect.fail(unavailable),
 *   assign: () => Effect.fail(unavailable),
 *   complete: () => Effect.fail(unavailable),
 *   create: () => Effect.fail(unavailable),
 *   get: () => Effect.fail(unavailable),
 *   list: () => Effect.succeed([]),
 *   reopen: () => Effect.fail(unavailable)
 * }
 *
 * Effect.runPromise(useCases.list(ListWorkItemsQuery.make({}))).then((items) => console.log(items.length)) // 0
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export interface WorkItemUseCasesShape {
  readonly archive: (command: ArchiveWorkItemCommand) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemActionError>;
  readonly assign: (command: AssignWorkItemCommand) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemActionError>;
  readonly complete: (command: CompleteWorkItemCommand) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemActionError>;
  readonly create: (command: CreateWorkItemCommand) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemActionError>;
  readonly get: (query: GetWorkItemQuery) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemActionError>;
  readonly list: (
    query: ListWorkItemsQuery
  ) => Effect.Effect<ReadonlyArray<DomainWorkItem.WorkItem>, WorkItemActionError>;
  readonly reopen: (command: ReopenWorkItemCommand) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemActionError>;
}

/**
 * Context service tag for WorkItem use cases.
 *
 * @remarks
 * The public module declares the tag and contract only. Server code supplies an
 * implementation with a repository-backed layer or `Effect.provideService`.
 *
 * @example
 * ```ts
 * import {
 *   ListWorkItemsQuery,
 *   WorkItemActionFailed,
 *   WorkItemUseCases,
 *   type WorkItemUseCasesShape
 * } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import { Effect } from "effect"
 *
 * const unavailable = WorkItemActionFailed.make({ reason: "offline" })
 * const useCases: WorkItemUseCasesShape = {
 *   archive: () => Effect.fail(unavailable),
 *   assign: () => Effect.fail(unavailable),
 *   complete: () => Effect.fail(unavailable),
 *   create: () => Effect.fail(unavailable),
 *   get: () => Effect.fail(unavailable),
 *   list: () => Effect.succeed([]),
 *   reopen: () => Effect.fail(unavailable)
 * }
 * const program = Effect.gen(function* () {
 *   const service = yield* WorkItemUseCases
 *   return yield* service.list(ListWorkItemsQuery.make({}))
 * }).pipe(Effect.provideService(WorkItemUseCases, useCases))
 *
 * Effect.runPromise(program).then((items) => console.log(items.length)) // 0
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export class WorkItemUseCases extends Context.Service<WorkItemUseCases, WorkItemUseCasesShape>()(
  $I`WorkItemUseCases`
) {}
