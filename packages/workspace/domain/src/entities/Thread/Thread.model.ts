/**
 * Workspace thread entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WorkspaceDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";

const $I = $WorkspaceDomainId.create("entities/Thread/Thread.model");

/**
 * Durable workspace conversation thread.
 *
 * @example
 * ```ts
 * import { Thread } from "@beep/workspace-domain"
 *
 * console.log(Thread.definition.entityId.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Thread extends BaseEntity.Class<Thread>($I`Thread`)(
  WorkspaceIdentity.ThreadId,
  {
    fields: {
      title: S.NonEmptyString.annotateKey({
        description: "Human-readable thread title.",
      }),
      workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
        description: "Workspace containing the thread.",
      }),
    },
    persisted: {
      title: EntitySchema.persist.text({
        columnName: "title",
      }),
      workspaceId: EntitySchema.persist.entityId({
        columnName: "workspace_id",
        indexHints: [EntitySchema.IndexHint.btree, EntitySchema.IndexHint.lookup],
      }),
    },
  },
  $I.annote("Thread", {
    description: "Durable workspace conversation thread.",
  })
) {}
