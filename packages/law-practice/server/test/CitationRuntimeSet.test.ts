import * as NodeURL from "node:url";
import {
  CitationRuntimeDictionaryComparison,
  CitationRuntimeDictionaryFailure,
  CitationRuntimeDictionaryKey,
} from "@beep/law-practice-server/internal/Citation/RuntimeDictionary";
import { makeCitationRuntimeSet } from "@beep/law-practice-server/internal/Citation/RuntimeSet";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";

const Key = S.Struct({
  objectId: S.Natural,
  hash: S.BigIntFromString,
  token: S.String,
  mode: S.Literals(["hash", "token", "false"]),
  error: S.Boolean,
});
const Corpus = S.fromJsonString(
  S.Struct({
    cases: S.Array(
      S.Struct({
        name: S.String,
        events: S.Array(
          S.Struct({
            operation: S.Struct({ kind: S.Literals(["add", "hash", "error"]), key: S.Natural }),
            keys: S.Array(Key),
            outcome: S.Union([
              S.Struct({ status: S.tag("value") }),
              S.Struct({ status: S.tag("error"), kind: S.tag("ValueError") }),
            ]),
            comparisons: S.Array(S.Tuple([S.Natural, S.Natural])),
            objects: S.Array(S.Natural),
          })
        ),
      })
    ),
  })
);
it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("source runtime candidate set", (it) => {
  it.effect(
    "matches all source comparison traces and bucket iteration through collisions, growth and changed hashes",
    () =>
      Effect.gen(function* () {
        const raw = yield* (yield* FileSystem.FileSystem).readFileString(
          NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/runtime-set.json", import.meta.url))
        );
        expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
          "58ca087e488c94d2db5b6dfef2dfe1d0280f18228b6088a61b14b227d536adfa"
        );
        const corpus = yield* S.decodeEffect(Corpus)(raw);
        expect(corpus.cases).toHaveLength(8);
        let events = 0;
        yield* Effect.forEach(
          corpus.cases,
          Effect.fnUntraced(function* (row) {
            let current = A.getUnsafe(row.events, 0).keys;
            let comparisons = A.empty<readonly [number, number]>();
            const comparison = CitationRuntimeDictionaryComparison.of({
              step: Effect.void,
              equal: Effect.fn("RuntimeSetTest.equal")(function* (left: number, right: number) {
                comparisons = A.append(comparisons, [left, right]);
                const a = A.getUnsafe(current, left);
                const b = A.getUnsafe(current, right);
                if (a.error) return yield* CitationRuntimeDictionaryFailure.make({ reason: "comparison-failed" });
                return a.mode === "false" ? false : a.mode === "hash" ? a.hash === b.hash : a.token === b.token;
              }),
            });
            const set = yield* makeCitationRuntimeSet({ entries: 100, iterations: 100000 }).pipe(
              Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
            );
            for (const [index, event] of A.map(row.events, (event, index) => [index, event] as const)) {
              events += 1;
              current = event.keys;
              comparisons = A.empty();
              const label = `${row.name}:${index}`;
              if (event.operation.kind === "add") {
                const key = A.getUnsafe(current, event.operation.key);
                const run = set.add(CitationRuntimeDictionaryKey.make({ objectId: key.objectId, hash: key.hash }));
                if (event.outcome.status === "error") {
                  const failure = yield* Effect.flip(run);
                  expect(failure.reason, label).toBe("comparison-failed");
                } else yield* run;
              }
              expect(comparisons, label).toEqual(event.comparisons);
              expect(
                A.map(yield* set.read, (key) => key.objectId),
                label
              ).toEqual(event.objects);
            }
          }),
          { concurrency: 1, discard: true }
        );
        expect(events).toBe(71);
      })
  );
  it.effect("enforces active-entry and work ceilings without losing an existing member", () =>
    Effect.gen(function* () {
      const comparison = CitationRuntimeDictionaryComparison.of({
        step: Effect.void,
        equal: Effect.fn("RuntimeSetTest.neverEqual")(() => Effect.succeed(false)),
      });
      const set = yield* makeCitationRuntimeSet({ entries: 1, iterations: 100 }).pipe(
        Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
      );
      const first = CitationRuntimeDictionaryKey.make({ objectId: 0, hash: BigInt(7) });
      yield* set.add(first);
      expect(
        (yield* Effect.flip(set.add(CitationRuntimeDictionaryKey.make({ objectId: 1, hash: BigInt(7) })))).reason
      ).toBe("limit-exceeded");
      expect(yield* set.read).toEqual([first]);
      const exhausted = yield* makeCitationRuntimeSet({ entries: 100, iterations: 1 }).pipe(
        Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
      );
      yield* exhausted.add(first);
      expect((yield* Effect.flip(exhausted.add(first))).reason).toBe("limit-exceeded");
      expect(yield* exhausted.read).toEqual([first]);
    })
  );
});
