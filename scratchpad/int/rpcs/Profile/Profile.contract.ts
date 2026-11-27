/**
 * The `Profile` operation of the reader contract: what it takes, what it yields
 * and how it fails.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages"
import * as Rpc from "effect/rpc/Rpc"
import * as S from "effect/Schema"
import { Profile } from "../../content.ts"
import { Locator, MapFailure } from "../../locator.ts"

const $I = $ScratchpadId.create("int/rpcs/Profile")

/**
 * **Example** (Name the platform a request is for)
 *
 * ```ts import.meta.vitest name="Name the platform a Profile request is for"
 * import { Locator, RedGifsTarget } from "@beep/scratchpad/int/locator"
 * import { Payload } from "@beep/scratchpad/int/rpcs/Profile/Profile.contract"
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
    locator: Locator
  }).pipe($I.annoteSchema("Payload", { description: "The locator whose profile is read." }))
) {}

/**
 * Reads the one `Profile` a locator denotes, or fails with a `MapFailure`.
 *
 * **Example** (Read the operation's tag)
 *
 * ```ts import.meta.vitest name="Read the Profile operation's tag"
 * import { Contract } from "@beep/scratchpad/int/rpcs/Profile/Profile.contract"
 *
 * Contract._tag // => "Profile"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const Contract = Rpc.make("Profile", {
  payload: Payload,
  success: Profile,
  error: MapFailure
})

export { Profile as Success } from "../../content.ts"
export { MapFailure as Failure } from "../../locator.ts"
