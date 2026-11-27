/**
 * The `MapStop` operation of the library contract: stop the run over a listing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SocialMapperId } from "@beep/identity/packages";
import * as Rpc from "effect/rpc/Rpc";
import * as S from "effect/Schema";
import { Inventory } from "../../inventory.ts";
import { CollectionLocatorFromUrl } from "../../locator.ts";
import { StoreFailed } from "../../store.ts";

const $I = $SocialMapperId.create("core/rpcs/MapStop");

/**
 * **Example** (Name the listing to stop)
 *
 * ```ts import.meta.vitest name="Name the listing to stop (MapStop)"
 * import { CollectionLocator, Locator, RedGifsTarget } from "@/core/locator"
 * import { Payload } from "@/core/rpcs/MapStop/MapStop.contract"
 *
 * const source = CollectionLocator.make(
 *   Locator.cases.redgifs.make({ target: RedGifsTarget.cases.collection.make({ user: "example" }) })
 * )
 * Payload.make({ source }).source.platform // => "redgifs"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Payload extends S.Opaque<Payload, { readonly brand: unique symbol }>()(
  S.Struct({
    source: CollectionLocatorFromUrl,
  }).pipe($I.annoteSchema("Payload", { description: "The listing whose run is stopped." }))
) {}

/**
 * Stops the run, if one is reading the listing, and answers with the record it left.
 *
 * **Example** (Read the operation's tag)
 *
 * ```ts import.meta.vitest name="Read the MapStop operation's tag"
 * import { Contract } from "@/core/rpcs/MapStop/MapStop.contract"
 *
 * Contract._tag // => "MapStop"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const Contract = Rpc.make("MapStop", {
  payload: Payload,
  success: Inventory,
  error: StoreFailed,
});

export { Inventory as Success } from "../../inventory.ts";
export { StoreFailed as Failure } from "../../store.ts";
