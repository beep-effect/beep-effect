/**
 * Deterministic DuckDB document, email, enrichment, and BM25 projection for the practice KG.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { sqlStringLiteral } from "./internal/Sql.ts";
import { PracticeKgProjectionError } from "./PracticeKg.errors.ts";
import { practiceKgDocumentKey } from "./PracticeKg.families.ts";
import type { DuckDbShape } from "@beep/duckdb";
import type { PracticeKgDocumentAttribution } from "./PracticeKg.families.ts";
import type { PracticeKgCatalogRow, PracticeKgEnrichmentRow } from "./PracticeKg.rows.ts";
import type { PracticeKgEmailHeaderRow } from "./PracticeKg.schemas.ts";

const $I = $LawPracticeServerId.create("PracticeKg.fts");

/**
 * One extraction source feeding the bundle's `document_text` table: a
 * `sources.jsonl` manifest plus the glob of its extracted text files.
 *
 * **Example** (Make text source spec)
 *
 * ```ts
 * import { GraphTextSourceSpec } from "../../src/PracticeKg.fts.ts"
 *
 * const spec = GraphTextSourceSpec.make({
 *   sourcesPath: "/corpus/staging/extract/sources.jsonl",
 *   textGlob: "/corpus/staging/extract/text/operation:*.txt"
 * })
 *
 * console.log(spec.textGlob.endsWith(".txt")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraphTextSourceSpec extends S.Opaque<GraphTextSourceSpec, { readonly brand: unique symbol }>()(
  S.Struct({
    sourcesPath: S.String,
    textGlob: S.String,
  }).pipe(
    $I.annoteSchema("GraphTextSourceSpec", {
      description: "Extraction manifest path and text glob pair joined into document_text.",
    })
  )
) {}

class GraphDuckCountsRow extends S.Opaque<GraphDuckCountsRow, { readonly brand: unique symbol }>()(
  S.Struct({
    documents: S.Finite,
    emails: S.Finite,
  }).pipe($I.annoteSchema("GraphDuckCountsRow"))
) {}

const decodeDuckCountsRows = S.decodeUnknownEffect(S.NonEmptyArray(GraphDuckCountsRow));

const createDocumentsTable = `
CREATE TABLE documents (
  row_ord BIGINT PRIMARY KEY,
  digest VARCHAR NOT NULL,
  source_label VARCHAR NOT NULL,
  source_relative_path VARCHAR NOT NULL,
  category VARCHAR NOT NULL,
  client VARCHAR,
  docket VARCHAR,
  docket_family VARCHAR,
  organized_relative_path VARCHAR,
  effective_name VARCHAR NOT NULL,
  size_bytes BIGINT NOT NULL,
  mtime_iso VARCHAR NOT NULL,
  run_label VARCHAR NOT NULL,
  provenance_ref VARCHAR NOT NULL,
  source_origin_chain VARCHAR NOT NULL
)`;

const insertDocument = `
INSERT INTO documents VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`;

const createDocumentKeysTable = `
CREATE TABLE document_keys (
  row_ord BIGINT PRIMARY KEY,
  document_key VARCHAR NOT NULL,
  client VARCHAR,
  family_key VARCHAR
)`;

const insertDocumentKey = `
INSERT INTO document_keys VALUES ($1, $2, $3, $4)`;

const keyDocumentsSql = `
CREATE TABLE keyed_documents (
  document_key VARCHAR PRIMARY KEY,
  digest VARCHAR NOT NULL,
  source_label VARCHAR NOT NULL,
  source_relative_path VARCHAR NOT NULL,
  category VARCHAR NOT NULL,
  client VARCHAR,
  docket VARCHAR,
  docket_family VARCHAR,
  family_key VARCHAR,
  organized_relative_path VARCHAR,
  effective_name VARCHAR NOT NULL,
  size_bytes BIGINT NOT NULL,
  mtime_iso VARCHAR NOT NULL,
  run_label VARCHAR NOT NULL,
  provenance_ref VARCHAR NOT NULL,
  source_origin_chain VARCHAR NOT NULL
);

INSERT INTO keyed_documents
SELECT
  k.document_key, d.digest, d.source_label, d.source_relative_path, d.category, k.client, d.docket,
  d.docket_family, k.family_key, d.organized_relative_path, d.effective_name, d.size_bytes, d.mtime_iso,
  d.run_label, d.provenance_ref, d.source_origin_chain
FROM documents d
JOIN document_keys k USING (row_ord)
QUALIFY ROW_NUMBER() OVER (PARTITION BY k.document_key ORDER BY d.row_ord) = 1
ORDER BY k.document_key;

DROP TABLE document_keys;
DROP TABLE documents;
ALTER TABLE keyed_documents RENAME TO documents;`;

const createEmptyDocumentTextTable = `
CREATE TABLE document_text (
  digest VARCHAR PRIMARY KEY,
  operation_id VARCHAR NOT NULL,
  text VARCHAR NOT NULL,
  text_bytes BIGINT NOT NULL,
  truncated BOOLEAN NOT NULL,
  source_relative_path VARCHAR NOT NULL
)`;

const createEmailTable = `
CREATE TABLE email_messages (
  archive_digest VARCHAR NOT NULL,
  folder_path VARCHAR NOT NULL,
  message_ord BIGINT NOT NULL,
  subject VARCHAR NOT NULL,
  conversation_topic VARCHAR,
  sender_name VARCHAR,
  sender_email VARCHAR,
  recipients VARCHAR NOT NULL,
  submit_iso VARCHAR,
  delivery_iso VARCHAR,
  message_rel_path VARCHAR NOT NULL,
  PRIMARY KEY (archive_digest, folder_path, message_ord)
)`;

const insertEmail = `
INSERT INTO email_messages VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`;

const createEnrichmentTable = `
CREATE TABLE enrichment (
  candidate VARCHAR PRIMARY KEY,
  status VARCHAR NOT NULL,
  application_number VARCHAR,
  patent_number VARCHAR,
  invention_title VARCHAR,
  first_applicant_name VARCHAR,
  first_inventor_name VARCHAR,
  docket_families VARCHAR[] NOT NULL,
  parent_application_numbers VARCHAR[] NOT NULL
)`;

const insertEnrichment = `
INSERT INTO enrichment VALUES ($1, $2, $3, $4, $5, $6, $7, string_split($8, ' | '), string_split($9, ' | '))`;

const createFtsTables = `
CREATE TEMP TABLE fts_tokens AS
WITH source_text AS (
  SELECT
    'document:' || d.document_key AS doc_id,
    'document' AS doc_kind,
    CASE WHEN d.client IS NULL THEN NULL ELSE d.family_key END AS family_key,
    t.text AS content
  FROM documents d
  JOIN document_text t USING (digest)
  UNION ALL
  SELECT
    'email:' || archive_digest || ':' || folder_path || ':' || CAST(message_ord AS VARCHAR),
    'email',
    NULL,
    subject
  FROM email_messages
)
SELECT
  doc_id,
  doc_kind,
  family_key,
  UNNEST(regexp_extract_all(lower(content), '[a-z0-9]+(?:[-/][a-z0-9]+)*')) AS term
FROM source_text;

CREATE TABLE fts_docstats AS
SELECT doc_id, MIN(doc_kind) AS doc_kind, MIN(family_key) AS family_key, COUNT(*)::BIGINT AS token_count
FROM fts_tokens
GROUP BY doc_id
ORDER BY doc_id;

CREATE TABLE fts_postings AS
SELECT term, doc_id, COUNT(*)::BIGINT AS term_frequency
FROM fts_tokens
GROUP BY term, doc_id
ORDER BY term, doc_id;

CREATE TABLE fts_terms AS
SELECT term, COUNT(*)::BIGINT AS document_frequency
FROM fts_postings
GROUP BY term
ORDER BY term;

DROP TABLE fts_tokens;`;

const insertRows = <Row>(
  db: DuckDbShape,
  statement: string,
  rows: ReadonlyArray<Row>,
  parameters: (row: Row) => ReadonlyArray<string | number | boolean | null>
) =>
  Effect.forEach(rows, (row) => db.run(statement, A.fromIterable(parameters(row))), { concurrency: 1, discard: true });

const buildDocumentTextSql = (sourceSpecs: ReadonlyArray<GraphTextSourceSpec>, maxTextBytes: number): string => {
  const sourceUnion = A.join(
    A.map(
      sourceSpecs,
      ({ sourcesPath, textGlob }) => `
SELECT
  s.digest,
  s.operationId,
  s.relativePath,
  t.content
FROM read_json(${sqlStringLiteral(sourcesPath)}, format='newline_delimited') s
JOIN read_text(${sqlStringLiteral(textGlob)}) t
  ON regexp_extract(t.filename, '(operation:[^/\\\\]+)\\.txt$', 1) = s.operationId`
    ),
    "\nUNION ALL\n"
  );
  return `
CREATE TABLE document_text AS
WITH candidates AS (
  ${sourceUnion}
),
ranked AS (
  SELECT
    d.digest,
    c.operationId,
    c.relativePath,
    c.content,
    ROW_NUMBER() OVER (PARTITION BY d.digest ORDER BY c.operationId, c.relativePath) AS position
  FROM candidates c
  JOIN documents d ON d.digest = c.digest OR d.digest = 'sha256:' || c.digest
)
SELECT
  digest,
  operationId AS operation_id,
  CASE WHEN octet_length(encode(content)) <= ${maxTextBytes}
    THEN content
    ELSE left(content, ${Math.floor(maxTextBytes / 4)})
  END AS text,
  LEAST(octet_length(encode(content)), ${maxTextBytes})::BIGINT AS text_bytes,
  octet_length(encode(content)) > ${maxTextBytes} AS truncated,
  relativePath AS source_relative_path
FROM ranked
WHERE position = 1
ORDER BY digest`;
};

/**
 * Stage the deterministic DuckDB half of a practice knowledge-graph bundle.
 *
 * **Details**
 *
 * Uses the caller's DuckDb service for every table. The staged `documents`
 * table holds one row per catalog row, numbered in catalog-row order, until
 * {@link indexDuckDbDocuments} keys it by attribution. Passing an
 * empty `sourceSpecs` creates the document-text table empty rather than skipping
 * it, keeping the bundle's shape identical whether or not extraction ran.
 *
 * **Example** (Stage empty DuckDB tables)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as A from "effect/Array"
 * import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb"
 * import { buildDuckDb } from "../../src/PracticeKg.fts.ts"
 *
 * const staging = buildDuckDb(
 *   A.empty(),
 *   A.empty(),
 *   A.empty(),
 *   A.empty(),
 *   2_097_152
 * )
 *
 * console.log(Effect.isEffect(staging)) // true
 * ```
 *
 * @param catalogRows - Catalog projection rows, one per filed copy.
 * @param enrichmentRows - Stable enrichment rows.
 * @param emailRows - Headers-only email rows.
 * @param sourceSpecs - Extraction JSONL and text glob pairs.
 * @param maxTextBytes - Per-document inline text byte cap.
 * @effects Creates the staged document, text, email and enrichment tables through the injected read-write DuckDb service.
 * @category use-cases
 * @since 0.0.0
 */
export const buildDuckDb = Effect.fn("PracticeKg.buildDuckDb")(function* (
  catalogRows: ReadonlyArray<PracticeKgCatalogRow>,
  enrichmentRows: ReadonlyArray<PracticeKgEnrichmentRow>,
  emailRows: ReadonlyArray<PracticeKgEmailHeaderRow>,
  sourceSpecs: ReadonlyArray<GraphTextSourceSpec>,
  maxTextBytes: number
) {
  return yield* Effect.gen(function* () {
    const db = yield* DuckDb;
    yield* db.run(createDocumentsTable);
    yield* insertRows(
      db,
      insertDocument,
      A.map(catalogRows, (row, ordinal) => ({ ordinal, row })),
      ({ ordinal, row }) => [
        ordinal,
        row.digest,
        row.sourceLabel,
        row.sourceRelativePath,
        row.category,
        row.client,
        row.docket,
        row.docketFamily,
        row.organizedRelativePath,
        row.effectiveName,
        row.sizeBytes,
        row.mtimeIso,
        row.runLabel,
        row.digest,
        row.sourceOriginChain,
      ]
    );
    yield* db.run(
      A.length(sourceSpecs) === 0 ? createEmptyDocumentTextTable : buildDocumentTextSql(sourceSpecs, maxTextBytes)
    );
    yield* db.run(createEmailTable);
    yield* insertRows(db, insertEmail, emailRows, (row) => [
      row.archiveDigest,
      row.folderPath,
      row.messageOrd,
      row.subject,
      row.conversationTopic ?? null,
      row.senderName ?? null,
      row.senderEmail ?? null,
      row.recipients,
      row.submitIso ?? null,
      row.deliveryIso ?? null,
      row.messageRelPath,
    ]);
    yield* db.run(createEnrichmentTable);
    yield* insertRows(db, insertEnrichment, enrichmentRows, (row) => [
      row.candidate,
      row.status,
      row.applicationNumber,
      row.patentNumber,
      row.inventionTitle,
      row.firstApplicantName,
      row.firstInventorName,
      row.docketFamilies,
      row.parentApplicationNumbers,
    ]);
  }).pipe(PracticeKgProjectionError.mapError("Failed building graph DuckDB tables."));
});

/**
 * Key the staged DuckDB documents by their attribution and build the search
 * index over them.
 *
 * **Details**
 *
 * The `n`th attribution belongs to the `n`th catalog row {@link buildDuckDb}
 * staged. Each document row takes its key from {@link practiceKgDocumentKey}
 * and the attributed client and family key, so identical bytes filed under
 * two dockets are two rows that a family-key filter can tell apart; a repeat
 * of one key keeps its first row. The search tables hold raw postings and
 * per-document token counts, each document tagged with its family key, so a
 * query computes BM25 statistics over the documents it may read.
 *
 * **Example** (Index an empty staging)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb"
 * import { buildDuckDb, indexDuckDbDocuments } from "../../src/PracticeKg.fts.ts"
 *
 * const program = buildDuckDb([], [], [], [], 2_097_152).pipe(
 *   Effect.andThen(indexDuckDbDocuments([])),
 *   Effect.provide(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" })))
 * )
 * Effect.runPromise(program).then((row) => console.log(row.documents, row.emails)) // 0 0
 * ```
 *
 * @param attributions - One attribution per staged catalog row, in catalog-row order.
 * @returns Persisted document and email counts.
 * @effects Replaces the staged `documents` table and creates the search tables through the injected DuckDb service.
 * @category use-cases
 * @since 0.0.0
 */
export const indexDuckDbDocuments = Effect.fn("PracticeKg.indexDuckDbDocuments")(function* (
  attributions: ReadonlyArray<PracticeKgDocumentAttribution>
) {
  return yield* Effect.gen(function* () {
    const db = yield* DuckDb;
    yield* db.run(createDocumentKeysTable);
    yield* insertRows(
      db,
      insertDocumentKey,
      A.map(attributions, (attribution, ordinal) => ({ attribution, ordinal })),
      ({ attribution, ordinal }) => [
        ordinal,
        practiceKgDocumentKey(attribution),
        attribution.client,
        attribution.familyKey,
      ]
    );
    yield* db.run(keyDocumentsSql);
    yield* db.run(createFtsTables);
    const countRows = yield* db
      .query(`
        SELECT
          CAST((SELECT COUNT(*) FROM documents) AS DOUBLE) AS documents,
          CAST((SELECT COUNT(*) FROM email_messages) AS DOUBLE) AS emails
      `)
      .pipe(
        Effect.flatMap(decodeDuckCountsRows),
        PracticeKgProjectionError.mapError("Graph DuckDB counts failed schema validation.")
      );
    return A.headNonEmpty(countRows);
  }).pipe(PracticeKgProjectionError.mapError("Failed indexing graph DuckDB documents."));
});
