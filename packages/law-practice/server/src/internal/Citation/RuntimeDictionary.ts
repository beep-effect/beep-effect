/**
 * Bounded general-key table behavior adapted from CPython 3.11.15 dictobject.c.
 * Python Software Foundation License Version 2; see THIRD_PARTY_NOTICES.md.
 * TypeScript/Effect adaptation: schema data, captured comparison/work service,
 * bounded probes, opaque entry identities, serialized methods and typed errors.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Chunk from "effect/Chunk";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

const $I = $LawPracticeServerId.create("internal/Citation/RuntimeDictionary");
const Hash = S.BigIntFromString.check(
  S.makeFilter(
    (hash) => hash >= -(BigInt(2) ** BigInt(63)) && hash < BigInt(2) ** BigInt(63) && hash !== BigInt(-1),
    $I.annote("NormalizedHash64", {
      description: "Normalized signed 64-bit Py_hash_t; Python reserves minus one for failure.",
      message: "Invalid normalized runtime hash.",
    })
  )
).pipe(
  $I.annoteSchema("Hash", {
    description: "Exact source runtime hash, encoded as a decimal string without numeric precision loss.",
  })
);
/**
 * Resource-object identity and its current normalized runtime hash. Object IDs
 * are operation-local handles supplied by the captured adapter, not evidence.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationRuntimeDictionaryKey extends S.Opaque<
  CitationRuntimeDictionaryKey,
  { readonly brand: unique symbol }
>()(
  S.Struct({ objectId: S.Natural, hash: Hash }).pipe(
    $I.annoteSchema("CitationRuntimeDictionaryKey", {
      description: "Current resource identity/hash snapshot; never a persisted authority or source proof.",
    })
  )
) {}
/**
 * One insertion entry. Stored hash and key object identity remain unchanged on
 * value replacement; separate entries may reference the same mutated object.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationRuntimeDictionaryEntry extends S.Opaque<
  CitationRuntimeDictionaryEntry,
  { readonly brand: unique symbol }
>()(
  S.Struct({ entryId: S.Natural, objectId: S.Natural, storedHash: Hash, value: S.Natural }).pipe(
    $I.annoteSchema("CitationRuntimeDictionaryEntry", {
      description: "Ordered insertion identity, cached insertion hash, resource-object handle and member-list handle.",
    })
  )
) {}
/**
 * Project the existing engine ceilings, without adding public policy fields.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationRuntimeDictionaryLimits extends S.Opaque<
  CitationRuntimeDictionaryLimits,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    entries: CitationEngineLimits.fields.authorities,
    iterations: CitationEngineLimits.fields.resolutionIterations,
  }).pipe(
    $I.annoteSchema("CitationRuntimeDictionaryLimits", {
      description: "Private ceiling projection for active entries and bounded probe/rebuild work.",
    })
  )
) {}
const Reason = LiteralKit(["invalid-input", "limit-exceeded", "comparison-failed"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed private table failures without keys, source data or nested causes.",
  })
);
/**
 * Sanitized table/comparison failure for mapping into the engine boundary.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationRuntimeDictionaryFailure extends S.TaggedError<
  CitationRuntimeDictionaryFailure,
  { readonly brand: unique symbol }
>($I`CitationRuntimeDictionaryFailure`)(
  "CitationRuntimeDictionaryFailure",
  { reason: Reason },
  $I.annoteError<CitationRuntimeDictionaryFailure>("CitationRuntimeDictionaryFailure", {
    description: "Runtime key comparison or bounded table operation failed without caller payloads.",
  })
) {}
/**
 * Captured source-equivalent comparison and shared work accounting. Comparison
 * may read current key state. Reentrant table mutation through comparison is
 * not implemented by this first private backend and remains a proof frontier.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationRuntimeDictionaryComparison extends Context.Service<
  CitationRuntimeDictionaryComparison,
  {
    readonly equal: (left: number, right: number) => Effect.Effect<boolean, CitationRuntimeDictionaryFailure>;
    readonly step: Effect.Effect<void, CitationRuntimeDictionaryFailure>;
  }
>()($I`CitationRuntimeDictionaryComparison`) {}
/**
 * Captured general-key dictionary operations. No callable/request fields or
 * Python runtime are used. Values are operation-owned member-list handles.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationRuntimeDictionary extends Context.Service<
  CitationRuntimeDictionary,
  {
    readonly get: (
      key: CitationRuntimeDictionaryKey
    ) => Effect.Effect<O.Option<CitationRuntimeDictionaryEntry>, CitationRuntimeDictionaryFailure>;
    readonly set: (
      key: CitationRuntimeDictionaryKey,
      value: number
    ) => Effect.Effect<void, CitationRuntimeDictionaryFailure>;
    readonly remove: (
      key: CitationRuntimeDictionaryKey
    ) => Effect.Effect<O.Option<CitationRuntimeDictionaryEntry>, CitationRuntimeDictionaryFailure>;
    readonly clear: Effect.Effect<void>;
    readonly read: Effect.Effect<ReadonlyArray<CitationRuntimeDictionaryEntry>>;
  }
>()($I`CitationRuntimeDictionary`) {}
const Cell = S.TaggedUnion({ Deleted: {}, Active: { entryId: S.Natural } }).pipe(
  $I.annoteSchema("Cell", {
    description: "Present bucket marker; an absent bucket is empty, while a deleted bucket continues probing.",
  })
);
const Hit = S.Struct({ entryId: S.Natural, bucket: S.Natural }).pipe(
  $I.annoteSchema("Hit", { description: "Private located entry and probe bucket." })
);
const invalid = () => CitationRuntimeDictionaryFailure.make({ reason: "invalid-input" });
const exceeded = () => CitationRuntimeDictionaryFailure.make({ reason: "limit-exceeded" });
const freshFailure = (failure: CitationRuntimeDictionaryFailure) =>
  CitationRuntimeDictionaryFailure.make({ reason: failure.reason });
const copyEntry = (entry: CitationRuntimeDictionaryEntry) => CitationRuntimeDictionaryEntry.make({ ...entry });
const unsigned = (hash: bigint) => BigInt.asUintN(64, hash);
const indexOfHash = (hash: bigint, size: number) => Number(hash & BigInt(size - 1));
/**
 * Allocate a fresh private combined/general-key table. Source pointer identity
 * is checked before cached hash/equality; growth rebuilds with stored hashes.
 * Unicode-specialized/split tables, exact hash production, source comparison
 * reentrancy and final owner/document integration remain separate obligations.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationRuntimeDictionary = Effect.fn("Citation.makeRuntimeDictionary")(function* (input: unknown) {
  const limits = yield* S.decodeUnknownEffect(S.toType(CitationRuntimeDictionaryLimits))(input).pipe(
    Effect.mapError(invalid)
  );
  const maximumEntries = limits.entries;
  const maximumSteps = limits.iterations;
  const comparison = yield* CitationRuntimeDictionaryComparison;
  const mutex = yield* Semaphore.make(1);
  let capacity = 0;
  let usable = 0;
  let buckets = HashMap.empty<number, typeof Cell.Type>();
  let entries = HashMap.empty<number, CitationRuntimeDictionaryEntry>();
  let order = Chunk.empty<number>();
  let nextEntry = 0;
  let steps = 0;
  const step = Effect.suspend(() => {
    if (steps >= maximumSteps) return Effect.fail(exceeded());
    steps += 1;
    return comparison.step.pipe(Effect.mapError(freshFailure));
  });
  const keySnapshot = Effect.fn("Citation.runtimeDictionaryKey")(function* (key: CitationRuntimeDictionaryKey) {
    const decoded = yield* S.decodeEffect(S.toType(CitationRuntimeDictionaryKey))(key).pipe(Effect.mapError(invalid));
    return CitationRuntimeDictionaryKey.make({ objectId: decoded.objectId, hash: decoded.hash });
  });
  const lookup = Effect.fn("Citation.runtimeDictionaryLookup")(function* (key: CitationRuntimeDictionaryKey) {
    if (capacity === 0) return O.none<typeof Hit.Type>();
    let perturb = unsigned(key.hash);
    let index = indexOfHash(perturb, capacity);
    while (true) {
      yield* step;
      const cell = HashMap.get(buckets, index);
      if (O.isNone(cell)) return O.none<typeof Hit.Type>();
      if (cell.value._tag === "Active") {
        const entry = yield* Effect.fromOption(HashMap.get(entries, cell.value.entryId), invalid);
        // CPython tests the key pointer before comparing the cached hash.
        if (
          entry.objectId === key.objectId ||
          (entry.storedHash === key.hash &&
            (yield* comparison.equal(entry.objectId, key.objectId).pipe(Effect.mapError(freshFailure))))
        )
          return O.some(Hit.make({ entryId: entry.entryId, bucket: index }));
      }
      perturb >>= BigInt(5);
      index = indexOfHash(BigInt(index) * BigInt(5) + perturb + BigInt(1), capacity);
    }
  });
  const emptySlot = Effect.fn("Citation.runtimeDictionaryEmptySlot")(function* (
    table: HashMap.HashMap<number, typeof Cell.Type>,
    size: number,
    hash: bigint
  ) {
    let perturb = unsigned(hash);
    let index = indexOfHash(perturb, size);
    while (true) {
      yield* step;
      const cell = HashMap.get(table, index);
      if (O.isNone(cell) || cell.value._tag === "Deleted") return index;
      perturb >>= BigInt(5);
      index = indexOfHash(BigInt(index) * BigInt(5) + perturb + BigInt(1), size);
    }
  });
  const prepareInsertion = Effect.fn("Citation.runtimeDictionaryPrepareInsertion")(function* () {
    if (capacity > 0 && usable > 0) return { capacity, usable, buckets, order };
    let size = 8;
    while (size < HashMap.size(entries) * 3) {
      yield* step;
      size *= 2;
    }
    let rebuilt = HashMap.empty<number, typeof Cell.Type>();
    let compacted = Chunk.empty<number>();
    for (const id of order) {
      yield* step;
      const entry = HashMap.get(entries, id);
      if (O.isNone(entry)) continue;
      const index = yield* emptySlot(rebuilt, size, entry.value.storedHash);
      rebuilt = HashMap.set(rebuilt, index, Cell.cases.Active.make({ entryId: id }));
      compacted = Chunk.append(compacted, id);
    }
    return {
      capacity: size,
      usable: Math.floor((size * 2) / 3) - HashMap.size(entries),
      buckets: rebuilt,
      order: compacted,
    };
  });
  const get = Effect.fn("Citation.runtimeDictionaryGet")(function* (inputKey: CitationRuntimeDictionaryKey) {
    const key = yield* keySnapshot(inputKey);
    yield* step;
    const hit = yield* lookup(key);
    return O.map(
      O.flatMap(hit, (hit) => HashMap.get(entries, hit.entryId)),
      copyEntry
    );
  });
  const set = Effect.fn("Citation.runtimeDictionarySet")(function* (
    inputKey: CitationRuntimeDictionaryKey,
    value: number
  ) {
    const key = yield* keySnapshot(inputKey);
    const decodedValue = yield* S.decodeEffect(S.Natural)(value).pipe(Effect.mapError(invalid));
    yield* step;
    const hit = yield* lookup(key);
    if (O.isSome(hit)) {
      const entry = yield* Effect.fromOption(HashMap.get(entries, hit.value.entryId), invalid);
      entries = HashMap.set(
        entries,
        entry.entryId,
        CitationRuntimeDictionaryEntry.make({ ...entry, value: decodedValue })
      );
      return;
    }
    if (HashMap.size(entries) >= maximumEntries || nextEntry >= maximumSteps) return yield* exceeded();
    const next = yield* prepareInsertion();
    const index = yield* emptySlot(next.buckets, next.capacity, key.hash);
    const entry = CitationRuntimeDictionaryEntry.make({
      entryId: nextEntry,
      objectId: key.objectId,
      storedHash: key.hash,
      value: decodedValue,
    });
    capacity = next.capacity;
    buckets = HashMap.set(next.buckets, index, Cell.cases.Active.make({ entryId: entry.entryId }));
    usable = next.usable - 1;
    order = Chunk.append(next.order, entry.entryId);
    entries = HashMap.set(entries, entry.entryId, entry);
    nextEntry += 1;
  });
  const remove = Effect.fn("Citation.runtimeDictionaryRemove")(function* (inputKey: CitationRuntimeDictionaryKey) {
    const key = yield* keySnapshot(inputKey);
    yield* step;
    const hit = yield* lookup(key);
    if (O.isNone(hit)) return O.none<CitationRuntimeDictionaryEntry>();
    const entry = yield* Effect.fromOption(HashMap.get(entries, hit.value.entryId), invalid);
    entries = HashMap.remove(entries, entry.entryId);
    buckets = HashMap.set(buckets, hit.value.bucket, Cell.cases.Deleted.make({}));
    return O.some(copyEntry(entry));
  });
  const clear = Effect.sync(() => {
    capacity = 0;
    usable = 0;
    buckets = HashMap.empty();
    entries = HashMap.empty();
    order = Chunk.empty();
  });
  const read = Effect.sync(() =>
    order.pipe(
      A.fromIterable,
      A.map((id) => O.map(HashMap.get(entries, id), copyEntry)),
      A.getSomes
    )
  );
  return CitationRuntimeDictionary.of({
    get: Effect.fn("Citation.serialRuntimeDictionaryGet")((key: CitationRuntimeDictionaryKey) =>
      mutex.withPermit(get(key))
    ),
    set: Effect.fn("Citation.serialRuntimeDictionarySet")((key: CitationRuntimeDictionaryKey, value: number) =>
      mutex.withPermit(set(key, value))
    ),
    remove: Effect.fn("Citation.serialRuntimeDictionaryRemove")((key: CitationRuntimeDictionaryKey) =>
      mutex.withPermit(remove(key))
    ),
    clear: mutex.withPermit(clear),
    read: mutex.withPermit(read),
  });
});
