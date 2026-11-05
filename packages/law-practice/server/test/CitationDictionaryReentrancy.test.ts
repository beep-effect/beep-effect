import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationRuntimeDictionaryComparison,
  CitationRuntimeDictionaryFailure,
  CitationRuntimeDictionaryKey,
  makeCitationRuntimeDictionary,
} from "@beep/law-practice-server/internal/Citation/RuntimeDictionary";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { CitationRuntimeDictionary } from "@beep/law-practice-server/internal/Citation/RuntimeDictionary";

const $I = $LawPracticeServerId.create("test/CitationDictionaryReentrancy");
const Operation = S.Union([
  S.Struct({ kind: S.tag("get"), key: S.Natural }),
  S.Struct({ kind: S.tag("remove"), key: S.Natural }),
  S.Struct({ kind: S.tag("set"), key: S.Natural, value: S.Natural }),
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Operation", { description: "Frozen caller operation; hash evaluation remains caller-owned." })
);
const Entry = S.Struct({ objectId: S.Natural, value: S.Natural }).pipe(
  $I.annoteSchema("Entry", { description: "Ordered visible source table item." })
);
const Outcome = S.Union([
  S.Struct({ status: S.tag("value"), result: S.NullOr(S.Natural) }),
  S.Struct({ status: S.tag("error"), kind: S.tag("ValueError") }),
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("Outcome", { description: "Source lookup/pop result or equality failure." })
);
const Corpus = S.Struct({
  cases: S.Array(
    S.Struct({
      name: S.String,
      initial: S.Array(S.Natural),
      keys: S.Array(S.Struct({ objectId: S.Natural, hash: S.BigIntFromString, token: S.String })),
      events: S.Array(
        S.Struct({ operation: Operation, outcome: Outcome, trace: S.Array(S.Json), entries: S.Array(Entry) })
      ),
    })
  ),
}).pipe(
  $I.annoteSchema("Corpus", {
    description: "Thirteen complete direct-mutation histories; separate from cleaner or Unicode-table proof.",
  })
);
const CorpusJson = S.fromJsonString(Corpus);

const invalid = () => CitationRuntimeDictionaryFailure.make({ reason: "invalid-input" });
const key = (objectId: number) => CitationRuntimeDictionaryKey.make({ objectId, hash: BigInt(7) });
it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("direct comparison reentrancy", (it) => {
  it.effect("matches all pinned restart outcomes, nested calls and retained mutation", () =>
    Effect.gen(function* () {
      const citationResult1 = yield* FileSystem.FileSystem;
      const raw = yield* citationResult1.readFileString(
        NodeURL.fileURLToPath(
          new URL("../../use-cases/test/fixtures/eyecite/dictionary-reentrancy.json", import.meta.url)
        )
      );
      const citationResult2 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
      expect(citationResult2).toBe("68a3835c917bab252d004d2066b7ca45927deca1d358f68ed957b1ecbfecb9da");
      const data = yield* S.decodeEffect(CorpusJson)(raw);
      expect(data.cases).toHaveLength(13);
      expect(A.reduce(data.cases, 0, (total, row) => total + row.events.length)).toBe(26);
      yield* Effect.forEach(
        data.cases,
        Effect.fnUntraced(function* (row) {
          let table = O.none<ReturnType<typeof CitationRuntimeDictionary.of>>();
          let mutations = 0;
          let trace: ReadonlyArray<S.Json> = [];
          const state = Effect.fn("ReentrantTest.state")((id: number) =>
            Effect.fromOption(A.get(row.keys, id), invalid)
          );
          const capturedKey = Effect.fn("ReentrantTest.key")(function* (id: number) {
            const value = yield* state(id);
            return CitationRuntimeDictionaryKey.make({ objectId: id, hash: value.hash });
          });
          const project = Effect.gen(function* () {
            const current = yield* Effect.fromOption(table, invalid);
            const citationResult3 = yield* current.read;
            return A.map(citationResult3, (entry) => ({ objectId: entry.objectId, value: entry.value }));
          });
          const action = Effect.fn("ReentrantTest.action")(function* () {
            const current = yield* Effect.fromOption(table, invalid);
            mutations++;
            return yield* Match.value(row.name).pipe(
              Match.when(
                (candidate: string) =>
                  A.contains(["clear-in-get", "clear-in-remove", "mutate-raise", "clear-refill"], candidate),
                Effect.fnUntraced(function* () {
                  yield* current.clear;
                  trace = A.append(trace, { kind: "clear" });
                  if (row.name === "clear-refill") {
                    const citationResult4 = yield* capturedKey(0);
                    yield* current.set(citationResult4, 99);
                    trace = A.append(trace, { kind: "set", key: 0, value: 99 });
                  }
                  if (row.name === "mutate-raise")
                    return yield* CitationRuntimeDictionaryFailure.make({ reason: "comparison-failed" });
                })
              ),
              Match.when(
                (candidate: string) =>
                  A.contains(["remove-in-get", "replace-in-get", "resize-in-set", "replace-five"], candidate),
                Effect.fnUntraced(function* () {
                  const citationResult5 = yield* capturedKey(0);
                  const result = yield* current.remove(citationResult5);
                  trace = A.append(trace, {
                    kind: "remove",
                    key: 0,
                    result: O.getOrNull(O.map(result, (entry) => entry.value)),
                  });
                  if (row.name === "replace-in-get" || row.name === "replace-five") {
                    const citationResult6 = yield* capturedKey(0);
                    yield* current.set(citationResult6, 99 + mutations);
                    trace = A.append(trace, { kind: "set", key: 0, value: 99 + mutations });
                  } else if (row.name === "resize-in-set") {
                    const citationResult7 = yield* capturedKey(6);
                    yield* current.set(citationResult7, 106);
                    trace = A.append(trace, { kind: "set", key: 6, value: 106 });
                  }
                })
              ),
              Match.when(
                (candidate: string) => candidate === "update-in-get",
                Effect.fnUntraced(function* () {
                  const citationResult8 = yield* capturedKey(0);
                  yield* current.set(citationResult8, 99);
                  trace = A.append(trace, { kind: "set", key: 0, value: 99 });
                })
              ),
              Match.when(
                (candidate: string) =>
                  A.contains(["insert-no-resize", "resize-in-get", "false-after-resize"], candidate),
                Effect.fnUntraced(function* () {
                  const id = row.name === "insert-no-resize" ? 2 : 6;
                  const citationResult9 = yield* capturedKey(id);
                  yield* current.set(citationResult9, 100 + id);
                  trace = A.append(trace, { kind: "set", key: id, value: 100 + id });
                })
              ),
              Match.when(
                (candidate: string) => candidate === "read-get",
                Effect.fnUntraced(function* () {
                  const citationResult10 = yield* project;
                  trace = A.append(trace, { kind: "read", entries: citationResult10 });
                  const citationResult11 = yield* capturedKey(0);
                  const result = yield* current.get(citationResult11);
                  trace = A.append(trace, {
                    kind: "get",
                    key: 0,
                    result: O.getOrNull(O.map(result, (entry) => entry.value)),
                  });
                })
              ),
              Match.orElse(
                Effect.fnUntraced(function* () {
                  return yield* invalid();
                })
              )
            );
          });
          const comparison = CitationRuntimeDictionaryComparison.of({
            step: Effect.void,
            equal: Effect.fn("ReentrantTest.equal")(function* (left: number, right: number) {
              trace = A.append(trace, { kind: "compare", left, right });
              if (left === 0 && right === 1 && mutations < (row.name === "replace-five" ? 5 : 1)) yield* action();
              return (yield* state(left)).token === (yield* state(right)).token;
            }),
          });
          const current = yield* makeCitationRuntimeDictionary({ entries: 64, iterations: 20_000 }).pipe(
            Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
          );
          table = O.some(current);
          yield* Effect.forEach(
            row.initial,
            Effect.fnUntraced(function* (id) {
              const citationResult12 = yield* capturedKey(id);
              yield* current.set(citationResult12, 100 + id);
            }),
            { concurrency: 1, discard: true }
          );
          expect(trace).toEqual([]);
          yield* Effect.forEach(
            row.events,
            Effect.fnUntraced(function* (event) {
              trace = [];
              const inputKey = yield* capturedKey(event.operation.key);
              const operation = event.operation;
              const run =
                operation.kind === "get"
                  ? current.get(inputKey)
                  : operation.kind === "remove"
                    ? current.remove(inputKey)
                    : current.set(inputKey, operation.value).pipe(Effect.as(O.none()));
              if (event.outcome.status === "error") {
                const failure = yield* Effect.flip(run);
                expect(failure.reason, row.name).toBe("comparison-failed");
              } else {
                const value = yield* run;
                expect(O.getOrNull(O.map(value, (entry) => entry.value)), row.name).toBe(event.outcome.result);
              }
              expect(trace, row.name).toEqual(event.trace);
              const citationResult13 = yield* project;
              expect(citationResult13, row.name).toEqual(event.entries);
            }),
            { concurrency: 1, discard: true }
          );
        }),
        { concurrency: 1, discard: true }
      );
    })
  );
  it.effect("charges repeated restarts and releases ownership after failure and interruption", () =>
    Effect.gen(function* () {
      let table = O.none<ReturnType<typeof CitationRuntimeDictionary.of>>();
      const comparison = CitationRuntimeDictionaryComparison.of({
        step: Effect.void,
        equal: Effect.fn("ReentrantTest.restartForever")(function* () {
          const current = yield* Effect.fromOption(table, invalid);
          yield* current.remove(key(0));
          yield* current.set(key(0), 1);
          return true;
        }),
      });
      const current = yield* makeCitationRuntimeDictionary({ entries: 8, iterations: 80 }).pipe(
        Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
      );
      table = O.some(current);
      yield* current.set(key(0), 1);
      const citationResult14 = yield* Effect.flip(current.get(key(1)));
      expect(citationResult14.reason).toBe("limit-exceeded");
      yield* current.clear;
      const citationResult15 = yield* current.read;
      expect(citationResult15).toEqual([]);
      const entered = yield* Deferred.make<void>();
      const blocked = yield* makeCitationRuntimeDictionary({ entries: 8, iterations: 100 }).pipe(
        Effect.provideService(CitationRuntimeDictionaryComparison, {
          step: Effect.void,
          equal: () => Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)),
        })
      );
      yield* blocked.set(key(0), 1);
      const first = yield* Effect.forkChild(blocked.get(key(1)));
      yield* Deferred.await(entered);
      const second = yield* Effect.forkChild(blocked.clear);
      yield* Fiber.interrupt(first);
      yield* Fiber.join(second);
      const citationResult16 = yield* blocked.read;
      expect(citationResult16).toEqual([]);
      const citationResult17 = yield* blocked.set(key(0), 2);
      expect(citationResult17.value).toBe(2);
    })
  );
});
