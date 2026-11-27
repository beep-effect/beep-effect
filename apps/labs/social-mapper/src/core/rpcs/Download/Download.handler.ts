/**
 * Serves the `Download` operation from the download service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { Downloads } from "../../download.ts";
import type * as Rpc from "effect/rpc/Rpc";
import type { Contract, Payload } from "./Download.contract.ts";

/**
 * **Details**
 *
 * Checked against its contract here, so a drift between the two is reported in
 * this file and not where the layer is assembled.
 *
 * **Example** (Hand the handler to a layer)
 *
 * ```ts import.meta.vitest name="Hand the Download handler to a layer"
 * import { Handler } from "@/core/rpcs/Download/Download.handler"
 * import * as P from "effect/Predicate"
 *
 * P.isFunction(Handler) // => true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const Handler = Effect.fn("LibraryRpcs.Download")(({ source }: Payload) =>
  Downloads.use((downloads) => downloads.pending(source))
) satisfies Rpc.ToHandlerFn<typeof Contract>;
