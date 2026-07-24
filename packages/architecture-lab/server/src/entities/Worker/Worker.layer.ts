/**
 * Worker server layer.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import * as WorkerUseCaseServer from "@beep/architecture-lab-use-cases/server";
import { $ArchitectureLabServerId } from "@beep/identity/packages";
import { Context, Effect, Layer } from "effect";
import { makeWorkerRepository } from "./Worker.repo.ts";
import type { Worker as WorkerUseCases } from "@beep/architecture-lab-use-cases/public";

const $I = $ArchitectureLabServerId.create("entities/Worker/Worker.layer");

/**
 * Build the Worker server facade.
 *
 * @example
 * ```ts
 * import { makeWorkerServer } from "@beep/architecture-lab-server/entities/Worker"
 * import { Worker as WorkerUseCases } from "@beep/architecture-lab-use-cases/public"
 * import { Effect } from "effect"
 *
 * const program = makeWorkerServer().pipe(
 *   Effect.flatMap((server) => server.list(WorkerUseCases.ListWorkersQuery.make({})))
 * )
 *
 * Effect.runPromise(program).then((workers) => console.log(workers.length)) // 0
 * ```
 *
 * @effects Allocates the default Worker repository and returns the
 * repository-backed Worker use-case facade.
 *
 * @category layers
 * @since 0.0.0
 */
export const makeWorkerServer = Effect.fn("ArchitectureLab.WorkerServer.make")(function* () {
  const repository = yield* makeWorkerRepository();
  return WorkerUseCaseServer.Worker.makeWorkerUseCases(repository);
});

/**
 * Worker server facade service.
 *
 * @example
 * ```ts
 * import { WorkerServer } from "@beep/architecture-lab-server/entities/Worker"
 * import { ArchitectureLabServerTest } from "@beep/architecture-lab-server/test"
 * import { Worker as WorkerUseCases } from "@beep/architecture-lab-use-cases/public"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const server = yield* WorkerServer
 *   return yield* server.list(WorkerUseCases.ListWorkersQuery.make({}))
 * }).pipe(Effect.provide(ArchitectureLabServerTest))
 *
 * Effect.runPromise(program).then((workers) => console.log(workers.length)) // 0
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class WorkerServer extends Context.Service<WorkerServer, WorkerUseCases.WorkerUseCasesShape>()(
  $I`WorkerServer`
) {}

/**
 * Worker server layer.
 *
 * @example
 * ```ts
 * import { WorkerServer, WorkerServerLayer } from "@beep/architecture-lab-server/entities/Worker"
 * import { Worker as WorkerUseCases } from "@beep/architecture-lab-use-cases/public"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const server = yield* WorkerServer
 *   return yield* server.list(WorkerUseCases.ListWorkersQuery.make({}))
 * }).pipe(Effect.provide(WorkerServerLayer))
 *
 * Effect.runPromise(program).then((workers) => console.log(workers.length)) // 0
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkerServerLayer = Layer.effect(WorkerServer, makeWorkerServer());
