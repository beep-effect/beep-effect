// @vitest-environment node

import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, Layer, Path, Ref, Result, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Response from "effect/unstable/ai/Response";
import { describe, expect, it } from "vitest";
import { CorpusManifest } from "@/corpus/Manifest";
import { CorpusManifestBuilder } from "@/corpus/ManifestBuilder";
import { F1Catalog, F1Index } from "@/fixtures/F1";
import { CanaryC0WithGoldSourceLive } from "@/layers/CanaryC0Live";
import { CanonicalizerLive } from "@/layers/CanonicalizerLive";
import { ChunkerLive } from "@/layers/ChunkerLive";
import { ParserLive } from "@/layers/ParserLive";
import { ProviderCacheLive } from "@/layers/ProviderCacheLive";
import { LabConfig, RuntimeMode } from "@/runtime/Config";
import { FixtureDeclaration, Origin, SourceDocument } from "@/schema/Document";
import { DocumentUnavailable, GoldUnavailable } from "@/schema/Errors";
import { EvalReport } from "@/schema/Eval";
import { GoldFile, GoldRef, GoldSubset } from "@/schema/Gold";
import { DocumentId } from "@/schema/Ids";
import { ModelIdentity } from "@/schema/Model";
import { EventBody, makeProvenanceEventId } from "@/schema/Provenance";
import { EvalRunTelemetry } from "@/schema/Telemetry";
import { CanaryC0 } from "@/services/CanaryC0";
import { DocumentSource } from "@/services/DocumentSource";
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

  it("produces equal report digests and declared outcomes after a cache-writing live pass", () =>
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
            const sourceEntries = yield* Effect.forEach(
              fixtures.fixtures,
              Effect.fnUntraced(function* (fixture) {
                const bytes = yield* fs.readFile(path.join("fixtures/f1", fixture.relativePath));
                const id = DocumentId.make(fixture.sha256);
                const ingestedBody = EventBody.cases.Ingested.make({ document: id, kind: "Ingested" });
                const acquired = Result.getOrThrow(makeProvenanceEventId({ body: ingestedBody, prev: O.none() }));
                return {
                  bytes,
                  document: SourceDocument.make({
                    acquired,
                    bytes: NonNegativeInt.make(bytes.byteLength),
                    id,
                    mediaType: fixture.mediaType,
                    origin: Origin.cases.Fixture.make({
                      declared: FixtureDeclaration.make({
                        degradedKind: fixture.degradedKind,
                        expectation: fixture.expectation,
                      }),
                      fixtureId: fixture.id,
                      kind: "Fixture",
                      relativePath: fixture.relativePath,
                    }),
                    sha256: fixture.sha256,
                  }),
                };
              }),
              { concurrency: 1 }
            );
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
                extractorModel: "stub-extractor-20260826",
                goldDirectory,
                goldModel: "stub-gold-20260826",
                ledgerRoot,
                mode: "live",
                offline: false,
                providerCacheDirectory: cacheDirectory,
              })
            );
            const manifestBuilder = Layer.succeed(
              CorpusManifestBuilder,
              CorpusManifestBuilder.of({
                build: Effect.succeed(manifest),
                check: Effect.fn("CorpusManifestBuilder.stubCheck")(() => Effect.succeed(manifest)),
              })
            );
            const fixtureCatalog = Layer.succeed(F1Catalog, F1Catalog.of({ load: Effect.succeed(fixtures) }));
            const documentSource = Layer.succeed(
              DocumentSource,
              DocumentSource.of({
                list: Effect.fn("DocumentSource.stubList")(() =>
                  Effect.succeed(A.map(sourceEntries, (entry) => entry.document))
                ),
                read: Effect.fn("DocumentSource.stubRead")((document) =>
                  A.findFirst(sourceEntries, (entry) => Str.Equivalence(entry.document.id, document.id)).pipe(
                    O.map((entry) => entry.bytes),
                    Effect.fromOption,
                    Effect.mapError(() =>
                      DocumentUnavailable.make({ message: "The F1 slice source entry is unavailable." })
                    )
                  )
                ),
              })
            );
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
              });
              const callsAfterLive = yield* Ref.get(providerCalls);
              const replay = yield* service.run({
                manifest: "fixtures/w1.manifest.json",
                offline: true,
                out: O.some(replayOut),
                paper: O.none(),
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
              expect(live.reportDigest).toBe("946a4d8124af67982a528617e87258577d2570445c173b5f382b4b9681928f65");
              expect(writtenLive.reportDigest).toBe(writtenReplay.reportDigest);
              expect(writtenLive.reportDigest).toBe(live.reportDigest);
              expect(live.unexpectedDegraded).toBe(0);
              expect(replay.unexpectedDegraded).toBe(0);
              expect(live.documents).toHaveLength(fixtures.fixtures.length);
              expect(callsAfterLive).toBe(6);
              expect(callsAfterReplay).toBe(callsAfterLive);
              expect(liveTelemetry.mode).toBe("live");
              expect(replayTelemetry.mode).toBe("replay");
              for (const outcome of live.documents) {
                if (outcome.origin.kind === "Fixture") {
                  const expected = outcome.origin.declared;
                  expect(expected.expectation === "parses" ? "parsed" : O.getOrThrow(expected.degradedKind)).toBe(
                    outcome.parse
                  );
                }
              }

              const goldPath = path.join(goldDirectory, "gold.json");
              yield* fs.remove(goldPath);
              const missingGold = yield* service
                .run({
                  manifest: "fixtures/w1.manifest.json",
                  offline: true,
                  out: O.some(replayOut),
                  paper: O.none(),
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
