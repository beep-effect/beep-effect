/**
 * Client-safe error carried on the chat wire contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsUseCasesId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { Effect, flow } from "effect";
import * as S from "effect/Schema";

const $I = $AgentsUseCasesId.create("processes/Chat/Chat.errors");

/**
 * Public action failure carried on every {@link ChatRpcs} request. The chat rpc
 * handler (app sidecar) translates port and kernel failures into this
 * client-safe shape before they reach the wire, so the desktop client never
 * sees internal error detail.
 *
 * **Example** (Creating ChatActionError with message)
 *
 * ```ts
 * import { ChatActionError } from "@beep/agents-use-cases/public"
 *
 * console.log(ChatActionError.make({ message: "thread not found" }))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ChatActionError extends TaggedErrorClass<ChatActionError>($I`ChatActionError`)(
  "ChatActionError",
  {
    message: S.String,
  },
  $I.annote("ChatActionError", {
    description: "Client-safe failure raised when a chat action cannot be completed.",
  })
) {
  static readonly new = (message: string) => ChatActionError.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);

  static readonly failEffectThunk = flow(this.failEffect, (effect) => () => effect);
}
