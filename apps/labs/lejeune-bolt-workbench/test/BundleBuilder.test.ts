// @vitest-environment node

import { Sha256Hex } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect } from "@effect/vitest";
import { DateTime, Deferred, Effect, Exit, Fiber, FileSystem, Layer, Path, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { TestClock } from "effect/testing";
import {
  GoldenReplayReceipt,
  GoldenReplayReceiptFromJsonString,
  MutableRetentionMetadata,
  MutableRetentionMetadataArbitrary,
  MutableRetentionMetadataFromJsonString,
  MutableReviewLedger,
  ProjectionStoreMetadata,
  ProjectionStoreMetadataFromJsonString,
  RetentionAuthorization,
  RetentionAuthorizationFromJsonString,
} from "@/domain/Bundle";
import { IsoDate, IsoTimestamp } from "@/domain/Ontology";

const decodeGoldenReplayReceiptFromJsonString = S.decodeEffect(GoldenReplayReceiptFromJsonString);
const decodeMutableRetentionMetadataFromJsonString = S.decodeEffect(MutableRetentionMetadataFromJsonString);
const decodeProjectionStoreMetadataFromJsonString = S.decodeEffect(ProjectionStoreMetadataFromJsonString);
const decodeUnknownMutableRetentionMetadataResult = S.decodeUnknownResult(MutableRetentionMetadata);
const decodeUnknownMutableReviewLedgerResult = S.decodeUnknownResult(MutableReviewLedger);
const encodeGoldenReplayReceiptFromJsonString = S.encodeEffect(GoldenReplayReceiptFromJsonString);
const encodeProjectionStoreMetadataFromJsonString = S.encodeEffect(ProjectionStoreMetadataFromJsonString);
const encodeRetentionAuthorizationFromJsonString = S.encodeEffect(RetentionAuthorizationFromJsonString);
const encodeMutableRetentionMetadataResult = S.encodeResult(MutableRetentionMetadata);
const encodeMutableReviewLedgerResult = S.encodeResult(MutableReviewLedger);

import { it } from "@beep/test-runner";
import { assertFalse, assertNone, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import {
  BundleBuildInput,
  buildBundle,
  PublicationReadbackInput,
  verifyPublicationReadback,
} from "../server/build-bundle";

const inputFor = (
  bundleRoot: string,
  mutableRoot: string,
  recordingPath: string,
  retentionAuthorizationPath: O.Option<string> = O.none()
): BundleBuildInput => BundleBuildInput.make({ bundleRoot, mutableRoot, recordingPath, retentionAuthorizationPath });

describe("LeJeune transactional bundle builder", () => {
  it.prop(
    "round-trips schema-derived mutable retention metadata",
    [MutableRetentionMetadataArbitrary],
    ([value]) => {
      const equivalent = S.toEquivalence(MutableRetentionMetadata);
      return encodeMutableRetentionMetadataResult(value).pipe(
        Result.flatMap(decodeUnknownMutableRetentionMetadataResult),
        Result.match({
          onFailure: () => false,
          onSuccess: (decoded) => equivalent(decoded, value),
        }),
        assertTrue
      );
    },
    { arbitrary: fcRuns(20) }
  );

  it.prop(
    "round-trips the schema-derived exact-empty review ledger",
    [Arbitrary.schema(MutableReviewLedger)],
    ([value]) => {
      const equivalent = S.toEquivalence(MutableReviewLedger);
      return encodeMutableReviewLedgerResult(value).pipe(
        Result.flatMap(decodeUnknownMutableReviewLedgerResult),
        Result.match({
          onFailure: () => false,
          onSuccess: (decoded) => equivalent(decoded, value),
        }),
        assertTrue
      );
    },
    { arbitrary: fcRuns(20) }
  );

  it.layer(Layer.mergeAll(BunServices.layer, BunCrypto.layer), { timeout: "30 seconds" })((it) => {
    it.effect("refuses an existing publication containing the mutable root without changing its contents", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const parent = yield* fs.makeTempDirectoryScoped({ prefix: "lejeune-builder-existing-mutable-" });
        const publicationRoot = path.join(parent, "publication");
        const bundleRoot = path.join(publicationRoot, "bundle");
        const mutableRoot = path.join(publicationRoot, "review");
        const sentinel = path.join(mutableRoot, "sentinel.txt");
        yield* fs.makeDirectory(mutableRoot, { recursive: true });
        yield* fs.writeFileString(sentinel, "retain-me\n");

        const error = yield* buildBundle(inputFor(bundleRoot, mutableRoot, path.join(parent, "unused.json"))).pipe(
          Effect.flip
        );

        expect(error.stage).toBe("preflight");
        pipe(yield* fs.exists(bundleRoot), assertFalse);
        expect(yield* fs.readFileString(sentinel)).toBe("retain-me\n");
        expect(yield* fs.readDirectory(mutableRoot)).toEqual(["sentinel.txt"]);
      })
    );
  });

  it.layer(Layer.mergeAll(BunServices.layer, BunCrypto.layer), { timeout: "30 seconds" })((it) => {
    it.effect("refuses an existing publication containing the immutable root without changing its contents", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const parent = yield* fs.makeTempDirectoryScoped({ prefix: "lejeune-builder-existing-bundle-" });
        const publicationRoot = path.join(parent, "publication");
        const bundleRoot = path.join(publicationRoot, "bundle");
        const mutableRoot = path.join(publicationRoot, "review");
        const sentinel = path.join(bundleRoot, "sentinel.txt");
        yield* fs.makeDirectory(bundleRoot, { recursive: true });
        yield* fs.writeFileString(sentinel, "retain-me\n");

        const error = yield* buildBundle(inputFor(bundleRoot, mutableRoot, path.join(parent, "unused.json"))).pipe(
          Effect.flip
        );

        expect(error.stage).toBe("preflight");
        pipe(yield* fs.exists(mutableRoot), assertFalse);
        expect(yield* fs.readFileString(sentinel)).toBe("retain-me\n");
        expect(yield* fs.readDirectory(bundleRoot)).toEqual(["sentinel.txt"]);
      })
    );
  });

  it.layer(Layer.mergeAll(BunServices.layer, BunCrypto.layer), { timeout: "30 seconds" })((it) => {
    it.effect("rejects a shared immutable and mutable root before creating output", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const parent = yield* fs.makeTempDirectoryScoped({ prefix: "lejeune-builder-same-root-" });
        const sharedRoot = path.join(parent, "publication", "shared");

        const error = yield* buildBundle(inputFor(sharedRoot, sharedRoot, path.join(parent, "unused.json"))).pipe(
          Effect.flip
        );

        expect(error.stage).toBe("preflight");
        pipe(yield* fs.exists(sharedRoot), assertFalse);
        pipe(yield* fs.exists(path.join(parent, "publication")), assertFalse);
      })
    );
  });

  it.layer(Layer.mergeAll(BunServices.layer, BunCrypto.layer), { timeout: "30 seconds" })((it) => {
    it.effect("rejects nested immutable and mutable roots before creating output", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const parent = yield* fs.makeTempDirectoryScoped({ prefix: "lejeune-builder-nested-root-" });
        const bundleRoot = path.join(parent, "publication", "bundle");
        const mutableRoot = path.join(bundleRoot, "review");

        const error = yield* buildBundle(inputFor(bundleRoot, mutableRoot, path.join(parent, "unused.json"))).pipe(
          Effect.flip
        );

        expect(error.stage).toBe("preflight");
        pipe(yield* fs.exists(bundleRoot), assertFalse);
        pipe(yield* fs.exists(path.join(parent, "publication")), assertFalse);
      })
    );
  });

  it.layer(Layer.mergeAll(BunServices.layer, BunCrypto.layer), { timeout: "30 seconds" })((it) => {
    it.effect("rejects final roots with different parents before creating output", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const parent = yield* fs.makeTempDirectoryScoped({ prefix: "lejeune-builder-different-parents-" });
        const bundleRoot = path.join(parent, "immutable-publication", "bundle");
        const mutableRoot = path.join(parent, "mutable-publication", "review");

        const error = yield* buildBundle(inputFor(bundleRoot, mutableRoot, path.join(parent, "unused.json"))).pipe(
          Effect.flip
        );

        expect(error.stage).toBe("preflight");
        pipe(yield* fs.exists(path.join(parent, "immutable-publication")), assertFalse);
        pipe(yield* fs.exists(path.join(parent, "mutable-publication")), assertFalse);
      })
    );
  });

  it.layer(Layer.mergeAll(BunServices.layer, BunCrypto.layer), { timeout: "30 seconds" })((it) => {
    it.effect("removes owned staging after a partial failure and leaves the publication root absent", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const parent = yield* fs.makeTempDirectoryScoped({ prefix: "lejeune-builder-partial-" });
        const publicationRoot = path.join(parent, "publication");
        const bundleRoot = path.join(publicationRoot, "bundle");
        const mutableRoot = path.join(publicationRoot, "review");
        const invalidRecording = path.join(parent, "invalid-recording.json");
        yield* fs.writeFileString(invalidRecording, "{not-json}\n");

        const error = yield* buildBundle(inputFor(bundleRoot, mutableRoot, invalidRecording)).pipe(Effect.flip);

        expect(error.stage).toBe("provider-recording");
        pipe(yield* fs.exists(publicationRoot), assertFalse);
        pipe(
          A.every(yield* fs.readDirectory(parent), (entry) => !Str.includes(".staging-")(entry)),
          assertTrue
        );
      })
    );
  });

  it.layer(Layer.mergeAll(BunServices.layer, BunCrypto.layer), { timeout: "30 seconds" })((it) => {
    it.effect("defers interruption after the atomic publication claim", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const parent = yield* fs.makeTempDirectoryScoped({ prefix: "lejeune-builder-interrupted-publish-" });
        const publicationRoot = path.join(parent, "publication");
        const bundleRoot = path.join(publicationRoot, "bundle");
        const mutableRoot = path.join(publicationRoot, "review");
        const claimed = yield* Deferred.make<void>();
        const releaseClaim = yield* Deferred.make<void>();
        const interruptingFileSystem = FileSystem.FileSystem.of({
          ...fs,
          symlink: Effect.fn("LeJeuneBundleBuilderTest.interruptingSymlink")((target, linkPath) =>
            fs
              .symlink(target, linkPath)
              .pipe(Effect.andThen(Deferred.succeed(claimed, undefined)), Effect.andThen(Deferred.await(releaseClaim)))
          ),
        });

        const build = yield* buildBundle(
          inputFor(bundleRoot, mutableRoot, path.resolve("src/fixtures/provider-recording.json"))
        ).pipe(Effect.provideService(FileSystem.FileSystem, interruptingFileSystem), Effect.forkChild);
        yield* Deferred.await(claimed);
        const interrupt = yield* Effect.forkChild(Fiber.interrupt(build));
        yield* Deferred.succeed(releaseClaim, undefined);
        const exit = yield* Fiber.await(build);
        yield* Fiber.join(interrupt);

        pipe(exit, Exit.isSuccess, assertTrue);
        pipe(yield* fs.exists(path.join(bundleRoot, "bundle.json")), assertTrue);
        pipe(yield* fs.exists(path.join(mutableRoot, "review-ledger.json")), assertTrue);
        pipe(
          A.every(yield* fs.readDirectory(parent), (entry) => !Str.includes(".staging-")(entry)),
          assertTrue
        );
      })
    );
  });

  it.layer(Layer.mergeAll(BunServices.layer, BunCrypto.layer), { timeout: "30 seconds" })((it) => {
    it.effect("publishes durable byte-identical replay outputs across two fresh builds", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const parent = yield* fs.makeTempDirectoryScoped({ prefix: "lejeune-builder-success-" });
        const recordingPath = path.resolve("src/fixtures/provider-recording.json");
        const firstPublicationRoot = path.join(parent, "publication-first");
        const firstBundleRoot = path.join(firstPublicationRoot, "bundle");
        const firstMutableRoot = path.join(firstPublicationRoot, "review");
        const secondPublicationRoot = path.join(parent, "publication-second");
        const secondBundleRoot = path.join(secondPublicationRoot, "bundle");
        const secondMutableRoot = path.join(secondPublicationRoot, "review");

        const firstReceipt = yield* buildBundle(inputFor(firstBundleRoot, firstMutableRoot, recordingPath));
        const secondReceipt = yield* buildBundle(inputFor(secondBundleRoot, secondMutableRoot, recordingPath));
        const firstBundleText = yield* fs.readFileString(path.join(firstBundleRoot, "bundle.json"));
        const firstReceiptText = yield* fs.readFileString(path.join(firstBundleRoot, "golden-replay.json"));
        const firstLedgerText = yield* fs.readFileString(path.join(firstMutableRoot, "review-ledger.json"));
        const firstRetentionMetadataText = yield* fs.readFileString(
          path.join(firstMutableRoot, "retention-metadata.json")
        );
        const firstProjectionMetadataText = yield* fs.readFileString(
          path.join(firstBundleRoot, "projection-metadata.json")
        );

        expect(secondReceipt.bundleIdentity).toBe(firstReceipt.bundleIdentity);
        expect(yield* fs.readFileString(path.join(secondBundleRoot, "bundle.json"))).toBe(firstBundleText);
        expect(yield* fs.readFileString(path.join(secondBundleRoot, "golden-replay.json"))).toBe(firstReceiptText);
        expect(yield* fs.readFileString(path.join(secondMutableRoot, "review-ledger.json"))).toBe(firstLedgerText);
        expect(yield* fs.readFileString(path.join(secondMutableRoot, "retention-metadata.json"))).toBe(
          firstRetentionMetadataText
        );
        yield* Effect.forEach(
          ["rfq-a-outlook-body.txt", "rfq-a-takeoff.xlsx", "rfq-b-prose-email.txt", "rfq-b-schedule.pdf"],
          (fixtureName) =>
            Effect.gen(function* () {
              const firstBytes = yield* fs.readFile(path.join(firstBundleRoot, "synthetic-fixtures", fixtureName));
              const secondBytes = yield* fs.readFile(path.join(secondBundleRoot, "synthetic-fixtures", fixtureName));
              expect(secondBytes).toEqual(firstBytes);
            }),
          { concurrency: 4, discard: true }
        );
        pipe(yield* fs.exists(path.join(firstBundleRoot, "corpus.duckdb")), assertTrue);
        pipe(yield* fs.exists(path.join(firstBundleRoot, "app-review.pglite")), assertTrue);
        const projectionMetadata = yield* decodeProjectionStoreMetadataFromJsonString(firstProjectionMetadataText);
        expect(projectionMetadata.bundleIdentity).toBe(firstReceipt.bundleIdentity);
        expect(projectionMetadata.bundleVersion).toBe("lejeune-demo-bundle/v1");
        const retentionMetadata = yield* decodeMutableRetentionMetadataFromJsonString(firstRetentionMetadataText);
        expect(retentionMetadata.disposition).toBe("delete-or-promote");
        expect(retentionMetadata.dispositionDate).toBe("2026-09-30");
        assertNone(retentionMetadata.retentionAuthorization);
        expect(retentionMetadata.schemaVersion).toBe("lejeune-retention-metadata/v1");
        const validReadback = PublicationReadbackInput.make({
          bundleText: firstBundleText,
          expectedRetentionMetadata: retentionMetadata,
          ledgerText: firstLedgerText,
          projectionMetadataText: firstProjectionMetadataText,
          receiptText: firstReceiptText,
          retentionMetadataText: firstRetentionMetadataText,
        });
        const aggregate = yield* verifyPublicationReadback(validReadback);
        expect(aggregate.bundleIdentity).toBe(firstReceipt.bundleIdentity);

        const receipt = yield* decodeGoldenReplayReceiptFromJsonString(firstReceiptText);
        const wrongIdentity = Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000");
        const wrongReceiptText = yield* encodeGoldenReplayReceiptFromJsonString(
          GoldenReplayReceipt.make({ ...receipt, bundleIdentity: wrongIdentity })
        );
        const wrongProjectionMetadataText = yield* encodeProjectionStoreMetadataFromJsonString(
          ProjectionStoreMetadata.make({ ...projectionMetadata, bundleIdentity: wrongIdentity })
        );
        const nonEmptyLedgerText = Str.replace(
          '"approvals": []',
          '"approvals": [{"decision":"approve","id":"approval-one","recordedAt":"2026-08-27T13:00:00.000Z","reviewer":"Demo reviewer","subjectId":"dangling-subject"}]'
        )(firstLedgerText);
        const extendedAuthorization = RetentionAuthorization.make({
          authorization: "promoted",
          authorizedAt: IsoTimestamp.make("2026-09-29T12:00:00.000Z"),
          decisionReference: "approved-goal:different-retention",
          newDispositionDate: IsoDate.make("2026-10-31"),
          owner: "LeJeune demo operator",
        });
        const differentExpectedRetention = MutableRetentionMetadata.make({
          disposition: "delete-or-promote",
          dispositionDate: extendedAuthorization.newDispositionDate,
          retentionAuthorization: O.some(extendedAuthorization),
        });
        const corruptedReadbacks: ReadonlyArray<readonly [string, PublicationReadbackInput]> = [
          [
            "bundle-bytes",
            PublicationReadbackInput.make({
              ...validReadback,
              bundleText: `${firstBundleText}\n`,
            }),
          ],
          ["receipt-identity", PublicationReadbackInput.make({ ...validReadback, receiptText: wrongReceiptText })],
          [
            "projection-identity",
            PublicationReadbackInput.make({
              ...validReadback,
              projectionMetadataText: wrongProjectionMetadataText,
            }),
          ],
          ["non-empty-ledger", PublicationReadbackInput.make({ ...validReadback, ledgerText: nonEmptyLedgerText })],
          [
            "retention-policy",
            PublicationReadbackInput.make({
              ...validReadback,
              expectedRetentionMetadata: differentExpectedRetention,
            }),
          ],
        ];
        for (const [name, corruptedReadback] of corruptedReadbacks) {
          const failure = yield* Effect.flip(verifyPublicationReadback(corruptedReadback));
          expect(failure.stage, name).toBe("validation");
        }
        pipe(
          A.every(yield* fs.readDirectory(parent), (entry) => !Str.includes(".staging-")(entry)),
          assertTrue
        );
      })
    );
  });

  it.layer(Layer.mergeAll(BunServices.layer, BunCrypto.layer), { timeout: "30 seconds" })((it) => {
    it.effect("refuses mutable publication on the disposition date without reviewed authority", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const parent = yield* fs.makeTempDirectoryScoped({ prefix: "lejeune-builder-retention-refusal-" });
        const publicationRoot = path.join(parent, "publication");
        const bundleRoot = path.join(publicationRoot, "bundle");
        const mutableRoot = path.join(publicationRoot, "review");
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-09-30T00:00:00.000Z").epochMilliseconds);

        const error = yield* buildBundle(
          inputFor(bundleRoot, mutableRoot, path.resolve("src/fixtures/provider-recording.json"))
        ).pipe(Effect.flip);

        expect(error.stage).toBe("retention");
        pipe(yield* fs.exists(publicationRoot), assertFalse);
        pipe(
          A.every(yield* fs.readDirectory(parent), (entry) => !Str.includes(".staging-")(entry)),
          assertTrue
        );
      })
    );
  });

  it.layer(Layer.mergeAll(BunServices.layer, BunCrypto.layer), { timeout: "30 seconds" })((it) => {
    it.effect("publishes after the disposition date only with a valid reviewed extension", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const parent = yield* fs.makeTempDirectoryScoped({ prefix: "lejeune-builder-retention-authorized-" });
        const publicationRoot = path.join(parent, "publication");
        const bundleRoot = path.join(publicationRoot, "bundle");
        const mutableRoot = path.join(publicationRoot, "review");
        const authorizationPath = path.join(parent, "retention-authorization.json");
        const authorization = RetentionAuthorization.make({
          authorization: "consented-pilot",
          authorizedAt: IsoTimestamp.make("2026-09-29T12:00:00.000Z"),
          decisionReference: "approved-goal:lejeune-pilot-extension",
          newDispositionDate: IsoDate.make("2026-10-31"),
          owner: "LeJeune demo operator",
        });
        const authorizationJson = yield* encodeRetentionAuthorizationFromJsonString(authorization);
        yield* fs.writeFileString(authorizationPath, `${authorizationJson}\n`);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-01T00:00:00.000Z").epochMilliseconds);

        yield* buildBundle(
          inputFor(
            bundleRoot,
            mutableRoot,
            path.resolve("src/fixtures/provider-recording.json"),
            O.some(authorizationPath)
          )
        );

        pipe(yield* fs.exists(path.join(bundleRoot, "bundle.json")), assertTrue);
        pipe(yield* fs.exists(path.join(mutableRoot, "review-ledger.json")), assertTrue);
        const retentionMetadata = yield* fs
          .readFileString(path.join(mutableRoot, "retention-metadata.json"))
          .pipe(Effect.flatMap(decodeMutableRetentionMetadataFromJsonString));
        expect(retentionMetadata.disposition).toBe("delete-or-promote");
        expect(retentionMetadata.dispositionDate).toBe("2026-10-31");
        expect(retentionMetadata.schemaVersion).toBe("lejeune-retention-metadata/v1");
        pipe(retentionMetadata.retentionAuthorization, O.isSome, assertTrue);
        if (O.isSome(retentionMetadata.retentionAuthorization)) {
          expect(retentionMetadata.retentionAuthorization.value.authorization).toBe("consented-pilot");
          expect(retentionMetadata.retentionAuthorization.value.authorizedAt).toBe("2026-09-29T12:00:00.000Z");
          expect(retentionMetadata.retentionAuthorization.value.decisionReference).toBe(
            "approved-goal:lejeune-pilot-extension"
          );
          expect(retentionMetadata.retentionAuthorization.value.newDispositionDate).toBe("2026-10-31");
          expect(retentionMetadata.retentionAuthorization.value.owner).toBe("LeJeune demo operator");
          expect(retentionMetadata.retentionAuthorization.value.schemaVersion).toBe(
            "lejeune-retention-authorization/v1"
          );
        }
        const immutableBundle = yield* fs.readFileString(path.join(bundleRoot, "bundle.json"));
        pipe(Str.includes("retentionAuthorization")(immutableBundle), assertFalse);
      })
    );
  });

  it.layer(Layer.mergeAll(BunServices.layer, BunCrypto.layer), { timeout: "30 seconds" })((it) => {
    it.effect("rejects a reviewed extension on its effective disposition date", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const parent = yield* fs.makeTempDirectoryScoped({ prefix: "lejeune-builder-retention-expired-" });
        const publicationRoot = path.join(parent, "publication");
        const bundleRoot = path.join(publicationRoot, "bundle");
        const mutableRoot = path.join(publicationRoot, "review");
        const authorizationPath = path.join(parent, "retention-authorization.json");
        const authorization = RetentionAuthorization.make({
          authorization: "promoted",
          authorizedAt: IsoTimestamp.make("2026-09-29T12:00:00.000Z"),
          decisionReference: "approved-goal:lejeune-promotion",
          newDispositionDate: IsoDate.make("2026-10-31"),
          owner: "LeJeune demo operator",
        });
        const authorizationJson = yield* encodeRetentionAuthorizationFromJsonString(authorization);
        yield* fs.writeFileString(authorizationPath, `${authorizationJson}\n`);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00.000Z").epochMilliseconds);

        const error = yield* buildBundle(
          inputFor(
            bundleRoot,
            mutableRoot,
            path.resolve("src/fixtures/provider-recording.json"),
            O.some(authorizationPath)
          )
        ).pipe(Effect.flip);

        expect(error.stage).toBe("retention");
        pipe(yield* fs.exists(publicationRoot), assertFalse);
        pipe(
          A.every(yield* fs.readDirectory(parent), (entry) => !Str.includes(".staging-")(entry)),
          assertTrue
        );
      })
    );
  });
});
