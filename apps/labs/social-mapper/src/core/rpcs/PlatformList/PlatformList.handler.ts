/**
 * Serves the `PlatformList` operation from the catalog.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { Catalog } from "../../catalog.ts";
import type * as Rpc from "effect/rpc/Rpc";
import type { Contract, Payload } from "./PlatformList.contract.ts";

/**
 * **Example** (Hand the handler to a layer)
 *
 * ```ts import.meta.vitest name="Hand the PlatformList handler to a layer"
 * import { Handler } from "@/core/rpcs/PlatformList/PlatformList.handler"
 * import * as P from "effect/Predicate"
 *
 * P.isFunction(Handler) // => true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const Handler = Effect.fn("LibraryRpcs.PlatformList")((_: Payload) =>
  Catalog.useSync(({ installed }) => installed)
) satisfies Rpc.ToHandlerFn<typeof Contract>;
