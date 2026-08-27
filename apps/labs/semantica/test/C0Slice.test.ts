// @vitest-environment node

import { Sha256Hex } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Duration, Effect, FileSystem, Layer, Path, Ref, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Response from "effect/unstable/ai/Response";
import { describe, expect, it } from "vitest";
import { CorpusManifest } from "@/corpus/Manifest";
import { CorpusManifestBuilderLive } from "@/corpus/ManifestBuilder";
import { F1CatalogLive, F1Index } from "@/fixtures/F1";
import { CanaryC0WithGoldSourceLive } from "@/layers/CanaryC0Live";
import { CanonicalizerLive } from "@/layers/CanonicalizerLive";
import { ChunkerLive } from "@/layers/ChunkerLive";
import { DocumentSourceLive } from "@/layers/DocumentSourceLive";
import { ParserLive } from "@/layers/ParserLive";
import { ProviderCacheLive } from "@/layers/ProviderCacheLive";
import { LabConfig, RuntimeMode } from "@/runtime/Config";
import { GoldUnavailable, ReportInvalid } from "@/schema/Errors";
import { EvalReport } from "@/schema/Eval";
import { GoldFile, GoldRef, GoldSubset } from "@/schema/Gold";
import { ModelIdentity } from "@/schema/Model";
import { EvalRunTelemetry } from "@/schema/Telemetry";
import { CanaryC0 } from "@/services/CanaryC0";
import { GoldSource } from "@/services/GoldSource";

const ManifestJson = S.fromJsonString(CorpusManifest);
const F1IndexJson = S.fromJsonString(F1Index);
const GoldRefJson = S.fromJsonString(GoldRef, { space: 2 });
const EvalReportJson = S.fromJsonString(EvalReport);
const EvalTelemetryJson = S.fromJsonString(EvalRunTelemetry);

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("C0 F1 live-to-replay slice", () => {
  it("derives execution-mode values from the runtime schema", () => {
    fc.assert(fc.property(S.toArbitrary(RuntimeMode)(fc), (mode) => S.is(RuntimeMode)(mode)));
  });

  it("runs real F1-only sources without a corpus root and replays to an equal report digest", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const temp = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-c0-slice-" });
            const goldDirectory = path.join(temp, "gold");
            const cacheDirectory = path.join(temp, "provider-cache");
            const ledgerRoot = path.join(temp, "ledger");
            const liveOut = path.join(temp, "live-out");
            const replayOut = path.join(temp, "replay-out");
            const manifest = yield* fs
              .readFileString("fixtures/w1.manifest.json")
              .pipe(Effect.flatMap(S.decodeEffect(ManifestJson)));
            const fixtures = yield* fs
              .readFileString("fixtures/f1/index.json")
              .pipe(Effect.flatMap(S.decodeEffect(F1IndexJson)));
            const goldIds = A.map(A.take(manifest.rows, 10), (row) => row.id);
            const proposer = ModelIdentity.make({
              artifactHash: Sha256Hex.make("8".repeat(64)),
              name: "stub-gold-20260826",
              provider: "xai",
              revision: "stub-gold-20260826",
              taskType: "gold-proposal",
            });
            const gold = GoldRef.make({
              digest: Sha256Hex.make("9".repeat(64)),
              proposer,
              spotCheckedFraction: UnitInterval.make(0),
              subsets: GoldSubset.make({
                entity: A.take(goldIds, 5),
                relation: A.take(goldIds, 3),
                structure: goldIds,
              }),
              version: "gold/v1",
            });
            const goldPaper = A.getUnsafe(goldIds, 0);
            const goldFiles = [
              GoldFile.make({ labels: [], paperId: goldPaper, proposer, subset: "structure", version: "gold/v1" }),
              GoldFile.make({ labels: [], paperId: goldPaper, proposer, subset: "entity", version: "gold/v1" }),
              GoldFile.make({ labels: [], paperId: goldPaper, proposer, subset: "relation", version: "gold/v1" }),
            ];
            yield* fs.makeDirectory(goldDirectory, { recursive: true });
            yield* fs.writeFileString(
              path.join(goldDirectory, "gold.json"),
              `${yield* S.encodeEffect(GoldRefJson)(gold)}\n`
            );

            const config = Layer.succeed(
              LabConfig,
              LabConfig.of({
                corpusRoot: O.none(),
                extractionTimeout: Duration.minutes(15),
                extractorModel: "stub-extractor-20260826",
                goldDirectory,
                goldGenerationTimeout: Duration.minutes(45),
                goldModel: "stub-gold-20260826",
                ledgerRoot,
                mode: "live",
                offline: false,
                providerCacheDirectory: cacheDirectory,
              })
            );
            const manifestBuilder = CorpusManifestBuilderLive.pipe(
              Layer.provide(config),
              Layer.provide(BunServices.layer)
            );
            const fixtureCatalog = F1CatalogLive.pipe(Layer.provide(BunServices.layer));
            const documentSource = DocumentSourceLive.pipe(Layer.provide(config), Layer.provide(BunServices.layer));
            const canonicalizer = CanonicalizerLive.pipe(Layer.provide(BunServices.layer));
            const chunker = ChunkerLive.pipe(Layer.provide(canonicalizer), Layer.provide(BunServices.layer));
            const providerCache = ProviderCacheLive.pipe(Layer.provide(config), Layer.provide(BunServices.layer));
            const providerCalls = yield* Ref.make(0);
            const hostedProvider = Layer.effect(
              LanguageModel.LanguageModel,
              LanguageModel.make({
                generateText: () =>
                  Ref.update(providerCalls, (count) => count + 1).pipe(
                    Effect.as([Response.makePart("text", { text: '{"extractions":[]}' })])
                  ),
                streamText: () => Stream.empty,
              })
            );
            const goldSourceLayer = (_directory: string) =>
              Layer.succeed(
                GoldSource,
                GoldSource.of({ load: Effect.fn("GoldSource.slice")(() => Effect.succeed(goldFiles)) })
              );
            const dependencies = Layer.mergeAll(
              BunServices.layer,
              canonicalizer,
              chunker,
              config,
              documentSource,
              fixtureCatalog,
              manifestBuilder,
              ParserLive,
              providerCache
            );
            const canary = CanaryC0WithGoldSourceLive({ goldSourceLayer, hostedProvider }).pipe(
              Layer.provide(dependencies)
            );
            const runtime = Layer.merge(dependencies, canary);

            yield* Effect.gen(function* () {
              const service = yield* CanaryC0;
              const live = yield* service.run({
                manifest: "fixtures/w1.manifest.json",
                offline: false,
                out: O.some(liveOut),
                paper: O.none(),
                selection: "f1",
              });
              const callsAfterLive = yield* Ref.get(providerCalls);
              const replay = yield* service.run({
                manifest: "fixtures/w1.manifest.json",
                offline: true,
                out: O.some(replayOut),
                paper: O.none(),
                selection: "f1",
              });
              const callsAfterReplay = yield* Ref.get(providerCalls);
              const writtenLive = yield* fs
                .readFileString(path.join(liveOut, "eval-report.json"))
                .pipe(Effect.flatMap(S.decodeEffect(EvalReportJson)));
              const writtenReplay = yield* fs
                .readFileString(path.join(replayOut, "eval-report.json"))
                .pipe(Effect.flatMap(S.decodeEffect(EvalReportJson)));
              const liveTelemetry = yield* fs
                .readFileString(path.join(liveOut, "eval-telemetry.json"))
                .pipe(Effect.flatMap(S.decodeEffect(EvalTelemetryJson)));
              const replayTelemetry = yield* fs
                .readFileString(path.join(replayOut, "eval-telemetry.json"))
                .pipe(Effect.flatMap(S.decodeEffect(EvalTelemetryJson)));

              expect(live.reportDigest).toBe(replay.reportDigest);
              expect(live.reportDigest).toBe("8c6a73fe8d37f45328ee438b5a59365bc5884180b944c8f9e2f2034827cd762c");
              expect(writtenLive.reportDigest).toBe(writtenReplay.reportDigest);
              expect(writtenLive.reportDigest).toBe(live.reportDigest);
              expect(live.unexpectedDegraded).toBe(0);
              expect(replay.unexpectedDegraded).toBe(0);
              expect(live.documents).toHaveLength(fixtures.fixtures.length);
              expect(callsAfterLive).toBe(6);
              expect(callsAfterReplay).toBe(callsAfterLive);
              expect(liveTelemetry.mode).toBe("live");
              expect(replayTelemetry.mode).toBe("replay");
              expect(liveTelemetry.dependencyBytes).toEqual(O.none());
              expect(liveTelemetry.modelBytes).toEqual(O.none());
              for (const outcome of live.documents) {
                if (outcome.origin.kind === "Fixture") {
                  const expected = outcome.origin.declared;
                  expect(expected.expectation === "parses" ? "parsed" : O.getOrThrow(expected.degradedKind)).toBe(
                    outcome.parse
                  );
                }
              }

              yield* fs.remove(cacheDirectory, { force: true, recursive: true });
              const replayAfterCacheRemoval = yield* service
                .run({
                  manifest: "fixtures/w1.manifest.json",
                  offline: true,
                  out: O.some(replayOut),
                  paper: O.none(),
                  selection: "f1",
                })
                .pipe(Effect.flip);
              expect(replayAfterCacheRemoval).toBeInstanceOf(ReportInvalid);

              const goldPath = path.join(goldDirectory, "gold.json");
              yield* fs.remove(goldPath);
              const missingGold = yield* service
                .run({
                  manifest: "fixtures/w1.manifest.json",
                  offline: true,
                  out: O.some(replayOut),
                  paper: O.none(),
                  selection: "f1",
                })
                .pipe(Effect.flip);
              expect(missingGold).toBeInstanceOf(GoldUnavailable);
              expect(missingGold.message).toContain(goldPath);
            }).pipe(provideScopedLayer(runtime));
          })
        )
      )
    ));
});
