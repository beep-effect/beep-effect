import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { GenerationFact } from "@beep/epistemics/Admission";
import { ResolvedSourceText, ResolveSourceTextRequest, SourceTextResolver } from "@beep/file-processing/SourceText";
import { IRI } from "@beep/identity/Iri";
import { ActivityRecord } from "@beep/jsonc/ActivityRecord";
import { ActivityPin, ActivityStart } from "@beep/jsonc/ActivityStart";
import {
  DistinctionProposition,
  LawClaimArrows,
  LawClaimCore,
  LawPrincipalId,
  LawProposedClaimRecord,
  logicalKey,
  ScopeRef,
} from "@beep/law-practice-domain/values/LawClaim";
import {
  MailFolderBinding,
  MatterGrant,
  MatterScope,
  PracticeKgFamilyKey,
} from "@beep/law-practice-domain/values/MatterScope";
import {
  buildPracticeKgBundle,
  PracticeKgOptions,
  PracticeKgProjectionsLive,
  PracticeKgToolkitLayer,
} from "@beep/law-practice-server";
import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { captureCitationMentionReceiptData } from "@beep/law-practice-server/internal/Citation/Mention";
import { makeCitationSourceResolution } from "@beep/law-practice-server/internal/Citation/SourceResolution";
import { LawPracticeServerLive } from "@beep/law-practice-server/layer";
import {
  AuthorizedSourceTextResolver,
  MatterAuthorityConfig,
  MatterAuthorityLayer,
} from "@beep/law-practice-server/MatterAuthority";
import {
  loadPracticeKgBundleContext,
  makePracticeKgHostResourcesLayer,
} from "@beep/law-practice-server/PracticeKgHost";
import { LawClaimProposals, ProposedClaimEntry } from "@beep/law-practice-use-cases/ClaimStore";
import { NoticeMessage } from "@beep/law-practice-use-cases/DailyNotice";
import { LawPrincipal } from "@beep/law-practice-use-cases/MatterWall";
import { ProvenanceResult, ProvenanceTraversal } from "@beep/law-practice-use-cases/ProvenanceTraversal";
import { CitationEngineLimits, PracticeKgToolResult } from "@beep/law-practice-use-cases/server";
import * as Pglite from "@beep/pglite";
import { ActivityId } from "@beep/schema/ContentHash";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { it } from "@beep/test-runner";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { mintCaptureId } from "@beep/text/Capture";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  SourceTextLocator,
} from "@beep/text/SourceTextIdentity";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as LanguageModel from "effect/ai/LanguageModel";
import { McpServerClient } from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import * as Model from "effect/ai/Model";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { CitationCallbackObservation, prepareCallbackObservation } from "./CitationCallbackSession.fixtures.ts";
import { ownCitationTestConfiguration } from "./CitationConfigurationOwnership.fixtures.ts";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import { makeCitationTestScaffoldBinding } from "./CitationInvocation.fixtures.ts";
import { OFFICE_ACTION_FIXTURE } from "./fixture.ts";
import { provideMatterAuthority, serviceOf } from "./MatterWall.fixtures.ts";
import type { ContentHash } from "@beep/schema/ContentHash";

const matterA = LawPractice.MatterId.make(1);
const matterB = LawPractice.MatterId.make(2);
const principalA = LawPrincipalId.make(7);
const principalAB = LawPrincipalId.make(8);
const scopeA = ScopeRef.make("matter:two-matter-a");
const scopeB = ScopeRef.make("matter:two-matter-b");
const clients = { a: "11111", b: "22222" } as const;
const family = "20001";
const archive = `sha256:${Str.repeat(64)("c")}`;
const digests = {
  shared: `sha256:${Str.repeat(64)("5")}`,
  alphaOnly: `sha256:${Str.repeat(64)("6")}`,
  betaOnly: `sha256:${Str.repeat(64)("7")}`,
} as const;

const scopeFor = (matter: LawPractice.MatterId, scopeRef: string, client: string, folder: string) =>
  MatterScope.make({
    matter,
    scopeRefs: HashSet.make(scopeRef),
    familyKeys: HashSet.make(PracticeKgFamilyKey.make({ client, family })),
    mailFolders: HashSet.make(MailFolderBinding.make({ archive, folderPrefix: folder })),
  });

const wallConfig = (extraScopes: ReadonlyArray<MatterScope> = []) =>
  MatterAuthorityConfig.make({
    scopes: [
      scopeFor(matterA, scopeA, clients.a, "Matters/A"),
      scopeFor(matterB, scopeB, clients.b, "Matters/B"),
      ...extraScopes,
    ],
    grants: [
      MatterGrant.make({ principal: principalA, matters: HashSet.make(matterA) }),
      MatterGrant.make({ principal: principalAB, matters: HashSet.make(matterA, matterB) }),
    ],
  });

const wallFor = (principal: LawPrincipalId, config: MatterAuthorityConfig = wallConfig()) =>
  Layer.merge(MatterAuthorityLayer(config), Layer.succeed(LawPrincipal, { principal }));

const sha256Of = (text: string) =>
  SourceTextDigest.make(
    `sha256:${process.getBuiltinModule("node:crypto").createHash("sha256").update(text).digest("hex")}`
  );

const officeActionIn = (scopeRef: ScopeRef) =>
  SourceTextIdentity.make({
    scopeRef,
    sourceRef: "office-action.txt",
    locator: SourceTextLocator.make("office-action.txt"),
    sourceDigest: sha256Of(OFFICE_ACTION_FIXTURE),
    textDigest: sha256Of(OFFICE_ACTION_FIXTURE),
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "raw/1",
  });

const identicalBytes = SourceTextResolver.of({
  resolve: Effect.fn("TwoMatterTest.identicalBytes")(function* (request) {
    return ResolvedSourceText.make({ identity: request.identity, text: OFFICE_ACTION_FIXTURE });
  }),
});

const authorizedResolverFor = (principal: LawPrincipalId) =>
  serviceOf(SourceTextResolver)(
    AuthorizedSourceTextResolver.pipe(
      Layer.provide(Layer.succeed(SourceTextResolver, identicalBytes)),
      Layer.provide(wallFor(principal))
    )
  );

const proposition = DistinctionProposition.make({
  authority: "office-action",
  applicationNumber: "16/123,456",
  claimNumber: 1,
  ground: "102",
  referenceDocument: "US 9,876,543 B2",
  detail: { kind: "missing_limitation", limitation: "a hinged lid" },
});

const hashOf = (digit: string): `sha256:${string}` => `sha256:${Str.repeat(64)(digit)}`;

const coreIn = (scope: ScopeRef) =>
  LawClaimCore.make({
    proposition,
    logicalKey: logicalKey(proposition),
    supportAtCreation: HashSet.empty(),
    derivedFrom: HashSet.empty(),
    supersedes: O.none(),
    generatedBy: ActivityId.make(hashOf("f")),
    assertedBy: { _tag: "Person", principal: principalA },
    valid: { _tag: "Unknown" },
    knowledgeStart: DateTime.makeUnsafe(1_000),
    scope,
  });

const recordUsing = (digit: string, used: ReadonlyArray<ContentHash>) =>
  ActivityRecord.make({
    id: ActivityId.make(hashOf(digit)),
    start: ActivityStart.make({
      operation: IRI.make("https://example.test/ops/run"),
      pin: ActivityPin.cases.Engine.make({ engine: "fixture", edition: "1" }),
      promptDigest: O.none(),
      used: HashSet.fromIterable(used),
      started: DateTime.makeUnsafe(0),
    }),
    generated: HashSet.empty(),
    ended: DateTime.makeUnsafe(5),
    outcome: "completed",
  });

const entryOf = Effect.fn("TwoMatterTest.entryOf")(function* (
  scope: ScopeRef,
  activities: ReadonlyArray<ActivityRecord>,
  captures: ReadonlyArray<SourceTextIdentity>
) {
  const core = coreIn(scope);
  const claim = yield* LawClaimArrows.mint(core);
  return ProposedClaimEntry.make({
    record: LawProposedClaimRecord.make({ claim, core, stance: "proposed" }),
    generation: GenerationFact.make({ activity: core.generatedBy, at: DateTime.makeUnsafe(1_000) }),
    activities: HashSet.fromIterable(activities),
    captures: HashSet.fromIterable(captures),
  });
});

const stubModel = Model.make(
  "test",
  "stub-model",
  Layer.succeed(LanguageModel.LanguageModel, {
    generateObject: () => Effect.die("the two-matter test runs no model") as never,
    generateText: () => Effect.die("the two-matter test runs no model") as never,
    streamText: () => Stream.empty as never,
  } as unknown as LanguageModel.LanguageModel)
);

const serverFor = (principal: LawPrincipalId) =>
  LawPracticeServerLive.pipe(Layer.provide(Layer.mergeAll(stubModel, NodeCrypto.layer, wallFor(principal))));

const sortedIds = (ids: Iterable<string>) => A.sort(A.fromIterable(ids), Order.String);

class CatalogFile extends S.Opaque<CatalogFile, { readonly brand: unique symbol }>()(
  S.Struct({
    digest: S.String,
    sourcePath: S.String,
    docket: S.NullOr(S.String),
    organizedPath: S.NullOr(S.String),
    category: S.String,
  }).annotate({ identifier: "TwoMatterCatalogFile" })
) {}

class ExtractSource extends S.Opaque<ExtractSource, { readonly brand: unique symbol }>()(
  S.Struct({
    artifactId: S.String,
    digest: S.String,
    engine: S.String,
    format: S.String,
    operationId: S.String,
    relativePath: S.String,
    sizeBytes: S.Finite,
    status: S.String,
  }).annotate({ identifier: "TwoMatterExtractSource" })
) {}

const encodeExtractSource = S.encodeUnknownEffect(S.fromJsonString(ExtractSource));
const decodeToolTextResult = S.decodeUnknownEffect(
  S.Struct({ content: S.NonEmptyArray(S.Struct({ type: S.tag("text"), text: S.String })) })
);
const decodeToolResult = S.decodeUnknownEffect(S.fromJsonString(PracticeKgToolResult));

const sharedText = `Response to office action for ${clients.a}.${family}US01 and ${clients.b}.${family}US02 citing a widget lid`;
const alphaText = `Alpha letter for ${clients.a}.${family}US01 about the widget base`;
const betaText = `Beta notice for ${clients.b}.${family}US02 about the widget widget widget hinge and other widget parts`;

const catalogFiles = (withBeta: boolean): ReadonlyArray<CatalogFile> => [
  CatalogFile.make({
    digest: digests.shared,
    sourcePath: "dockets/A/shared.txt",
    docket: `${family}US01`,
    organizedPath: `dockets/${family}/${family}US01/shared.txt`,
    category: "docket",
  }),
  CatalogFile.make({
    digest: digests.alphaOnly,
    sourcePath: "dockets/A/alpha.txt",
    docket: `${family}US01`,
    organizedPath: `dockets/${family}/${family}US01/alpha.txt`,
    category: "docket",
  }),
  ...(withBeta
    ? [
        CatalogFile.make({
          digest: digests.shared,
          sourcePath: "dockets/B/shared.txt",
          docket: `${family}US02`,
          organizedPath: `dockets/${family}/${family}US02/shared.txt`,
          category: "docket",
        }),
        CatalogFile.make({
          digest: digests.betaOnly,
          sourcePath: "dockets/B/beta.txt",
          docket: `${family}US02`,
          organizedPath: `dockets/${family}/${family}US02/beta.txt`,
          category: "docket",
        }),
      ]
    : []),
  CatalogFile.make({
    digest: archive,
    sourcePath: "mail/archive.pst",
    docket: null,
    organizedPath: "email-archives/archive.pst",
    category: "email-archive",
  }),
];

const writeCorpus = Effect.fn("TwoMatterTest.writeCorpus")(function* (withBeta: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const corpusRoot = yield* fs
    .makeTempDirectoryScoped({ prefix: "two-matter-corpus-" })
    .pipe(Effect.flatMap(fs.realPath));
  const catalogRoot = path.join(corpusRoot, "catalog");
  yield* fs.makeDirectory(catalogRoot, { recursive: true });
  const files = catalogFiles(withBeta);
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
        effective_name VARCHAR, restored BOOLEAN
      );
      CREATE TABLE corpus_enrichment (
        candidate VARCHAR, status VARCHAR, application_number VARCHAR, patent_number VARCHAR,
        invention_title VARCHAR, first_applicant_name VARCHAR, first_inventor_name VARCHAR,
        docket_families VARCHAR, parent_application_numbers VARCHAR
      )
    `);
    yield* Effect.forEach(
      files,
      (file, index) =>
        db
          .run(
            "INSERT INTO corpus_source_files VALUES ('base', 'fixture-source', $1, $2, '2026-01-02T03:04:05.000Z', $3)",
            [file.sourcePath, index + 10, file.digest]
          )
          .pipe(
            Effect.andThen(
              db.run(
                "INSERT INTO corpus_organized VALUES ($1, 'fixture-source', $2, $3, NULL, $4, $5, $6, $7, FALSE)",
                [
                  file.digest,
                  file.sourcePath,
                  file.category,
                  file.docket,
                  file.docket === null ? null : family,
                  file.organizedPath,
                  path.basename(file.sourcePath),
                ]
              )
            )
          ),
      { concurrency: 1, discard: true }
    );
  }).pipe(
    provideScopedLayer(
      DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: path.join(catalogRoot, "corpus.duckdb") }))
    )
  );
  const extractRoot = path.join(corpusRoot, "staging", "extract");
  const textRoot = path.join(extractRoot, "text");
  yield* fs.makeDirectory(textRoot, { recursive: true });
  const texts = A.filter(
    [
      [digests.shared, "op-shared", sharedText],
      [digests.alphaOnly, "op-alpha", alphaText],
      [digests.betaOnly, "op-beta", betaText],
    ] as const,
    ([digest]) => withBeta || digest !== digests.betaOnly
  );
  const lines = yield* Effect.forEach(
    texts,
    ([digest, operation], index) =>
      encodeExtractSource(
        ExtractSource.make({
          artifactId: `artifact-${index}`,
          digest,
          engine: "tika",
          format: "text",
          operationId: `operation:${operation}`,
          relativePath: `text/operation:${operation}.txt`,
          sizeBytes: 20,
          status: "succeeded",
        })
      ),
    { concurrency: 1 }
  );
  yield* fs.writeFileString(path.join(extractRoot, "sources.jsonl"), `${A.join(lines, "\n")}\n`);
  yield* Effect.forEach(
    texts,
    ([, operation, text]) => fs.writeFileString(path.join(textRoot, `operation:${operation}.txt`), text),
    { concurrency: 1, discard: true }
  );
  const exportRoot = path.join(extractRoot, "children", `artifact:${Str.repeat(64)("c")}.export`);
  yield* Effect.forEach(
    A.filter(
      [
        ["Matters/A", "Message00001", "Widget status for matter A"],
        ["Matters/B", "Message00002", "Widget status for matter B"],
      ] as const,
      ([folder]) => withBeta || folder === "Matters/A"
    ),
    ([folder, messageDir, subject], index) => {
      const directory = path.join(exportRoot, folder, messageDir);
      return fs
        .makeDirectory(directory, { recursive: true })
        .pipe(
          Effect.andThen(
            fs.writeFileString(
              path.join(directory, "OutlookHeaders.txt"),
              `Subject:\t${subject}\nConversation topic:\tWidget\nSender name:\tFixture Sender\nSender email address:\tsender@example.invalid\nClient submit time:\tJan 0${index + 2}, 2026 03:04:05.000000000 UTC\n`
            )
          ),
          Effect.andThen(
            fs.writeFileString(
              path.join(directory, "Recipients.txt"),
              "Display name:\tFixture Recipient\nEmail address:\trecipient@example.invalid\n"
            )
          ),
          Effect.andThen(fs.writeFileString(path.join(directory, "Message.txt"), "body is not indexed"))
        );
    },
    { concurrency: 1, discard: true }
  );
  return corpusRoot;
});

const candidateRow = (digest: string, docket: string, key: string) =>
  `('{"activityOperation":"extract","claimText":"claim ${key}","digest":"${digest}","docket":"${docket}","evidenceFixtureKey":"${key}","family":"${family}","sourceDocumentDigest":"${digest}","sourceFile":"${key}.txt"}', '${key}')`;

const seedCandidateClaims = Effect.fn("TwoMatterTest.seedCandidateClaims")(function* (dataDir: string) {
  yield* Effect.gen(function* () {
    const sql = (yield* SqlClient.SqlClient).withoutTransforms();
    yield* sql.unsafe("CREATE TABLE epistemic_candidate_claim (snapshot JSONB, public_id TEXT)");
    yield* sql.unsafe("CREATE TABLE epistemic_evidence (span JSONB, span_fixture_key TEXT)");
    yield* sql.unsafe(
      `INSERT INTO epistemic_candidate_claim VALUES ${A.join(
        [
          candidateRow(digests.shared, `${family}US01`, "shared-a"),
          candidateRow(digests.shared, `${family}US02`, "shared-b"),
          candidateRow(digests.betaOnly, `${family}US02`, "beta-only"),
        ],
        ", "
      )}`
    );
    yield* sql.unsafe(
      `INSERT INTO epistemic_evidence VALUES ${A.join(
        A.map(
          ["shared-a", "shared-b", "beta-only"],
          (key) => `('{"startChar":0,"endChar":8,"quote":"Response","confidence":0}', '${key}')`
        ),
        ", "
      )}`
    );
  }).pipe(provideScopedLayer(Pglite.makeLayer({ dataDir, relaxedDurability: true })));
});

const buildBundle = Effect.fn("TwoMatterTest.buildBundle")(function* (withBeta: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const corpusRoot = yield* writeCorpus(withBeta);
  const bundleDir = path.join(corpusRoot, "bundle");
  yield* fs.makeDirectory(bundleDir, { recursive: true });
  yield* buildPracticeKgBundle(
    PracticeKgOptions.make({
      bundleOut: bundleDir,
      corpusRoot,
      includeRefresh: false,
      overwrite: false,
      skipEmails: false,
    })
  ).pipe(
    provideScopedLayer(
      PracticeKgProjectionsLive.pipe(
        Layer.provide(Pglite.makeLayer({ dataDir: path.join(bundleDir, "kg.pglite"), relaxedDurability: true }))
      )
    )
  );
  yield* seedCandidateClaims(path.join(bundleDir, "kg.pglite"));
  return { bundleDir, corpusRoot };
});

class TwoMatterBundles extends Context.Service<
  TwoMatterBundles,
  {
    readonly withBeta: { readonly bundleDir: string; readonly corpusRoot: string };
    readonly withoutBeta: { readonly bundleDir: string; readonly corpusRoot: string };
  }
>()("@beep/law-practice-server/test/MatterWall.two-matter.test/TwoMatterBundles") {}

const fileServices = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, NodeCrypto.layer);

const bundlesLayer = Layer.effect(
  TwoMatterBundles,
  Effect.gen(function* () {
    const withBeta = yield* buildBundle(true);
    const withoutBeta = yield* buildBundle(false);
    return TwoMatterBundles.of({ withBeta, withoutBeta });
  })
).pipe(Layer.provide(fileServices));

const committedCitationFixtures = Effect.fn("TwoMatterTest.committedCitationFixtures")(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.realPath(import.meta.dirname);
  return yield* loadCitationFrozenEditionFixtures();
});

const stubClientInfo = { name: "two-matter-test", version: "0.0.0" };

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

const callToolText = Effect.fn("TwoMatterTest.callToolText")(function* (
  name: string,
  args: Readonly<Record<string, unknown>>
) {
  const server = yield* McpServer.McpServer;
  const result = yield* server
    .callTool({ name, arguments: { budgetBytes: 20_000, ...args } })
    .pipe(Effect.provideService(McpServerClient, stubMcpClient));
  const decoded = yield* decodeToolTextResult(result);
  return A.headNonEmpty(decoded.content).text;
});

const toolRows = Effect.fn("TwoMatterTest.toolRows")(function* (name: string, args: Readonly<Record<string, unknown>>) {
  const result = yield* Effect.flatMap(callToolText(name, args), decodeToolResult);
  return A.map(result.data.rows, (row) => R.fromEntries(A.zip(result.data.columns, row)));
});

const asPrincipal =
  (bundle: { readonly bundleDir: string; readonly corpusRoot: string }, principal: LawPrincipalId) =>
  <Out, E, Req>(read: Effect.Effect<Out, E, Req>) =>
    Effect.gen(function* () {
      const context = yield* loadPracticeKgBundleContext(bundle.bundleDir, bundle.corpusRoot);
      const resources = makePracticeKgHostResourcesLayer(context);
      const host = Layer.mergeAll(McpServer.McpServer.layer, PracticeKgToolkitLayer).pipe(
        Layer.provideMerge(resources),
        Layer.provide(wallFor(principal))
      );
      return yield* read.pipe(provideScopedLayer(host));
    });

const columnValues = (rows: ReadonlyArray<Readonly<Record<string, unknown>>>, column: string) =>
  A.map(rows, (row) => row[column]);

const graphReads = Effect.fn("TwoMatterTest.graphReads")(function* () {
  const clientsRows = yield* toolRows("kg_clients", {});
  const found = yield* toolRows("kg_find", { query: "shared" });
  const provenance = yield* toolRows("kg_provenance", { natural_key: digests.shared });
  const betaProvenance = yield* toolRows("kg_provenance", { natural_key: digests.betaOnly });
  const bundleStatus = yield* toolRows("kg_provenance", {});
  const bareFamily = yield* toolRows("kg_docket_family", { family });
  const matters = yield* toolRows("kg_matter_lookup", { reference: family });
  const candidate = yield* toolRows("kg_candidate_claims", {});
  return {
    clients: A.dedupe(
      columnValues(
        A.filter(clientsRows, (row) => row.kind === "client"),
        "naturalKey"
      )
    ),
    found: A.dedupe(columnValues(found, "naturalKey")),
    provenance: columnValues(provenance, "naturalKey"),
    betaProvenance: columnValues(betaProvenance, "naturalKey"),
    bundleStatusCounted: A.map(bundleStatus, P.hasProperty("count")),
    families: A.dedupe(columnValues(bareFamily, "family")),
    matters: A.dedupe(columnValues(matters, "familyKey")),
    candidates: A.sort(A.filter(columnValues(candidate, "claimText"), P.isString), Order.String),
  };
});

const searchReads = Effect.fn("TwoMatterTest.searchReads")(function* () {
  const hits = yield* toolRows("corpus_search_text", { query: "widget" });
  const mail = yield* toolRows("email_search", {});
  const shared = yield* toolRows("corpus_get_document", { digest: digests.shared });
  const betaOnly = yield* toolRows("corpus_get_document", { digest: digests.betaOnly });
  return {
    hits: A.map(hits, (row) => [row.digest, row.docket, row.score]),
    folders: columnValues(mail, "folderPath"),
    shared: columnValues(shared, "docket"),
    betaOnly: A.length(betaOnly),
  };
});

describe("MatterWall two matters with identical bytes", () => {
  it.layer(NodeCrypto.layer)("identity", (it) => {
    it.effect("MatterWall 0 identity mints two claim ids for cores that differ only by matter scope", () =>
      Effect.gen(function* () {
        const [underA, underB, againA] = yield* Effect.all(
          [
            LawClaimArrows.mint(coreIn(scopeA)),
            LawClaimArrows.mint(coreIn(scopeB)),
            LawClaimArrows.mint(coreIn(scopeA)),
          ],
          { concurrency: 1 }
        );
        expect(underA).not.toBe(underB);
        expect(underA).toBe(againA);
      })
    );
  });

  it.effect("MatterWall 1 source retrieval returns A's capture and refuses B's identical bytes to pA", () =>
    Effect.gen(function* () {
      const resolverA = yield* authorizedResolverFor(principalA);
      const resolverAB = yield* authorizedResolverFor(principalAB);
      const request = (scopeRef: ScopeRef) => ResolveSourceTextRequest.make({ identity: officeActionIn(scopeRef) });
      const granted = yield* resolverA.resolve(request(scopeA));
      const denied = yield* resolverA.resolve(request(scopeB)).pipe(Effect.flip);
      const both = yield* Effect.forEach([scopeA, scopeB], (scope) => resolverAB.resolve(request(scope)), {
        concurrency: 1,
      });
      expect(granted.text).toBe(OFFICE_ACTION_FIXTURE);
      expect(denied.reason).toBe("scope-unavailable");
      expect(A.map(both, (resolved) => resolved.identity.scopeRef)).toEqual([scopeA, scopeB]);
    })
  );

  it.layer(fileServices, { timeout: "2 minutes" })("citation anchors", (it) => {
    it.effect("MatterWall 2 anchor resolution never yields a proof under pA for bytes bound to B", () =>
      Effect.gen(function* () {
        const fixtures = yield* committedCitationFixtures();
        const frozen = yield* makeCitationFrozenEditions(fixtures.bundle);
        const input = yield* prepareCallbackObservation(
          CitationCallbackObservation.make({
            name: "two-matter-anchor",
            kinds: ["case", "id"],
            pages: {},
            bindings: {},
            events: [],
            outcome: { status: "value", groups: [] },
          })
        );
        const sourceResolver = SourceTextResolver.of({
          resolve: Effect.fn("TwoMatterTest.anchorSource")(function* () {
            return ResolvedSourceText.make({
              identity: input.verifiedSource.source,
              text: input.verifiedSource.sourceText,
            });
          }),
        });
        const boundToB = MatterScope.make({
          matter: matterB,
          scopeRefs: HashSet.make(input.verifiedSource.source.scopeRef),
          familyKeys: HashSet.empty(),
          mailFolders: HashSet.empty(),
        });
        const request = {
          source: input.verifiedSource.source,
          sourceText: input.verifiedSource.sourceText,
          mentions: A.map(input.mentions, captureCitationMentionReceiptData),
        };
        const resolveAs = Effect.fn("TwoMatterTest.resolveAs")(function* (principal: LawPrincipalId) {
          const admission = yield* makeCitationOperationAdmission(input.limits);
          const stage = yield* ownCitationTestConfiguration(CitationEngineLimits, input.limits).pipe(
            Effect.flatMap((owned) => makeCitationSourceResolution(owned, input.engineArtifact)),
            Effect.zipWith(makeCitationTestScaffoldBinding(input.limits, "resolve"), (built, bind) => ({
              ...built,
              resolve: bind(built.resolve),
            })),
            Effect.provideService(CitationOperationAdmission, admission),
            Effect.provideService(CitationFrozenEditions, frozen),
            Effect.provideService(SourceTextResolver, sourceResolver),
            Effect.provideService(LawPrincipal, { principal }),
            provideMatterAuthority(wallConfig([boundToB]))
          );
          return yield* Effect.result(stage.resolve(request));
        });
        const underA = yield* resolveAs(principalA);
        const underAB = yield* resolveAs(principalAB);
        expect(underA).toMatchObject({
          _tag: "Failure",
          failure: { _tag: "CitationPrerequisiteError", operation: "resolve", dependency: "source-evidence" },
        });
        expect(underAB._tag).toBe("Success");
      })
    );
  });

  it.effect("MatterWall 5 cache lookup keeps each request's own scope for identical bytes under pAB", () =>
    Effect.gen(function* () {
      const resolver = yield* authorizedResolverFor(principalAB);
      const underA = yield* resolver.resolve(ResolveSourceTextRequest.make({ identity: officeActionIn(scopeA) }));
      const underB = yield* resolver.resolve(ResolveSourceTextRequest.make({ identity: officeActionIn(scopeB) }));
      expect([underA.identity.scopeRef, underB.identity.scopeRef]).toEqual([scopeA, scopeB]);
      expect(underA.text).toBe(underB.text);
    })
  );

  it.effect("MatterWall 6 draft assembly carries only a subject and a body", () =>
    Effect.gen(function* () {
      expect(R.keys(NoticeMessage.fields)).toEqual(["subject", "body"]);
      const encoded = yield* S.encodeEffect(NoticeMessage)(
        NoticeMessage.make({ subject: "Daily notice", body: "3 open" })
      );
      expect(R.keys(encoded)).toEqual(["subject", "body"]);
    })
  );

  it.layer(NodeCrypto.layer, { timeout: "1 minute" })("provenance through the composed server", (it) => {
    it.effect("MatterWall 7 provenance traversal omits B's capture under pA and returns it under pAB", () =>
      Effect.gen(function* () {
        const captureA = yield* mintCaptureId(officeActionIn(scopeA));
        const captureB = yield* mintCaptureId(officeActionIn(scopeB));
        const extract = recordUsing("a", [captureA, captureB]);
        const propose = recordUsing("b", [captureA]);
        const traverseAs = Effect.fn("TwoMatterTest.traverseAs")(function* (principal: LawPrincipalId) {
          const built = yield* Layer.build(serverFor(principal));
          const proposals = Context.get(built, LawClaimProposals);
          const claimA = yield* entryOf(scopeA, [extract, propose], [officeActionIn(scopeA), officeActionIn(scopeB)]);
          const claimB = yield* entryOf(scopeB, [recordUsing("c", [captureB])], [officeActionIn(scopeB)]);
          yield* proposals.appendProposed(claimA);
          yield* proposals.appendProposed(claimB);
          const traversal = Context.get(built, ProvenanceTraversal);
          const ofA = yield* traversal.fromClaim(claimA.record.claim);
          const ofB = yield* traversal.fromClaim(claimB.record.claim);
          return { ofA, ofB };
        });
        const summary = (result: ProvenanceResult) =>
          ProvenanceResult.match(result, {
            Found: ({ provenance }) =>
              O.some({
                activities: sortedIds(HashSet.map(provenance.activities, (record) => record.id)),
                captures: sortedIds(provenance.captures),
              }),
            Missing: () => O.none(),
          });
        const underA = yield* traverseAs(principalA);
        const underAB = yield* traverseAs(principalAB);
        assertSome(summary(underA.ofA), { activities: [propose.id], captures: [captureA] });
        expect(underA.ofB).toEqual(ProvenanceResult.cases.Missing.make({}));
        assertSome(summary(underAB.ofA), {
          activities: sortedIds([extract.id, propose.id]),
          captures: sortedIds([captureA, captureB]),
        });
        summary(underAB.ofB).pipe(O.isSome, assertTrue);
      })
    );
  });

  it.layer(Layer.merge(fileServices, bundlesLayer), { timeout: "3 minutes" })("the Practice KG bundle", (it) => {
    it.effect("builds both bundles on disk, each with its own claims store", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { withBeta, withoutBeta } = yield* TwoMatterBundles;
        const stores = yield* Effect.forEach(
          [withBeta, withoutBeta],
          (bundle) => Effect.flatMap(fs.realPath(path.join(bundle.bundleDir, "kg.pglite")), fs.exists),
          { concurrency: 1 }
        );
        expect(stores).toEqual([true, true]);
        expect(withBeta.bundleDir).not.toBe(withoutBeta.bundleDir);
      })
    );

    it.effect("MatterWall 3 graph query returns A's rows and A's own document node to pA, and no B row", () =>
      Effect.gen(function* () {
        const { withBeta } = yield* TwoMatterBundles;
        const underA = yield* graphReads().pipe(asPrincipal(withBeta, principalA));
        const underAB = yield* graphReads().pipe(asPrincipal(withBeta, principalAB));
        expect(underA.clients).toEqual([clients.a]);
        expect(underA.families).toEqual([`${clients.a}.${family}`]);
        expect(underA.matters).toEqual([`${clients.a}.${family}`]);
        expect(underA.provenance).toEqual([`${digests.shared}@${clients.a}.${family}US01`]);
        expect(underA.betaProvenance).toEqual([]);
        expect(underA.bundleStatusCounted).toEqual([false]);
        expect(A.some(underA.found, (key) => P.isString(key) && Str.includes(`${clients.b}.`)(key))).toBe(false);
        expect(underA.candidates).toEqual(["claim shared-a"]);
        expect(underA.found).not.toEqual([]);
        expect(underAB.clients).toEqual([clients.a, clients.b]);
        expect(underAB.provenance).toEqual([
          `${digests.shared}@${clients.a}.${family}US01`,
          `${digests.shared}@${clients.b}.${family}US02`,
        ]);
        expect(underAB.matters).toEqual([`${clients.a}.${family}`, `${clients.b}.${family}`]);
        expect(underAB.candidates).toEqual(["claim beta-only", "claim shared-a", "claim shared-b"]);
        expect(A.some(underAB.found, (key) => P.isString(key) && Str.includes(`${clients.b}.`)(key))).toBe(true);
      })
    );

    it.effect("MatterWall 4 search scores A's documents identically with and without B and hides B's mail", () =>
      Effect.gen(function* () {
        const { withBeta, withoutBeta } = yield* TwoMatterBundles;
        const withB = yield* searchReads().pipe(asPrincipal(withBeta, principalA));
        const withoutB = yield* searchReads().pipe(asPrincipal(withoutBeta, principalA));
        const everyone = yield* searchReads().pipe(asPrincipal(withBeta, principalAB));
        expect(withB.hits).toEqual(withoutB.hits);
        expect(A.dedupe(A.map(withB.hits, (hit) => hit[1]))).toEqual([`${family}US01`]);
        expect(withB.folders).toEqual(["Matters/A"]);
        expect(everyone.folders).toEqual(["Matters/A", "Matters/B"]);
        expect(withB.shared).toEqual([`${family}US01`]);
        expect(withB.betaOnly).toBe(0);
        expect(A.length(everyone.hits)).toBeGreaterThan(A.length(withB.hits));
      })
    );
  });
});

const roundTrips = Effect.fnUntraced(function* <A, I>(schema: S.Codec<A, I>, value: A) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeEffect(schema)(encoded);
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
});

describe("MatterWall draft notice schema-derived values", () => {
  it.effect.prop(
    "round-trips every generated NoticeMessage through its encoding",
    [Arbitrary.schema(NoticeMessage)],
    ([value]) => roundTrips(NoticeMessage, value),
    { arbitrary: fcRuns(25) }
  );
});
