import { Git } from "@beep/git/Git";
import {
  CacheBaselineCommittedFile,
  CacheBaselinePackageSubject,
  CacheBaselineRequest,
  CacheCensusNode,
  CacheCensusReport,
  CacheCensusSource,
  CacheQualificationLive,
  CacheQualificationService,
  cacheBaselineSubjectOfPath,
  cacheBaselineSubjectPath,
  decodeCachePolicyBaselineFiles,
  encodeCachePolicyBaselineFiles,
  planCachePolicyBaselineReplacement,
  readCachePolicyBaselineFileTexts,
} from "@beep/repo-cli/commands/Cache";
import * as Census from "@beep/repo-cli/commands/Cache/Cache.census";
import {
  CacheEvidenceReference,
  CachePolicyBaseline,
  CachePolicyNode,
  CachePolicyProjection,
  CachePolicySource,
  CacheQualificationStore,
  CacheReviewDecision,
  CacheTaskConfiguration,
  cacheBaselineSubject,
} from "@beep/repo-configs/cache";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { afterEach, expect, it, vi } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Rec from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { writeCachePolicyBaselineFixture } from "./helpers/cache-baseline-files.ts";

// The single-file baseline as it stood on main 9d2ce0c0ea0 immediately before the
// one-shot split into standards/cache-baseline/. The blob is immutable history.
const MIGRATED_SINGLE_FILE_BLOB = "948cd07648d8043faddea22442f68af92f1b237f";

const platform = Layer.mergeAll(
  NodeCrypto.layer,
  NodeServices.layer,
  Git.layerTest(),
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer))
);
const sameBaseline = S.toEquivalence(CachePolicyBaseline);
const sameReview = S.toEquivalence(CacheReviewDecision);
const sameNodes = S.toEquivalence(S.Array(CachePolicyNode));
const decodeSingleFile = S.decodeUnknownEffect(S.fromJsonString(CachePolicyBaseline));
const encodeStore = S.encodeEffect(S.fromJsonString(CacheQualificationStore));
const encodeRequest = S.encodeEffect(S.fromJsonString(CacheBaselineRequest));
const hashText = (text: string) => S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text));

const digest = (seed: number) => Sha256Hex.make(Str.padStart(64, "0")(seed.toString(16)));
const configuration = CacheTaskConfiguration.make({
  cache: true,
  inputs: ["src/**"],
  env: [],
  passThroughEnv: [],
  outputs: [],
  dependsOn: [],
  persistent: false,
  interactive: false,
  interruptible: false,
  outputLogs: "full",
});
const policyNode = (computation: string, seed: number) =>
  CachePolicyNode.make({
    computation,
    command: `run ${computation}`,
    commandDigest: digest(seed),
    dependencies: [],
    configuration,
  });
const fixtureReview = (reviewer: string) =>
  CacheReviewDecision.make({
    reviewer,
    reason: `${reviewer} review`,
    basis: CacheEvidenceReference.make({ path: `${reviewer}.md`, sha256: digest(7) }),
  });
const fixtureBaseline = (nodes: ReadonlyArray<CachePolicyNode>) =>
  CachePolicyBaseline.make({
    profile: "fixture-profile",
    epoch: "v1",
    scope: ["@beep/alpha#lint"],
    reviews: Rec.fromEntries(
      A.map(
        A.dedupe(
          A.prepend(
            A.map(nodes, (node) => cacheBaselineSubject(node.computation)),
            "//"
          )
        ),
        (subject) => [subject, fixtureReview("main")]
      )
    ),
    projection: CachePolicyProjection.make({
      globalConfiguration: { ui: "tui" },
      nodes,
      sources: [CachePolicySource.make({ path: "turbo.json", sha256: digest(1) })],
    }),
  });
const threeSubjects = fixtureBaseline([
  policyNode("//#lint:policy", 10),
  policyNode("@beep/alpha#lint", 11),
  policyNode("@beep/beta#lint", 12),
]);

const committedFiles = Effect.fn("CacheBaselineFilesTest.committedFiles")(function* (baseline: CachePolicyBaseline) {
  const files = yield* encodeCachePolicyBaselineFiles(baseline);
  return yield* Effect.forEach(files, (file) =>
    hashText(file.text).pipe(Effect.map((sha256) => CacheBaselineCommittedFile.make({ ...file, sha256 })))
  );
});

const shaOf = (files: ReadonlyArray<CacheBaselineCommittedFile>, subject: string) =>
  O.getOrThrow(A.findFirst(files, (file) => file.subject === subject)).sha256;

afterEach(() => {
  vi.restoreAllMocks();
});

it.layer(platform, { timeout: "60 seconds" })("cache baseline per-subject files", (it) => {
  it.effect.prop(
    "every package subject's path names that subject and no other",
    [CacheBaselinePackageSubject],
    ([subject]) =>
      Effect.sync(() => {
        assertSome(cacheBaselineSubjectOfPath(cacheBaselineSubjectPath(subject)), subject);
        expect(cacheBaselineSubjectPath(subject)).not.toBe(cacheBaselineSubjectPath("//"));
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect("the split reads back, subject for subject, to the migrated single-file baseline", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const text = yield* spawner.string(ChildProcess.make("git", ["cat-file", "blob", MIGRATED_SINGLE_FILE_BLOB]));
      const single = yield* decodeSingleFile(text);
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-baseline-migration-" });
      const written = yield* writeCachePolicyBaselineFixture(root, single);
      expect(A.length(written)).toBe(Rec.size(single.reviews));
      const texts = yield* readCachePolicyBaselineFileTexts(root).pipe(Effect.map(O.getOrThrow));
      const split = yield* decodeCachePolicyBaselineFiles(texts);
      expect(sameBaseline(split, single)).toBe(true);
      expect(Rec.keys(split.reviews)).toStrictEqual(Rec.keys(single.reviews));
      for (const [subject, review] of Rec.toEntries(single.reviews)) {
        expect(sameReview(O.getOrThrow(Rec.get(split.reviews, subject)), review)).toBe(true);
        const nodesOf = (baseline: CachePolicyBaseline) =>
          A.filter(baseline.projection.nodes, (node) => cacheBaselineSubject(node.computation) === subject);
        expect(sameNodes(nodesOf(split), nodesOf(single))).toBe(true);
      }
      expect(split.projection.sources).toStrictEqual(single.projection.sources);
      expect(split.projection.globalConfiguration).toStrictEqual(single.projection.globalConfiguration);
    })
  );

  it.effect("places each subject at one path and refuses misplaced, foreign, duplicate and rootless files", () =>
    Effect.gen(function* () {
      expect(cacheBaselineSubjectPath("//")).toBe("standards/cache-baseline/_root.json");
      expect(cacheBaselineSubjectPath("@beep/alpha")).toBe("standards/cache-baseline/@beep/alpha.json");
      assertSome(cacheBaselineSubjectOfPath("standards/cache-baseline/_root.json"), "//");
      assertSome(cacheBaselineSubjectOfPath("standards/cache-baseline/@beep/alpha.json"), "@beep/alpha");
      assertNone(cacheBaselineSubjectOfPath("standards/cache-baseline/../alpha.json"));
      assertNone(cacheBaselineSubjectOfPath("standards/cache-baseline/_root/x.json"));
      assertNone(cacheBaselineSubjectOfPath("standards/other/@beep/alpha.json"));

      const files = yield* encodeCachePolicyBaselineFiles(threeSubjects);
      expect(A.map(files, (file) => file.path)).toStrictEqual([
        "standards/cache-baseline/@beep/alpha.json",
        "standards/cache-baseline/@beep/beta.json",
        "standards/cache-baseline/_root.json",
      ]);
      const back = yield* decodeCachePolicyBaselineFiles(A.reverse(files));
      expect(sameBaseline(back, threeSubjects)).toBe(true);

      const fileOf = (subject: string) => O.getOrThrow(A.findFirst(files, (file) => file.subject === subject));
      const alpha = fileOf("@beep/alpha");
      const beta = fileOf("@beep/beta");
      const root = fileOf("//");
      const misplaced = yield* decodeCachePolicyBaselineFiles([{ ...alpha, path: beta.path }, root]).pipe(Effect.flip);
      expect(misplaced.message).toContain("belongs at standards/cache-baseline/@beep/alpha.json");
      const foreign = yield* decodeCachePolicyBaselineFiles([
        { path: alpha.path, text: Str.replace("@beep/alpha#lint", "@beep/beta#lint")(alpha.text) },
        root,
      ]).pipe(Effect.flip);
      expect(foreign.message).toContain("another subject's file: @beep/beta#lint");
      const rootless = yield* decodeCachePolicyBaselineFiles([alpha, beta]).pipe(Effect.flip);
      expect(rootless.message).toContain("root subject file is missing");
      const duplicate = yield* decodeCachePolicyBaselineFiles([alpha, alpha, root]).pipe(Effect.flip);
      expect(duplicate.message).toContain("more than one file: @beep/alpha");
    })
  );

  it.effect("reads only JSON subject files and fails closed on anything else in the directory", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-baseline-read-" });
      const absent = yield* readCachePolicyBaselineFileTexts(root);
      assertNone(absent);
      yield* writeCachePolicyBaselineFixture(root, threeSubjects);
      const texts = yield* readCachePolicyBaselineFileTexts(root).pipe(Effect.map(O.getOrThrow));
      expect(A.map(texts, (file) => file.path)).toStrictEqual([
        "standards/cache-baseline/@beep/alpha.json",
        "standards/cache-baseline/@beep/beta.json",
        "standards/cache-baseline/_root.json",
      ]);
      yield* fs.writeFileString(path.join(root, "standards/cache-baseline/notes.md"), "stray\n");
      const stray = yield* readCachePolicyBaselineFileTexts(root).pipe(Effect.flip);
      expect(stray.message).toContain("Unexpected file in the baseline directory: standards/cache-baseline/notes.md");
    })
  );

  it.effect("scopes previous to the subject files a re-record replaces", () =>
    Effect.gen(function* () {
      const committed = yield* committedFiles(threeSubjects);
      const alphaChanged = fixtureBaseline([
        policyNode("//#lint:policy", 10),
        policyNode("@beep/alpha#lint", 21),
        policyNode("@beep/beta#lint", 12),
      ]);
      const next = yield* encodeCachePolicyBaselineFiles(alphaChanged);
      const alphaSha = shaOf(committed, "@beep/alpha");

      const plan = yield* planCachePolicyBaselineReplacement(committed, next, { "@beep/alpha": alphaSha });
      expect(A.map(plan.writes, (file) => file.subject)).toStrictEqual(["@beep/alpha"]);
      expect(plan.deletes).toStrictEqual([]);

      // Another PR re-recorded beta first: only beta's file changed, so alpha's previous stays valid.
      const betaMerged = yield* committedFiles(
        fixtureBaseline([
          policyNode("//#lint:policy", 10),
          policyNode("@beep/alpha#lint", 11),
          policyNode("@beep/beta#lint", 32),
        ])
      );
      expect(shaOf(betaMerged, "@beep/alpha")).toBe(alphaSha);
      expect(shaOf(betaMerged, "@beep/beta")).not.toBe(shaOf(committed, "@beep/beta"));
      // The writer re-derives the projection from the merged checkout, so beta carries main's bytes.
      const mergedNext = yield* encodeCachePolicyBaselineFiles(
        fixtureBaseline([
          policyNode("//#lint:policy", 10),
          policyNode("@beep/alpha#lint", 21),
          policyNode("@beep/beta#lint", 32),
        ])
      );
      const afterMerge = yield* planCachePolicyBaselineReplacement(betaMerged, mergedNext, { "@beep/alpha": alphaSha });
      expect(A.map(afterMerge.writes, (file) => file.subject)).toStrictEqual(["@beep/alpha"]);

      const missing = yield* planCachePolicyBaselineReplacement(committed, next, {}).pipe(Effect.flip);
      expect(missing.message).toContain("missing from previous: @beep/alpha");
      expect(missing.message).toContain(`{"@beep/alpha":"${alphaSha}"}`);
      const stale = yield* planCachePolicyBaselineReplacement(committed, next, { "@beep/alpha": digest(99) }).pipe(
        Effect.flip
      );
      expect(stale.message).toContain("missing from previous: @beep/alpha");
      const staleOther = yield* planCachePolicyBaselineReplacement(committed, next, {
        "@beep/alpha": alphaSha,
        "@beep/beta": digest(99),
      }).pipe(Effect.flip);
      expect(staleOther.message).toContain("missing from previous: @beep/beta");

      const dropped = yield* encodeCachePolicyBaselineFiles(
        fixtureBaseline([policyNode("//#lint:policy", 10), policyNode("@beep/alpha#lint", 11)])
      );
      const deletion = yield* planCachePolicyBaselineReplacement(committed, dropped, {
        "@beep/beta": shaOf(committed, "@beep/beta"),
      });
      expect(A.map(deletion.deletes, (file) => file.path)).toStrictEqual(["standards/cache-baseline/@beep/beta.json"]);
      expect(deletion.writes).toStrictEqual([]);

      const added = yield* encodeCachePolicyBaselineFiles(
        fixtureBaseline([...threeSubjects.projection.nodes, policyNode("@beep/gamma#lint", 13)])
      );
      const addition = yield* planCachePolicyBaselineReplacement(committed, added, {});
      expect(A.map(addition.writes, (file) => file.subject)).toStrictEqual(["@beep/gamma"]);
    })
  );
});

const census = (alpha: number, beta: number) =>
  CacheCensusReport.make({
    revision: "fixture",
    turboVersion: "2.0.0",
    rootScripts: {},
    globalConfiguration: { ui: "tui" },
    workspaces: [],
    nodes: A.map(
      [
        ["//#lint:policy", 10],
        ["@beep/alpha#lint", alpha],
        ["@beep/beta#lint", beta],
      ] as const,
      ([id, seed]) =>
        CacheCensusNode.make({
          id,
          workspace: cacheBaselineSubject(id),
          task: "lint",
          command: O.some(`run ${id}`),
          commandDigest: digest(seed),
          dependencies: [],
          configuration,
          inputCount: S.Natural.make(1),
          inputsDigest: digest(seed),
        })
    ),
    sources: [CacheCensusSource.make({ path: "turbo.json", sha256: digest(1) })],
    entrypointSources: [],
    unresolved: [],
  });

it.layer(CacheQualificationLive.pipe(Layer.provideMerge(platform)), { timeout: "60 seconds" })(
  "cache baseline writer",
  (it) => {
    it.effect("keeps a request valid across a merge that re-recorded another subject", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const cache = yield* CacheQualificationService;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-baseline-writer-" });
        const basis = "Reviewed synthetic baseline.\n";
        yield* fs.writeFileString(path.join(root, "review.md"), basis);
        const basisSha = yield* hashText(basis);
        const review = CacheReviewDecision.make({
          reviewer: "fixture",
          reason: "synthetic re-record",
          basis: CacheEvidenceReference.make({ path: "review.md", sha256: basisSha }),
        });
        yield* fs.makeDirectory(path.join(root, "standards"));
        const store = yield* encodeStore(
          CacheQualificationStore.make({ revision: S.Natural.make(0), entries: [], history: [] })
        );
        yield* fs.writeFileString(path.join(root, "standards/cache-qualification.json"), store);
        const request = (subjects: ReadonlyArray<string>, previous: Record<string, Sha256Hex>) =>
          CacheBaselineRequest.make({
            review,
            scope: ["@beep/alpha#lint"],
            profile: "fixture-profile",
            epoch: "v1",
            subjects: O.some(subjects),
            previous,
          });
        const record = (
          alpha: number,
          beta: number,
          subjects: ReadonlyArray<string>,
          previous: Record<string, Sha256Hex>
        ) => {
          vi.spyOn(Census, "collectCacheCensus").mockReturnValue(Effect.succeed(census(alpha, beta)));
          return cache.baseline(root, request(subjects, previous));
        };
        const fileText = (subject: string) => fs.readFileString(path.join(root, cacheBaselineSubjectPath(subject)));
        const fileSha = (subject: string) => fileText(subject).pipe(Effect.flatMap(hashText));

        const first = yield* record(11, 12, ["//", "@beep/alpha", "@beep/beta"], {});
        expect(first.stamped).toStrictEqual(["//", "@beep/alpha", "@beep/beta"]);
        const alphaSha = yield* fileSha("@beep/alpha");
        const betaSha = yield* fileSha("@beep/beta");
        const rootText = yield* fileText("//");

        // The alpha PR prepares its request against the first record.
        const alphaRequest = { "@beep/alpha": alphaSha };
        // The beta PR merges first and rewrites only beta's file.
        const beta = yield* record(11, 32, ["@beep/beta"], { "@beep/beta": betaSha });
        expect(beta.stamped).toStrictEqual(["@beep/beta"]);
        const alphaAfterBeta = yield* fileSha("@beep/alpha");
        const rootAfterBeta = yield* fileText("//");
        expect(alphaAfterBeta).toBe(alphaSha);
        expect(rootAfterBeta).toBe(rootText);

        // After merging main, the alpha PR's unchanged request still applies.
        const alpha = yield* record(21, 32, ["@beep/alpha"], alphaRequest);
        expect(alpha.stamped).toStrictEqual(["@beep/alpha"]);
        const rootAfterAlpha = yield* fileText("//");
        expect(rootAfterAlpha).toBe(rootText);

        // Replaying it now names a digest alpha's file no longer has.
        const before = yield* fileText("@beep/alpha");
        const replay = yield* record(41, 32, ["@beep/alpha"], alphaRequest).pipe(Effect.flip);
        expect(replay.message).toContain("missing from previous: @beep/alpha");
        const after = yield* fileText("@beep/alpha");
        const locked = yield* fs.exists(path.join(root, ".beep/cache/qualification.writer"));
        expect(after).toBe(before);
        expect(locked).toBe(false);

        const text = yield* encodeRequest(request(["@beep/alpha"], alphaRequest));
        expect(text).toContain(`"previous":{"@beep/alpha":"${alphaSha}"}`);
      })
    );
  }
);
