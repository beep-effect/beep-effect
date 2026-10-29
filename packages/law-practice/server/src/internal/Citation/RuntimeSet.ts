/**
 * Add-only candidate set adapted from CPython 3.11.15 setobject.c.
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

const failure = (reason: CitationRuntimeDictionaryFailure["reason"]) =>
  CitationRuntimeDictionaryFailure.make({ reason });
const indexOf = (value: bigint, size: number) => Number(value & BigInt(size - 1));
/**
 * Build one fresh set for a source candidate-comprehension/list construction.
 * Only add and iteration are exposed: no delete/dummy behavior is implied.
 * Comparison and work are captured with R = never; keys contain no host object.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationRuntimeSet = Effect.fn("Citation.makeRuntimeSet")(function* (input: unknown) {
  const limits = yield* S.decodeUnknownEffect(S.toType(CitationRuntimeDictionaryLimits))(input).pipe(
    Effect.mapError(() => failure("invalid-input"))
  );
  const comparison = yield* CitationRuntimeDictionaryComparison;
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
  const add = Effect.fn("Citation.setAdd")(function* (inputKey: CitationRuntimeDictionaryKey) {
    const key = yield* S.decodeEffect(S.toType(CitationRuntimeDictionaryKey))(inputKey).pipe(
      Effect.mapError(() => failure("invalid-input"))
    );
    let perturb = BigInt.asUintN(64, key.hash);
    let index = indexOf(perturb, size);
    while (true) {
      const probes = index + 9 <= size - 1 ? 9 : 0;
      for (let offset = 0; offset <= probes; offset += 1) {
        yield* step;
        const entry = HashMap.get(buckets, index + offset);
        if (O.isNone(entry)) {
          if (used >= limits.entries) return yield* failure("limit-exceeded");
          buckets = HashMap.set(buckets, index + offset, CitationRuntimeDictionaryKey.make({ ...key }));
          used += 1;
          if (used * 5 >= (size - 1) * 3) yield* grow();
          return;
        }
        // Set identity is nested under the cached-hash match, unlike dict.
        if (
          entry.value.hash === key.hash &&
          (entry.value.objectId === key.objectId || (yield* comparison.equal(entry.value.objectId, key.objectId)))
        )
          return;
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
  return {
    add: Effect.fn("Citation.serialSetAdd")((key: CitationRuntimeDictionaryKey) => mutex.withPermit(add(key))),
    read: mutex.withPermit(read),
  };
});
