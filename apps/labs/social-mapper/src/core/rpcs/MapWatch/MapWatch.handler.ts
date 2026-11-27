/**
 * Serves the `MapWatch` operation from the library.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Stream from "effect/Stream";
import { Library } from "../../library.ts";
import type * as Rpc from "effect/rpc/Rpc";
import type { Contract } from "./MapWatch.contract.ts";

/**
 * **Details**
 *
 * Checked against its contract here, so a drift between the two is reported in
 * this file and not where the layer is assembled.
 *
 * **Example** (Hand the handler to a layer)
 *
 * ```ts import.meta.vitest name="Hand the MapWatch handler to a layer"
 * import { Handler } from "@/core/rpcs/MapWatch/MapWatch.handler"
 * import * as P from "effect/Predicate"
 *
 * P.isFunction(Handler) // => true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const Handler = (({ source }) =>
  Stream.unwrap(Library.useSync((library) => library.watch(source)))) satisfies Rpc.ToHandlerFn<typeof Contract>;
