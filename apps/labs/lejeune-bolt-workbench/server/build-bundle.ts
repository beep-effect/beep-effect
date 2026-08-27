/**
 * Build the replay bundle into caller-owned machine-local storage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Config, Effect, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  GoldenReplayReceiptFromJsonString,
  ImmutableDemoBundleFromJsonString,
  MutableReviewLedgerFromJsonString,
  ProviderRecordingFromJsonString,
} from "@/domain/Bundle";
import { makeProjectionLayer } from "@/domain/Projections";
import { replayOffline } from "@/domain/Replay";
import { buildFixtureArtifacts, FixtureError } from "@/fixtures/Sources";

const RECORDING_PATH = "src/fixtures/provider-recording.json";

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const bundleRoot = yield* Config.nonEmptyString("LEJEUNE_BUNDLE_ROOT").pipe(
    Config.withDefault(".beep/lejeune-demo-bundle")
  );
  const mutableRoot = yield* Config.nonEmptyString("LEJEUNE_MUTABLE_ROOT").pipe(
    Config.withDefault(".beep/lejeune-demo-review")
  );
  const resolvedBundleRoot = path.resolve(bundleRoot);
  const resolvedMutableRoot = path.resolve(mutableRoot);
  if (Str.Equivalence(resolvedBundleRoot, resolvedMutableRoot)) {
    return yield* FixtureError.make({
      stage: "bundle-boundary",
      message: "Immutable bundle and mutable review roots must be different directories.",
    });
  }
  const bundleRootExists = yield* fs.exists(resolvedBundleRoot);
  if (bundleRootExists) {
    return yield* FixtureError.make({
      stage: "bundle-boundary",
      message: `Bundle root already exists: ${resolvedBundleRoot}. Select a new empty machine-local path.`,
    });
  }
  const recordingText = yield* fs.readFileString(path.resolve(RECORDING_PATH)).pipe(
    Effect.mapError(() =>
      FixtureError.make({
        stage: "provider-recording",
        message: "No sanitized successful provider recording is available; run provider:smoke first.",
      })
    )
  );
  const recording = yield* S.decodeEffect(ProviderRecordingFromJsonString)(recordingText).pipe(
    Effect.mapError(() =>
      FixtureError.make({ stage: "provider-recording", message: "The sanitized provider recording is invalid." })
    )
  );
  yield* fs.makeDirectory(resolvedBundleRoot, { recursive: true });
  yield* fs.makeDirectory(resolvedMutableRoot, { recursive: true });
  const pgliteDataDir = path.join(resolvedBundleRoot, "app-review.pglite");
  const duckDbPath = path.join(resolvedBundleRoot, "corpus.duckdb");
  const replay = yield* Layer.build(makeProjectionLayer({ duckDbPath, pgliteDataDir })).pipe(
    Effect.flatMap((context) => replayOffline(recording).pipe(Effect.provide(context))),
    Effect.scoped
  );
  const artifacts = yield* buildFixtureArtifacts;
  const fixtureRoot = path.join(resolvedBundleRoot, "synthetic-fixtures");
  yield* fs.makeDirectory(fixtureRoot, { recursive: true });
  yield* Effect.all(
    [
      fs.writeFile(path.join(fixtureRoot, "rfq-a-outlook-body.txt"), artifacts.rfqAEmail),
      fs.writeFile(path.join(fixtureRoot, "rfq-a-takeoff.xlsx"), artifacts.rfqAXlsx),
      fs.writeFile(path.join(fixtureRoot, "rfq-b-prose-email.txt"), artifacts.rfqBEmail),
      fs.writeFile(path.join(fixtureRoot, "rfq-b-schedule.pdf"), artifacts.rfqBPdf),
    ],
    { concurrency: 4, discard: true }
  );
  const [bundleJson, receiptJson, ledgerJson] = yield* Effect.all(
    [
      S.encodeEffect(ImmutableDemoBundleFromJsonString)(replay.bundle),
      S.encodeEffect(GoldenReplayReceiptFromJsonString)(replay.receipt),
      S.encodeEffect(MutableReviewLedgerFromJsonString)(replay.mutableLedger),
    ],
    { concurrency: 3 }
  );
  yield* Effect.all(
    [
      fs.writeFileString(path.join(resolvedBundleRoot, "bundle.json"), `${bundleJson}\n`),
      fs.writeFileString(path.join(resolvedBundleRoot, "golden-replay.json"), `${receiptJson}\n`),
      fs.writeFileString(path.join(resolvedMutableRoot, "review-ledger.json"), `${ledgerJson}\n`),
    ],
    { concurrency: 3, discard: true }
  );
  const persistedBundle = yield* fs.readFileString(path.join(resolvedBundleRoot, "bundle.json"));
  yield* S.decodeEffect(ImmutableDemoBundleFromJsonString)(persistedBundle);
  yield* Effect.logInfo("Built deterministic LeJeune replay bundle in machine-local storage.").pipe(
    Effect.annotateLogs({
      "lejeune.bundle_identity": replay.receipt.bundleIdentity,
      "lejeune.bundle_root": resolvedBundleRoot,
      "lejeune.mutable_root": resolvedMutableRoot,
      "lejeune.network_available": false,
      "lejeune.provider_available": false,
    })
  );
});

const BaseLayer = Layer.mergeAll(BunServices.layer, BunCrypto.layer);
const main = Effect.scoped(
  Layer.build(BaseLayer).pipe(Effect.flatMap((context) => program.pipe(Effect.provide(context))))
);

BunRuntime.runMain(main);
