/**
 * Practice knowledge-graph read-model composition and row types.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { kgBuildTable } from "./entities/KgBuild/KgBuild.read-model-table.ts";
import { kgEdgeTable } from "./entities/KgEdge/KgEdge.read-model-table.ts";
import { kgNodeTable } from "./entities/KgNode/KgNode.read-model-table.ts";

/**
 * Drizzle schema for packet-owned practice knowledge-graph read models.
 *
 * @remarks
 * This is the whole schema a bundle's PGlite store is created with — pass it as
 * the Drizzle `schema` option so `db.query.kgNode` and friends are typed.
 *
 * @example
 * ```ts
 * import { DbSchema } from "@beep/law-practice-tables"
 * import { getTableName } from "drizzle-orm"
 *
 * const tableNames = Object.values(DbSchema).map(getTableName).sort()
 * console.log(tableNames) // ["kg_build", "kg_edge", "kg_node"]
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const DbSchema = {
  kgBuild: kgBuildTable,
  kgEdge: kgEdgeTable,
  kgNode: kgNodeTable,
};

/**
 * Type-level view of {@link DbSchema}.
 *
 * @example
 * ```ts
 * import type { DbSchema } from "@beep/law-practice-tables"
 *
 * const projectionOrder: ReadonlyArray<keyof DbSchema> = ["kgNode", "kgEdge", "kgBuild"]
 * console.log(projectionOrder[0]) // "kgNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DbSchema = typeof DbSchema;

/**
 * Selected node projection row.
 *
 * @remarks
 * `docketFamily` and `client` are the only nullable columns: a node such as an
 * email archive belongs to no docket family and no single client.
 *
 * @example
 * ```ts
 * import type { KgNodeReadModel } from "@beep/law-practice-tables"
 *
 * const labelFor = (node: KgNodeReadModel): string =>
 *   node.client === null ? node.label : `${node.label} (${node.client})`
 *
 * console.log(labelFor({
 *   iri: "urn:beep:practice-kg:docket:AB-1234",
 *   kind: "docket",
 *   naturalKey: "AB-1234",
 *   label: "AB-1234",
 *   docketFamily: "AB",
 *   client: "Acme Corp",
 *   epistemicStatus: "derived-from-official-records",
 *   provenanceKind: "catalog-digest",
 *   provenanceRef: "sha256:9f2c",
 *   payload: { sizeBytes: 18342 }
 * })) // "AB-1234 (Acme Corp)"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KgNodeReadModel = typeof kgNodeTable.$inferSelect;

/**
 * Insertable node projection row.
 *
 * @remarks
 * Differs from {@link KgNodeReadModel} in that the nullable `docketFamily` and
 * `client` columns may be omitted entirely rather than passed as `null`.
 *
 * @example
 * ```ts
 * import type { KgNodeInsert } from "@beep/law-practice-tables"
 *
 * const emailArchive: KgNodeInsert = {
 *   iri: "urn:beep:practice-kg:email_archive:sha256:1a4f",
 *   kind: "email_archive",
 *   naturalKey: "sha256:1a4f",
 *   label: "acme-2019.pst",
 *   epistemicStatus: "derived-from-official-records",
 *   provenanceKind: "organize-row",
 *   provenanceRef: "sha256:1a4f",
 *   payload: { messages: 2317 }
 * }
 *
 * console.log(emailArchive.kind) // "email_archive"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KgNodeInsert = typeof kgNodeTable.$inferInsert;

/**
 * Selected edge projection row.
 *
 * @example
 * ```ts
 * import type { KgEdgeReadModel } from "@beep/law-practice-tables"
 *
 * const isCandidate = (edge: KgEdgeReadModel): boolean =>
 *   edge.epistemicStatus === "candidate-unreviewed"
 *
 * console.log(isCandidate({
 *   subjectIri: "urn:beep:practice-kg:docket_family:AB",
 *   predicate: "enriched_family",
 *   objectIri: "urn:beep:practice-kg:application:16123456",
 *   epistemicStatus: "candidate-unreviewed",
 *   provenanceKind: "uspto-anchor",
 *   provenanceRef: "16/123,456"
 * })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KgEdgeReadModel = typeof kgEdgeTable.$inferSelect;

/**
 * Insertable edge projection row.
 *
 * @remarks
 * Every column is required: an edge carries no nullable state, and its
 * `(subjectIri, predicate, objectIri)` triple is the primary key.
 *
 * @example
 * ```ts
 * import type { KgEdgeInsert } from "@beep/law-practice-tables"
 *
 * const grant: KgEdgeInsert = {
 *   subjectIri: "urn:beep:practice-kg:application:16123456",
 *   predicate: "granted_as",
 *   objectIri: "urn:beep:practice-kg:patent:11111111",
 *   epistemicStatus: "derived-from-official-records",
 *   provenanceKind: "uspto-anchor",
 *   provenanceRef: "16/123,456"
 * }
 *
 * console.log(grant.predicate) // "granted_as"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KgEdgeInsert = typeof kgEdgeTable.$inferInsert;

/**
 * Selected build-provenance projection row.
 *
 * @remarks
 * `counts` is stored as JSONB and typed as an unknown record, so read it back
 * through the schema that wrote it rather than indexing it directly.
 *
 * @example
 * ```ts
 * import type { KgBuildReadModel } from "@beep/law-practice-tables"
 *
 * const includesRefresh = (build: KgBuildReadModel): boolean =>
 *   build.builtFromRuns.split(",").includes("refresh-2026-07")
 *
 * console.log(includesRefresh({
 *   bundleVersion: "2026.07.1",
 *   builtFromRuns: "base,refresh-2026-07",
 *   counts: { nodes: 8421, edges: 19233 },
 *   builtAt: "2026-07-27T18:04:11.000Z"
 * })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KgBuildReadModel = typeof kgBuildTable.$inferSelect;

/**
 * Insertable build-provenance projection row.
 *
 * @example
 * ```ts
 * import type { KgBuildInsert } from "@beep/law-practice-tables"
 *
 * const provenance: KgBuildInsert = {
 *   bundleVersion: "2026.07.1",
 *   builtFromRuns: "base",
 *   counts: { nodes: 8421, edges: 19233, documents: 6104, emails: 0 },
 *   builtAt: "2026-07-27T18:04:11.000Z"
 * }
 *
 * console.log(provenance.bundleVersion) // "2026.07.1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KgBuildInsert = typeof kgBuildTable.$inferInsert;
