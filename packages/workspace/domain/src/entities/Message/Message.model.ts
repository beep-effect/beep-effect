/**
 * Workspace message entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WorkspaceDomainId } from "@beep/identity/packages";
import { Document } from "@beep/md/Md.model";
import { LiteralKit } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";

const $I = $WorkspaceDomainId.create("entities/Message/Message.model");

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
  $I.annoteSchema("MessageRole", {
    description: "Author role for a workspace message.",
  })
);

/**
 * Runtime type for {@link MessageRole}.
 *
 * **Example** (Assign MessageRole type)
 *
 * ```ts
 * import type { MessageRole } from "@beep/workspace-domain/entities/Message"
 *
 * const value: MessageRole = "assistant"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MessageRole = typeof MessageRole.Type;

/**
 * Md-aligned message content in a workspace turn.
 *
 * **Example** (Log Message table name)
 *
 * ```ts
 * import { Message } from "@beep/workspace-domain"
 *
 * console.log(Message.definition.entityId.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Message extends BaseEntity.Class<Message>($I`Message`)(
  WorkspaceIdentity.MessageId,
  {
    fields: {
      content: Document.annotateKey({
        description: "Md-aligned message document content.",
      }),
      role: MessageRole.annotateKey({
        description: "Author role for the workspace message.",
      }),
      threadId: WorkspaceIdentity.ThreadId.annotateKey({
        description: "Thread containing the message.",
      }),
      turnId: WorkspaceIdentity.TurnId.annotateKey({
        description: "Turn that owns the message content.",
      }),
    },
    persisted: {
      content: EntitySchema.persist.jsonb({
        columnName: "content",
      }),
      role: EntitySchema.persist.literal({
        columnName: "role",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      threadId: EntitySchema.persist.entityId({
        columnName: "thread_id",
        indexHints: [EntitySchema.IndexHint.btree, EntitySchema.IndexHint.lookup],
      }),
      turnId: EntitySchema.persist.entityId({
        columnName: "turn_id",
        indexHints: [EntitySchema.IndexHint.btree, EntitySchema.IndexHint.lookup],
      }),
    },
  },
  $I.annote("Message", {
    description: "Md-aligned message content in a workspace turn.",
  })
) {
  static readonly decodeUnknownSync = S.decodeUnknownSync(Message);
}
