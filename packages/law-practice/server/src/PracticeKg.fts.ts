/**
 * Deterministic DuckDB document, email, enrichment, and BM25 projection for the practice KG.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PracticeKgProjectionError } from "./PracticeKg.errors.ts";
import { withDuckDb } from "./PracticeKg.rows.ts";
import type { DuckDbShape } from "@beep/duckdb";
import type { PracticeKgCatalogRow, PracticeKgEnrichmentRow } from "./PracticeKg.rows.ts";
import type { PracticeKgEmailHeaderRow } from "./PracticeKg.schemas.ts";

class GraphTextSourceSpec extends S.Class<GraphTextSourceSpec>("PracticeKgTextSourceSpec")({
  sourcesPath: S.String,
  textGlob: S.String,
}) {}

class GraphDuckCountsRow extends S.Class<GraphDuckCountsRow>("GraphDuckCountsRow")({
  documents: S.Finite,
  emails: S.Finite,
}) {}

const decodeDuckCountsRows = S.decodeUnknownEffect(S.NonEmptyArray(GraphDuckCountsRow));

const createDocumentsTable = `
CREATE TABLE documents (
  digest VARCHAR PRIMARY KEY,
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
  provenance_ref VARCHAR NOT NULL
)`;

const insertDocument = `
INSERT INTO documents VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`;

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
  SELECT 'document:' || digest AS doc_id, 'document' AS doc_kind, text AS content
  FROM document_text
  UNION ALL
  SELECT
    'email:' || archive_digest || ':' || folder_path || ':' || CAST(message_ord AS VARCHAR),
    'email',
    subject
  FROM email_messages
)
SELECT
  doc_id,
  doc_kind,
  UNNEST(regexp_extract_all(lower(content), '[a-z0-9]+(?:[-/][a-z0-9]+)*')) AS term
FROM source_text;

CREATE TABLE fts_docstats AS
SELECT doc_id, MIN(doc_kind) AS doc_kind, COUNT(*)::BIGINT AS token_count
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

CREATE VIEW fts_bm25 AS
WITH corpus AS (
  SELECT COUNT(*)::DOUBLE AS document_count, AVG(token_count)::DOUBLE AS average_length
  FROM fts_docstats
)
SELECT
  p.term,
  p.doc_id,
  LN(1.0 + (c.document_count - t.document_frequency + 0.5) / (t.document_frequency + 0.5))
    * (p.term_frequency * 2.2)
    / (p.term_frequency + 1.2 * (0.25 + 0.75 * d.token_count / NULLIF(c.average_length, 0))) AS score
FROM fts_postings p
JOIN fts_terms t USING (term)
JOIN fts_docstats d USING (doc_id)
CROSS JOIN corpus c`;

const sqlStringLiteral = (value: string): string => `'${pipe(value, Str.replaceAll("'", "''"))}'`;

const insertRows = <Row>(
  db: DuckDbShape,
  statement: string,
  rows: ReadonlyArray<Row>,
  parameters: (row: Row) => ReadonlyArray<string | number | boolean | null>
) => Effect.forEach(rows, (row) => db.run(statement, A.fromIterable(parameters(row))), { discard: true });

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
  ON regexp_extract(t.filename, 'operation:([^/\\\\]+)\\\\.txt$', 1) = s.operationId`
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
 * Build the deterministic DuckDB half of a practice knowledge-graph bundle.
 *
 * @remarks
 * The DuckDB connection is opened and closed around this one call, so the
 * database at `databasePath` is complete when the effect settles. Passing an
 * empty `sourceSpecs` creates the document-text table empty rather than skipping
 * it, keeping the bundle's shape identical whether or not extraction ran.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as A from "effect/Array"
 * import { buildDuckDb } from "../../src/PracticeKg.fts.ts"
 *
 * const counts = buildDuckDb(
 *   "/corpus/staging/practice-kg-bundle/practice.duckdb",
 *   A.empty(),
 *   A.empty(),
 *   A.empty(),
 *   A.empty(),
 *   2_097_152
 * )
 *
 * Effect.runPromise(counts).then((row) => console.log(row.documents, row.emails)) // 0 0
 * ```
 *
 * @param databasePath - Destination DuckDB path.
 * @param catalogRows - Digest-deduplicated catalog projection rows.
 * @param enrichmentRows - Stable enrichment rows.
 * @param emailRows - Headers-only email rows.
 * @param sourceSpecs - Extraction JSONL and text glob pairs.
 * @param maxTextBytes - Per-document inline text byte cap.
 * @returns Persisted document and email counts.
 * @effects Creates the DuckDB database and its plain-SQL BM25 tables.
 * @category use-cases
 * @since 0.0.0
 */
export const buildDuckDb = Effect.fn("PracticeKg.buildDuckDb")(function* (
  databasePath: string,
  catalogRows: ReadonlyArray<PracticeKgCatalogRow>,
  enrichmentRows: ReadonlyArray<PracticeKgEnrichmentRow>,
  emailRows: ReadonlyArray<PracticeKgEmailHeaderRow>,
  sourceSpecs: ReadonlyArray<GraphTextSourceSpec>,
  maxTextBytes: number
) {
  return yield* Effect.gen(function* () {
    const db = yield* DuckDb;
    yield* db.run(createDocumentsTable);
    yield* insertRows(db, insertDocument, catalogRows, (row) => [
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
    ]);
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
  }).pipe(
    withDuckDb(DuckDbConnectionOptions.make({ databasePath })),
    PracticeKgProjectionError.mapError(`Failed building graph DuckDB "${databasePath}".`)
  );
});
