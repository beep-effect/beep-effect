import { fileURLToPath } from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CitationRuntimeDictionaryComparison,
  CitationRuntimeDictionaryFailure,
  CitationRuntimeDictionaryKey,
  makeCitationRuntimeDictionary,
} from "../src/internal/Citation/RuntimeDictionary.ts";
import type { CitationRuntimeDictionary } from "../src/internal/Citation/RuntimeDictionary.ts";

const $I = $LawPracticeServerId.create("test/CitationUnicodeDictionary");
const Operation = S.Union([
  S.Struct({ kind: S.tag("get"), key: S.Natural }),
  S.Struct({ kind: S.tag("set"), key: S.Natural, value: S.Natural }),
  S.Struct({ kind: S.tag("clear") }),
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Operation", { description: "Captured dictionary invocation; key hashing is separately observed." })
);
const Corpus = S.Struct({
  cases: S.Array(
    S.Struct({
      name: S.String,
      initial: S.Array(S.Natural),
      keys: S.Array(
        S.Struct({
          objectId: S.Natural,
          kind: S.Literals(["text", "host", "subclass"]),
          text: S.String,
          hash: S.BigIntFromString,
          token: S.String,
        })
      ),
      events: S.Array(
        S.Struct({
          operation: Operation,
          outcome: S.Union([
            S.Struct({ status: S.tag("value"), result: S.NullOr(S.Natural) }),
            S.Struct({ status: S.tag("error"), kind: S.tag("ValueError") }),
          ]).pipe(S.toTaggedUnion("status")),
          trace: S.Array(S.Json),
          entries: S.Array(S.Struct({ objectId: S.Natural, value: S.Natural })),
        })
      ),
    })
  ),
}).pipe(
  $I.annoteSchema("Corpus", {
    description: "Thirteen combined Unicode/general histories with complete hook calls and ordered outcomes.",
  })
);
const invalid = () => CitationRuntimeDictionaryFailure.make({ reason: "invalid-input" });
it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("combined Unicode dictionary", (it) => {
  it.effect("matches all pinned transitions, reflected host calls and equality mutation restarts", () =>
    Effect.gen(function* () {
      const raw = yield* (yield* FileSystem.FileSystem).readFileString(
        fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/unicode-dictionary.json", import.meta.url))
      );
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
        "2c8625cb9c7cd72a3a3c030a8606b5d9cada4e14b45e6ffa77065a79162dc22b"
      );
      const corpus = yield* S.decodeEffect(S.fromJsonString(Corpus))(raw);
      expect(corpus.cases).toHaveLength(13);
      expect(A.reduce(corpus.cases, 0, (n, row) => n + row.events.length)).toBe(40);
      for (const row of corpus.cases) {
        let table = O.none<ReturnType<typeof CitationRuntimeDictionary.of>>();
        let changed = false;
        let trace: ReadonlyArray<S.Json> = [];
        const state = Effect.fn("UnicodeDictionaryTest.state")((id: number) =>
          Effect.fromOption(A.get(row.keys, id), invalid)
        );
        const key = Effect.fn("UnicodeDictionaryTest.key")(function* (id: number) {
          const value = yield* state(id);
          if (value.kind !== "text") trace = A.append(trace, { kind: "hash", key: id });
          return CitationRuntimeDictionaryKey.make({ objectId: id, hash: value.hash });
        });
        const action = Effect.fn("UnicodeDictionaryTest.action")(function* () {
          if (changed) return;
          changed = true;
          const current = yield* Effect.fromOption(table, invalid);
          if (row.name === "delete-in-equality" || row.name === "delete-raise") {
            const removed = yield* current.remove(yield* key(0));
            trace = A.append(trace, {
              kind: "remove",
              key: 0,
              result: O.getOrNull(O.map(removed, (entry) => entry.value)),
            });
            if (row.name === "delete-raise")
              return yield* CitationRuntimeDictionaryFailure.make({ reason: "comparison-failed" });
          } else if (row.name === "update-in-equality") {
            yield* current.set(yield* key(0), 99);
            trace = A.append(trace, { kind: "set", key: 0, value: 99 });
          } else if (row.name === "clear-refill") {
            yield* current.clear;
            trace = A.append(trace, { kind: "clear" });
            for (const id of row.initial) {
              yield* current.set(yield* key(id), 200 + id);
              trace = A.append(trace, { kind: "set", key: id, value: 200 + id });
            }
          } else if (row.name === "convert-in-equality") {
            yield* current.set(yield* key(6), 106);
            trace = A.append(trace, { kind: "set", key: 6, value: 106 });
          }
        });
        const comparison = CitationRuntimeDictionaryComparison.of({
          step: Effect.void,
          exactUnicode: Effect.fn("UnicodeDictionaryTest.exact")((id) =>
            state(id).pipe(Effect.map((value) => (value.kind === "text" ? O.some(value.text) : O.none())))
          ),
          equal: Effect.fn("UnicodeDictionaryTest.equal")(function* (left, right) {
            const l = yield* state(left);
            const r = yield* state(right);
            // This controlled rich-compare adapter models Python's reflected
            // host/subclass dispatch. The table supplies stored/query order.
            if (l.kind === "text" && r.kind === "text") return l.text === r.text;
            const first = l.kind === "text" ? right : left;
            const second = l.kind === "text" ? left : right;
            trace = A.append(trace, { kind: "compare", left: first, right: second });
            if (first === 5) yield* action();
            return l.token === r.token;
          }),
        });
        const current = yield* makeCitationRuntimeDictionary({ entries: 64, iterations: 20_000 }).pipe(
          Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
        );
        table = O.some(current);
        for (const id of row.initial) yield* current.set(yield* key(id), 100 + id);
        expect(trace).toEqual([]);
        for (const event of row.events) {
          trace = [];
          const op = event.operation;
          const run =
            op.kind === "clear"
              ? current.clear.pipe(Effect.as(O.none()))
              : op.kind === "set"
                ? current.set(yield* key(op.key), op.value).pipe(Effect.as(O.none()))
                : current.get(yield* key(op.key));
          const result = yield* Effect.result(run);
          if (event.outcome.status === "error") {
            expect(result._tag, row.name).toBe("Failure");
            if (result._tag === "Failure") expect(result.failure.reason).toBe("comparison-failed");
          } else {
            expect(result._tag, row.name).toBe("Success");
            if (result._tag === "Success")
              expect(O.getOrNull(O.map(result.success, (entry) => entry.value)), row.name).toBe(event.outcome.result);
          }
          expect(trace, row.name).toEqual(event.trace);
          expect(
            A.map(yield* current.read, (entry) => ({ objectId: entry.objectId, value: entry.value })),
            row.name
          ).toEqual(event.entries);
        }
      }
    })
  );
  it.effect("bypasses rich comparison for exact Unicode queries and preserves it after conversion", () =>
    Effect.gen(function* () {
      let calls = 0;
      const comparison = CitationRuntimeDictionaryComparison.of({
        step: Effect.void,
        exactUnicode: Effect.fn("UnicodeDictionaryTest.exactKinds")((id) =>
          Effect.succeed(id === 2 ? O.none() : O.some("html"))
        ),
        equal: Effect.fn("UnicodeDictionaryTest.observe")(() =>
          Effect.sync(() => {
            calls++;
            return true;
          })
        ),
      });
      const table = yield* makeCitationRuntimeDictionary({ entries: 8, iterations: 100 }).pipe(
        Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
      );
      const key = (objectId: number) => CitationRuntimeDictionaryKey.make({ objectId, hash: BigInt(7) });
      yield* table.set(key(0), 10);
      expect(O.map(yield* table.get(key(1)), (entry) => entry.value)).toEqual(O.some(10));
      expect(calls).toBe(0);
      yield* table.set(key(2), 11);
      expect(calls).toBe(1);
      yield* table.get(key(1));
      expect(calls).toBe(2);
      yield* table.clear;
      yield* table.set(key(0), 12);
      yield* table.get(key(1));
      expect(calls).toBe(2);
    })
  );
  it.effect("retains a registry across operations while preserving captured aggregate work limits", () =>
    Effect.gen(function* () {
      let remaining = 2000;
      const comparison = CitationRuntimeDictionaryComparison.of({
        exactUnicode: Effect.fn("UnicodeDictionaryTest.retainedText")(() => Effect.succeedSome("html")),
        equal: Effect.fn("UnicodeDictionaryTest.retainedEqual")(() => Effect.succeed(true)),
        step: Effect.suspend(() => {
          if (remaining === 0) return Effect.fail(CitationRuntimeDictionaryFailure.make({ reason: "limit-exceeded" }));
          remaining--;
          return Effect.void;
        }),
      });
      const table = yield* makeCitationRuntimeDictionary({ entries: 2, iterations: 12 }).pipe(
        Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
      );
      const key = CitationRuntimeDictionaryKey.make({ objectId: 0, hash: BigInt(7) });
      for (let run = 0; run < 100; run++) {
        yield* table.set(key, run);
        expect(O.map(yield* table.remove(key), (entry) => entry.value)).toEqual(O.some(run));
      }
      yield* table.set(key, 100);
      remaining = 0;
      expect(yield* Effect.flip(table.get(key))).toMatchObject({ reason: "limit-exceeded" });
      expect(A.map(yield* table.read, (entry) => entry.value)).toEqual([100]);
    })
  );
});
