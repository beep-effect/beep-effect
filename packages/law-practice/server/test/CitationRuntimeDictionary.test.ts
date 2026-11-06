import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationRuntimeDictionaryComparison,
  CitationRuntimeDictionaryFailure,
  CitationRuntimeDictionaryKey,
  CitationRuntimeDictionaryLimits,
  makeCitationRuntimeDictionary,
} from "@beep/law-practice-server/internal/Citation/RuntimeDictionary";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import type { CitationRuntimeDictionaryEntry } from "@beep/law-practice-server/internal/Citation/RuntimeDictionary";

const $I = $LawPracticeServerId.create("test/CitationRuntimeDictionary");
const KeyState = S.Struct({
  objectId: S.Natural,
  hash: S.BigIntFromString,
  token: S.String,
  mode: S.Literals(["hash", "token"]),
  error: S.Boolean,
}).pipe(
  $I.annoteSchema("KeyState", {
    description: "Source-provided normalized hash and current comparison state; not a production normalizer.",
  })
);
const Operation = S.Union([
  S.Struct({ kind: S.tag("set"), key: S.Natural, value: S.Natural }),
  S.Struct({ kind: S.tag("get"), key: S.Natural }),
  S.Struct({ kind: S.tag("remove"), key: S.Natural }),
  S.Struct({ kind: S.tag("hash"), key: S.Natural, value: S.String }),
  S.Struct({ kind: S.tag("error"), key: S.Natural, value: S.Boolean }),
  S.Struct({ kind: S.tag("clear") }),
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Operation", { description: "Finite source dictionary operation and external key-state edit." })
);
const Outcome = S.Union([
  S.Struct({ status: S.tag("value"), result: S.NullOr(S.Natural) }),
  S.Struct({ status: S.tag("error"), kind: S.tag("ValueError") }),
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("Outcome", { description: "Observed source result or synthetic equality exception." })
);
const Event = S.Struct({
  operation: Operation,
  keys: S.Array(KeyState),
  outcome: Outcome,
  comparisons: S.Array(S.Tuple([S.Natural, S.Natural])),
  entries: S.Array(S.Struct({ objectId: S.Natural, value: S.Natural })),
}).pipe(
  $I.annoteSchema("Event", {
    description: "Complete source table step, including exact equality calls and ordered duplicate-key entries.",
  })
);
const Row = S.Struct({ name: S.NonEmptyString, events: S.Array(Event) }).pipe(
  $I.annoteSchema("Row", { description: "One frozen general-key table history." })
);
const Corpus = S.Struct({
  schemaVersion: S.tag("citation-runtime-dictionary-observations/v1"),
  cases: S.Array(Row),
}).pipe(
  $I.annoteSchema("Corpus", {
    description: "Eight source dictionary histories, separate from engine/live hash integration proof.",
  })
);
const CorpusJson = S.fromJsonString(Corpus);

const invalid = () => CitationRuntimeDictionaryFailure.make({ reason: "invalid-input" });

it.layer(Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer))("source runtime dictionary backend", (it) => {
  it.effect("matches every source result, comparison call and ordered entry across eight histories", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const raw = yield* fs.readFileString(
        NodeURL.fileURLToPath(
          new URL("../../use-cases/test/fixtures/eyecite/runtime-dictionary-observations.json", import.meta.url)
        )
      );
      const citationResult1 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
      expect(citationResult1).toBe("1b66065c5ec4abd4564e01d24dda81d20f2f2358dac4911c5c13f12786275d4c");
      const data = yield* S.decodeEffect(CorpusJson)(raw);
      expect(A.map(data.cases, (row) => row.name)).toEqual([
        "same-bucket-pointer",
        "changed-bucket-duplicate",
        "cached-hash-current-equality",
        "collision-perturb-growth",
        "resize-retains-cached-hash",
        "delete-dummy-order-clear",
        "comparison-error-atomic",
        "signed-wide-hashes",
      ]);
      expect(A.reduce(data.cases, 0, (count, row) => count + A.length(row.events))).toBe(62);
      yield* Effect.forEach(
        data.cases,
        Effect.fnUntraced(function* (row) {
          let keys = HashMap.empty<number, typeof KeyState.Type>();
          let comparisons = A.empty<readonly [number, number]>();
          const comparison = CitationRuntimeDictionaryComparison.of({
            step: Effect.void,
            equal: Effect.fn("RuntimeDictionaryTest.equal")(function* (leftId: number, rightId: number) {
              comparisons = A.append(comparisons, Tuple.make(leftId, rightId));
              const left = yield* Effect.fromOption(HashMap.get(keys, leftId), invalid);
              const right = yield* Effect.fromOption(HashMap.get(keys, rightId), invalid);
              if (left.error) return yield* CitationRuntimeDictionaryFailure.make({ reason: "comparison-failed" });
              return left.mode === "hash" ? left.hash === right.hash : left.token === right.token;
            }),
          });
          const table = yield* makeCitationRuntimeDictionary(
            CitationRuntimeDictionaryLimits.make({ entries: 64, iterations: 20_000 })
          ).pipe(Effect.provideService(CitationRuntimeDictionaryComparison, comparison));
          const operationKey = (id: number) =>
            Effect.fromOption(HashMap.get(keys, id), invalid).pipe(
              Effect.map((state) => CitationRuntimeDictionaryKey.make({ objectId: state.objectId, hash: state.hash }))
            );
          const prepareOperation = Effect.fnUntraced(function* (operation: typeof Operation.Type) {
            return yield* Operation.match(operation, {
              get: Effect.fnUntraced(function* (op) {
                const citationResult2 = yield* operationKey(op.key);
                return { run: table.get(citationResult2) };
              }),
              remove: Effect.fnUntraced(function* (op) {
                const citationResult3 = yield* operationKey(op.key);
                return { run: table.remove(citationResult3) };
              }),
              set: Effect.fnUntraced(function* (op) {
                const citationResult4 = yield* operationKey(op.key);
                return {
                  run: table.set(citationResult4, op.value).pipe(Effect.as(O.none<CitationRuntimeDictionaryEntry>())),
                };
              }),
              clear: () =>
                Effect.succeed({ run: table.clear.pipe(Effect.as(O.none<CitationRuntimeDictionaryEntry>())) }),
              hash: () => Effect.succeed({ run: Effect.succeedNone }),
              error: () => Effect.succeed({ run: Effect.succeedNone }),
            });
          });
          yield* Effect.forEach(
            row.events,
            Effect.fnUntraced(function* (event) {
              keys = HashMap.fromIterable(A.map(event.keys, (key) => Tuple.make(key.objectId, key)));
              comparisons = [];
              const { run } = yield* prepareOperation(event.operation);
              let actual: typeof Outcome.Type;
              if (event.outcome.status === "error") {
                const failure = yield* Effect.flip(run);
                expect(failure.reason, row.name).toBe("comparison-failed");
                actual = Outcome.cases.error.make({ kind: "ValueError" });
              } else {
                const value = yield* run;
                actual = Outcome.cases.value.make({ result: O.getOrNull(O.map(value, (entry) => entry.value)) });
              }
              expect(actual, row.name).toEqual(event.outcome);
              expect(comparisons, row.name).toEqual(event.comparisons);
              const citationResult5 = yield* table.read;
              expect(
                A.map(citationResult5, (entry) => ({ objectId: entry.objectId, value: entry.value })),
                row.name
              ).toEqual(event.entries);
            }),
            { concurrency: 1, discard: true }
          );
        }),
        { concurrency: 1, discard: true }
      );
    })
  );
  it.effect("enforces entry/work ceilings, isolates snapshots and serializes concurrent inserts", () =>
    Effect.gen(function* () {
      const comparison = CitationRuntimeDictionaryComparison.of({
        step: Effect.void,
        equal: Effect.fn("RuntimeDictionaryTest.distinct")(() => Effect.succeed(false)),
      });
      const table = yield* makeCitationRuntimeDictionary(
        CitationRuntimeDictionaryLimits.make({ entries: 2, iterations: 100 })
      ).pipe(Effect.provideService(CitationRuntimeDictionaryComparison, comparison));
      const key = (objectId: number) => CitationRuntimeDictionaryKey.make({ objectId, hash: BigInt(objectId) });
      yield* Effect.all([table.set(key(0), 10), table.set(key(1), 11)], { concurrency: "unbounded" });
      const citationResult6 = yield* Effect.flip(table.set(key(2), 12));
      expect(citationResult6.reason).toBe("limit-exceeded");
      const citationResult7 = yield* table.read;
      expect(A.map(citationResult7, (entry) => entry.value)).toEqual([10, 11]);
      const read = yield* table.read;
      Reflect.set(A.getUnsafe(read, 0), "value", 999);
      const citationResult8 = yield* table.get(key(0));
      assertSome(
        O.map(citationResult8, (entry) => entry.value),
        10
      );
      yield* table.set(key(0), 13);
      const citationResult9 = yield* table.read;
      expect(A.map(citationResult9, (entry) => entry.value)).toEqual([13, 11]);
      const tiny = yield* makeCitationRuntimeDictionary(
        CitationRuntimeDictionaryLimits.make({ entries: 2, iterations: 1 })
      ).pipe(Effect.provideService(CitationRuntimeDictionaryComparison, comparison));
      const citationResult10 = yield* Effect.flip(tiny.set(key(0), 10));
      expect(citationResult10.reason).toBe("limit-exceeded");
      const citationResult11 = yield* tiny.read;
      expect(citationResult11).toEqual([]);
    })
  );
});

it.effect("rejects malformed dictionary policy before invoking a comparison capability", () =>
  Effect.gen(function* () {
    const comparison = CitationRuntimeDictionaryComparison.of({
      step: Effect.die("invalid policy reached comparison work"),
      equal: constant(Effect.die("invalid policy reached equality")),
    });
    for (const policy of [null, {}, { entries: 0, iterations: 100 }, { entries: 1, iterations: -1 }]) {
      const failure = yield* makeCitationRuntimeDictionary(policy).pipe(
        Effect.provideService(CitationRuntimeDictionaryComparison, comparison),
        Effect.flip
      );
      expect(failure).toMatchObject({ _tag: "CitationRuntimeDictionaryFailure", reason: "invalid-input" });
      expect("cause" in failure).toBe(false);
    }
  })
);

it.effect("rejects tampered keys and invalid values atomically before consuming comparison work", () =>
  Effect.gen(function* () {
    let steps = 0;
    const comparison = CitationRuntimeDictionaryComparison.of({
      step: Effect.sync(() => {
        steps++;
      }),
      equal: constant(Effect.die("invalid key reached comparison")),
    });
    const table = yield* makeCitationRuntimeDictionary({ entries: 4, iterations: 100 }).pipe(
      Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
    );
    const key = CitationRuntimeDictionaryKey.make({ objectId: 0, hash: BigInt(7) });
    const inserted = yield* table.set(key, 42);
    const before = steps;
    for (const { field, value } of [
      { field: "objectId", value: -1 },
      { field: "hash", value: "7" },
      { field: "hash", value: BigInt(-1) },
    ]) {
      const malformed = CitationRuntimeDictionaryKey.make({ objectId: 1, hash: BigInt(7) });
      Reflect.set(malformed, field, value);
      for (const operation of [
        table.get(malformed),
        table.remove(malformed),
        table.set(malformed, 0).pipe(Effect.as(O.none())),
      ]) {
        const failure = yield* operation.pipe(Effect.flip);
        expect(failure).toMatchObject({ reason: "invalid-input" });
      }
    }
    for (const value of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const failure = yield* table.set(key, value).pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: "invalid-input" });
    }
    expect(steps).toBe(before);
    const entries = yield* table.read;
    expect(entries).toEqual([inserted]);
  })
);
