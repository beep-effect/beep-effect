import {
  CitationRuntimeDictionaryComparison,
  CitationRuntimeDictionaryKey,
  makeCitationRuntimeDictionary,
} from "@beep/law-practice-server/internal/Citation/RuntimeDictionary";
import { makeCitationRuntimeSet } from "@beep/law-practice-server/internal/Citation/RuntimeSet";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";

const comparison = CitationRuntimeDictionaryComparison.of({
  step: Effect.void,
  equal: Effect.fn("TableCapacityTest.equal")(() => Effect.succeed(false)),
});
const first = CitationRuntimeDictionaryKey.make({ objectId: 1, hash: BigInt(1) });
const second = CitationRuntimeDictionaryKey.make({ objectId: 2, hash: BigInt(2) });
it.effect("attributes dictionary/set capacities to captured owner budgets and leaves unbound labels absent", () =>
  Effect.gen(function* () {
    const policy = { entries: 1, iterations: 100, entryLimit: "authorities", iterationLimit: "resolutionIterations" };
    const dictionary = yield* makeCitationRuntimeDictionary(policy).pipe(
      Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
    );
    const set = yield* makeCitationRuntimeSet(policy).pipe(
      Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
    );
    policy.entryLimit = "sourceUtf16";
    policy.iterationLimit = "sourceUtf16";
    yield* dictionary.set(first, 0);
    yield* set.add(first);
    const dictionaryFailure = yield* dictionary.set(second, 1).pipe(Effect.flip);
    const setFailure = yield* set.add(second).pipe(Effect.flip);
    expect(dictionaryFailure).toMatchObject({ reason: "limit-exceeded", limit: "authorities" });
    expect(setFailure).toMatchObject({ reason: "limit-exceeded", limit: "authorities" });
    const copy = yield* set.copy;
    const copyFailure = yield* copy.add(second).pipe(Effect.flip);
    expect(copyFailure).toMatchObject({ reason: "limit-exceeded", limit: "authorities" });
    const unbound = yield* makeCitationRuntimeDictionary({ entries: 1, iterations: 100 }).pipe(
      Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
    );
    yield* unbound.set(first, 0);
    const absent = yield* unbound.set(second, 0).pipe(Effect.flip);
    expect(absent.reason).toBe("limit-exceeded");
    expect("limit" in absent).toBe(false);
  })
);
it.effect("distinguishes probe work from entry capacity and retains table contents on refusal", () =>
  Effect.gen(function* () {
    const policy = { entries: 10, iterations: 1, entryLimit: "authorities", iterationLimit: "resolutionIterations" };
    const dictionary = yield* makeCitationRuntimeDictionary(policy).pipe(
      Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
    );
    const set = yield* makeCitationRuntimeSet(policy).pipe(
      Effect.provideService(CitationRuntimeDictionaryComparison, comparison)
    );
    policy.iterationLimit = "sourceUtf16";
    const dictionaryFailure = yield* dictionary.set(first, 0).pipe(Effect.flip);
    yield* set.add(first);
    const setFailure = yield* set.add(second).pipe(Effect.flip);
    expect(dictionaryFailure).toMatchObject({ reason: "limit-exceeded", limit: "resolutionIterations" });
    expect(setFailure).toMatchObject({ reason: "limit-exceeded", limit: "resolutionIterations" });
    const entries = yield* dictionary.read;
    const values = yield* set.read;
    expect(entries).toEqual([]);
    expect(values).toEqual([first]);
  })
);
