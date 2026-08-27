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
const pg = ProductEntity.pg;

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
export class Thread extends ProductEntity.Entity<Thread>()(WorkspaceIdentity.ThreadId)(
  {
    title: S.NonEmptyString.annotateKey({
      description: "Human-readable thread title.",
    }).pipe(pg.text()),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace containing the thread.",
    }).pipe(pg.integer(), pg.columnName("workspace_id"), pg.index()),
  },
  $I.annote("Thread", {
    description: "Durable workspace conversation thread.",
  })
) {
  static readonly decodeUnknownSync = S.decodeUnknownSync(Thread);
}
