/**
 * Candidate set construction and copying adapted from CPython 3.11.15 setobject.c.
 * Python Software Foundation License Version 2; see THIRD_PARTY_NOTICES.md.
 * Effect adaptation: bounded work, schema-owned keys and captured comparison.
 * Deletion, general set APIs and reentrant comparison are separate obligations.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import {
  CitationRuntimeDictionaryComparison,
  CitationRuntimeDictionaryFailure,
  CitationRuntimeDictionaryKey,
  CitationRuntimeDictionaryLimits,
} from "./RuntimeDictionary.ts";

const CitationRuntimeDictionaryLimitsType = S.toType(CitationRuntimeDictionaryLimits);
const CitationRuntimeDictionaryKeyType = S.toType(CitationRuntimeDictionaryKey);

const failure = (reason: CitationRuntimeDictionaryFailure["reason"]) =>
  CitationRuntimeDictionaryFailure.make({ reason });
const indexOf = (value: bigint, size: number) => Number(value & BigInt(size - 1));
interface RuntimeSetService {
  readonly add: (key: CitationRuntimeDictionaryKey) => Effect.Effect<void, CitationRuntimeDictionaryFailure>;
  readonly copy: Effect.Effect<RuntimeSetService, CitationRuntimeDictionaryFailure>;
  readonly read: Effect.Effect<ReadonlyArray<CitationRuntimeDictionaryKey>>;
}
const createRuntimeSet = Effect.fn("Citation.createRuntimeSet")(function* (
  limits: CitationRuntimeDictionaryLimits,
  comparison: typeof CitationRuntimeDictionaryComparison.Service,
  sourceSize: number,
  sourceUsed: number,
  sourceBuckets: HashMap.HashMap<number, CitationRuntimeDictionaryKey>
): Effect.fn.Return<RuntimeSetService, CitationRuntimeDictionaryFailure> {
  const mutex = yield* Semaphore.make(1);
  let size = 8;
  let used = 0;
  let steps = 0;
  let buckets = HashMap.empty<number, CitationRuntimeDictionaryKey>();
  const step = Effect.suspend(() => {
    if (steps >= limits.iterations) return Effect.fail(failure("limit-exceeded"));
    steps += 1;
    return comparison.step;
  });
  const cleanInsert = Effect.fn("Citation.setCleanInsert")(function* (
    table: HashMap.HashMap<number, CitationRuntimeDictionaryKey>,
    capacity: number,
    key: CitationRuntimeDictionaryKey
  ) {
    let perturb = BigInt.asUintN(64, key.hash);
    let index = indexOf(perturb, capacity);
    while (true) {
      const probes = index + 9 <= capacity - 1 ? 9 : 0;
      for (let offset = 0; offset <= probes; offset += 1) {
        yield* step;
        if (!HashMap.has(table, index + offset)) return HashMap.set(table, index + offset, key);
      }
      perturb >>= BigInt(5);
      index = indexOf(BigInt(index) * BigInt(5) + BigInt(1) + perturb, capacity);
    }
  });
  const grow = Effect.fn("Citation.setGrow")(function* () {
    const minimum = used > 50000 ? used * 2 : used * 4;
    let capacity = 8;
    while (capacity <= minimum) {
      yield* step;
      capacity *= 2;
    }
    let rebuilt = HashMap.empty<number, CitationRuntimeDictionaryKey>();
    for (let bucket = 0; bucket < size; bucket += 1) {
      yield* step;
      const key = HashMap.get(buckets, bucket);
      if (O.isSome(key)) rebuilt = yield* cleanInsert(rebuilt, capacity, key.value);
    }
    size = capacity;
    buckets = rebuilt;
  });
  const sameKey = Effect.fn("Citation.setSameKey")(function* (
    left: CitationRuntimeDictionaryKey,
    right: CitationRuntimeDictionaryKey
  ) {
    // Set identity is nested under the cached-hash match, unlike dict.
    if (left.hash !== right.hash) return false;
    if (left.objectId === right.objectId) return true;
    return yield* comparison.equal(left.objectId, right.objectId);
  });
  const tryBucket = Effect.fn("Citation.setTryBucket")(function* (key: CitationRuntimeDictionaryKey, bucket: number) {
    const entry = HashMap.get(buckets, bucket);
    if (O.isSome(entry)) return yield* sameKey(entry.value, key);
    if (used >= limits.entries) return yield* failure("limit-exceeded");
    buckets = HashMap.set(buckets, bucket, CitationRuntimeDictionaryKey.make({ ...key }));
    used += 1;
    if (used * 5 >= (size - 1) * 3) yield* grow();
    return true;
  });
  const add = Effect.fn("Citation.setAdd")(function* (inputKey: CitationRuntimeDictionaryKey) {
    const key = yield* S.decodeEffect(CitationRuntimeDictionaryKeyType)(inputKey).pipe(
      Effect.mapError(() => failure("invalid-input"))
    );
    let perturb = BigInt.asUintN(64, key.hash);
    let index = indexOf(perturb, size);
    while (true) {
      const probes = index + 9 <= size - 1 ? 9 : 0;
      for (let offset = 0; offset <= probes; offset += 1) {
        yield* step;
        if (yield* tryBucket(key, index + offset)) return;
      }
      perturb >>= BigInt(5);
      index = indexOf(BigInt(index) * BigInt(5) + BigInt(1) + perturb, size);
    }
  });
  const read = Effect.suspend(() =>
    Effect.succeed(
      A.getSomes(
        A.map(A.range(0, size - 1), (index) =>
          O.map(HashMap.get(buckets, index), (key) => CitationRuntimeDictionaryKey.make({ ...key }))
        )
      )
    )
  );
  // CPython set_merge pre-sizes before copying, without rehash/comparison.
  const copyCapacity = Effect.gen(function* () {
    if (sourceUsed * 5 >= (size - 1) * 3) {
      while (size <= sourceUsed * 2) {
        yield* step;
        size *= 2;
      }
    }
  });
  const copyBuckets = Effect.gen(function* () {
    for (let bucket = 0; bucket < sourceSize; bucket++) {
      yield* step;
      const key = HashMap.get(sourceBuckets, bucket);
      if (O.isSome(key)) buckets = yield* cleanInsert(buckets, size, key.value);
    }
  });
  if (sourceUsed > 0) {
    yield* copyCapacity;
    if (size === sourceSize) {
      for (let bucket = 0; bucket < sourceSize; bucket++) yield* step;
      // Persistent Effect storage can share immutable cells; each set keeps
      // independent roots, semaphore, used count and work state.
      buckets = sourceBuckets;
    } else yield* copyBuckets;
    used = sourceUsed;
  }
  return {
    add: Effect.fn("Citation.serialSetAdd")((key: CitationRuntimeDictionaryKey) => mutex.withPermit(add(key))),
    read: mutex.withPermit(read),
    copy: mutex.withPermit(Effect.suspend(() => createRuntimeSet(limits, comparison, size, used, buckets))),
  };
});

/**
 * Fresh source set with add, bucket-order read and exact add-only set copying.
 * Copies retain cached hashes and object identity, acquire independent mutation
 * and work state, and capture comparison with R = never. Deletion/dummies and
 * arbitrary set update/union behavior remain outside this compatibility profile.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRuntimeSet = Effect.fn("Citation.makeRuntimeSet")(function* (input: unknown) {
  const limits = yield* S.decodeUnknownEffect(CitationRuntimeDictionaryLimitsType)(input).pipe(
    Effect.mapError(() => failure("invalid-input"))
  );
  const comparison = yield* CitationRuntimeDictionaryComparison;
  return yield* createRuntimeSet(limits, comparison, 8, 0, HashMap.empty());
});
