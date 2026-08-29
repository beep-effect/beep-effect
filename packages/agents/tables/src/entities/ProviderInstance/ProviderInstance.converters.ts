/**
 * Agents ProviderInstance row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { ProviderInstance } from "@beep/agents-domain/entities/ProviderInstance";
import * as S from "effect/Schema";
import type { providerInstanceTable } from "./ProviderInstance.table.ts";

/**
 * Selected agents ProviderInstance row.
 *
 * **Example** (Row matches table select)
 *
 * ```ts
 * import type { providerInstanceTable, ProviderInstanceRow } from "@beep/agents-tables/entities/ProviderInstance"
 *
 * type RowMatchesTable = ProviderInstanceRow extends typeof providerInstanceTable.$inferSelect ? true : false
 * const rowMatchesTable: RowMatchesTable = true
 *
 * console.log(rowMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ProviderInstanceRow = typeof providerInstanceTable.$inferSelect;

/**
 * Insertable agents ProviderInstance row.
 *
 * **Example** (Insert matches table insert)
 *
 * ```ts
 * import type { providerInstanceTable, ProviderInstanceInsert } from "@beep/agents-tables/entities/ProviderInstance"
 *
 * type InsertMatchesTable = ProviderInstanceInsert extends typeof providerInstanceTable.$inferInsert ? true : false
 * const insertMatchesTable: InsertMatchesTable = true
 *
 * console.log(insertMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ProviderInstanceInsert = typeof providerInstanceTable.$inferInsert;

const encodeProviderInstance = S.encodeSync(ProviderInstance);
const decodeProviderInstanceRow = S.decodeUnknownSync(ProviderInstance);

/**
 * Convert a ProviderInstance entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the field-key
 * shape accepted by {@link providerInstanceTable}, whose metadata carries the
 * physical SQL column names. The database-managed `id` (SERIAL) is dropped so
 * the insert defers to the sequence. The encoded row never contains provider
 * tokens: `lastProbe` is the tagged auth snapshot and `envVars` rejects
 * token-bearing names at decode time.
 *
 * **Example** (Insert drops managed id)
 *
 * ```ts
 * import { fromProviderInstanceRow, toProviderInstanceInsert } from "@beep/agents-tables/entities/ProviderInstance"
 * import type { ProviderInstanceRow } from "@beep/agents-tables/entities/ProviderInstance"
 *
 * const row = {
 *   binaryPath: "/usr/local/bin/claude",
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "AgentsProviderInstance",
 *   envVars: {},
 *   homePath: null,
 *   id: 1,
 *   kind: "claude",
 *   label: "Personal Claude",
 *   lastProbe: null,
 *   orgId: 1,
 *   publicId: "agents_provider_instance_a1",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   updatedAt: 2,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * } satisfies ProviderInstanceRow
 *
 * const insert = toProviderInstanceInsert(fromProviderInstanceRow(row))
 * console.log("id" in insert) // false
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toProviderInstanceInsert = (providerInstance: ProviderInstance): ProviderInstanceInsert => {
  const { id: _id, ...rest } = encodeProviderInstance(providerInstance);
  return rest as ProviderInstanceInsert;
};

/**
 * Convert a selected persistence row into a ProviderInstance entity.
 *
 * **Example** (Convert row to entity)
 *
 * ```ts
 * import { fromProviderInstanceRow } from "@beep/agents-tables/entities/ProviderInstance"
 * import type { ProviderInstanceRow } from "@beep/agents-tables/entities/ProviderInstance"
 *
 * const row = {
 *   binaryPath: "/usr/local/bin/codex",
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "AgentsProviderInstance",
 *   envVars: {},
 *   homePath: null,
 *   id: 1,
 *   kind: "codex",
 *   label: "Work Codex",
 *   lastProbe: { status: "unauthenticated", probedAt: "2026-07-11T00:00:00.000Z" },
 *   orgId: 1,
 *   publicId: "agents_provider_instance_a1",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   updatedAt: 2,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * } satisfies ProviderInstanceRow
 *
 * const providerInstance = fromProviderInstanceRow(row)
 * console.log(providerInstance.label)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromProviderInstanceRow = (row: ProviderInstanceRow): ProviderInstance => decodeProviderInstanceRow(row);
