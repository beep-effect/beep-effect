/**
 * Request-local MCP caller identity propagated by sanitized toolkit dispatch.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $McpKitId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { Context } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $McpKitId.create("McpCaller");

/** Initialized MCP caller identity assigned by the server transport.
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
  { clientId: NonNegativeInt },
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
 * @category references
 * @since 0.0.0
 */
export const CurrentMcpCaller = Context.Reference<O.Option<McpCallerIdentity>>($I`CurrentMcpCaller`, {
  defaultValue: O.none,
});
