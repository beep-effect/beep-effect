import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
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
        const citationResult1 = yield* FileSystem.FileSystem;
        const raw = yield* citationResult1.readFileString(
          NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/runtime-set.json", import.meta.url))
        );
        const citationResult2 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
        expect(citationResult2).toBe("58ca087e488c94d2db5b6dfef2dfe1d0280f18228b6088a61b14b227d536adfa");
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
              const citationResult3 = yield* set.read;
              expect(
                A.map(citationResult3, (key) => key.objectId),
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
      const citationResult4 = yield* Effect.flip(
        set.add(CitationRuntimeDictionaryKey.make({ objectId: 1, hash: BigInt(7) }))
      );
      expect(citationResult4.reason).toBe("limit-exceeded");
      const citationResult5 = yield* set.read;
      expect(citationResult5).toEqual([first]);
      const exhausted = yield* makeCitationRuntimeSet({ entries: 100, iterations: 1 }).pipe(
        Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
      );
      yield* exhausted.add(first);
      const citationResult6 = yield* Effect.flip(exhausted.add(first));
      expect(citationResult6.reason).toBe("limit-exceeded");
      const citationResult7 = yield* exhausted.read;
      expect(citationResult7).toEqual([first]);
    })
  );
});

const $CopyI = $LawPracticeServerId.create("test/CitationRuntimeSetCopy");
const CopyCase = S.Struct({
  name: S.NonEmptyString,
  initialHashes: S.Array(S.BigIntFromString).check(S.isBetweenLength(100, 100)),
  currentHashes: S.Array(S.BigIntFromString).check(S.isBetweenLength(100, 100)),
  adds: S.Array(S.Natural),
  copied: S.Array(S.Natural),
  rebuilt: S.Array(S.Natural),
  nested: S.Array(S.Natural),
  events: S.Array(
    S.Struct({
      destination: S.Literals(["parent", "target"]),
      key: S.Natural,
      comparisons: S.Array(S.Tuple([S.Natural, S.Natural])),
      parent: S.Array(S.Natural),
      target: S.Array(S.Natural),
    })
  ).check(S.isBetweenLength(5, 5)),
}).pipe($CopyI.annoteSchema("CopyCase", { description: "Independent source copy and subsequent mutation trace." }));
const CopyCorpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-runtime-set-copy/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    hashWidth: S.tag(64),
    hashSeed: S.tag("0"),
    producerSha256: S.tag("09eb3c284c064c047906447ed50143687aaa2d93870d7071b7e66772b7321bcb"),
    cases: S.Array(CopyCase).check(S.isBetweenLength(20, 20)),
  })
).pipe(
  $CopyI.annoteSchema("CopyCorpus", {
    description: "Pinned CPython add-only copy observations, independent from target table logic.",
  })
);
const sameOrder = S.toEquivalence(S.Array(S.Natural));
const replayCopyCase = Effect.fn("RuntimeSetTest.replayCopy")(function* (row: typeof CopyCase.Type) {
  let comparisons = A.empty<readonly [number, number]>();
  const comparison = CitationRuntimeDictionaryComparison.of({
    step: Effect.void,
    equal: Effect.fn("RuntimeSetTest.copyCompare")((left: number, right: number) =>
      Effect.sync(() => {
        comparisons = A.append(comparisons, [left, right]);
        return left === right;
      })
    ),
  });
  const parent = yield* makeCitationRuntimeSet({ entries: 100, iterations: 100_000 }).pipe(
    Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
  );
  for (const id of row.adds)
    yield* parent.add(CitationRuntimeDictionaryKey.make({ objectId: id, hash: A.getUnsafe(row.initialHashes, id) }));
  comparisons = A.empty();
  const target = yield* parent.copy;
  expect(comparisons, row.name).toEqual([]);
  const citationResult8 = yield* target.read;
  expect(
    A.map(citationResult8, (key) => key.objectId),
    row.name
  ).toEqual(row.copied);
  for (const event of row.events) {
    comparisons = A.empty();
    const table = event.destination === "parent" ? parent : target;
    yield* table.add(
      CitationRuntimeDictionaryKey.make({ objectId: event.key, hash: A.getUnsafe(row.currentHashes, event.key) })
    );
    expect(comparisons, row.name).toEqual(event.comparisons);
    const citationResult9 = yield* parent.read;
    expect(
      A.map(citationResult9, (key) => key.objectId),
      row.name
    ).toEqual(event.parent);
    const citationResult10 = yield* target.read;
    expect(
      A.map(citationResult10, (key) => key.objectId),
      row.name
    ).toEqual(event.target);
  }
  comparisons = A.empty();
  const nested = yield* target.copy;
  expect(comparisons, row.name).toEqual([]);
  const citationResult11 = yield* nested.read;
  expect(
    A.map(citationResult11, (key) => key.objectId),
    row.name
  ).toEqual(row.nested);
});

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("source runtime set copies", (it) => {
  it.effect("matches independent copy layouts, cached hashes and later mutation traces", () =>
    Effect.gen(function* () {
      const citationResult12 = yield* FileSystem.FileSystem;
      const raw = yield* citationResult12.readFileString(
        NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/runtime-set-copy.json", import.meta.url))
      );
      const citationResult13 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
      expect(citationResult13).toBe("2e2a92b749916ab9dd277233fcec200402a7e629c37a5355eba8a8e1d3e69195");
      const corpus = yield* S.decodeEffect(CopyCorpus)(raw);
      let different = 0;
      for (const row of corpus.cases) {
        yield* replayCopyCase(row);
        if (!sameOrder(row.copied, row.rebuilt)) different++;
      }
      expect(different).toBe(16);
    })
  );
  it.effect("leaves the source intact when copying exhausts the independent work guard", () =>
    Effect.gen(function* () {
      const comparison = CitationRuntimeDictionaryComparison.of({
        step: Effect.void,
        equal: Effect.fn("RuntimeSetTest.copyGuardEqual")(() => Effect.succeed(false)),
      });
      const parent = yield* makeCitationRuntimeSet({ entries: 100, iterations: 1 }).pipe(
        Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
      );
      const key = CitationRuntimeDictionaryKey.make({ objectId: 0, hash: BigInt(5) });
      yield* parent.add(key);
      const citationResult14 = yield* parent.copy.pipe(Effect.flip);
      expect(citationResult14).toMatchObject({ reason: "limit-exceeded" });
      const citationResult15 = yield* parent.read;
      expect(citationResult15).toEqual([key]);
    })
  );
});
