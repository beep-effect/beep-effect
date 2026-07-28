/**
 * Disposable practice knowledge-graph node read-model table.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type { KgNodeKind } from "@beep/law-practice-domain/values";
import type { UnknownRecord } from "@beep/schema";

/**
 * Physical table name for practice knowledge-graph nodes.
 *
 * @remarks
 * Exported separately from {@link kgNodeTable} so that hand-written DDL and
 * projection SQL name the table through one constant rather than a string
 * literal repeated per call site.
 *
 * @example
 * ```ts
 * import { KG_NODE_TABLE_NAME } from "@beep/law-practice-tables/entities/KgNode"
 *
 * const truncate = `TRUNCATE TABLE ${KG_NODE_TABLE_NAME}`
 * console.log(truncate) // "TRUNCATE TABLE kg_node"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const KG_NODE_TABLE_NAME = "kg_node" as const;

/**
 * Drizzle declaration for the packet-owned node projection.
 *
 * @remarks
 * `iri` is the primary key and the join target for both endpoints of
 * {@link kgEdgeTable}, so nodes must be inserted before the edges that
 * reference them.
 *
 * @example
 * ```ts
 * import { kgNodeTable } from "@beep/law-practice-tables/entities/KgNode"
 * import { getTableName } from "drizzle-orm"
 *
 * const row: typeof kgNodeTable.$inferInsert = {
 *   iri: "urn:beep:practice-kg:docket:AB-1234",
 *   kind: "docket",
 *   naturalKey: "AB-1234",
 *   label: "AB-1234 — Acme Corp",
 *   docketFamily: "AB",
 *   client: "Acme Corp",
 *   epistemicStatus: "derived-from-official-records",
 *   provenanceKind: "catalog-digest",
 *   provenanceRef: "sha256:9f2c...",
 *   payload: { sizeBytes: 18342 }
 * }
 *
 * console.log(getTableName(kgNodeTable)) // "kg_node"
 * console.log(row.kind) // "docket"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const kgNodeTable = pgTable(KG_NODE_TABLE_NAME, {
  iri: text("iri").primaryKey(),
  kind: text("kind").notNull().$type<KgNodeKind>(),
  naturalKey: text("natural_key").notNull(),
  label: text("label").notNull(),
  docketFamily: text("docket_family"),
  client: text("client"),
  epistemicStatus: text("epistemic_status").notNull(),
  provenanceKind: text("provenance_kind").notNull(),
  provenanceRef: text("provenance_ref").notNull(),
  payload: jsonb("payload").notNull().$type<UnknownRecord>(),
});
