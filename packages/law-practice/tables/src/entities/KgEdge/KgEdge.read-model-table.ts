/**
 * Disposable practice knowledge-graph edge read-model table.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { kgNodeTable } from "../KgNode/KgNode.read-model-table.ts";
import type { KgEdgePredicate } from "@beep/law-practice-domain/values";

/**
 * Physical table name for practice knowledge-graph edges.
 *
 * **Details**
 *
 * Exported separately from {@link kgEdgeTable} so that hand-written DDL and
 * projection SQL name the table through one constant rather than a string
 * literal repeated per call site.
 *
 * **Example** (Build truncate SQL statement)
 *
 * ```ts
 * import { KG_EDGE_TABLE_NAME } from "@beep/law-practice-tables/entities/KgEdge"
 *
 * const truncate = `TRUNCATE TABLE ${KG_EDGE_TABLE_NAME}`
 * console.log(truncate) // "TRUNCATE TABLE kg_edge"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const KG_EDGE_TABLE_NAME = "kg_edge" as const;

/**
 * Drizzle declaration for the packet-owned edge projection.
 *
 * **Gotchas**
 *
 * The primary key is the `(subjectIri, predicate, objectIri)` triple, so the same
 * assertion inserted twice collides rather than duplicating — that is what makes
 * a rebuild of the graph idempotent. Both IRI columns reference
 * {@link kgNodeTable}, so their nodes must exist first.
 *
 * **Example** (Infer edge insert shape)
 *
 * ```ts
 * import { kgEdgeTable } from "@beep/law-practice-tables/entities/KgEdge"
 * import { getTableName } from "drizzle-orm"
 *
 * const row: typeof kgEdgeTable.$inferInsert = {
 *   subjectIri: "urn:beep:practice-kg:docket:AB-1234",
 *   predicate: "files_as",
 *   objectIri: "urn:beep:practice-kg:application:16123456",
 *   epistemicStatus: "derived-from-official-records",
 *   provenanceKind: "uspto-anchor",
 *   provenanceRef: "16/123,456"
 * }
 *
 * console.log(getTableName(kgEdgeTable)) // "kg_edge"
 * console.log(row.predicate) // "files_as"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const kgEdgeTable = pgTable(
  KG_EDGE_TABLE_NAME,
  {
    subjectIri: text("subject_iri")
      .notNull()
      .references(() => kgNodeTable.iri),
    predicate: text("predicate").notNull().$type<KgEdgePredicate>(),
    objectIri: text("object_iri")
      .notNull()
      .references(() => kgNodeTable.iri),
    epistemicStatus: text("epistemic_status").notNull(),
    provenanceKind: text("provenance_kind").notNull(),
    provenanceRef: text("provenance_ref").notNull(),
  },
  (table) => [primaryKey({ columns: [table.subjectIri, table.predicate, table.objectIri] })]
);
