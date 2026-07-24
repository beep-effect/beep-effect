/**
 * WorkItem server layer.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import * as WorkItemUseCaseServer from "@beep/architecture-lab-use-cases/server";
import { $ArchitectureLabServerId } from "@beep/identity/packages";
import { Context, Effect, Layer } from "effect";
import { makeWorkItemRepository } from "./WorkItem.repo.ts";
import type { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public";

const $I = $ArchitectureLabServerId.create("aggregates/WorkItem/WorkItem.layer");

/**
 * Build the WorkItem server facade.
 *
 * @example
 * ```ts
 * import { ArchitectureLabConfigTest } from "@beep/architecture-lab-config/test"
 * import { makeWorkItemServer } from "@beep/architecture-lab-server/aggregates/WorkItem"
 * import { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const server = yield* makeWorkItemServer()
 *   return yield* server.list(WorkItemUseCases.ListWorkItemsQuery.make({}))
 * }).pipe(Effect.provide(ArchitectureLabConfigTest))
 *
 * Effect.runPromise(program).then((items) => console.log(items.length)) // 0
 * ```
 *
 * @effects Reads `WorkItemConfig`, allocates the default WorkItem repository,
 * and returns the repository-backed WorkItem use-case facade.
 *
 * @category layers
 * @since 0.0.0
 */
export const makeWorkItemServer = Effect.fn("ArchitectureLab.WorkItemServer.make")(function* () {
  const repository = yield* makeWorkItemRepository();
  return WorkItemUseCaseServer.WorkItem.makeWorkItemUseCases(repository);
});

/**
 * WorkItem server facade service.
 *
 * @example
 * ```ts
 * import { WorkItemServer } from "@beep/architecture-lab-server/aggregates/WorkItem"
 * import { ArchitectureLabServerTest } from "@beep/architecture-lab-server/test"
 * import { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const server = yield* WorkItemServer
 *   return yield* server.list(WorkItemUseCases.ListWorkItemsQuery.make({}))
 * }).pipe(Effect.provide(ArchitectureLabServerTest))
 *
 * Effect.runPromise(program).then((items) => console.log(items.length)) // 0
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class WorkItemServer extends Context.Service<WorkItemServer, WorkItemUseCases.WorkItemUseCasesShape>()(
  $I`WorkItemServer`
) {}

/**
 * Config-dependent WorkItem server layer.
 *
 * @example
 * ```ts
 * import { ArchitectureLabConfigTest } from "@beep/architecture-lab-config/test"
 * import {
 *   WorkItemServer,
 *   WorkItemServerLayer
 * } from "@beep/architecture-lab-server/aggregates/WorkItem"
 * import { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public"
 * import { Effect, Layer } from "effect"
 *
 * const layer = WorkItemServerLayer.pipe(Layer.provide(ArchitectureLabConfigTest))
 *
 * const program = Effect.gen(function* () {
 *   const server = yield* WorkItemServer
 *   return yield* server.list(WorkItemUseCases.ListWorkItemsQuery.make({}))
 * }).pipe(Effect.provide(layer))
 *
 * Effect.runPromise(program).then((items) => console.log(items.length)) // 0
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkItemServerLayer = Layer.effect(WorkItemServer, makeWorkItemServer());
