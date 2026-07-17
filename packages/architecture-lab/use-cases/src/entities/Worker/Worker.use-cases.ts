/**
 * Worker use-case service.
 *
 * @packageDocumentation
 * @category use-cases
 * @since 0.0.0
 */

import { $ArchitectureLabUseCasesId } from "@beep/identity/packages";
import { Context } from "effect";
import type * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker";
import type { Effect } from "effect";
import type { CreateWorkerCommand, GetWorkerQuery, ListWorkersQuery } from "./Worker.commands.ts";
import type { WorkerActionError } from "./Worker.errors.ts";

const $I = $ArchitectureLabUseCasesId.create("entities/Worker/Worker.use-cases");

/**
 * Public Worker use-case contract exposed to callers.
 *
 * @example
 * ```ts
 * import {
 *   ListWorkersQuery,
 *   WorkerActionFailed,
 *   type WorkerUseCasesShape
 * } from "@beep/architecture-lab-use-cases/entities/Worker"
 * import { Effect } from "effect"
 *
 * const unavailable = WorkerActionFailed.make({ reason: "offline" })
 * const useCases: WorkerUseCasesShape = {
 *   create: () => Effect.fail(unavailable),
 *   get: () => Effect.fail(unavailable),
 *   list: () => Effect.succeed([])
 * }
 *
 * Effect.runPromise(useCases.list(ListWorkersQuery.make({}))).then((workers) => console.log(workers.length)) // 0
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export interface WorkerUseCasesShape {
  readonly create: (command: CreateWorkerCommand) => Effect.Effect<DomainWorker.Worker, WorkerActionError>;
  readonly get: (query: GetWorkerQuery) => Effect.Effect<DomainWorker.Worker, WorkerActionError>;
  readonly list: (query: ListWorkersQuery) => Effect.Effect<ReadonlyArray<DomainWorker.Worker>, WorkerActionError>;
}

/**
 * Context service tag for Worker use cases.
 *
 * @remarks
 * The public module declares the tag and contract only. Server code supplies an
 * implementation with a repository-backed layer or `Effect.provideService`.
 *
 * @example
 * ```ts
 * import {
 *   ListWorkersQuery,
 *   WorkerActionFailed,
 *   WorkerUseCases,
 *   type WorkerUseCasesShape
 * } from "@beep/architecture-lab-use-cases/entities/Worker"
 * import { Effect } from "effect"
 *
 * const unavailable = WorkerActionFailed.make({ reason: "offline" })
 * const useCases: WorkerUseCasesShape = {
 *   create: () => Effect.fail(unavailable),
 *   get: () => Effect.fail(unavailable),
 *   list: () => Effect.succeed([])
 * }
 * const program = Effect.gen(function* () {
 *   const service = yield* WorkerUseCases
 *   return yield* service.list(ListWorkersQuery.make({}))
 * }).pipe(Effect.provideService(WorkerUseCases, useCases))
 *
 * Effect.runPromise(program).then((workers) => console.log(workers.length)) // 0
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export class WorkerUseCases extends Context.Service<WorkerUseCases, WorkerUseCasesShape>()($I`WorkerUseCases`) {}
