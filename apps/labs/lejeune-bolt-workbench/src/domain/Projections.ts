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
import { PosInt } from "@beep/schema";
import { SparqlQueryRequest, SparqlQueryService } from "@beep/semantic-web/services/sparql-query";
import { Effect, Layer, Match } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { NormalizedFixture, ProjectionSnapshot, RuleResult } from "@/domain/Bundle";
import { LotCertificate, OntologyClassName, SupplierOffer } from "@/domain/Ontology";

const $I = $LejeuneBoltWorkbenchId.create("domain/Projections");
const LEJEUNE_ONTOLOGY_NAMESPACE = "https://beep.dev/lejeune/ontology/";
const RDF_TYPE = Rdf.makeNamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const OWL_CLASS = Rdf.makeNamedNode("http://www.w3.org/2002/07/owl#Class");
const DCTERMS_SOURCE = Rdf.makeNamedNode("http://purl.org/dc/terms/source");

const PgliteQuoteLineRow = S.Struct({ id: S.String, quantity: S.Finite });
const PgliteRuleRow = S.Struct({ case_id: S.String, disposition: S.String, rule_id: S.String });
const PgliteSyntheticRow = S.Struct({ id: S.String, kind: S.String, label: S.String, observed_at: S.String });
const DuckCountRow = S.Struct({ count: S.Finite });
const DuckTextHitRow = S.Struct({ id: S.String });
const DuckCitationRow = S.Struct({ url: S.String });

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
 * import { ProjectionInput } from "@/domain/Projections"
 *
 * console.log(ProjectionInput.fields.rules !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProjectionInput extends S.Class<ProjectionInput>($I`ProjectionInput`)(
  {
    certificates: S.NonEmptyArray(LotCertificate),
    fixtures: S.NonEmptyArray(NormalizedFixture),
    offers: S.NonEmptyArray(SupplierOffer),
    rules: S.NonEmptyArray(RuleResult),
  },
  $I.annote("ProjectionInput", {
    description: "The normalized fixtures, cited rules, and synthetic records projected into the three local stores.",
  })
) {}

/**
 * Typed local projection failure.
 *
 * **Example** (Create a query-stage failure)
 *
 * ```ts
 * import { ProjectionError } from "@/domain/Projections"
 *
 * console.log(ProjectionError.make({ message: "query failed", stage: "duckdb" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
class ProjectionError extends S.TaggedError<ProjectionError>($I`ProjectionError`)(
  "ProjectionError",
  {
    message: S.NonEmptyString,
    stage: S.NonEmptyString,
  },
  $I.annoteError<ProjectionError>("ProjectionError", {
    title: "LeJeune projection error",
    description: "A typed failure while building or querying one deterministic local projection.",
  })
) {}

const projectionError = (stage: string, message: string): ProjectionError => ProjectionError.make({ message, stage });

class ProjectionLayerOptions extends S.Class<ProjectionLayerOptions>($I`ProjectionLayerOptions`)(
  {
    duckDbPath: S.NonEmptyString,
    pgliteDataDir: S.optionalKey(S.NonEmptyString),
  },
  $I.annote("ProjectionLayerOptions", {
    description: "Caller-selected machine-local paths for one scoped projection layer.",
  })
) {}

const decodeRows = <Schema extends S.Codec<unknown>>(stage: string, schema: Schema, input: unknown) =>
  S.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError(() => projectionError(stage, `The ${stage} query returned an unexpected row shape.`))
  );

const pgliteProjection = Effect.fn("LeJeuneProjections.pglite")(function* (input: ProjectionInput) {
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
    { discard: true }
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
    { discard: true }
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
    { discard: true }
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
    { discard: true }
  );
  const quoteRows = yield* sql
    .unsafe("SELECT id, quantity FROM quote_lines ORDER BY id")
    .pipe(Effect.flatMap((rows) => decodeRows("pglite-quote-lines", S.Array(PgliteQuoteLineRow), rows)));
  const ruleRows = yield* sql
    .unsafe("SELECT case_id, rule_id, disposition FROM rule_results ORDER BY rule_id, case_id")
    .pipe(Effect.flatMap((rows) => decodeRows("pglite-rules", S.Array(PgliteRuleRow), rows)));
  const syntheticRows = yield* sql
    .unsafe("SELECT id, kind, label, observed_at FROM synthetic_records ORDER BY id")
    .pipe(Effect.flatMap((rows) => decodeRows("pglite-synthetic", S.Array(PgliteSyntheticRow), rows)));
  return {
    quoteLines: A.map(quoteRows, (row) => `${row.id}|${row.quantity}`),
    ruleDispositions: A.map(ruleRows, (row) => `${row.rule_id}|${row.case_id}|${row.disposition}`),
    syntheticRecords: A.map(syntheticRows, (row) => `${row.id}|${row.kind}|${row.label}|${row.observed_at}`),
  };
});

const duckDbProjection = Effect.fn("LeJeuneProjections.duckdb")(function* (input: ProjectionInput) {
  const duckdb = yield* DuckDb;
  yield* duckdb.run("CREATE TABLE corpus_documents (id VARCHAR PRIMARY KEY, body VARCHAR NOT NULL)");
  yield* duckdb.run("CREATE TABLE rule_citations (id VARCHAR PRIMARY KEY, url VARCHAR NOT NULL)");
  yield* Effect.forEach(
    A.flatMap(input.fixtures, (fixture) => fixture.sources),
    (source) => duckdb.run("INSERT INTO corpus_documents VALUES ($id, $body)", { body: source.text, id: source.id }),
    { discard: true }
  );
  yield* Effect.forEach(
    input.rules,
    (result) =>
      duckdb.run("INSERT OR IGNORE INTO rule_citations VALUES ($id, $url)", {
        id: result.source.id,
        url: result.source.url,
      }),
    { discard: true }
  );
  yield* Effect.forEach(createDuckDbFullTextProjection, (statement) => duckdb.run(statement), { discard: true });
  const countRows = yield* duckdb
    .query("SELECT CAST(count(*) AS INTEGER) AS count FROM corpus_documents")
    .pipe(Effect.flatMap((rows) => decodeRows("duckdb-count", S.NonEmptyArray(DuckCountRow), rows)));
  const hitRows = yield* duckdb
    .query("SELECT doc_id AS id FROM fts_bm25 WHERE term = 'a490' ORDER BY score DESC, doc_id")
    .pipe(Effect.flatMap((rows) => decodeRows("duckdb-full-text", S.NonEmptyArray(DuckTextHitRow), rows)));
  const citationRows = yield* duckdb
    .query("SELECT url FROM rule_citations ORDER BY id")
    .pipe(Effect.flatMap((rows) => decodeRows("duckdb-citations", S.NonEmptyArray(DuckCitationRow), rows)));
  return {
    citations: [
      ...A.map(hitRows, (row) => `full-text:${row.id}`),
      ...A.map(citationRows, (row) => `source:${row.url}`),
    ],
    documentCount: countRows[0].count,
  };
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

const oxigraphProjection = Effect.fn("LeJeuneProjections.oxigraph")(function* (input: ProjectionInput) {
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
    Match.orElse(() => projectionError("oxigraph", "The ontology class query did not return a SELECT result."))
  );
  return yield* Effect.forEach(
    rows,
    (row) =>
      O.match(O.fromUndefinedOr(row.class), {
        onNone: () => projectionError("oxigraph", "The ontology class query returned an unbound class."),
        onSome: (term) => Effect.succeed(Str.replace(LEJEUNE_ONTOLOGY_NAMESPACE, "")(term.value)),
      }),
    { concurrency: 1 }
  );
});

const requireNonEmpty = <A2>(
  stage: string,
  values: ReadonlyArray<A2>
): Effect.Effect<A.NonEmptyReadonlyArray<A2>, ProjectionError> =>
  A.isReadonlyArrayNonEmpty(values)
    ? Effect.succeed(values)
    : Effect.fail(projectionError(stage, `The ${stage} projection unexpectedly returned no rows.`));

/**
 * Build and query the three local projections using their injected service layers.
 *
 * **Example** (Inspect the projection Effect)
 *
 * ```ts
 * import { buildProjectionSnapshot } from "@/domain/Projections"
 *
 * console.log(typeof buildProjectionSnapshot === "function") // true
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const buildProjectionSnapshot = Effect.fn("LeJeuneProjections.build")(function* (input: ProjectionInput) {
  const [pglite, duckdb, ontologyClasses] = yield* Effect.all(
    [pgliteProjection(input), duckDbProjection(input), oxigraphProjection(input)],
    { concurrency: 3 }
  );
  const citations = yield* requireNonEmpty("citations", duckdb.citations);
  const quoteLines = yield* requireNonEmpty("quote-lines", pglite.quoteLines);
  const ruleDispositions = yield* requireNonEmpty("rules", pglite.ruleDispositions);
  const syntheticRecords = yield* requireNonEmpty("synthetic-records", pglite.syntheticRecords);
  const classes = yield* requireNonEmpty("ontology", ontologyClasses);
  return ProjectionSnapshot.make({
    citations,
    documentCount: PosInt.make(duckdb.documentCount),
    ontologyClasses: classes,
    quoteLines,
    ruleDispositions,
    syntheticRecords,
  });
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
 * import { makeProjectionLayer } from "@/domain/Projections"
 *
 * console.log(makeProjectionLayer({ duckDbPath: ":memory:" }))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeProjectionLayer = (options: ProjectionLayerOptions) => {
  const pgliteLayer = O.match(O.fromUndefinedOr(options.pgliteDataDir), {
    onNone: makePgliteLayer,
    onSome: (dataDir) => makePgliteLayer({ dataDir }),
  });
  return Layer.mergeAll(
    pgliteLayer,
    DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: options.duckDbPath })),
    OxigraphSparqlQueryServiceLive
  );
};
