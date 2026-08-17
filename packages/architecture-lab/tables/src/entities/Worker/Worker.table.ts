/**
 * Worker table mapping.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker";
import { toPgTable } from "@beep/effect-drizzle/pg";
import { getTableName } from "drizzle-orm";
import { Result } from "effect";
import * as S from "effect/Schema";

/**
 * Drizzle table projection for architecture lab Worker entities.
 *
 * **Example** (Inspect table columns)
 *
 * ```ts
 * import { workerTable } from "@beep/architecture-lab-tables/entities/Worker"
 * import { getColumns, getTableName } from "drizzle-orm"
 *
 * const columns = getColumns(workerTable)
 * const tableName = getTableName(workerTable)
 * if (tableName !== "architecture_lab_worker" || columns.displayName.name !== "display_name") {
 *   throw new Error("unexpected Worker table projection")
 * }
 *
 * console.log(`${tableName}:${columns.displayName.name}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const workerTable = toPgTable(DomainWorker.Worker);

/**
 * Physical Postgres table name derived from the Worker entity definition.
 *
 * **Example** (Read physical table name)
 *
 * ```ts
 * import { WORKER_TABLE_NAME } from "@beep/architecture-lab-tables/entities/Worker"
 *
 * const tableName = WORKER_TABLE_NAME
 * if (tableName !== "architecture_lab_worker") {
 *   throw new Error("unexpected Worker table name")
 * }
 *
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const WORKER_TABLE_NAME = getTableName(workerTable);

/**
 * Selected row shape returned by queries against {@link workerTable}.
 *
 * **Example** (Satisfy selected row shape)
 *
 * ```ts
 * import {
 *   CreateWorkerInput,
 *   WorkerOrganizationId,
 *   create
 * } from "@beep/architecture-lab-domain/entities/Worker"
 * import { WorkerId } from "@beep/shared-domain/identity/ArchitectureLab/WorkerId"
 * import { toWorkerInsert, type WorkerRow } from "@beep/architecture-lab-tables/entities/Worker"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(WorkerId)(1)
 * const worker = create(
 *   CreateWorkerInput.make({
 *     displayName: "Ada Lovelace",
 *     id,
 *     organizationId: S.decodeUnknownSync(WorkerOrganizationId)(1)
 *   })
 * )
 *
 * const row = { ...toWorkerInsert(worker), id } satisfies WorkerRow
 *
 * console.log(row.displayName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type WorkerRow = typeof workerTable.$inferSelect;

/**
 * Insert row shape accepted by writes to {@link workerTable}.
 *
 * **Example** (Type insert row shape)
 *
 * ```ts
 * import {
 *   CreateWorkerInput,
 *   WorkerOrganizationId,
 *   create
 * } from "@beep/architecture-lab-domain/entities/Worker"
 * import { WorkerId } from "@beep/shared-domain/identity/ArchitectureLab/WorkerId"
 * import { toWorkerInsert, type WorkerInsert } from "@beep/architecture-lab-tables/entities/Worker"
 * import * as S from "effect/Schema"
 *
 * const worker = create(
 *   CreateWorkerInput.make({
 *     displayName: "Ada Lovelace",
 *     id: S.decodeUnknownSync(WorkerId)(1),
 *     organizationId: S.decodeUnknownSync(WorkerOrganizationId)(1)
 *   })
 * )
 *
 * const insert: WorkerInsert = toWorkerInsert(worker)
 *
 * console.log(insert.status)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type WorkerInsert = typeof workerTable.$inferInsert;

const encodeWorker = S.encodeResult(DomainWorker.Worker);
const decodeWorker = S.decodeUnknownResult(DomainWorker.Worker);

/**
 * Encode a Worker entity into the insert row accepted by {@link workerTable}.
 *
 * **Example** (Encode entity to insert)
 *
 * ```ts
 * import {
 *   CreateWorkerInput,
 *   WorkerOrganizationId,
 *   create
 * } from "@beep/architecture-lab-domain/entities/Worker"
 * import { WorkerId } from "@beep/shared-domain/identity/ArchitectureLab/WorkerId"
 * import { toWorkerInsert } from "@beep/architecture-lab-tables/entities/Worker"
 * import * as S from "effect/Schema"
 *
 * const worker = create(
 *   CreateWorkerInput.make({
 *     displayName: "Ada Lovelace",
 *     id: S.decodeUnknownSync(WorkerId)(1),
 *     organizationId: S.decodeUnknownSync(WorkerOrganizationId)(1)
 *   })
 * )
 *
 * const insert = toWorkerInsert(worker)
 * if (insert.displayName !== "Ada Lovelace" || insert.status !== "active") {
 *   throw new Error("expected Worker insert projection")
 * }
 *
 * console.log(`${insert.displayName}:${insert.status}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toWorkerInsert = (worker: DomainWorker.Worker): WorkerInsert => Result.getOrThrow(encodeWorker(worker));

/**
 * Decode a selected Worker row back into the domain entity.
 *
 * **Example** (Decode row to entity)
 *
 * ```ts
 * import {
 *   CreateWorkerInput,
 *   WorkerOrganizationId,
 *   create
 * } from "@beep/architecture-lab-domain/entities/Worker"
 * import { WorkerId } from "@beep/shared-domain/identity/ArchitectureLab/WorkerId"
 * import { fromWorkerRow, toWorkerInsert, type WorkerRow } from "@beep/architecture-lab-tables/entities/Worker"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(WorkerId)(1)
 * const worker = create(
 *   CreateWorkerInput.make({
 *     displayName: "Ada Lovelace",
 *     id,
 *     organizationId: S.decodeUnknownSync(WorkerOrganizationId)(1)
 *   })
 * )
 * const row = { ...toWorkerInsert(worker), id } satisfies WorkerRow
 *
 * const decoded = fromWorkerRow(row)
 * if (decoded.displayName !== "Ada Lovelace") {
 *   throw new Error("expected decoded Worker")
 * }
 *
 * console.log(decoded.displayName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromWorkerRow = (row: WorkerRow): DomainWorker.Worker => Result.getOrThrow(decodeWorker(row));
