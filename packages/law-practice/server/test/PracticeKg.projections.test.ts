import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { buildPracticeKgBundle, PracticeKgOptions, PracticeKgProjectionsLive } from "@beep/law-practice-server";
import { DbSchema } from "@beep/law-practice-tables";
import * as Pglite from "@beep/pglite";
import { NonNegativeInt } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { getColumns } from "drizzle-orm";
import { Config, Effect, FileSystem, Layer, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import * as SqlClient from "effect/unstable/sql/SqlClient";

class FixtureSourceRow extends S.Class<FixtureSourceRow>("FixtureSourceRow")({
  artifactId: S.String,
  digest: S.String,
  engine: S.String,
  format: S.String,
  operationId: S.String,
  relativePath: S.String,
  sizeBytes: S.Finite,
  status: S.String,
}) {}

class DumpLine extends S.Class<DumpLine>("DumpLine")({
  line: S.String,
}) {}

class CountRow extends S.Class<CountRow>("CountRow")({
  count: S.Finite,
}) {}

class IriRow extends S.Class<IriRow>("IriRow")({
  iri: S.String,
}) {}

class ColumnRow extends S.Class<ColumnRow>("ColumnRow")({
  columnName: S.String,
}) {}

const encodeFixtureSource = S.encodeUnknownEffect(S.fromJsonString(FixtureSourceRow));
const decodeDumpLines = S.decodeUnknownEffect(S.Array(DumpLine));
const decodeCountRows = S.decodeUnknownEffect(S.NonEmptyArray(CountRow));
const decodeIriRows = S.decodeUnknownEffect(S.Array(IriRow));
const decodeColumnRows = S.decodeUnknownEffect(S.Array(ColumnRow));
const declaredColumnNames = (columns: Readonly<Record<string, { readonly name: string }>>): ReadonlyArray<string> =>
  A.sort(
    A.map(R.values(columns), (column) => column.name),
    Order.String
  );

const testLayer = NodeServices.layer;
const provideTestLayer = provideScopedLayer(testLayer);
const realCorpusEnabled = O.getOrElse(
  Effect.runSync(Config.option(Config.boolean("BEEP_TEST_OPPOLD_CORPUS"))),
  () => false
);

const withDuckDb =
  (databasePath: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }))));

const fixtureDigests = {
  archive: `sha256:${Str.repeat(64)("c")}`,
  docket: `sha256:${Str.repeat(64)("a")}`,
  email: `sha256:${Str.repeat(64)("d")}`,
  family: `sha256:${Str.repeat(64)("b")}`,
  refresh: `sha256:${Str.repeat(64)("e")}`,
};

const makeFixtureCatalog = Effect.fn("PracticeKgTest.makeFixtureCatalog")(function* (databasePath: string) {
  yield* Effect.gen(function* () {
    const db = yield* DuckDb;
    yield* db.run(`
      CREATE TABLE corpus_source_files (
        run_label VARCHAR, source_label VARCHAR, relative_path VARCHAR, size_bytes BIGINT,
        mtime_iso VARCHAR, digest VARCHAR
      );
      CREATE TABLE corpus_organized (
        digest VARCHAR, source_label VARCHAR, source_relative_path VARCHAR, category VARCHAR,
        client VARCHAR, docket VARCHAR, docket_family VARCHAR, organized_relative_path VARCHAR,
        effective_name VARCHAR
      );
      CREATE TABLE corpus_enrichment (
        candidate VARCHAR, status VARCHAR, application_number VARCHAR, patent_number VARCHAR,
        invention_title VARCHAR, first_applicant_name VARCHAR, first_inventor_name VARCHAR,
        docket_families VARCHAR, parent_application_numbers VARCHAR
      )
    `);
    yield* Effect.forEach(
      [
        [fixtureDigests.docket, "alpha-response.txt", "docket"],
        [fixtureDigests.family, "family-notes.txt", "family"],
        [fixtureDigests.archive, "archive.pst", "archive"],
        [fixtureDigests.email, "exported-message.txt", "email"],
      ],
      ([digest, relativePath], index) =>
        db.run(
          "INSERT INTO corpus_source_files VALUES ('base', 'fixture-source', $1, $2, '2026-01-02T03:04:05.000Z', $3)",
          [relativePath, index + 10, digest]
        ),
      { discard: true }
    );
    yield* db.run(
      "INSERT INTO corpus_source_files VALUES ('2026-07-refresh', 'fixture-refresh', 'refresh-note.txt', 24, '2026-01-02T03:04:06.000Z', $1)",
      [fixtureDigests.refresh]
    );
    yield* db.run(
      "INSERT INTO corpus_organized VALUES ($1, 'fixture-source', 'dockets/20001/20001US01/alpha-response.txt', 'docket', 'fixture-client', '20001US01', '20001', 'dockets/20001/20001US01/alpha-response.txt', 'alpha-response.txt')",
      [fixtureDigests.docket]
    );
    yield* db.run(
      "INSERT INTO corpus_organized VALUES ($1, 'fixture-source', 'dockets/20001/family-notes.txt', 'docket', NULL, NULL, '20001', 'dockets/20001/family-notes.txt', 'family-notes.txt')",
      [fixtureDigests.family]
    );
    yield* db.run(
      "INSERT INTO corpus_organized VALUES ($1, 'fixture-source', 'mail/archive.pst', 'email-archive', NULL, NULL, NULL, 'email-archives/archive.pst', 'archive.pst')",
      [fixtureDigests.archive]
    );
    yield* db.run(
      "INSERT INTO corpus_organized VALUES ($1, 'fixture-source', $2, 'email-export', NULL, NULL, NULL, NULL, 'exported-message.txt')",
      [fixtureDigests.email, `artifact:${Str.repeat(64)("c")}.export/Inbox/Message00001/Message.txt`]
    );
    yield* db.run(
      "INSERT INTO corpus_enrichment VALUES ('87654321', 'resolved', '87654321', '12345678', 'Fixture implement', 'Fixture applicant', 'Fixture inventor', '20001', '76543210')"
    );
  }).pipe(withDuckDb(databasePath));
});

const makeFixtureExtract = Effect.fn("PracticeKgTest.makeFixtureExtract")(function* (corpusRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const extractRoot = path.join(corpusRoot, "staging", "extract");
  const refreshRoot = path.join(corpusRoot, "staging", "extract-2026-07-refresh");
  const textRoot = path.join(extractRoot, "text");
  const refreshTextRoot = path.join(refreshRoot, "text");
  const childrenRoot = path.join(extractRoot, "children", `artifact:${Str.repeat(64)("c")}.export`, "Inbox");
  yield* fs.makeDirectory(textRoot, { recursive: true });
  yield* fs.makeDirectory(refreshTextRoot, { recursive: true });
  const sourceRows = [
    FixtureSourceRow.make({
      artifactId: "artifact-a",
      digest: fixtureDigests.docket,
      engine: "tika",
      format: "text",
      operationId: "op-a",
      relativePath: "text/operation:op-a.txt",
      sizeBytes: 20,
      status: "succeeded",
    }),
    FixtureSourceRow.make({
      artifactId: "artifact-b",
      digest: fixtureDigests.family,
      engine: "tika",
      format: "text",
      operationId: "op-b",
      relativePath: "text/operation:op-b.txt",
      sizeBytes: 20,
      status: "succeeded",
    }),
  ];
  const sourceLines = yield* Effect.forEach(sourceRows, (row) => encodeFixtureSource(row));
  yield* fs.writeFileString(path.join(extractRoot, "sources.jsonl"), `${A.join(sourceLines, "\n")}\n`);
  yield* fs.writeFileString(path.join(textRoot, "operation:op-a.txt"), "alpha docket 20001US01 response");
  yield* fs.writeFileString(path.join(textRoot, "operation:op-b.txt"), "family 20001 patent application");
  const refreshSource = yield* encodeFixtureSource(
    FixtureSourceRow.make({
      artifactId: "artifact-refresh",
      digest: fixtureDigests.refresh,
      engine: "tika",
      format: "text",
      operationId: "op-refresh",
      relativePath: "text/operation:op-refresh.txt",
      sizeBytes: 24,
      status: "succeeded",
    })
  );
  yield* fs.writeFileString(path.join(refreshRoot, "sources.jsonl"), `${refreshSource}\n`);
  yield* fs.writeFileString(path.join(refreshTextRoot, "operation:op-refresh.txt"), "refresh-only fixture text");

  yield* Effect.forEach(
    [
      ["Message00001", "Alpha fixture", "Fixture Sender", "/O=FIXTURE/OU=UNIT/CN=RECIPIENTS/CN=SENDER"],
      ["Message00002", "Beta fixture", "Fixture Sender Two", "sender.two@example.invalid"],
      ["Message00003", "Gamma fixture", "Fixture Sender Three", "sender.three@example.invalid"],
    ],
    ([messageDir, subject, senderName, senderAddress], index) => {
      const directory = path.join(childrenRoot, messageDir);
      return fs
        .makeDirectory(directory, { recursive: true })
        .pipe(
          Effect.andThen(
            fs.writeFileString(
              path.join(directory, "OutlookHeaders.txt"),
              `Subject:\t${subject}\nConversation topic:\tFixture topic\nSender name:\t${senderName}\nSender email address:\t${senderAddress}\nClient submit time:\tJan 0${index + 2}, 2026 03:04:05.000000000 UTC\nDelivery time:\tinvalid timestamp\n`
            )
          ),
          Effect.andThen(
            fs.writeFileString(
              path.join(directory, "Recipients.txt"),
              `Display name:\tFixture Recipient ${index + 1}\nEmail address:\trecipient${index + 1}@example.invalid\n`
            )
          ),
          Effect.andThen(fs.writeFileString(path.join(directory, "Message.txt"), "body is intentionally not indexed"))
        );
    },
    { discard: true }
  );
});

const makeFixtureCorpus = Effect.fn("PracticeKgTest.makeFixtureCorpus")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const corpusRoot = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-graph-fixture-" });
  const catalogRoot = path.join(corpusRoot, "catalog");
  yield* fs.makeDirectory(catalogRoot, { recursive: true });
  yield* makeFixtureCatalog(path.join(catalogRoot, "corpus.duckdb"));
  yield* makeFixtureExtract(corpusRoot);
  return corpusRoot;
});

const duckDump = Effect.fn("PracticeKgTest.duckDump")(function* (databasePath: string) {
  return yield* Effect.gen(function* () {
    const db = yield* DuckDb;
    const statements = [
      "SELECT to_json(d)::VARCHAR AS line FROM documents d ORDER BY digest",
      "SELECT to_json(d)::VARCHAR AS line FROM document_text d ORDER BY digest",
      "SELECT to_json(e)::VARCHAR AS line FROM email_messages e ORDER BY archive_digest, folder_path, message_ord",
      "SELECT to_json(e)::VARCHAR AS line FROM enrichment e ORDER BY candidate",
      "SELECT to_json(d)::VARCHAR AS line FROM fts_docstats d ORDER BY doc_id",
      "SELECT to_json(p)::VARCHAR AS line FROM fts_postings p ORDER BY term, doc_id",
      "SELECT to_json(t)::VARCHAR AS line FROM fts_terms t ORDER BY term",
      "SELECT to_json(b)::VARCHAR AS line FROM fts_bm25 b ORDER BY term, doc_id",
    ];
    const sections = yield* Effect.forEach(statements, (statement) =>
      db.query(statement).pipe(
        Effect.flatMap(decodeDumpLines),
        Effect.map((rows) =>
          A.join(
            A.map(rows, (row) => row.line),
            "\n"
          )
        )
      )
    );
    return A.join(sections, "\n-- table --\n");
  }).pipe(withDuckDb(databasePath));
});

const pgliteDump = Effect.fn("PracticeKgTest.pgliteDump")(function* (dataDir: string) {
  return yield* Effect.gen(function* () {
    const sql = (yield* SqlClient.SqlClient).withoutTransforms();
    const nodeRows = yield* sql
      .unsafe("SELECT row_to_json(n)::text AS line FROM kg_node n ORDER BY iri")
      .pipe(Effect.flatMap(decodeDumpLines));
    const edgeRows = yield* sql
      .unsafe("SELECT row_to_json(e)::text AS line FROM kg_edge e ORDER BY subject_iri, predicate, object_iri")
      .pipe(Effect.flatMap(decodeDumpLines));
    const buildRows = yield* sql
      .unsafe("SELECT row_to_json(b)::text AS line FROM kg_build b ORDER BY bundle_version, built_from_runs, built_at")
      .pipe(Effect.flatMap(decodeDumpLines));
    return A.join(
      A.map(A.appendAll(A.appendAll(nodeRows, edgeRows), buildRows), (row) => row.line),
      "\n"
    );
  }).pipe(provideScopedLayer(Pglite.makeLayer({ dataDir, relaxedDurability: true })));
});

const graphOptions = (corpusRoot: string, bundleOut: string) =>
  PracticeKgOptions.make({
    bundleOut,
    corpusRoot,
    includeRefresh: false,
    maxTextBytes: NonNegativeInt.make(2_097_152),
    overwrite: false,
    skipEmails: false,
  });

const runBuild = Effect.fn("runBuild")(function* (options: PracticeKgOptions, bundleOut: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(bundleOut, { recursive: true });
  return yield* buildPracticeKgBundle(options).pipe(
    provideScopedLayer(
      PracticeKgProjectionsLive.pipe(
        Layer.provide(Pglite.makeLayer({ dataDir: `${bundleOut}/kg.pglite`, relaxedDurability: true }))
      )
    )
  );
});

describe("practice KG projections", () => {
  it("generates schema-valid fixture source rows", () => {
    fc.assert(
      fc.property(S.toArbitrary(S.String), (value) => {
        expect(S.is(S.String)(value)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it.effect(
    "builds byte-identical ordered dumps with stable IRIs and complete provenance",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const corpusRoot = yield* makeFixtureCorpus();
      const firstOut = path.join(corpusRoot, "bundle-first");
      const secondOut = path.join(corpusRoot, "bundle-second");
      const refreshOut = path.join(corpusRoot, "bundle-refresh");

      const first = yield* runBuild(graphOptions(corpusRoot, firstOut), firstOut);
      const second = yield* runBuild(graphOptions(corpusRoot, secondOut), secondOut);
      const refresh = yield* runBuild(
        PracticeKgOptions.make({
          ...graphOptions(corpusRoot, refreshOut),
          includeRefresh: true,
          skipEmails: true,
        }),
        refreshOut
      );
      const firstDuckDump = yield* duckDump(path.join(firstOut, "practice.duckdb"));
      const secondDuckDump = yield* duckDump(path.join(secondOut, "practice.duckdb"));
      const firstPgliteDump = yield* pgliteDump(path.join(firstOut, "kg.pglite"));
      const secondPgliteDump = yield* pgliteDump(path.join(secondOut, "kg.pglite"));
      const firstManifest = yield* fs.readFileString(path.join(firstOut, "bundle.manifest.json"));
      const secondManifest = yield* fs.readFileString(path.join(secondOut, "bundle.manifest.json"));

      expect(firstDuckDump).toBe(secondDuckDump);
      expect(firstPgliteDump).toBe(secondPgliteDump);
      expect(firstManifest).toBe(secondManifest);
      expect(first.counts).toStrictEqual(second.counts);
      expect(first.counts.documents).toBe(4);
      expect(refresh.counts.documents).toBe(5);
      expect(first.counts.emails).toBe(3);
      expect(first.counts.nodes).toBe(11);
      expect(first.counts.edges).toBe(9);

      yield* Effect.gen(function* () {
        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        const provenanceRows = yield* sql
          .unsafe(
            "SELECT COUNT(*)::FLOAT8 AS count FROM kg_node WHERE provenance_kind IS NULL OR provenance_ref IS NULL OR provenance_ref = ''"
          )
          .pipe(Effect.flatMap(decodeCountRows));
        const iriRows = yield* sql
          .unsafe("SELECT iri FROM kg_node WHERE kind IN ('application', 'docket_family', 'document') ORDER BY iri")
          .pipe(Effect.flatMap(decodeIriRows));
        expect(A.headNonEmpty(provenanceRows).count).toBe(0);
        expect(A.map(iriRows, (row) => row.iri)).toStrictEqual([
          "https://ns.beep.sh/practice-kg/application/76543210",
          "https://ns.beep.sh/practice-kg/application/87654321",
          "https://ns.beep.sh/practice-kg/docket_family/20001",
          "https://ns.beep.sh/practice-kg/document/sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "https://ns.beep.sh/practice-kg/document/sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "https://ns.beep.sh/practice-kg/document/sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
          "https://ns.beep.sh/practice-kg/document/sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        ]);
      }).pipe(provideScopedLayer(Pglite.makeLayer({ dataDir: path.join(firstOut, "kg.pglite") })));
    }, provideTestLayer),
    { timeout: 120_000 }
  );

  it.effect(
    "keeps the hand-written bundle DDL equal to the Drizzle read-model declarations",
    Effect.fnUntraced(function* () {
      const path = yield* Path.Path;
      const corpusRoot = yield* makeFixtureCorpus();
      const bundleOut = path.join(corpusRoot, "bundle-ddl");
      yield* runBuild(PracticeKgOptions.make({ ...graphOptions(corpusRoot, bundleOut), skipEmails: true }), bundleOut);
      yield* Effect.gen(function* () {
        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        yield* Effect.forEach(
          [
            ["kg_build", declaredColumnNames(getColumns(DbSchema.kgBuild))],
            ["kg_edge", declaredColumnNames(getColumns(DbSchema.kgEdge))],
            ["kg_node", declaredColumnNames(getColumns(DbSchema.kgNode))],
          ] as const,
          ([tableName, declared]) =>
            Effect.gen(function* () {
              const columnRows = yield* sql
                .unsafe(
                  `SELECT column_name AS "columnName" FROM information_schema.columns WHERE table_name = $1 ORDER BY column_name`,
                  [tableName]
                )
                .pipe(Effect.flatMap(decodeColumnRows));
              expect(A.map(columnRows, (row) => row.columnName)).toStrictEqual(declared);
            })
        );
      }).pipe(provideScopedLayer(Pglite.makeLayer({ dataDir: path.join(bundleOut, "kg.pglite") })));
    }, provideTestLayer),
    { timeout: 120_000 }
  );

  it.effect.skipIf(!realCorpusEnabled)(
    "reconciles the workstation corpus only when explicitly enabled",
    Effect.fnUntraced(function* () {
      const corpusRoot = yield* Config.string("BEEP_TEST_OPPOLD_CORPUS_ROOT");
      const fs = yield* FileSystem.FileSystem;
      const bundleOut = yield* fs.makeTempDirectoryScoped({ prefix: "oppold-corpus-graph-" });
      const summary = yield* runBuild(
        PracticeKgOptions.make({
          bundleOut,
          corpusRoot,
          includeRefresh: false,
          maxTextBytes: NonNegativeInt.make(2_097_152),
          overwrite: true,
          skipEmails: true,
        }),
        bundleOut
      );
      expect(summary.docketFamilies).toBe(105);
      expect(summary.docketFiles).toBe(643);
      expect(summary.familyAnchors).toBe(99);
      expect(summary.sourceRows).toBe(16_774);
      expect(summary.baseDigests).toBe(7_330);

      const refreshBundleOut = yield* fs.makeTempDirectoryScoped({ prefix: "oppold-corpus-graph-refresh-" });
      const refreshSummary = yield* runBuild(
        PracticeKgOptions.make({
          bundleOut: refreshBundleOut,
          corpusRoot,
          includeRefresh: true,
          maxTextBytes: NonNegativeInt.make(2_097_152),
          overwrite: true,
          skipEmails: true,
        }),
        refreshBundleOut
      );
      expect(refreshSummary.counts.documents).toBe(7_342);
    }, provideTestLayer),
    { timeout: 300_000 }
  );
});
