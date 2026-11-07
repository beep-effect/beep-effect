/** Original Edition.includes_year assertions from eyecite 2.7.6, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { makeCitationEditionInference } from "@beep/law-practice-server/internal/Citation/EditionInference";
import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const Operand = S.Struct({ kind: S.tag("value"), value: S.Boolean });
const Assertion = S.fromJsonString(
  S.Struct({
    passed: S.tag(true),
    relation: S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) }),
    operands: S.Tuple([Operand, Operand]),
    context: S.Struct({
      values: S.Struct({
        date_in_reporter: S.Boolean,
        expected: S.Boolean,
        year: S.Int,
        edition: S.Array(S.Struct({ artifactSha256: CitationEditionRef })).check(S.isMinLength(1)),
      }),
    }),
  })
);
const Capture = S.fromJsonString(
  S.Struct({
    clockDate: S.String,
    events: S.Array(S.Struct({ id: S.String, test: S.String, payload: S.String })),
  })
);

it.layer(citationTokenizerTestLayer)("original edition-year assertions", (it) => {
  it.layer(TestClock.layer())("captured source calendar", (it) => {
    it.effect("replays all eight original includes-year comparisons with authenticated edition payloads", () =>
      Effect.gen(function* () {
        const raw = yield* readCitationOracleFixture(
          "assertion-cases",
          "c7ea12ec5ba0d66257affc4c6e54e8b2fa2ffdd0d79f41c1b701000e0edaf33f"
        );
        const capture = yield* S.decodeEffect(Capture)(raw);
        const clock = yield* Effect.fromOption(DateTime.make(`${capture.clockDate}T00:00:00.000Z`));
        const epoch = DateTime.toEpochMillis(clock);
        yield* TestClock.setTime(epoch);
        const { bundle } = yield* loadCitationFrozenEditionFixtures();
        const owner = yield* makeCitationFrozenEditions(bundle);
        const policy = yield* defaultCitationEnginePolicy;
        const inference = yield* makeCitationEditionInference(policy.limits).pipe(
          Effect.provideService(CitationFrozenEditions, owner),
          DateTime.withCurrentZoneOffset(0)
        );
        const rows = A.filter(
          capture.events,
          (row) => row.test === "tests.test_FindTest.FindTest.test_date_in_editions"
        );
        expect(rows).toHaveLength(8);
        for (const row of rows) {
          const criterion = yield* S.decodeEffect(Assertion)(row.payload);
          const original = criterion.context.values;
          expect(criterion.operands[0].value, row.id).toBe(original.date_in_reporter);
          expect(criterion.operands[1].value, row.id).toBe(original.expected);
          expect(original.date_in_reporter, row.id).toBe(original.expected);
          const edition = A.getUnsafe(original.edition, 0).artifactSha256;
          const actual = yield* inference.includesYear(edition, original.year);
          expect(actual, row.id).toBe(original.expected);
        }
      })
    );
  });
});
