/**
 * Deterministic reference scans over the bundle DuckDB: client-prefixed docket
 * references and USPTO number mentions found in docket documents.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { practiceKgDocketCountryCodes } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PracticeKgProjectionError } from "./PracticeKg.errors.ts";
import { PracticeKgDocketReferenceRow, PracticeKgNumberMentionRow } from "./PracticeKg.rows.ts";

const $I = $LawPracticeServerId.create("PracticeKg.references");

const decodeDocketReferenceRows = S.decodeUnknownEffect(S.Array(PracticeKgDocketReferenceRow));
const decodeNumberMentionRows = S.decodeUnknownEffect(S.Array(PracticeKgNumberMentionRow));

const referenceExtractorDocketCountryAlternation = A.join(practiceKgDocketCountryCodes, "|");
const notAfterDigitOrDotSoDecimalsAndVersionsMiss = "(?:^|[^0-9.])";
const clientDotFamilyCountryStagePattern = `([0-9]{4,6}\\.[0-9]{5,6}(?:${referenceExtractorDocketCountryAlternation})[0-9]{0,3})`;

const docketReferencesSql = `
WITH docket_text AS (
  SELECT d.digest, t.text
  FROM documents d
  JOIN document_text t USING (digest)
  WHERE d.category = 'docket' AND d.docket_family IS NOT NULL
),
tokens AS (
  SELECT digest, UNNEST(regexp_extract_all(text, '${notAfterDigitOrDotSoDecimalsAndVersionsMiss}${clientDotFamilyCountryStagePattern}', 1)) AS token
  FROM docket_text
)
SELECT DISTINCT
  regexp_extract(token, '^([0-9]+)\\.', 1) AS client,
  digest,
  upper(regexp_extract(token, '\\.(.+)$', 1)) AS docket,
  regexp_extract(token, '\\.([0-9]{5,6})', 1) AS family
FROM tokens
ORDER BY digest, client, docket, family`;

const applicationAndPatentNumberMentionsAsDigitsSql = `
WITH docket_docs AS (
  SELECT digest, effective_name || ' ' || source_relative_path AS name_text
  FROM documents
  WHERE category = 'docket' AND docket_family IS NOT NULL
),
sources AS (
  SELECT d.digest, 'text' AS source, t.text AS content
  FROM docket_docs d
  JOIN document_text t USING (digest)
  UNION ALL
  SELECT digest, 'filename' AS source, name_text AS content FROM docket_docs
),
tokens AS (
  SELECT digest, source, UNNEST(regexp_extract_all(content, '\\b([0-9]{2}/[0-9]{3},?[0-9]{3})\\b', 1)) AS token
  FROM sources
  UNION ALL
  SELECT digest, source, UNNEST(regexp_extract_all(content, '\\b(?:US[ -]?)?([0-9]{1,2},[0-9]{3},[0-9]{3}|[0-9]{7,8})(?:\\s?[ABU][0-9])?\\b', 1)) AS token
  FROM sources
)
SELECT DISTINCT digest, regexp_replace(token, '[^0-9]', '', 'g') AS number, source
FROM tokens
ORDER BY digest, number, source`;

/**
 * Reference scans read back from one built bundle DuckDB.
 *
 * **Example** (Construct empty reference scans)
 *
 * ```ts
 * import { PracticeKgReferenceScans } from "../../src/PracticeKg.references.ts"
 *
 * const scans = PracticeKgReferenceScans.make({ docketReferences: [], numberMentions: [] })
 *
 * console.log(scans.docketReferences.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgReferenceScans extends S.Opaque<PracticeKgReferenceScans, { readonly brand: unique symbol }>()(
  S.Struct({
    docketReferences: S.Array(PracticeKgDocketReferenceRow),
    numberMentions: S.Array(PracticeKgNumberMentionRow),
  }).pipe(
    $I.annoteSchema("PracticeKgReferenceScans", {
      description: "Client-prefixed docket references and USPTO number mentions scanned from docket documents.",
    })
  )
) {}

/**
 * Scan the bundle's docket documents for client-prefixed docket references and
 * USPTO number mentions.
 *
 * **Details**
 *
 * Runs after {@link buildDuckDb} has written `documents` and `document_text`,
 * using the caller's read-write service. Only `docket`-category documents with a
 * family are scanned; email exports and unsorted files never vote on family
 * attribution. The result is fully ordered so a rebuild from the same corpus
 * yields identical rows.
 *
 * **Example** (Scan a built bundle)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { readReferenceScans } from "../../src/PracticeKg.references.ts"
 *
 * const scans = readReferenceScans()
 *
 * console.log(Effect.isEffect(scans)) // true
 * ```
 *
 * @returns Ordered docket-reference and number-mention rows.
 * @effects Reads through the injected read-write DuckDb service.
 * @category use-cases
 * @since 0.0.0
 */
export const readReferenceScans = Effect.fn("PracticeKg.readReferenceScans")(function* () {
  return yield* Effect.gen(function* () {
    const db = yield* DuckDb;
    const docketReferences = yield* db
      .query(docketReferencesSql)
      .pipe(
        Effect.flatMap(decodeDocketReferenceRows),
        PracticeKgProjectionError.mapError("Graph docket-reference rows failed schema validation.")
      );
    const numberMentions = yield* db
      .query(applicationAndPatentNumberMentionsAsDigitsSql)
      .pipe(
        Effect.flatMap(decodeNumberMentionRows),
        PracticeKgProjectionError.mapError("Graph number-mention rows failed schema validation.")
      );
    return PracticeKgReferenceScans.make({ docketReferences, numberMentions });
  }).pipe(PracticeKgProjectionError.mapError("Failed scanning graph references."));
});
