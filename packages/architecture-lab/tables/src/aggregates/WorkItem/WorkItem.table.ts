/**
 * WorkItem table mapping.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import * as DomainWorkPriority from "@beep/architecture-lab-domain/values/WorkPriority";
import { $ArchitectureLabTablesId } from "@beep/identity/packages";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { pipe, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ArchitectureLabTablesId.create("aggregates/WorkItem/WorkItem.table");

/**
 * Physical Postgres table name for persisted architecture lab WorkItems.
 *
 * **Example** (Assert physical table name)
 *
 * ```ts
 * import { WORK_ITEM_TABLE_NAME } from "@beep/architecture-lab-tables/aggregates/WorkItem"
 *
 * const tableName = WORK_ITEM_TABLE_NAME
 * if (tableName !== "architecture_lab_work_item") {
 *   throw new Error("unexpected WorkItem table name")
 * }
 *
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const WORK_ITEM_TABLE_NAME = "architecture_lab_work_item" as const;

/**
 * Drizzle table projection for architecture lab WorkItem aggregates.
 *
 * **Example** (Verify table projection columns)
 *
 * ```ts
 * import {
 *   WORK_ITEM_TABLE_NAME,
 *   workItemTable
 * } from "@beep/architecture-lab-tables/aggregates/WorkItem"
 * import { getTableName } from "drizzle-orm"
 *
 * const tableName = getTableName(workItemTable)
 * if (tableName !== WORK_ITEM_TABLE_NAME || workItemTable.assigneeId.name !== "assignee_id") {
 *   throw new Error("unexpected WorkItem table projection")
 * }
 *
 * console.log(`${tableName}:${workItemTable.assigneeId.name}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const workItemTable = pgTable(WORK_ITEM_TABLE_NAME, {
  id: text("id").primaryKey().$type<DomainWorkItem.WorkItemId>(),
  title: text("title").notNull().$type<DomainWorkItem.WorkItemTitle>(),
  status: text("status").notNull().$type<DomainWorkItem.WorkItemStatus>(),
  assigneeId: integer("assignee_id").$type<ArchitectureLabIdentity.WorkerId>(),
  priority: text("priority").$type<DomainWorkPriority.WorkPriority>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Selected row shape returned by queries against {@link workItemTable}.
 *
 * **Example** (Satisfy selected row shape)
 *
 * ```ts
 * import {
 *   WorkItemId,
 *   WorkItemStatus,
 *   WorkItemTitle
 * } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { WorkerId } from "@beep/architecture-lab-domain/entities/Worker"
 * import { WorkPriority } from "@beep/architecture-lab-domain/values/WorkPriority"
 * import type { WorkItemRow } from "@beep/architecture-lab-tables/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const row = {
 *   assigneeId: S.decodeUnknownSync(WorkerId)(1),
 *   createdAt: new Date(0),
 *   id: S.decodeUnknownSync(WorkItemId)("work-item-1"),
 *   priority: WorkPriority.Enum.high,
 *   status: WorkItemStatus.Enum.assigned,
 *   title: S.decodeUnknownSync(WorkItemTitle)("Document topology"),
 *   updatedAt: new Date(0)
 * } satisfies WorkItemRow
 *
 * console.log(row.status)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type WorkItemRow = typeof workItemTable.$inferSelect;

/**
 * Insert row shape accepted by writes to {@link workItemTable}.
 *
 * **Example** (Satisfy insert row shape)
 *
 * ```ts
 * import {
 *   WorkItemId,
 *   WorkItemStatus,
 *   WorkItemTitle
 * } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { WorkerId } from "@beep/architecture-lab-domain/entities/Worker"
 * import { WorkPriority } from "@beep/architecture-lab-domain/values/WorkPriority"
 * import type { WorkItemInsert } from "@beep/architecture-lab-tables/aggregates/WorkItem"
 * import * as S from "effect/Schema"
 *
 * const insert = {
 *   assigneeId: S.decodeUnknownSync(WorkerId)(1),
 *   id: S.decodeUnknownSync(WorkItemId)("work-item-1"),
 *   priority: WorkPriority.Enum.normal,
 *   status: WorkItemStatus.Enum.open,
 *   title: S.decodeUnknownSync(WorkItemTitle)("Document topology")
 * } satisfies WorkItemInsert
 *
 * console.log(insert.priority)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type WorkItemInsert = typeof workItemTable.$inferInsert;

class WorkItemInsertRow extends S.Class<WorkItemInsertRow>($I`WorkItemInsertRow`)(
  {
    id: DomainWorkItem.WorkItemId,
    title: DomainWorkItem.WorkItemTitle,
    status: DomainWorkItem.WorkItemStatus,
    assigneeId: S.NullOr(ArchitectureLabIdentity.WorkerId),
    priority: S.NullOr(DomainWorkPriority.WorkPriority),
  },
  $I.annote("WorkItemInsertRow", {
    title: "WorkItem insert row",
    description: "SQL insert row boundary for persisted architecture lab WorkItems.",
  })
) {}

class WorkItemSelectedRow extends S.Class<WorkItemSelectedRow>($I`WorkItemSelectedRow`)(
  {
    id: DomainWorkItem.WorkItemId,
    title: DomainWorkItem.WorkItemTitle,
    status: DomainWorkItem.WorkItemStatus,
    assigneeId: S.NullOr(ArchitectureLabIdentity.WorkerId),
    priority: S.NullOr(DomainWorkPriority.WorkPriority),
    createdAt: S.Date,
    updatedAt: S.Date,
  },
  $I.annote("WorkItemSelectedRow", {
    title: "WorkItem selected row",
    description: "SQL select row boundary for persisted architecture lab WorkItems.",
  })
) {}

const decodeWorkItemInsertRow = S.decodeUnknownResult(WorkItemInsertRow);
const decodeWorkItemSelectedRow = S.decodeUnknownResult(WorkItemSelectedRow);

/**
 * Convert a WorkItem aggregate to the insert row accepted by {@link workItemTable}.
 *
 * **Example** (Project aggregate to insert)
 *
 * ```ts
 * import {
 *   WorkItem,
 *   WorkItemId,
 *   WorkItemTitle
 * } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { WorkerId } from "@beep/architecture-lab-domain/entities/Worker"
 * import { WorkPriority } from "@beep/architecture-lab-domain/values/WorkPriority"
 * import { toWorkItemInsert } from "@beep/architecture-lab-tables/aggregates/WorkItem"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const assignee = S.decodeUnknownSync(WorkerId)(1)
 * const workItem = WorkItem.make({
 *   assignee: O.some(assignee),
 *   id: S.decodeUnknownSync(WorkItemId)("work-item-1"),
 *   priority: O.some(WorkPriority.Enum.high),
 *   status: "assigned",
 *   title: S.decodeUnknownSync(WorkItemTitle)("Document topology")
 * })
 *
 * const insert = toWorkItemInsert(workItem)
 * if (insert.assigneeId !== assignee || insert.priority !== "high") {
 *   throw new Error("expected WorkItem insert projection")
 * }
 *
 * console.log(`${insert.assigneeId}:${insert.priority}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toWorkItemInsert = (workItem: DomainWorkItem.WorkItem): WorkItemInsert => ({
  ...Result.getOrThrow(
    decodeWorkItemInsertRow({
      id: workItem.id,
      title: workItem.title,
      status: workItem.status,
      assigneeId: pipe(workItem.assignee, O.getOrNull),
      priority: pipe(workItem.priority, O.getOrNull),
    })
  ),
});

/**
 * Decode a selected WorkItem row back into the domain aggregate.
 *
 * **Example** (Decode row to aggregate)
 *
 * ```ts
 * import {
 *   WorkItemId,
 *   WorkItemStatus,
 *   WorkItemTitle
 * } from "@beep/architecture-lab-domain/aggregates/WorkItem"
 * import { WorkerId } from "@beep/architecture-lab-domain/entities/Worker"
 * import { WorkPriority } from "@beep/architecture-lab-domain/values/WorkPriority"
 * import { fromWorkItemRow, type WorkItemRow } from "@beep/architecture-lab-tables/aggregates/WorkItem"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const assignee = S.decodeUnknownSync(WorkerId)(1)
 * const row = {
 *   assigneeId: assignee,
 *   createdAt: new Date(0),
 *   id: S.decodeUnknownSync(WorkItemId)("work-item-1"),
 *   priority: WorkPriority.Enum.high,
 *   status: WorkItemStatus.Enum.assigned,
 *   title: S.decodeUnknownSync(WorkItemTitle)("Document topology"),
 *   updatedAt: new Date(0)
 * } satisfies WorkItemRow
 *
 * const workItem = fromWorkItemRow(row)
 * if (O.getOrThrow(workItem.assignee) !== assignee) {
 *   throw new Error("expected WorkItem assignee")
 * }
 *
 * console.log(workItem.status)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromWorkItemRow = (row: WorkItemRow): DomainWorkItem.WorkItem => {
  const decoded = Result.getOrThrow(decodeWorkItemSelectedRow(row));

  return DomainWorkItem.WorkItem.make({
    id: decoded.id,
    title: decoded.title,
    status: decoded.status,
    assignee: O.fromNullishOr(decoded.assigneeId),
    priority: O.fromNullishOr(decoded.priority),
  });
};
