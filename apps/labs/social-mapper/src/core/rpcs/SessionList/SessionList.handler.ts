/**
 * Serves the `SessionList` operation from the kept sessions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { Sessions } from "../../session.ts";
import type * as Rpc from "effect/rpc/Rpc";
import type { Contract, Payload } from "./SessionList.contract.ts";

/**
 * **Details**
 *
 * Checked against its contract here, so a drift between the two is reported in
 * this file and not where the layer is assembled.
 *
 * **Example** (Hand the handler to a layer)
 *
 * ```ts import.meta.vitest name="Hand the SessionList handler to a layer"
 * import { Handler } from "@/core/rpcs/SessionList/SessionList.handler"
 * import * as P from "effect/Predicate"
 *
 * P.isFunction(Handler) // => true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const Handler = Effect.fn("LibraryRpcs.SessionList")((_: Payload) =>
  Sessions.use((sessions) => sessions.list)
) satisfies Rpc.ToHandlerFn<typeof Contract>;
