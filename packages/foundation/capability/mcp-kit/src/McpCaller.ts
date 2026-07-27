/**
 * Request-local MCP caller identity propagated by sanitized toolkit dispatch.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $McpKitId } from "@beep/identity/packages";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import { Context } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $McpKitId.create("McpCaller");

/** Initialized MCP caller identity assigned by the server transport.
 *
 * @remarks `clientId` identifies one **protocol exchange**, not one session:
 * the HTTP protocol mints it per request (`RpcServer.ts` `clientId++` inside
 * the per-request effect), so consecutive `tools/call` posts of one MCP
 * session carry different values. `sessionId` is the transport-assigned
 * session identifier — the `mcp-session-id` header minted at `initialize` —
 * and is the only stable per-session key available to a dispatch. It is
 * `None` for transports that do not issue one (stdio), where the connection
 * itself is the session.
 * @example
 * ```ts
 * import { McpCallerIdentity } from "@beep/mcp-kit"
 * import { NonNegativeInt } from "@beep/schema"
 * const caller = McpCallerIdentity.make({ clientId: NonNegativeInt.make(1) })
 * console.log(caller.clientId)
 * ```
 * @category models
 * @since 0.0.0
 */
export class McpCallerIdentity extends S.Class<McpCallerIdentity>($I`McpCallerIdentity`)(
  {
    clientId: NonNegativeInt,
    sessionId: S.OptionFromNullOr(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Transport-assigned MCP session identifier; the only stable per-session key.",
      })
    ),
  },
  $I.annote("McpCallerIdentity", {
    description: "Initialized MCP caller identity assigned by the server transport.",
  })
) {}

/** Request-local initialized MCP caller, absent outside a real tool dispatch.
 * @example
 * ```ts
 * import { CurrentMcpCaller } from "@beep/mcp-kit"
 * import { Effect } from "effect"
 * console.log(Effect.runSync(CurrentMcpCaller))
 * ```
 * @category services
 * @since 0.0.0
 */
export const CurrentMcpCaller = Context.Reference<O.Option<McpCallerIdentity>>($I`CurrentMcpCaller`, {
  defaultValue: O.none,
});
