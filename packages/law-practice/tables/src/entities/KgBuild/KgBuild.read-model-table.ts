/**
 * Disposable practice knowledge-graph build-provenance read-model table.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type { UnknownRecord } from "@beep/schema";

/**
 * Physical table name for practice knowledge-graph build provenance.
 *
 * **Details**
 *
 * Exported separately from {@link kgBuildTable} so that hand-written DDL and
 * projection SQL name the table through one constant rather than a string
 * literal repeated per call site.
 *
 * **Example** (Build truncate SQL statement)
 *
 * ```ts
 * import { KG_BUILD_TABLE_NAME } from "@beep/law-practice-tables/entities/KgBuild"
 *
 * const truncate = `TRUNCATE TABLE ${KG_BUILD_TABLE_NAME}`
 * console.log(truncate) // "TRUNCATE TABLE kg_build"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const KG_BUILD_TABLE_NAME = "kg_build" as const;

/**
 * Drizzle declaration for the packet-owned build-provenance projection.
 *
 * **Details**
 *
 * One row per bundle build, recording which source runs were folded in and the
 * counts the build settled on. It is what lets a bundle handed to a reader be
 * traced back to the corpus snapshot it was projected from.
 *
 * **Example** (Infer insert row shape)
 *
 * ```ts
 * import { kgBuildTable } from "@beep/law-practice-tables/entities/KgBuild"
 * import { getTableName } from "drizzle-orm"
 *
 * const row: typeof kgBuildTable.$inferInsert = {
 *   bundleVersion: "2026.07.1",
 *   builtFromRuns: "base,refresh-2026-07",
 *   counts: { nodes: 8421, edges: 19233, documents: 6104, emails: 2317 },
 *   builtAt: "2026-07-27T18:04:11.000Z"
 * }
 *
 * console.log(getTableName(kgBuildTable)) // "kg_build"
 * console.log(row.builtFromRuns) // "base,refresh-2026-07"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const kgBuildTable = pgTable(KG_BUILD_TABLE_NAME, {
  bundleVersion: text("bundle_version").notNull(),
  builtFromRuns: text("built_from_runs").notNull(),
  counts: jsonb("counts").notNull().$type<UnknownRecord>(),
  builtAt: text("built_at").notNull(),
});
