import {
  CitationRuntimeDictionaryComparison,
  CitationRuntimeDictionaryKey,
  CitationRuntimeDictionaryLimits,
  makeCitationRuntimeDictionary,
} from "@beep/law-practice-server/internal/Citation/RuntimeDictionary";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { assertNone, assertSome, strictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { constant } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";

const key = (objectId: number) => CitationRuntimeDictionaryKey.make({ objectId, hash: BigInt(7) });
const makeTable = Effect.fnUntraced(function* (
  texts: () => HashMap.HashMap<number, string | CitationPythonUnicodeStorage>
) {
  const comparison = CitationRuntimeDictionaryComparison.of({
    step: Effect.void,
    equal: constant(Effect.die("exact Unicode keys must not use rich comparison")),
    exactUnicode: Effect.fn("RuntimeDictionaryCoverageTest.exactUnicode")((objectId: number) =>
      Effect.sync(() => HashMap.get(texts(), objectId))
    ),
  });
  return yield* makeCitationRuntimeDictionary(
    CitationRuntimeDictionaryLimits.make({ entries: 8, iterations: 100 })
  ).pipe(Effect.provideService(CitationRuntimeDictionaryComparison, comparison));
});

it.effect("compares colliding exact Unicode keys by code point across text and native storage", () =>
  Effect.gen(function* () {
    const texts = HashMap.make<ReadonlyArray<readonly [number, string | CitationPythonUnicodeStorage]>>(
      [1, "😀a"],
      [2, "😀a"],
      [
        3,
        CitationPythonUnicodeStorage.make({ width: 4, bytes: new Uint8Array([0x00, 0xf6, 0x01, 0x00, 0x61, 0, 0, 0]) }),
      ],
      [4, "😀b"],
      // A ragged trailing unit whose readable byte matches "AB" still never compares equal.
      [5, "AB"],
      [6, CitationPythonUnicodeStorage.make({ width: 2, bytes: new Uint8Array([0x41, 0x00, 0x42]) })]
    );
    const table = yield* makeTable(() => texts);
    yield* table.set(key(1), 10);
    yield* table.set(key(5), 50);
    const viaText = yield* table.get(key(2));
    assertSome(
      O.map(viaText, (entry) => entry.objectId),
      1
    );
    const viaStorage = yield* table.get(key(3));
    assertSome(
      O.map(viaStorage, (entry) => entry.value),
      10
    );
    const differentPoint = yield* table.get(key(4));
    assertNone(differentPoint);
    const raggedStorage = yield* table.get(key(6));
    assertNone(raggedStorage);
  })
);

it.effect("refuses a probe when a stored exact Unicode key loses its captured text", () =>
  Effect.gen(function* () {
    let texts = HashMap.make<ReadonlyArray<readonly [number, string]>>([1, "x"], [2, "x"]);
    const table = yield* makeTable(() => texts);
    yield* table.set(key(1), 10);
    texts = HashMap.remove(texts, 1);
    const failure = yield* table.get(key(2)).pipe(Effect.flip);
    strictEqual(failure.reason, "invalid-input");
    strictEqual(failure.limit, undefined);
  })
);
