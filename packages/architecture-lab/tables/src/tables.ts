/**
 * Architecture lab Drizzle schema.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import * as WorkItem from "./aggregates/WorkItem/index.ts";
import * as Worker from "./entities/Worker/index.ts";

type DbSchemaShape = {
  readonly workItem: typeof WorkItem.workItemTable;
  readonly worker: typeof Worker.workerTable;
};

/**
 * Drizzle schema object containing the architecture lab table projections.
 *
 * @example
 * ```ts
 * import { DbSchema } from "@beep/architecture-lab-tables/tables"
 * import { getTableName } from "drizzle-orm"
 *
 * const workItemTableName = getTableName(DbSchema.workItem)
 * const workerTableName = DbSchema.worker.definition.tableName
 * if (workItemTableName !== "architecture_lab_work_item" || workerTableName !== "architecture_lab_worker") {
 *   throw new Error("unexpected architecture lab schema")
 * }
 *
 * console.log(`${workItemTableName}:${workerTableName}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const DbSchema: DbSchemaShape = {
  workItem: WorkItem.workItemTable,
  worker: Worker.workerTable,
};

/**
 * Type-level view of the architecture lab Drizzle schema object.
 *
 * @example
 * ```ts
 * import { DbSchema, type DbSchema as DbSchemaType } from "@beep/architecture-lab-tables/tables"
 * import { getTableName } from "drizzle-orm"
 *
 * const schema: DbSchemaType = DbSchema
 * const workItemTableName = getTableName(schema.workItem)
 *
 * console.log(workItemTableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type DbSchema = DbSchemaShape;
