// @vitest-environment node

import { SourceTextExtractor } from "@beep/provenance";
import { NonNegativeInt } from "@beep/schema";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, Layer, Path, Stream } from "effect";
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
import { proposeGold } from "@/canary/Gold";
import { CorpusManifest, CorpusPaperId } from "@/corpus/Manifest";
import { CorpusManifestBuilder } from "@/corpus/ManifestBuilder";
import { F1Catalog, F1Index } from "@/fixtures/F1";
import { GOLD_PROMPT_ARTIFACT_HASH } from "@/gold/Prompts";
import { CanonicalizerLive } from "@/layers/CanonicalizerLive";
import { ActiveModelIdentityLive, promptText } from "@/layers/LanguageModelLive";
import { LabConfig } from "@/runtime/Config";
import { sha256TextSync } from "@/schema/Digest";
import { Origin, SourceDocument } from "@/schema/Document";
import { GoldUnavailable } from "@/schema/Errors";
import { GoldFile, GoldRef } from "@/schema/Gold";
import { DocumentId, ProvenanceEventId } from "@/schema/Ids";
import { ModelIdentity } from "@/schema/Model";
import { ParseOutcome } from "@/schema/Text";
import { DocumentSource } from "@/services/DocumentSource";
import { Parser } from "@/services/Parser";
import { ProviderCache } from "@/services/ProviderCache";

const CorpusManifestJson = S.fromJsonString(CorpusManifest);
const F1IndexJson = S.fromJsonString(F1Index);
const GoldFileJson = S.fromJsonString(GoldFile);
const GoldRefJson = S.fromJsonString(GoldRef);

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const sourceText = "Café relates to Beta.";
const sourceBytes = new TextEncoder().encode(sourceText);
const sourceDigest = sha256TextSync(sourceText);
const proposer = ModelIdentity.make({
  artifactHash: GOLD_PROMPT_ARTIFACT_HASH,
  name: "stub-gold-2026-08-26",
  provider: "xai",
  revision: "stub-gold-2026-08-26",
  taskType: "gold-proposal",
});

const proposalForPrompt = (prompt: string): string => {
  if (Str.includes("\nSUBSET=entity\nSOURCE_TEXT_BEGIN")(prompt)) {
    return '{"labels":[{"endChar":4,"entityType":"concept","label":"Coffee concept","quote":"Café","startChar":0},{"endChar":20,"entityType":"concept","label":"Beta","quote":"Beta","startChar":16},{"endChar":4,"entityType":"fabricated","label":"Ghost","quote":"Ghost","startChar":0}]}';
  }
  if (Str.includes("\nSUBSET=relation\nSOURCE_TEXT_BEGIN")(prompt)) {
    return '{"labels":[{"endChar":20,"object":"Beta","predicate":"relates-to","quote":"Café relates to Beta","startChar":0,"subject":"Café"},{"endChar":20,"object":"Beta","predicate":"fabricated","quote":"Café relates to Beta","startChar":0,"subject":"Ghost"}]}';
  }
  return '{"labels":[{"depth":0,"endChar":4,"quote":"Café","role":"title","startChar":0}]}';
};

const makeGoldTestLayer = (manifest: CorpusManifest, fixtures: F1Index) => {
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
        Effect.succeed([
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
      lookup: Effect.fn("ProviderCache.lookup")(() => Effect.succeed(O.none())),
      store: Effect.fn("ProviderCache.store")(() => Effect.void),
    })
  );
  const config = Layer.succeed(
    LabConfig,
    LabConfig.of({
      corpusRoot: O.none(),
      goldModel: "stub-gold-2026-08-26",
      mode: "replay",
      offline: true,
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

            expect(result.total).toBe(6);
            expect(result.accepted).toBe(4);
            expect(result.fraction).toBe(4 / 6);
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
                .pipe(Effect.flatMap(S.decodeEffect(GoldFileJson)))
            );
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
            expect(result.total).toBe(31);
            expect(result.accepted).toBe(23);
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
            const staleFile = yield* fs.readFileString(stalePath).pipe(Effect.flatMap(S.decodeEffect(GoldFileJson)));
            const staleProposer = ModelIdentity.make({
              ...proposer,
              name: "stale-gold-20260825",
              revision: "stale-gold-20260825",
            });
            const staleValue = yield* S.decodeEffect(GoldFile)({ ...staleFile, proposer: staleProposer });
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
            runCanary(["gold", "propose", "--offline", "--paper", paperId, "--subset", "entity"]).pipe(Effect.flip)
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
