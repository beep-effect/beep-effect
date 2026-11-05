import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationMetadataYear } from "@beep/law-practice-server/internal/Citation/MetadataYear";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { makeCitationNativeManualClock, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationMetadataYear");
const Native = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex });
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-metadata-year/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    producerSha256: S.tag("2f750eee2f2cebeca4aad071c72999797a23c8e0acb1f72b9f943a835ac22807"),
    python: S.tag("3.11.15"),
    unicode: S.tag("14.0.0"),
    integerDigitLimit: S.tag(4300),
    decimalPoints: S.tag(660),
    nondecimalDigits: S.tag(128),
    whitespacePoints: S.tag(29),
    cases: S.Array(S.Struct({ highest: S.Int, source: Native, year: S.NullOr(S.Int) })).check(
      S.isBetweenLength(1169, 1169)
    ),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual source get_year observations with explicitly frozen source import-time bounds.",
  })
);
const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
const setYear = Effect.fn("MetadataYearTest.setYear")(function* (year: number) {
  const date = yield* Effect.fromOption(DateTime.make({ year, month: 11, day: 3 }));
  const epoch = DateTime.toEpochMillis(date);
  yield* TestClock.setTime(epoch);
});
it.layer(citationTokenizerTestLayer)("source metadata year", (it) => {
  it.layer(TestClock.layer())("source integer observations", (it) => {
    it.effect(
      "matches every native source integer and frozen year-bound observation",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const bytes = yield* fs.readFile(
            NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/metadata-year.json", import.meta.url))
          );
          const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
          expect(hash).toBe("af1fab4a6b980c333431a28aef7f4529cd4d684d4d2b56689e1873b0f92a899a");
          const corpus = yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
          const limits = (yield* defaultCitationEnginePolicy).limits;
          for (const highest of [1600, 2026, 2027, 9999, 10000]) {
            yield* setYear(highest - 1);
            const parser = yield* makeCitationMetadataYear(limits).pipe(DateTime.withCurrentZoneOffset(0));
            expect(parser.highestValidYear).toBe(highest);
            const rows = A.filter(corpus.cases, (row) => row.highest === highest);
            for (const row of rows) {
              const actual = yield* parser.getYear(row.source);
              expect(actual).toEqual(O.fromNullishOr(row.year));
            }
          }
        }),
      { timeout: 60000 }
    );
  });
  it.layer(TestClock.layer())("captured year bounds", (it) => {
    it.effect("captures the installation zone and Clock year rather than caller time", () =>
      Effect.gen(function* () {
        const date = yield* Effect.fromOption(DateTime.make("2026-12-31T23:30:00Z"));
        const epoch = DateTime.toEpochMillis(date);
        yield* TestClock.setTime(epoch);
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const east = yield* makeCitationMetadataYear(limits).pipe(DateTime.withCurrentZoneOffset(2 * 60 * 60 * 1000));
        const west = yield* makeCitationMetadataYear(limits).pipe(DateTime.withCurrentZoneOffset(-2 * 60 * 60 * 1000));
        expect(east.highestValidYear).toBe(2028);
        expect(west.highestValidYear).toBe(2027);
        yield* setYear(2030);
        const accepted = yield* east.getYear(native("2028"));
        const refused = yield* west.getYear(native("2028"));
        assertSome(accepted, 2028);
        assertNone(refused);
        yield* setYear(10000);
        const invalidClock = yield* makeCitationMetadataYear(limits).pipe(
          DateTime.withCurrentZoneOffset(0),
          Effect.flip
        );
        expect(invalidClock).toMatchObject({ reason: "invalid-clock" });
      })
    );
  });
  it.layer(TestClock.layer())("native input refusal", (it) => {
    it.effect("refuses malformed or oversized native input and recovers", () =>
      Effect.gen(function* () {
        yield* setYear(2026);
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const parser = yield* makeCitationMetadataYear({ ...limits, producedTextUtf16: 4 }).pipe(
          DateTime.withCurrentZoneOffset(0)
        );
        const invalid = yield* parser.getYear({ width: 2, bytes: new Uint8Array([0]) }).pipe(Effect.flip);
        expect(invalid).toMatchObject({ reason: "invalid-input" });
        const oversized = yield* parser.getYear(native("02000")).pipe(Effect.flip);
        expect(oversized).toMatchObject({ limit: "producedTextUtf16" });
        const fresh = yield* parser.getYear(native("2000"));
        assertSome(fresh, 2000);
      })
    );
  });
  it.layer(TestClock.layer())("captured deadline", (it) => {
    it.effect("retains its captured deadline under a disabled caller Clock", () =>
      Effect.gen(function* () {
        yield* setYear(2026);
        const timer = yield* makeCitationNativeManualClock(Duration.millis(997));
        const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const parser = yield* makeCitationMetadataYear({ ...limits, extractDeadline: Duration.millis(997) }).pipe(
          DateTime.withCurrentZoneOffset(0),
          Effect.provideService(Clock.Clock, timer.clock)
        );
        const pending = yield* parser
          .getYear(native(Str.repeat(65536)("0")))
          .pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
        yield* timer.trigger;
        const failure = yield* Fiber.join(pending).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "extractDeadline" });
      })
    );
  });
});
