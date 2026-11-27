/**
 * The `SessionList` operation of the library contract: list the sign-ins that are kept.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages"
import * as Rpc from "effect/rpc/Rpc"
import * as S from "effect/Schema"
import { BrowserFailed } from "../../browser.ts"
import { Session } from "../../session.ts"

const $I = $ScratchpadId.create("int/rpcs/SessionList")

/**
 * **Example** (Ask without arguments)
 *
 * ```ts import.meta.vitest name="Ask without arguments (SessionList)"
 * import { Payload } from "@beep/scratchpad/int/rpcs/SessionList/SessionList.contract"
 * import * as R from "effect/Record"
 *
 * R.size(Payload.make({})) // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Payload extends S.Opaque<Payload, { readonly brand: unique symbol }>()(
  S.Struct({}).pipe($I.annoteSchema("Payload", { description: "Nothing: every kept sign-in is listed." }))
) {}

/**
 * **Example** (Accept a user who has signed in nowhere)
 *
 * ```ts import.meta.vitest name="Accept a user who has signed in nowhere"
 * import { Success } from "@beep/scratchpad/int/rpcs/SessionList/SessionList.contract"
 * import * as S from "effect/Schema"
 *
 * S.is(Success)([]) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Success = S.Array(Session).pipe(
  $I.annoteSchema("Success", { description: "Every sign-in that is kept." })
)

/**
 * @category type-level
 * @since 0.0.0
 */
export type Success = typeof Success.Type;

/**
 * Lists the sign-ins that are kept.
 *
 * **Example** (Read the operation's tag)
 *
 * ```ts import.meta.vitest name="Read the SessionList operation's tag"
 * import { Contract } from "@beep/scratchpad/int/rpcs/SessionList/SessionList.contract"
 *
 * Contract._tag // => "SessionList"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const Contract = Rpc.make("SessionList", {
  payload: Payload,
  success: Success,
  error: BrowserFailed
})

export { BrowserFailed as Failure } from "../../browser.ts"
