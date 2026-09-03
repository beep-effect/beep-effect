// @vitest-environment node

import { SourceTextExtractor } from "@beep/provenance";
import { NonNegativeInt, PosInt } from "@beep/schema";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Duration, Effect, FileSystem, Layer, Match, Number as N, Path, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Response from "effect/unstable/ai/Response";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { CanaryCommand } from "@/canary/Command";
import { GOLD_SUBSETS, GoldArtifactSemantics, proposeGold, resolveGoldQuoteAnchor } from "@/canary/Gold";
import { CorpusManifest, CorpusPaperId } from "@/corpus/Manifest";
import { CorpusManifestBuilder } from "@/corpus/ManifestBuilder";
import { F1Catalog, F1Index } from "@/fixtures/F1";
import { GOLD_PROMPT_ARTIFACT_HASH } from "@/gold/Prompts";
import { CanonicalizerLive } from "@/layers/CanonicalizerLive";
import { ActiveModelIdentityLive, promptText } from "@/layers/LanguageModelLive";
import { LabConfig } from "@/runtime/Config";
import { contentDigest, sha256TextSync } from "@/schema/Digest";
import { Origin, SourceDocument } from "@/schema/Document";
import { GoldUnavailable } from "@/schema/Errors";
import { CurrentGoldDocumentText, GoldFile, GoldFileEncoded, GoldRef } from "@/schema/Gold";
import { DocumentId, ProvenanceEventId } from "@/schema/Ids";
import { ModelIdentity } from "@/schema/Model";
import { ParseOutcome } from "@/schema/Text";
import { CanaryC0 } from "@/services/CanaryC0";
import { CanaryC1 } from "@/services/CanaryC1";
import { CanaryC2 } from "@/services/CanaryC2";
import { Chunker } from "@/services/Chunker";
import { DocumentSource } from "@/services/DocumentSource";
import { Parser } from "@/services/Parser";
import { ProviderCache } from "@/services/ProviderCache";

const CorpusManifestJson = S.fromJsonString(CorpusManifest);
const F1IndexJson = S.fromJsonString(F1Index);
const GoldFileJson = S.fromJsonString(GoldFile);
const GoldFileEncodedJson = S.fromJsonString(GoldFileEncoded);
const GoldRefJson = S.fromJsonString(GoldRef);

const goldLabelCount = (file: GoldFileEncoded): number =>
  Match.value(file).pipe(
    Match.when({ subset: "structure" }, (value) => A.length(value.labels)),
    Match.when({ subset: "entity" }, (value) => A.length(value.labels)),
    Match.when({ subset: "relation" }, (value) => A.length(value.labels)),
    Match.exhaustive
  );

const verifiedGoldLabelCount = (file: GoldFileEncoded): number =>
  Match.value(file).pipe(
    Match.when({ subset: "structure" }, (value) => A.length(A.filter(value.labels, (label) => label.verified))),
    Match.when({ subset: "entity" }, (value) => A.length(A.filter(value.labels, (label) => label.verified))),
    Match.when({ subset: "relation" }, (value) => A.length(A.filter(value.labels, (label) => label.verified))),
    Match.exhaustive
  );

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const unusedCanaryC0 = CanaryC0.of({
  run: Effect.fn("CanaryC0.unused")(() => Effect.die(new Error("C0 is not used by gold command tests."))),
  runWithSnapshot: Effect.fn("CanaryC0.unusedWithSnapshot")(() =>
    Effect.die(new Error("C0 is not used by gold command tests."))
  ),
});
const unusedCanaryC1 = CanaryC1.of({
  run: Effect.fn("CanaryC1.unused")(() => Effect.die(new Error("C1 is not used by gold command tests."))),
  runWithSnapshot: Effect.fn("CanaryC1.unusedWithSnapshot")(() =>
    Effect.die(new Error("C1 is not used by gold command tests."))
  ),
});
const unusedCanaryC2 = CanaryC2.of({
  run: Effect.fn("CanaryC2.unused")(() => Effect.die(new Error("C2 is not used by gold command tests."))),
});

const unusedChunker = Chunker.of({
  chunk: Effect.fn("Chunker.unused")(() => Effect.die(new Error("Chunker is not used by gold command tests."))),
});

const sourceText = "Café relates to Beta.";
const sourceBytes = new TextEncoder().encode(sourceText);
const sourceDigest = sha256TextSync(sourceText);
const proposer = ModelIdentity.make({
  artifactHash: GOLD_PROMPT_ARTIFACT_HASH,
  name: "stub-gold-20260826",
  provider: "xai",
  revision: "stub-gold-20260826",
  taskType: "gold-proposal",
});

const proposalForPrompt = (prompt: string): string => {
  if (Str.includes("\nSUBSET=entity\nSOURCE_TEXT_BEGIN")(prompt)) {
    return '{"labels":[{"cluster":"concept-cafe","endChar":4,"entityType":"concept","label":"Coffee concept","quote":"Café","startChar":0},{"cluster":"concept-beta","endChar":20,"entityType":"concept","label":"Beta","quote":"Beta","startChar":16},{"cluster":"fabricated-ghost","endChar":4,"entityType":"fabricated","label":"Ghost","quote":"Ghost","startChar":0}]}';
  }
  if (Str.includes("\nSUBSET=relation\nSOURCE_TEXT_BEGIN")(prompt)) {
    return '{"labels":[{"endChar":20,"object":"Beta","predicate":"relates-to","quote":"Café relates to Beta","startChar":0,"subject":"Café"},{"endChar":20,"object":"Beta","predicate":"fabricated","quote":"Café relates to Beta","startChar":0,"subject":"Ghost"}]}';
  }
  return '{"labels":[{"depth":0,"endChar":4,"quote":"Café","role":"title","startChar":0},{"depth":1,"endChar":9,"quote":"Beta","role":"section","startChar":2}]}';
};

const makeGoldTestLayer = (
  manifest: CorpusManifest,
  fixtures: F1Index,
  goldGenerationTimeout = Duration.minutes(45),
  stallGeneration = false
) => {
  const documentId = DocumentId.make(sourceDigest);
  const documentFor = (paperId: CorpusPaperId) =>
    SourceDocument.make({
      acquired: ProvenanceEventId.make(sourceDigest),
      bytes: NonNegativeInt.make(sourceBytes.byteLength),
      id: documentId,
      mediaType: "text/markdown",
      origin: Origin.cases.W1Paper.make({
        corpusId: manifest.corpusId,
        paperId,
        relativePath: `${paperId}.pdf`,
      }),
      sha256: sourceDigest,
    });
  const manifestBuilder = Layer.succeed(
    CorpusManifestBuilder,
    CorpusManifestBuilder.of({
      build: Effect.succeed(manifest),
      check: Effect.fn("CorpusManifestBuilder.check")(() => Effect.succeed(manifest)),
      load: Effect.fn("CorpusManifestBuilder.load")(() => Effect.succeed(manifest)),
    })
  );
  const fixtureCatalog = Layer.succeed(F1Catalog, F1Catalog.of({ load: Effect.succeed(fixtures) }));
  const documentSource = Layer.succeed(
    DocumentSource,
    DocumentSource.of({
      list: Effect.fn("DocumentSource.list")((selection) =>
        Effect.succeed(O.match(selection.paper, { onNone: () => [], onSome: (paperId) => [documentFor(paperId)] }))
      ),
      read: Effect.fn("DocumentSource.read")(() => Effect.succeed(sourceBytes)),
    })
  );
  const parser = Layer.succeed(
    Parser,
    Parser.of({
      parse: Effect.fn("Parser.parse")(() =>
        Effect.succeed(
          ParseOutcome.cases.Parsed.make({
            document: documentId,
            extractor: SourceTextExtractor.make({ name: "semantica-md", version: "0.0.0" }),
            text: sourceText,
          })
        )
      ),
    })
  );
  const languageModel = Layer.effect(
    LanguageModel.LanguageModel,
    LanguageModel.make({
      generateText: (options) =>
        stallGeneration
          ? Effect.never
          : Effect.succeed([
              Response.makePart("text", {
                text: proposalForPrompt(options.prompt.pipe(promptText)),
              }),
            ]),
      streamText: () => Stream.empty,
    })
  );
  const identity = ActiveModelIdentityLive(proposer);
  const providerCache = Layer.succeed(
    ProviderCache,
    ProviderCache.of({
      lookup: Effect.fn("ProviderCache.lookup")(() => Effect.succeedNone),
      store: Effect.fn("ProviderCache.store")(() => Effect.void),
    })
  );
  const config = Layer.succeed(
    LabConfig,
    LabConfig.of({
      corpusRoot: O.none(),
      embeddingDimension: PosInt.make(1536),
      embeddingModel: "text-embedding-3-small",
      embeddingRevision: "text-embedding-3-small@2024-01-25",
      extractionTimeout: Duration.minutes(15),
      extractorModel: "stub-extractor-20260826",
      goldDirectory: "fixtures/gold/v1",
      goldGenerationTimeout,
      goldModel: "stub-gold-20260826",
      ledgerRoot: ".beep/semantica/ledger",
      mode: "replay",
      offline: true,
      projectionTimeout: Duration.seconds(30),
      providerCacheDirectory: ".beep/semantica/provider-cache",
    })
  );
  const canonicalizer = CanonicalizerLive.pipe(Layer.provide(BunServices.layer));

  return Layer.mergeAll(
    BunServices.layer,
    canonicalizer,
    config,
    documentSource,
    fixtureCatalog,
    identity,
    languageModel,
    manifestBuilder,
    parser,
    providerCache
  );
};

describe("C0 gold proposer", () => {
  it("generates schema-valid corpus paper ids", () => {
    fc.assert(
      fc.property(S.toArbitrary(CorpusPaperId)(fc), (paperId) => S.is(CorpusPaperId)(paperId)),
      { numRuns: 20 }
    );
  });

  it("keeps the committed E6 annotation and refreeze receipt coherent", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const reference = yield* fs
            .readFileString("fixtures/gold/v1/gold.json")
            .pipe(Effect.flatMap(S.decodeEffect(GoldRefJson)));
          const files = A.sort(
            yield* Effect.forEach(
              GOLD_SUBSETS,
              (subset) =>
                Effect.forEach(reference.subsets[subset], (paperId) =>
                  fs
                    .readFileString(`fixtures/gold/v1/${paperId}.${subset}.json`)
                    .pipe(Effect.flatMap(S.decodeEffect(GoldFileEncodedJson)))
                ),
              { concurrency: 1 }
            ).pipe(Effect.map(A.flatten)),
            GoldArtifactSemantics.fileOrder
          );
          const verified = A.reduce(files, 0, (total, file) => N.sum(total, verifiedGoldLabelCount(file)));
          const total = A.reduce(files, 0, (count, file) => N.sum(count, goldLabelCount(file)));
          const digest = yield* contentDigest(S.Array(GoldFileEncoded))(files);
          const relationLabels = A.flatMap(files, (file) => (file.subset === "relation" ? file.labels : []));
          const abstractLabels = A.flatMap(files, (file) =>
            file.subset === "structure" ? A.filter(file.labels, (label) => label.role === "abstract") : []
          );

          expect(files).toHaveLength(18);
          expect([verified, total]).toEqual([21, 377]);
          expect(reference.digest).toBe(digest);
          expect(reference.spotCheckedFraction).toBe(N.divideUnsafe(verified, total));
          expect(A.every(relationLabels, (label) => label.verified)).toBe(true);
          expect(A.some(relationLabels, (label) => Str.Equivalence(label.predicate, "affiliated_with"))).toBe(false);
          expect(
            A.some(relationLabels, (label) => Str.Equivalence(label.predicate, "published in proceedings of"))
          ).toBe(false);
          expect(
            A.every(
              abstractLabels,
              (label) => label.verified && N.Equivalence(N.subtract(label.endChar, label.startChar), 8)
            )
          ).toBe(true);
        })
      )
    ));

  it("keeps an exact claimed anchor ahead of an earlier whitespace-folded occurrence", () => {
    expect(resolveGoldQuoteAnchor("Alpha   Beta Alpha Beta", "Alpha Beta", 13)).toEqual(O.some([13, 23, "Alpha Beta"]));
  });

  it("drops exact quote occurrences beyond the bounded drift window", () => {
    const text = A.join(["CT", Str.repeat(2_001)("x")], "");

    expect(resolveGoldQuoteAnchor(text, "CT", 2_002)).toEqual(O.none());
  });

  it("maps whitespace-folded matches back to exact document offsets and text", () => {
    expect(resolveGoldQuoteAnchor("prefix Evidence\n   across\tlines suffix", "Evidence across lines", 7)).toEqual(
      O.some([7, 31, "Evidence\n   across\tlines"])
    );
  });

  it("maps discretionary PDF hyphenation back to the exact document slice", () => {
    expect(resolveGoldQuoteAnchor("prefix classifi-\n  cation result", "classification result", 7)).toEqual(
      O.some([7, 32, "classifi-\n  cation result"])
    );
  });

  it("rejects a quote that folds to an empty string", () => {
    expect(resolveGoldQuoteAnchor("prefix suffix", "-\n", 0)).toEqual(O.none());
  });

  it("maps a gold-generation deadline to GoldUnavailable", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const manifest = yield* fs
              .readFileString("fixtures/w1.manifest.json")
              .pipe(Effect.flatMap(S.decodeEffect(CorpusManifestJson)));
            const fixtures = yield* fs
              .readFileString("fixtures/f1/index.json")
              .pipe(Effect.flatMap(S.decodeEffect(F1IndexJson)));
            const outputDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-gold-timeout-" });
            const error = yield* provideScopedLayer(makeGoldTestLayer(manifest, fixtures, Duration.zero, true))(
              proposeGold({
                manifestPath: "stub.manifest.json",
                outputDirectory,
                paper: O.some(A.getUnsafe(manifest.rows, 0).id),
                subset: O.none(),
              })
            ).pipe(Effect.flip);

            expect(error).toBeInstanceOf(GoldUnavailable);
            expect(error.reason).toBe("provider-failed");
            expect(error.message).toContain("generation timeout");
          })
        )
      )
    ));

  it("writes partial labels, drops invalid anchors and relation endpoints, and defers gold.json", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const manifest = yield* fs
              .readFileString("fixtures/w1.manifest.json")
              .pipe(Effect.flatMap(S.decodeEffect(CorpusManifestJson)));
            const fixtures = yield* fs
              .readFileString("fixtures/f1/index.json")
              .pipe(Effect.flatMap(S.decodeEffect(F1IndexJson)));
            const paperId = A.getUnsafe(manifest.rows, 0).id;
            const outputDirectory = yield* fs.makeTempDirectoryScoped({
              prefix: "semantica-gold-",
            });
            const result = yield* provideScopedLayer(makeGoldTestLayer(manifest, fixtures))(
              proposeGold({
                manifestPath: "stub.manifest.json",
                outputDirectory,
                paper: O.some(paperId),
                subset: O.none(),
              })
            );

            expect(result.total).toBe(7);
            expect(result.accepted).toBe(5);
            expect(result.fraction).toBe(5 / 7);
            expect(A.length(result.files)).toBe(3);
            expect(result.reference.status).toBe("not-written");
            if (result.reference.status === "not-written") {
              expect(result.reference.missingJobs).toHaveLength(15);
            }
            expect(
              A.every(result.files, (file) => {
                for (const label of file.labels) {
                  if (label.verified) {
                    return false;
                  }
                }
                return true;
              })
            ).toBe(true);

            const decodedFiles = yield* Effect.forEach(["structure", "entity", "relation"] as const, (subset) =>
              fs
                .readFileString(path.join(outputDirectory, `${paperId}.${subset}.json`))
                .pipe(
                  Effect.flatMap(S.decodeEffect(GoldFileJson)),
                  Effect.provideService(CurrentGoldDocumentText, sourceText)
                )
            );
            const structureFile = A.findFirst(decodedFiles, (file) => file.subset === "structure");
            expect(O.map(structureFile, (file) => A.length(file.labels))).toEqual(O.some(2));
            const reanchored = structureFile.pipe(
              O.flatMap((file) => A.findFirst(file.labels, (label) => label.quote === "Beta"))
            );
            expect(O.map(reanchored, (label) => [label.startChar, label.endChar])).toEqual(O.some([16, 20]));
            const entityFile = A.findFirst(decodedFiles, (file) => file.subset === "entity");
            expect(O.map(entityFile, (file) => A.length(file.labels))).toEqual(O.some(2));
            const relationFile = A.findFirst(decodedFiles, (file) => file.subset === "relation");
            expect(O.map(relationFile, (file) => A.length(file.labels))).toEqual(O.some(1));
            expect(yield* fs.exists(path.join(outputDirectory, "gold.json"))).toBe(false);
          })
        )
      )
    ));

  it("writes gold.json only after all eighteen stub jobs form one coherent proposer set", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const manifest = yield* fs
              .readFileString("fixtures/w1.manifest.json")
              .pipe(Effect.flatMap(S.decodeEffect(CorpusManifestJson)));
            const fixtures = yield* fs
              .readFileString("fixtures/f1/index.json")
              .pipe(Effect.flatMap(S.decodeEffect(F1IndexJson)));
            const outputDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-gold-complete-" });
            const result = yield* provideScopedLayer(makeGoldTestLayer(manifest, fixtures))(
              proposeGold({
                manifestPath: "stub.manifest.json",
                outputDirectory,
                paper: O.none(),
                subset: O.none(),
              })
            );

            expect(result.files).toHaveLength(18);
            expect(result.total).toBe(41);
            expect(result.accepted).toBe(33);
            expect(result.reference.status).toBe("written");
            const reference = yield* fs
              .readFileString(path.join(outputDirectory, "gold.json"))
              .pipe(Effect.flatMap(S.decodeEffect(GoldRefJson)));
            expect(reference.proposer).toEqual(proposer);
            expect(reference.spotCheckedFraction).toBe(0);
          })
        )
      )
    ));

  it("removes gold.json when a complete set is followed by a partial rerun", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const manifest = yield* fs
              .readFileString("fixtures/w1.manifest.json")
              .pipe(Effect.flatMap(S.decodeEffect(CorpusManifestJson)));
            const fixtures = yield* fs
              .readFileString("fixtures/f1/index.json")
              .pipe(Effect.flatMap(S.decodeEffect(F1IndexJson)));
            const outputDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-gold-rerun-" });
            const layer = makeGoldTestLayer(manifest, fixtures);
            yield* provideScopedLayer(layer)(
              proposeGold({
                manifestPath: "stub.manifest.json",
                outputDirectory,
                paper: O.none(),
                subset: O.none(),
              })
            );
            const referencePath = path.join(outputDirectory, "gold.json");
            expect(yield* fs.exists(referencePath)).toBe(true);

            const partial = yield* provideScopedLayer(layer)(
              proposeGold({
                manifestPath: "stub.manifest.json",
                outputDirectory,
                paper: O.some(A.getUnsafe(manifest.rows, 0).id),
                subset: O.none(),
              })
            );

            expect(partial.reference.status).toBe("not-written");
            expect(yield* fs.exists(referencePath)).toBe(false);
          })
        )
      )
    ));

  it("fails with mixed-proposer when one complete-set file is stale", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const manifest = yield* fs
              .readFileString("fixtures/w1.manifest.json")
              .pipe(Effect.flatMap(S.decodeEffect(CorpusManifestJson)));
            const fixtures = yield* fs
              .readFileString("fixtures/f1/index.json")
              .pipe(Effect.flatMap(S.decodeEffect(F1IndexJson)));
            const outputDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-gold-mixed-" });
            const layer = makeGoldTestLayer(manifest, fixtures);
            yield* provideScopedLayer(layer)(
              proposeGold({
                manifestPath: "stub.manifest.json",
                outputDirectory,
                paper: O.none(),
                subset: O.none(),
              })
            );

            const stalePaper = A.getUnsafe(manifest.rows, 9).id;
            const stalePath = path.join(outputDirectory, `${stalePaper}.structure.json`);
            const staleFile = yield* fs
              .readFileString(stalePath)
              .pipe(
                Effect.flatMap(S.decodeEffect(GoldFileJson)),
                Effect.provideService(CurrentGoldDocumentText, sourceText)
              );
            const staleProposer = ModelIdentity.make({
              ...proposer,
              name: "stale-gold-20260825",
              revision: "stale-gold-20260825",
            });
            const staleValue = yield* GoldFile.makeEffect({ ...staleFile, proposer: staleProposer });
            const staleJson = yield* S.encodeEffect(GoldFileJson)(staleValue);
            yield* fs.writeFileString(stalePath, `${staleJson}\n`);

            const selectedPaper = A.getUnsafe(manifest.rows, 0).id;
            const error = yield* provideScopedLayer(layer)(
              proposeGold({
                manifestPath: "stub.manifest.json",
                outputDirectory,
                paper: O.some(selectedPaper),
                subset: O.none(),
              })
            ).pipe(Effect.flip);

            expect(error).toBeInstanceOf(GoldUnavailable);
            expect(error.reason).toBe("mixed-proposer");
          })
        )
      )
    ));

  it("routes command options through Command.runWith and rejects paper plus subset", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const manifest = yield* fs
            .readFileString("fixtures/w1.manifest.json")
            .pipe(Effect.flatMap(S.decodeEffect(CorpusManifestJson)));
          const fixtures = yield* fs
            .readFileString("fixtures/f1/index.json")
            .pipe(Effect.flatMap(S.decodeEffect(F1IndexJson)));
          const paperId = A.getUnsafe(manifest.rows, 0).id;
          const runCanary = Command.runWith(CanaryCommand, {
            renderErrors: false,
            version: "0.0.0",
          });
          const error = yield* provideScopedLayer(makeGoldTestLayer(manifest, fixtures))(
            runCanary(["gold", "propose", "--offline", "--paper", paperId, "--subset", "entity"]).pipe(
              Effect.provideService(CanaryC0, unusedCanaryC0),
              Effect.provideService(CanaryC1, unusedCanaryC1),
              Effect.provideService(CanaryC2, unusedCanaryC2),
              Effect.provideService(Chunker, unusedChunker),
              Effect.flip
            )
          );

          expect(error).toBeInstanceOf(GoldUnavailable);
          if (error._tag === "GoldUnavailable") {
            expect(error.message).toBe("Choose either --paper or --subset, not both.");
            expect(error.reason).toBe("invalid-selection");
          }
        })
      )
    ));
});
