/**
 * The `InventoryList` operation of the library contract: list every record the library keeps.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages"
import * as Rpc from "effect/rpc/Rpc"
import * as S from "effect/Schema"
import { Inventory } from "../../inventory.ts"
import { StoreFailed } from "../../store.ts"

const $I = $ScratchpadId.create("int/rpcs/InventoryList")

/**
 * **Example** (Ask without arguments)
 *
 * ```ts import.meta.vitest name="Ask without arguments (InventoryList)"
 * import { Payload } from "@beep/scratchpad/int/rpcs/InventoryList/InventoryList.contract"
 * import * as R from "effect/Record"
 *
 * R.size(Payload.make({})) // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Payload extends S.Opaque<Payload, { readonly brand: unique symbol }>()(
  S.Struct({}).pipe($I.annoteSchema("Payload", { description: "Nothing: every record is listed." }))
) {}

/**
 * **Example** (Accept an empty library)
 *
 * ```ts import.meta.vitest name="Accept an empty library"
 * import { Success } from "@beep/scratchpad/int/rpcs/InventoryList/InventoryList.contract"
 * import * as S from "effect/Schema"
 *
 * S.is(Success)([]) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Success = S.Array(Inventory).pipe(
  $I.annoteSchema("Success", { description: "Every record the library keeps." })
)

/**
 * @category type-level
 * @since 0.0.0
 */
export type Success = typeof Success.Type;

/**
 * Lists every record the library keeps.
 *
 * **Example** (Read the operation's tag)
 *
 * ```ts import.meta.vitest name="Read the InventoryList operation's tag"
 * import { Contract } from "@beep/scratchpad/int/rpcs/InventoryList/InventoryList.contract"
 *
 * Contract._tag // => "InventoryList"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const Contract = Rpc.make("InventoryList", {
  payload: Payload,
  success: Success,
  error: StoreFailed
})

export { StoreFailed as Failure } from "../../store.ts"
