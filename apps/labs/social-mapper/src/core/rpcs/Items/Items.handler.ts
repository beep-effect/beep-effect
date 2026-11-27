/**
 * Serves the `Items` operation from the mapper of the locator's platform.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { items } from "../../mapper.ts";
import type * as Rpc from "effect/rpc/Rpc";
import type { Contract } from "./Items.contract.ts";

/**
 * **Details**
 *
 * Checked against its contract here, so a drift between the two is reported in
 * this file and not where the layer is assembled.
 *
 * **Example** (Hand the handler to a layer)
 *
 * ```ts import.meta.vitest name="Hand the Items handler to a layer"
 * import { Handler } from "@/core/rpcs/Items/Items.handler"
 * import * as P from "effect/Predicate"
 *
 * P.isFunction(Handler) // => true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const Handler = (({ locator }) => items(locator)) satisfies Rpc.ToHandlerFn<typeof Contract>;
