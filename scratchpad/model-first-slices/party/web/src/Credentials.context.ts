import * as Context from "effect/Context";
import { $PartyWebId } from "@proto/kernel/Identity";
import * as Effect from "effect/Effect";
import type * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";

const $I = $PartyWebId.create("Credentials.context");

/**
 * The signed-in caller's credentials, as the headers every binding sends.
 * The browser app provides its session's; a test provides a fixture's.
 *
 * @category services
 * @since 0.0.0
 */
export class Credentials extends Context.Service<
  Credentials,
  { readonly headers: Effect.Effect<Headers.Input> }
>()($I`Credentials`) {}

/**
 * Fixed headers: what a test or a single-user page signs in with.
 *
 * **Example** (A fixed credential)
 * ```ts
 * import { fixedCredentials } from "@proto/party-web/Credentials.context";
 *
 * const layer = fixedCredentials({ authorization: "Bearer token" });
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const fixedCredentials = (headers: Headers.Input) =>
  Layer.succeed(Credentials, { headers: Effect.succeed(headers) });
