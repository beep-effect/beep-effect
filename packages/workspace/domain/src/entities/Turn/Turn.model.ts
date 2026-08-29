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
const pg = ProductEntity.pg;

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
export class Turn extends ProductEntity.Entity<Turn>()(WorkspaceIdentity.TurnId)(
  {
    items: TurnItems.annotateKey({
      description: "Non-empty ordered items held by the turn aggregate.",
    }).pipe(pg.jsonb()),
    parentTurnId: S.OptionFromNullOr(WorkspaceIdentity.TurnId)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Optional parent turn lineage; encodes absent roots as SQL/wire null.",
      })
      .pipe(pg.integer(), pg.columnName("parent_turn_id"), pg.index()),
    threadId: WorkspaceIdentity.ThreadId.annotateKey({
      description: "Thread containing the turn.",
    }).pipe(pg.integer(), pg.columnName("thread_id"), pg.index()),
    turnIndex: NonNegativeInt.annotateKey({
      description: "Zero-based turn ordering index within the thread.",
    }).pipe(pg.integer(), pg.columnName("turn_index"), pg.index()),
  },
  $I.annote("Turn", {
    description: "Workspace turn aggregate with parent-turn lineage for branching.",
  })
) {
  static readonly decodeUnknownSync = S.decodeUnknownSync(Turn);
}
