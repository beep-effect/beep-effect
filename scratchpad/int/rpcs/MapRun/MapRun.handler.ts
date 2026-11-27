/**
 * Serves the `MapRun` operation from the library.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect"
import type * as Rpc from "effect/rpc/Rpc"
import { Library } from "../../library.ts"
import type { Contract, Payload } from "./MapRun.contract.ts"

/**
 * **Details**
 *
 * Checked against its contract here, so a drift between the two is reported in
 * this file and not where the layer is assembled.
 *
 * **Example** (Hand the handler to a layer)
 *
 * ```ts import.meta.vitest name="Hand the MapRun handler to a layer"
 * import { Handler } from "@beep/scratchpad/int/rpcs/MapRun/MapRun.handler"
 * import * as P from "effect/Predicate"
 *
 * P.isFunction(Handler) // => true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const Handler = Effect.fn("LibraryRpcs.MapRun")(({ mode, source }: Payload) =>
  Library.use((library) => library.map(source, mode))
) satisfies Rpc.ToHandlerFn<typeof Contract>
