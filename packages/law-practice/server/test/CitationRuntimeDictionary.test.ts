import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import {
  CitationRuntimeDictionaryComparison,
  CitationRuntimeDictionaryFailure,
  CitationRuntimeDictionaryKey,
  CitationRuntimeDictionaryLimits,
  makeCitationRuntimeDictionary,
} from "../src/internal/Citation/RuntimeDictionary.ts";
import type { CitationRuntimeDictionaryEntry } from "../src/internal/Citation/RuntimeDictionary.ts";

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
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
        "1b66065c5ec4abd4564e01d24dda81d20f2f2358dac4911c5c13f12786275d4c"
      );
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
      for (const row of data.cases) {
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
        for (const event of row.events) {
          keys = HashMap.fromIterable(A.map(event.keys, (key) => Tuple.make(key.objectId, key)));
          comparisons = [];
          const operation = event.operation;
          let run: Effect.Effect<O.Option<CitationRuntimeDictionaryEntry>, CitationRuntimeDictionaryFailure>;
          if (operation.kind === "get" || operation.kind === "remove" || operation.kind === "set") {
            const state = yield* Effect.fromOption(HashMap.get(keys, operation.key), invalid);
            const key = CitationRuntimeDictionaryKey.make({ objectId: state.objectId, hash: state.hash });
            run =
              operation.kind === "get"
                ? table.get(key)
                : operation.kind === "remove"
                  ? table.remove(key)
                  : table.set(key, operation.value).pipe(Effect.as(O.none<CitationRuntimeDictionaryEntry>()));
          } else
            run =
              operation.kind === "clear"
                ? table.clear.pipe(Effect.as(O.none<CitationRuntimeDictionaryEntry>()))
                : Effect.succeedNone;
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
          expect(
            A.map(yield* table.read, (entry) => ({ objectId: entry.objectId, value: entry.value })),
            row.name
          ).toEqual(event.entries);
        }
      }
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
      expect((yield* Effect.flip(table.set(key(2), 12))).reason).toBe("limit-exceeded");
      expect(A.map(yield* table.read, (entry) => entry.value)).toEqual([10, 11]);
      const read = yield* table.read;
      Reflect.set(A.getUnsafe(read, 0), "value", 999);
      assertSome(
        O.map(yield* table.get(key(0)), (entry) => entry.value),
        10
      );
      yield* table.set(key(0), 13);
      expect(A.map(yield* table.read, (entry) => entry.value)).toEqual([13, 11]);
      const tiny = yield* makeCitationRuntimeDictionary(
        CitationRuntimeDictionaryLimits.make({ entries: 2, iterations: 1 })
      ).pipe(Effect.provideService(CitationRuntimeDictionaryComparison, comparison));
      expect((yield* Effect.flip(tiny.set(key(0), 10))).reason).toBe("limit-exceeded");
      expect(yield* tiny.read).toEqual([]);
    })
  );
});
