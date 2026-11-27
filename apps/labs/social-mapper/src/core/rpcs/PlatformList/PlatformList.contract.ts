/**
 * The `PlatformList` operation of the library contract: list the platforms that can be mapped.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SocialMapperId } from "@beep/identity/packages";
import * as Rpc from "effect/rpc/Rpc";
import * as S from "effect/Schema";
import { Installed } from "../../catalog.ts";

const $I = $SocialMapperId.create("core/rpcs/PlatformList");

/**
 * **Example** (Ask without arguments)
 *
 * ```ts import.meta.vitest name="Ask without arguments (PlatformList)"
 * import { Payload } from "@/core/rpcs/PlatformList/PlatformList.contract"
 * import * as R from "effect/Record"
 *
 * R.size(Payload.make({})) // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Payload extends S.Opaque<Payload, { readonly brand: unique symbol }>()(
  S.Struct({}).pipe($I.annoteSchema("Payload", { description: "Nothing: every installed platform is listed." }))
) {}

/**
 * **Example** (Accept a program with no mapper)
 *
 * ```ts import.meta.vitest name="Accept a program with no mapper"
 * import { Success } from "@/core/rpcs/PlatformList/PlatformList.contract"
 * import * as S from "effect/Schema"
 *
 * S.is(Success)([]) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Success = S.Array(Installed).pipe(
  $I.annoteSchema("Success", { description: "Every platform that has a mapper." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Success = typeof Success.Type;

/**
 * @category models
 * @since 0.0.0
 */
export const Failure = S.Never;

/**
 * Lists the platforms that can be mapped.
 *
 * **Example** (Read the operation's tag)
 *
 * ```ts import.meta.vitest name="Read the PlatformList operation's tag"
 * import { Contract } from "@/core/rpcs/PlatformList/PlatformList.contract"
 *
 * Contract._tag // => "PlatformList"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const Contract = Rpc.make("PlatformList", {
  payload: Payload,
  success: Success,
});
