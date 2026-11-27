/**
 * Serves the `Profile` operation from the reader of the locator's platform.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { profile } from "../../reader.ts";
import type * as Rpc from "effect/rpc/Rpc";
import type { Contract, Payload } from "./Profile.contract.ts";

/**
 * **Details**
 *
 * Checked against its contract here, so a drift between the two is reported in
 * this file and not where the layer is assembled.
 *
 * **Example** (Hand the handler to a layer)
 *
 * ```ts import.meta.vitest name="Hand the Profile handler to a layer"
 * import { Handler } from "@/core/rpcs/Profile/Profile.handler"
 * import * as P from "effect/Predicate"
 *
 * P.isFunction(Handler) // => true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const Handler = Effect.fn("ReaderRpcs.Profile")(({ locator }: Payload) =>
  profile(locator)
) satisfies Rpc.ToHandlerFn<typeof Contract>;
