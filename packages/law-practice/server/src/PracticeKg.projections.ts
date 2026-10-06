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
import * as O from "@beep/utils/Option";
import { Context, DateTime, Effect, FileSystem, HashSet, Layer, MutableHashMap, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { readEmailRows } from "./PracticeKg.emails.ts";
import { PracticeKgProjectionError } from "./PracticeKg.errors.ts";
import {
  applyPracticeKgPathEvidence,
  attributeDocuments,
  PracticeKgAttributeDocumentsInput,
  PracticeKgResolveAnchorsInput,
  reconcileAnchors,
  resolveAnchors,
} from "./PracticeKg.families.ts";
import { buildDuckDb, GraphTextSourceSpec } from "./PracticeKg.fts.ts";
import { buildMatterTables, PracticeKgMatterGraph, writeMatterTables } from "./PracticeKg.matters.ts";
import { readReferenceScans } from "./PracticeKg.references.ts";
import { practiceKgRegisterClientNames, readPracticeKgDocketRegister } from "./PracticeKg.register.ts";
import { PracticeKgCatalogRow, PracticeKgEnrichmentRow, stripPrefix, withDuckDb } from "./PracticeKg.rows.ts";
import {
  encodePracticeKgBundleManifestJson,
  encodePracticeKgCountsJson,
  encodePracticeKgNodePayloadJson,
  encodePracticeKgSummaryJson,
  PRACTICE_KG_REFRESH_RUN,
  PracticeKgBundleManifest,
  PracticeKgCounts,
  PracticeKgEdgeRow,
  PracticeKgNodeRow,
  PracticeKgOptions,
  PracticeKgSchemaVersions,
  PracticeKgSourceRuns,
  PracticeKgSummary,
} from "./PracticeKg.schemas.ts";
import type { KgAttributionSource, KgEdgePredicate, KgNodeKind } from "@beep/law-practice-domain/values";
import type { PracticeKgAnchorResolution, PracticeKgDocumentAttribution } from "./PracticeKg.families.ts";
import type { PracticeKgReferenceScans } from "./PracticeKg.references.ts";
import type { PracticeKgDocketRegisterRow } from "./PracticeKg.register.ts";
import type {
  PracticeKgEmailHeaderRow,
  PracticeKgEpistemicStatus,
  PracticeKgProvenanceKind,
} from "./PracticeKg.schemas.ts";

const $I = $LawPracticeServerId.create("PracticeKg.projections");
const graphIdentity = $BeepId.create("practice-kg");
const graphBundleVersion = "2026-10-06-02";
const runListSeparator = " | ";
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

/*
 * `$1` is the folded-in run labels joined by `runListSeparator`.
 *
 * A run is optional when it holds at least one file the organizer never saw
 * (a digest with no `corpus_organized` row). An optional run that is not
 * included is skipped whole, so its copies of organized files do not change
 * those files' size, date, or origin chain. An included run adds each of its
 * unorganized files once, flagged `runFolded`.
 *
 * An organized file reports the run, size, and date of the organizer's copy.
 * When an included run holds the same file, that copy is ranked after every
 * copy from a run that is not included, so it never takes the row over; it is
 * the reported copy only when no other exists. The origin chain still lists
 * every run and path, and is the relation to read for "which runs hold this".
 */
const catalogRowsSql = `
WITH included_runs AS (
  SELECT UNNEST(string_split($1, '${runListSeparator}')) AS run_label
),
skipped_runs AS (
  SELECT DISTINCT f.run_label
  FROM corpus_source_files f
  WHERE NOT EXISTS (SELECT 1 FROM corpus_organized o WHERE o.digest = f.digest)
    AND NOT EXISTS (SELECT 1 FROM included_runs i WHERE i.run_label = f.run_label)
),
ranked_copies AS (
  SELECT
    f.digest,
    f.size_bytes,
    f.mtime_iso,
    f.run_label,
    f.source_label,
    f.relative_path,
    f.run_label || ':' || f.source_label || ':' || f.relative_path AS origin,
    CASE WHEN EXISTS (SELECT 1 FROM included_runs i WHERE i.run_label = f.run_label) THEN 1 ELSE 0 END
      AS included_rank
  FROM corpus_source_files f
  WHERE NOT EXISTS (SELECT 1 FROM skipped_runs k WHERE k.run_label = f.run_label)
)
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
  COALESCE(o.restored, FALSE) AS restored,
  CAST(COALESCE(s.size_bytes, 0) AS DOUBLE) AS "sizeBytes",
  COALESCE(s.mtime_iso, '1970-01-01T00:00:00.000Z') AS "mtimeIso",
  COALESCE(s.run_label, 'base') AS "runLabel"
  ,COALESCE(s.source_origin_chain, o.source_relative_path) AS "sourceOriginChain"
  ,FALSE AS "runFolded"
FROM corpus_organized o
LEFT JOIN (
  SELECT
    digest,
    ARG_MIN(size_bytes, included_rank || ':' || origin) AS size_bytes,
    ARG_MIN(mtime_iso, included_rank || ':' || origin) AS mtime_iso,
    ARG_MIN(run_label, included_rank || ':' || origin) AS run_label
    ,STRING_AGG(origin, ' <- ' ORDER BY run_label, source_label, relative_path) AS source_origin_chain
  FROM ranked_copies
  GROUP BY digest
) s USING (digest)
UNION ALL
SELECT
  folded.digest,
  folded.source_label AS "sourceLabel",
  folded.relative_path AS "sourceRelativePath",
  'unsorted' AS category,
  NULL AS client,
  NULL AS docket,
  NULL AS "docketFamily",
  NULL AS "organizedRelativePath",
  regexp_extract(folded.relative_path, '[^/\\\\]+$', 0) AS "effectiveName",
  FALSE AS restored,
  CAST(folded.size_bytes AS DOUBLE) AS "sizeBytes",
  folded.mtime_iso AS "mtimeIso",
  folded.run_label AS "runLabel"
  ,folded.run_label || ':' || folded.source_label || ':' || folded.relative_path AS "sourceOriginChain"
  ,TRUE AS "runFolded"
FROM (
  SELECT f.*,
    ROW_NUMBER() OVER (
      PARTITION BY f.digest
      ORDER BY f.run_label, f.source_label, f.relative_path
    ) AS digest_ord
  FROM corpus_source_files f
  WHERE EXISTS (SELECT 1 FROM included_runs i WHERE i.run_label = f.run_label)
) folded
WHERE folded.digest_ord = 1
  AND NOT EXISTS (SELECT 1 FROM corpus_organized organized WHERE organized.digest = folded.digest)
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

// Base digests are those of the runs the organizer covered in full; see `catalogRowsSql`.
const reconciliationSql = `
WITH optional_runs AS (
  SELECT DISTINCT f.run_label
  FROM corpus_source_files f
  WHERE NOT EXISTS (SELECT 1 FROM corpus_organized o WHERE o.digest = f.digest)
)
SELECT
  CAST((SELECT COUNT(*) FROM corpus_source_files) AS DOUBLE) AS "sourceRows",
  CAST((
    SELECT COUNT(DISTINCT f.digest) FROM corpus_source_files f
    WHERE NOT EXISTS (SELECT 1 FROM optional_runs r WHERE r.run_label = f.run_label)
  ) AS DOUBLE) AS "baseDigests",
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
  attribution_source TEXT NOT NULL,
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
  built_at TEXT NOT NULL,
  corpus_snapshot_at TEXT NOT NULL
)`,
];

const insertKgNode = `
INSERT INTO ${KG_NODE_TABLE_NAME}
  (iri, kind, natural_key, label, docket_family, client, attribution_source, epistemic_status, provenance_kind, provenance_ref, payload)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`;

const insertKgEdge = `
INSERT INTO ${KG_EDGE_TABLE_NAME}
  (subject_iri, predicate, object_iri, epistemic_status, provenance_kind, provenance_ref)
VALUES ($1, $2, $3, $4, $5, $6)`;

const graphIri = (kind: KgNodeKind, naturalKey: string): string => graphIdentity.create(kind).create(naturalKey).iri;

const edgeKey = (edge: PracticeKgEdgeRow): string => `${edge.subjectIri}\u0000${edge.predicate}\u0000${edge.objectIri}`;

const firstOrFail = <A>(rows: ReadonlyArray<A>, label: string): Effect.Effect<A, PracticeKgProjectionError> =>
  A.head(rows).pipe(
    O.match({
      onNone: () => PracticeKgProjectionError.make({ message: `Graph build query returned no ${label} row.` }),
      onSome: Effect.succeed,
    })
  );

const readCatalog = Effect.fn("PracticeKg.readCatalog")(function* (
  databasePath: string,
  includedRuns: ReadonlyArray<string>
) {
  return yield* Effect.gen(function* () {
    const db = yield* DuckDb;
    const catalogRows = yield* db
      .query(catalogRowsSql, [A.join(includedRuns, runListSeparator)])
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
  attributionSource: KgAttributionSource,
  options: {
    readonly client?: string | null | undefined;
    readonly docketFamily?: string | null | undefined;
    readonly epistemicStatus?: PracticeKgEpistemicStatus | undefined;
    readonly payload?: Readonly<Record<string, unknown>> | undefined;
  } = {}
): PracticeKgNodeRow =>
  PracticeKgNodeRow.make({
    attributionSource,
    iri: graphIri(kind, naturalKey),
    kind,
    label,
    naturalKey,
    payload: options.payload ?? {},
    provenanceKind,
    provenanceRef,
    ...O.getSomesStruct({
      client: O.fromNullishOr(options.client),
      docketFamily: O.fromNullishOr(options.docketFamily),
      epistemicStatus: O.fromNullishOr(options.epistemicStatus),
    }),
  });

const createEdge = (
  subjectKind: KgNodeKind,
  subjectKey: string,
  predicate: KgEdgePredicate,
  objectKind: KgNodeKind,
  objectKey: string,
  provenanceKind: PracticeKgProvenanceKind,
  provenanceRef: string,
  epistemicStatus?: PracticeKgEpistemicStatus
): PracticeKgEdgeRow =>
  PracticeKgEdgeRow.make({
    objectIri: graphIri(objectKind, objectKey),
    predicate,
    provenanceKind,
    provenanceRef,
    subjectIri: graphIri(subjectKind, subjectKey),
    ...O.getSomesStruct({ epistemicStatus: O.fromNullishOr(epistemicStatus) }),
  });

const familyLabel = (attribution: PracticeKgDocumentAttribution, family: string): string =>
  attribution.client === null ? `${family} (unattributed)` : `${attribution.client}.${family}`;

const recycledStatus = (attribution: PracticeKgDocumentAttribution): PracticeKgEpistemicStatus | undefined =>
  attribution.recycled ? "recycled-unverified" : undefined;

type GraphSink = {
  readonly addEdge: (edge: PracticeKgEdgeRow) => void;
  /** The docket register's name for a client number, or the number itself. */
  readonly clientLabel: (client: string) => string;
  /** First write wins: spine nodes are minted once per key, stubs never replace a node. */
  readonly addNode: (node: PracticeKgNodeRow) => void;
  /** Whether at least one non-recycled document backs this spine key. */
  readonly isVerified: (kind: "client" | "docket" | "family", key: string) => boolean;
  /** Last write wins: an anchor's own record replaces a parent stub minted earlier. */
  readonly putNode: (node: PracticeKgNodeRow) => void;
};

const spineStatus = (
  sink: GraphSink,
  kind: "client" | "docket" | "family",
  key: string
): PracticeKgEpistemicStatus | undefined => (sink.isVerified(kind, key) ? undefined : "recycled-unverified");

const projectDocumentNode = (
  sink: GraphSink,
  row: PracticeKgCatalogRow,
  attribution: PracticeKgDocumentAttribution
) => {
  const status = recycledStatus(attribution);
  sink.addNode(
    createNode("document", row.digest, row.effectiveName, "catalog-digest", row.digest, attribution.attributionSource, {
      client: attribution.client,
      docketFamily: attribution.family,
      epistemicStatus: status,
      payload: {
        category: row.category,
        mtimeIso: row.mtimeIso,
        organizedRelativePath: row.organizedRelativePath,
        sizeBytes: row.sizeBytes,
      },
    })
  );
  if (row.category === "email-archive") {
    sink.addNode(
      createNode("email_archive", row.digest, row.effectiveName, "catalog-digest", row.digest, "filename", {
        client: attribution.client,
        docketFamily: attribution.family,
      })
    );
  }
};

const projectFamilySpine = (sink: GraphSink, row: PracticeKgCatalogRow, attribution: PracticeKgDocumentAttribution) => {
  const { client, docketKey, family, familyKey } = attribution;
  if (family === null || familyKey === null) {
    return;
  }
  const status = recycledStatus(attribution);
  sink.addNode(
    createNode(
      "docket_family",
      familyKey,
      familyLabel(attribution, family),
      "organize-row",
      family,
      attribution.attributionSource,
      {
        client,
        docketFamily: family,
        epistemicStatus: spineStatus(sink, "family", familyKey),
      }
    )
  );
  if (docketKey === null || row.docket === null) {
    sink.addEdge(
      createEdge(
        "docket_family",
        familyKey,
        "family_document",
        "document",
        row.digest,
        "catalog-digest",
        row.digest,
        status
      )
    );
    return;
  }
  sink.addNode(
    createNode("docket", docketKey, docketKey, "organize-row", row.sourceRelativePath, attribution.attributionSource, {
      client,
      docketFamily: family,
      epistemicStatus: spineStatus(sink, "docket", docketKey),
    })
  );
  sink.addEdge(createEdge("docket_family", familyKey, "has_docket", "docket", docketKey, "organize-row", row.docket));
  sink.addEdge(
    createEdge("docket", docketKey, "has_document", "document", row.digest, "catalog-digest", row.digest, status)
  );
};

const projectClientSpine = (sink: GraphSink, row: PracticeKgCatalogRow, attribution: PracticeKgDocumentAttribution) => {
  const { client, familyKey } = attribution;
  if (client === null || familyKey === null) {
    return;
  }
  const [provenanceKind, provenanceRef]: readonly [PracticeKgProvenanceKind, string] =
    attribution.attributionSource === "client-map" ? ["organize-row", row.sourceLabel] : ["catalog-digest", row.digest];
  sink.addNode(
    createNode(
      "client",
      client,
      sink.clientLabel(client),
      provenanceKind,
      provenanceRef,
      attribution.attributionSource,
      {
        epistemicStatus: spineStatus(sink, "client", client),
      }
    )
  );
  sink.addEdge(
    createEdge("client", client, "has_docket_family", "docket_family", familyKey, provenanceKind, provenanceRef)
  );
};

type AnchorPlacement = {
  readonly client: string | null;
  readonly docketFamily: string | null;
  readonly memberFamilyKey: string | null;
  readonly mentionedFamilyKeys: ReadonlyArray<string>;
};

const anchorPlacement = (resolution: PracticeKgAnchorResolution): AnchorPlacement => ({
  client: resolution.memberClient,
  docketFamily: resolution.memberFamily,
  memberFamilyKey: resolution.memberFamilyKey,
  mentionedFamilyKeys: resolution.mentionedFamilyKeys,
});

const projectApplicationNode = (
  sink: GraphSink,
  resolution: PracticeKgAnchorResolution,
  application: string,
  placement: AnchorPlacement
) => {
  const { anchor } = resolution;
  sink.putNode(
    createNode(
      "application",
      application,
      anchor.inventionTitle ?? application,
      "uspto-anchor",
      application,
      resolution.attributionSource,
      {
        client: placement.client,
        docketFamily: placement.docketFamily,
        payload: {
          firstApplicantName: anchor.firstApplicantName,
          firstInventorName: anchor.firstInventorName,
          inventionTitle: anchor.inventionTitle,
          memberFamilyKey: placement.memberFamilyKey,
          mentionedFamilyKeys: placement.mentionedFamilyKeys,
        },
      }
    )
  );
  A.forEach(anchor.parentApplicationNumbers, (parent) => {
    sink.addNode(createNode("application", parent, parent, "uspto-anchor", application, "official-record"));
    sink.addEdge(
      createEdge("application", application, "continuation_of", "application", parent, "uspto-anchor", application)
    );
  });
};

const projectPatentNode = (
  sink: GraphSink,
  resolution: PracticeKgAnchorResolution,
  patent: string,
  placement: AnchorPlacement
) => {
  const { anchor } = resolution;
  const attributionSource: KgAttributionSource =
    anchor.applicationNumber === null ? resolution.attributionSource : "official-record";
  sink.putNode(
    createNode("patent", patent, anchor.inventionTitle ?? patent, "uspto-anchor", patent, attributionSource, {
      client: placement.client,
      docketFamily: placement.docketFamily,
      payload: {
        inventionTitle: anchor.inventionTitle,
        memberFamilyKey: placement.memberFamilyKey,
        mentionedFamilyKeys: placement.mentionedFamilyKeys,
      },
    })
  );
  if (anchor.applicationNumber !== null) {
    sink.addEdge(
      createEdge("application", anchor.applicationNumber, "granted_as", "patent", patent, "uspto-anchor", patent)
    );
  }
};

const projectAnchorEdges = (
  sink: GraphSink,
  resolution: PracticeKgAnchorResolution,
  anchorKind: KgNodeKind,
  anchorKey: string
) => {
  A.forEach(resolution.memberDocketKeys, (docketKey) =>
    sink.addEdge(createEdge("docket", docketKey, "files_as", anchorKind, anchorKey, "uspto-anchor", anchorKey))
  );
  A.forEach(resolution.mentionedFamilyKeys, (familyKey) =>
    sink.addEdge(
      createEdge(
        anchorKind,
        anchorKey,
        "mentioned_in_family",
        "docket_family",
        familyKey,
        "uspto-anchor",
        anchorKey,
        "mention-derived"
      )
    )
  );
};

const projectAnchor = (sink: GraphSink, resolution: PracticeKgAnchorResolution) => {
  const { applicationNumber: application, patentNumber: patent } = resolution.anchor;
  const placement = anchorPlacement(resolution);
  if (application !== null) {
    projectApplicationNode(sink, resolution, application, placement);
  }
  if (patent !== null) {
    projectPatentNode(sink, resolution, patent, placement);
  }
  const anchorKey = application ?? patent;
  if (anchorKey !== null) {
    projectAnchorEdges(sink, resolution, application === null ? "patent" : "application", anchorKey);
  }
};

const projectArchiveLinks = (
  sink: GraphSink,
  catalogRows: ReadonlyArray<PracticeKgCatalogRow>,
  archiveNodes: ReadonlyArray<PracticeKgNodeRow>
) => {
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
        sink.addEdge(
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
};

/*
 * Family, docket, and client nodes are minted from the attributed catalog rows
 * only. Enrichment never creates a family: the `docket_families` fan-out it
 * carries is mention-derived (prior-art citations included), which is the
 * cartesian defect the first gauntlet surfaced. Anchors join the spine through
 * `files_as` only when their number resolves to exactly one keyed family, and
 * otherwise hang off the families that mention them.
 */
const buildGraphRows = (
  catalogRows: ReadonlyArray<PracticeKgCatalogRow>,
  attributions: ReadonlyArray<PracticeKgDocumentAttribution>,
  resolutions: ReadonlyArray<PracticeKgAnchorResolution>,
  registerRows: ReadonlyArray<PracticeKgDocketRegisterRow>
): {
  readonly edges: ReadonlyArray<PracticeKgEdgeRow>;
  readonly nodes: ReadonlyArray<PracticeKgNodeRow>;
} => {
  const nodes = MutableHashMap.empty<string, PracticeKgNodeRow>();
  const edges = MutableHashMap.empty<string, PracticeKgEdgeRow>();
  const attributionByDigest = MutableHashMap.fromIterable(
    A.map(attributions, (attribution) => [attribution.digest, attribution] as const)
  );
  const verifiedKeys = HashSet.fromIterable(
    A.flatMap(
      A.filter(attributions, (attribution) => !attribution.recycled),
      (attribution: PracticeKgDocumentAttribution): ReadonlyArray<string> =>
        A.getSomes([
          O.map(O.fromNullishOr(attribution.client), (key) => `client:${key}`),
          O.map(O.fromNullishOr(attribution.docketKey), (key) => `docket:${key}`),
          O.map(O.fromNullishOr(attribution.familyKey), (key) => `family:${key}`),
        ])
    )
  );
  const clientNameOf = practiceKgRegisterClientNames(registerRows);
  const sink: GraphSink = {
    addEdge: (edge) => {
      MutableHashMap.set(edges, edgeKey(edge), edge);
    },
    clientLabel: (client) => O.getOrElse(clientNameOf(client), () => client),
    addNode: (node) => {
      if (!MutableHashMap.has(nodes, node.iri)) {
        MutableHashMap.set(nodes, node.iri, node);
      }
    },
    isVerified: (kind, key) => HashSet.has(verifiedKeys, `${kind}:${key}`),
    putNode: (node) => {
      MutableHashMap.set(nodes, node.iri, node);
    },
  };

  const attributed = A.map(catalogRows, (row) => ({
    attribution: pipe(
      MutableHashMap.get(attributionByDigest, row.digest),
      O.getOrThrowWith(() =>
        PracticeKgProjectionError.make({ message: `Graph build lost the attribution for "${row.digest}".` })
      )
    ),
    row,
  }));
  A.forEach(attributed, ({ attribution, row }) => projectDocumentNode(sink, row, attribution));
  // Spine nodes are first-write-wins, so verified documents go first: a shared
  // family or docket takes its attribution source from a live file whenever one
  // exists, and from a recycle stub only when nothing else backs it.
  const verified = A.filter(attributed, ({ attribution }) => !attribution.recycled);
  const recycled = A.filter(attributed, ({ attribution }) => attribution.recycled);
  A.forEach(A.appendAll(verified, recycled), ({ attribution, row }) => {
    projectFamilySpine(sink, row, attribution);
    projectClientSpine(sink, row, attribution);
  });
  A.forEach(resolutions, (resolution) => projectAnchor(sink, resolution));
  projectArchiveLinks(
    sink,
    catalogRows,
    A.filter(A.fromIterable(MutableHashMap.values(nodes)), (node) => node.kind === "email_archive")
  );

  return {
    edges: A.sort(A.fromIterable(MutableHashMap.values(edges)), Order.mapInput(Order.String, edgeKey)),
    nodes: A.sort(
      A.fromIterable(MutableHashMap.values(nodes)),
      Order.mapInput(Order.String, (node: PracticeKgNodeRow) => node.iri)
    ),
  };
};

const projectGraph = (
  catalogRows: ReadonlyArray<PracticeKgCatalogRow>,
  enrichmentRows: ReadonlyArray<PracticeKgEnrichmentRow>,
  scans: PracticeKgReferenceScans,
  registerRows: ReadonlyArray<PracticeKgDocketRegisterRow>
): ReturnType<typeof buildGraphRows> => {
  const attributions = attributeDocuments(
    PracticeKgAttributeDocumentsInput.make({ catalogRows, docketReferences: scans.docketReferences, registerRows })
  );
  const resolutions = resolveAnchors(
    PracticeKgResolveAnchorsInput.make({
      anchors: reconcileAnchors(enrichmentRows),
      attributions,
      numberMentions: scans.numberMentions,
    })
  );
  return buildGraphRows(catalogRows, attributions, resolutions, registerRows);
};

const writePgliteProjection = Effect.fn("PracticeKg.writePgliteProjection")(function* (
  nodes: ReadonlyArray<PracticeKgNodeRow>,
  edges: ReadonlyArray<PracticeKgEdgeRow>,
  counts: PracticeKgCounts,
  sourceRuns: PracticeKgSourceRuns,
  builtAt: string,
  corpusSnapshotAt: string,
  bundleVersion: string
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
            node.attributionSource,
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
    `INSERT INTO ${KG_BUILD_TABLE_NAME} (bundle_version, built_from_runs, counts, built_at, corpus_snapshot_at) VALUES ($1, $2, $3::jsonb, $4, $5)`,
    [
      bundleVersion,
      A.join(A.prepend(sourceRuns.includedRuns, "base"), runListSeparator),
      countsJson,
      builtAt,
      corpusSnapshotAt,
    ]
  );
});

const existingSourceSpecs = Effect.fn("PracticeKg.existingSourceSpecs")(function* (
  corpusRoot: string,
  includedRuns: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<GraphTextSourceSpec>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const roots = A.prepend(
    A.map(includedRuns, (run) => `staging/extract-${run}`),
    "staging/extract"
  );
  const candidates = yield* Effect.forEach(roots, (root) => {
    const sourcesPath = path.join(corpusRoot, root, "sources.jsonl");
    const textDir = path.join(corpusRoot, root, "text");
    return Effect.all([fs.exists(sourcesPath), fs.exists(textDir)], { concurrency: 2 }).pipe(
      Effect.orElseSucceed(() => [false, false]),
      Effect.map(([sourcesExist, textExists]) =>
        sourcesExist && textExists
          ? O.some(GraphTextSourceSpec.make({ sourcesPath, textGlob: path.join(textDir, "operation:*.txt") }))
          : O.none()
      )
    );
  });
  return A.getSomes(candidates);
});

const readRegisterRows = (
  options: PracticeKgOptions
): Effect.Effect<ReadonlyArray<PracticeKgDocketRegisterRow>, PracticeKgProjectionError, FileSystem.FileSystem> =>
  pipe(
    O.fromUndefinedOr(options.docketRegisterPath),
    O.match({
      onNone: () => Effect.succeed(A.empty<PracticeKgDocketRegisterRow>()),
      onSome: (registerPath) =>
        readPracticeKgDocketRegister(registerPath).pipe(
          Effect.mapError((cause) => PracticeKgProjectionError.make({ cause, message: cause.message }))
        ),
    })
  );

/**
 * Build a deterministic PGlite + DuckDB practice knowledge-graph bundle.
 *
 * **Gotchas**
 *
 * This is the unwrapped implementation: it takes its filesystem, path, and SQL
 * client from the ambient context rather than from a service, which is what lets
 * {@link PracticeKgProjectionsLive} capture the host's context once and hand out
 * a dependency-free {@link PracticeKgProjections}. Prefer
 * {@link buildPracticeKgBundle} at ordinary call sites.
 *
 * The build refuses to run against an existing bundle unless `overwrite` is set,
 * and a failure part-way through leaves the partial bundle on disk.
 *
 * **Example** (Build with overwrite options)
 *
 * ```ts
 * import { PracticeKgOptions } from "@beep/law-practice-server"
 * import { Effect } from "effect"
 * import { buildPracticeKgBundleImpl } from "../../src/PracticeKg.projections.ts"
 *
 * const build = buildPracticeKgBundleImpl(
 *   PracticeKgOptions.make({
 *     bundleOut: "/corpus/staging/practice-kg-bundle",
 *     corpusRoot: "/corpus",
 *     includeRefresh: true,
 *     overwrite: true,
 *     skipEmails: false
 *   })
 * ).pipe(Effect.map((summary) => summary.counts.nodes))
 *
 * console.log(Effect.isEffect(build)) // true
 * ```
 *
 * @param options - Corpus root, bundle destination, source-run, docket-register, email, text-budget, and replacement options.
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
  const bundleOut = PracticeKgOptions.resolveBundleOut(options, path);
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

  const includedRuns = PracticeKgOptions.includedRuns(options);
  const registerRows = yield* readRegisterRows(options);
  const catalog = yield* readCatalog(catalogPath, includedRuns);
  const { enrichmentRows, reconciliation } = catalog;
  // Folder-path evidence goes in before the DuckDB store is written, so the
  // reference scans read a working file under the docket its folder names.
  const catalogRows = applyPracticeKgPathEvidence(catalog.catalogRows);
  const sourceSpecs = yield* existingSourceSpecs(options.corpusRoot, includedRuns);
  const emailRows = options.skipEmails
    ? A.empty<PracticeKgEmailHeaderRow>()
    : yield* readEmailRows(path.join(options.corpusRoot, "staging", "extract", "children"));
  const duckDbPath = path.join(bundleOut, "practice.duckdb");
  const duckCounts = yield* buildDuckDb(
    duckDbPath,
    catalogRows,
    enrichmentRows,
    emailRows,
    sourceSpecs,
    options.maxTextBytes
  );
  const scans = yield* readReferenceScans(duckDbPath);
  const graph = projectGraph(catalogRows, enrichmentRows, scans, registerRows);
  yield* writeMatterTables(duckDbPath)(
    buildMatterTables(PracticeKgMatterGraph.make({ edges: graph.edges, nodes: graph.nodes, registerRows }))
  );
  const builtAt = DateTime.formatIso(yield* DateTime.now);
  const counts = PracticeKgCounts.make({
    documents: S.Natural.make(duckCounts.documents),
    edges: S.Natural.make(A.length(graph.edges)),
    emails: S.Natural.make(duckCounts.emails),
    nodes: S.Natural.make(A.length(graph.nodes)),
  });
  const sourceRuns = PracticeKgSourceRuns.make({
    base: "included",
    includedRuns,
    refresh202607: A.contains(includedRuns, PRACTICE_KG_REFRESH_RUN) ? "included" : "excluded",
  });
  const bundleVersion = options.bundleVersion ?? graphBundleVersion;
  yield* writePgliteProjection(
    graph.nodes,
    graph.edges,
    counts,
    sourceRuns,
    builtAt,
    reconciliation.snapshotIso,
    bundleVersion
  ).pipe(
    PracticeKgProjectionError.mapError(`Failed building graph PGlite store "${path.join(bundleOut, "kg.pglite")}".`)
  );

  const manifest = PracticeKgBundleManifest.make({
    builtAt,
    bundleVersion,
    corpusRootExpected: true,
    corpusSnapshotAt: reconciliation.snapshotIso,
    counts,
    schemaVersion: PracticeKgSchemaVersions.make({ duckdb: "3", pglite: "3" }),
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
    baseDigests: S.Natural.make(reconciliation.baseDigests),
    bundleOut,
    counts,
    docketFamilies: S.Natural.make(reconciliation.docketFamilies),
    docketFiles: S.Natural.make(reconciliation.docketFiles),
    familyAnchors: S.Natural.make(reconciliation.familyAnchors),
    includeRefresh: A.contains(includedRuns, PRACTICE_KG_REFRESH_RUN),
    includedRuns,
    sourceRows: S.Natural.make(reconciliation.sourceRows),
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
 * **Details**
 *
 * `build` is dependency-free by construction: the layer that provides this
 * service has already captured the host's filesystem, path, and SQL client, so a
 * caller yielding this service needs nothing else in context.
 *
 * **Example** (Yield service and build)
 *
 * ```ts
 * import { PracticeKgOptions, PracticeKgProjections } from "@beep/law-practice-server"
 * import { Effect } from "effect"
 *
 * const edgeCount = Effect.gen(function* () {
 *   const projections = yield* PracticeKgProjections
 *   const summary = yield* projections.build(
 *     PracticeKgOptions.make({
 *       corpusRoot: "/corpus",
 *       includeRefresh: true,
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
 * **Gotchas**
 *
 * The context is captured once when the layer is built and then closed over by
 * every `build` call, which is why {@link PracticeKgProjections} exposes a
 * requirement-free effect. The SQL client the layer sees is the one live at
 * build time — provide the bundle's own PGlite store beneath it, not a shared
 * application database.
 *
 * **Example** (Wire PGlite under projections)
 *
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
 * **Details**
 *
 * The ordinary entry point for a bundle build. Everything the build needs is
 * reached through {@link PracticeKgProjections}, so the only wiring a caller
 * does is providing that service.
 *
 * **Example** (Build with full layer stack)
 *
 * ```ts
 * import { buildPracticeKgBundle, PracticeKgOptions, PracticeKgProjectionsLive } from "@beep/law-practice-server"
 * import * as Pglite from "@beep/pglite"
 * import * as BunServices from "@effect/platform-bun/BunServices"
 * import { Effect } from "effect"
 *
 * const program = buildPracticeKgBundle(
 *   PracticeKgOptions.make({
 *     bundleOut: "/corpus/staging/practice-kg-bundle",
 *     corpusRoot: "/corpus",
 *     includeRefresh: true,
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
