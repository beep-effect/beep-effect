/**
 * Acceptance sweep over a built practice knowledge-graph bundle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Effect, HashSet } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { SqlClient as SqlClientService } from "effect/sql/SqlClient";
import { PracticeKgProjectionError } from "./PracticeKg.errors.ts";
import { PracticeKgQueries } from "./PracticeKg.queries.ts";
import { decodePracticeKgGraphRows } from "./PracticeKg.rows.ts";
import type * as SqlClient from "effect/sql/SqlClient";

const $I = $LawPracticeServerId.create("PracticeKg.verify");

/**
 * Counts from one bundle acceptance sweep.
 *
 * **Details**
 *
 * `ok` is true only when every node decoded through the same projection the
 * `kg_provenance` tool serves, every `catalog-digest` reference names a
 * document in the bundle, every `uspto-anchor` reference names a USPTO record
 * the bundle carries, no edge dangles, and the matter tables agree with the
 * graph. This is the repeatable proof that every graph row resolves to
 * provenance.
 *
 * **Example** (Make a passing summary)
 *
 * ```ts
 * import { PracticeKgVerifySummary } from "@beep/law-practice-server"
 *
 * const summary = PracticeKgVerifySummary.make({
 *   anchorReferencesUnresolved: 0,
 *   catalogReferencesUnresolved: 0,
 *   claims: 0,
 *   claimsWithSourceDocument: 0,
 *   danglingEdges: 0,
 *   dockets: 0,
 *   edges: 0,
 *   families: 0,
 *   matterDockets: 0,
 *   matters: 0,
 *   nodes: 0,
 *   nodesResolved: 0,
 *   ok: true
 * })
 * console.log(summary.ok) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgVerifySummary extends S.Class<PracticeKgVerifySummary>($I`PracticeKgVerifySummary`)(
  {
    anchorReferencesUnresolved: S.Finite,
    catalogReferencesUnresolved: S.Finite,
    claims: S.Finite,
    claimsWithSourceDocument: S.Finite,
    danglingEdges: S.Finite,
    dockets: S.Finite,
    edges: S.Finite,
    families: S.Finite,
    matterDockets: S.Finite,
    matters: S.Finite,
    nodes: S.Finite,
    nodesResolved: S.Finite,
    ok: S.Boolean,
  },
  $I.annote("PracticeKgVerifySummary", {
    description: "Provenance-resolution and consistency counts for one built bundle.",
  })
) {}

class CountRow extends S.Class<CountRow>($I`CountRow`)({ count: S.Finite }) {}
class RefRow extends S.Class<RefRow>($I`RefRow`)({ ref: S.String }) {}
class TableRow extends S.Class<TableRow>($I`TableRow`)({ tableName: S.String }) {}

const decodeCountRows = S.decodeUnknownEffect(S.NonEmptyArray(CountRow));
const decodeRefRows = S.decodeUnknownEffect(S.Array(RefRow));
const decodeTableRows = S.decodeUnknownEffect(S.Array(TableRow));

const allNodesSql = `
SELECT iri, kind, natural_key AS "naturalKey", label, docket_family AS "docketFamily",
  client, attribution_source AS "attributionSource", epistemic_status AS "epistemicStatus",
  provenance_kind AS "provenanceKind", provenance_ref AS "provenanceRef", NULL::FLOAT8 AS count
FROM kg_node
ORDER BY iri`;

const provenanceRefsSql = (kind: "catalog-digest" | "uspto-anchor"): string =>
  `SELECT DISTINCT provenance_ref AS ref FROM (
  SELECT provenance_ref FROM kg_node WHERE provenance_kind = '${kind}'
  UNION ALL
  SELECT provenance_ref FROM kg_edge WHERE provenance_kind = '${kind}'
) refs ORDER BY ref`;

const usptoRecordsSql = `
SELECT application_number AS ref FROM enrichment WHERE application_number IS NOT NULL
UNION
SELECT patent_number FROM enrichment WHERE patent_number IS NOT NULL`;

const danglingEdgesSql = `
SELECT COUNT(*)::FLOAT8 AS count FROM kg_edge e
WHERE NOT EXISTS (SELECT 1 FROM kg_node n WHERE n.iri = e.subject_iri)
   OR NOT EXISTS (SELECT 1 FROM kg_node n WHERE n.iri = e.object_iri)`;

const claimsWithSourceDocumentSql = `
SELECT COUNT(*)::FLOAT8 AS count FROM epistemic_candidate_claim c
JOIN kg_node doc ON doc.kind = 'document' AND doc.natural_key = c.snapshot->>'sourceDocumentDigest'`;

const pgCount = (sql: SqlClient.SqlClient, statement: string) =>
  sql.unsafe(statement).pipe(
    Effect.flatMap(decodeCountRows),
    Effect.map((rows) => A.headNonEmpty(rows).count)
  );

const missingFrom = (references: ReadonlyArray<RefRow>, known: ReadonlyArray<RefRow>): number => {
  const knownSet = HashSet.fromIterable(A.map(known, (row) => row.ref));
  return A.length(A.filter(references, (row) => !HashSet.has(knownSet, row.ref)));
};

/**
 * Sweep the ambient bundle stores and report whether every graph row resolves.
 *
 * **Details**
 *
 * Decoding every `kg_node` row through the tool projection is the same path
 * `kg_provenance` takes for one row, so a bundle that passes here cannot hide a
 * node the tool would fail on. Reference checks then confirm that the thing a
 * row points at is really in the bundle.
 *
 * **Example** (Verify a bundle)
 *
 * ```ts
 * import { verifyPracticeKgBundle } from "@beep/law-practice-server"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(verifyPracticeKgBundle)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const verifyPracticeKgBundle: Effect.Effect<
  PracticeKgVerifySummary,
  PracticeKgProjectionError,
  DuckDb | SqlClient.SqlClient
> = Effect.gen(function* () {
  const sql = (yield* SqlClientService).withoutTransforms();
  const duckdb = yield* DuckDb;
  const duckCount = (statement: string) =>
    duckdb.query(statement).pipe(
      Effect.flatMap(decodeCountRows),
      Effect.map((rows) => A.headNonEmpty(rows).count)
    );
  const nodes = yield* pgCount(sql, "SELECT COUNT(*)::FLOAT8 AS count FROM kg_node");
  const resolvedNodes = yield* sql.unsafe(allNodesSql).pipe(Effect.flatMap(decodePracticeKgGraphRows));
  const edges = yield* pgCount(sql, "SELECT COUNT(*)::FLOAT8 AS count FROM kg_edge");
  const danglingEdges = yield* pgCount(sql, danglingEdgesSql);
  const families = yield* pgCount(sql, "SELECT COUNT(*)::FLOAT8 AS count FROM kg_node WHERE kind = 'docket_family'");
  const dockets = yield* pgCount(sql, "SELECT COUNT(*)::FLOAT8 AS count FROM kg_node WHERE kind = 'docket'");
  const catalogRefs = yield* sql.unsafe(provenanceRefsSql("catalog-digest")).pipe(Effect.flatMap(decodeRefRows));
  const anchorRefs = yield* sql.unsafe(provenanceRefsSql("uspto-anchor")).pipe(Effect.flatMap(decodeRefRows));
  const documents = yield* duckdb.query("SELECT digest AS ref FROM documents").pipe(Effect.flatMap(decodeRefRows));
  const usptoRecords = yield* duckdb.query(usptoRecordsSql).pipe(Effect.flatMap(decodeRefRows));
  const matters = yield* duckCount("SELECT CAST(COUNT(*) AS DOUBLE) AS count FROM matters");
  const matterDockets = yield* duckCount("SELECT CAST(COUNT(*) AS DOUBLE) AS count FROM matter_dockets");
  const claimTables = yield* sql.unsafe(PracticeKgQueries.claimsTableProbe).pipe(Effect.flatMap(decodeTableRows));
  const claimsLoaded = A.length(claimTables) === 2;
  const claims = claimsLoaded
    ? yield* pgCount(sql, "SELECT COUNT(*)::FLOAT8 AS count FROM epistemic_candidate_claim")
    : 0;
  const claimsWithSourceDocument = claimsLoaded ? yield* pgCount(sql, claimsWithSourceDocumentSql) : 0;
  const catalogReferencesUnresolved = missingFrom(catalogRefs, documents);
  const anchorReferencesUnresolved = missingFrom(anchorRefs, usptoRecords);
  const nodesResolved = A.length(resolvedNodes);
  return PracticeKgVerifySummary.make({
    anchorReferencesUnresolved,
    catalogReferencesUnresolved,
    claims,
    claimsWithSourceDocument,
    danglingEdges,
    dockets,
    edges,
    families,
    matterDockets,
    matters,
    nodes,
    nodesResolved,
    ok:
      nodesResolved === nodes &&
      catalogReferencesUnresolved === 0 &&
      anchorReferencesUnresolved === 0 &&
      danglingEdges === 0 &&
      matters === families &&
      matterDockets === dockets,
  });
}).pipe(PracticeKgProjectionError.mapError("Practice KG bundle verification could not read the bundle stores."));
