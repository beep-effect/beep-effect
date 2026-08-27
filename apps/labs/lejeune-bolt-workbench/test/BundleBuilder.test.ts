// @vitest-environment node

import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, FileSystem, Layer, Path, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc, TestClock } from "effect/testing";
import {
  MutableRetentionMetadata,
  MutableRetentionMetadataFromJsonString,
  ProjectionStoreMetadataFromJsonString,
  RetentionAuthorization,
  RetentionAuthorizationFromJsonString,
} from "@/domain/Bundle";
import { IsoDate, IsoTimestamp } from "@/domain/Ontology";
import { BundleBuildInput, buildBundle } from "../server/build-bundle";

const provideTestRuntime = provideScopedLayer(Layer.mergeAll(BunServices.layer, BunCrypto.layer));

const inputFor = (
  bundleRoot: string,
  mutableRoot: string,
  recordingPath: string,
  retentionAuthorizationPath: O.Option<string> = O.none()
): BundleBuildInput => BundleBuildInput.make({ bundleRoot, mutableRoot, recordingPath, retentionAuthorizationPath });

describe("LeJeune transactional bundle builder", () => {
  it("round-trips schema-derived mutable retention metadata", () => {
    const encode = S.encodeResult(MutableRetentionMetadata);
    const decode = S.decodeUnknownResult(MutableRetentionMetadata);
    const equivalent = S.toEquivalence(MutableRetentionMetadata);

    fc.assert(
      fc.property(S.toArbitrary(MutableRetentionMetadata)(fc), (value) =>
        encode(value).pipe(
          Result.flatMap(decode),
          Result.match({
            onFailure: () => false,
            onSuccess: (decoded) => equivalent(decoded, value),
          })
        )
      ),
      fcRuns(20)
    );
  });

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
      expect(yield* fs.exists(bundleRoot)).toBe(false);
      expect(yield* fs.readFileString(sentinel)).toBe("retain-me\n");
      expect(yield* fs.readDirectory(mutableRoot)).toEqual(["sentinel.txt"]);
    }).pipe(provideTestRuntime)
  );

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
      expect(yield* fs.exists(mutableRoot)).toBe(false);
      expect(yield* fs.readFileString(sentinel)).toBe("retain-me\n");
      expect(yield* fs.readDirectory(bundleRoot)).toEqual(["sentinel.txt"]);
    }).pipe(provideTestRuntime)
  );

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
      expect(yield* fs.exists(sharedRoot)).toBe(false);
      expect(yield* fs.exists(path.join(parent, "publication"))).toBe(false);
    }).pipe(provideTestRuntime)
  );

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
      expect(yield* fs.exists(bundleRoot)).toBe(false);
      expect(yield* fs.exists(path.join(parent, "publication"))).toBe(false);
    }).pipe(provideTestRuntime)
  );

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
      expect(yield* fs.exists(path.join(parent, "immutable-publication"))).toBe(false);
      expect(yield* fs.exists(path.join(parent, "mutable-publication"))).toBe(false);
    }).pipe(provideTestRuntime)
  );

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
      expect(yield* fs.exists(publicationRoot)).toBe(false);
      expect(A.every(yield* fs.readDirectory(parent), (entry) => !Str.includes(".staging-")(entry))).toBe(true);
    }).pipe(provideTestRuntime)
  );

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

      expect(secondReceipt.bundleIdentity).toBe(firstReceipt.bundleIdentity);
      expect(yield* fs.readFileString(path.join(secondBundleRoot, "bundle.json"))).toBe(
        yield* fs.readFileString(path.join(firstBundleRoot, "bundle.json"))
      );
      expect(yield* fs.readFileString(path.join(secondBundleRoot, "golden-replay.json"))).toBe(
        yield* fs.readFileString(path.join(firstBundleRoot, "golden-replay.json"))
      );
      expect(yield* fs.readFileString(path.join(secondMutableRoot, "review-ledger.json"))).toBe(
        yield* fs.readFileString(path.join(firstMutableRoot, "review-ledger.json"))
      );
      expect(yield* fs.readFileString(path.join(secondMutableRoot, "retention-metadata.json"))).toBe(
        yield* fs.readFileString(path.join(firstMutableRoot, "retention-metadata.json"))
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
      expect(yield* fs.exists(path.join(firstBundleRoot, "corpus.duckdb"))).toBe(true);
      expect(yield* fs.exists(path.join(firstBundleRoot, "app-review.pglite"))).toBe(true);
      const projectionMetadata = yield* fs
        .readFileString(path.join(firstBundleRoot, "projection-metadata.json"))
        .pipe(Effect.flatMap(S.decodeEffect(ProjectionStoreMetadataFromJsonString)));
      expect(projectionMetadata.bundleIdentity).toBe(firstReceipt.bundleIdentity);
      expect(projectionMetadata.bundleVersion).toBe("lejeune-demo-bundle/v1");
      const retentionMetadata = yield* fs
        .readFileString(path.join(firstMutableRoot, "retention-metadata.json"))
        .pipe(Effect.flatMap(S.decodeEffect(MutableRetentionMetadataFromJsonString)));
      expect(retentionMetadata.disposition).toBe("delete-or-promote");
      expect(retentionMetadata.dispositionDate).toBe("2026-09-30");
      expect(O.isNone(retentionMetadata.retentionAuthorization)).toBe(true);
      expect(retentionMetadata.schemaVersion).toBe("lejeune-retention-metadata/v1");
      expect(A.every(yield* fs.readDirectory(parent), (entry) => !Str.includes(".staging-")(entry))).toBe(true);
    }).pipe(provideTestRuntime)
  );

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
      expect(yield* fs.exists(publicationRoot)).toBe(false);
      expect(A.every(yield* fs.readDirectory(parent), (entry) => !Str.includes(".staging-")(entry))).toBe(true);
    }).pipe(provideTestRuntime)
  );

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
      const authorizationJson = yield* S.encodeEffect(RetentionAuthorizationFromJsonString)(authorization);
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

      expect(yield* fs.exists(path.join(bundleRoot, "bundle.json"))).toBe(true);
      expect(yield* fs.exists(path.join(mutableRoot, "review-ledger.json"))).toBe(true);
      const retentionMetadata = yield* fs
        .readFileString(path.join(mutableRoot, "retention-metadata.json"))
        .pipe(Effect.flatMap(S.decodeEffect(MutableRetentionMetadataFromJsonString)));
      expect(retentionMetadata.disposition).toBe("delete-or-promote");
      expect(retentionMetadata.dispositionDate).toBe("2026-10-31");
      expect(retentionMetadata.schemaVersion).toBe("lejeune-retention-metadata/v1");
      expect(O.isSome(retentionMetadata.retentionAuthorization)).toBe(true);
      if (O.isSome(retentionMetadata.retentionAuthorization)) {
        expect(retentionMetadata.retentionAuthorization.value.authorization).toBe("consented-pilot");
        expect(retentionMetadata.retentionAuthorization.value.authorizedAt).toBe("2026-09-29T12:00:00.000Z");
        expect(retentionMetadata.retentionAuthorization.value.decisionReference).toBe(
          "approved-goal:lejeune-pilot-extension"
        );
        expect(retentionMetadata.retentionAuthorization.value.newDispositionDate).toBe("2026-10-31");
        expect(retentionMetadata.retentionAuthorization.value.owner).toBe("LeJeune demo operator");
        expect(retentionMetadata.retentionAuthorization.value.schemaVersion).toBe("lejeune-retention-authorization/v1");
      }
      const immutableBundle = yield* fs.readFileString(path.join(bundleRoot, "bundle.json"));
      expect(Str.includes("retentionAuthorization")(immutableBundle)).toBe(false);
    }).pipe(provideTestRuntime)
  );

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
      const authorizationJson = yield* S.encodeEffect(RetentionAuthorizationFromJsonString)(authorization);
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
      expect(yield* fs.exists(publicationRoot)).toBe(false);
      expect(A.every(yield* fs.readDirectory(parent), (entry) => !Str.includes(".staging-")(entry))).toBe(true);
    }).pipe(provideTestRuntime)
  );
});
