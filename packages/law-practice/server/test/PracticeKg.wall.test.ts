import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { MailFolderBinding, PracticeKgFamilyKey } from "@beep/law-practice-domain/values/MatterScope";
import {
  buildDuckDb,
  currentPracticeKgReadScope,
  GraphTextSourceSpec,
  indexDuckDbDocuments,
  PracticeKgCatalogRow,
  PracticeKgDocumentAttribution,
  PracticeKgEmailHeaderRow,
  PracticeKgQueries,
  PracticeKgReadScope,
  practiceKgClientFilter,
  practiceKgFamilyKeyFilter,
  practiceKgGrantsFamily,
  practiceKgMailFolderFilter,
  practiceKgReadScopeOf,
} from "@beep/law-practice-server";
import { GrantedScopes } from "@beep/law-practice-use-cases/MatterWall";
import { it } from "@beep/test-runner";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { matterWallGrantingLayer } from "./MatterWall.fixtures.ts";

const archive = `sha256:${Str.repeat(64)("c")}`;
const digests = {
  shared: `sha256:${Str.repeat(64)("a")}`,
  alphaOnly: `sha256:${Str.repeat(64)("b")}`,
  betaOnly: `sha256:${Str.repeat(64)("d")}`,
  unfiled: `sha256:${Str.repeat(64)("e")}`,
} as const;

const alphaKey = PracticeKgFamilyKey.make({ client: "11111", family: "20001" });
const betaKey = PracticeKgFamilyKey.make({ client: "22222", family: "20001" });

const walledAlpha = PracticeKgReadScope.cases.Walled.make({
  familyKeys: [alphaKey],
  mailFolders: [MailFolderBinding.make({ archive, folderPrefix: "Inbox/Alpha" })],
});
const walledNothing = PracticeKgReadScope.cases.Walled.make({ familyKeys: [], mailFolders: [] });
const unwalled = PracticeKgReadScope.cases.Unwalled.make({});

class SourceLine extends S.Opaque<SourceLine, { readonly brand: unique symbol }>()(
  S.Struct({ digest: S.String, operationId: S.String, relativePath: S.String }).annotate({
    identifier: "PracticeKgWallSourceLine",
  })
) {}

class SearchRow extends S.Opaque<SearchRow, { readonly brand: unique symbol }>()(
  S.Struct({ digest: S.String, docket: S.NullOr(S.String), score: S.Finite }).annotate({
    identifier: "PracticeKgWallSearchRow",
  })
) {}

class DocumentKeyRow extends S.Opaque<DocumentKeyRow, { readonly brand: unique symbol }>()(
  S.Struct({ documentKey: S.String, familyKey: S.NullOr(S.String) }).annotate({
    identifier: "PracticeKgWallDocumentKeyRow",
  })
) {}

class FolderRow extends S.Opaque<FolderRow, { readonly brand: unique symbol }>()(
  S.Struct({ folderPath: S.String }).annotate({ identifier: "PracticeKgWallFolderRow" })
) {}

const encodeSourceLine = S.encodeUnknownEffect(S.fromJsonString(SourceLine));
const decodeSearchRows = S.decodeUnknownEffect(S.Array(SearchRow));
const decodeDocumentKeyRows = S.decodeUnknownEffect(S.Array(DocumentKeyRow));
const decodeFolderRows = S.decodeUnknownEffect(S.Array(FolderRow));

type Filing = {
  readonly attribution: PracticeKgDocumentAttribution;
  readonly row: PracticeKgCatalogRow;
};

type Placement = { readonly client: string; readonly docket: string };

type PlacementFields = {
  readonly attributionSource: "filename" | "folder-path";
  readonly category: "unsorted" | "docket";
  readonly client: string | null;
  readonly docket: string | null;
  readonly docketKey: string | null;
  readonly familyKey: string | null;
};

const unplacedFields: PlacementFields = {
  attributionSource: "filename",
  category: "unsorted",
  client: null,
  docket: null,
  docketKey: null,
  familyKey: null,
};

const placedFields = ({ client, docket }: Placement): PlacementFields => ({
  attributionSource: "folder-path",
  category: "docket",
  client,
  docket,
  docketKey: `${client}.${docket}`,
  familyKey: `${client}.20001`,
});

const filingWith = (digest: string, name: string, fields: PlacementFields): Filing => ({
  attribution: PracticeKgDocumentAttribution.make({
    attributionSource: fields.attributionSource,
    client: fields.client,
    digest,
    docket: fields.docket,
    docketKey: fields.docketKey,
    family: "20001",
    familyKey: fields.familyKey,
    recycled: false,
  }),
  row: PracticeKgCatalogRow.make({
    category: fields.category,
    client: fields.client,
    digest,
    docket: fields.docket,
    docketFamily: "20001",
    effectiveName: name,
    mtimeIso: "2026-01-02T03:04:05.000Z",
    organizedRelativePath: null,
    restored: false,
    sourceOriginChain: `base:fixture:${name}`,
    runLabel: "base",
    sizeBytes: 32,
    sourceLabel: "fixture",
    sourceRelativePath: name,
  }),
});

const filing = (digest: string, name: string, placement: Placement | null): Filing =>
  filingWith(digest, name, placement === null ? unplacedFields : placedFields(placement));

const alphaFilings = [
  filing(digests.shared, "shared-alpha.txt", { client: "11111", docket: "20001US01" }),
  filing(digests.alphaOnly, "alpha.txt", { client: "11111", docket: "20001US01" }),
  filing(digests.unfiled, "unfiled.txt", null),
];
const betaFilings = [
  filing(digests.shared, "shared-beta.txt", { client: "22222", docket: "20001US02" }),
  filing(digests.betaOnly, "beta.txt", { client: "22222", docket: "20001US02" }),
];

const texts = [
  [digests.shared, "op-shared", "anchor widget shared filing text"],
  [digests.alphaOnly, "op-alpha", "anchor widget alpha response"],
  [digests.betaOnly, "op-beta", "widget widget widget widget beta notice with many more words in it"],
  [digests.unfiled, "op-unfiled", "anchor widget unfiled"],
] as const;

const emails = A.map(
  [
    [0, "Inbox/Alpha/2026", "Alpha status"],
    [1, "Inbox/Beta/2026", "Beta status"],
  ] as const,
  ([messageOrd, folderPath, subject]) =>
    PracticeKgEmailHeaderRow.make({
      archiveDigest: archive,
      folderPath,
      messageOrd,
      messageRelPath: `${folderPath}/Message${messageOrd}`,
      recipients: "fixture@example.invalid",
      subject,
    })
);

const writeExtract = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const textRoot = path.join(root, "text");
  yield* fs.makeDirectory(textRoot, { recursive: true });
  const lines = yield* Effect.forEach(
    texts,
    ([digest, operation]) =>
      encodeSourceLine(
        SourceLine.make({
          digest,
          operationId: `operation:${operation}`,
          relativePath: `text/operation:${operation}.txt`,
        })
      ),
    { concurrency: 1 }
  );
  yield* fs.writeFileString(path.join(root, "sources.jsonl"), `${A.join(lines, "\n")}\n`);
  yield* Effect.forEach(
    texts,
    ([, operation, text]) => fs.writeFileString(path.join(textRoot, `operation:${operation}.txt`), text),
    { concurrency: 1 }
  );
  return GraphTextSourceSpec.make({
    sourcesPath: path.join(root, "sources.jsonl"),
    textGlob: path.join(textRoot, "operation:*.txt"),
  });
});

const withBundle =
  (filings: ReadonlyArray<Filing>) =>
  <Out, E, R>(read: Effect.Effect<Out, E, R>) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const scratch = yield* fs.makeTempDirectoryScoped({ prefix: "practice-kg-wall-" });
      const root = yield* fs.realPath(scratch);
      const spec = yield* writeExtract(root);
      yield* buildDuckDb(
        A.map(filings, (entry) => entry.row),
        [],
        emails,
        [spec],
        2_097_152
      );
      yield* indexDuckDbDocuments(A.map(filings, (entry) => entry.attribution));
      return yield* read;
    }).pipe(
      Effect.scoped,
      provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" })))
    );

const search = Effect.fn("PracticeKgWallTest.search")(function* (scope: PracticeKgReadScope) {
  const db = yield* DuckDb;
  return yield* db
    .query(PracticeKgQueries.searchText(scope), ["anchor widget", null, 20])
    .pipe(Effect.flatMap(decodeSearchRows));
});

const folders = Effect.fn("PracticeKgWallTest.folders")(function* (scope: PracticeKgReadScope) {
  const db = yield* DuckDb;
  const rows = yield* db
    .query(PracticeKgQueries.email(scope), [null, null, null, null, null])
    .pipe(Effect.flatMap(decodeFolderRows));
  return A.map(rows, (row) => row.folderPath);
});

describe("Practice KG matter wall", () => {
  it.layer(Layer.merge(NodeFileSystem.layer, NodePath.layer))("over a staged bundle", (it) => {
    it.effect("stages one extract text per operation under a resolved temporary root", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const scratch = yield* fs.makeTempDirectoryScoped({ prefix: "practice-kg-wall-" });
        const root = yield* fs.realPath(scratch);
        yield* writeExtract(root);
        const staged = yield* fs.readDirectory(`${root}/text`);
        expect(A.length(staged)).toBe(A.length(texts));
      })
    );

    it.effect(
      "spells granted family keys in a stable order and denies everything when nothing is granted",
      Effect.fnUntraced(function* () {
        const scope = practiceKgReadScopeOf(
          GrantedScopes.make({
            scopeRefs: HashSet.empty(),
            familyKeys: HashSet.make(betaKey, alphaKey),
            mailFolders: HashSet.empty(),
          })
        );
        expect(practiceKgFamilyKeyFilter(scope, "k")).toBe("(k) IN ('11111.20001', '22222.20001')");
        expect(practiceKgClientFilter(scope, "c")).toBe("(c) IN ('11111', '22222')");
        expect(practiceKgMailFolderFilter(scope, "a", "f")).toBe("FALSE");
        expect(practiceKgFamilyKeyFilter(walledNothing, "k")).toBe("FALSE");
        expect(practiceKgClientFilter(walledNothing, "c")).toBe("FALSE");
        expect(practiceKgFamilyKeyFilter(unwalled, "k")).toBe("TRUE");
        expect(practiceKgMailFolderFilter(unwalled, "a", "f")).toBe("TRUE");
        expect(practiceKgMailFolderFilter(walledAlpha, "a", "f")).toBe(
          `((a = '${archive}' AND starts_with(f, 'Inbox/Alpha')))`
        );
        expect(A.map(["11111.20001", "22222.20001", "20001"], practiceKgGrantsFamily(walledAlpha))).toStrictEqual([
          true,
          false,
          false,
        ]);
      })
    );

    it.effect(
      "keys identical bytes filed in two matters as two documents, and leaves an unfiled one without a family key",
      Effect.fnUntraced(function* () {
        const rows = yield* Effect.gen(function* () {
          const db = yield* DuckDb;
          return yield* db
            .query(
              'SELECT d.document_key AS "documentKey", s.family_key AS "familyKey" FROM documents d JOIN fts_docstats s ON s.doc_id = \'document:\' || d.document_key ORDER BY d.document_key'
            )
            .pipe(Effect.flatMap(decodeDocumentKeyRows));
        }).pipe(withBundle([...alphaFilings, ...betaFilings]));
        expect(A.map(rows, (row) => [row.documentKey, row.familyKey])).toStrictEqual([
          [`${digests.shared}@11111.20001US01`, "11111.20001"],
          [`${digests.shared}@22222.20001US02`, "22222.20001"],
          [`${digests.alphaOnly}@11111.20001US01`, "11111.20001"],
          [`${digests.betaOnly}@22222.20001US02`, "22222.20001"],
          [digests.unfiled, null],
        ]);
      })
    );

    it.effect(
      "scores a matter's search over its granted documents only, identically with and without the other matter",
      Effect.fnUntraced(function* () {
        const withBeta = yield* Effect.all([search(walledAlpha), search(unwalled)], { concurrency: 1 }).pipe(
          withBundle([...alphaFilings, ...betaFilings])
        );
        const withoutBeta = yield* Effect.all([search(walledAlpha), search(unwalled)], { concurrency: 1 }).pipe(
          withBundle(alphaFilings)
        );
        const [alphaWithBeta, everyoneWithBeta] = withBeta;
        const [alphaWithoutBeta, everyoneWithoutBeta] = withoutBeta;
        expect(A.map(alphaWithBeta, (row) => [row.digest, row.docket])).toStrictEqual(
          A.map(alphaWithoutBeta, (row) => [row.digest, row.docket])
        );
        expect(A.dedupe(A.map(alphaWithBeta, (row) => row.docket))).toStrictEqual(["20001US01"]);
        expect(A.map(alphaWithBeta, (row) => row.score)).toStrictEqual(A.map(alphaWithoutBeta, (row) => row.score));
        expect(A.length(alphaWithBeta)).toBe(2);
        const alphaOnlyScore = (rows: ReadonlyArray<SearchRow>) =>
          A.map(
            A.filter(rows, (row) => row.digest === digests.alphaOnly),
            (row) => row.score
          );
        expect(alphaOnlyScore(everyoneWithBeta)).not.toStrictEqual(alphaOnlyScore(everyoneWithoutBeta));
        const denied = yield* search(walledNothing).pipe(withBundle([...alphaFilings, ...betaFilings]));
        expect(denied).toStrictEqual([]);
      }),
      { timeout: 60_000 }
    );

    it.effect(
      "returns only messages under a granted mail folder binding",
      Effect.fnUntraced(function* () {
        const [alpha, nothing, everyone] = yield* Effect.all(
          [folders(walledAlpha), folders(walledNothing), folders(unwalled)],
          { concurrency: 1 }
        ).pipe(withBundle(alphaFilings));
        expect(alpha).toStrictEqual(["Inbox/Alpha/2026"]);
        expect(nothing).toStrictEqual([]);
        expect(everyone).toStrictEqual(["Inbox/Alpha/2026", "Inbox/Beta/2026"]);
      })
    );
  });
});

const grantedAlphaAndBeta = GrantedScopes.make({
  scopeRefs: HashSet.empty(),
  familyKeys: HashSet.make(betaKey, alphaKey),
  mailFolders: HashSet.make(
    MailFolderBinding.make({ archive, folderPrefix: "Inbox/Beta" }),
    MailFolderBinding.make({ archive, folderPrefix: "Inbox/Alpha" })
  ),
});

describe("Practice KG matter wall read scope", () => {
  it.layer(matterWallGrantingLayer(grantedAlphaAndBeta))("under a granted principal", (it) => {
    it.effect(
      "walls the host principal to its granted family keys and mail folders in a stable order",
      Effect.fnUntraced(function* () {
        const scope = yield* currentPracticeKgReadScope;
        const read = PracticeKgReadScope.match(scope, {
          Unwalled: () => ({ families: [], folders: [] }),
          Walled: ({ familyKeys, mailFolders }) => ({
            families: A.map(familyKeys, (key) => `${key.client}.${key.family}`),
            folders: A.map(mailFolders, (binding) => binding.folderPrefix),
          }),
        });
        expect(scope._tag).toBe("Walled");
        expect(read).toStrictEqual({
          families: ["11111.20001", "22222.20001"],
          folders: ["Inbox/Alpha", "Inbox/Beta"],
        });
      })
    );
  });

  it.effect(
    "lets a system read through the client filter and grants it every family",
    Effect.fnUntraced(function* () {
      expect(practiceKgClientFilter(unwalled, "client")).toBe("TRUE");
      expect(practiceKgGrantsFamily(unwalled)("33333.20001")).toBe(true);
      expect(practiceKgGrantsFamily(walledAlpha)("33333.20001")).toBe(false);
    })
  );
});

const roundTrips = Effect.fnUntraced(function* <A, I>(schema: S.Codec<A, I>, value: A) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeEffect(schema)(encoded);
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
});

describe("Practice KG matter wall rows schema-derived values", () => {
  it.effect.prop(
    "round-trips every generated MailFolderBinding through its encoding",
    [Arbitrary.schema(MailFolderBinding)],
    ([value]) => roundTrips(MailFolderBinding, value),
    { arbitrary: fcRuns(25) }
  );
  it.effect.prop(
    "round-trips every generated SearchRow through its encoding",
    [Arbitrary.schema(SearchRow)],
    ([value]) => roundTrips(SearchRow, value),
    { arbitrary: fcRuns(25) }
  );
  it.effect.prop(
    "round-trips every generated DocumentKeyRow through its encoding",
    [Arbitrary.schema(DocumentKeyRow)],
    ([value]) => roundTrips(DocumentKeyRow, value),
    { arbitrary: fcRuns(25) }
  );
  it.effect.prop(
    "round-trips every generated FolderRow through its encoding",
    [Arbitrary.schema(FolderRow)],
    ([value]) => roundTrips(FolderRow, value),
    { arbitrary: fcRuns(25) }
  );
});
