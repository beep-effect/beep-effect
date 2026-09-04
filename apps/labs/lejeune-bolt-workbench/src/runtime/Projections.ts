/**
 * Deterministic PGlite, DuckDB, and bounded Oxigraph projections.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import { makeLayer as makePgliteLayer } from "@beep/pglite";
import * as Rdf from "@beep/rdf/Rdf";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { SparqlQueryRequest, SparqlQueryService } from "@beep/semantic-web/services/sparql-query";
import { Effect, Layer, Match } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { NormalizedFixture, ProjectionSnapshot, RuleResult } from "@/domain/Bundle";
import { LotCertificate, OntologyClassName, SupplierOffer } from "@/domain/Ontology";
import type { DuckDbError } from "@beep/duckdb";
import type { SparqlQueryError } from "@beep/semantic-web/services/sparql-query";
import type * as SqlError from "effect/unstable/sql/SqlError";

const $I = $LejeuneBoltWorkbenchId.create("runtime/Projections");
const LEJEUNE_ONTOLOGY_NAMESPACE = "https://beep.dev/lejeune/ontology/";
const RDF_TYPE = Rdf.makeNamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const OWL_CLASS = Rdf.makeNamedNode("http://www.w3.org/2002/07/owl#Class");
const DCTERMS_SOURCE = Rdf.makeNamedNode("http://purl.org/dc/terms/source");

const PgliteQuoteLineRow = S.Struct({ id: S.String, product_variant_id: S.String, quantity: S.Finite });
const PgliteRuleRow = S.Struct({
  case_id: S.String,
  disposition: S.String,
  requires_human: S.Boolean,
  rule_id: S.String,
});
const PgliteSyntheticRow = S.Struct({ id: S.String, kind: S.String, label: S.String, observed_at: S.String });
const DuckCountRow = S.Struct({ count: S.Finite });
const DuckDocumentDigestRow = S.Struct({ digest: S.String, id: S.String });
const DuckTextHitRow = S.Struct({ id: S.String });
const DuckCitationRow = S.Struct({ id: S.String, url: S.String });
const projectionSnapshotEquivalent = S.toEquivalence(ProjectionSnapshot);

const createDuckDbFullTextProjection = [
  `CREATE TEMP TABLE fts_tokens AS
SELECT id AS doc_id, UNNEST(regexp_extract_all(lower(body), '[a-z0-9]+(?:[-/][a-z0-9]+)*')) AS term
FROM corpus_documents`,
  `CREATE TABLE fts_docstats AS
SELECT doc_id, COUNT(*)::BIGINT AS token_count FROM fts_tokens GROUP BY doc_id ORDER BY doc_id`,
  `CREATE TABLE fts_postings AS
SELECT term, doc_id, COUNT(*)::BIGINT AS term_frequency
FROM fts_tokens GROUP BY term, doc_id ORDER BY term, doc_id`,
  `CREATE TABLE fts_terms AS
SELECT term, COUNT(*)::BIGINT AS document_frequency FROM fts_postings GROUP BY term ORDER BY term`,
  `CREATE VIEW fts_bm25 AS
WITH corpus AS (
  SELECT COUNT(*)::DOUBLE AS document_count, AVG(token_count)::DOUBLE AS average_length FROM fts_docstats
)
SELECT p.term, p.doc_id,
  LN(1.0 + (c.document_count - t.document_frequency + 0.5) / (t.document_frequency + 0.5))
    * (p.term_frequency * 2.2)
    / (p.term_frequency + 1.2 * (0.25 + 0.75 * d.token_count / NULLIF(c.average_length, 0))) AS score
FROM fts_postings p
JOIN fts_terms t USING (term)
JOIN fts_docstats d USING (doc_id)
CROSS JOIN corpus c`,
] as const;

/**
 * Input required to rebuild the three local projections.
 *
 * **Example** (Inspect the rules field)
 *
 * ```ts
 * import { ProjectionInput } from "@/runtime/Projections"
 *
 * console.log(ProjectionInput.fields.rules !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProjectionInput extends S.Class<ProjectionInput>($I`ProjectionInput`)(
  {
    certificates: S.Tuple([LotCertificate, LotCertificate]),
    fixtures: S.Tuple([NormalizedFixture, NormalizedFixture]),
    offers: S.Tuple([SupplierOffer, SupplierOffer]),
    rules: S.Tuple([RuleResult, RuleResult, RuleResult, RuleResult, RuleResult, RuleResult]),
  },
  $I.annote("ProjectionInput", {
    description: "The normalized fixtures, cited rules, and synthetic records projected into the three local stores.",
  })
) {}

/**
 * Typed local projection failure.
 *
 * @category errors
 * @since 0.0.0
 */
export class ProjectionError extends S.TaggedError<ProjectionError>($I`ProjectionError`)(
  "ProjectionError",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true })),
    engine: LiteralKit(["pglite", "duckdb", "oxigraph", "snapshot"]),
    message: S.NonEmptyString,
    operation: LiteralKit(["rebuild", "decode", "query", "validate"]),
  },
  $I.annoteError<ProjectionError>("ProjectionError", {
    title: "LeJeune projection error",
    description: "A typed failure while building or querying one deterministic local projection.",
  })
) {}

const isProjectionError = S.is(ProjectionError);

const projectionError = (
  engine: ProjectionError["engine"],
  operation: ProjectionError["operation"],
  message: string,
  cause?: unknown
): ProjectionError => ProjectionError.make({ cause, engine, message, operation });

const normalizeProjectionError = (
  engine: ProjectionError["engine"],
  operation: ProjectionError["operation"],
  cause: ProjectionError | SqlError.SqlError | DuckDbError | SparqlQueryError
): ProjectionError =>
  isProjectionError(cause)
    ? cause
    : projectionError(engine, operation, `The ${engine} ${operation} operation failed.`, cause);

const annotateProjectionOutcome = <A2, E2, R2>(effect: Effect.Effect<A2, E2, R2>): Effect.Effect<A2, E2, R2> =>
  effect.pipe(
    Effect.tap(() => Effect.annotateCurrentSpan("db.operation.outcome", "success")),
    Effect.tapError(() => Effect.annotateCurrentSpan("db.operation.outcome", "error"))
  );

export class ProjectionLayerOptions extends S.Class<ProjectionLayerOptions>($I`ProjectionLayerOptions`)(
  {
    duckDbPath: S.NonEmptyString,
    pgliteDataDir: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ProjectionLayerOptions", {
    description: "Caller-selected machine-local paths for one scoped projection layer.",
  })
) {}

const decodeRows = <Schema extends S.Codec<unknown>>(stage: string, schema: Schema, input: unknown) =>
  S.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError((cause) =>
      projectionError("snapshot", "decode", `The ${stage} query returned an unexpected row shape.`, cause)
    )
  );

const readPgliteProjection = Effect.fnUntraced(function* () {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const quoteRows = yield* sql
    .unsafe("SELECT id, product_variant_id, quantity FROM quote_lines ORDER BY id")
    .pipe(Effect.flatMap((rows) => decodeRows("pglite-quote-lines", S.Array(PgliteQuoteLineRow), rows)));
  const ruleRows = yield* sql
    .unsafe("SELECT case_id, rule_id, disposition, requires_human FROM rule_results ORDER BY rule_id, case_id")
    .pipe(Effect.flatMap((rows) => decodeRows("pglite-rules", S.Array(PgliteRuleRow), rows)));
  const syntheticRows = yield* sql
    .unsafe("SELECT id, kind, label, observed_at FROM synthetic_records ORDER BY id")
    .pipe(Effect.flatMap((rows) => decodeRows("pglite-synthetic", S.Array(PgliteSyntheticRow), rows)));
  return {
    quoteLines: A.map(quoteRows, (row) => `${row.id}|${row.product_variant_id}|${row.quantity}`),
    ruleDispositions: A.map(
      ruleRows,
      (row) => `${row.rule_id}|${row.case_id}|${row.disposition}|${row.requires_human}`
    ),
    syntheticRecords: A.map(syntheticRows, (row) => `${row.id}|${row.kind}|${row.label}|${row.observed_at}`),
  };
});

const readDuckDbProjection = Effect.fnUntraced(function* () {
  const duckdb = yield* DuckDb;
  const countRows = yield* duckdb
    .query("SELECT CAST(count(*) AS INTEGER) AS count FROM corpus_documents")
    .pipe(Effect.flatMap((rows) => decodeRows("duckdb-count", S.NonEmptyArray(DuckCountRow), rows)));
  const digestRows = yield* duckdb
    .query("SELECT sha256(body) AS digest, id FROM corpus_documents ORDER BY id")
    .pipe(
      Effect.flatMap((rows) => decodeRows("duckdb-document-digests", S.NonEmptyArray(DuckDocumentDigestRow), rows))
    );
  const hitRows = yield* duckdb
    .query("SELECT doc_id AS id FROM fts_bm25 WHERE term = 'a490' ORDER BY score DESC, doc_id")
    .pipe(Effect.flatMap((rows) => decodeRows("duckdb-full-text", S.NonEmptyArray(DuckTextHitRow), rows)));
  const citationRows = yield* duckdb
    .query("SELECT id, url FROM rule_citations ORDER BY id")
    .pipe(Effect.flatMap((rows) => decodeRows("duckdb-citations", S.NonEmptyArray(DuckCitationRow), rows)));
  return {
    citations: [
      ...A.map(hitRows, (row) => `full-text:${row.id}`),
      ...A.map(citationRows, (row) => `source:${row.id}|${row.url}`),
    ],
    documentCount: countRows[0].count,
    documentDigests: A.map(digestRows, (row) => `${row.id}|${row.digest}`),
  };
});

const pgliteProjection = Effect.fnUntraced(function* (input: ProjectionInput) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  yield* sql.unsafe(
    "CREATE TABLE quote_lines (id TEXT PRIMARY KEY, product_variant_id TEXT NOT NULL, quantity INTEGER NOT NULL)"
  );
  yield* sql.unsafe(
    "CREATE TABLE rule_results (case_id TEXT PRIMARY KEY, rule_id TEXT NOT NULL, disposition TEXT NOT NULL, requires_human BOOLEAN NOT NULL)"
  );
  yield* sql.unsafe(
    "CREATE TABLE synthetic_records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL, observed_at TEXT NOT NULL)"
  );
  yield* Effect.forEach(
    input.fixtures,
    (fixture) =>
      sql.unsafe("INSERT INTO quote_lines (id, product_variant_id, quantity) VALUES ($1, $2, $3)", [
        fixture.quoteLine.id,
        fixture.quoteLine.productVariantId,
        fixture.quoteLine.quantity,
      ]),
    { concurrency: 1, discard: true }
  );
  yield* Effect.forEach(
    input.rules,
    (result) =>
      sql.unsafe("INSERT INTO rule_results (case_id, rule_id, disposition, requires_human) VALUES ($1, $2, $3, $4)", [
        result.caseId,
        result.ruleId,
        result.disposition,
        result.requiresHuman,
      ]),
    { concurrency: 1, discard: true }
  );
  yield* Effect.forEach(
    input.offers,
    (offer) =>
      sql.unsafe("INSERT INTO synthetic_records (id, kind, label, observed_at) VALUES ($1, $2, $3, $4)", [
        offer.id,
        "SupplierOffer",
        offer.recordLabel,
        offer.observedAt,
      ]),
    { concurrency: 1, discard: true }
  );
  yield* Effect.forEach(
    input.certificates,
    (certificate) =>
      sql.unsafe("INSERT INTO synthetic_records (id, kind, label, observed_at) VALUES ($1, $2, $3, $4)", [
        certificate.id,
        "LotCertificate",
        certificate.recordLabel,
        certificate.issuedAt,
      ]),
    { concurrency: 1, discard: true }
  );
  return yield* readPgliteProjection();
});

const duckDbProjection = Effect.fnUntraced(function* (input: ProjectionInput) {
  const duckdb = yield* DuckDb;
  yield* duckdb.run("CREATE TABLE corpus_documents (id VARCHAR PRIMARY KEY, body VARCHAR NOT NULL)");
  yield* duckdb.run("CREATE TABLE rule_citations (id VARCHAR PRIMARY KEY, url VARCHAR NOT NULL)");
  yield* Effect.forEach(
    A.flatMap(input.fixtures, (fixture) => fixture.sources),
    (source) => duckdb.run("INSERT INTO corpus_documents VALUES ($id, $body)", { body: source.text, id: source.id }),
    { concurrency: 1, discard: true }
  );
  yield* Effect.forEach(
    input.rules,
    (result) =>
      duckdb.run("INSERT OR IGNORE INTO rule_citations VALUES ($id, $url)", {
        id: result.source.id,
        url: result.source.url,
      }),
    { concurrency: 1, discard: true }
  );
  yield* Effect.forEach(createDuckDbFullTextProjection, (statement) => duckdb.run(statement), {
    concurrency: 1,
    discard: true,
  });
  return yield* readDuckDbProjection();
});

const ontologyDataset = (rules: ReadonlyArray<RuleResult>): Rdf.Dataset =>
  Rdf.makeDataset([
    ...A.map(OntologyClassName.Options, (className) =>
      Rdf.makeQuad(Rdf.makeNamedNode(`${LEJEUNE_ONTOLOGY_NAMESPACE}${className}`), RDF_TYPE, OWL_CLASS)
    ),
    ...A.map(
      A.dedupeWith(rules, (left, right) => Str.Equivalence(left.source.id, right.source.id)),
      (result) =>
        Rdf.makeQuad(
          Rdf.makeNamedNode(`${LEJEUNE_ONTOLOGY_NAMESPACE}rule/${result.ruleId}`),
          DCTERMS_SOURCE,
          Rdf.makeNamedNode(result.source.url)
        )
    ),
  ]);

const oxigraphProjection = Effect.fnUntraced(function* (input: ProjectionInput) {
  const sparql = yield* SparqlQueryService;
  const result = yield* sparql.execute(
    SparqlQueryRequest.make({
      dataset: ontologyDataset(input.rules),
      profile: "select",
      query: `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT ?class WHERE { ?class rdf:type owl:Class } ORDER BY ?class`,
    })
  );
  const rows = yield* Match.value(result).pipe(
    Match.when({ profile: "select" }, (select) => Effect.succeed(select.rows)),
    Match.orElse(() => projectionError("oxigraph", "query", "The ontology class query did not return a SELECT result."))
  );
  return yield* Effect.forEach(
    rows,
    (row) =>
      O.match(O.fromUndefinedOr(row.class), {
        onNone: () => projectionError("oxigraph", "query", "The ontology class query returned an unbound class."),
        onSome: (term) => Effect.succeed(Str.replace(LEJEUNE_ONTOLOGY_NAMESPACE, "")(term.value)),
      }),
    { concurrency: 1 }
  );
});

/**
 * Build and query the three local projections using their injected service layers.
 *
 * **Example** (Inspect the projection Effect)
 *
 * ```ts
 * import { buildProjectionSnapshot } from "@/runtime/Projections"
 *
 * console.log(typeof buildProjectionSnapshot === "function") // true
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const buildProjectionSnapshot = Effect.fn("lejeune.projection.build")(function* (input: ProjectionInput) {
  const pgliteEffect = pgliteProjection(input).pipe(
    Effect.mapError((cause) => normalizeProjectionError("pglite", "rebuild", cause)),
    annotateProjectionOutcome,
    Effect.withSpan("db.query", {
      attributes: { "db.operation.name": "rebuild", "db.system": "pglite" },
    })
  );
  const duckDbEffect = duckDbProjection(input).pipe(
    Effect.mapError((cause) => normalizeProjectionError("duckdb", "rebuild", cause)),
    annotateProjectionOutcome,
    Effect.withSpan("db.query", {
      attributes: { "db.operation.name": "rebuild", "db.system": "duckdb" },
    })
  );
  const oxigraphEffect = oxigraphProjection(input).pipe(
    Effect.mapError((cause) => normalizeProjectionError("oxigraph", "query", cause)),
    annotateProjectionOutcome,
    Effect.withSpan("db.query", {
      attributes: { "db.operation.name": "select", "db.system": "oxigraph" },
    })
  );
  const [pglite, duckdb, ontologyClasses] = yield* Effect.all([pgliteEffect, duckDbEffect, oxigraphEffect], {
    concurrency: 3,
  });
  return yield* ProjectionSnapshot.decodeUnknownEffect({
    citations: duckdb.citations,
    documentCount: duckdb.documentCount,
    documentDigests: duckdb.documentDigests,
    ontologyClasses,
    quoteLines: pglite.quoteLines,
    ruleDispositions: pglite.ruleDispositions,
    syntheticRecords: pglite.syntheticRecords,
  }).pipe(
    Effect.mapError((cause) =>
      projectionError("snapshot", "validate", "The projection snapshot violated its fixed contract.", cause)
    )
  );
});

/**
 * Reopen the durable projection stores and verify their query results against a committed snapshot.
 *
 * **Example** (Inspect the verification constructor)
 *
 * ```ts
 * import { verifyDurableProjectionSnapshot } from "@/runtime/Projections"
 *
 * console.log(typeof verifyDurableProjectionSnapshot === "function") // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const verifyDurableProjectionSnapshot = Effect.fn("lejeune.projection.verify_durable")(function* (
  expected: ProjectionSnapshot
) {
  const [pglite, duckdb] = yield* Effect.all(
    [
      readPgliteProjection().pipe(Effect.mapError((cause) => normalizeProjectionError("pglite", "query", cause))),
      readDuckDbProjection().pipe(Effect.mapError((cause) => normalizeProjectionError("duckdb", "query", cause))),
    ],
    { concurrency: 2 }
  );
  const actual = yield* ProjectionSnapshot.decodeUnknownEffect({
    citations: duckdb.citations,
    documentCount: duckdb.documentCount,
    documentDigests: duckdb.documentDigests,
    ontologyClasses: expected.ontologyClasses,
    quoteLines: pglite.quoteLines,
    ruleDispositions: pglite.ruleDispositions,
    syntheticRecords: pglite.syntheticRecords,
  }).pipe(
    Effect.mapError((cause) =>
      projectionError("snapshot", "validate", "A durable projection store violated the fixed contract.", cause)
    )
  );
  if (!projectionSnapshotEquivalent(actual, expected)) {
    return yield* projectionError(
      "snapshot",
      "validate",
      "The reopened durable projection stores disagree with the committed bundle snapshot."
    );
  }
  return actual;
});

/**
 * Construct one scoped local projection layer for a caller-selected PGlite and DuckDB location.
 *
 * **Details**
 *
 * Omitting the PGlite directory and using `:memory:` for DuckDB gives two isolated in-memory stores.
 * A machine-local bundle builder can instead supply durable paths outside the repository.
 *
 * **Example** (Construct an in-memory layer)
 *
 * ```ts
 * import { makeProjectionLayer } from "@/runtime/Projections"
 *
 * console.log(makeProjectionLayer(ProjectionLayerOptions.make({ duckDbPath: ":memory:" })))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeProjectionLayer = (options: ProjectionLayerOptions) => {
  const pgliteLayer = O.match(options.pgliteDataDir, {
    onNone: makePgliteLayer,
    onSome: (dataDir) => makePgliteLayer({ dataDir }),
  });
  return Layer.mergeAll(
    pgliteLayer,
    DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: options.duckDbPath })),
    OxigraphSparqlQueryServiceLive
  );
};
