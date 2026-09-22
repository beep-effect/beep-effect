/**
 * Request-local MCP caller identity and the dispatch anchor, both propagated
 * by sanitized toolkit dispatch.
 *
 * The identity carries transport facts only: the protocol exchange id the
 * server assigned and, when a stateful transport echoes one, its session
 * header. The anchor is an opaque, product-neutral slot that host composition
 * may fill; the kit never derives, names, or documents what fills it.
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

/**
 * MCP caller identity assigned by the server transport for one dispatch.
 *
 * **Details**
 *
 * `clientId` identifies one **protocol exchange**: the stateless HTTP
 * protocol mints it per POST and stdio keeps one per connection, so it is a
 * dispatch fact, not a durable key. `sessionId` is the optional
 * `mcp-session-id` header a stateful (pre-`2026-07-28`) transport echoes; it
 * is `None` on every stateless dispatch and on stdio.
 *
 * **Example** (Make identity with clientId)
 *
 * ```ts
 * import { McpCallerIdentity } from "@beep/mcp-kit"
 * import { NonNegativeInt } from "@beep/schema"
 * const caller = McpCallerIdentity.make({ clientId: NonNegativeInt.make(1) })
 * console.log(caller.clientId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpCallerIdentity extends S.Class<McpCallerIdentity>($I`McpCallerIdentity`)(
  {
    clientId: NonNegativeInt.annotateKey({
      description: "Server-assigned id of the protocol exchange that carried this dispatch.",
    }),
    sessionId: S.OptionFromNullOr(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Optional mcp-session-id header echoed by stateful transports; None on stateless and stdio dispatches.",
      })
    ),
  },
  $I.annote("McpCallerIdentity", {
    description: "Transport facts about the MCP caller of one dispatch.",
  })
) {}

/**
 * Request-local MCP caller, absent outside a real tool dispatch.
 *
 * **Example** (Read current MCP caller)
 *
 * ```ts
 * import { CurrentMcpCaller } from "@beep/mcp-kit"
 * import { Effect } from "effect"
 * console.log(Effect.runSync(CurrentMcpCaller))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const CurrentMcpCaller = Context.Reference<O.Option<McpCallerIdentity>>($I`CurrentMcpCaller`, {
  defaultValue: O.none,
});

/**
 * Opaque dispatch anchor: a branded non-empty string that host composition
 * may provide for one dispatch scope. The kit carries it unchanged and never
 * interprets it.
 *
 * **Example** (Brand an anchor value)
 *
 * ```ts
 * import { McpDispatchAnchor } from "@beep/mcp-kit"
 * import * as S from "effect/Schema"
 *
 * const anchor = S.decodeUnknownSync(McpDispatchAnchor)("anchor-1")
 * console.log(anchor)
 * // "anchor-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const McpDispatchAnchor = S.NonEmptyString.pipe(
  S.brand("McpDispatchAnchor"),
  $I.annoteSchema("McpDispatchAnchor", {
    description: "Opaque dispatch anchor supplied by host composition; carried, never interpreted, by the kit.",
  })
);

/**
 * Branded dispatch anchor value.
 *
 * @category models
 * @since 0.0.0
 */
export type McpDispatchAnchor = typeof McpDispatchAnchor.Type;

/**
 * Request-local dispatch anchor, absent unless host composition provides it.
 *
 * **Example** (Read the anchor default)
 *
 * ```ts
 * import { CurrentMcpDispatchAnchor } from "@beep/mcp-kit"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(Effect.runSync(CurrentMcpDispatchAnchor)))
 * // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const CurrentMcpDispatchAnchor = Context.Reference<O.Option<McpDispatchAnchor>>($I`CurrentMcpDispatchAnchor`, {
  defaultValue: O.none,
});
