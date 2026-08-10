/**
 * Architecture lab server test layer.
 *
 * @packageDocumentation
 * @category testing
 * @since 0.0.0
 */

import { ArchitectureLabConfigTest } from "@beep/architecture-lab-config/test";
import { Layer } from "effect";
import { WorkItemServerLayer } from "./aggregates/WorkItem/index.ts";
import { WorkerServerLayer } from "./entities/Worker/index.ts";

/**
 * Test architecture lab server layer.
 *
 * **Example** (List workers with test layer)
 *
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
 * @category testing
 * @since 0.0.0
 */
export const ArchitectureLabServerTest = Layer.mergeAll(WorkItemServerLayer, WorkerServerLayer).pipe(
  Layer.provide(ArchitectureLabConfigTest)
);
