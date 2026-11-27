/**
 * The `Connections` operation of the reader contract: what it takes, what it yields
 * and how it fails.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages"
import * as Rpc from "effect/rpc/Rpc"
import * as S from "effect/Schema"
import { Account, Connection, ConnectionsHidden } from "../../content.ts"
import { Locator, MapFailure } from "../../locator.ts"

const $I = $ScratchpadId.create("int/rpcs/Connections")

/**
 * **Example** (Name the platform a request is for)
 *
 * ```ts import.meta.vitest name="Name the platform a Connections request is for"
 * import { Locator, RedGifsTarget } from "@beep/scratchpad/int/locator"
 * import { Payload } from "@beep/scratchpad/int/rpcs/Connections/Connections.contract"
 *
 * const locator = Locator.cases.redgifs.make({ target: RedGifsTarget.cases.post.make({ id: "calmclip" }) })
 * Payload.make({ locator, connection: "followers" }).locator.platform // => "redgifs"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Payload extends S.Opaque<Payload, { readonly brand: unique symbol }>()(
  S.Struct({
    locator: Locator,
    connection: Connection
  }).pipe($I.annoteSchema("Payload", { description: "The locator whose connections are read and the direction to follow." }))
) {}

/**
 * **Example** (Tell a hidden list from a stopped traversal)
 *
 * ```ts import.meta.vitest name="Tell a hidden list from a stopped traversal"
 * import { ConnectionsHidden } from "@beep/scratchpad/int/content"
 * import { Failure } from "@beep/scratchpad/int/rpcs/Connections/Connections.contract"
 * import * as S from "effect/Schema"
 *
 * S.is(Failure)(ConnectionsHidden.make({ platform: "redgifs", connection: "followers" })) // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const Failure = S.Union([MapFailure, ConnectionsHidden]).pipe(
  $I.annoteSchema("Failure", {
    description: "Why a connection list ended early or could not be read at all."
  })
)

/**
 * @category type-level
 * @since 0.0.0
 */
export type Failure = typeof Failure.Type

/**
 * Streams each `Account` on one side of a follow relationship; a failure ends
 * the stream and keeps its tag.
 *
 * **Example** (Read the operation's tag)
 *
 * ```ts import.meta.vitest name="Read the Connections operation's tag"
 * import { Contract } from "@beep/scratchpad/int/rpcs/Connections/Connections.contract"
 *
 * Contract._tag // => "Connections"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const Contract = Rpc.make("Connections", {
  payload: Payload,
  success: Account,
  error: Failure,
  stream: true
})

export { Account as Success } from "../../content.ts"
