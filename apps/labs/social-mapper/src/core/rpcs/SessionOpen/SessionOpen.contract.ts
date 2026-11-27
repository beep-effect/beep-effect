/**
 * The `SessionOpen` operation of the library contract: open a window for the user to sign in.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SocialMapperId } from "@beep/identity/packages";
import * as Rpc from "effect/rpc/Rpc";
import * as S from "effect/Schema";
import { BrowserFailed } from "../../browser.ts";
import { Session } from "../../session.ts";

const $I = $SocialMapperId.create("core/rpcs/SessionOpen");

/**
 * **Example** (Open the sign-in page of a site)
 *
 * ```ts import.meta.vitest name="Open the sign-in page of a site"
 * import { Payload } from "@/core/rpcs/SessionOpen/SessionOpen.contract"
 * import { Session } from "@/core/session"
 *
 * const payload = Payload.make({
 *   session: Session.make({ platform: "onlyfans" }),
 *   entry: new URL("https://onlyfans.com"),
 * })
 * payload.session.name // => "default"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Payload extends S.Opaque<Payload, { readonly brand: unique symbol }>()(
  S.Struct({
    session: Session,
    entry: S.URLFromString,
  }).pipe($I.annoteSchema("Payload", { description: "The sign-in to keep and the address its window opens at." }))
) {}

/**
 * **Example** (Expect no value back)
 *
 * ```ts import.meta.vitest name="Expect no value back"
 * import { Success } from "@/core/rpcs/SessionOpen/SessionOpen.contract"
 * import * as S from "effect/Schema"
 *
 * S.is(Success)(undefined) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Success = S.Void;

/**
 * Opens a visible window and answers once the user has closed it.
 *
 * **Example** (Read the operation's tag)
 *
 * ```ts import.meta.vitest name="Read the SessionOpen operation's tag"
 * import { Contract } from "@/core/rpcs/SessionOpen/SessionOpen.contract"
 *
 * Contract._tag // => "SessionOpen"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const Contract = Rpc.make("SessionOpen", {
  payload: Payload,
  success: Success,
  error: BrowserFailed,
});

export { BrowserFailed as Failure } from "../../browser.ts";
