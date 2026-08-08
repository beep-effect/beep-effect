/**
 * SQL statements used by the read-only practice KG handlers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Named query catalog kept separate from handler orchestration.
 *
 * **Example** (Check clients includes kg_node)
 *
 * ```ts
 * import { PracticeKgQueries } from "@beep/law-practice-server"
 *
 * console.log(PracticeKgQueries.clients.includes("kg_node")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PracticeKgQueries = {
  application: `
WITH applications AS (
  SELECT iri FROM kg_node WHERE kind = 'application' AND natural_key = $1
  UNION
  SELECT e.subject_iri FROM kg_node p JOIN kg_edge e ON e.object_iri = p.iri AND e.predicate = 'granted_as'
  WHERE p.kind = 'patent' AND p.natural_key = $2
  UNION
  SELECT e.object_iri FROM kg_node d JOIN kg_edge e ON e.subject_iri = d.iri AND e.predicate = 'files_as'
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
SELECT n.iri, n.kind, n.natural_key AS "naturalKey", n.label,
  n.docket_family AS "docketFamily", n.client, n.epistemic_status AS "epistemicStatus",
  n.provenance_kind AS "provenanceKind", n.provenance_ref AS "provenanceRef", NULL::FLOAT8 AS count
FROM kg_node n JOIN related r ON r.iri = n.iri
ORDER BY n.kind, n.natural_key`,
  candidateClaims: `
SELECT
  c.snapshot->>'activityOperation' AS "activityOperation",
  c.snapshot->>'claimText' AS "claimText",
  c.snapshot->>'digest' AS digest,
  c.snapshot->>'docket' AS docket,
  CAST(e.span->>'endChar' AS FLOAT8) AS "endChar",
  e.span->>'quote' AS "evidenceQuote",
  c.snapshot->>'family' AS family,
  'candidate — unreviewed' AS label,
  c.snapshot->>'sourceFile' AS "sourceFile",
  CAST(e.span->>'startChar' AS FLOAT8) AS "startChar"
FROM epistemic_candidate_claim c
JOIN epistemic_evidence e
  ON e.span_fixture_key = c.snapshot->>'evidenceFixtureKey'
WHERE (CAST($1 AS TEXT) IS NULL OR c.snapshot->>'docket' = CAST($1 AS TEXT))
  AND (CAST($2 AS TEXT) IS NULL OR c.snapshot->>'family' = CAST($2 AS TEXT))
  AND (CAST($3 AS TEXT) IS NULL OR c.snapshot->>'digest' = CAST($3 AS TEXT))
ORDER BY c.snapshot->>'family', c.snapshot->>'docket', c.public_id`,
  claimsTableProbe: `
SELECT table_name AS "tableName"
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('epistemic_candidate_claim', 'epistemic_evidence')
ORDER BY table_name`,
  clients: `
SELECT c.iri, c.kind, c.natural_key AS "naturalKey", c.label,
  c.docket_family AS "docketFamily", c.client, c.epistemic_status AS "epistemicStatus",
  c.provenance_kind AS "provenanceKind", c.provenance_ref AS "provenanceRef",
  COUNT(e.object_iri)::FLOAT8 AS count
FROM kg_node c
LEFT JOIN kg_edge e ON e.subject_iri = c.iri AND e.predicate = 'has_docket_family'
WHERE c.kind = 'client'
GROUP BY c.iri, c.kind, c.natural_key, c.label, c.docket_family, c.client,
  c.epistemic_status, c.provenance_kind, c.provenance_ref
UNION ALL
SELECT '', 'docket_family', '__unattributed__', 'Unattributed families', NULL, NULL,
  'derived-from-official-records', 'organize-row', 'unattributed', COUNT(*)::FLOAT8
FROM kg_node f
WHERE f.kind = 'docket_family'
  AND NOT EXISTS (
    SELECT 1 FROM kg_edge e WHERE e.object_iri = f.iri AND e.predicate = 'has_docket_family'
  )
ORDER BY "naturalKey"`,
  email: `
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
ORDER BY archive_digest, folder_path, message_ord
LIMIT 200`,
  family: `
WITH family AS (
  SELECT iri, natural_key FROM kg_node WHERE kind = 'docket_family' AND natural_key = $1
),
dockets AS (
  SELECT d.iri, d.natural_key FROM family f
  JOIN kg_edge e ON e.subject_iri = f.iri AND e.predicate = 'has_docket'
  JOIN kg_node d ON d.iri = e.object_iri
),
applications AS (
  SELECT DISTINCT a.iri, a.natural_key FROM dockets d
  JOIN kg_edge e ON e.subject_iri = d.iri AND e.predicate = 'files_as'
  JOIN kg_node a ON a.iri = e.object_iri
),
patents AS (
  SELECT DISTINCT p.natural_key, a.iri AS application_iri FROM applications a
  JOIN kg_edge e ON e.subject_iri = a.iri AND e.predicate = 'granted_as'
  JOIN kg_node p ON p.iri = e.object_iri
),
documents AS (
  SELECT d.iri AS docket_iri, doc.natural_key, doc.label FROM dockets d
  JOIN kg_edge e ON e.subject_iri = d.iri AND e.predicate = 'has_document'
  JOIN kg_node doc ON doc.iri = e.object_iri
)
SELECT f.natural_key AS family, d.natural_key AS docket, a.natural_key AS application,
  p.natural_key AS patent, doc.natural_key AS "documentDigest", doc.label AS "documentLabel",
  (SELECT COUNT(*)::FLOAT8 FROM dockets) AS "docketCount",
  (SELECT COUNT(*)::FLOAT8 FROM applications) AS "applicationCount",
  (SELECT COUNT(*)::FLOAT8 FROM documents) AS "documentCount"
FROM family f
LEFT JOIN dockets d ON TRUE
LEFT JOIN applications a ON TRUE
LEFT JOIN patents p ON p.application_iri = a.iri
LEFT JOIN documents doc ON doc.docket_iri = d.iri
ORDER BY d.natural_key, a.natural_key, p.natural_key, doc.natural_key`,
  find: `
SELECT iri, kind, natural_key AS "naturalKey", label, docket_family AS "docketFamily",
  client, epistemic_status AS "epistemicStatus", provenance_kind AS "provenanceKind",
  provenance_ref AS "provenanceRef", NULL::FLOAT8 AS count
FROM kg_node
WHERE label ILIKE $1 OR natural_key ILIKE $1
ORDER BY kind, natural_key
LIMIT 100`,
  getDocument: `
SELECT d.digest, d.docket, d.docket_family AS family, d.organized_relative_path AS "organizedPath",
  NULL::DOUBLE AS score, CASE WHEN t.text IS NULL THEN NULL ELSE left(t.text, 500) END AS snippet,
  d.source_origin_chain AS "sourceOriginChain", d.source_relative_path AS "sourceRelativePath",
  CASE WHEN t.text IS NULL THEN NULL ELSE substr(t.text, $3, $4) END AS text,
  t.truncated, NULL::VARCHAR AS pointer
FROM documents d LEFT JOIN document_text t ON t.digest = d.digest
WHERE ($1 IS NOT NULL AND d.digest = $1)
   OR ($2 IS NOT NULL AND d.organized_relative_path = $2)
ORDER BY d.digest
LIMIT 1`,
  provenance: `
SELECT iri, kind, natural_key AS "naturalKey", label, docket_family AS "docketFamily",
  client, epistemic_status AS "epistemicStatus", provenance_kind AS "provenanceKind",
  provenance_ref AS "provenanceRef", NULL::FLOAT8 AS count
FROM kg_node
WHERE ($1 IS NOT NULL AND iri = $1)
   OR ($2 IS NOT NULL AND natural_key = $2)
   OR ($3 IS NOT NULL AND natural_key = $3)
ORDER BY kind, natural_key`,
  provenanceDocument: `
SELECT d.digest, d.docket, d.docket_family AS family, d.organized_relative_path AS "organizedPath",
  NULL::DOUBLE AS score, NULL::VARCHAR AS snippet,
  d.source_origin_chain AS "sourceOriginChain", d.source_relative_path AS "sourceRelativePath",
  NULL::VARCHAR AS text, NULL::BOOLEAN AS truncated, NULL::VARCHAR AS pointer
FROM documents d
WHERE d.digest = $1
ORDER BY d.digest`,
  searchText: `
WITH query_terms AS (
  SELECT UNNEST(regexp_extract_all(lower($1), '[a-z0-9]+(?:[-/][a-z0-9]+)*')) AS term
),
scores AS (
  SELECT b.doc_id, SUM(b.score)::DOUBLE AS score FROM fts_bm25 b
  JOIN query_terms q USING (term)
  WHERE b.doc_id LIKE 'document:%'
  GROUP BY b.doc_id
)
SELECT d.digest, d.docket, d.docket_family AS family, d.organized_relative_path AS "organizedPath",
  s.score, left(t.text, 500) AS snippet, NULL::VARCHAR AS "sourceOriginChain",
  d.source_relative_path AS "sourceRelativePath", NULL::VARCHAR AS text,
  t.truncated, NULL::VARCHAR AS pointer
FROM scores s
JOIN documents d ON s.doc_id = 'document:' || d.digest
LEFT JOIN document_text t ON t.digest = d.digest
WHERE ($2 IS NULL OR d.docket_family = $2)
ORDER BY s.score DESC, d.digest
LIMIT $3`,
} as const;
