/**
 * The `MapRun` operation of the library contract: start a run over a listing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SocialMapperId } from "@beep/identity/packages";
import * as Rpc from "effect/rpc/Rpc";
import * as S from "effect/Schema";
import { Inventory } from "../../inventory.ts";
import { Busy, MapMode } from "../../library.ts";
import { CollectionLocatorFromUrl } from "../../locator.ts";
import { StoreFailed } from "../../store.ts";

const $I = $SocialMapperId.create("core/rpcs/MapRun");

/**
 * **Example** (Ask for a run that stops at known posts)
 *
 * ```ts import.meta.vitest name="Ask for a run that stops at known posts (MapRun)"
 * import { CollectionLocator, Locator, RedGifsTarget } from "@/core/locator"
 * import { Payload } from "@/core/rpcs/MapRun/MapRun.contract"
 *
 * const source = CollectionLocator.make(
 *   Locator.cases.redgifs.make({ target: RedGifsTarget.cases.collection.make({ user: "example" }) })
 * )
 * Payload.make({ source, mode: "incremental" }).mode // => "incremental"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Payload extends S.Opaque<Payload, { readonly brand: unique symbol }>()(
  S.Struct({
    source: CollectionLocatorFromUrl,
    mode: MapMode,
  }).pipe($I.annoteSchema("Payload", { description: "The listing to read and how much of it." }))
) {}

/**
 * **Example** (Tell a busy listing from a broken store)
 *
 * ```ts import.meta.vitest name="Tell a busy listing from a broken store"
 * import { Failure } from "@/core/rpcs/MapRun/MapRun.contract"
 * import { StoreFailed } from "@/core/store"
 * import * as S from "effect/Schema"
 *
 * S.is(Failure)(StoreFailed.make({ detail: "disk full" })) // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const Failure = S.Union([Busy, StoreFailed]).pipe(
  $I.annoteSchema("Failure", { description: "Why a run could not be started." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Failure = typeof Failure.Type;

/**
 * Starts a run and answers at once with the record as the run begins.
 *
 * **Example** (Read the operation's tag)
 *
 * ```ts import.meta.vitest name="Read the MapRun operation's tag"
 * import { Contract } from "@/core/rpcs/MapRun/MapRun.contract"
 *
 * Contract._tag // => "MapRun"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const Contract = Rpc.make("MapRun", {
  payload: Payload,
  success: Inventory,
  error: Failure,
});

export { Inventory as Success } from "../../inventory.ts";
