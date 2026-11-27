/**
 * The `Items` operation of the reader contract: what it takes, what it yields
 * and how it fails.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SocialMapperId } from "@beep/identity/packages";
import * as Rpc from "effect/rpc/Rpc";
import * as S from "effect/Schema";
import { Locator, MapFailure, MappedItem } from "../../locator.ts";

const $I = $SocialMapperId.create("core/rpcs/Items");

/**
 * **Example** (Name the platform a request is for)
 *
 * ```ts import.meta.vitest name="Name the platform an Items request is for"
 * import { Locator, RedGifsTarget } from "@/core/locator"
 * import { Payload } from "@/core/rpcs/Items/Items.contract"
 *
 * const locator = Locator.cases.redgifs.make({ target: RedGifsTarget.cases.post.make({ id: "calmclip" }) })
 * Payload.make({ locator }).locator.platform // => "redgifs"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Payload extends S.Opaque<Payload, { readonly brand: unique symbol }>()(
  S.Struct({
    locator: Locator,
  }).pipe($I.annoteSchema("Payload", { description: "The locator whose posts are enumerated." }))
) {}

/**
 * Streams one `MappedItem` for each post a locator denotes; a `MapFailure`
 * ends the stream and keeps its tag.
 *
 * **Example** (Read the operation's tag)
 *
 * ```ts import.meta.vitest name="Read the Items operation's tag"
 * import { Contract } from "@/core/rpcs/Items/Items.contract"
 *
 * Contract._tag // => "Items"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const Contract = Rpc.make("Items", {
  payload: Payload,
  success: MappedItem,
  error: MapFailure,
  stream: true,
});

export { MapFailure as Failure, MappedItem as Success } from "../../locator.ts";
