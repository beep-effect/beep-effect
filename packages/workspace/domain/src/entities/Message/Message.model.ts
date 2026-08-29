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
const pg = ProductEntity.pg;

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
export class Message extends ProductEntity.Entity<Message>()(WorkspaceIdentity.MessageId)(
  {
    content: Document.annotateKey({
      description: "Md-aligned message document content.",
    }).pipe(pg.jsonb()),
    role: MessageRole.annotateKey({
      description: "Author role for the workspace message.",
    }).pipe(pg.text(), pg.index({ name: "workspace_message_role_lookup_idx" })),
    threadId: WorkspaceIdentity.ThreadId.annotateKey({
      description: "Thread containing the message.",
    }).pipe(pg.integer(), pg.columnName("thread_id"), pg.index()),
    turnId: WorkspaceIdentity.TurnId.annotateKey({
      description: "Turn that owns the message content.",
    }).pipe(pg.integer(), pg.columnName("turn_id"), pg.index()),
  },
  $I.annote("Message", {
    description: "Md-aligned message content in a workspace turn.",
  })
) {
  static readonly decodeUnknownSync = S.decodeUnknownSync(Message);
}
