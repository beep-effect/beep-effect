/**
 * Injected read handlers for the practice knowledge-graph MCP toolkit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  PracticeKgCandidateClaimsResult,
  PracticeKgToolError,
  PracticeKgToolkit,
  PracticeKgToolResult,
  practiceKgDocumentFieldTiers,
  practiceKgEmailFieldTiers,
  practiceKgFamilyFieldTiers,
  practiceKgGraphFieldTiers,
} from "@beep/law-practice-use-cases/server";
import { estimateJsonSize, FieldTierName, projectFieldTier, toColumnarEnvelope } from "@beep/mcp-kit";
import { NonNegativeInt } from "@beep/schema";
import * as OptionUtils from "@beep/utils/Option";
import { Context, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { SqlClient as SqlClientService } from "effect/unstable/sql/SqlClient";
import { PracticeKgBundleManifest } from "./PracticeKg.schemas.ts";
import type { FieldTierSet } from "@beep/mcp-kit";
import type { Layer } from "effect";
import type * as Tool from "effect/unstable/ai/Tool";
import type * as SqlClient from "effect/unstable/sql/SqlClient";

const $I = $LawPracticeServerId.create("PracticeKg.tool-handlers");
const spineStatus = "derived-from-official-records";
const emailLinkageNote =
  "Matter linkage is archive-level confidence only; a matching message header is not message-level matter proof.";
const tierOrder = A.reverse(FieldTierName.Options);

/**
 * Bundle metadata and optional corpus pointer supplied by the owning host.
 *
 * @example
 * ```ts
 * import { PracticeKgBundleContext } from "@beep/law-practice-server"
 * import { PracticeKgBundleManifest, PracticeKgCounts, PracticeKgSchemaVersions, PracticeKgSourceRuns } from "@beep/law-practice-server"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const context = PracticeKgBundleContext.make({
 *   bundleDir: "/bundle",
 *   manifest: PracticeKgBundleManifest.make({
 *     builtAt: "2026-07-27T00:00:00.000Z",
 *     bundleVersion: "2026-07-27-01",
 *     corpusRootExpected: true,
 *     counts: PracticeKgCounts.make({
 *       documents: NonNegativeInt.make(0),
 *       edges: NonNegativeInt.make(0),
 *       emails: NonNegativeInt.make(0),
 *       nodes: NonNegativeInt.make(0)
 *     }),
 *     schemaVersion: PracticeKgSchemaVersions.make({ duckdb: "1", pglite: "1" }),
 *     sourceRuns: PracticeKgSourceRuns.make({ base: "included", refresh202607: "excluded" })
 *   })
 * })
 * console.log(context.bundleDir)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgBundleContext extends S.Class<PracticeKgBundleContext>($I`PracticeKgBundleContext`)(
  {
    bundleDir: S.NonEmptyString,
    corpusRoot: S.optionalKey(S.NonEmptyString),
    manifest: PracticeKgBundleManifest,
  },
  $I.annote("PracticeKgBundleContext", {
    description: "Host-resolved bundle metadata and optional corpus content pointer.",
  })
) {}

/**
 * Context service carrying host-resolved practice KG bundle metadata.
 *
 * @example
 * ```ts
 * import { PracticeKgBundle } from "@beep/law-practice-server"
 *
 * console.log(typeof PracticeKgBundle.key) // "string"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PracticeKgBundle extends Context.Service<PracticeKgBundle, PracticeKgBundleContext>()(
  $I`PracticeKgBundle`
) {}

class GraphRow extends S.Class<GraphRow>("PracticeKgGraphToolRow")({
  client: S.NullOr(S.String),
  count: S.NullOr(S.Finite),
  docketFamily: S.NullOr(S.String),
  epistemicStatus: S.String,
  iri: S.String,
  kind: S.String,
  label: S.String,
  naturalKey: S.String,
  provenanceKind: S.String,
  provenanceRef: S.String,
}) {}

class FamilyRow extends S.Class<FamilyRow>("PracticeKgFamilyToolRow")({
  application: S.NullOr(S.String),
  applicationCount: S.Finite,
  docket: S.NullOr(S.String),
  docketCount: S.Finite,
  documentCount: S.Finite,
  documentDigest: S.NullOr(S.String),
  documentLabel: S.NullOr(S.String),
  family: S.String,
  patent: S.NullOr(S.String),
}) {}

class DocumentRow extends S.Class<DocumentRow>("PracticeKgDocumentToolRow")({
  digest: S.String,
  docket: S.NullOr(S.String),
  family: S.NullOr(S.String),
  organizedPath: S.NullOr(S.String),
  pointer: S.NullOr(S.String),
  score: S.NullOr(S.Finite),
  snippet: S.NullOr(S.String),
  sourceRelativePath: S.NullOr(S.String),
  text: S.NullOr(S.String),
  truncated: S.NullOr(S.Boolean),
}) {}

class EmailRow extends S.Class<EmailRow>("PracticeKgEmailToolRow")({
  archiveDigest: S.String,
  conversationTopic: S.NullOr(S.String),
  deliveryIso: S.NullOr(S.String),
  folderPath: S.String,
  messageRelPath: S.String,
  recipients: S.String,
  senderEmail: S.NullOr(S.String),
  senderName: S.NullOr(S.String),
  subject: S.String,
  submitIso: S.NullOr(S.String),
}) {}

const decodeGraphRows = S.decodeUnknownEffect(S.Array(GraphRow));
const decodeFamilyRows = S.decodeUnknownEffect(S.Array(FamilyRow));
const decodeDocumentRows = S.decodeUnknownEffect(S.Array(DocumentRow));
const decodeEmailRows = S.decodeUnknownEffect(S.Array(EmailRow));

const graphRecord = (row: GraphRow): Record<string, unknown> => ({
  client: row.client,
  count: row.count,
  docketFamily: row.docketFamily,
  epistemicStatus: row.epistemicStatus,
  iri: row.iri,
  kind: row.kind,
  label: row.label,
  naturalKey: row.naturalKey,
  provenanceKind: row.provenanceKind,
  provenanceRef: row.provenanceRef,
});

const familyRecord = (row: FamilyRow): Record<string, unknown> => ({
  application: row.application,
  applicationCount: row.applicationCount,
  docket: row.docket,
  docketCount: row.docketCount,
  documentCount: row.documentCount,
  documentDigest: row.documentDigest,
  documentLabel: row.documentLabel,
  family: row.family,
  patent: row.patent,
});

const documentRecord = (row: DocumentRow): Record<string, unknown> => ({
  digest: row.digest,
  docket: row.docket,
  family: row.family,
  organizedPath: row.organizedPath,
  pointer: row.pointer,
  score: row.score,
  snippet: row.snippet,
  sourceRelativePath: row.sourceRelativePath,
  text: row.text,
  truncated: row.truncated,
});

const emailRecord = (row: EmailRow): Record<string, unknown> => ({
  archiveDigest: row.archiveDigest,
  conversationTopic: row.conversationTopic,
  deliveryIso: row.deliveryIso,
  folderPath: row.folderPath,
  messageRelPath: row.messageRelPath,
  recipients: row.recipients,
  senderEmail: row.senderEmail,
  senderName: row.senderName,
  subject: row.subject,
  submitIso: row.submitIso,
});

const projectRows = (
  rows: ReadonlyArray<Record<string, unknown>>,
  tiers: FieldTierSet<S.Struct.Fields, S.Struct.Fields, S.Struct.Fields>,
  budgetBytes: number,
  bundleVersion: string,
  note?: string | undefined
): PracticeKgToolResult => {
  for (const tier of tierOrder) {
    const data = toColumnarEnvelope(A.map(rows, (row) => projectFieldTier(row, tier, tiers)));
    if (estimateJsonSize(data) <= budgetBytes) {
      return PracticeKgToolResult.make({
        bundle_version: bundleVersion,
        data,
        epistemic_status: spineStatus,
        ...OptionUtils.getSomesStruct({ note: O.fromUndefinedOr(note) }),
        tier,
        total: NonNegativeInt.make(A.length(rows)),
        truncated: false,
      });
    }
  }

  const minimalRows = A.map(rows, (row) => projectFieldTier(row, "minimal", tiers));
  const fitting = A.findFirst(
    A.reverse(A.range(0, A.length(minimalRows))),
    (count) => estimateJsonSize(toColumnarEnvelope(A.take(minimalRows, count))) <= budgetBytes
  ).pipe(O.getOrElse(() => 0));
  return PracticeKgToolResult.make({
    bundle_version: bundleVersion,
    data: toColumnarEnvelope(A.take(minimalRows, fitting)),
    epistemic_status: spineStatus,
    ...OptionUtils.getSomesStruct({ note: O.fromUndefinedOr(note) }),
    tier: "minimal",
    total: NonNegativeInt.make(A.length(rows)),
    truncated: fitting < A.length(rows),
  });
};

const toolFailure =
  (tool: string) =>
  (_cause: unknown): PracticeKgToolError =>
    PracticeKgToolError.make({ message: "Practice knowledge-graph bundle query failed.", tool });

const queryPglite = <A>(
  sql: SqlClient.SqlClient,
  statement: string,
  parameters: ReadonlyArray<unknown>,
  decode: (input: unknown) => Effect.Effect<ReadonlyArray<A>, unknown>
): Effect.Effect<ReadonlyArray<A>, PracticeKgToolError> =>
  sql.unsafe(statement, parameters).pipe(Effect.flatMap(decode), Effect.mapError(toolFailure("pglite")));

const addCorpusPointers = (
  rows: ReadonlyArray<DocumentRow>,
  corpusRoot: string | undefined
): ReadonlyArray<DocumentRow> =>
  A.map(rows, (row) => {
    const relative = O.fromNullOr(row.sourceRelativePath);
    const pointer = O.all({ root: O.fromUndefinedOr(corpusRoot), relative }).pipe(
      O.map(({ root, relative: path }) => `${root}/${path}`),
      O.getOrNull
    );
    return DocumentRow.make({ ...row, pointer });
  });

const clientsSql = `
SELECT
  c.iri,
  c.kind,
  c.natural_key AS "naturalKey",
  c.label,
  c.docket_family AS "docketFamily",
  c.client,
  c.epistemic_status AS "epistemicStatus",
  c.provenance_kind AS "provenanceKind",
  c.provenance_ref AS "provenanceRef",
  COUNT(e.object_iri)::FLOAT8 AS count
FROM kg_node c
LEFT JOIN kg_edge e ON e.subject_iri = c.iri AND e.predicate = 'has_docket_family'
WHERE c.kind = 'client'
GROUP BY c.iri, c.kind, c.natural_key, c.label, c.docket_family, c.client,
  c.epistemic_status, c.provenance_kind, c.provenance_ref
UNION ALL
SELECT
  '', 'docket_family', '__unattributed__', 'Unattributed families', NULL, NULL,
  'derived-from-official-records', 'organize-row', 'unattributed',
  COUNT(*)::FLOAT8
FROM kg_node f
WHERE f.kind = 'docket_family'
  AND NOT EXISTS (
    SELECT 1 FROM kg_edge e WHERE e.object_iri = f.iri AND e.predicate = 'has_docket_family'
  )
ORDER BY "naturalKey"`;

const familySql = `
WITH family AS (
  SELECT iri, natural_key FROM kg_node WHERE kind = 'docket_family' AND natural_key = $1
),
dockets AS (
  SELECT d.iri, d.natural_key
  FROM family f
  JOIN kg_edge e ON e.subject_iri = f.iri AND e.predicate = 'has_docket'
  JOIN kg_node d ON d.iri = e.object_iri
),
applications AS (
  SELECT DISTINCT a.iri, a.natural_key
  FROM dockets d
  JOIN kg_edge e ON e.subject_iri = d.iri AND e.predicate = 'files_as'
  JOIN kg_node a ON a.iri = e.object_iri
),
patents AS (
  SELECT DISTINCT p.natural_key, a.iri AS application_iri
  FROM applications a
  JOIN kg_edge e ON e.subject_iri = a.iri AND e.predicate = 'granted_as'
  JOIN kg_node p ON p.iri = e.object_iri
),
documents AS (
  SELECT d.iri AS docket_iri, doc.natural_key, doc.label
  FROM dockets d
  JOIN kg_edge e ON e.subject_iri = d.iri AND e.predicate = 'has_document'
  JOIN kg_node doc ON doc.iri = e.object_iri
)
SELECT
  f.natural_key AS family,
  d.natural_key AS docket,
  a.natural_key AS application,
  p.natural_key AS patent,
  doc.natural_key AS "documentDigest",
  doc.label AS "documentLabel",
  (SELECT COUNT(*)::FLOAT8 FROM dockets) AS "docketCount",
  (SELECT COUNT(*)::FLOAT8 FROM applications) AS "applicationCount",
  (SELECT COUNT(*)::FLOAT8 FROM documents) AS "documentCount"
FROM family f
LEFT JOIN dockets d ON TRUE
LEFT JOIN applications a ON TRUE
LEFT JOIN patents p ON p.application_iri = a.iri
LEFT JOIN documents doc ON doc.docket_iri = d.iri
ORDER BY d.natural_key, a.natural_key, p.natural_key, doc.natural_key`;

const applicationSql = `
WITH applications AS (
  SELECT iri FROM kg_node WHERE kind = 'application' AND natural_key = $1
  UNION
  SELECT e.subject_iri
  FROM kg_node p
  JOIN kg_edge e ON e.object_iri = p.iri AND e.predicate = 'granted_as'
  WHERE p.kind = 'patent' AND p.natural_key = $2
  UNION
  SELECT e.object_iri
  FROM kg_node d
  JOIN kg_edge e ON e.subject_iri = d.iri AND e.predicate = 'files_as'
  WHERE d.kind = 'docket' AND d.natural_key = $3
),
related AS (
  SELECT iri FROM applications
  UNION
  SELECT e.subject_iri FROM kg_edge e JOIN applications a ON e.object_iri = a.iri
    WHERE e.predicate IN ('files_as', 'granted_as', 'continuation_of', 'enriched_family')
  UNION
  SELECT e.object_iri FROM kg_edge e JOIN applications a ON e.subject_iri = a.iri
    WHERE e.predicate IN ('files_as', 'granted_as', 'continuation_of', 'enriched_family')
)
SELECT
  n.iri,
  n.kind,
  n.natural_key AS "naturalKey",
  n.label,
  n.docket_family AS "docketFamily",
  n.client,
  n.epistemic_status AS "epistemicStatus",
  n.provenance_kind AS "provenanceKind",
  n.provenance_ref AS "provenanceRef",
  NULL::FLOAT8 AS count
FROM kg_node n
JOIN related r ON r.iri = n.iri
ORDER BY n.kind, n.natural_key`;

const findSql = `
SELECT
  iri,
  kind,
  natural_key AS "naturalKey",
  label,
  docket_family AS "docketFamily",
  client,
  epistemic_status AS "epistemicStatus",
  provenance_kind AS "provenanceKind",
  provenance_ref AS "provenanceRef",
  NULL::FLOAT8 AS count
FROM kg_node
WHERE label ILIKE $1 OR natural_key ILIKE $1
ORDER BY kind, natural_key
LIMIT 100`;

const searchTextSql = `
WITH query_terms AS (
  SELECT UNNEST(regexp_extract_all(lower($1), '[a-z0-9]+(?:[-/][a-z0-9]+)*')) AS term
),
scores AS (
  SELECT b.doc_id, SUM(b.score)::DOUBLE AS score
  FROM fts_bm25 b
  JOIN query_terms q USING (term)
  WHERE b.doc_id LIKE 'document:%'
  GROUP BY b.doc_id
)
SELECT
  d.digest,
  d.docket,
  d.docket_family AS family,
  d.organized_relative_path AS "organizedPath",
  s.score,
  left(t.text, 500) AS snippet,
  d.source_relative_path AS "sourceRelativePath",
  NULL::VARCHAR AS text,
  t.truncated,
  NULL::VARCHAR AS pointer
FROM scores s
JOIN documents d ON s.doc_id = 'document:' || d.digest
LEFT JOIN document_text t ON t.digest = d.digest
WHERE ($2 IS NULL OR d.docket_family = $2)
ORDER BY s.score DESC, d.digest
LIMIT $3`;

const getDocumentSql = `
SELECT
  d.digest,
  d.docket,
  d.docket_family AS family,
  d.organized_relative_path AS "organizedPath",
  NULL::DOUBLE AS score,
  CASE WHEN t.text IS NULL THEN NULL ELSE left(t.text, 500) END AS snippet,
  d.source_relative_path AS "sourceRelativePath",
  CASE WHEN t.text IS NULL THEN NULL ELSE substr(t.text, $3, $4) END AS text,
  t.truncated,
  NULL::VARCHAR AS pointer
FROM documents d
LEFT JOIN document_text t ON t.digest = d.digest
WHERE ($1 IS NOT NULL AND d.digest = $1)
   OR ($2 IS NOT NULL AND d.organized_relative_path = $2)
ORDER BY d.digest
LIMIT 1`;

const emailSql = `
SELECT
  archive_digest AS "archiveDigest",
  folder_path AS "folderPath",
  subject,
  conversation_topic AS "conversationTopic",
  sender_name AS "senderName",
  sender_email AS "senderEmail",
  recipients,
  submit_iso AS "submitIso",
  delivery_iso AS "deliveryIso",
  message_rel_path AS "messageRelPath"
FROM email_messages
WHERE ($1 IS NULL OR subject ILIKE $1 OR conversation_topic ILIKE $1 OR recipients ILIKE $1)
  AND ($2 IS NULL OR sender_name ILIKE $2 OR sender_email ILIKE $2)
  AND ($3 IS NULL OR submit_iso >= $3)
  AND ($4 IS NULL OR submit_iso <= $4)
  AND ($5 IS NULL OR subject ILIKE $5 OR folder_path ILIKE $5)
ORDER BY archive_digest, folder_path, message_ord
LIMIT 200`;

const provenanceSql = `
SELECT
  iri,
  kind,
  natural_key AS "naturalKey",
  label,
  docket_family AS "docketFamily",
  client,
  epistemic_status AS "epistemicStatus",
  provenance_kind AS "provenanceKind",
  provenance_ref AS "provenanceRef",
  NULL::FLOAT8 AS count
FROM kg_node
WHERE ($1 IS NOT NULL AND iri = $1)
   OR ($2 IS NOT NULL AND natural_key = $2)
   OR ($3 IS NOT NULL AND natural_key = $3)
ORDER BY kind, natural_key`;

const provenanceDocumentSql = `
SELECT
  d.digest,
  d.docket,
  d.docket_family AS family,
  d.organized_relative_path AS "organizedPath",
  NULL::DOUBLE AS score,
  NULL::VARCHAR AS snippet,
  d.source_relative_path AS "sourceRelativePath",
  NULL::VARCHAR AS text,
  NULL::BOOLEAN AS truncated,
  NULL::VARCHAR AS pointer
FROM documents d
WHERE d.digest = $1
ORDER BY d.digest`;

/**
 * Live toolkit handlers over injected PGlite SQL, DuckDB, and bundle metadata.
 *
 * @remarks
 * This layer never constructs either database. The app owns both long-lived
 * resource layers and supplies them once for the stdio host lifetime.
 *
 * @example
 * ```ts
 * import { PracticeKgToolkitHandlersLive } from "@beep/law-practice-server"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(PracticeKgToolkitHandlersLive))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PracticeKgToolkitHandlersLive: Layer.Layer<
  Tool.HandlersFor<typeof PracticeKgToolkit.tools>,
  never,
  DuckDb | PracticeKgBundle | SqlClientService
> = PracticeKgToolkit.toLayer(
  Effect.gen(function* () {
    const bundle = yield* PracticeKgBundle;
    const duckdb = yield* DuckDb;
    const sql = (yield* SqlClientService).withoutTransforms();
    const version = bundle.manifest.bundleVersion;

    return PracticeKgToolkit.of({
      kg_clients: Effect.fn("PracticeKgTools.kg_clients")(function* (request) {
        const rows = yield* queryPglite(sql, clientsSql, [], decodeGraphRows).pipe(
          Effect.mapError(toolFailure("kg_clients"))
        );
        return projectRows(A.map(rows, graphRecord), practiceKgGraphFieldTiers, request.budgetBytes, version);
      }),
      kg_docket_family: Effect.fn("PracticeKgTools.kg_docket_family")(function* (request) {
        const rows = yield* queryPglite(sql, familySql, [request.family], decodeFamilyRows).pipe(
          Effect.mapError(toolFailure("kg_docket_family"))
        );
        return projectRows(A.map(rows, familyRecord), practiceKgFamilyFieldTiers, request.budgetBytes, version);
      }),
      kg_application_lookup: Effect.fn("PracticeKgTools.kg_application_lookup")(function* (request) {
        const rows = yield* queryPglite(
          sql,
          applicationSql,
          [request.application_number ?? null, request.patent_number ?? null, request.docket ?? null],
          decodeGraphRows
        ).pipe(Effect.mapError(toolFailure("kg_application_lookup")));
        return projectRows(A.map(rows, graphRecord), practiceKgGraphFieldTiers, request.budgetBytes, version);
      }),
      kg_find: Effect.fn("PracticeKgTools.kg_find")(function* (request) {
        const rows = yield* queryPglite(sql, findSql, [`%${request.query}%`], decodeGraphRows).pipe(
          Effect.mapError(toolFailure("kg_find"))
        );
        return projectRows(A.map(rows, graphRecord), practiceKgGraphFieldTiers, request.budgetBytes, version);
      }),
      corpus_search_text: Effect.fn("PracticeKgTools.corpus_search_text")(function* (request) {
        const rows = yield* duckdb.query(searchTextSql, [request.query, request.family ?? null, request.limit]).pipe(
          Effect.flatMap(decodeDocumentRows),
          Effect.map((rows) => addCorpusPointers(rows, bundle.corpusRoot)),
          Effect.mapError(toolFailure("corpus_search_text"))
        );
        return projectRows(A.map(rows, documentRecord), practiceKgDocumentFieldTiers, request.budgetBytes, version);
      }),
      corpus_get_document: Effect.fn("PracticeKgTools.corpus_get_document")(function* (request) {
        const rows = yield* duckdb
          .query(getDocumentSql, [
            request.digest ?? null,
            request.organized_path ?? null,
            request.range?.start ?? 1,
            request.range?.length ?? 2_097_152,
          ])
          .pipe(
            Effect.flatMap(decodeDocumentRows),
            Effect.map((rows) => addCorpusPointers(rows, bundle.corpusRoot)),
            Effect.mapError(toolFailure("corpus_get_document"))
          );
        return projectRows(A.map(rows, documentRecord), practiceKgDocumentFieldTiers, request.budgetBytes, version);
      }),
      email_search: Effect.fn("PracticeKgTools.email_search")(function* (request) {
        const like = O.map(O.fromUndefinedOr(request.query), (query) => `%${query}%`).pipe(O.getOrNull);
        const sender = O.map(O.fromUndefinedOr(request.sender), (value) => `%${value}%`).pipe(O.getOrNull);
        const family = O.map(O.fromUndefinedOr(request.family), (value) => `%${value}%`).pipe(O.getOrNull);
        const rows = yield* duckdb
          .query(emailSql, [like, sender, request.after ?? null, request.before ?? null, family])
          .pipe(Effect.flatMap(decodeEmailRows), Effect.mapError(toolFailure("email_search")));
        return projectRows(
          A.map(rows, emailRecord),
          practiceKgEmailFieldTiers,
          request.budgetBytes,
          version,
          emailLinkageNote
        );
      }),
      kg_candidate_claims: Effect.fn("PracticeKgTools.kg_candidate_claims")(function* () {
        return PracticeKgCandidateClaimsResult.make({
          available: false,
          bundle_version: version,
          epistemic_status: "candidate-unreviewed",
          reason: "claims batch not yet loaded",
        });
      }),
      kg_provenance: Effect.fn("PracticeKgTools.kg_provenance")(
        function* (request) {
          const hasKey = request.iri !== undefined || request.natural_key !== undefined || request.digest !== undefined;
          if (!hasKey) {
            const statusRow: Record<string, unknown> = {
              client: null,
              count: bundle.manifest.counts.nodes,
              docketFamily: null,
              epistemicStatus: spineStatus,
              iri: "",
              kind: "bundle",
              label: bundle.manifest.builtAt,
              naturalKey: version,
              provenanceKind: "bundle-manifest",
              provenanceRef: bundle.bundleDir,
            };
            return projectRows([statusRow], practiceKgGraphFieldTiers, request.budgetBytes, version);
          }
          if (request.digest !== undefined) {
            const documents = yield* duckdb.query(provenanceDocumentSql, [request.digest]).pipe(
              Effect.flatMap(decodeDocumentRows),
              Effect.map((rows) => addCorpusPointers(rows, bundle.corpusRoot))
            );
            return projectRows(
              A.map(documents, documentRecord),
              practiceKgDocumentFieldTiers,
              request.budgetBytes,
              version
            );
          }
          const rows = yield* queryPglite(
            sql,
            provenanceSql,
            [request.iri ?? null, request.natural_key ?? null, null],
            decodeGraphRows
          );
          return projectRows(A.map(rows, graphRecord), practiceKgGraphFieldTiers, request.budgetBytes, version);
        },
        Effect.mapError(toolFailure("kg_provenance"))
      ),
    });
  })
);
