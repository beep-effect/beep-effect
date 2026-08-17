/**
 * Workspace turn aggregate entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WorkspaceDomainId } from "@beep/identity/packages";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";
import { TurnItems } from "./Turn.values.ts";

const $I = $WorkspaceDomainId.create("entities/Turn/Turn.model");
const TurnEntity = ProductEntity.make(WorkspaceIdentity.TurnId);

/**
 * Workspace turn aggregate with parent-turn lineage for branching.
 *
 * **Example** (Log turn table name)
 *
 * ```ts
 * import { Turn } from "@beep/workspace-domain"
 *
 * console.log(Turn.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Turn extends TurnEntity.Entity<Turn>(TurnEntity.tableName)(
  {
    items: TurnItems.annotateKey({
      description: "Non-empty ordered items held by the turn aggregate.",
    }).pipe(TurnEntity.pg.jsonb()),
    parentTurnId: S.OptionFromNullOr(WorkspaceIdentity.TurnId)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Optional parent turn lineage; encodes absent roots as SQL/wire null.",
      })
      .pipe(TurnEntity.pg.integer(), TurnEntity.pg.columnName("parent_turn_id")),
    threadId: WorkspaceIdentity.ThreadId.annotateKey({
      description: "Thread containing the turn.",
    }).pipe(TurnEntity.pg.integer(), TurnEntity.pg.columnName("thread_id")),
    turnIndex: NonNegativeInt.annotateKey({
      description: "Zero-based turn ordering index within the thread.",
    }).pipe(TurnEntity.pg.integer(), TurnEntity.pg.columnName("turn_index")),
    ...TurnEntity.identityFields,
  },
  $I.annote("Turn", {
    description: "Workspace turn aggregate with parent-turn lineage for branching.",
  }),
  (columns) => [
    TurnEntity.Table.index("workspace_turn_parent_turn_id_btree_idx", [columns.parentTurnId]),
    TurnEntity.Table.index("workspace_turn_thread_id_btree_idx", [columns.threadId]),
    TurnEntity.Table.index("workspace_turn_turn_index_btree_idx", [columns.turnIndex]),
    ...TurnEntity.entityExtras(columns),
  ]
) {
  static readonly decodeUnknownSync = S.decodeUnknownSync(Turn);
}
