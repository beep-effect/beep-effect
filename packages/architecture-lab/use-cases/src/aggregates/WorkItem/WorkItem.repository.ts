/**
 * WorkItem repository port.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import { $ArchitectureLabUseCasesId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { Effect } from "effect";

const $I = $ArchitectureLabUseCasesId.create("aggregates/WorkItem/WorkItem.repository");

/**
 * Persistence failure raised when a WorkItem row is absent.
 *
 * **Example** (Create not-found error)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { WorkItemRepositoryNotFound } from "@beep/architecture-lab-use-cases/aggregates/WorkItem/server"
 * import * as S from "effect/Schema"
 *
 * const error = WorkItemRepositoryNotFound.make({
 *   workItemId: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 * })
 *
 * console.log(error._tag) // "WorkItemRepositoryNotFound"
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class WorkItemRepositoryNotFound extends S.TaggedError<WorkItemRepositoryNotFound>(
  $I`WorkItemRepositoryNotFound`
)(
  "WorkItemRepositoryNotFound",
  {
    workItemId: DomainWorkItem.WorkItemId,
  },
  $I.annote("WorkItemRepositoryNotFound", {
    title: "WorkItem repository not found",
    description: "The WorkItem repository could not find the requested aggregate.",
  })
) {
  static readonly is = S.is(WorkItemRepositoryNotFound);
}

/**
 * Persistence failure raised when a WorkItem write conflicts.
 *
 * **Example** (Create conflict error)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { WorkItemRepositoryConflict } from "@beep/architecture-lab-use-cases/aggregates/WorkItem/server"
 * import * as S from "effect/Schema"
 *
 * const error = WorkItemRepositoryConflict.make({
 *   workItemId: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1"),
 *   reason: "duplicate id"
 * })
 *
 * console.log(error.reason) // "duplicate id"
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class WorkItemRepositoryConflict extends S.TaggedError<WorkItemRepositoryConflict>(
  $I`WorkItemRepositoryConflict`
)(
  "WorkItemRepositoryConflict",
  {
    workItemId: DomainWorkItem.WorkItemId,
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty repository conflict diagnostic.",
    }),
  },
  $I.annote("WorkItemRepositoryConflict", {
    title: "WorkItem repository conflict",
    description: "The WorkItem repository rejected a conflicting write.",
  })
) {
  static readonly is = S.is(WorkItemRepositoryConflict);
}

/**
 * Persistence failure raised when the WorkItem repository is unavailable.
 *
 * **Example** (Create unavailable error)
 *
 * ```ts
 * import { WorkItemRepositoryUnavailable } from "@beep/architecture-lab-use-cases/aggregates/WorkItem/server"
 *
 * const error = WorkItemRepositoryUnavailable.make({ reason: "database connection closed" })
 *
 * console.log(error._tag) // "WorkItemRepositoryUnavailable"
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class WorkItemRepositoryUnavailable extends S.TaggedError<WorkItemRepositoryUnavailable>(
  $I`WorkItemRepositoryUnavailable`
)(
  "WorkItemRepositoryUnavailable",
  {
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty repository availability diagnostic.",
    }),
  },
  $I.annote("WorkItemRepositoryUnavailable", {
    title: "WorkItem repository unavailable",
    description: "The WorkItem repository could not serve the request.",
  })
) {
  static readonly is = S.is(WorkItemRepositoryUnavailable);
}

/**
 * WorkItem repository failure schema.
 *
 * **Example** (Check repository error type)
 *
 * ```ts
 * import {
 *   WorkItemRepositoryError,
 *   WorkItemRepositoryUnavailable,
 * } from "@beep/architecture-lab-use-cases/aggregates/WorkItem/server"
 *
 * const isRepositoryError = WorkItemRepositoryError.is
 *
 * console.log(isRepositoryError(WorkItemRepositoryUnavailable.make({ reason: "maintenance" }))) // true
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const WorkItemRepositoryError = S.Union([
  WorkItemRepositoryNotFound,
  WorkItemRepositoryConflict,
  WorkItemRepositoryUnavailable,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("WorkItemRepositoryError", {
    title: "WorkItem repository error",
    description: "Tagged union of WorkItem repository port failures.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link WorkItemRepositoryError}.
 *
 * **Example** (Annotate repository error type)
 *
 * ```ts
 * import {
 *   WorkItemRepositoryUnavailable,
 *   type WorkItemRepositoryError
 * } from "@beep/architecture-lab-use-cases/aggregates/WorkItem/server"
 *
 * const error: WorkItemRepositoryError = WorkItemRepositoryUnavailable.make({ reason: "maintenance" })
 *
 * console.log(error._tag) // "WorkItemRepositoryUnavailable"
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export type WorkItemRepositoryError = typeof WorkItemRepositoryError.Type;

/**
 * WorkItem repository port consumed by the server-side use-case factory.
 *
 * **Details**
 *
 * `create` fails on duplicate identity, `get` fails when no aggregate exists,
 * `list` returns repository order, and `save` updates an existing aggregate.
 *
 * **Example** (Implement repository shape)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import {
 *   WorkItemRepositoryNotFound,
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
 *
 * const repository: WorkItemRepositoryShape = {
 *   create: (created) => Effect.succeed(created),
 *   get: (workItemId) =>
 *     workItemId === id
 *       ? Effect.succeed(workItem)
 *       : Effect.fail(WorkItemRepositoryNotFound.make({ workItemId })),
 *   list: Effect.succeed([workItem]),
 *   save: (saved) => Effect.succeed(saved)
 * }
 *
 * Effect.runPromise(repository.list).then((items) => console.log(items.length)) // 1
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export interface WorkItemRepositoryShape {
  readonly create: (
    workItem: DomainWorkItem.WorkItem
  ) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemRepositoryConflict | WorkItemRepositoryUnavailable>;
  readonly get: (
    id: DomainWorkItem.WorkItemId
  ) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemRepositoryNotFound | WorkItemRepositoryUnavailable>;
  readonly list: Effect.Effect<ReadonlyArray<DomainWorkItem.WorkItem>, WorkItemRepositoryUnavailable>;
  readonly save: (
    workItem: DomainWorkItem.WorkItem
  ) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemRepositoryNotFound | WorkItemRepositoryUnavailable>;
}

/**
 * Context tag for the WorkItem repository port.
 *
 * **Example** (Provide repository service)
 *
 * ```ts
 * import {
 *   WorkItemRepository,
 *   WorkItemRepositoryNotFound,
 *   type WorkItemRepositoryShape
 * } from "@beep/architecture-lab-use-cases/aggregates/WorkItem/server"
 * import { Effect } from "effect"
 *
 * const repository: WorkItemRepositoryShape = {
 *   create: (workItem) => Effect.succeed(workItem),
 *   get: (workItemId) => Effect.fail(WorkItemRepositoryNotFound.make({ workItemId })),
 *   list: Effect.succeed([]),
 *   save: (workItem) => Effect.succeed(workItem)
 * }
 *
 * const program = Effect.gen(function* () {
 *   const port = yield* WorkItemRepository
 *   return yield* port.list
 * }).pipe(Effect.provideService(WorkItemRepository, repository))
 *
 * Effect.runPromise(program).then((items) => console.log(items.length)) // 0
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class WorkItemRepository extends Context.Service<WorkItemRepository, WorkItemRepositoryShape>()(
  $I`WorkItemRepository`
) {}
