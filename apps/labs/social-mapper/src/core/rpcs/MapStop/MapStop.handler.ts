/**
 * Serves the `MapStop` operation from the library.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { Library } from "../../library.ts";
import type * as Rpc from "effect/rpc/Rpc";
import type { Contract, Payload } from "./MapStop.contract.ts";

/**
 * **Details**
 *
 * Checked against its contract here, so a drift between the two is reported in
 * this file and not where the layer is assembled.
 *
 * **Example** (Hand the handler to a layer)
 *
 * ```ts import.meta.vitest name="Hand the MapStop handler to a layer"
 * import { Handler } from "@/core/rpcs/MapStop/MapStop.handler"
 * import * as P from "effect/Predicate"
 *
 * P.isFunction(Handler) // => true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const Handler = Effect.fn("LibraryRpcs.MapStop")(({ source }: Payload) =>
  Library.use((library) => library.stop(source))
) satisfies Rpc.ToHandlerFn<typeof Contract>;
