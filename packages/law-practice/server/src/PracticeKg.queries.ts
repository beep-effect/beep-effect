/**
 * SQL statements used by the read-only practice KG handlers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { practiceKgFamilyKeyFilter, practiceKgMailFolderFilter } from "./PracticeKg.wall.ts";
import type { PracticeKgReadScope } from "./PracticeKg.wall.ts";

const nodeFamilyKey = (alias: string): string => `${alias}.client || '.' || ${alias}.docket_family`;

const grantedNode = (scope: PracticeKgReadScope, alias: string): string =>
  practiceKgFamilyKeyFilter(scope, nodeFamilyKey(alias));

const grantedDocument = (scope: PracticeKgReadScope, alias: string): string =>
  `${alias}.client IS NOT NULL AND ${practiceKgFamilyKeyFilter(scope, `${alias}.family_key`)}`;

/**
 * Named query catalog kept separate from handler orchestration.
 *
 * **Details**
 *
 * Every statement is built for one read scope and filters inside its SQL:
 * graph rows by the client-qualified family key of the node, documents and
 * search statistics by the document's family key, and mail by the granted
 * folder bindings. A row with no client or no family is denied.
 *
 * **Example** (Check clients includes kg_node)
 *
 * ```ts
 * import { PracticeKgQueries, PracticeKgReadScope } from "@beep/law-practice-server"
 *
 * console.log(PracticeKgQueries.clients(PracticeKgReadScope.cases.Unwalled.make({})).includes("kg_node")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PracticeKgQueries = {
  application: (scope: PracticeKgReadScope): string => `
WITH applications AS (
  SELECT iri FROM kg_node WHERE kind = 'application' AND natural_key = $1
  UNION
  SELECT e.subject_iri FROM kg_node p JOIN kg_edge e ON e.object_iri = p.iri AND e.predicate = 'granted_as'
  WHERE p.kind = 'patent' AND p.natural_key = $2
  UNION
  SELECT e.object_iri FROM kg_node d JOIN kg_edge e ON e.subject_iri = d.iri AND e.predicate = 'files_as'
  WHERE d.kind = 'docket' AND (d.natural_key = $3 OR split_part(d.natural_key, '.', 2) = $3)
),
related AS (
  SELECT iri FROM applications
  UNION
  SELECT e.subject_iri FROM kg_edge e JOIN applications a ON e.object_iri = a.iri
    WHERE e.predicate IN ('files_as', 'granted_as', 'continuation_of', 'mentioned_in_family')
  UNION
  SELECT e.object_iri FROM kg_edge e JOIN applications a ON e.subject_iri = a.iri
    WHERE e.predicate IN ('files_as', 'granted_as', 'continuation_of', 'mentioned_in_family')
)
SELECT n.iri, n.kind, n.natural_key AS "naturalKey", n.label,
  n.docket_family AS "docketFamily", n.client, n.attribution_source AS "attributionSource",
  n.epistemic_status AS "epistemicStatus",
  n.provenance_kind AS "provenanceKind", n.provenance_ref AS "provenanceRef", NULL::FLOAT8 AS count
FROM kg_node n JOIN related r ON r.iri = n.iri
WHERE ${grantedNode(scope, "n")}
ORDER BY n.kind, n.natural_key`,
  candidateClaims: (scope: PracticeKgReadScope): string => `
SELECT
  c.snapshot->>'activityOperation' AS "activityOperation",
  c.snapshot->>'claimText' AS "claimText",
  doc.client AS client,
  c.snapshot->>'digest' AS digest,
  c.snapshot->>'docket' AS docket,
  CAST(COALESCE(e.span->'position'->>'endChar', e.span->>'endChar') AS FLOAT8) AS "endChar",
  COALESCE(e.span->'position'->>'quote', e.span->>'quote') AS "evidenceQuote",
  c.snapshot->>'family' AS family,
  CASE WHEN doc.client IS NULL THEN NULL ELSE doc.client || '.' || doc.docket_family END AS "familyKey",
  'candidate-unreviewed' AS label,
  c.snapshot->>'sourceDocumentDigest' AS "sourceDocumentDigest",
  c.snapshot->>'sourceFile' AS "sourceFile",
  CAST(COALESCE(e.span->'position'->>'startChar', e.span->>'startChar') AS FLOAT8) AS "startChar"
FROM epistemic_candidate_claim c
JOIN epistemic_evidence e
  ON e.span_fixture_key = c.snapshot->>'evidenceFixtureKey'
LEFT JOIN kg_node doc
  ON doc.kind = 'document' AND doc.provenance_ref = c.snapshot->>'sourceDocumentDigest'
  AND (
    doc.payload->>'docket' = c.snapshot->>'docket'
    OR (SELECT COUNT(*) FROM kg_node shared
      WHERE shared.kind = 'document' AND shared.provenance_ref = doc.provenance_ref) = 1
  )
WHERE (CAST($1 AS TEXT) IS NULL OR c.snapshot->>'docket' = CAST($1 AS TEXT)
    OR c.snapshot->>'docket' = split_part(CAST($1 AS TEXT), '.', 2))
  AND (CAST($2 AS TEXT) IS NULL OR c.snapshot->>'family' = CAST($2 AS TEXT)
    OR (doc.client IS NOT NULL AND doc.client || '.' || doc.docket_family = CAST($2 AS TEXT)))
  AND (CAST($3 AS TEXT) IS NULL OR c.snapshot->>'digest' = CAST($3 AS TEXT))
  AND ${grantedNode(scope, "doc")}
ORDER BY c.snapshot->>'family', c.snapshot->>'docket', c.public_id, doc.natural_key`,
  claimsTableProbe: `
SELECT table_name AS "tableName"
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('epistemic_candidate_claim', 'epistemic_evidence')
ORDER BY table_name`,
  clients: (scope: PracticeKgReadScope): string => `
SELECT c.iri, c.kind, c.natural_key AS "naturalKey", c.label,
  c.docket_family AS "docketFamily", c.client, c.attribution_source AS "attributionSource",
  c.epistemic_status AS "epistemicStatus",
  c.provenance_kind AS "provenanceKind", c.provenance_ref AS "provenanceRef",
  COUNT(e.object_iri)::FLOAT8 AS count
FROM kg_node c
JOIN kg_edge e ON e.subject_iri = c.iri AND e.predicate = 'has_docket_family'
JOIN kg_node f ON f.iri = e.object_iri
WHERE c.kind = 'client' AND ${grantedNode(scope, "f")}
GROUP BY c.iri, c.kind, c.natural_key, c.label, c.docket_family, c.client, c.attribution_source,
  c.epistemic_status, c.provenance_kind, c.provenance_ref
ORDER BY "naturalKey"`,
  email: (scope: PracticeKgReadScope): string => `
SELECT archive_digest AS "archiveDigest", folder_path AS "folderPath", subject,
  conversation_topic AS "conversationTopic", sender_name AS "senderName",
  sender_email AS "senderEmail", recipients, submit_iso AS "submitIso",
  delivery_iso AS "deliveryIso", message_rel_path AS "messageRelPath"
FROM email_messages
WHERE ($1 IS NULL OR subject ILIKE $1 OR conversation_topic ILIKE $1 OR recipients ILIKE $1)
  AND ($2 IS NULL OR sender_name ILIKE $2 OR sender_email ILIKE $2)
  AND ($3 IS NULL OR submit_iso >= $3)
  AND ($4 IS NULL OR submit_iso <= $4)
  AND ($5 IS NULL OR subject ILIKE $5 OR folder_path ILIKE $5)
  AND ${practiceKgMailFolderFilter(scope, "archive_digest", "folder_path")}
ORDER BY archive_digest, folder_path, message_ord
LIMIT 200`,
  family: (scope: PracticeKgReadScope): string => `
WITH family AS (
  SELECT f.iri, f.natural_key FROM kg_node f
  WHERE f.kind = 'docket_family' AND (f.natural_key = $1 OR f.docket_family = $1) AND ${grantedNode(scope, "f")}
),
dockets AS (
  SELECT d.iri, d.natural_key, f.iri AS family_iri FROM family f
  JOIN kg_edge e ON e.subject_iri = f.iri AND e.predicate = 'has_docket'
  JOIN kg_node d ON d.iri = e.object_iri
),
applications AS (
  SELECT DISTINCT a.iri, a.natural_key, d.iri AS docket_iri FROM dockets d
  JOIN kg_edge e ON e.subject_iri = d.iri AND e.predicate = 'files_as'
  JOIN kg_node a ON a.iri = e.object_iri
),
patents AS (
  SELECT DISTINCT p.natural_key, a.iri AS application_iri FROM applications a
  JOIN kg_edge e ON e.subject_iri = a.iri AND e.predicate = 'granted_as'
  JOIN kg_node p ON p.iri = e.object_iri
),
documents AS (
  SELECT d.iri AS docket_iri, doc.provenance_ref AS digest, doc.label FROM dockets d
  JOIN kg_edge e ON e.subject_iri = d.iri AND e.predicate = 'has_document'
  JOIN kg_node doc ON doc.iri = e.object_iri
)
SELECT f.natural_key AS family, d.natural_key AS docket, a.natural_key AS application,
  p.natural_key AS patent, doc.digest AS "documentDigest", doc.label AS "documentLabel",
  (SELECT COUNT(*)::FLOAT8 FROM dockets dc WHERE dc.family_iri = f.iri) AS "docketCount",
  (SELECT COUNT(DISTINCT ap.iri)::FLOAT8 FROM applications ap
    JOIN dockets dc ON dc.iri = ap.docket_iri WHERE dc.family_iri = f.iri) AS "applicationCount",
  (SELECT COUNT(*)::FLOAT8 FROM documents dm
    JOIN dockets dc ON dc.iri = dm.docket_iri WHERE dc.family_iri = f.iri) AS "documentCount"
FROM family f
LEFT JOIN dockets d ON d.family_iri = f.iri
LEFT JOIN applications a ON a.docket_iri = d.iri
LEFT JOIN patents p ON p.application_iri = a.iri
LEFT JOIN documents doc ON doc.docket_iri = d.iri
ORDER BY f.natural_key, d.natural_key, a.natural_key, p.natural_key, doc.digest`,
  find: (scope: PracticeKgReadScope): string => `
SELECT n.iri, n.kind, n.natural_key AS "naturalKey", n.label, n.docket_family AS "docketFamily",
  n.client, n.attribution_source AS "attributionSource", n.epistemic_status AS "epistemicStatus",
  n.provenance_kind AS "provenanceKind", n.provenance_ref AS "provenanceRef", NULL::FLOAT8 AS count
FROM kg_node n
WHERE (n.label ILIKE $1 OR n.natural_key ILIKE $1) AND ${grantedNode(scope, "n")}
ORDER BY n.kind, n.natural_key
LIMIT 100`,
  getDocument: (scope: PracticeKgReadScope): string => `
SELECT d.digest, d.docket, d.docket_family AS family, NULL::DOUBLE AS "matchOffset",
  d.organized_relative_path AS "organizedPath",
  NULL::DOUBLE AS score, CASE WHEN t.text IS NULL THEN NULL ELSE left(t.text, 500) END AS snippet,
  d.source_origin_chain AS "sourceOriginChain", d.source_relative_path AS "sourceRelativePath",
  CASE WHEN t.text IS NULL THEN NULL ELSE substr(t.text, $3, $4) END AS text,
  t.truncated, NULL::VARCHAR AS pointer
FROM documents d LEFT JOIN document_text t ON t.digest = d.digest
WHERE (($1 IS NOT NULL AND d.digest = $1) OR ($2 IS NOT NULL AND d.organized_relative_path = $2))
  AND ${grantedDocument(scope, "d")}
ORDER BY d.digest, d.document_key
LIMIT 1`,
  provenance: (scope: PracticeKgReadScope): string => `
SELECT n.iri, n.kind, n.natural_key AS "naturalKey", n.label, n.docket_family AS "docketFamily",
  n.client, n.attribution_source AS "attributionSource", n.epistemic_status AS "epistemicStatus",
  n.provenance_kind AS "provenanceKind", n.provenance_ref AS "provenanceRef", NULL::FLOAT8 AS count
FROM kg_node n
WHERE ((CAST($1 AS TEXT) IS NOT NULL AND n.iri = CAST($1 AS TEXT))
   OR (CAST($2 AS TEXT) IS NOT NULL AND n.natural_key = CAST($2 AS TEXT))
   OR (CAST($2 AS TEXT) IS NOT NULL AND n.kind = 'document' AND n.provenance_ref = CAST($2 AS TEXT))
   OR (CAST($3 AS TEXT) IS NOT NULL AND n.natural_key = CAST($3 AS TEXT)))
  AND ${grantedNode(scope, "n")}
ORDER BY n.kind, n.natural_key`,
  provenanceDocument: (scope: PracticeKgReadScope): string => `
SELECT d.digest, d.docket, d.docket_family AS family, NULL::DOUBLE AS "matchOffset",
  d.organized_relative_path AS "organizedPath",
  NULL::DOUBLE AS score, NULL::VARCHAR AS snippet,
  d.source_origin_chain AS "sourceOriginChain", d.source_relative_path AS "sourceRelativePath",
  NULL::VARCHAR AS text, NULL::BOOLEAN AS truncated, NULL::VARCHAR AS pointer
FROM documents d
WHERE d.digest = $1 AND ${grantedDocument(scope, "d")}
ORDER BY d.digest, d.document_key`,
  searchText: (scope: PracticeKgReadScope): string => `
WITH query_terms AS (
  SELECT UNNEST(regexp_extract_all(lower($1), '[a-z0-9]+(?:[-/][a-z0-9]+)*')) AS term
),
granted_docs AS (
  SELECT s.doc_id, s.token_count FROM fts_docstats s
  WHERE s.doc_kind = 'document' AND ${practiceKgFamilyKeyFilter(scope, "s.family_key")}
),
corpus AS (
  SELECT COUNT(*)::DOUBLE AS document_count, AVG(token_count)::DOUBLE AS average_length FROM granted_docs
),
granted_postings AS (
  SELECT p.term, p.doc_id, p.term_frequency FROM fts_postings p JOIN granted_docs g USING (doc_id)
),
term_frequencies AS (
  SELECT term, COUNT(*)::DOUBLE AS document_frequency FROM granted_postings
  WHERE term IN (SELECT term FROM query_terms)
  GROUP BY term
),
scores AS (
  SELECT p.doc_id, SUM(
    LN(1.0 + (c.document_count - t.document_frequency + 0.5) / (t.document_frequency + 0.5))
      * (p.term_frequency * 2.2)
      / (p.term_frequency + 1.2 * (0.25 + 0.75 * g.token_count / NULLIF(c.average_length, 0)))
  )::DOUBLE AS score
  FROM granted_postings p
  JOIN query_terms q USING (term)
  JOIN term_frequencies t USING (term)
  JOIN granted_docs g USING (doc_id)
  CROSS JOIN corpus c
  GROUP BY p.doc_id
)
SELECT d.digest, d.docket, d.docket_family AS family, m.match_offset AS "matchOffset",
  d.organized_relative_path AS "organizedPath",
  s.score, substr(t.text, GREATEST(1, CAST(COALESCE(m.match_offset, 1) AS BIGINT) - 160), 500) AS snippet,
  NULL::VARCHAR AS "sourceOriginChain",
  d.source_relative_path AS "sourceRelativePath", NULL::VARCHAR AS text,
  t.truncated, NULL::VARCHAR AS pointer
FROM scores s
JOIN documents d ON s.doc_id = 'document:' || d.document_key
LEFT JOIN document_text t ON t.digest = d.digest
LEFT JOIN LATERAL (
  SELECT CAST(MIN(NULLIF(instr(lower(t.text), q.term), 0)) AS DOUBLE) AS match_offset FROM query_terms q
) m ON TRUE
WHERE ($2 IS NULL OR d.docket_family = $2)
ORDER BY s.score DESC, d.digest, d.document_key
LIMIT $3`,
} as const;
