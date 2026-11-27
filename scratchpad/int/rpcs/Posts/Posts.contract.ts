/**
 * The `Posts` operation of the reader contract: what it takes, what it yields
 * and how it fails.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages"
import * as Rpc from "effect/rpc/Rpc"
import * as S from "effect/Schema"
import { Post } from "../../content.ts"
import { Locator, MapFailure } from "../../locator.ts"

const $I = $ScratchpadId.create("int/rpcs/Posts")

/**
 * **Example** (Name the platform a request is for)
 *
 * ```ts import.meta.vitest name="Name the platform a Posts request is for"
 * import { Locator, RedGifsTarget } from "@beep/scratchpad/int/locator"
 * import { Payload } from "@beep/scratchpad/int/rpcs/Posts/Posts.contract"
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
  }).pipe($I.annoteSchema("Payload", { description: "The locator whose posts are read." }))
) {}

/**
 * Streams each `Post` under a locator; a `MapFailure` ends the stream and keeps
 * its tag.
 *
 * **Example** (Read the operation's tag)
 *
 * ```ts import.meta.vitest name="Read the Posts operation's tag"
 * import { Contract } from "@beep/scratchpad/int/rpcs/Posts/Posts.contract"
 *
 * Contract._tag // => "Posts"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const Contract = Rpc.make("Posts", {
  payload: Payload,
  success: Post,
  error: MapFailure,
  stream: true
})

export { Post as Success } from "../../content.ts"
export { MapFailure as Failure } from "../../locator.ts"
