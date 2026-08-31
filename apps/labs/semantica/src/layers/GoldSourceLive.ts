import { SchemaUtils, Sha256Hex } from "@beep/schema";
import { Crypto, Effect, FileSystem, Layer, Path, Tuple } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GOLD_SUBSETS, GoldArtifactSemantics } from "@/canary/Gold";
import { contentDigest } from "@/schema/Digest";
import { Origin } from "@/schema/Document";
import { GoldUnavailable } from "@/schema/Errors";
import { CurrentGoldDocumentText, GoldFile, GoldFileEncoded, GoldRef } from "@/schema/Gold";
import { ModelIdentity } from "@/schema/Model";
import { GoldSource } from "@/services/GoldSource";
import type { CorpusPaperId } from "@/corpus/Manifest";
import type { GoldFile as GoldFileValue } from "@/schema/Gold";
import type { LedgerDocumentSnapshot } from "@/schema/Ledger";

const GoldFileJson = S.fromJsonString(GoldFileEncoded).pipe(
  SchemaUtils.withStatics((schema) => ({
    decodeEffect: S.decodeEffect(schema),
  }))
);
const GoldRefJson = S.fromJsonString(GoldRef).pipe(
  SchemaUtils.withStatics((schema) => ({
    decodeEffect: S.decodeEffect(schema),
  }))
);
const sha256Equivalence = S.toEquivalence(Sha256Hex);

const unavailable = (reason: GoldUnavailable["reason"], message: string): GoldUnavailable =>
  GoldUnavailable.make({ message, reason });

const makeGoldSource = Effect.fn("GoldSource.make")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const crypto = yield* Crypto.Crypto;

  const readReference = Effect.fn("GoldSource.readReference")(function* () {
    const referencePath = path.join(directory, "gold.json");
    const exists = yield* fs
      .exists(referencePath)
      .pipe(Effect.mapError(() => unavailable("read-failed", "The gold-v1 reference could not be inspected.")));
    if (!exists) {
      return yield* unavailable("read-failed", "The gold-v1 reference is unavailable.");
    }
    return yield* fs.readFileString(referencePath).pipe(
      Effect.flatMap(GoldRefJson.decodeEffect),
      Effect.mapError(() => unavailable("read-failed", "The gold-v1 reference could not be read or decoded."))
    );
  });

  const readCoveredFile = Effect.fn("GoldSource.readCoveredFile")(function* (
    paperId: CorpusPaperId,
    subset: GoldFileValue["subset"]
  ) {
    const filePath = path.join(directory, `${paperId}.${subset}.json`);
    const exists = yield* fs
      .exists(filePath)
      .pipe(Effect.mapError(() => unavailable("read-failed", "A covered gold-v1 file could not be inspected.")));
    if (!exists) {
      return yield* unavailable("stale-reference", "The gold-v1 reference covers a missing label file.");
    }
    const file = yield* fs.readFileString(filePath).pipe(
      Effect.flatMap(GoldFileJson.decodeEffect),
      Effect.mapError(() => unavailable("read-failed", "A covered gold-v1 file could not be read or decoded."))
    );
    if (!Str.Equivalence(file.paperId, paperId) || !Str.Equivalence(file.subset, subset)) {
      return yield* unavailable("stale-reference", "A covered gold-v1 file does not match its reference identity.");
    }
    return file;
  });

  const hydrateCoveredFile = Effect.fn("GoldSource.hydrateCoveredFile")(function* (
    file: GoldFileEncoded,
    documents: ReadonlyArray<LedgerDocumentSnapshot>
  ) {
    const empty =
      (file.subset === "structure" && A.isReadonlyArrayEmpty(file.labels)) ||
      (file.subset === "entity" && A.isReadonlyArrayEmpty(file.labels)) ||
      (file.subset === "relation" && A.isReadonlyArrayEmpty(file.labels));
    if (empty) {
      return yield* S.decodeEffect(GoldFile)(file).pipe(
        Effect.provideService(CurrentGoldDocumentText, ""),
        Effect.mapError(() => unavailable("read-failed", "An empty gold-v1 file failed decoded-shape validation."))
      );
    }
    const document = yield* A.findFirst(documents, (candidate) =>
      Origin.match(candidate.document.origin, {
        Fixture: () => false,
        W1Paper: (origin) => Str.Equivalence(origin.paperId, file.paperId),
      })
    ).pipe(
      Effect.fromOption,
      Effect.mapError(() =>
        unavailable("source-unavailable", "A selected gold-v1 file has no matching ledger document snapshot.")
      )
    );
    const canonical = yield* document.canonical.pipe(
      Effect.fromOption,
      Effect.mapError(() =>
        unavailable("source-unavailable", "A selected gold-v1 file has no canonical ledger document text.")
      )
    );
    return yield* S.decodeEffect(GoldFile)(file).pipe(
      Effect.provideService(CurrentGoldDocumentText, canonical.text),
      Effect.mapError(() =>
        unavailable("digest-failed", "A gold-v1 label digest does not match its canonical document slice.")
      )
    );
  });

  return GoldSource.of({
    load: Effect.fn("GoldSource.load")(function* (paperIds, documents) {
      const reference = yield* readReference();
      const jobs = A.flatMap(GOLD_SUBSETS, (subset) =>
        A.map(reference.subsets[subset], (paperId) => Tuple.make(paperId, subset))
      );
      const files = A.sort(
        yield* Effect.forEach(jobs, ([paperId, subset]) => readCoveredFile(paperId, subset), { concurrency: 4 }),
        GoldArtifactSemantics.fileOrder
      );
      const digest = yield* contentDigest(S.Array(GoldFileEncoded))(files).pipe(
        Effect.provideService(Crypto.Crypto, crypto),
        Effect.mapError(() => unavailable("digest-failed", "The covered gold-v1 files could not be hashed."))
      );
      const encodedProposer = yield* S.encodeEffect(ModelIdentity)(reference.proposer).pipe(Effect.orDie);
      if (
        !sha256Equivalence(digest, reference.digest) ||
        A.some(files, (file) => !GoldArtifactSemantics.modelIdentityEquivalence(file.proposer, encodedProposer))
      ) {
        return yield* unavailable(
          "stale-reference",
          "The gold-v1 reference digest or proposer does not match its covered label files."
        );
      }
      return yield* Effect.forEach(
        A.filter(files, (file) => A.contains(paperIds, file.paperId)),
        (file) => hydrateCoveredFile(file, documents),
        { concurrency: 4 }
      );
    }),
  });
});

/**
 * Filesystem gold-v1 loader. The complete referenced label set is verified
 * before selected paper coverage is returned.
 *
 * **Example** (Create the default loader)
 *
 * ```ts
 * import { GoldSourceLive } from "@/layers/GoldSourceLive"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(GoldSourceLive())) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GoldSourceLive = (directory = "fixtures/gold/v1") => Layer.effect(GoldSource, makeGoldSource(directory));
