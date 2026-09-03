/**
 * Message concept-local value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WorkspaceDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";

const $I = $WorkspaceDomainId.create("entities/Message/Message.values");

/**
 * Workspace message author role.
 *
 * **Example** (Check MessageRole user)
 *
 * ```ts
 * import { MessageRole } from "@beep/workspace-domain/entities/Message"
 *
 * console.log(MessageRole.is.user("user"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MessageRole = LiteralKit(["system", "user", "assistant", "agent", "tool"]).pipe(
  SchemaUtils.withCodecStatics(["decodeUnknownSync", "encodeSync", "decodeSync"]),
  $I.annoteSchema("MessageRole", {
    description: "Author role for a workspace message.",
  })
);

/**
 * Runtime type for {@link MessageRole}.
 *
 * @category models
 * @since 0.0.0
 */
export type MessageRole = typeof MessageRole.Type;
