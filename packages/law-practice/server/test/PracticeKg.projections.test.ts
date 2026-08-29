import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { Table as CandidateClaimTable } from "@beep/epistemic-tables/entities/CandidateClaim";
import { Table as EvidenceTable } from "@beep/epistemic-tables/entities/Evidence";
import {
  buildPracticeKgBundle,
  LawPracticeServerLive,
  PracticeKgBundle,
  PracticeKgBundleContext,
  PracticeKgBundleManifest,
  PracticeKgClaimsOptions,
  PracticeKgOptions,
  PracticeKgProjectionsLive,
  PracticeKgQueries,
  PracticeKgToolkitLayer,
  runPracticeKgClaimsBatch,
} from "@beep/law-practice-server";
import { DbSchema } from "@beep/law-practice-tables";
import {
  PracticeKgCandidateClaimsNotLoadedResult,
  PracticeKgCandidateClaimsResult,
  PracticeKgToolError,
  PracticeKgToolResult,
} from "@beep/law-practice-use-cases/server";
import * as Pglite from "@beep/pglite";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { getColumns } from "drizzle-orm";
import { Config, ConfigProvider, Effect, FileSystem, Layer, Order, Path, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import { McpServerClient } from "effect/unstable/ai/McpSchema";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as Response from "effect/unstable/ai/Response";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { OFFICE_ACTION_FIXTURE } from "./fixture.ts";

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

class ToolTextContent extends S.Class<ToolTextContent>("PracticeKgToolTextContent")({
  text: S.String,
  type: S.Literal("text"),
}) {}

class ToolTextResult extends S.Class<ToolTextResult>("PracticeKgToolTextResult")({
  content: S.NonEmptyArray(ToolTextContent),
}) {}

const encodeFixtureSource = S.encodeUnknownEffect(S.fromJsonString(FixtureSourceRow));
const decodeDumpLines = S.decodeUnknownEffect(S.Array(DumpLine));
const decodeCountRows = S.decodeUnknownEffect(S.NonEmptyArray(CountRow));
const decodeIriRows = S.decodeUnknownEffect(S.Array(IriRow));
const decodeColumnRows = S.decodeUnknownEffect(S.Array(ColumnRow));
const decodeManifestJson = S.decodeUnknownEffect(S.fromJsonString(PracticeKgBundleManifest));
const decodeToolTextResult = S.decodeUnknownEffect(ToolTextResult);
const decodeToolErrorJson = S.decodeUnknownEffect(S.fromJsonString(PracticeKgToolError));
const decodeToolResultJson = S.decodeUnknownEffect(S.fromJsonString(PracticeKgToolResult));
const decodeCandidateClaimsJson = S.decodeUnknownEffect(S.fromJsonString(PracticeKgCandidateClaimsResult));
const declaredColumnNames = (columns: Readonly<Record<string, { readonly name: string }>>): ReadonlyArray<string> =>
  A.sort(
    A.map(R.values(columns), (column) => column.name),
    Order.String
  );

const fixtureModelOutput = `{"extractions":[{"label":"office_action","text":"Office Action"},{"label":"claim","text":"A widget comprising a lid and a base."},{"label":"rejection_reference","text":"Smith"},{"label":"distinction","text":"a hinge coupling the lid to the base"}]}`;
const fixtureRejectionlessOutput = `{"extractions":[{"label":"office_action","text":"Office Action"},{"label":"claim","text":"A widget comprising a lid and a base."}]}`;
const fixtureUsage = Response.Usage.make({
  inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: 0, uncached: 0 },
  outputTokens: { reasoning: undefined, text: 0, total: 0 },
});
const fixtureLanguageModel = Layer.effect(
  LanguageModel.LanguageModel,
  LanguageModel.make({
    generateText: (options) =>
      Effect.succeed([
        Response.makePart("text", {
          text: Str.includes("without office action rejections")(JSON.stringify(options.prompt))
            ? fixtureRejectionlessOutput
            : fixtureModelOutput,
        }),
        Response.makePart("finish", { reason: "stop", response: undefined, usage: fixtureUsage }),
      ]),
    streamText: () => Stream.empty,
  })
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
      operationId: "operation:op-a",
      relativePath: "text/operation:op-a.txt",
      sizeBytes: 20,
      status: "succeeded",
    }),
    FixtureSourceRow.make({
      artifactId: "artifact-b",
      digest: fixtureDigests.family,
      engine: "tika",
      format: "text",
      operationId: "operation:op-b",
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
      operationId: "operation:op-refresh",
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
  const messageOne = path.join(childrenRoot, "Message00001");
  const messageTwo = path.join(childrenRoot, "Message00002");
  const messageThree = path.join(childrenRoot, "Message00003");
  yield* fs.remove(path.join(messageThree, "Recipients.txt"));
  yield* fs.symlink(path.join(messageTwo, "Recipients.txt"), path.join(messageThree, "Recipients.txt"));
  yield* fs.writeFileString(
    path.join(messageThree, "OutlookHeaders.txt"),
    "Conversation topic:\tFixture topic\nSender name:\tFixture Sender Three\n"
  );
  const linkedMessage = path.join(childrenRoot, "LinkedMessage00004");
  yield* fs.makeDirectory(linkedMessage);
  yield* fs.symlink(path.join(messageOne, "OutlookHeaders.txt"), path.join(linkedMessage, "OutlookHeaders.txt"));
  const archiveRoot = path.dirname(childrenRoot);
  const archiveCollectionRoot = path.dirname(archiveRoot);
  yield* fs.writeFileString(
    path.join(archiveCollectionRoot, `artifact:${Str.repeat(64)("e")}.export`),
    "not a directory"
  );
  yield* fs.makeDirectory(path.join(archiveCollectionRoot, "not-an-artifact"));
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

// `McpServer.callTool` resolves the calling client from context; in production
// the transport's own middleware provides it per request. This fixture stands in
// for that middleware so the call dispatches instead of dying on a missing
// service.
const stubClientInfo = { name: "practice-kg-projections-test", version: "0.0.0" };

const stubMcpClient = McpServerClient.of({
  clientId: 1,
  protocolVersion: "2025-06-18",
  clientCapabilities: {},
  clientInfo: stubClientInfo,
  getClient: Effect.die("the fixture client is never dereferenced") as never,
  initializePayload: {
    capabilities: {},
    clientInfo: stubClientInfo,
    protocolVersion: "2025-06-18",
  } as never,
});

const callToolText = Effect.fn("PracticeKgTest.callToolText")(function* (
  name: string,
  args: Readonly<Record<string, unknown>>
) {
  const server = yield* McpServer.McpServer;
  const result = yield* server
    .callTool({ name, arguments: args })
    .pipe(Effect.provideService(McpServerClient, stubMcpClient));
  const decoded = yield* decodeToolTextResult(result);
  return A.headNonEmpty(decoded.content).text;
});

describe("practice KG projections", () => {
  it("generates schema-valid fixture source rows", () => {
    fc.assert(
      fc.property(S.toArbitrary(S.String)(fc), (value) => {
        expect(S.is(S.String)(value)).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it("pins the schema-absorbed defaults to their contract values", () => {
    const options = PracticeKgOptions.make({
      corpusRoot: "/corpus",
      includeRefresh: false,
      overwrite: false,
      skipEmails: true,
    });
    expect(options.maxTextBytes).toBe(2_097_152);
    expect(options.bundleOut).toBeUndefined();
    const decoded = S.decodeSync(PracticeKgOptions)({
      corpusRoot: "/corpus",
      includeRefresh: false,
      overwrite: false,
      skipEmails: true,
    });
    expect(decoded.maxTextBytes).toBe(2_097_152);
    const spineRow = S.decodeSync(PracticeKgToolResult)({
      bundle_version: "2026-07-27-01",
      data: { columns: ["family"], rows: [["10008"]] },
      epistemic_status: "derived-from-official-records",
      tier: "minimal",
      total: 1,
      truncated: false,
    });
    expect(spineRow.epistemic_status).toBe("derived-from-official-records");
    expect(() =>
      S.decodeUnknownSync(PracticeKgToolResult)({
        bundle_version: "2026-07-27-01",
        data: { columns: [], rows: [] },
        epistemic_status: "settled-fact",
        tier: "minimal",
        total: 0,
        truncated: false,
      })
    ).toThrow();
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
        const db = yield* DuckDb;
        const textLines = yield* db
          .query(
            "SELECT to_json(t)::VARCHAR AS line FROM (SELECT operation_id, text FROM document_text ORDER BY digest) t"
          )
          .pipe(Effect.flatMap(decodeDumpLines));
        expect(A.map(textLines, (row) => row.line)).toStrictEqual([
          '{"operation_id":"operation:op-a","text":"alpha docket 20001US01 response"}',
          '{"operation_id":"operation:op-b","text":"family 20001 patent application"}',
        ]);
        const ftsDocLines = yield* db
          .query(
            "SELECT to_json(x)::VARCHAR AS line FROM (SELECT COUNT(*) AS indexed_documents FROM fts_docstats WHERE doc_id LIKE 'document:%') x"
          )
          .pipe(Effect.flatMap(decodeDumpLines));
        expect(A.map(ftsDocLines, (row) => row.line)).toStrictEqual(['{"indexed_documents":2}']);
      }).pipe(withDuckDb(path.join(firstOut, "practice.duckdb")));

      yield* Effect.gen(function* () {
        const db = yield* DuckDb;
        const refreshTextLines = yield* db
          .query("SELECT to_json(x)::VARCHAR AS line FROM (SELECT COUNT(*) AS text_rows FROM document_text) x")
          .pipe(Effect.flatMap(decodeDumpLines));
        expect(A.map(refreshTextLines, (row) => row.line)).toStrictEqual(['{"text_rows":3}']);
      }).pipe(withDuckDb(path.join(refreshOut, "practice.duckdb")));

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
    "serves all nine tools from the synthetic fixture bundle and degrades oversized results",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const corpusRoot = yield* makeFixtureCorpus();
      const bundleOut = path.join(corpusRoot, "bundle-host");
      yield* runBuild(graphOptions(corpusRoot, bundleOut), bundleOut);
      const manifest = yield* fs
        .readFileString(path.join(bundleOut, "bundle.manifest.json"))
        .pipe(Effect.flatMap(decodeManifestJson));
      const bundleContext = PracticeKgBundleContext.make({ bundleDir: bundleOut, corpusRoot, manifest });
      const resources = Layer.mergeAll(
        Pglite.makeLayer({ dataDir: path.join(bundleOut, "kg.pglite") }),
        DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: path.join(bundleOut, "practice.duckdb") })),
        Layer.succeed(PracticeKgBundle, PracticeKgBundle.of(bundleContext))
      );
      const host = Layer.mergeAll(McpServer.McpServer.layer, PracticeKgToolkitLayer).pipe(
        Layer.provideMerge(resources)
      );

      yield* Effect.gen(function* () {
        const liveCalls = [
          ["kg_clients", {}],
          ["kg_docket_family", { family: "20001" }],
          ["kg_application_lookup", { patent_number: "12345678" }],
          ["kg_find", { query: "20001" }],
          ["corpus_search_text", { query: "alpha" }],
          ["corpus_get_document", { digest: fixtureDigests.docket }],
          ["email_search", { query: "fixture" }],
          ["kg_provenance", {}],
          ["kg_provenance", { iri: "https://ns.beep.sh/practice-kg/application/76543210" }],
          ["kg_provenance", { natural_key: "76543210" }],
        ] as const;
        const results = yield* Effect.forEach(liveCalls, ([name, args]) =>
          callToolText(name, args).pipe(Effect.flatMap(decodeToolResultJson))
        );
        expect(A.length(results)).toBe(10);
        A.forEach(results, (result) => {
          expect(result.bundle_version).toBe(manifest.bundleVersion);
          expect(result.epistemic_status).toBe("derived-from-official-records");
        });
        expect(O.getOrUndefined(A.get(results, 6))?.note).toContain("archive-level confidence");
        const search = O.getOrThrow(A.get(results, 4));
        const searchRow = R.fromEntries(A.zip(search.data.columns, O.getOrThrow(A.head(search.data.rows))));
        expect(searchRow.digest).toBe(fixtureDigests.docket);
        expect(searchRow.snippet).toContain("alpha docket 20001US01");
        const digestProvenance = yield* callToolText("kg_provenance", { digest: fixtureDigests.docket }).pipe(
          Effect.flatMap(decodeToolResultJson)
        );
        const provenanceRow = R.fromEntries(
          A.zip(digestProvenance.data.columns, O.getOrThrow(A.head(digestProvenance.data.rows)))
        );
        expect(provenanceRow.sourceOriginChain).toContain("base:fixture-source:alpha-response.txt");
        const candidate = yield* callToolText("kg_candidate_claims", { family: "20001" }).pipe(
          Effect.flatMap(decodeCandidateClaimsJson)
        );
        expect(S.is(PracticeKgCandidateClaimsNotLoadedResult)(candidate)).toBe(true);
        if (S.is(PracticeKgCandidateClaimsNotLoadedResult)(candidate)) {
          expect(candidate.available).toBe(false);
          expect(candidate.bundle_version).toBe(manifest.bundleVersion);
          expect(candidate.reason).toBe("claims batch not yet loaded");
        }

        const degraded = yield* callToolText("kg_docket_family", {
          budgetBytes: 90,
          family: "20001",
        }).pipe(Effect.flatMap(decodeToolResultJson));
        expect(degraded.tier).toBe("minimal");
        expect(degraded.truncated).toBe(true);

        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        yield* sql.unsafe("DROP TABLE kg_node CASCADE");
        const failure = yield* callToolText("kg_clients", {}).pipe(Effect.flatMap(decodeToolErrorJson));
        expect(failure.tool).toBe("kg_clients");
      }).pipe(provideScopedLayer(host));
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

  it.effect(
    "extracts, persists, and serves span-resolvable candidate claims with fixture model output",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const corpusRoot = yield* makeFixtureCorpus();
      const bundleOut = path.join(corpusRoot, "bundle-claims");
      const inputs = path.join(corpusRoot, "claims-inputs");
      yield* runBuild(graphOptions(corpusRoot, bundleOut), bundleOut);
      yield* fs.makeDirectory(inputs, { recursive: true });
      yield* fs.writeFileString(
        path.join(inputs, "0_Assignment - 20001US03.txt"),
        "assignment fixture without office action rejections"
      );
      yield* fs.writeFileString(path.join(inputs, "1_Response OA - 20001US01.txt"), OFFICE_ACTION_FIXTURE);
      yield* fs.writeFileString(
        path.join(inputs, "10013 OA memo.txt"),
        `${OFFICE_ACTION_FIXTURE}\nleading bare docket fallback exercise`
      );
      yield* fs.writeFileString(
        path.join(inputs, "2_Letter - 20001US04.txt"),
        "letter fixture with unalignable content"
      );
      yield* fs.writeFileString(
        path.join(inputs, "US7699009-fulltext.txt"),
        "patent fulltext reference without a docket"
      );

      const claimsLayer = Layer.mergeAll(
        LawPracticeServerLive,
        Pglite.makeLayer({ dataDir: path.join(bundleOut, "kg.pglite") })
      ).pipe(
        Layer.provide(fixtureLanguageModel),
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ BEEP_LANGEXTRACT_ALLOW_REMOTE: "true" })))
      );
      const summary = yield* runPracticeKgClaimsBatch(PracticeKgClaimsOptions.make({ bundleOut, inputs })).pipe(
        provideScopedLayer(claimsLayer)
      );
      expect(summary.claims).toBe(2);
      expect(summary.files).toBe(2);
      expect(summary.failedFiles).toBe(2);
      const invalidClaimsPath = path.join(inputs, "00_Response OA - 20001US09.pdf");
      yield* fs.writeFileString(invalidClaimsPath, "unsupported extension");
      const unsupportedExtensionFailure = yield* runPracticeKgClaimsBatch(
        PracticeKgClaimsOptions.make({ bundleOut, inputs })
      ).pipe(Effect.flip, provideScopedLayer(claimsLayer));
      expect(unsupportedExtensionFailure.message).toContain("Unsupported claims input extension");
      yield* fs.remove(invalidClaimsPath);

      const directoryClaimsPath = path.join(inputs, "00_Response OA - 20001US09.txt");
      yield* fs.makeDirectory(directoryClaimsPath);
      const directoryClaimsFailure = yield* runPracticeKgClaimsBatch(
        PracticeKgClaimsOptions.make({ bundleOut, inputs })
      ).pipe(Effect.flip, provideScopedLayer(claimsLayer));
      expect(directoryClaimsFailure.message).toContain("not a bounded regular file");
      yield* fs.remove(directoryClaimsPath, { recursive: true });

      const invalidUtf8Path = path.join(inputs, "00_Response OA - 20001US09.txt");
      yield* fs.writeFile(invalidUtf8Path, Uint8Array.of(0xff));
      const invalidUtf8Failure = yield* runPracticeKgClaimsBatch(
        PracticeKgClaimsOptions.make({ bundleOut, inputs })
      ).pipe(Effect.flip, provideScopedLayer(claimsLayer));
      expect(invalidUtf8Failure.message).toContain("not valid UTF-8");
      yield* fs.remove(invalidUtf8Path);

      const oversizedClaimsPath = path.join(inputs, "00_Response OA - 20001US09.md");
      yield* fs.writeFile(oversizedClaimsPath, new Uint8Array(2 * 1024 * 1024 + 1));
      const oversizedClaimsFailure = yield* runPracticeKgClaimsBatch(
        PracticeKgClaimsOptions.make({ bundleOut, inputs })
      ).pipe(Effect.flip, provideScopedLayer(claimsLayer));
      expect(oversizedClaimsFailure.message).toContain("not a bounded regular file");
      yield* fs.remove(oversizedClaimsPath);

      const insideClaimsTarget = path.join(inputs, "inside-claims-target.txt");
      const insideClaimsLink = path.join(inputs, "00_Response OA - 20001US09.txt");
      yield* fs.writeFileString(insideClaimsTarget, OFFICE_ACTION_FIXTURE);
      yield* fs.symlink(insideClaimsTarget, insideClaimsLink);
      const insideLinkedClaimsFailure = yield* runPracticeKgClaimsBatch(
        PracticeKgClaimsOptions.make({ bundleOut, inputs })
      ).pipe(Effect.flip, provideScopedLayer(claimsLayer));
      expect(insideLinkedClaimsFailure.message).toContain("must not traverse a symbolic link");
      yield* fs.remove(insideClaimsLink);
      yield* fs.remove(insideClaimsTarget);

      const outsideClaimsPath = path.join(corpusRoot, "outside-claims.txt");
      const linkedClaimsPath = path.join(inputs, "9_Response OA - 20001US09.txt");
      yield* fs.writeFileString(outsideClaimsPath, "private file outside the claims input root");
      yield* fs.symlink(outsideClaimsPath, linkedClaimsPath);
      const linkedClaimsFailure = yield* runPracticeKgClaimsBatch(
        PracticeKgClaimsOptions.make({ bundleOut, inputs })
      ).pipe(Effect.flip, provideScopedLayer(claimsLayer));
      expect(linkedClaimsFailure.message).toBe("Practice KG claims batch failed.");
      expect(linkedClaimsFailure.cause).toBeDefined();
      yield* fs.remove(linkedClaimsPath);
      const rerunSummary = yield* runPracticeKgClaimsBatch(PracticeKgClaimsOptions.make({ bundleOut, inputs })).pipe(
        provideScopedLayer(claimsLayer)
      );
      expect(rerunSummary.claims).toBe(2);

      const emptyBundleOut = path.join(corpusRoot, "bundle-claims-empty");
      const emptyInputs = path.join(corpusRoot, "claims-empty-inputs");
      yield* runBuild(graphOptions(corpusRoot, emptyBundleOut), emptyBundleOut);
      yield* fs.makeDirectory(emptyInputs, { recursive: true });
      yield* fs.writeFileString(
        path.join(emptyInputs, "0_Assignment - 20001US03.txt"),
        "assignment fixture without office action rejections"
      );
      const emptyClaimsLayer = Layer.mergeAll(
        LawPracticeServerLive,
        Pglite.makeLayer({ dataDir: path.join(emptyBundleOut, "kg.pglite") })
      ).pipe(
        Layer.provide(fixtureLanguageModel),
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ BEEP_LANGEXTRACT_ALLOW_REMOTE: "true" })))
      );
      const zeroClaimsFailure = yield* runPracticeKgClaimsBatch(
        PracticeKgClaimsOptions.make({ bundleOut: emptyBundleOut, inputs: emptyInputs })
      ).pipe(Effect.flip, provideScopedLayer(emptyClaimsLayer));
      expect(zeroClaimsFailure.message).toContain("zero claims");

      const persistedRows = yield* Effect.gen(function* () {
        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        yield* Effect.forEach(
          [
            ["epistemic_candidate_claim", declaredColumnNames(getColumns(CandidateClaimTable))],
            ["epistemic_evidence", declaredColumnNames(getColumns(EvidenceTable))],
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
        return yield* sql.unsafe(PracticeKgQueries.candidateClaims, ["20001US01", null, null]);
      }).pipe(provideScopedLayer(Pglite.makeLayer({ dataDir: path.join(bundleOut, "kg.pglite") })));
      expect(A.length(persistedRows)).toBe(1);

      const manifest = yield* fs
        .readFileString(path.join(bundleOut, "bundle.manifest.json"))
        .pipe(Effect.flatMap(decodeManifestJson));
      const bundleContext = PracticeKgBundleContext.make({ bundleDir: bundleOut, corpusRoot, manifest });
      const resources = Layer.mergeAll(
        Pglite.makeLayer({ dataDir: path.join(bundleOut, "kg.pglite") }),
        DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: path.join(bundleOut, "practice.duckdb") })),
        Layer.succeed(PracticeKgBundle, PracticeKgBundle.of(bundleContext))
      );
      const host = Layer.mergeAll(McpServer.McpServer.layer, PracticeKgToolkitLayer).pipe(Layer.provide(resources));
      const result = yield* callToolText("kg_candidate_claims", { docket: "20001US01" }).pipe(
        Effect.flatMap(decodeToolResultJson),
        provideScopedLayer(host)
      );
      expect(result.epistemic_status).toBe("candidate-unreviewed");
      expect(result.total).toBe(1);
      const row = R.fromEntries(A.zip(result.data.columns, O.getOrThrow(A.head(result.data.rows))));
      expect(row.label).toBe("candidate — unreviewed");
      expect(row.claimText).toBe("A widget comprising a lid and a base.");
      expect(row.evidenceQuote).toBe("A Hinge Coupling The Lid To The Base");
      expect(row.sourceFile).toBe("1_Response OA - 20001US01.txt");
      expect(OFFICE_ACTION_FIXTURE.slice(Number(row.startChar), Number(row.endChar))).toBe(row.evidenceQuote);
      expect(row.activityOperation).toContain("operation:");
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
