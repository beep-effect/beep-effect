import {
  CacheQualificationLive,
  CacheQualificationService,
  CacheTransitionRequest,
} from "@beep/repo-cli/commands/Cache";
import { readContainedFileBytesNoFollow } from "@beep/repo-cli/test/Cli";
import {
  CacheEvidenceReference,
  CachePolicyBaseline,
  CachePolicyProjection,
  CacheQualificationEntry,
  CacheQualificationEvent,
  CacheQualificationKey,
  CacheQualificationStore,
  CacheReviewDecision,
} from "@beep/repo-configs/cache";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { PosInt } from "@beep/schema/Int";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Result";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const platform = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer))
);
const testLayer = CacheQualificationLive.pipe(Layer.provideMerge(platform));
const key = CacheQualificationKey.make({
  computation: "@beep/fixture#lint",
  layer: "turbo-task-result",
  profile: "fixture-profile",
  epoch: "v1",
});
const hashBytes = S.decodeEffect(Sha256HexFromBytes);

const encodeCachePolicyBaselineJson = S.encodeEffect(S.fromJsonString(CachePolicyBaseline));

const encodeCacheQualificationStoreJson = S.encodeEffect(S.fromJsonString(CacheQualificationStore));

const fixture = Effect.fn("CacheQualificationTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-qualification-test-" });
  yield* fs.makeDirectory(path.join(root, "standards"));
  const basis = "Reviewed synthetic qualification boundary.\n";
  yield* fs.writeFileString(path.join(root, "review.md"), basis);
  const sha256 = yield* hashBytes(new TextEncoder().encode(basis));
  const review = CacheReviewDecision.make({
    reviewer: "fixture",
    reason: "exclude unqualified computation",
    basis: CacheEvidenceReference.make({ path: "review.md", sha256 }),
  });
  const baseline = CachePolicyBaseline.make({
    review,
    scope: [key.computation],
    profile: key.profile,
    epoch: key.epoch,
    projection: CachePolicyProjection.make({ globalConfiguration: {}, nodes: [], sources: [] }),
  });
  const text = yield* encodeCachePolicyBaselineJson(baseline);
  yield* fs.writeFileString(path.join(root, "standards/cache-qualification-baseline.json"), text);
  yield* fs.writeFileString(
    path.join(root, "standards/cache-qualification.json"),
    yield* encodeCacheQualificationStoreJson(
      CacheQualificationStore.make({ revision: NonNegativeInt.make(0), entries: [], history: [] })
    )
  );
  const entry = CacheQualificationEntry.make({ key, status: { state: "excluded", review } });
  const request = CacheTransitionRequest.make({ expectedRevision: NonNegativeInt.make(0), entry });
  return { root, fs, path, request, entry };
});
const encodeCacheQualificationStoreJsonResult = S.encodeResult(S.fromJsonString(CacheQualificationStore));

const decodeCacheQualificationStoreJsonResult = S.decodeResult(S.fromJsonString(CacheQualificationStore));

describe("Cache qualification writer", () => {
  it("preserves ledger revisions and tuples through schema serialization", () => {
    const equivalent = S.toEquivalence(CacheQualificationStore);
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.schema(CacheQualificationStore),
          (value) => {
            const encoded = R.getOrThrow(encodeCacheQualificationStoreJsonResult(value));
            const decoded = R.getOrThrow(decodeCacheQualificationStoreJsonResult(encoded));
            expect(equivalent(value, decoded)).toBe(true);
            return true;
          },
          fcRuns(20)
        )
      )._tag
    ).toBe("Passed");
  });
  it.effect(
    "persists a reviewed exclusion and rejects stale revisions without changing the ledger",
    Effect.fnUntraced(function* () {
      const { root, fs, path, request } = yield* fixture();
      const cache = yield* CacheQualificationService;
      expect((yield* cache.inspect(root)).entries).toEqual([]);
      const result = yield* cache.transition(root, request);
      expect(result.revision).toBe(1);
      expect(result.history).toEqual([
        CacheQualificationEvent.make({ revision: PosInt.make(1), entry: request.entry }),
      ]);
      expect(yield* cache.inspect(root)).toEqual(result);
      const target = path.join(root, "standards/cache-qualification.json");
      const before = yield* fs.readFileString(target);
      expect(yield* cache.transition(root, request).pipe(Effect.isFailure)).toBe(true);
      expect(yield* fs.readFileString(target)).toBe(before);
      expect(yield* fs.exists(path.join(root, ".beep/cache/qualification.writer"))).toBe(false);
    }, provideScopedLayer(testLayer))
  );

  it.effect(
    "allows only one competing revision-zero writer",
    Effect.fnUntraced(function* () {
      const { root, request } = yield* fixture();
      const cache = yield* CacheQualificationService;
      const results = yield* Effect.all(
        [cache.transition(root, request).pipe(Effect.result), cache.transition(root, request).pipe(Effect.result)],
        { concurrency: 2 }
      );
      expect(A.length(A.filter(results, R.isSuccess))).toBe(1);
      expect(A.length(A.filter(results, R.isFailure))).toBe(1);
      expect((yield* cache.inspect(root)).revision).toBe(1);
    }, provideScopedLayer(testLayer))
  );

  it.effect(
    "refuses tampered review bytes, unsupported profiles and skipped lifecycle stages",
    Effect.fnUntraced(function* () {
      const { root, request, fs, path, entry } = yield* fixture();
      const cache = yield* CacheQualificationService;
      const otherProfile = CacheTransitionRequest.make({
        ...request,
        entry: CacheQualificationEntry.make({
          ...entry,
          key: CacheQualificationKey.make({ ...key, profile: "other" }),
        }),
      });
      expect(yield* cache.transition(root, otherProfile).pipe(Effect.isFailure)).toBe(true);
      const unassessed = CacheTransitionRequest.make({
        ...request,
        entry: CacheQualificationEntry.make({ key, status: { state: "unassessed", reason: "erase review" } }),
      });
      expect(yield* cache.transition(root, unassessed).pipe(Effect.isFailure)).toBe(true);
      yield* fs.writeFileString(path.join(root, "review.md"), "changed review");
      expect(yield* cache.transition(root, request).pipe(Effect.isFailure)).toBe(true);
      expect((yield* cache.inspect(root)).revision).toBe(0);
    }, provideScopedLayer(testLayer))
  );

  it.effect(
    "refuses symlinked evidence and an existing writer lock",
    Effect.fnUntraced(function* () {
      const { root, request, fs, path } = yield* fixture();
      const cache = yield* CacheQualificationService;
      yield* fs.rename(path.join(root, "review.md"), path.join(root, "source.md"));
      yield* fs.symlink(path.join(root, "source.md"), path.join(root, "review.md"));
      expect(yield* cache.transition(root, request).pipe(Effect.isFailure)).toBe(true);
      yield* fs.remove(path.join(root, "review.md"));
      yield* fs.rename(path.join(root, "source.md"), path.join(root, "review.md"));
      yield* fs.makeDirectory(path.join(root, ".beep/cache/qualification.writer"));
      expect(yield* cache.transition(root, request).pipe(Effect.isFailure)).toBe(true);
      expect(yield* fs.exists(path.join(root, ".beep/cache/qualification.writer"))).toBe(true);
      expect((yield* cache.inspect(root)).entries).toEqual([]);
    }, provideScopedLayer(testLayer))
  );

  it.effect(
    "fails closed on missing, malformed and duplicate tuple ledgers",
    Effect.fnUntraced(function* () {
      const { root, fs, path, entry } = yield* fixture();
      const cache = yield* CacheQualificationService;
      const target = path.join(root, "standards/cache-qualification.json");
      yield* fs.remove(target);
      expect(yield* cache.inspect(root).pipe(Effect.isFailure)).toBe(true);
      yield* fs.writeFileString(target, "{}");
      expect(yield* cache.inspect(root).pipe(Effect.isFailure)).toBe(true);
      const duplicate = CacheQualificationStore.make({
        revision: NonNegativeInt.make(2),
        entries: [entry, entry],
        history: [],
      });
      yield* fs.writeFileString(target, yield* encodeCacheQualificationStoreJson(duplicate));
      expect(yield* cache.inspect(root).pipe(Effect.isFailure)).toBe(true);
    }, provideScopedLayer(testLayer))
  );
});

// These are original-byte and safety-boundary tests, not passing qualification receipts.
describe("bounded qualification evidence", () => {
  it.effect(
    "preserves original bytes and rejects overflow and symlinks",
    Effect.fnUntraced(function* () {
      const { root, fs, path } = yield* fixture();
      const target = path.join(root, "bytes.bin");
      const bytes = new Uint8Array([0, 255, 128, 1]);
      yield* fs.writeFile(target, bytes);
      const read = yield* readContainedFileBytesNoFollow(root, "bytes.bin", NonNegativeInt.make(4));
      expect(O.getOrThrow(read.contents)).toEqual(bytes);
      expect(
        yield* readContainedFileBytesNoFollow(root, "bytes.bin", NonNegativeInt.make(3)).pipe(Effect.isFailure)
      ).toBe(true);
      yield* fs.symlink(target, path.join(root, "linked.bin"));
      expect(
        yield* readContainedFileBytesNoFollow(root, "linked.bin", NonNegativeInt.make(4)).pipe(Effect.isFailure)
      ).toBe(true);
      expect(
        yield* readContainedFileBytesNoFollow(root, "../outside.bin", NonNegativeInt.make(4)).pipe(Effect.isFailure)
      ).toBe(true);
      yield* fs.writeFile(target, new Uint8Array(0));
      const empty = yield* readContainedFileBytesNoFollow(root, "bytes.bin", NonNegativeInt.make(0));
      expect(O.getOrThrow(empty.contents).byteLength).toBe(0);
    }, provideScopedLayer(testLayer))
  );

  it.effect(
    "rejects malformed UTF-8 and an oversized ledger before interpreting state",
    Effect.fnUntraced(function* () {
      const { root, fs, path } = yield* fixture();
      const cache = yield* CacheQualificationService;
      const target = path.join(root, "standards/cache-qualification.json");
      yield* fs.writeFile(target, new Uint8Array([255]));
      expect(yield* cache.inspect(root).pipe(Effect.isFailure)).toBe(true);
      yield* fs.writeFile(target, new Uint8Array(8 * 1024 * 1024 + 1));
      expect(yield* cache.inspect(root).pipe(Effect.isFailure)).toBe(true);
    }, provideScopedLayer(testLayer))
  );
});
