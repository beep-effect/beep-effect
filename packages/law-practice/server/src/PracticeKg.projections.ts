/**
 * Deterministic practice knowledge-graph bundle projection service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { $I as $BeepId, $LawPracticeServerId } from "@beep/identity/packages";
import { KG_BUILD_TABLE_NAME } from "@beep/law-practice-tables/entities/KgBuild";
import { KG_EDGE_TABLE_NAME } from "@beep/law-practice-tables/entities/KgEdge";
import { KG_NODE_TABLE_NAME } from "@beep/law-practice-tables/entities/KgNode";
import { NonNegativeInt } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { Context, Effect, FileSystem, Layer, MutableHashMap, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { readEmailRows } from "./PracticeKg.emails.ts";
import { PracticeKgProjectionError } from "./PracticeKg.errors.ts";
import { buildDuckDb } from "./PracticeKg.fts.ts";
import { PracticeKgCatalogRow, PracticeKgEnrichmentRow, stripPrefix, withDuckDb } from "./PracticeKg.rows.ts";
import {
  encodePracticeKgBundleManifestJson,
  encodePracticeKgCountsJson,
  encodePracticeKgNodePayloadJson,
  encodePracticeKgSummaryJson,
  PracticeKgBundleManifest,
  PracticeKgCounts,
  PracticeKgEdgeRow,
  PracticeKgNodeRow,
  PracticeKgSchemaVersions,
  PracticeKgSourceRuns,
  PracticeKgSummary,
} from "./PracticeKg.schemas.ts";
import type { KgEdgePredicate, KgNodeKind } from "@beep/law-practice-domain/values";
import type { PracticeKgEmailHeaderRow, PracticeKgOptions, PracticeKgProvenanceKind } from "./PracticeKg.schemas.ts";

const $I = $LawPracticeServerId.create("PracticeKg.projections");
const graphIdentity = $BeepId.create("practice-kg");
const graphBundleVersion = "2026-07-27-01";
const graphReadme = `Practice Knowledge Graph Bundle

This folder is a read-only local data bundle for the Practice KG MCP server.
Keep the whole folder together. The original corpus is not copied here; source
documents and email bodies remain pointers into the separately configured
corpus root. Replace this folder as a unit when a newer bundle is delivered.
`;

class GraphReconciliationRow extends S.Class<GraphReconciliationRow>($I`GraphReconciliationRow`)({
  baseDigests: S.Finite,
  docketFamilies: S.Finite,
  docketFiles: S.Finite,
  familyAnchors: S.Finite,
  snapshotIso: S.String,
  sourceRows: S.Finite,
}) {}

const decodeCatalogRows = S.decodeUnknownEffect(S.Array(PracticeKgCatalogRow));
const decodeEnrichmentRows = S.decodeUnknownEffect(S.Array(PracticeKgEnrichmentRow));
const decodeReconciliationRows = S.decodeUnknownEffect(S.Array(GraphReconciliationRow));

const catalogRowsSql = (includeRefresh: boolean) => `
SELECT
  o.digest,
  o.source_label AS "sourceLabel",
  o.source_relative_path AS "sourceRelativePath",
  o.category,
  o.client,
  o.docket,
  o.docket_family AS "docketFamily",
  o.organized_relative_path AS "organizedRelativePath",
  o.effective_name AS "effectiveName",
  CAST(COALESCE(s.size_bytes, 0) AS DOUBLE) AS "sizeBytes",
  COALESCE(s.mtime_iso, '1970-01-01T00:00:00.000Z') AS "mtimeIso",
  COALESCE(s.run_label, 'base') AS "runLabel"
  ,COALESCE(s.source_origin_chain, o.source_relative_path) AS "sourceOriginChain"
FROM corpus_organized o
LEFT JOIN (
  SELECT
    digest,
    ARG_MIN(size_bytes, run_label || ':' || source_label || ':' || relative_path) AS size_bytes,
    ARG_MIN(mtime_iso, run_label || ':' || source_label || ':' || relative_path) AS mtime_iso,
    ARG_MIN(run_label, run_label || ':' || source_label || ':' || relative_path) AS run_label
    ,STRING_AGG(run_label || ':' || source_label || ':' || relative_path, ' <- ' ORDER BY run_label, source_label, relative_path) AS source_origin_chain
  FROM corpus_source_files
  GROUP BY digest
) s USING (digest)
${
  includeRefresh
    ? `
UNION ALL
SELECT
  refresh.digest,
  refresh.source_label AS "sourceLabel",
  refresh.relative_path AS "sourceRelativePath",
  'unsorted' AS category,
  NULL AS client,
  NULL AS docket,
  NULL AS "docketFamily",
  NULL AS "organizedRelativePath",
  regexp_extract(refresh.relative_path, '[^/\\\\]+$', 0) AS "effectiveName",
  CAST(refresh.size_bytes AS DOUBLE) AS "sizeBytes",
  refresh.mtime_iso AS "mtimeIso",
  refresh.run_label AS "runLabel"
  ,refresh.run_label || ':' || refresh.source_label || ':' || refresh.relative_path AS "sourceOriginChain"
FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY digest
      ORDER BY source_label, relative_path
    ) AS digest_ord
  FROM corpus_source_files
  WHERE run_label = '2026-07-refresh'
) refresh
WHERE refresh.digest_ord = 1
  AND NOT EXISTS (SELECT 1 FROM corpus_organized organized WHERE organized.digest = refresh.digest)`
    : ""
}
ORDER BY digest, "sourceLabel", "sourceRelativePath"`;

const enrichmentRowsSql = `
SELECT
  candidate,
  status,
  application_number AS "applicationNumber",
  patent_number AS "patentNumber",
  invention_title AS "inventionTitle",
  first_applicant_name AS "firstApplicantName",
  first_inventor_name AS "firstInventorName",
  COALESCE(docket_families, '') AS "docketFamilies",
  COALESCE(parent_application_numbers, '') AS "parentApplicationNumbers"
FROM corpus_enrichment
ORDER BY candidate`;

const reconciliationSql = `
SELECT
  CAST((SELECT COUNT(*) FROM corpus_source_files) AS DOUBLE) AS "sourceRows",
  CAST((SELECT COUNT(DISTINCT digest) FROM corpus_source_files WHERE run_label <> '2026-07-refresh') AS DOUBLE)
    AS "baseDigests",
  CAST((SELECT COUNT(*) FROM corpus_organized WHERE category = 'docket') AS DOUBLE) AS "docketFiles",
  CAST((SELECT COUNT(DISTINCT docket_family) FROM corpus_organized WHERE docket_family IS NOT NULL) AS DOUBLE)
    AS "docketFamilies",
  CAST((SELECT COUNT(*) FROM corpus_enrichment WHERE status = 'resolved') AS DOUBLE)
    AS "familyAnchors",
  COALESCE((SELECT MAX(mtime_iso) FROM corpus_source_files), '1970-01-01T00:00:00.000Z') AS "snapshotIso"`;

/*
 * Raw DDL, not drizzle-kit migrations: the bundle PGlite store is disposable
 * and rebuilt whole on every run through the injected SqlClient, so there is
 * no migration history to manage. The Drizzle declarations in
 * `@beep/law-practice-tables` remain the schema authority; the projections
 * test asserts column-set equality between this DDL and those declarations
 * (ExecutionRecord.table.ts precedent: invariant by test, not comment).
 */
const createKgTables = [
  `CREATE TABLE ${KG_NODE_TABLE_NAME} (
  iri TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  natural_key TEXT NOT NULL,
  label TEXT NOT NULL,
  docket_family TEXT,
  client TEXT,
  epistemic_status TEXT NOT NULL,
  provenance_kind TEXT NOT NULL,
  provenance_ref TEXT NOT NULL,
  payload JSONB NOT NULL
)`,
  `CREATE TABLE ${KG_EDGE_TABLE_NAME} (
  subject_iri TEXT NOT NULL REFERENCES ${KG_NODE_TABLE_NAME}(iri),
  predicate TEXT NOT NULL,
  object_iri TEXT NOT NULL REFERENCES ${KG_NODE_TABLE_NAME}(iri),
  epistemic_status TEXT NOT NULL,
  provenance_kind TEXT NOT NULL,
  provenance_ref TEXT NOT NULL,
  PRIMARY KEY (subject_iri, predicate, object_iri)
)`,
  `CREATE TABLE ${KG_BUILD_TABLE_NAME} (
  bundle_version TEXT NOT NULL,
  built_from_runs TEXT NOT NULL,
  counts JSONB NOT NULL,
  built_at TEXT NOT NULL
)`,
];

const insertKgNode = `
INSERT INTO ${KG_NODE_TABLE_NAME}
  (iri, kind, natural_key, label, docket_family, client, epistemic_status, provenance_kind, provenance_ref, payload)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`;

const insertKgEdge = `
INSERT INTO ${KG_EDGE_TABLE_NAME}
  (subject_iri, predicate, object_iri, epistemic_status, provenance_kind, provenance_ref)
VALUES ($1, $2, $3, $4, $5, $6)`;

const graphIri = (kind: KgNodeKind, naturalKey: string): string => graphIdentity.create(kind).create(naturalKey).iri;

const nullable = <A>(value: A | null): A | undefined => value ?? undefined;

const splitList = (value: string): ReadonlyArray<string> =>
  A.filter(A.map(Str.split(" | ")(value), Str.trim), Str.isNonEmpty);

const firstOrFail = <A>(rows: ReadonlyArray<A>, label: string): Effect.Effect<A, PracticeKgProjectionError> =>
  A.head(rows).pipe(
    O.match({
      onNone: () => PracticeKgProjectionError.make({ message: `Graph build query returned no ${label} row.` }),
      onSome: Effect.succeed,
    })
  );

const readCatalog = Effect.fn("PracticeKg.readCatalog")(function* (databasePath: string, includeRefresh: boolean) {
  return yield* Effect.gen(function* () {
    const db = yield* DuckDb;
    const catalogRows = yield* db
      .query(catalogRowsSql(includeRefresh))
      .pipe(
        Effect.flatMap(decodeCatalogRows),
        PracticeKgProjectionError.mapError("Graph catalog rows failed schema validation.")
      );
    const enrichmentRows = yield* db
      .query(enrichmentRowsSql)
      .pipe(
        Effect.flatMap(decodeEnrichmentRows),
        PracticeKgProjectionError.mapError("Graph enrichment rows failed schema validation.")
      );
    const reconciliationRows = yield* db
      .query(reconciliationSql)
      .pipe(
        Effect.flatMap(decodeReconciliationRows),
        PracticeKgProjectionError.mapError("Graph reconciliation row failed schema validation.")
      );
    const reconciliation = yield* firstOrFail(reconciliationRows, "reconciliation");
    return { catalogRows, enrichmentRows, reconciliation };
  }).pipe(
    withDuckDb(DuckDbConnectionOptions.make({ databasePath })),
    PracticeKgProjectionError.mapError(`Failed reading corpus catalog "${databasePath}".`)
  );
});

const createNode = (
  kind: KgNodeKind,
  naturalKey: string,
  label: string,
  provenanceKind: PracticeKgProvenanceKind,
  provenanceRef: string,
  options: {
    readonly client?: string | undefined;
    readonly docketFamily?: string | undefined;
    readonly payload?: Readonly<Record<string, unknown>> | undefined;
  } = {}
): PracticeKgNodeRow =>
  PracticeKgNodeRow.make({
    epistemicStatus: "derived-from-official-records",
    iri: graphIri(kind, naturalKey),
    kind,
    label,
    naturalKey,
    payload: options.payload ?? {},
    provenanceKind,
    provenanceRef,
    ...O.getSomesStruct({
      client: O.fromUndefinedOr(options.client),
      docketFamily: O.fromUndefinedOr(options.docketFamily),
    }),
  });

const createEdge = (
  subjectKind: KgNodeKind,
  subjectKey: string,
  predicate: KgEdgePredicate,
  objectKind: KgNodeKind,
  objectKey: string,
  provenanceKind: PracticeKgProvenanceKind,
  provenanceRef: string
): PracticeKgEdgeRow =>
  PracticeKgEdgeRow.make({
    epistemicStatus: "derived-from-official-records",
    objectIri: graphIri(objectKind, objectKey),
    predicate,
    provenanceKind,
    provenanceRef,
    subjectIri: graphIri(subjectKind, subjectKey),
  });

const buildGraphRows = (
  catalogRows: ReadonlyArray<PracticeKgCatalogRow>,
  enrichmentRows: ReadonlyArray<PracticeKgEnrichmentRow>
): {
  readonly edges: ReadonlyArray<PracticeKgEdgeRow>;
  readonly nodes: ReadonlyArray<PracticeKgNodeRow>;
} => {
  const nodes = MutableHashMap.empty<string, PracticeKgNodeRow>();
  const edges = MutableHashMap.empty<string, PracticeKgEdgeRow>();
  const docketsByFamily = MutableHashMap.empty<string, ReadonlyArray<string>>();
  const addNode = (node: PracticeKgNodeRow): void => {
    MutableHashMap.set(nodes, node.iri, node);
  };
  const addEdge = (edge: PracticeKgEdgeRow): void => {
    MutableHashMap.set(edges, `${edge.subjectIri}\u0000${edge.predicate}\u0000${edge.objectIri}`, edge);
  };

  A.forEach(catalogRows, (row) => {
    const docketFamily = nullable(row.docketFamily);
    const docket = nullable(row.docket);
    const client = nullable(row.client);
    addNode(
      createNode("document", row.digest, row.effectiveName, "catalog-digest", row.digest, {
        client,
        docketFamily,
        payload: {
          category: row.category,
          mtimeIso: row.mtimeIso,
          organizedRelativePath: row.organizedRelativePath,
          sizeBytes: row.sizeBytes,
        },
      })
    );
    if (row.category === "email-archive") {
      addNode(
        createNode("email_archive", row.digest, row.effectiveName, "catalog-digest", row.digest, {
          client,
          docketFamily,
        })
      );
    }
    if (docketFamily !== undefined) {
      addNode(createNode("docket_family", docketFamily, docketFamily, "organize-row", docketFamily, { client }));
      if (docket === undefined) {
        addEdge(
          createEdge(
            "docket_family",
            docketFamily,
            "family_document",
            "document",
            row.digest,
            "catalog-digest",
            row.digest
          )
        );
      }
    }
    if (docket !== undefined && docketFamily !== undefined) {
      addNode(createNode("docket", docket, docket, "organize-row", row.sourceRelativePath, { client, docketFamily }));
      addEdge(createEdge("docket_family", docketFamily, "has_docket", "docket", docket, "organize-row", docket));
      addEdge(createEdge("docket", docket, "has_document", "document", row.digest, "catalog-digest", row.digest));
      const familyDockets = pipe(MutableHashMap.get(docketsByFamily, docketFamily), O.getOrElse(A.empty<string>));
      MutableHashMap.set(docketsByFamily, docketFamily, A.dedupe(A.append(familyDockets, docket)));
    }
    if (client !== undefined && docketFamily !== undefined) {
      addNode(createNode("client", client, client, "organize-row", row.sourceLabel));
      addEdge(
        createEdge(
          "client",
          client,
          "has_docket_family",
          "docket_family",
          docketFamily,
          "organize-row",
          row.sourceLabel
        )
      );
    }
  });

  A.forEach(enrichmentRows, (row) => {
    if (row.status !== "resolved") {
      return;
    }
    const application = nullable(row.applicationNumber);
    const patent = nullable(row.patentNumber);
    const families = splitList(row.docketFamilies);
    const parents = splitList(row.parentApplicationNumbers);
    if (application !== undefined) {
      addNode(
        createNode(
          "application",
          application,
          nullable(row.inventionTitle) ?? application,
          "uspto-anchor",
          application,
          {
            payload: {
              firstApplicantName: row.firstApplicantName,
              firstInventorName: row.firstInventorName,
              inventionTitle: row.inventionTitle,
            },
          }
        )
      );
      A.forEach(families, (family) => {
        addNode(createNode("docket_family", family, family, "uspto-anchor", application));
        addEdge(
          createEdge(
            "application",
            application,
            "enriched_family",
            "docket_family",
            family,
            "uspto-anchor",
            application
          )
        );
        A.forEach(pipe(MutableHashMap.get(docketsByFamily, family), O.getOrElse(A.empty<string>)), (docket) =>
          addEdge(createEdge("docket", docket, "files_as", "application", application, "uspto-anchor", application))
        );
      });
      A.forEach(parents, (parent) => {
        addNode(createNode("application", parent, parent, "uspto-anchor", application));
        addEdge(
          createEdge("application", application, "continuation_of", "application", parent, "uspto-anchor", application)
        );
      });
    }
    if (patent !== undefined) {
      addNode(
        createNode("patent", patent, nullable(row.inventionTitle) ?? patent, "uspto-anchor", patent, {
          payload: { inventionTitle: row.inventionTitle },
        })
      );
      if (application !== undefined) {
        addEdge(createEdge("application", application, "granted_as", "patent", patent, "uspto-anchor", patent));
      }
    }
  });

  const archiveNodes = A.filter(A.fromIterable(MutableHashMap.values(nodes)), (node) => node.kind === "email_archive");
  A.forEach(catalogRows, (row) => {
    if (row.category !== "email-export") {
      return;
    }
    A.forEach(archiveNodes, (archive) => {
      const archiveHex = pipe(
        archive.naturalKey,
        stripPrefix("sha256:"),
        O.getOrElse(() => archive.naturalKey)
      );
      if (Str.includes(`artifact:${archiveHex}`)(row.sourceRelativePath)) {
        addEdge(
          createEdge(
            "document",
            row.digest,
            "archived_in",
            "email_archive",
            archive.naturalKey,
            "catalog-digest",
            archive.naturalKey
          )
        );
      }
    });
  });

  return {
    edges: A.sort(
      A.fromIterable(MutableHashMap.values(edges)),
      Order.mapInput(
        Order.String,
        (edge: PracticeKgEdgeRow) => `${edge.subjectIri}\u0000${edge.predicate}\u0000${edge.objectIri}`
      )
    ),
    nodes: A.sort(
      A.fromIterable(MutableHashMap.values(nodes)),
      Order.mapInput(Order.String, (node: PracticeKgNodeRow) => node.iri)
    ),
  };
};

const writePgliteProjection = Effect.fn("PracticeKg.writePgliteProjection")(function* (
  nodes: ReadonlyArray<PracticeKgNodeRow>,
  edges: ReadonlyArray<PracticeKgEdgeRow>,
  counts: PracticeKgCounts,
  sourceRuns: PracticeKgSourceRuns,
  builtAt: string
) {
  const countsJson = yield* encodePracticeKgCountsJson(counts).pipe(
    PracticeKgProjectionError.mapError("Graph build counts failed JSON encoding.")
  );
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  yield* Effect.forEach(createKgTables, (statement) => sql.unsafe(statement), { discard: true });
  yield* Effect.forEach(
    nodes,
    (node) =>
      encodePracticeKgNodePayloadJson(node.payload).pipe(
        PracticeKgProjectionError.mapError(`Graph node payload failed JSON encoding for "${node.iri}".`),
        Effect.flatMap((payload) =>
          sql.unsafe(insertKgNode, [
            node.iri,
            node.kind,
            node.naturalKey,
            node.label,
            node.docketFamily ?? null,
            node.client ?? null,
            node.epistemicStatus,
            node.provenanceKind,
            node.provenanceRef,
            payload,
          ])
        )
      ),
    { discard: true }
  );
  yield* Effect.forEach(
    edges,
    (edge) =>
      sql.unsafe(insertKgEdge, [
        edge.subjectIri,
        edge.predicate,
        edge.objectIri,
        edge.epistemicStatus,
        edge.provenanceKind,
        edge.provenanceRef,
      ]),
    { discard: true }
  );
  yield* sql.unsafe(
    `INSERT INTO ${KG_BUILD_TABLE_NAME} (bundle_version, built_from_runs, counts, built_at) VALUES ($1, $2, $3::jsonb, $4)`,
    [
      graphBundleVersion,
      sourceRuns.refresh202607 === "included" ? "base | 2026-07-refresh" : "base",
      countsJson,
      builtAt,
    ]
  );
});

const existingSourceSpecs = Effect.fn("PracticeKg.existingSourceSpecs")(function* (
  corpusRoot: string,
  includeRefresh: boolean
): Effect.fn.Return<
  ReadonlyArray<{ readonly sourcesPath: string; readonly textGlob: string }>,
  never,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const roots = includeRefresh ? ["staging/extract", "staging/extract-2026-07-refresh"] : ["staging/extract"];
  const candidates = yield* Effect.forEach(roots, (root) => {
    const sourcesPath = path.join(corpusRoot, root, "sources.jsonl");
    const textDir = path.join(corpusRoot, root, "text");
    return Effect.all([fs.exists(sourcesPath), fs.exists(textDir)]).pipe(
      Effect.orElseSucceed(() => [false, false]),
      Effect.map(([sourcesExist, textExists]) =>
        sourcesExist && textExists ? O.some({ sourcesPath, textGlob: path.join(textDir, "operation:*.txt") }) : O.none()
      )
    );
  });
  return A.getSomes(candidates);
});

/**
 * Build a deterministic PGlite + DuckDB practice knowledge-graph bundle.
 *
 * @remarks
 * This is the unwrapped implementation: it takes its filesystem, path, and SQL
 * client from the ambient context rather than from a service, which is what lets
 * {@link PracticeKgProjectionsLive} capture the host's context once and hand out
 * a dependency-free {@link PracticeKgProjections}. Prefer
 * {@link buildPracticeKgBundle} at ordinary call sites.
 *
 * The build refuses to run against an existing bundle unless `overwrite` is set,
 * and a failure part-way through leaves the partial bundle on disk.
 *
 * @example
 * ```ts
 * import { PracticeKgOptions } from "@beep/law-practice-server"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 * import { buildPracticeKgBundleImpl } from "../../src/PracticeKg.projections.ts"
 *
 * const build = buildPracticeKgBundleImpl(
 *   PracticeKgOptions.make({
 *     bundleOut: "/corpus/staging/practice-kg-bundle",
 *     corpusRoot: "/corpus",
 *     includeRefresh: true,
 *     maxTextBytes: NonNegativeInt.make(2_097_152),
 *     overwrite: true,
 *     skipEmails: false
 *   })
 * ).pipe(Effect.map((summary) => summary.counts.nodes))
 *
 * console.log(Effect.isEffect(build)) // true
 * ```
 *
 * @param options - Corpus root, bundle destination, source-run, email, text-budget, and replacement options.
 * @returns Stable bundle and reconciliation counts.
 * @effects Reads the corpus catalog and extraction trees, replaces the requested derived bundle, and writes its summary report.
 * @category use-cases
 * @since 0.0.0
 */
export const buildPracticeKgBundleImpl = Effect.fn("PracticeKg.build")(function* (
  options: PracticeKgOptions
): Effect.fn.Return<
  PracticeKgSummary,
  PracticeKgProjectionError,
  FileSystem.FileSystem | Path.Path | SqlClient.SqlClient
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (options.maxTextBytes <= 0) {
    return yield* PracticeKgProjectionError.make({ message: "--max-text-bytes must be greater than zero." });
  }
  const bundleOut = options.bundleOut ?? path.join(options.corpusRoot, "staging", "practice-kg-bundle");
  const catalogPath = path.join(options.corpusRoot, "catalog", "corpus.duckdb");
  const reportsDir = path.join(options.corpusRoot, "catalog", "reports");
  const summaryPath = path.join(reportsDir, "graph-summary.json");
  const manifestExists = yield* fs
    .exists(path.join(bundleOut, "bundle.manifest.json"))
    .pipe(Effect.orElseSucceed(() => false));
  if (manifestExists && !options.overwrite) {
    return yield* PracticeKgProjectionError.make({
      message: `Graph bundle already exists at "${bundleOut}"; pass --overwrite to replace it.`,
    });
  }
  yield* fs
    .makeDirectory(bundleOut, { recursive: true })
    .pipe(PracticeKgProjectionError.mapError(`Failed creating graph bundle "${bundleOut}".`));

  const { catalogRows, enrichmentRows, reconciliation } = yield* readCatalog(catalogPath, options.includeRefresh);
  const sourceSpecs = yield* existingSourceSpecs(options.corpusRoot, options.includeRefresh);
  const emailRows = options.skipEmails
    ? A.empty<PracticeKgEmailHeaderRow>()
    : yield* readEmailRows(path.join(options.corpusRoot, "staging", "extract", "children"));
  const graph = buildGraphRows(catalogRows, enrichmentRows);
  const duckCounts = yield* buildDuckDb(
    path.join(bundleOut, "practice.duckdb"),
    catalogRows,
    enrichmentRows,
    emailRows,
    sourceSpecs,
    options.maxTextBytes
  );
  const counts = PracticeKgCounts.make({
    documents: NonNegativeInt.make(duckCounts.documents),
    edges: NonNegativeInt.make(A.length(graph.edges)),
    emails: NonNegativeInt.make(duckCounts.emails),
    nodes: NonNegativeInt.make(A.length(graph.nodes)),
  });
  const sourceRuns = PracticeKgSourceRuns.make({
    base: "included",
    refresh202607: options.includeRefresh ? "included" : "excluded",
  });
  yield* writePgliteProjection(graph.nodes, graph.edges, counts, sourceRuns, reconciliation.snapshotIso).pipe(
    PracticeKgProjectionError.mapError(`Failed building graph PGlite store "${path.join(bundleOut, "kg.pglite")}".`)
  );

  const manifest = PracticeKgBundleManifest.make({
    builtAt: reconciliation.snapshotIso,
    bundleVersion: graphBundleVersion,
    corpusRootExpected: true,
    counts,
    schemaVersion: PracticeKgSchemaVersions.make({ duckdb: "1", pglite: "1" }),
    sourceRuns,
  });
  const manifestJson = yield* encodePracticeKgBundleManifestJson(manifest).pipe(
    PracticeKgProjectionError.mapError("Graph bundle manifest failed JSON encoding.")
  );
  yield* fs
    .writeFileString(path.join(bundleOut, "bundle.manifest.json"), `${manifestJson}\n`)
    .pipe(PracticeKgProjectionError.mapError("Failed writing graph bundle manifest."));
  yield* fs
    .writeFileString(path.join(bundleOut, "README.txt"), graphReadme)
    .pipe(PracticeKgProjectionError.mapError("Failed writing graph bundle README."));

  const summary = PracticeKgSummary.make({
    baseDigests: NonNegativeInt.make(reconciliation.baseDigests),
    bundleOut,
    counts,
    docketFamilies: NonNegativeInt.make(reconciliation.docketFamilies),
    docketFiles: NonNegativeInt.make(reconciliation.docketFiles),
    familyAnchors: NonNegativeInt.make(reconciliation.familyAnchors),
    includeRefresh: options.includeRefresh,
    sourceRows: NonNegativeInt.make(reconciliation.sourceRows),
  });
  const summaryJson = yield* encodePracticeKgSummaryJson(summary).pipe(
    PracticeKgProjectionError.mapError("Graph summary failed JSON encoding.")
  );
  yield* fs
    .makeDirectory(reportsDir, { recursive: true })
    .pipe(PracticeKgProjectionError.mapError(`Failed creating report directory "${reportsDir}".`));
  yield* fs
    .writeFileString(summaryPath, `${summaryJson}\n`)
    .pipe(PracticeKgProjectionError.mapError(`Failed writing graph summary "${summaryPath}".`));
  return summary;
});

/**
 * Injected projection service for deterministic practice knowledge-graph builds.
 *
 * @remarks
 * `build` is dependency-free by construction: the layer that provides this
 * service has already captured the host's filesystem, path, and SQL client, so a
 * caller yielding this service needs nothing else in context.
 *
 * @example
 * ```ts
 * import { PracticeKgOptions, PracticeKgProjections } from "@beep/law-practice-server"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const edgeCount = Effect.gen(function* () {
 *   const projections = yield* PracticeKgProjections
 *   const summary = yield* projections.build(
 *     PracticeKgOptions.make({
 *       corpusRoot: "/corpus",
 *       includeRefresh: true,
 *       maxTextBytes: NonNegativeInt.make(2_097_152),
 *       overwrite: true,
 *       skipEmails: false
 *     })
 *   )
 *   return summary.counts.edges
 * })
 *
 * console.log(Effect.isEffect(edgeCount)) // true
 * ```
 *
 * @see {@link PracticeKgProjectionsLive} for the layer that satisfies it.
 *
 * @category services
 * @since 0.0.0
 */
export class PracticeKgProjections extends Context.Service<
  PracticeKgProjections,
  {
    readonly build: (options: PracticeKgOptions) => Effect.Effect<PracticeKgSummary, PracticeKgProjectionError>;
  }
>()($I`PracticeKgProjections`) {}

/**
 * Projection layer capturing the host-provided filesystem, path, and SQL client.
 *
 * @remarks
 * The context is captured once when the layer is built and then closed over by
 * every `build` call, which is why {@link PracticeKgProjections} exposes a
 * requirement-free effect. The SQL client the layer sees is the one live at
 * build time — provide the bundle's own PGlite store beneath it, not a shared
 * application database.
 *
 * @example
 * ```ts
 * import { PracticeKgProjectionsLive } from "@beep/law-practice-server"
 * import * as Pglite from "@beep/pglite"
 * import * as BunServices from "@effect/platform-bun/BunServices"
 * import { Layer } from "effect"
 *
 * const bundleProjections = PracticeKgProjectionsLive.pipe(
 *   Layer.provide(Pglite.makeLayer({ dataDir: "/corpus/staging/practice-kg-bundle/kg.pglite" })),
 *   Layer.provide(BunServices.layer)
 * )
 *
 * console.log(typeof bundleProjections.pipe) // "function"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PracticeKgProjectionsLive = Layer.effect(
  PracticeKgProjections,
  Effect.gen(function* () {
    const dependencies = yield* Effect.context<FileSystem.FileSystem | Path.Path | SqlClient.SqlClient>();
    return PracticeKgProjections.of({
      build: Effect.fn("PracticeKgProjections.build")((options) =>
        buildPracticeKgBundleImpl(options).pipe(Effect.provide(dependencies))
      ),
    });
  })
);

/**
 * Build through the injected projection service.
 *
 * @remarks
 * The ordinary entry point for a bundle build. Everything the build needs is
 * reached through {@link PracticeKgProjections}, so the only wiring a caller
 * does is providing that service.
 *
 * @example
 * ```ts
 * import { buildPracticeKgBundle, PracticeKgOptions, PracticeKgProjectionsLive } from "@beep/law-practice-server"
 * import * as Pglite from "@beep/pglite"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as BunServices from "@effect/platform-bun/BunServices"
 * import { Effect } from "effect"
 *
 * const program = buildPracticeKgBundle(
 *   PracticeKgOptions.make({
 *     bundleOut: "/corpus/staging/practice-kg-bundle",
 *     corpusRoot: "/corpus",
 *     includeRefresh: true,
 *     maxTextBytes: NonNegativeInt.make(2_097_152),
 *     overwrite: true,
 *     skipEmails: false
 *   })
 * ).pipe(
 *   Effect.provide(PracticeKgProjectionsLive),
 *   Effect.provide(Pglite.makeLayer({ dataDir: "/corpus/staging/practice-kg-bundle/kg.pglite" })),
 *   Effect.provide(BunServices.layer)
 * )
 *
 * Effect.runPromise(program).then((summary) => console.log(summary.counts.nodes, summary.counts.edges))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const buildPracticeKgBundle = Effect.fn("PracticeKg.buildFromService")(function* (options: PracticeKgOptions) {
  const projections = yield* PracticeKgProjections;
  return yield* projections.build(options);
});
