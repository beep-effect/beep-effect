/**
 * Serves the `SessionOpen` operation from the kept sessions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect"
import type * as Rpc from "effect/rpc/Rpc"
import { Sessions } from "../../session.ts"
import type { Contract, Payload } from "./SessionOpen.contract.ts"

/**
 * **Details**
 *
 * Checked against its contract here, so a drift between the two is reported in
 * this file and not where the layer is assembled.
 *
 * **Example** (Hand the handler to a layer)
 *
 * ```ts import.meta.vitest name="Hand the SessionOpen handler to a layer"
 * import { Handler } from "@beep/scratchpad/int/rpcs/SessionOpen/SessionOpen.handler"
 * import * as P from "effect/Predicate"
 *
 * P.isFunction(Handler) // => true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const Handler = Effect.fn("LibraryRpcs.SessionOpen")(({ entry, session }: Payload) =>
  Sessions.use((sessions) => sessions.signIn(session, entry))
) satisfies Rpc.ToHandlerFn<typeof Contract>
