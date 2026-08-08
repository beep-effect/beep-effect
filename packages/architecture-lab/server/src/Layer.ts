/**
 * Architecture lab server layer.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { ArchitectureLabConfigLive } from "@beep/architecture-lab-config/layer";
import { Layer } from "effect";
import { WorkItemServerLayer } from "./aggregates/WorkItem/index.ts";
import { WorkerServerLayer } from "./entities/Worker/index.ts";

/**
 * Live architecture lab server layer.
 *
 * **Example** (Provide live layer for listing)
 *
 * ```ts
 * import { WorkItemServer } from "@beep/architecture-lab-server/aggregates/WorkItem"
 * import { ArchitectureLabServerLive } from "@beep/architecture-lab-server/layer"
 * import { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const server = yield* WorkItemServer
 *   return yield* server.list(WorkItemUseCases.ListWorkItemsQuery.make({}))
 * }).pipe(Effect.provide(ArchitectureLabServerLive))
 *
 * Effect.runPromise(program).then((items) => console.log(items.length))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ArchitectureLabServerLive = Layer.mergeAll(WorkItemServerLayer, WorkerServerLayer).pipe(
  Layer.provide(ArchitectureLabConfigLive)
);
