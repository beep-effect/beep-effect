/**
 * Worker repository port.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker";
import { $ArchitectureLabUseCasesId } from "@beep/identity/packages";
import { SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { Effect } from "effect";

const $I = $ArchitectureLabUseCasesId.create("entities/Worker/Worker.repository");

/**
 * Persistence failure raised when a Worker row is absent.
 *
 * **Example** (Make not-found error)
 *
 * ```ts
 * import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker"
 * import { WorkerRepositoryNotFound } from "@beep/architecture-lab-use-cases/entities/Worker/server"
 * import * as S from "effect/Schema"
 *
 * const error = WorkerRepositoryNotFound.make({
 *   workerId: S.decodeUnknownSync(DomainWorker.WorkerId)(1)
 * })
 *
 * console.log(error._tag) // "WorkerRepositoryNotFound"
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class WorkerRepositoryNotFound extends TaggedErrorClass<WorkerRepositoryNotFound>($I`WorkerRepositoryNotFound`)(
  "WorkerRepositoryNotFound",
  {
    workerId: DomainWorker.WorkerId,
  },
  $I.annote("WorkerRepositoryNotFound", {
    title: "Worker repository not found",
    description: "The Worker repository could not find the requested entity.",
  })
) {
  static readonly is = S.is(WorkerRepositoryNotFound);
}

/**
 * Persistence failure raised when a Worker write conflicts.
 *
 * **Example** (Make conflict with reason)
 *
 * ```ts
 * import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker"
 * import { WorkerRepositoryConflict } from "@beep/architecture-lab-use-cases/entities/Worker/server"
 * import * as S from "effect/Schema"
 *
 * const error = WorkerRepositoryConflict.make({
 *   workerId: S.decodeUnknownSync(DomainWorker.WorkerId)(1),
 *   reason: "duplicate id"
 * })
 *
 * console.log(error.reason) // "duplicate id"
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class WorkerRepositoryConflict extends TaggedErrorClass<WorkerRepositoryConflict>($I`WorkerRepositoryConflict`)(
  "WorkerRepositoryConflict",
  {
    workerId: DomainWorker.WorkerId,
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty repository conflict diagnostic.",
    }),
  },
  $I.annote("WorkerRepositoryConflict", {
    title: "Worker repository conflict",
    description: "The Worker repository rejected a conflicting write.",
  })
) {
  static readonly is = S.is(WorkerRepositoryConflict);
}

/**
 * Persistence failure raised when the Worker repository is unavailable.
 *
 * **Example** (Make unavailable error)
 *
 * ```ts
 * import { WorkerRepositoryUnavailable } from "@beep/architecture-lab-use-cases/entities/Worker/server"
 *
 * const error = WorkerRepositoryUnavailable.make({ reason: "database connection closed" })
 *
 * console.log(error._tag) // "WorkerRepositoryUnavailable"
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class WorkerRepositoryUnavailable extends TaggedErrorClass<WorkerRepositoryUnavailable>(
  $I`WorkerRepositoryUnavailable`
)(
  "WorkerRepositoryUnavailable",
  {
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty repository availability diagnostic.",
    }),
  },
  $I.annote("WorkerRepositoryUnavailable", {
    title: "Worker repository unavailable",
    description: "The Worker repository could not serve the request.",
  })
) {
  static readonly is = S.is(WorkerRepositoryUnavailable);
}

/**
 * Worker repository failure schema.
 *
 * **Example** (Check repository error membership)
 *
 * ```ts
 * import {
 *   WorkerRepositoryError,
 *   WorkerRepositoryUnavailable,
 * } from "@beep/architecture-lab-use-cases/entities/Worker/server"
 *
 * const isRepositoryError = WorkerRepositoryError.is
 *
 * console.log(isRepositoryError(WorkerRepositoryUnavailable.make({ reason: "maintenance" }))) // true
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const WorkerRepositoryError = S.Union([
  WorkerRepositoryNotFound,
  WorkerRepositoryConflict,
  WorkerRepositoryUnavailable,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("WorkerRepositoryError", {
    title: "Worker repository error",
    description: "Tagged union of Worker repository port failures.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link WorkerRepositoryError}.
 *
 * **Example** (Type a repository error)
 *
 * ```ts
 * import {
 *   WorkerRepositoryUnavailable,
 *   type WorkerRepositoryError
 * } from "@beep/architecture-lab-use-cases/entities/Worker/server"
 *
 * const error: WorkerRepositoryError = WorkerRepositoryUnavailable.make({ reason: "maintenance" })
 *
 * console.log(error._tag) // "WorkerRepositoryUnavailable"
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export type WorkerRepositoryError = typeof WorkerRepositoryError.Type;

/**
 * Worker repository port consumed by the server-side use-case factory.
 *
 * **Details**
 *
 * `create` fails on duplicate identity, `get` fails when no entity exists, and
 * `list` returns repository order for the use-case layer to filter.
 *
 * **Example** (Implement repository shape)
 *
 * ```ts
 * import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker"
 * import {
 *   WorkerRepositoryNotFound,
 *   type WorkerRepositoryShape
 * } from "@beep/architecture-lab-use-cases/entities/Worker/server"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(DomainWorker.WorkerId)(1)
 * const worker = DomainWorker.create(
 *   DomainWorker.CreateWorkerInput.make({
 *     id,
 *     organizationId: S.decodeUnknownSync(DomainWorker.WorkerOrganizationId)(10),
 *     displayName: "Avery Reviewer"
 *   })
 * )
 *
 * const repository: WorkerRepositoryShape = {
 *   create: (created) => Effect.succeed(created),
 *   get: (workerId) =>
 *     workerId === id ? Effect.succeed(worker) : Effect.fail(WorkerRepositoryNotFound.make({ workerId })),
 *   list: Effect.succeed([worker])
 * }
 *
 * Effect.runPromise(repository.list).then((workers) => console.log(workers.length)) // 1
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export interface WorkerRepositoryShape {
  readonly create: (
    worker: DomainWorker.Worker
  ) => Effect.Effect<DomainWorker.Worker, WorkerRepositoryConflict | WorkerRepositoryUnavailable>;
  readonly get: (
    id: DomainWorker.WorkerId
  ) => Effect.Effect<DomainWorker.Worker, WorkerRepositoryNotFound | WorkerRepositoryUnavailable>;
  readonly list: Effect.Effect<ReadonlyArray<DomainWorker.Worker>, WorkerRepositoryUnavailable>;
}

/**
 * Context tag for the Worker repository port.
 *
 * **Example** (Provide WorkerRepository service)
 *
 * ```ts
 * import {
 *   WorkerRepository,
 *   WorkerRepositoryNotFound,
 *   type WorkerRepositoryShape
 * } from "@beep/architecture-lab-use-cases/entities/Worker/server"
 * import { Effect } from "effect"
 *
 * const repository: WorkerRepositoryShape = {
 *   create: (worker) => Effect.succeed(worker),
 *   get: (workerId) => Effect.fail(WorkerRepositoryNotFound.make({ workerId })),
 *   list: Effect.succeed([])
 * }
 *
 * const program = Effect.gen(function* () {
 *   const port = yield* WorkerRepository
 *   return yield* port.list
 * }).pipe(Effect.provideService(WorkerRepository, repository))
 *
 * Effect.runPromise(program).then((workers) => console.log(workers.length)) // 0
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class WorkerRepository extends Context.Service<WorkerRepository, WorkerRepositoryShape>()(
  $I`WorkerRepository`
) {}
