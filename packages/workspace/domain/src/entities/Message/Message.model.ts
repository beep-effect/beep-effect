/**
 * Workspace message entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WorkspaceDomainId } from "@beep/identity/packages";
import { Document } from "@beep/md/Md.model";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";
import { MessageRole } from "./Message.values.ts";

const $I = $WorkspaceDomainId.create("entities/Message/Message.model");
const MessageEntity = ProductEntity.make(WorkspaceIdentity.MessageId);

/**
 * Md-aligned message content in a workspace turn.
 *
 * **Example** (Log Message table name)
 *
 * ```ts
 * import { Message } from "@beep/workspace-domain"
 *
 * console.log(Message.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Message extends MessageEntity.Entity<Message>(MessageEntity.tableName)(
  {
    content: Document.annotateKey({
      description: "Md-aligned message document content.",
    }).pipe(MessageEntity.pg.jsonb()),
    role: MessageRole.annotateKey({
      description: "Author role for the workspace message.",
    }).pipe(MessageEntity.pg.text()),
    threadId: WorkspaceIdentity.ThreadId.annotateKey({
      description: "Thread containing the message.",
    }).pipe(MessageEntity.pg.integer(), MessageEntity.pg.columnName("thread_id")),
    turnId: WorkspaceIdentity.TurnId.annotateKey({
      description: "Turn that owns the message content.",
    }).pipe(MessageEntity.pg.integer(), MessageEntity.pg.columnName("turn_id")),
    ...MessageEntity.identityFields,
  },
  $I.annote("Message", {
    description: "Md-aligned message content in a workspace turn.",
  }),
  (columns) => [
    MessageEntity.Table.index("workspace_message_role_lookup_idx", [columns.role]),
    MessageEntity.Table.index("workspace_message_thread_id_btree_idx", [columns.threadId]),
    MessageEntity.Table.index("workspace_message_turn_id_btree_idx", [columns.turnId]),
    ...MessageEntity.entityExtras(columns),
  ]
) {
  static readonly decodeUnknownSync = S.decodeUnknownSync(Message);
}
