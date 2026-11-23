/**
 * Epistemic UsageRecord table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * **Example** (Access toUsageRecordInsert export)
 *
 * ```ts
 * import * as UsageRecord from "@beep/epistemic-tables/entities/UsageRecord"
 *
 * console.log(UsageRecord.toUsageRecordInsert)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./UsageRecord.converters.ts";
/**
 * **Example** (Access UsageRecordConverterError export)
 *
 * ```ts
 * import * as UsageRecord from "@beep/epistemic-tables/entities/UsageRecord"
 *
 * console.log(UsageRecord.UsageRecordConverterError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./UsageRecord.errors.ts";
/**
 * **Example** (Access Table entityType path)
 *
 * ```ts
 * import * as UsageRecord from "@beep/epistemic-tables/entities/UsageRecord"
 *
 * console.log(UsageRecord.TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./UsageRecord.table.ts";
