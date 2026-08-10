/**
 * WorkItem server-side use-case implementation.
 *
 * @packageDocumentation
 * @category use-cases
 * @since 0.0.0
 */

import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import { A } from "@beep/utils";
import { Effect, Match, pipe } from "effect";
import * as O from "effect/Option";
import {
  WORK_ITEM_ACTION_UNAVAILABLE_REASON,
  WorkItemActionFailed,
  WorkItemActionRejected,
  WorkItemConflict,
  WorkItemNotFound,
} from "./WorkItem.errors.ts";
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
import type { WorkItemRepositoryError, WorkItemRepositoryShape } from "./WorkItem.repository.ts";
import type { WorkItemUseCasesShape } from "./WorkItem.use-cases.ts";

/**
 * Translate repository and aggregate failures to public WorkItem action failures.
 *
 * **Details**
 *
 * Repository availability details are intentionally redacted to
 * {@link WORK_ITEM_ACTION_UNAVAILABLE_REASON}. Domain-level transition
 * failures are exposed as {@link WorkItemActionRejected} with the domain error
 * tag preserved as the public reason.
 *
 * **Example** (Map repository not-found error)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import {
 *   WorkItemRepositoryNotFound,
 *   toWorkItemActionError
 * } from "@beep/architecture-lab-use-cases/aggregates/WorkItem/server"
 * import * as S from "effect/Schema"
 *
 * const publicError = toWorkItemActionError(
 *   WorkItemRepositoryNotFound.make({
 *     workItemId: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 *   })
 * )
 *
 * console.log(publicError._tag) // "WorkItemNotFound"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const toWorkItemActionError: (
  error: WorkItemRepositoryError | DomainWorkItem.WorkItemDomainError
) => WorkItemActionError = Match.type<WorkItemRepositoryError | DomainWorkItem.WorkItemDomainError>().pipe(
  Match.tagsExhaustive({
    WorkItemRepositoryNotFound: (error) => WorkItemNotFound.make({ workItemId: error.workItemId }),
    WorkItemRepositoryConflict: (error) =>
      WorkItemConflict.make({ workItemId: error.workItemId, reason: error.reason }),
    WorkItemRepositoryUnavailable: () => WorkItemActionFailed.make({ reason: WORK_ITEM_ACTION_UNAVAILABLE_REASON }),
    WorkItemAlreadyArchived: (error) =>
      WorkItemActionRejected.make({
        workItemId: error.workItemId,
        reason: error._tag,
      }),
    WorkItemInvalidTransition: (error) =>
      WorkItemActionRejected.make({
        workItemId: error.workItemId,
        reason: error._tag,
      }),
    WorkItemAssigneeRequired: (error) =>
      WorkItemActionRejected.make({
        workItemId: error.workItemId,
        reason: error._tag,
      }),
  })
);

const mutateStoredWorkItem = (
  repository: WorkItemRepositoryShape,
  id: DomainWorkItem.WorkItemId,
  transition: (
    workItem: DomainWorkItem.WorkItem
  ) => Effect.Effect<DomainWorkItem.WorkItem, DomainWorkItem.WorkItemDomainError>
): Effect.Effect<DomainWorkItem.WorkItem, WorkItemActionError> =>
  pipe(
    repository.get(id),
    Effect.flatMap(transition),
    Effect.flatMap(repository.save),
    Effect.mapError(toWorkItemActionError)
  );

/**
 * Build WorkItem use cases from the server repository port.
 *
 * **Details**
 *
 * Lifecycle commands load the current aggregate before applying the domain
 * transition and saving the result. `list` loads the repository result first
 * and applies the optional status filter in the use-case layer.
 *
 * **Example** (List open work items)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import {
 *   ListWorkItemsQuery,
 *   makeWorkItemUseCases,
 *   type WorkItemRepositoryShape
 * } from "@beep/architecture-lab-use-cases/aggregates/WorkItem/server"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 * const workItem = DomainWorkItem.create(
 *   DomainWorkItem.CreateWorkItemInput.make({
 *     id,
 *     title: "Review architecture slice",
 *     priority: O.none()
 *   })
 * )
 * const repository: WorkItemRepositoryShape = {
 *   create: (created) => Effect.succeed(created),
 *   get: () => Effect.succeed(workItem),
 *   list: Effect.succeed([workItem]),
 *   save: (saved) => Effect.succeed(saved)
 * }
 * const useCases = makeWorkItemUseCases(repository)
 * const query = ListWorkItemsQuery.make({ status: O.some("open") })
 *
 * Effect.runPromise(useCases.list(query)).then((items) => console.log(items.length)) // 1
 * ```
 *
 * @effects
 * - `create` constructs a domain aggregate and delegates persistence to
 *   `repository.create`.
 * - `assign`, `complete`, `reopen`, and `archive` call `repository.get`, run the
 *   domain transition, then call `repository.save` in that order.
 * - `get` reads through `repository.get`; `list` reads `repository.list` and
 *   filters the loaded array in memory.
 * @category use-cases
 * @since 0.0.0
 */
export const makeWorkItemUseCases = (repository: WorkItemRepositoryShape): WorkItemUseCasesShape => ({
  create: Effect.fn("ArchitectureLab.WorkItemUseCases.create")(function* (command: CreateWorkItemCommand) {
    return yield* pipe(
      Effect.succeed(DomainWorkItem.create(DomainWorkItem.CreateWorkItemInput.make(command))),
      Effect.flatMap(repository.create),
      Effect.mapError(toWorkItemActionError)
    );
  }),
  assign: Effect.fn("ArchitectureLab.WorkItemUseCases.assign")(function* (command: AssignWorkItemCommand) {
    return yield* mutateStoredWorkItem(repository, command.id, (workItem) =>
      DomainWorkItem.assign(workItem, command.assignee)
    );
  }),
  complete: Effect.fn("ArchitectureLab.WorkItemUseCases.complete")(function* (command: CompleteWorkItemCommand) {
    return yield* mutateStoredWorkItem(repository, command.id, DomainWorkItem.complete);
  }),
  reopen: Effect.fn("ArchitectureLab.WorkItemUseCases.reopen")(function* (command: ReopenWorkItemCommand) {
    return yield* mutateStoredWorkItem(repository, command.id, DomainWorkItem.reopen);
  }),
  archive: Effect.fn("ArchitectureLab.WorkItemUseCases.archive")(function* (command: ArchiveWorkItemCommand) {
    return yield* mutateStoredWorkItem(repository, command.id, DomainWorkItem.archive);
  }),
  get: Effect.fn("ArchitectureLab.WorkItemUseCases.get")(function* (query: GetWorkItemQuery) {
    return yield* pipe(repository.get(query.id), Effect.mapError(toWorkItemActionError));
  }),
  list: Effect.fn("ArchitectureLab.WorkItemUseCases.list")(function* (query: ListWorkItemsQuery) {
    return yield* pipe(
      repository.list,
      Effect.map((workItems) =>
        pipe(
          query.status,
          O.match({
            onNone: () => workItems,
            onSome: (status) => A.filter(workItems, (workItem) => workItem.status === status),
          })
        )
      ),
      Effect.mapError(toWorkItemActionError)
    );
  }),
});
