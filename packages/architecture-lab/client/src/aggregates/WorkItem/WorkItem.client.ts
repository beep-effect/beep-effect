/**
 * WorkItem client facade for command/query transport adapters.
 *
 * **Details**
 *
 * The module defines only the client-side contract and service tag. Concrete
 * HTTP, RPC, or in-memory transports supply the actual command/query effects.
 *
 * @packageDocumentation
 * @category clients
 * @since 0.0.0
 */

import { $ArchitectureLabClientId } from "@beep/identity/packages";
import { Context } from "effect";
import type * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import type { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public";
import type { Effect } from "effect";

const $I = $ArchitectureLabClientId.create("aggregates/WorkItem/WorkItem.client");

/**
 * Transport boundary for WorkItem command and query calls.
 *
 * **Details**
 *
 * Implementations own the remote call, serialization, retry, and authentication
 * policy. The contract preserves the public WorkItem use-case error channel so
 * callers do not depend on server repository details.
 *
 * **Example** (Stub transport create call)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import {
 *   CreateWorkItemCommand,
 *   type WorkItemActionError
 * } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import type { WorkItemClientTransport } from "@beep/architecture-lab-client/aggregates/WorkItem"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 * const workItem = DomainWorkItem.create(
 *   DomainWorkItem.CreateWorkItemInput.make({
 *     id,
 *     title: "Review architecture slice"
 *   })
 * )
 * const succeed = (): Effect.Effect<DomainWorkItem.WorkItem, WorkItemActionError> =>
 *   Effect.succeed(workItem)
 *
 * const transport: WorkItemClientTransport = {
 *   archive: succeed,
 *   assign: succeed,
 *   complete: succeed,
 *   create: succeed,
 *   get: succeed,
 *   list: () => Effect.succeed([workItem]),
 *   reopen: succeed
 * }
 *
 * const created = Effect.runSync(
 *   transport.create(
 *     CreateWorkItemCommand.make({
 *       id,
 *       title: "Review architecture slice"
 *     })
 *   )
 * )
 *
 * if (created.status !== "open") {
 *   throw new Error("expected transport to resolve an open WorkItem")
 * }
 * ```
 *
 * @category clients
 * @since 0.0.0
 */
export interface WorkItemClientTransport {
  readonly archive: (
    command: WorkItemUseCases.ArchiveWorkItemCommand
  ) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemUseCases.WorkItemActionError>;
  readonly assign: (
    command: WorkItemUseCases.AssignWorkItemCommand
  ) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemUseCases.WorkItemActionError>;
  readonly complete: (
    command: WorkItemUseCases.CompleteWorkItemCommand
  ) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemUseCases.WorkItemActionError>;
  readonly create: (
    command: WorkItemUseCases.CreateWorkItemCommand
  ) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemUseCases.WorkItemActionError>;
  readonly get: (
    query: WorkItemUseCases.GetWorkItemQuery
  ) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemUseCases.WorkItemActionError>;
  readonly list: (
    query: WorkItemUseCases.ListWorkItemsQuery
  ) => Effect.Effect<ReadonlyArray<DomainWorkItem.WorkItem>, WorkItemUseCases.WorkItemActionError>;
  readonly reopen: (
    command: WorkItemUseCases.ReopenWorkItemCommand
  ) => Effect.Effect<DomainWorkItem.WorkItem, WorkItemUseCases.WorkItemActionError>;
}

/**
 * Facade shape exposed through the WorkItem client service.
 *
 * **Example** (Build client and list)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { ListWorkItemsQuery, type WorkItemActionError } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import type { WorkItemClientShape } from "@beep/architecture-lab-client/aggregates/WorkItem"
 * import { makeWorkItemClient, type WorkItemClientTransport } from "@beep/architecture-lab-client/aggregates/WorkItem"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const workItem = DomainWorkItem.create(
 *   DomainWorkItem.CreateWorkItemInput.make({
 *     id: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1"),
 *     title: "Review architecture slice"
 *   })
 * )
 * const succeed = (): Effect.Effect<DomainWorkItem.WorkItem, WorkItemActionError> =>
 *   Effect.succeed(workItem)
 * const transport: WorkItemClientTransport = {
 *   archive: succeed,
 *   assign: succeed,
 *   complete: succeed,
 *   create: succeed,
 *   get: succeed,
 *   list: () => Effect.succeed([workItem]),
 *   reopen: succeed
 * }
 *
 * const client: WorkItemClientShape = makeWorkItemClient(transport)
 * const items = Effect.runSync(client.list(ListWorkItemsQuery.make({})))
 *
 * if (items.length !== 1) {
 *   throw new Error("expected one WorkItem from the client facade")
 * }
 * ```
 *
 * @category clients
 * @since 0.0.0
 */
export interface WorkItemClientShape extends WorkItemClientTransport {}

/**
 * Effect context service tag for the WorkItem client facade.
 *
 * **Details**
 *
 * Applications provide this tag with a facade built by
 * {@link makeWorkItemClient}. Consumers can then depend on `WorkItemClient`
 * instead of a concrete transport implementation.
 *
 * **Example** (Provide client service tag)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { ListWorkItemsQuery, type WorkItemActionError } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import { WorkItemClient, makeWorkItemClient, type WorkItemClientTransport } from "@beep/architecture-lab-client/aggregates/WorkItem"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const workItem = DomainWorkItem.create(
 *   DomainWorkItem.CreateWorkItemInput.make({
 *     id: S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1"),
 *     title: "Review architecture slice"
 *   })
 * )
 * const succeed = (): Effect.Effect<DomainWorkItem.WorkItem, WorkItemActionError> =>
 *   Effect.succeed(workItem)
 * const transport: WorkItemClientTransport = {
 *   archive: succeed,
 *   assign: succeed,
 *   complete: succeed,
 *   create: succeed,
 *   get: succeed,
 *   list: () => Effect.succeed([workItem]),
 *   reopen: succeed
 * }
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* WorkItemClient
 *   const items = yield* client.list(ListWorkItemsQuery.make({}))
 *   return items.length
 * }).pipe(Effect.provideService(WorkItemClient, makeWorkItemClient(transport)))
 *
 * if (Effect.runSync(program) !== 1) {
 *   throw new Error("expected provided WorkItemClient to list one item")
 * }
 * ```
 *
 * @category clients
 * @since 0.0.0
 */
export class WorkItemClient extends Context.Service<WorkItemClient, WorkItemClientShape>()($I`WorkItemClient`) {}

/**
 * Build the WorkItem client facade from a concrete transport.
 *
 * **Details**
 *
 * The facade is intentionally thin: it forwards each method directly to the
 * supplied transport and does not wrap, retry, or reinterpret failures.
 *
 * **Example** (Forward create to transport)
 *
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { CreateWorkItemCommand, type WorkItemActionError } from "@beep/architecture-lab-use-cases/aggregates/WorkItem"
 * import { makeWorkItemClient, type WorkItemClientTransport } from "@beep/architecture-lab-client/aggregates/WorkItem"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 * const workItem = DomainWorkItem.create(
 *   DomainWorkItem.CreateWorkItemInput.make({
 *     id,
 *     title: "Review architecture slice"
 *   })
 * )
 * const succeed = (): Effect.Effect<DomainWorkItem.WorkItem, WorkItemActionError> =>
 *   Effect.succeed(workItem)
 * let createCalls = 0
 * const transport: WorkItemClientTransport = {
 *   archive: succeed,
 *   assign: succeed,
 *   complete: succeed,
 *   create: () => {
 *     createCalls += 1
 *     return Effect.succeed(workItem)
 *   },
 *   get: succeed,
 *   list: () => Effect.succeed([workItem]),
 *   reopen: succeed
 * }
 *
 * const client = makeWorkItemClient(transport)
 * const created = Effect.runSync(
 *   client.create(
 *     CreateWorkItemCommand.make({
 *       id,
 *       title: "Review architecture slice"
 *     })
 *   )
 * )
 *
 * if (created.status !== "open" || createCalls !== 1) {
 *   throw new Error("expected facade to forward create to the transport")
 * }
 * ```
 *
 * @see {@link WorkItemClientTransport} for the transport contract the facade mirrors.
 * @category clients
 * @since 0.0.0
 */
export const makeWorkItemClient = (transport: WorkItemClientTransport): WorkItemClientShape => ({
  create: transport.create,
  assign: transport.assign,
  complete: transport.complete,
  reopen: transport.reopen,
  archive: transport.archive,
  get: transport.get,
  list: transport.list,
});
