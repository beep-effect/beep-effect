/**
 * Build the replay bundle into caller-owned machine-local storage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Config, DateTime, Effect, Exit, FileSystem, Layer, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  BUNDLE_VERSION,
  GoldenReplayReceiptFromJsonString,
  ImmutableDemoBundleFromJsonString,
  MUTABLE_CORPUS_DISPOSITION_DATE,
  MutableReviewLedgerFromJsonString,
  ProjectionStoreMetadata,
  ProjectionStoreMetadataFromJsonString,
  ProviderRecordingFromJsonString,
  RetentionAuthorizationFromJsonString,
} from "@/domain/Bundle";
import { buildFixtureArtifacts, RFQ_A_OUTLOOK_BODY } from "@/fixtures/Sources";
import { makeProjectionLayer, ProjectionLayerOptions } from "@/runtime/Projections";
import { verifyProviderRecording } from "@/workflows/ProviderRecording";
import { replayOffline } from "@/workflows/Replay";

const $I = $LejeuneBoltWorkbenchId.create("server/build-bundle");
const RECORDING_PATH = "src/fixtures/provider-recording.json";
const bytesEquivalent = S.toEquivalence(S.Uint8Array);

/**
 * Caller-selected final roots and frozen provider recording for one bundle build.
 *
 * **Example** (Describe machine-local outputs)
 *
 * ```ts
 * import { BundleBuildInput } from "../server/build-bundle"
 *
 * const input = BundleBuildInput.make({
 *   bundleRoot: ".beep/lejeune-demo-bundle",
 *   mutableRoot: ".beep/lejeune-demo-review",
 *   recordingPath: "src/fixtures/provider-recording.json"
 * })
 *
 * console.log(input.bundleRoot) // .beep/lejeune-demo-bundle
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BundleBuildInput extends S.Class<BundleBuildInput>($I`BundleBuildInput`)(
  {
    bundleRoot: S.NonEmptyString,
    mutableRoot: S.NonEmptyString,
    recordingPath: S.NonEmptyString,
    retentionAuthorizationPath: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("BundleBuildInput", {
    description: "Caller-selected final roots and frozen provider recording for one transactional bundle build.",
  })
) {}

/**
 * Typed failure at the machine-local bundle publication boundary.
 *
 * **Example** (Identify a root conflict)
 *
 * ```ts
 * import { BundleBuildError } from "../server/build-bundle"
 *
 * const error = BundleBuildError.make({
 *   message: "A final root already exists.",
 *   stage: "preflight"
 * })
 *
 * console.log(error._tag) // BundleBuildError
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BundleBuildError extends S.TaggedError<BundleBuildError>($I`BundleBuildError`)(
  "BundleBuildError",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true })),
    message: S.NonEmptyString,
    stage: S.NonEmptyString,
  },
  $I.annoteError<BundleBuildError>("BundleBuildError", {
    title: "LeJeune bundle build error",
    description: "A typed failure while staging, validating, or publishing the machine-local replay bundle.",
  })
) {}

class StagingRoots extends S.Class<StagingRoots>($I`StagingRoots`)(
  {
    bundle: S.NonEmptyString,
    mutable: S.NonEmptyString,
  },
  $I.annote("StagingRoots", { description: "Builder-owned adjacent staging roots pending atomic publication." })
) {}

const bundleBuildError = (stage: string, message: string): BundleBuildError =>
  BundleBuildError.make({ message, stage });

const bundleBuildErrorWithCause = (stage: string, message: string, cause: unknown): BundleBuildError =>
  BundleBuildError.make({ cause, message, stage });

const dispositionInstant = DateTime.makeUnsafe(`${MUTABLE_CORPUS_DISPOSITION_DATE}T00:00:00.000Z`);

const enforceRetentionPolicy = Effect.fn("LeJeuneBundle.enforceRetentionPolicy")(function* (
  authorizationPath: O.Option<string>,
  currentTimeMillis: number
) {
  const now = DateTime.makeUnsafe(currentTimeMillis);
  if (!Order.isGreaterThanOrEqualTo(DateTime.Order)(now, dispositionInstant)) {
    return;
  }
  if (O.isNone(authorizationPath)) {
    return yield* bundleBuildError(
      "retention",
      `Mutable review publication is closed on or after ${MUTABLE_CORPUS_DISPOSITION_DATE} without reviewed retention authority.`
    );
  }
  const fs = yield* FileSystem.FileSystem;
  const authorizationText = yield* fs
    .readFileString(authorizationPath.value)
    .pipe(
      Effect.mapError((cause) =>
        bundleBuildErrorWithCause("retention", "The reviewed retention authorization could not be read.", cause)
      )
    );
  const authorization = yield* S.decodeEffect(RetentionAuthorizationFromJsonString)(authorizationText).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("retention", "The reviewed retention authorization is invalid.", cause)
    )
  );
  const authorizedAt = DateTime.makeUnsafe(authorization.authorizedAt);
  const authorizedUntil = DateTime.makeUnsafe(`${authorization.newDispositionDate}T00:00:00.000Z`);
  if (Order.isGreaterThan(DateTime.Order)(authorizedAt, now)) {
    return yield* bundleBuildError("retention", "The retention authorization timestamp is in the future.");
  }
  if (!Order.isGreaterThan(DateTime.Order)(authorizedUntil, now)) {
    return yield* bundleBuildError(
      "retention",
      "The reviewed retention authorization must grant a disposition date later than the build time."
    );
  }
});

const removeOwnedStaging = Effect.fn("LeJeuneBundle.removeOwnedStaging")(function* (stagingRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(stagingRoot)
    .pipe(
      Effect.mapError((cause) =>
        bundleBuildErrorWithCause("cleanup", "Could not inspect a builder-owned staging root.", cause)
      )
    );
  if (exists) {
    yield* fs
      .remove(stagingRoot, { recursive: true })
      .pipe(
        Effect.mapError((cause) =>
          bundleBuildErrorWithCause("cleanup", "Could not remove a builder-owned staging root.", cause)
        )
      );
  }
});

const ensureFinalRootsAbsent = Effect.fn("LeJeuneBundle.ensureFinalRootsAbsent")(function* (
  bundleRoot: string,
  mutableRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const [bundleExists, mutableExists] = yield* Effect.all([fs.exists(bundleRoot), fs.exists(mutableRoot)], {
    concurrency: 2,
  }).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("preflight", "Could not inspect the selected final roots.", cause)
    )
  );
  if (bundleExists) {
    return yield* bundleBuildError("preflight", "The immutable bundle root already exists; select a new path.");
  }
  if (mutableExists) {
    return yield* bundleBuildError("preflight", "The mutable review root already exists; select a new path.");
  }
});

const acquireStagingRoots = Effect.fn("LeJeuneBundle.acquireStagingRoots")(function* (
  bundleRoot: string,
  mutableRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const bundleParent = path.dirname(bundleRoot);
  const mutableParent = path.dirname(mutableRoot);
  yield* Effect.all(
    [fs.makeDirectory(bundleParent, { recursive: true }), fs.makeDirectory(mutableParent, { recursive: true })],
    { concurrency: 2, discard: true }
  ).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("staging", "Could not prepare the parent directories for staging.", cause)
    )
  );
  const bundle = yield* fs
    .makeTempDirectory({ directory: bundleParent, prefix: `.${path.basename(bundleRoot)}.staging-` })
    .pipe(
      Effect.mapError((cause) =>
        bundleBuildErrorWithCause("staging", "Could not create the immutable staging root.", cause)
      )
    );
  const mutable = yield* fs
    .makeTempDirectory({ directory: mutableParent, prefix: `.${path.basename(mutableRoot)}.staging-` })
    .pipe(
      Effect.mapError((cause) =>
        bundleBuildErrorWithCause("staging", "Could not create the mutable staging root.", cause)
      ),
      Effect.tapError(() => removeOwnedStaging(bundle))
    );
  return StagingRoots.make({ bundle, mutable });
});

const releaseStagingRoots = Effect.fn("LeJeuneBundle.releaseStagingRoots")((staging: StagingRoots) =>
  Effect.all([removeOwnedStaging(staging.bundle), removeOwnedStaging(staging.mutable)], {
    concurrency: 2,
    discard: true,
  })
);

const buildStagedBundle = Effect.fn("LeJeuneBundle.buildStagedBundle")(function* (
  staging: StagingRoots,
  recordingPath: string,
  retentionAuthorizationPath: O.Option<string>,
  currentTimeMillis: number
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const recordingText = yield* fs
    .readFileString(recordingPath)
    .pipe(
      Effect.mapError((cause) =>
        bundleBuildErrorWithCause(
          "provider-recording",
          "No readable sanitized provider recording is available; run provider:smoke first.",
          cause
        )
      )
    );
  const decodedRecording = yield* S.decodeEffect(ProviderRecordingFromJsonString)(recordingText).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("provider-recording", "The sanitized provider recording is invalid.", cause)
    )
  );
  const recording = yield* verifyProviderRecording(decodedRecording, RFQ_A_OUTLOOK_BODY).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause(
        "provider-recording",
        "The sanitized provider recording failed integrity checks.",
        cause
      )
    )
  );
  const pgliteDataDir = path.join(staging.bundle, "app-review.pglite");
  const duckDbPath = path.join(staging.bundle, "corpus.duckdb");
  const replay = yield* Layer.build(
    makeProjectionLayer(ProjectionLayerOptions.make({ duckDbPath, pgliteDataDir: O.some(pgliteDataDir) }))
  ).pipe(
    Effect.flatMap((context) => replayOffline(recording).pipe(Effect.provide(context))),
    Effect.scoped,
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("replay", "The deterministic offline replay could not be built.", cause)
    )
  );
  yield* enforceRetentionPolicy(retentionAuthorizationPath, currentTimeMillis);
  const artifacts = yield* buildFixtureArtifacts.pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("fixtures", "The deterministic synthetic fixtures could not be built.", cause)
    )
  );
  const fixtureRoot = path.join(staging.bundle, "synthetic-fixtures");
  const rfqAEmailFile = path.join(fixtureRoot, "rfq-a-outlook-body.txt");
  const rfqAXlsxFile = path.join(fixtureRoot, "rfq-a-takeoff.xlsx");
  const rfqBEmailFile = path.join(fixtureRoot, "rfq-b-prose-email.txt");
  const rfqBPdfFile = path.join(fixtureRoot, "rfq-b-schedule.pdf");
  yield* fs
    .makeDirectory(fixtureRoot, { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        bundleBuildErrorWithCause("fixtures", "The staged fixture directory could not be created.", cause)
      )
    );
  yield* Effect.all(
    [
      fs.writeFile(rfqAEmailFile, artifacts.rfqAEmail),
      fs.writeFile(rfqAXlsxFile, artifacts.rfqAXlsx),
      fs.writeFile(rfqBEmailFile, artifacts.rfqBEmail),
      fs.writeFile(rfqBPdfFile, artifacts.rfqBPdf),
    ],
    { concurrency: 4, discard: true }
  ).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("fixtures", "The synthetic fixture files could not be staged.", cause)
    )
  );
  const projectionMetadata = ProjectionStoreMetadata.make({
    bundleIdentity: replay.receipt.bundleIdentity,
    bundleVersion: BUNDLE_VERSION,
    projectionSchemaVersion: "lejeune-projection-stores/v1",
    stores: ["pglite", "duckdb"],
  });
  const [bundleJson, receiptJson, ledgerJson, projectionMetadataJson] = yield* Effect.all(
    [
      S.encodeEffect(ImmutableDemoBundleFromJsonString)(replay.bundle),
      S.encodeEffect(GoldenReplayReceiptFromJsonString)(replay.receipt),
      S.encodeEffect(MutableReviewLedgerFromJsonString)(replay.mutableLedger),
      S.encodeEffect(ProjectionStoreMetadataFromJsonString)(projectionMetadata),
    ],
    { concurrency: 4 }
  ).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("serialization", "The replay outputs could not be serialized.", cause)
    )
  );
  const bundleFile = path.join(staging.bundle, "bundle.json");
  const receiptFile = path.join(staging.bundle, "golden-replay.json");
  const projectionMetadataFile = path.join(staging.bundle, "projection-metadata.json");
  const ledgerFile = path.join(staging.mutable, "review-ledger.json");
  yield* Effect.all(
    [
      fs.writeFileString(bundleFile, `${bundleJson}\n`),
      fs.writeFileString(receiptFile, `${receiptJson}\n`),
      fs.writeFileString(projectionMetadataFile, `${projectionMetadataJson}\n`),
      fs.writeFileString(ledgerFile, `${ledgerJson}\n`),
    ],
    { concurrency: 4, discard: true }
  ).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("serialization", "The replay outputs could not be staged.", cause)
    )
  );
  const [persistedBundle, persistedReceipt, persistedLedger, persistedProjectionMetadata] = yield* Effect.all(
    [
      fs.readFileString(bundleFile),
      fs.readFileString(receiptFile),
      fs.readFileString(ledgerFile),
      fs.readFileString(projectionMetadataFile),
    ],
    { concurrency: 4 }
  ).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("validation", "The staged replay outputs could not be read back.", cause)
    )
  );
  yield* Effect.all(
    [
      S.decodeEffect(ImmutableDemoBundleFromJsonString)(persistedBundle),
      S.decodeEffect(GoldenReplayReceiptFromJsonString)(persistedReceipt),
      S.decodeEffect(MutableReviewLedgerFromJsonString)(persistedLedger),
      S.decodeEffect(ProjectionStoreMetadataFromJsonString)(persistedProjectionMetadata),
    ],
    { concurrency: 4, discard: true }
  ).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("validation", "The staged replay outputs failed validation.", cause)
    )
  );
  const [persistedRfqAEmail, persistedRfqAXlsx, persistedRfqBEmail, persistedRfqBPdf] = yield* Effect.all(
    [fs.readFile(rfqAEmailFile), fs.readFile(rfqAXlsxFile), fs.readFile(rfqBEmailFile), fs.readFile(rfqBPdfFile)],
    { concurrency: 4 }
  ).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("validation", "The staged synthetic fixtures could not be read back.", cause)
    )
  );
  const fixturesMatch =
    bytesEquivalent(persistedRfqAEmail, artifacts.rfqAEmail) &&
    bytesEquivalent(persistedRfqAXlsx, artifacts.rfqAXlsx) &&
    bytesEquivalent(persistedRfqBEmail, artifacts.rfqBEmail) &&
    bytesEquivalent(persistedRfqBPdf, artifacts.rfqBPdf);
  if (!fixturesMatch) {
    return yield* bundleBuildError("validation", "A staged synthetic fixture changed during persistence.");
  }
  const [duckDbExists, pgliteExists] = yield* Effect.all([fs.exists(duckDbPath), fs.exists(pgliteDataDir)], {
    concurrency: 2,
  }).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("validation", "The staged durable projection stores could not be inspected.", cause)
    )
  );
  if (!duckDbExists || !pgliteExists) {
    return yield* bundleBuildError("validation", "A staged durable projection store is missing.");
  }
  const pgliteEntries = yield* fs
    .readDirectory(pgliteDataDir)
    .pipe(
      Effect.mapError((cause) =>
        bundleBuildErrorWithCause("validation", "The staged PGlite store could not be inspected.", cause)
      )
    );
  if (A.isReadonlyArrayEmpty(pgliteEntries)) {
    return yield* bundleBuildError("validation", "The staged PGlite store is empty.");
  }
  return replay.receipt;
});

const publishStagingRoots = Effect.fn("LeJeuneBundle.publishStagingRoots")(function* (
  staging: StagingRoots,
  bundleRoot: string,
  mutableRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  yield* ensureFinalRootsAbsent(bundleRoot, mutableRoot);
  yield* fs
    .rename(staging.mutable, mutableRoot)
    .pipe(
      Effect.mapError((cause) =>
        bundleBuildErrorWithCause("publish", "The mutable review root could not be published atomically.", cause)
      )
    );
  yield* fs.rename(staging.bundle, bundleRoot).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("publish", "The immutable bundle root could not be published atomically.", cause)
    ),
    Effect.catch((publishError) =>
      fs.rename(mutableRoot, staging.mutable).pipe(
        Effect.mapError((rollbackCause) =>
          bundleBuildErrorWithCause(
            "publish-rollback",
            "Immutable publication failed and the mutable publication could not be rolled back.",
            { publishError, rollbackCause }
          )
        ),
        Effect.andThen(Effect.fail(publishError))
      )
    )
  );
});

/**
 * Build, validate, and atomically publish a deterministic machine-local replay bundle.
 *
 * **Details**
 *
 * Both final roots must be absent. The operation writes only unique adjacent staging roots
 * until every persisted JSON output decodes successfully, then publishes by directory rename.
 *
 * **Example** (Inspect the returned Effect)
 *
 * ```ts
 * import { buildBundle, BundleBuildInput } from "../server/build-bundle"
 * import { Effect } from "effect"
 *
 * const operation = buildBundle(BundleBuildInput.make({
 *   bundleRoot: ".beep/lejeune-demo-bundle",
 *   mutableRoot: ".beep/lejeune-demo-review",
 *   recordingPath: "src/fixtures/provider-recording.json"
 * }))
 *
 * console.log(Effect.isEffect(operation)) // true
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
const buildBundleAt = Effect.fn("LeJeuneBundle.buildAt")(function* (
  input: BundleBuildInput,
  currentTimeMillis: number
) {
  const path = yield* Path.Path;
  const bundleRoot = path.resolve(input.bundleRoot);
  const mutableRoot = path.resolve(input.mutableRoot);
  const recordingPath = path.resolve(input.recordingPath);
  const retentionAuthorizationPath = O.map(input.retentionAuthorizationPath, path.resolve);
  if (Str.Equivalence(bundleRoot, mutableRoot)) {
    return yield* bundleBuildError(
      "preflight",
      "Immutable bundle and mutable review roots must be different directories."
    );
  }
  const mutableRelativeToBundle = path.relative(bundleRoot, mutableRoot);
  const bundleRelativeToMutable = path.relative(mutableRoot, bundleRoot);
  const isNestedRoot = (relative: string): boolean =>
    Str.isNonEmpty(relative) &&
    !Str.Equivalence(relative, "..") &&
    !Str.startsWith(`..${path.sep}`)(relative) &&
    !path.isAbsolute(relative);
  if (isNestedRoot(mutableRelativeToBundle) || isNestedRoot(bundleRelativeToMutable)) {
    return yield* bundleBuildError(
      "preflight",
      "Immutable bundle and mutable review roots must not contain one another."
    );
  }
  yield* ensureFinalRootsAbsent(bundleRoot, mutableRoot);
  yield* Effect.annotateCurrentSpan("lejeune.output_scope", "machine-local");
  const receipt = yield* Effect.acquireUseRelease(
    acquireStagingRoots(bundleRoot, mutableRoot),
    (staging) =>
      buildStagedBundle(staging, recordingPath, retentionAuthorizationPath, currentTimeMillis).pipe(
        Effect.tap(() => publishStagingRoots(staging, bundleRoot, mutableRoot))
      ),
    (staging, exit) =>
      Exit.match(exit, {
        onFailure: () => releaseStagingRoots(staging),
        onSuccess: () => Effect.void,
      })
  );
  yield* Effect.logInfo("Built and published the deterministic LeJeune replay bundle.").pipe(
    Effect.annotateLogs({
      "lejeune.bundle_identity": receipt.bundleIdentity,
      "lejeune.network_available": false,
      "lejeune.provider_available": false,
    })
  );
  return receipt;
});

export const buildBundle = Effect.fn("LeJeuneBundle.build")(function* (input: BundleBuildInput) {
  const currentTimeMillis = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
  return yield* buildBundleAt(input, currentTimeMillis);
});

const configuredBuild = Effect.gen(function* () {
  const bundleRoot = yield* Config.nonEmptyString("LEJEUNE_BUNDLE_ROOT").pipe(
    Config.withDefault(".beep/lejeune-demo-bundle"),
    Effect.mapError((cause) => bundleBuildErrorWithCause("configuration", "The bundle root is invalid.", cause))
  );
  const mutableRoot = yield* Config.nonEmptyString("LEJEUNE_MUTABLE_ROOT").pipe(
    Config.withDefault(".beep/lejeune-demo-review"),
    Effect.mapError((cause) => bundleBuildErrorWithCause("configuration", "The mutable root is invalid.", cause))
  );
  const retentionAuthorizationPath = yield* Config.option(
    Config.nonEmptyString("LEJEUNE_RETENTION_AUTHORIZATION")
  ).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("configuration", "The retention authorization path is invalid.", cause)
    )
  );
  return yield* buildBundle(
    BundleBuildInput.make({ bundleRoot, mutableRoot, recordingPath: RECORDING_PATH, retentionAuthorizationPath })
  );
});

const BaseLayer = Layer.mergeAll(BunServices.layer, BunCrypto.layer);
const main = Effect.scoped(
  Layer.build(BaseLayer).pipe(Effect.flatMap((context) => configuredBuild.pipe(Effect.provide(context))))
);

if (import.meta.main) {
  BunRuntime.runMain(main);
}
