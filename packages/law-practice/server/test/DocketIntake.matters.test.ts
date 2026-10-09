/**
 * Docket intake matter lookup proofs: the combining rules over a fake practice
 * KG lookup, and the live layer over a synthetic bundle written with the
 * bundle's own matter-table writer. Every client, matter, docket and number is
 * synthetic.
 */
import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import {
  encodePracticeKgBundleManifestJson,
  PracticeKgBundleManifest,
  PracticeKgCounts,
  PracticeKgMatterDocketRow,
  PracticeKgMatterLookup,
  PracticeKgMatterRow,
  PracticeKgMatterTables,
  PracticeKgSchemaVersions,
  PracticeKgSourceRuns,
  withDuckDb,
  writeMatterTables,
} from "@beep/law-practice-server";
import {
  DocketKgBundleError,
  DocketKgBundleOptions,
  DocketMatterLookupPracticeKg,
  DocketMatterLookupUnavailableLive,
  DocketMatterMentions,
  makeDocketMatterLookupLayer,
  openDocketKgBundle,
} from "@beep/law-practice-server/DocketIntake";
import { DocketIntakeError, DocketMatterLookup } from "@beep/law-practice-use-cases/DocketIntake";
import {
  extractPracticeKgReferences,
  PracticeKgMatter,
  PracticeKgMatterDocket,
  PracticeKgMatterLookupError,
  PracticeKgMatterLookupResult,
} from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Platform } from "./MailTagging.adapters.fixture.ts";
import type { KgAttributionSource, PracticeKgEpistemicStatus } from "@beep/law-practice-domain/values";
import type { MatterLookupResult } from "@beep/law-practice-use-cases/DocketIntake";
import type { PracticeKgMatterMatchedOn } from "@beep/law-practice-use-cases/server";

type MatterSeed = {
  readonly client?: string | null;
  readonly clientName?: string | null;
  readonly familyKey: string;
  readonly matched?: boolean;
  readonly matchedOn?: ReadonlyArray<PracticeKgMatterMatchedOn>;
  readonly source?: KgAttributionSource;
  readonly status?: PracticeKgEpistemicStatus;
};

const kgDocket = (familyKey: string, stage: string, matched: boolean) =>
  PracticeKgMatterDocket.make({
    applicationNumbers: stage === "US01" ? ["00000001"] : [],
    docket: `00001${stage}`,
    docketKey: `${familyKey}${stage}`,
    documentCount: 1,
    epistemicStatus: "derived-from-official-records",
    matched,
    patentNumbers: stage === "US01" ? ["0000001"] : [],
  });

const kgMatter = (seed: MatterSeed) =>
  PracticeKgMatter.make({
    attributionSource: seed.source ?? "folder-path",
    client: seed.client === undefined ? "0000" : seed.client,
    clientName: seed.clientName ?? null,
    docketCount: 2,
    dockets: [kgDocket(seed.familyKey, "US01", seed.matched ?? true), kgDocket(seed.familyKey, "EP02", false)],
    documentCount: 2,
    epistemicStatus: seed.status ?? "derived-from-official-records",
    family: "00001",
    familyKey: seed.familyKey,
    matchedOn: seed.matchedOn ?? ["docket-key"],
  });

const FAILING_REFERENCE = "0000.09999US01";

type KgScript = {
  readonly matters: Readonly<Record<string, ReadonlyArray<PracticeKgMatter>>>;
  readonly mentions?: Readonly<Record<string, ReadonlyArray<string>>>;
};

const asked = Ref.makeUnsafe<ReadonlyArray<string>>([]);
const mentionAsked = Ref.makeUnsafe<ReadonlyArray<string>>([]);

// The combining rules over a scripted practice KG: a reference not in the script resolves to none,
// and the failing reference fails the lookup.
const script = Ref.makeUnsafe<KgScript>({ matters: {} });

// The combining rules over a scripted practice KG: a reference not in the script resolves to none,
// and the failing reference fails the lookup.
const scriptedLookup = DocketMatterLookupPracticeKg.pipe(
  Layer.provide(
    Layer.merge(
      Layer.succeed(
        PracticeKgMatterLookup,
        PracticeKgMatterLookup.of({
          lookup: Effect.fn("FakePracticeKg.lookup")(function* (request) {
            yield* Ref.update(asked, A.append(request.reference));
            if (request.reference === FAILING_REFERENCE) {
              return yield* PracticeKgMatterLookupError.make({ message: "Fixture failure." });
            }
            const current = yield* Ref.get(script);
            const matters = O.getOrElse(R.get(current.matters, request.reference), A.empty<PracticeKgMatter>);
            return PracticeKgMatterLookupResult.make({
              bundleVersion: "fixture-bundle",
              matters,
              reference: request.reference,
              resolution: A.length(matters) === 0 ? "none" : A.length(matters) === 1 ? "unique" : "ambiguous",
            });
          }),
        })
      ),
      Layer.succeed(
        DocketMatterMentions,
        DocketMatterMentions.of({
          familiesMentioning: Effect.fn("FakeMentions.familiesMentioning")(function* (reference) {
            yield* Ref.update(mentionAsked, A.append(reference));
            const current = yield* Ref.get(script);
            return O.getOrElse(R.get(current.mentions ?? {}, reference), A.empty<string>);
          }),
        })
      )
    )
  )
);

const lookupOver = Effect.fnUntraced(function* (next: KgScript, references: ReadonlyArray<string>) {
  yield* Ref.set(script, next);
  yield* Ref.set(asked, []);
  yield* Ref.set(mentionAsked, []);
  const lookup = yield* DocketMatterLookup;
  return yield* lookup.lookup(references);
});

const uniqueOf = (result: MatterLookupResult) =>
  result._tag === "MatterUnique"
    ? [
        result.familyKey,
        result.verified,
        O.getOrNull(result.client),
        O.getOrNull(result.clientName),
        result.dockets,
        result.matchedDockets,
        result.applications,
        result.patents,
      ]
    : [result._tag];

const keysOf = (result: MatterLookupResult) =>
  result._tag === "MatterAmbiguous" || result._tag === "MatterSuggested"
    ? [result._tag, result.familyKeys]
    : [result._tag];

const US01 = "0000.00001US01";

describe("@beep/law-practice-server DocketIntake matter lookup", () => {
  it.layer(scriptedLookup, { timeout: "5 seconds" })("combining", (it) => {
    it.effect(
      "answers a verified unique matter with its client name, dockets, matched docket and numbers",
      Effect.fnUntraced(function* () {
        const result = yield* lookupOver(
          { matters: { [US01]: [kgMatter({ clientName: "Fixture Client", familyKey: "0000.00001" })] } },
          [` ${US01} `]
        );

        expect(uniqueOf(result)).toStrictEqual([
          "0000.00001",
          true,
          "0000",
          "Fixture Client",
          ["0000.00001US01", "0000.00001EP02"],
          ["0000.00001US01"],
          ["00000001"],
          ["0000001"],
        ]);
        expect(yield* Ref.get(mentionAsked)).toStrictEqual([]);
      })
    );

    it.effect(
      "answers an unverified unique matter when it is unattributed, rests on a recycle-bin stub, or matched on the bare family",
      Effect.fnUntraced(function* () {
        const unattributed = yield* lookupOver(
          { matters: { [US01]: [kgMatter({ client: null, familyKey: "00001" })] } },
          [US01]
        );
        const recycled = yield* lookupOver(
          { matters: { [US01]: [kgMatter({ familyKey: "0000.00001", status: "recycled-unverified" })] } },
          [US01]
        );
        const bareFamily = yield* lookupOver(
          { matters: { "00001": [kgMatter({ familyKey: "0000.00001", matched: false, matchedOn: ["family"] })] } },
          ["00001"]
        );

        expect(A.map([unattributed, recycled, bareFamily], (result) => A.take(uniqueOf(result), 3))).toStrictEqual([
          ["00001", false, null],
          ["0000.00001", false, "0000"],
          ["0000.00001", false, "0000"],
        ]);
        expect(yield* Ref.get(asked)).toStrictEqual(["00001"]);
      })
    );

    it.effect(
      "treats a membership found only through numbers other matters' documents also cite as mention-dominance, so unverified",
      Effect.fnUntraced(function* () {
        const owned = kgMatter({ familyKey: "0000.00001", matchedOn: ["application"] });
        const matters = {
          "00/000,001": [owned],
          "US 0,000,001": [kgMatter({ familyKey: "0000.00001", matchedOn: ["patent"] })],
        };

        const dominance = yield* lookupOver(
          { matters, mentions: { "00/000,001": ["0000.00001"], "US 0,000,001": ["0000.00001", "0001.00009"] } },
          ["00/000,001", "US 0,000,001"]
        );
        const unanimous = yield* lookupOver({ matters, mentions: { "00/000,001": ["0000.00001"] } }, ["00/000,001"]);
        const labelled = yield* lookupOver(
          { matters: { [US01]: [kgMatter({ familyKey: "0000.00001", source: "mention-dominance" })] } },
          [US01]
        );
        const byDocket = yield* lookupOver(
          {
            matters: { ...matters, [US01]: [kgMatter({ familyKey: "0000.00001" })] },
            mentions: { "00/000,001": ["0001.00009"] },
          },
          [US01, "00/000,001"]
        );

        expect(
          A.map([dominance, unanimous, labelled, byDocket], (result) => A.take(uniqueOf(result), 2))
        ).toStrictEqual([
          ["0000.00001", false],
          ["0000.00001", true],
          ["0000.00001", false],
          ["0000.00001", true],
        ]);
        // A docket match settles it: the citing documents are not searched.
        expect(yield* Ref.get(mentionAsked)).toStrictEqual([]);
      })
    );

    it.effect(
      "verifies a family matched both bare and by its docket",
      Effect.fnUntraced(function* () {
        const result = yield* lookupOver(
          {
            matters: {
              "00001": [kgMatter({ familyKey: "0000.00001", matched: false, matchedOn: ["family"] })],
              [US01]: [kgMatter({ familyKey: "0000.00001" })],
            },
          },
          ["00001", US01]
        );

        expect(A.take(uniqueOf(result), 2)).toStrictEqual(["0000.00001", true]);
      })
    );

    it.effect(
      "is ambiguous when the references name different matters, or name one that a wider reference leaves out",
      Effect.fnUntraced(function* () {
        const other = "0001.00001US01";
        const matters = {
          "00001": [kgMatter({ familyKey: "0000.00001" }), kgMatter({ familyKey: "0001.00001" })],
          "00002": [kgMatter({ familyKey: "0002.00002" }), kgMatter({ familyKey: "0003.00002" })],
          [US01]: [kgMatter({ familyKey: "0000.00001" })],
          [other]: [kgMatter({ familyKey: "0001.00001" })],
        };

        const twoMatters = yield* lookupOver({ matters }, [US01, other]);
        const consistent = yield* lookupOver({ matters }, [US01, "00001"]);
        const inconsistent = yield* lookupOver({ matters }, [US01, "00002"]);
        const severalOnly = yield* lookupOver({ matters }, ["00001"]);

        expect(keysOf(twoMatters)).toStrictEqual(["MatterAmbiguous", ["0000.00001", "0001.00001"]]);
        expect(A.take(uniqueOf(consistent), 1)).toStrictEqual(["0000.00001"]);
        expect(keysOf(inconsistent)).toStrictEqual(["MatterAmbiguous", ["0000.00001", "0002.00002", "0003.00002"]]);
        expect(keysOf(severalOnly)).toStrictEqual(["MatterAmbiguous", ["0000.00001", "0001.00001"]]);
      })
    );

    it.effect(
      "answers not found when nothing resolves and no document mentions a number",
      Effect.fnUntraced(function* () {
        const result = yield* lookupOver({ matters: {} }, ["00/000,001", "FIX-0001"]);

        expect(keysOf(result)).toStrictEqual(["MatterNotFound"]);
        expect(yield* Ref.get(mentionAsked)).toStrictEqual(["00/000,001", "FIX-0001"]);
      })
    );

    it.effect(
      "suggests the matters whose documents mention an unowned number, one candidate or two, never choosing",
      Effect.fnUntraced(function* () {
        const one = yield* lookupOver({ matters: {}, mentions: { "00/000,001": ["0000.00002"] } }, ["00/000,001"]);
        const two = yield* lookupOver(
          { matters: {}, mentions: { "00/000,001": ["0001.00003", "0000.00002"], "US 0,000,001": ["0000.00002"] } },
          ["00/000,001", "US 0,000,001"]
        );

        expect(keysOf(one)).toStrictEqual(["MatterSuggested", ["0000.00002"]]);
        expect(keysOf(two)).toStrictEqual(["MatterSuggested", ["0000.00002", "0001.00003"]]);
      })
    );

    it.effect(
      "fails at stage lookup when the practice KG fails",
      Effect.fnUntraced(function* () {
        const error = yield* Effect.flip(lookupOver({ matters: {} }, [FAILING_REFERENCE]));

        expect([error.stage, error.cause]).toStrictEqual(["lookup", "practice-kg-lookup"]);
      })
    );

    it.effect(
      "never looks up the attorney's own client.matter number as a family, which the KG's extraction already ignores",
      Effect.fnUntraced(function* () {
        const result = yield* lookupOver({ matters: {} }, ["0000.01234", "  "]);

        expect(extractPracticeKgReferences("0000.01234")).toStrictEqual([]);
        expect(keysOf(result)).toStrictEqual(["MatterNotFound"]);
        expect(yield* Ref.get(asked)).toStrictEqual([]);
      })
    );

    it.effect(
      "looks up the docket a foreign agent's reference carries and a docket with a national-stage suffix",
      Effect.fnUntraced(function* () {
        yield* lookupOver({ matters: {} }, ["FA-77 / 0000.00001US01", "0000.00001wo01-ca1"]);

        expect(yield* Ref.get(asked)).toStrictEqual(["0000.00001US01", "0000.00001WO01-CA1"]);
      })
    );

    it.effect(
      "drops matters matched only by the client number",
      Effect.fnUntraced(function* () {
        const result = yield* lookupOver(
          {
            matters: {
              "0000": [
                kgMatter({ familyKey: "0000.00001", matchedOn: ["client"] }),
                kgMatter({ familyKey: "0000.00002", matchedOn: ["client"] }),
              ],
            },
          },
          ["0000"]
        );

        expect(keysOf(result)).toStrictEqual(["MatterNotFound"]);
      })
    );
  });
});

describe("@beep/law-practice-server DocketIntake unavailable matter lookup", () => {
  it.layer(DocketMatterLookupUnavailableLive, { timeout: "5 seconds" })("offline", (it) => {
    it.effect(
      "fails every lookup at stage lookup",
      Effect.fnUntraced(function* () {
        const lookup = yield* DocketMatterLookup;
        const error = yield* Effect.flip(lookup.lookup([US01]));

        expect([error.stage, error.cause]).toStrictEqual(["lookup", "practice-kg-lookup-not-wired"]);
      })
    );
  });
});

const fixtureManifest = encodePracticeKgBundleManifestJson(
  PracticeKgBundleManifest.make({
    builtAt: "2030-01-01T00:00:00.000Z",
    bundleVersion: "fixture-bundle",
    corpusRootExpected: false,
    corpusSnapshotAt: "2030-01-01T00:00:00.000Z",
    counts: PracticeKgCounts.make({
      documents: S.Natural.make(3),
      edges: S.Natural.make(0),
      emails: S.Natural.make(0),
      nodes: S.Natural.make(0),
    }),
    schemaVersion: PracticeKgSchemaVersions.make({}),
    sourceRuns: PracticeKgSourceRuns.make({ base: "included", refresh202607: "included" }),
  })
);

const matterRow = (familyKey: string, client: string | null) =>
  PracticeKgMatterRow.make({
    attributionSource: "folder-path",
    client,
    clientName: client === null ? null : "Fixture Client",
    docketCount: 1,
    documentCount: 1,
    epistemicStatus: "derived-from-official-records",
    family: "00001",
    familyKey,
  });

const tables = PracticeKgMatterTables.make({
  dockets: [
    PracticeKgMatterDocketRow.make({
      applicationNumbers: ["00000001"],
      docket: "00001US01",
      docketKey: "0000.00001US01",
      documentCount: 1,
      epistemicStatus: "derived-from-official-records",
      familyKey: "0000.00001",
      patentNumbers: [],
    }),
  ],
  matters: [matterRow("0000.00001", "0000"), matterRow("0000.00002", "0000"), matterRow("0001.00003", "0001")],
});

// Only the columns the mention query reads. The second matter's document cites an application in
// its text and the third's names a patent in its file name; the email row and the family that is
// no matter never count.
const documentStatements = [
  `CREATE TABLE documents (digest VARCHAR, category VARCHAR, client VARCHAR, docket_family VARCHAR,
    effective_name VARCHAR, source_relative_path VARCHAR)`,
  "CREATE TABLE document_text (digest VARCHAR, text VARCHAR)",
  `INSERT INTO documents VALUES
    ('d1', 'docket', '0000', '00002', 'letter.pdf', 'fixture/letter.pdf'),
    ('d2', 'docket', '0001', '00003', 'US 0,000,009 B2.pdf', 'fixture/US 0,000,009 B2.pdf'),
    ('d3', 'email', '0000', '00001', 'mail.msg', 'fixture/mail.msg'),
    ('d4', 'docket', '0009', '00009', 'other.pdf', 'fixture/other.pdf')`,
  `INSERT INTO document_text VALUES
    ('d1', 'Synthetic text citing application 00/000,009 as prior art.'),
    ('d3', 'Synthetic mail citing 00/000,009.'),
    ('d4', 'Synthetic text citing 00/000,009 for a family that is no matter.')`,
];

const writeFile = Effect.fnUntraced(function* (path: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(path, text);
});

const bundleDirectory = Effect.fnUntraced(function* (options: {
  readonly documents: boolean;
  readonly manifest: O.Option<string>;
  readonly database: boolean;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "docket-matters-" });
  if (options.database) {
    const databasePath = path.join(directory, "practice.duckdb");
    yield* writeMatterTables(databasePath)(tables);
    if (options.documents) {
      yield* Effect.gen(function* () {
        const db = yield* DuckDb;
        yield* db.runMany(documentStatements);
      }).pipe(withDuckDb(DuckDbConnectionOptions.make({ databasePath })));
    }
  }
  yield* Effect.forEach(A.fromOption(options.manifest), (text) =>
    writeFile(path.join(directory, "bundle.manifest.json"), text)
  );
  return directory;
});

// A synthetic bundle in a temporary directory, removed when the layer's scope closes.
const syntheticLookup = (documents: boolean) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const bundleDir = yield* bundleDirectory({
        database: true,
        documents,
        manifest: O.some(yield* fixtureManifest),
      });
      return makeDocketMatterLookupLayer(DocketKgBundleOptions.make({ bundleDir }));
    })
  ).pipe(Layer.provideMerge(Platform));

const lookupOf = (references: ReadonlyArray<string>) =>
  Effect.flatMap(Effect.service(DocketMatterLookup), (lookup) => lookup.lookup(references));

const bundleFailure = Effect.fnUntraced(function* (bundleDir: string) {
  const error = yield* Effect.flip(openDocketKgBundle(DocketKgBundleOptions.make({ bundleDir })));
  assertInstanceOf(error, DocketKgBundleError);
  return error.message;
});

describe("@beep/law-practice-server DocketIntake live matter lookup", () => {
  it.layer(syntheticLookup(true), { timeout: "60 seconds" })("over a synthetic bundle", (it) => {
    it.effect(
      "resolves a docket and an owned application, and suggests the matters whose documents cite an unowned number",
      Effect.fnUntraced(function* () {
        const docket = yield* lookupOf([US01]);
        const application = yield* lookupOf(["00/000,001"]);
        const cited = yield* lookupOf(["00/000,009", "US 0,000,009"]);
        const uncited = yield* lookupOf(["00/000,077", "FIX-0001"]);

        expect(A.take(uniqueOf(docket), 6)).toStrictEqual([
          "0000.00001",
          true,
          "0000",
          "Fixture Client",
          ["0000.00001US01"],
          ["0000.00001US01"],
        ]);
        expect(A.take(uniqueOf(application), 1)).toStrictEqual(["0000.00001"]);
        expect(keysOf(cited)).toStrictEqual(["MatterSuggested", ["0000.00002", "0001.00003"]]);
        expect(keysOf(uncited)).toStrictEqual(["MatterNotFound"]);
      })
    );
  });

  it.layer(syntheticLookup(false), { timeout: "60 seconds" })("over a bundle without document tables", (it) => {
    it.effect(
      "fails at stage lookup when there is nothing to search for mentions",
      Effect.fnUntraced(function* () {
        const error = yield* Effect.flip(lookupOf(["00/000,009"]));

        assertInstanceOf(error, DocketIntakeError);
        expect([error.stage, error.cause]).toStrictEqual(["lookup", "practice-kg-mentions"]);
      })
    );
  });

  it.layer(Platform, { timeout: "60 seconds" })("bundle checks", (it) => {
    it.effect(
      "refuses a missing directory, manifest or database, an unreadable manifest, or another store format",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const noManifest = yield* bundleDirectory({ database: true, documents: false, manifest: O.none() });
        const garbage = yield* bundleDirectory({ database: true, documents: false, manifest: O.some("not json") });
        const older = yield* bundleDirectory({
          database: true,
          documents: false,
          manifest: O.some(Str.replace('"duckdb":"4"', '"duckdb":"3"')(yield* fixtureManifest)),
        });
        const noFormat = yield* bundleDirectory({
          database: true,
          documents: false,
          manifest: O.some('{"schemaVersion":{"pglite":"4"}}'),
        });
        const partial = yield* bundleDirectory({
          database: true,
          documents: false,
          manifest: O.some('{"schemaVersion":{"duckdb":"4","pglite":"4"}}'),
        });
        const noDatabase = yield* bundleDirectory({
          database: false,
          documents: false,
          manifest: O.some(yield* fixtureManifest),
        });

        const messages = yield* Effect.forEach(
          [path.join(noManifest, "absent"), noManifest, garbage, older, noFormat, partial, noDatabase],
          bundleFailure
        );

        expect(A.map(messages, Str.replaceAll(/"[^"]*"/gu, "<path>"))).toStrictEqual([
          "Practice KG bundle directory <path> does not exist.",
          "Practice KG bundle manifest <path> cannot be read.",
          "Practice KG bundle manifest <path> is not a bundle manifest.",
          "Practice KG bundle at <path> uses DuckDB store format 3; the docket intake reads format 4. Install a rebuilt bundle.",
          "Practice KG bundle at <path> uses DuckDB store format none; the docket intake reads format 4. Install a rebuilt bundle.",
          "Practice KG bundle manifest <path> is invalid.",
          "Practice KG bundle database <path> is missing.",
        ]);
      })
    );
  });
});
