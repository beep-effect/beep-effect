/**
 * Provider-neutral delivery orchestration over committed store claims.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { AgentMessageStore } from "./AgentMessage.store.ts";
import type { Claim, Receipt, RouterError } from "./AgentMessage.models.ts";
import type { AgentMessageStoreShape } from "./AgentMessage.store.ts";

const $I = $RepoCliId.create("commands/AgentMessage/AgentMessage.service");

/**
 * Native endpoint port, with context receipt distinguished from socket acceptance.
 * **Details**
 * Delivered requires adapter confirmation of destination context receipt. Failed
 * means rejection before submission. Once submission may have occurred, return
 * ambiguous. Typed failures are also interpreted conservatively as ambiguous.
 * **Example** (Inject deterministic delivery)
 * ```ts
 * import { EndpointDispatch } from "@beep/repo-cli/commands/AgentMessage"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * const layer = Layer.succeed(EndpointDispatch, { submit: () => Effect.succeed("delivered") })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class EndpointDispatch extends Context.Service<
  EndpointDispatch,
  {
    readonly submit: (claim: Claim) => Effect.Effect<"delivered" | "failed" | "ambiguous", RouterError>;
  }
>()($I`EndpointDispatch`) {}

/**
 * Router operations preserve all store methods and add scoped delivery.
 * **Example** (Inspect queued mail)
 * ```ts
 * import { AgentMessageRouter } from "@beep/repo-cli/commands/AgentMessage"
 * import * as Effect from "effect/Effect"
 * const program = Effect.gen(function* () { return yield* (yield* AgentMessageRouter).inbox("peer") })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface AgentMessageRouterShape extends AgentMessageStoreShape {
  readonly dispatchOne: (
    endpointId: string,
    ownerId: string,
    now: number,
    leaseUntil: number,
    completedAt: () => Effect.Effect<number>
  ) => Effect.Effect<O.Option<Receipt>, RouterError>;
}

/**
 * Context service for the local managed message router.
 * **Example** (Request the router)
 * ```ts
 * import { AgentMessageRouter } from "@beep/repo-cli/commands/AgentMessage"
 * const service = AgentMessageRouter
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AgentMessageRouter extends Context.Service<AgentMessageRouter, AgentMessageRouterShape>()(
  $I`AgentMessageRouter`
) {}

/**
 * Compose durable claims and an injected native endpoint submission port.
 * **Details**
 * Claim commits before the external call. No SQL transaction spans provider
 * work. Cancellation or a defect leaves the persisted claim for conservative
 * lease recovery; neither condition creates an automatic retry.
 * **Example** (Construct the router)
 * ```ts
 * import { makeAgentMessageRouter } from "@beep/repo-cli/commands/AgentMessage"
 * const router = makeAgentMessageRouter
 * ```
 *
 * @returns Router requiring an injected store and endpoint port.
 * @category constructors
 * @since 0.0.0
 */
export const makeAgentMessageRouter: Effect.Effect<
  AgentMessageRouterShape,
  never,
  AgentMessageStore | EndpointDispatch
> = Effect.gen(function* () {
  const store = yield* AgentMessageStore;
  const endpoints = yield* EndpointDispatch;
  return {
    ...store,
    dispatchOne: Effect.fn("AgentMessageRouter.dispatchOne")(function* (
      endpointId: string,
      ownerId: string,
      now: number,
      leaseUntil: number,
      completedAt: () => Effect.Effect<number>
    ) {
      const claimed = yield* store.claimNext(endpointId, ownerId, now, leaseUntil);
      if (O.isNone(claimed)) return O.none<Receipt>();
      const outcome = yield* Effect.result(endpoints.submit(claimed.value));
      const at = yield* completedAt();
      return O.some(
        yield* Result.match(outcome, {
          onSuccess: (status) => store.complete(claimed.value, status, at),
          onFailure: (failure) =>
            store.complete(
              claimed.value,
              "ambiguous",
              at,
              O.some(Str.takeLeft(`${failure.code}: ${failure.message}`, 1024))
            ),
        })
      );
    }),
  };
});
