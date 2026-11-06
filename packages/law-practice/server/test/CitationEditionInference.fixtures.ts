import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { makeCitationEditionInference } from "@beep/law-practice-server/internal/Citation/EditionInference";
import {
  CitationFrozenEditionFailure,
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { CitationRuntimeEdition } from "@beep/law-practice-server/internal/Citation/PublicationResourceHash";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import * as TestClock from "effect/testing/TestClock";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import { makeCitationNativeManualClock, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationEditionInference");
const Index = S.Natural.check(S.isLessThan(5));
const Indices = S.Array(Index);
const Row = S.Tuple([Indices, Indices, S.NullOr(S.Int), S.NullOr(Index), S.NullOr(Index), Indices, S.Natural]);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-edition-inference/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    currentYear: S.tag(2026),
    producerSha256: S.tag("e68a96683ae75e75bead81ce7c9922b4b37a72ab723a5bbcbd2c4903368ac1ab"),
    synthetic: S.Array(CitationRuntimeEdition).check(S.isBetweenLength(5, 5)),
    canonical: S.Array(CitationEditionRef).check(S.isBetweenLength(2533, 2533)),
    cases: S.Array(Row).check(S.isBetweenLength(2480, 2480)),
    yearCases: S.Array(S.Tuple([S.Natural, S.Int, S.Boolean])).check(S.isBetweenLength(25718, 25718)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original live-calendar includes_year and stateful guess_edition observations.",
  })
);
const load = Effect.fn("EditionInferenceTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/edition-inference.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("f59cd4e6a254e1ef2df7ca962e9ccfdbcaac8a66b91979683a00eb1ae6cafed1");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
const setYear = Effect.fn("EditionInferenceTest.setYear")(function* (year: number) {
  const date = yield* Effect.fromOption(DateTime.make({ year, month: 11, day: 3 }));
  const epoch = DateTime.toEpochMillis(date);
  yield* TestClock.setTime(epoch);
});
const controlOwner = (values: ReadonlyArray<CitationRuntimeEdition>, reads: Array<CitationEditionRef>) => {
  const entries = HashMap.fromIterable(A.map(values, (value) => Tuple.make(value.edition, value)));
  const lookup = Effect.fn("EditionInferenceTest.lookup")((ref: CitationEditionRef) =>
    Effect.fromOption(HashMap.get(entries, ref), () => CitationFrozenEditionFailure.make({ reason: "missing-edition" }))
  );
  return CitationFrozenEditions.of({
    source: Effect.fn("EditionInferenceTest.source")(function* (ref: CitationEditionRef) {
      reads.push(ref);
      return (yield* lookup(ref)).value.reporter.source;
    }),
    lookup,
    lookupMany: Effect.fn("EditionInferenceTest.unusedBulkLookup")(() => Effect.die("Unexpected bulk edition lookup")),
  });
};
/** All source candidate choices, duplicates and retained prior state. */
export const replayCitationEditionGuesses = Effect.fn("EditionInferenceTest.guesses")(function* () {
  const corpus = yield* load();
  yield* setYear(2026);
  const reads = A.empty<CitationEditionRef>();
  const owner = controlOwner(corpus.synthetic, reads);
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const inference = yield* makeCitationEditionInference(limits).pipe(
    Effect.provideService(CitationFrozenEditions, owner),
    DateTime.withCurrentZoneOffset(0)
  );
  const ref = (index: number) => A.getUnsafe(corpus.synthetic, index).edition;
  const invalidReference = yield* inference.includesYear("not-an-edition", 2026).pipe(Effect.flip);
  expect(invalidReference).toMatchObject({ reason: "invalid-input" });
  const invalidYear = yield* inference.includesYear(ref(0), 2026.5).pipe(Effect.flip);
  expect(invalidYear).toMatchObject({ reason: "invalid-input" });
  const invalidCandidates = yield* inference.guess({}).pipe(Effect.flip);
  expect(invalidCandidates).toMatchObject({ reason: "invalid-input" });
  const invalidEnvelope = yield* inference.guess(null).pipe(Effect.flip);
  expect(invalidEnvelope).toMatchObject({ reason: "invalid-input" });
  const invalidGuessYear = yield* inference
    .guess({ exact: [], variation: [], year: 2026.5, prior: null })
    .pipe(Effect.flip);
  expect(invalidGuessYear).toMatchObject({ reason: "invalid-input" });
  const invalidPolicy = yield* makeCitationEditionInference({}).pipe(
    Effect.provideService(CitationFrozenEditions, owner),
    DateTime.withCurrentZoneOffset(0),
    Effect.flip
  );
  expect(invalidPolicy).toMatchObject({ reason: "invalid-input" });
  const maybe = (index: number | null) => (index === null ? null : ref(index));
  for (const [exact, variation, year, prior, expected, calls, clockReads] of corpus.cases) {
    for (const yearInput of [year, year === null ? null : BigInt(year)]) {
      reads.length = 0;
      const guess = yield* inference.guess({
        exact: A.map(exact, ref),
        variation: A.map(variation, ref),
        year: yearInput,
        prior: maybe(prior),
      });
      expect(guess).toBe(maybe(expected));
      expect(clockReads).toBe(calls.length);
      expect(reads).toEqual(year !== null && year <= 2026 ? A.map(calls, ref) : []);
    }
  }
  const forward = yield* inference.includesYear(ref(0), 2027);
  expect(forward).toBe(false);
  const boundary = yield* Effect.fromOption(DateTime.make("2026-12-31T23:30:00Z"));
  const epoch = DateTime.toEpochMillis(boundary);
  yield* TestClock.setTime(epoch);
  const capturedZone = yield* inference
    .includesYear(ref(0), 2027)
    .pipe(DateTime.withCurrentZoneOffset(2 * 60 * 60 * 1000));
  expect(capturedZone).toBe(false);
  yield* setYear(2027);
  const live = yield* inference.includesYear(ref(0), 2027);
  expect(live).toBe(true);
  yield* setYear(10000);
  const invalidClock = yield* inference.includesYear(ref(0), 2027).pipe(Effect.flip);
  expect(invalidClock).toMatchObject({ reason: "invalid-clock" });
  yield* setYear(2027);
  const first = A.getUnsafe(corpus.synthetic, 0);
  const malformedEdition = CitationRuntimeEdition.make({
    ...first,
    value: { ...first.value, start: "invalid-start-date" },
  });
  const corrupt = yield* makeCitationEditionInference(limits).pipe(
    Effect.provideService(CitationFrozenEditions, controlOwner([malformedEdition], [])),
    DateTime.withCurrentZoneOffset(0)
  );
  const invalidEdition = yield* corrupt.includesYear(first.edition, 2026).pipe(Effect.flip);
  expect(invalidEdition).toMatchObject({ reason: "invalid-edition" });
  const bounded = yield* makeCitationEditionInference({ ...limits, candidates: 1 }).pipe(
    Effect.provideService(CitationFrozenEditions, owner),
    DateTime.withCurrentZoneOffset(0)
  );
  const refused = yield* bounded
    .guess({ exact: [ref(0), ref(0)], variation: [], year: 2026, prior: null })
    .pipe(Effect.flip);
  expect(refused).toMatchObject({ limit: "candidates" });
});
/** Compare canonical boundaries against the independently authenticated owner. */
export const replayCitationEditionYears = Effect.fn("EditionInferenceTest.years")(function* (full: boolean) {
  const corpus = yield* load();
  yield* setYear(2026);
  const { bundle } = yield* loadCitationFrozenEditionFixtures();
  const owner = yield* makeCitationFrozenEditions(bundle);
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const inference = yield* makeCitationEditionInference(limits).pipe(
    Effect.provideService(CitationFrozenEditions, owner),
    DateTime.withCurrentZoneOffset(0)
  );
  const rows = full ? corpus.yearCases : A.filter(corpus.yearCases, (_, index) => index % 257 === 0);
  expect(rows).toHaveLength(full ? 25718 : 101);
  for (const [index, year, expected] of rows) {
    const edition = yield* Effect.fromOption(A.get(corpus.canonical, index));
    const actual = yield* inference.includesYear(edition, year);
    expect(actual).toBe(expected);
  }
});

/** An injected owner may wait; the installed deadline still bounds the method. */
export const assertCitationEditionInferenceDeadline = Effect.fn("EditionInferenceTest.deadline")(function* () {
  const corpus = yield* load();
  const timer = yield* makeCitationNativeManualClock(Duration.millis(997));
  const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
  const unavailable = Effect.fn("EditionInferenceTest.blockedOwner")(() => Effect.never);
  const owner = CitationFrozenEditions.of({ source: unavailable, lookup: unavailable, lookupMany: unavailable });
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const inference = yield* makeCitationEditionInference({ ...limits, extractDeadline: Duration.millis(997) }).pipe(
    Effect.provideService(CitationFrozenEditions, owner),
    Effect.provideService(Clock.Clock, timer.clock),
    DateTime.withCurrentZoneOffset(0)
  );
  const edition = yield* Effect.fromOption(A.head(corpus.synthetic));
  const pending = yield* inference
    .includesYear(edition.edition, 0)
    .pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
  yield* timer.trigger;
  const failure = yield* Fiber.join(pending).pipe(Effect.flip);
  expect(failure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "extractDeadline" });
});
