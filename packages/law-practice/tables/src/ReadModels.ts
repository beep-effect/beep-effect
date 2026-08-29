/**
 * Law-practice Drizzle schema composition and read-model row types.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ActFrame,
  CandorDisposition,
  CorrectionDelta,
  IdsSubmissionFact,
  LegalOppositionCandidate,
  LegalPositionRelator,
  PatentCitationEvent,
  PowerExercise,
} from "./entities/index.ts";
import { kgBuildTable } from "./entities/KgBuild/KgBuild.read-model-table.ts";
import { kgEdgeTable } from "./entities/KgEdge/KgEdge.read-model-table.ts";
import { kgNodeTable } from "./entities/KgNode/KgNode.read-model-table.ts";

type DbSchemaShape = {
  readonly actFrame: typeof ActFrame.Table;
  readonly candorDisposition: typeof CandorDisposition.Table;
  readonly correctionDelta: typeof CorrectionDelta.Table;
  readonly idsSubmissionFact: typeof IdsSubmissionFact.Table;
  readonly kgBuild: typeof kgBuildTable;
  readonly kgEdge: typeof kgEdgeTable;
  readonly kgNode: typeof kgNodeTable;
  readonly legalOppositionCandidate: typeof LegalOppositionCandidate.Table;
  readonly legalPositionRelator: typeof LegalPositionRelator.Table;
  readonly patentCitationEvent: typeof PatentCitationEvent.Table;
  readonly powerExercise: typeof PowerExercise.Table;
};

/**
 * Drizzle schema for every table the law-practice slice declares.
 *
 * **When to use**
 *
 * Use as the Drizzle `schema` option so `db.query.kgNode` and friends are typed.
 *
 * **Details**
 *
 * Two populations live here and they have different lifetimes. The `kg*` entries
 * are packet-owned projections that a bundle's disposable PGlite store is
 * created with. Every other entry is an entity-derived table owned by a db-admin
 * migration, so its rows outlive any single bundle: `candorDisposition`,
 * `idsSubmissionFact`, and `patentCitationEvent` from the candor gate, and
 * `actFrame`, `correctionDelta`, `legalOppositionCandidate`,
 * `legalPositionRelator`, and `powerExercise` from the legal position runtime.
 *
 * **Example** (Read the composed physical table names)
 *
 * ```ts
 * import { DbSchema } from "@beep/law-practice-tables"
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(DbSchema.kgNode)) // "kg_node"
 * console.log(getTableName(DbSchema.patentCitationEvent)) // "law_practice_patent_citation_event"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const DbSchema: DbSchemaShape = {
  actFrame: ActFrame.Table,
  candorDisposition: CandorDisposition.Table,
  correctionDelta: CorrectionDelta.Table,
  idsSubmissionFact: IdsSubmissionFact.Table,
  kgBuild: kgBuildTable,
  kgEdge: kgEdgeTable,
  kgNode: kgNodeTable,
  legalOppositionCandidate: LegalOppositionCandidate.Table,
  legalPositionRelator: LegalPositionRelator.Table,
  patentCitationEvent: PatentCitationEvent.Table,
  powerExercise: PowerExercise.Table,
};

/**
 * Type-level view of {@link DbSchema}.
 *
 * **Example** (Order the projections a bundle build writes)
 *
 * ```ts
 * import type { DbSchema } from "@beep/law-practice-tables"
 *
 * const projectionOrder: ReadonlyArray<keyof DbSchema> = ["kgNode", "kgEdge", "kgBuild"]
 * console.log(projectionOrder[0]) // "kgNode"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type DbSchema = DbSchemaShape;

/**
 * Selected node projection row.
 *
 * **Details**
 *
 * `docketFamily` and `client` are the only nullable columns: a node such as an
 * email archive belongs to no docket family and no single client.
 *
 * **Example** (Label a node that may have no client)
 *
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
 * @category read-models
 * @since 0.0.0
 */
export type KgNodeReadModel = typeof kgNodeTable.$inferSelect;

/**
 * Insertable node projection row.
 *
 * **Details**
 *
 * Differs from {@link KgNodeReadModel} in that the nullable `docketFamily` and
 * `client` columns may be omitted entirely rather than passed as `null`.
 *
 * **Example** (Insert a node that belongs to no docket family)
 *
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
 * @category read-models
 * @since 0.0.0
 */
export type KgNodeInsert = typeof kgNodeTable.$inferInsert;

/**
 * Selected edge projection row.
 *
 * **Example** (Detect an unreviewed candidate edge)
 *
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
 * @category read-models
 * @since 0.0.0
 */
export type KgEdgeReadModel = typeof kgEdgeTable.$inferSelect;

/**
 * Insertable edge projection row.
 *
 * **Details**
 *
 * Every column is required: an edge carries no nullable state, and its
 * `(subjectIri, predicate, objectIri)` triple is the primary key.
 *
 * **Example** (Insert a grant edge)
 *
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
 * @category read-models
 * @since 0.0.0
 */
export type KgEdgeInsert = typeof kgEdgeTable.$inferInsert;

/**
 * Selected build-provenance projection row.
 *
 * **Gotchas**
 *
 * `counts` is stored as JSONB and typed as an unknown record, so read it back
 * through the schema that wrote it rather than indexing it directly.
 *
 * **Example** (Check which runs a bundle was built from)
 *
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
 * @category read-models
 * @since 0.0.0
 */
export type KgBuildReadModel = typeof kgBuildTable.$inferSelect;

/**
 * Insertable build-provenance projection row.
 *
 * **Example** (Record bundle build provenance)
 *
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
 * @category read-models
 * @since 0.0.0
 */
export type KgBuildInsert = typeof kgBuildTable.$inferInsert;
