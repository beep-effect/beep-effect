/**
 * Build the replay bundle into caller-owned machine-local storage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { SchemaUtils, Sha256HexFromBytes } from "@beep/schema";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Config, DateTime, Effect, Exit, FileSystem, Layer, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { strToU8 } from "fflate";
import {
  BUNDLE_VERSION,
  FrozenProviderRecordingFromJsonString,
  GoldenReplayReceiptFromJsonString,
  ImmutableDemoBundleFromJsonString,
  MUTABLE_CORPUS_DISPOSITION_DATE,
  MutableRetentionMetadata,
  MutableRetentionMetadataFromJsonString,
  MutableReviewLedgerFromJsonString,
  makePublishedReplayAggregate,
  ProjectionStoreMetadata,
  ProjectionStoreMetadataFromJsonString,
  RetentionAuthorizationFromJsonString,
} from "@/domain/Bundle";
import { buildFixtureArtifacts, RFQ_A_OUTLOOK_BODY } from "@/fixtures/Sources";
import { makeProjectionLayer, ProjectionLayerOptions, verifyDurableProjectionSnapshot } from "@/runtime/Projections";
import { verifyFrozenProviderRecording } from "@/workflows/ProviderRecording";
import { replayOffline } from "@/workflows/Replay";

const $I = $LejeuneBoltWorkbenchId.create("server/build-bundle");
const RECORDING_PATH = "src/fixtures/provider-recording.json";
const bytesEquivalent = S.toEquivalence(S.Uint8Array);
const retentionMetadataEquivalent = S.toEquivalence(MutableRetentionMetadata);

/**
 * Caller-selected final roots and frozen provider recording for one bundle build.
 *
 * **Example** (Describe machine-local outputs)
 *
 * ```ts
 * import { BundleBuildInput } from "../server/build-bundle"
 *
 * const input = BundleBuildInput.make({
 *   bundleRoot: ".beep/lejeune-demo-publication/bundle",
 *   mutableRoot: ".beep/lejeune-demo-publication/review",
 *   recordingPath: "src/fixtures/provider-recording.json"
 * })
 *
 * console.log(input.bundleRoot) // .beep/lejeune-demo-publication/bundle
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

/**
 * Exact staged JSON documents and expected mutable policy supplied to publication readback.
 *
 * **Example** (Inspect the bundle text field)
 *
 * ```ts
 * import { PublicationReadbackInput } from "../server/build-bundle"
 *
 * console.log(PublicationReadbackInput.fields.bundleText !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PublicationReadbackInput extends S.Class<PublicationReadbackInput>($I`PublicationReadbackInput`)(
  {
    bundleText: S.NonEmptyString,
    expectedRetentionMetadata: MutableRetentionMetadata,
    ledgerText: S.NonEmptyString,
    projectionMetadataText: S.NonEmptyString,
    receiptText: S.NonEmptyString,
    retentionMetadataText: S.NonEmptyString,
  },
  $I.annote("PublicationReadbackInput", {
    description: "The exact staged JSON bytes and expected mutable policy validated before atomic publication.",
  })
) {}

class StagingRoots extends S.Class<StagingRoots>($I`StagingRoots`)(
  {
    bundle: S.NonEmptyString,
    container: S.NonEmptyString,
    mutable: S.NonEmptyString,
  },
  $I.annote("StagingRoots", {
    description: "Builder-owned publication container and child roots pending one atomic directory rename.",
  })
) {}

class PublicationRoots extends S.Class<PublicationRoots>($I`PublicationRoots`)(
  {
    bundle: S.NonEmptyString,
    mutable: S.NonEmptyString,
    publication: S.NonEmptyString,
  },
  $I.annote("PublicationRoots", {
    description: "Distinct immutable and mutable children of one dedicated publication root.",
  })
) {}

const bundleBuildError = (stage: string, message: string): BundleBuildError =>
  BundleBuildError.make({ message, stage });

const bundleBuildErrorWithCause = (stage: string, message: string, cause: unknown): BundleBuildError =>
  BundleBuildError.make({ cause, message, stage });

/**
 * Decode and cross-check every persisted publication document against the exact bundle bytes read back.
 *
 * **Example** (Inspect the verifier)
 *
 * ```ts
 * import { verifyPublicationReadback } from "../server/build-bundle"
 *
 * console.log(typeof verifyPublicationReadback === "function") // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const verifyPublicationReadback = Effect.fn("LeJeuneBundle.verifyPublicationReadback")(function* (
  input: PublicationReadbackInput
) {
  const [bundle, bundleIdentity, mutableLedger, projectionMetadata, receipt, retentionMetadata] = yield* Effect.all(
    [
      S.decodeEffect(ImmutableDemoBundleFromJsonString)(input.bundleText),
      Sha256HexFromBytes.decodeEffect(strToU8(input.bundleText)),
      S.decodeEffect(MutableReviewLedgerFromJsonString)(input.ledgerText),
      S.decodeEffect(ProjectionStoreMetadataFromJsonString)(input.projectionMetadataText),
      S.decodeEffect(GoldenReplayReceiptFromJsonString)(input.receiptText),
      S.decodeEffect(MutableRetentionMetadataFromJsonString)(input.retentionMetadataText),
    ],
    { concurrency: 6 }
  ).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("validation", "A staged publication document failed validation.", cause)
    )
  );
  if (!retentionMetadataEquivalent(retentionMetadata, input.expectedRetentionMetadata)) {
    return yield* bundleBuildError("validation", "The staged retention metadata changed during persistence.");
  }
  return yield* makePublishedReplayAggregate({
    bundle,
    bundleIdentity,
    mutableLedger,
    projectionMetadata,
    receipt,
    retentionMetadata,
  }).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause(
        "validation",
        "The staged publication documents do not describe one closed replay aggregate.",
        cause
      )
    )
  );
});

const dispositionInstant = DateTime.makeUnsafe(`${MUTABLE_CORPUS_DISPOSITION_DATE}T00:00:00.000Z`);

const enforceRetentionPolicy = Effect.fn("LeJeuneBundle.enforceRetentionPolicy")(function* (
  authorizationPath: O.Option<string>,
  currentTimeMillis: number
) {
  const now = DateTime.makeUnsafe(currentTimeMillis);
  if (O.isNone(authorizationPath)) {
    if (Order.isGreaterThanOrEqualTo(DateTime.Order)(now, dispositionInstant)) {
      return yield* bundleBuildError(
        "retention",
        `Mutable review publication is closed on or after ${MUTABLE_CORPUS_DISPOSITION_DATE} without reviewed retention authority.`
      );
    }
    return O.none();
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
  return O.some(authorization);
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

const ensurePublicationRootAbsent = Effect.fn("LeJeuneBundle.ensurePublicationRootAbsent")(function* (
  publicationRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const publicationExists = yield* fs
    .exists(publicationRoot)
    .pipe(
      Effect.mapError((cause) =>
        bundleBuildErrorWithCause("preflight", "Could not inspect the selected publication root.", cause)
      )
    );
  if (publicationExists) {
    return yield* bundleBuildError("preflight", "The dedicated publication root already exists; select a new path.");
  }
});

const acquireStagingRoots = Effect.fn("LeJeuneBundle.acquireStagingRoots")(function* (roots: PublicationRoots) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const publicationParent = path.dirname(roots.publication);
  yield* fs
    .makeDirectory(publicationParent, { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        bundleBuildErrorWithCause("staging", "Could not prepare the publication parent for staging.", cause)
      )
    );
  const container = yield* fs
    .makeTempDirectory({ directory: publicationParent, prefix: `.${path.basename(roots.publication)}.staging-` })
    .pipe(
      Effect.mapError((cause) =>
        bundleBuildErrorWithCause("staging", "Could not create the publication staging container.", cause)
      )
    );
  const bundle = path.join(container, path.basename(roots.bundle));
  const mutable = path.join(container, path.basename(roots.mutable));
  yield* Effect.all([fs.makeDirectory(bundle), fs.makeDirectory(mutable)], { concurrency: 2, discard: true }).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("staging", "Could not create the staged publication child roots.", cause)
    ),
    Effect.tapError(() => removeOwnedStaging(container))
  );
  return StagingRoots.make({ bundle, container, mutable });
});

const releaseStagingRoots = Effect.fn("LeJeuneBundle.releaseStagingRoots")((staging: StagingRoots) =>
  removeOwnedStaging(staging.container)
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
  const decodedRecording = yield* S.decodeEffect(FrozenProviderRecordingFromJsonString)(recordingText).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("provider-recording", "The sanitized provider recording is invalid.", cause)
    )
  );
  const recording = yield* verifyFrozenProviderRecording(decodedRecording, RFQ_A_OUTLOOK_BODY).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause(
        "provider-recording",
        "The sanitized provider recording failed integrity checks.",
        cause
      )
    )
  );
  const retentionAuthorization = yield* enforceRetentionPolicy(retentionAuthorizationPath, currentTimeMillis);
  const pgliteDataDir = path.join(staging.bundle, "app-review.pglite");
  const duckDbPath = path.join(staging.bundle, "corpus.duckdb");
  const replay = yield* Layer.build(
    makeProjectionLayer(ProjectionLayerOptions.make({ duckDbPath, pgliteDataDir: O.some(pgliteDataDir) }))
  ).pipe(
    Effect.flatMap((context) => replayOffline(recording, retentionAuthorization).pipe(Effect.provide(context))),
    Effect.scoped,
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("replay", "The deterministic offline replay could not be built.", cause)
    )
  );
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
  const [bundleJson, receiptJson, ledgerJson, retentionMetadataJson, projectionMetadataJson] = yield* Effect.all(
    [
      S.encodeEffect(ImmutableDemoBundleFromJsonString)(replay.bundle),
      S.encodeEffect(GoldenReplayReceiptFromJsonString)(replay.receipt),
      S.encodeEffect(MutableReviewLedgerFromJsonString)(replay.mutableLedger),
      S.encodeEffect(MutableRetentionMetadataFromJsonString)(replay.retentionMetadata),
      S.encodeEffect(ProjectionStoreMetadataFromJsonString)(projectionMetadata),
    ],
    { concurrency: 5 }
  ).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("serialization", "The replay outputs could not be serialized.", cause)
    )
  );
  const bundleFile = path.join(staging.bundle, "bundle.json");
  const receiptFile = path.join(staging.bundle, "golden-replay.json");
  const projectionMetadataFile = path.join(staging.bundle, "projection-metadata.json");
  const ledgerFile = path.join(staging.mutable, "review-ledger.json");
  const retentionMetadataFile = path.join(staging.mutable, "retention-metadata.json");
  yield* Effect.all(
    [
      fs.writeFileString(bundleFile, bundleJson),
      fs.writeFileString(receiptFile, `${receiptJson}\n`),
      fs.writeFileString(projectionMetadataFile, `${projectionMetadataJson}\n`),
      fs.writeFileString(ledgerFile, `${ledgerJson}\n`),
      fs.writeFileString(retentionMetadataFile, `${retentionMetadataJson}\n`),
    ],
    { concurrency: 5, discard: true }
  ).pipe(
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause("serialization", "The replay outputs could not be staged.", cause)
    )
  );
  const [persistedBundle, persistedReceipt, persistedLedger, persistedRetentionMetadata, persistedProjectionMetadata] =
    yield* Effect.all(
      [
        fs.readFileString(bundleFile),
        fs.readFileString(receiptFile),
        fs.readFileString(ledgerFile),
        fs.readFileString(retentionMetadataFile),
        fs.readFileString(projectionMetadataFile),
      ],
      { concurrency: 5 }
    ).pipe(
      Effect.mapError((cause) =>
        bundleBuildErrorWithCause("validation", "The staged replay outputs could not be read back.", cause)
      )
    );
  yield* verifyPublicationReadback(
    PublicationReadbackInput.make({
      bundleText: persistedBundle,
      expectedRetentionMetadata: replay.retentionMetadata,
      ledgerText: persistedLedger,
      projectionMetadataText: persistedProjectionMetadata,
      receiptText: persistedReceipt,
      retentionMetadataText: persistedRetentionMetadata,
    })
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
  yield* Layer.build(
    makeProjectionLayer(ProjectionLayerOptions.make({ duckDbPath, pgliteDataDir: O.some(pgliteDataDir) }))
  ).pipe(
    Effect.flatMap((context) =>
      verifyDurableProjectionSnapshot(replay.bundle.projection).pipe(Effect.provide(context))
    ),
    Effect.scoped,
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause(
        "validation",
        "The staged durable projection stores failed reopened content validation.",
        cause
      )
    )
  );
  return replay.receipt;
});

const publishStagingRoots = Effect.fn("LeJeuneBundle.publishStagingRoots")(function* (
  staging: StagingRoots,
  publicationRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* ensurePublicationRootAbsent(publicationRoot);
  const publishedContainer = path.join(
    path.dirname(staging.container),
    Str.replace(".staging-", ".payload-")(path.basename(staging.container))
  );
  yield* fs
    .rename(staging.container, publishedContainer)
    .pipe(
      Effect.mapError((cause) =>
        bundleBuildErrorWithCause("publish", "The validated publication container could not be finalized.", cause)
      )
    );
  yield* fs.symlink(path.basename(publishedContainer), publicationRoot).pipe(
    Effect.tapError(() => removeOwnedStaging(publishedContainer)),
    Effect.mapError((cause) =>
      bundleBuildErrorWithCause(
        "publish",
        "The complete publication container could not claim the write-once root atomically.",
        cause
      )
    )
  );
});

/**
 * Build, validate, and atomically publish a deterministic machine-local replay bundle.
 *
 * **Details**
 *
 * Both final roots must be distinct children of one absent publication root. The operation
 * validates both children in one adjacent immutable container, then claims the final root with one
 * atomic symlink creation that refuses every pre-existing file, directory, or link.
 *
 * **Example** (Inspect the returned Effect)
 *
 * ```ts
 * import { buildBundle, BundleBuildInput } from "../server/build-bundle"
 * import { Effect } from "effect"
 *
 * const operation = buildBundle(BundleBuildInput.make({
 *   bundleRoot: ".beep/lejeune-demo-publication/bundle",
 *   mutableRoot: ".beep/lejeune-demo-publication/review",
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
  const bundleParent = path.dirname(bundleRoot);
  const mutableParent = path.dirname(mutableRoot);
  if (!Str.Equivalence(bundleParent, mutableParent)) {
    return yield* bundleBuildError(
      "preflight",
      "Immutable bundle and mutable review roots must be distinct direct children of one publication root."
    );
  }
  const roots = PublicationRoots.make({ bundle: bundleRoot, mutable: mutableRoot, publication: bundleParent });
  yield* ensurePublicationRootAbsent(roots.publication);
  yield* Effect.annotateCurrentSpan("lejeune.output_scope", "machine-local");
  const receipt = yield* Effect.uninterruptibleMask((restore) =>
    Effect.acquireUseRelease(
      acquireStagingRoots(roots),
      (staging) =>
        restore(buildStagedBundle(staging, recordingPath, retentionAuthorizationPath, currentTimeMillis)).pipe(
          Effect.flatMap((receipt) => publishStagingRoots(staging, roots.publication).pipe(Effect.as(receipt)))
        ),
      (staging, exit) =>
        Exit.match(exit, {
          onFailure: () => releaseStagingRoots(staging),
          onSuccess: () => Effect.void,
        })
    )
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
    Config.withDefault(".beep/lejeune-demo-publication/bundle"),
    Effect.mapError((cause) => bundleBuildErrorWithCause("configuration", "The bundle root is invalid.", cause))
  );
  const mutableRoot = yield* Config.nonEmptyString("LEJEUNE_MUTABLE_ROOT").pipe(
    Config.withDefault(".beep/lejeune-demo-publication/review"),
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
