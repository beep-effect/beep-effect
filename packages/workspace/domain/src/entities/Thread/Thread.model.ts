/**
 * Workspace thread entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WorkspaceDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";

const $I = $WorkspaceDomainId.create("entities/Thread/Thread.model");
const ThreadEntity = ProductEntity.make(WorkspaceIdentity.ThreadId);

/**
 * Durable workspace conversation thread.
 *
 * **Example** (Log Thread table name)
 *
 * ```ts
 * import { Thread } from "@beep/workspace-domain"
 *
 * console.log(Thread.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Thread extends ThreadEntity.Entity<Thread>(ThreadEntity.tableName)(
  {
    title: S.NonEmptyString.annotateKey({
      description: "Human-readable thread title.",
    }).pipe(ThreadEntity.pg.text()),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace containing the thread.",
    }).pipe(ThreadEntity.pg.integer(), ThreadEntity.pg.columnName("workspace_id")),
    ...ThreadEntity.identityFields,
  },
  $I.annote("Thread", {
    description: "Durable workspace conversation thread.",
  }),
  (columns) => [
    ThreadEntity.Table.index("workspace_thread_workspace_id_btree_idx", [columns.workspaceId]),
    ...ThreadEntity.entityExtras(columns),
  ]
) {
  static readonly decodeUnknownSync = S.decodeUnknownSync(Thread);
}
