/**
 * Worker server-side use-case implementation.
 *
 * @packageDocumentation
 * @category use-cases
 * @since 0.0.0
 */

import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker";
import { A } from "@beep/utils";
import { Effect, Match, pipe } from "effect";
import * as O from "effect/Option";
import {
  WORKER_ACTION_UNAVAILABLE_REASON,
  WorkerActionFailed,
  WorkerConflict,
  WorkerNotFound,
} from "./Worker.errors.ts";
import type { CreateWorkerCommand, GetWorkerQuery, ListWorkersQuery } from "./Worker.commands.ts";
import type { WorkerActionError } from "./Worker.errors.ts";
import type { WorkerRepositoryError, WorkerRepositoryShape } from "./Worker.repository.ts";
import type { WorkerUseCasesShape } from "./Worker.use-cases.ts";

/**
 * Translate repository failures to public Worker action failures.
 *
 * **Details**
 *
 * Repository availability details are intentionally redacted to
 * {@link WORKER_ACTION_UNAVAILABLE_REASON}; not-found and conflict failures
 * keep the Worker id and conflict reason needed by callers.
 *
 * **Example** (Translate not-found failure)
 *
 * ```ts
 * import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker"
 * import {
 *   WorkerRepositoryNotFound,
 *   toWorkerActionError
 * } from "@beep/architecture-lab-use-cases/entities/Worker/server"
 * import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab"
 * import * as S from "effect/Schema"
 *
 * const publicError = toWorkerActionError(
 *   WorkerRepositoryNotFound.make({
 *     workerId: S.decodeUnknownSync(ArchitectureLabIdentity.WorkerId)(1)
 *   })
 * )
 *
 * console.log(publicError._tag) // "WorkerNotFound"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const toWorkerActionError: (error: WorkerRepositoryError) => WorkerActionError =
  Match.type<WorkerRepositoryError>().pipe(
    Match.tagsExhaustive({
      WorkerRepositoryNotFound: (error) => WorkerNotFound.make({ workerId: error.workerId }),
      WorkerRepositoryConflict: (error) => WorkerConflict.make({ workerId: error.workerId, reason: error.reason }),
      WorkerRepositoryUnavailable: () => WorkerActionFailed.make({ reason: WORKER_ACTION_UNAVAILABLE_REASON }),
    })
  );

/**
 * Build Worker use cases from the server repository port.
 *
 * **Details**
 *
 * `create` constructs the domain entity before delegating to the repository.
 * `list` loads the repository result first and applies the optional status
 * filter in the use-case layer.
 *
 * **Example** (List with status filter)
 *
 * ```ts
 * import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker"
 * import {
 *   ListWorkersQuery,
 *   makeWorkerUseCases,
 *   type WorkerRepositoryShape
 * } from "@beep/architecture-lab-use-cases/entities/Worker/server"
 * import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(ArchitectureLabIdentity.WorkerId)(1)
 * const worker = DomainWorker.create(
 *   DomainWorker.CreateWorkerInput.make({
 *     id,
 *     organizationId: S.decodeUnknownSync(DomainWorker.WorkerOrganizationId)(10),
 *     displayName: "Avery Reviewer"
 *   })
 * )
 * const repository: WorkerRepositoryShape = {
 *   create: (created) => Effect.succeed(created),
 *   get: () => Effect.succeed(worker),
 *   list: Effect.succeed([worker])
 * }
 * const useCases = makeWorkerUseCases(repository)
 * const query = ListWorkersQuery.make({ status: O.some("active") })
 *
 * Effect.runPromise(useCases.list(query)).then((workers) => console.log(workers.length)) // 1
 * ```
 *
 * @effects
 * - `create` builds a domain Worker and delegates persistence to
 *   `repository.create`.
 * - `get` reads through `repository.get`; `list` reads `repository.list` and
 *   filters the loaded array in memory.
 * @category use-cases
 * @since 0.0.0
 */
export const makeWorkerUseCases = (repository: WorkerRepositoryShape): WorkerUseCasesShape => ({
  create: Effect.fn("ArchitectureLab.WorkerUseCases.create")(function* (command: CreateWorkerCommand) {
    return yield* pipe(
      Effect.succeed(DomainWorker.create(DomainWorker.CreateWorkerInput.make(command))),
      Effect.flatMap(repository.create),
      Effect.mapError(toWorkerActionError)
    );
  }),
  get: Effect.fn("ArchitectureLab.WorkerUseCases.get")(function* (query: GetWorkerQuery) {
    return yield* pipe(repository.get(query.id), Effect.mapError(toWorkerActionError));
  }),
  list: Effect.fn("ArchitectureLab.WorkerUseCases.list")(function* (query: ListWorkersQuery) {
    return yield* pipe(
      repository.list,
      Effect.map((workers) =>
        pipe(
          query.status,
          O.match({
            onNone: () => workers,
            onSome: (status) => A.filter(workers, (worker) => worker.status === status),
          })
        )
      ),
      Effect.mapError(toWorkerActionError)
    );
  }),
});
