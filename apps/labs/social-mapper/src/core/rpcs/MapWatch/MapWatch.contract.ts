/**
 * The `MapWatch` operation of the library contract: follow the record of a listing while a run fills it.
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

const $I = $SocialMapperId.create("core/rpcs/MapWatch");

/**
 * **Example** (Name the listing to follow)
 *
 * ```ts import.meta.vitest name="Name the listing to follow (MapWatch)"
 * import { CollectionLocator, Locator, RedGifsTarget } from "@/core/locator"
 * import { Payload } from "@/core/rpcs/MapWatch/MapWatch.contract"
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
  }).pipe($I.annoteSchema("Payload", { description: "The listing whose record is followed." }))
) {}

/**
 * Streams the record as it stands and then after every stored page, ending when the run does.
 *
 * **Example** (Read the operation's tag)
 *
 * ```ts import.meta.vitest name="Read the MapWatch operation's tag"
 * import { Contract } from "@/core/rpcs/MapWatch/MapWatch.contract"
 *
 * Contract._tag // => "MapWatch"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const Contract = Rpc.make("MapWatch", {
  payload: Payload,
  success: Inventory,
  error: StoreFailed,
  stream: true,
});

export { Inventory as Success } from "../../inventory.ts";
export { StoreFailed as Failure } from "../../store.ts";
