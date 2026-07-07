/**
 * WorkItem HTTP handlers.
 *
 * @packageDocumentation
 * @category handlers
 * @since 0.0.0
 */

import { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public";
import { $ArchitectureLabServerId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect, Match } from "effect";
import * as S from "effect/Schema";

const $I = $ArchitectureLabServerId.create("aggregates/WorkItem/WorkItem.http");

const serviceUnavailableBody = WorkItemUseCases.WorkItemActionFailed.make({
  reason: WorkItemUseCases.WORK_ITEM_ACTION_UNAVAILABLE_REASON,
});
const WorkItemHttpStatusBase = LiteralKit([200, 201, 404, 409, 422, 503]);
const withWorkItemHttpStatusCodecStatics = SchemaUtils.withStatics((schema: typeof WorkItemHttpStatusBase) => ({
  decodeOption: S.decodeUnknownOption(schema),
  fromUnknown: S.decodeUnknownSync(schema),
}));

/**
 * HTTP status values emitted by the WorkItem proof protocol adapter.
 *
 * @example
 * ```ts
 * import {
 *   WorkItemHttpStatus,
 *   type WorkItemHttpStatus as WorkItemHttpStatusType
 * } from "@beep/architecture-lab-server/aggregates/WorkItem"
 *
 * const created: WorkItemHttpStatusType = WorkItemHttpStatus.fromUnknown(201)
 *
 * console.log(WorkItemHttpStatus.is.number201(created)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WorkItemHttpStatus = WorkItemHttpStatusBase.pipe(
  $I.annoteSchema("WorkItemHttpStatus", {
    title: "WorkItem HTTP status",
    description: "HTTP status vocabulary emitted by the WorkItem proof protocol adapter.",
  }),
  SchemaUtils.withLiteralKitStatics(WorkItemHttpStatusBase),
  withWorkItemHttpStatusCodecStatics
);

/**
 * Runtime type for {@link WorkItemHttpStatus}.
 *
 * @example
 * ```ts
 * import type { WorkItemHttpStatus } from "@beep/architecture-lab-server/aggregates/WorkItem"
 *
 * const acceptsStatus = (status: WorkItemHttpStatus) => status
 *
 * console.log(acceptsStatus(503)) // 503
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type WorkItemHttpStatus = typeof WorkItemHttpStatus.Type;

/**
 * Minimal HTTP response envelope used by the architecture lab proof.
 *
 * @example
 * ```ts
 * import { WorkItemHttpResponse } from "@beep/architecture-lab-server/aggregates/WorkItem"
 *
 * const response = WorkItemHttpResponse.make({
 *   status: 201,
 *   body: { id: "work-item-1" }
 * })
 *
 * console.log(response.status) // 201
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class WorkItemHttpResponse extends S.Class<WorkItemHttpResponse>($I`WorkItemHttpResponse`)(
  {
    body: S.Unknown.annotateKey({
      description: "HTTP response body emitted by the proof adapter.",
    }),
    status: WorkItemHttpStatus.annotateKey({
      description: "HTTP status emitted with the body.",
    }),
  },
  $I.annote("WorkItemHttpResponse", {
    title: "WorkItem HTTP response",
    description: "Minimal protocol response envelope used by the architecture lab proof.",
  })
) {}

/**
 * Convert a public WorkItem failure to an HTTP response envelope.
 *
 * @example
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { toWorkItemHttpError } from "@beep/architecture-lab-server/aggregates/WorkItem"
 * import { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 * const response = toWorkItemHttpError(
 *   WorkItemUseCases.WorkItemNotFound.make({ workItemId: id })
 * )
 *
 * console.log(response.status) // 404
 * ```
 *
 * @category handlers
 * @since 0.0.0
 */
export const toWorkItemHttpError = Match.type<WorkItemUseCases.WorkItemActionError>().pipe(
  Match.withReturnType<WorkItemHttpResponse>(),
  Match.tagsExhaustive({
    WorkItemActionFailed: () => WorkItemHttpResponse.make({ status: 503, body: serviceUnavailableBody }),
    WorkItemActionRejected: (error) => WorkItemHttpResponse.make({ status: 422, body: error }),
    WorkItemConflict: (error) => WorkItemHttpResponse.make({ status: 409, body: error }),
    WorkItemNotFound: (error) => WorkItemHttpResponse.make({ status: 404, body: error }),
  })
);

const toSuccess =
  (status: 200 | 201) =>
  (body: unknown): WorkItemHttpResponse =>
    WorkItemHttpResponse.make({ status, body });

/**
 * Build HTTP-style WorkItem handlers from the public use-case facade.
 *
 * @example
 * ```ts
 * import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { makeWorkItemHttpHandlers } from "@beep/architecture-lab-server/aggregates/WorkItem"
 * import { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(DomainWorkItem.WorkItemId)("work-item-1")
 * const workItem = DomainWorkItem.create(
 *   DomainWorkItem.CreateWorkItemInput.make({
 *     id,
 *     title: "Document server handlers",
 *     priority: O.none()
 *   })
 * )
 * const handlers = makeWorkItemHttpHandlers({
 *   archive: () => Effect.succeed(workItem),
 *   assign: () => Effect.succeed(workItem),
 *   complete: () => Effect.succeed(workItem),
 *   create: () => Effect.succeed(workItem),
 *   get: () => Effect.succeed(workItem),
 *   list: () => Effect.succeed([workItem]),
 *   reopen: () => Effect.succeed(workItem)
 * })
 *
 * Effect.runPromise(
 *   handlers.get(WorkItemUseCases.GetWorkItemQuery.make({ id }))
 * ).then((response) => console.log(response.status)) // 200
 * ```
 *
 * @effects Returned handlers execute the injected WorkItem use-case effects and
 * convert typed WorkItem action failures to HTTP response envelopes.
 *
 * @category handlers
 * @since 0.0.0
 */
export const makeWorkItemHttpHandlers = (useCases: WorkItemUseCases.WorkItemUseCasesShape) => ({
  create: (command: WorkItemUseCases.CreateWorkItemCommand): Effect.Effect<WorkItemHttpResponse> =>
    useCases.create(command).pipe(
      Effect.match({
        onFailure: toWorkItemHttpError,
        onSuccess: toSuccess(201),
      })
    ),
  get: (query: WorkItemUseCases.GetWorkItemQuery): Effect.Effect<WorkItemHttpResponse> =>
    useCases.get(query).pipe(
      Effect.match({
        onFailure: toWorkItemHttpError,
        onSuccess: toSuccess(200),
      })
    ),
});
