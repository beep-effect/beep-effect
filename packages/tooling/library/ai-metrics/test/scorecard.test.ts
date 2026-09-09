import { fcRuns } from "@beep/fc-runs";
import { BenchmarkCase, BenchmarkRun, OutcomeLabel, Scorecard } from "@beep/repo-ai-metrics/models";
import {
  AiMetricsBenchmarkCaseInput,
  AiMetricsBenchmarkCaseListResult,
  AiMetricsBenchmarkRunInput,
  AiMetricsLabelQueueInput,
  AiMetricsLabelQueueItem,
  AiMetricsLabelQueueResult,
  AiMetricsOutcomeLabelInput,
  AiMetricsWeeklyConfigScore,
  AiMetricsWeeklyReportDocument,
  AiMetricsWeeklyReportInput,
  AiMetricsWeeklyReportResult,
} from "@beep/repo-ai-metrics/scorecard";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const schemaCases = [
  ["AiMetricsLabelQueueItem", Arbitrary.schema(AiMetricsLabelQueueItem), S.is(AiMetricsLabelQueueItem)],
  ["AiMetricsLabelQueueInput", Arbitrary.schema(AiMetricsLabelQueueInput), S.is(AiMetricsLabelQueueInput)],
  ["AiMetricsLabelQueueResult", Arbitrary.schema(AiMetricsLabelQueueResult), S.is(AiMetricsLabelQueueResult)],
  ["AiMetricsOutcomeLabelInput", Arbitrary.schema(AiMetricsOutcomeLabelInput), S.is(AiMetricsOutcomeLabelInput)],
  ["AiMetricsBenchmarkCaseInput", Arbitrary.schema(AiMetricsBenchmarkCaseInput), S.is(AiMetricsBenchmarkCaseInput)],
  [
    "AiMetricsBenchmarkCaseListResult",
    Arbitrary.schema(AiMetricsBenchmarkCaseListResult),
    S.is(AiMetricsBenchmarkCaseListResult),
  ],
  ["AiMetricsBenchmarkRunInput", Arbitrary.schema(AiMetricsBenchmarkRunInput), S.is(AiMetricsBenchmarkRunInput)],
  ["AiMetricsWeeklyConfigScore", Arbitrary.schema(AiMetricsWeeklyConfigScore), S.is(AiMetricsWeeklyConfigScore)],
  [
    "AiMetricsWeeklyReportDocument",
    Arbitrary.schema(AiMetricsWeeklyReportDocument),
    S.is(AiMetricsWeeklyReportDocument),
  ],
  ["AiMetricsWeeklyReportInput", Arbitrary.schema(AiMetricsWeeklyReportInput), S.is(AiMetricsWeeklyReportInput)],
  ["AiMetricsWeeklyReportResult", Arbitrary.schema(AiMetricsWeeklyReportResult), S.is(AiMetricsWeeklyReportResult)],
  ["OutcomeLabel", Arbitrary.schema(OutcomeLabel), S.is(OutcomeLabel)],
  ["BenchmarkCase", Arbitrary.schema(BenchmarkCase), S.is(BenchmarkCase)],
  ["BenchmarkRun", Arbitrary.schema(BenchmarkRun), S.is(BenchmarkRun)],
  ["Scorecard", Arbitrary.schema(Scorecard), S.is(Scorecard)],
] satisfies ReadonlyArray<readonly [string, Arbitrary.Arbitrary<unknown>, (value: unknown) => boolean]>;

const labelQueueResultArbitrary = Arbitrary.schema(AiMetricsLabelQueueResult);
const benchmarkCaseListResultArbitrary = Arbitrary.schema(AiMetricsBenchmarkCaseListResult);
const weeklyReportResultArbitrary = Arbitrary.schema(AiMetricsWeeklyReportResult);
const outcomeLabelArbitrary = Arbitrary.schema(OutcomeLabel);
const benchmarkCaseArbitrary = Arbitrary.schema(BenchmarkCase);
const benchmarkRunArbitrary = Arbitrary.schema(BenchmarkRun);

const labelQueueResultEquivalent = S.toEquivalence(AiMetricsLabelQueueResult);
const benchmarkCaseListResultEquivalent = S.toEquivalence(AiMetricsBenchmarkCaseListResult);
const weeklyReportResultEquivalent = S.toEquivalence(AiMetricsWeeklyReportResult);
const outcomeLabelEquivalent = S.toEquivalence(OutcomeLabel);
const benchmarkCaseEquivalent = S.toEquivalence(BenchmarkCase);
const benchmarkRunEquivalent = S.toEquivalence(BenchmarkRun);

describe("scorecard schemas", () => {
  it.each(schemaCases)("generates %s values accepted by its source schema", (_name, arbitrary, isValue) => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([arbitrary]),
          ([value]) => {
            expect(isValue(value)).toBe(true);

            return true;
          },
          fcRuns(12)
        )
      )._tag
    ).toBe("Passed");
  });

  it.effect("round-trips label queue results through their JSON codec", () =>
    Effect.forEach(
      Effect.runSync(Arbitrary.sampleEffect(labelQueueResultArbitrary, { count: 12 })),
      Effect.fnUntraced(function* (value) {
        const json = yield* AiMetricsLabelQueueResult.encodeJsonEffect(value);
        const decoded = yield* AiMetricsLabelQueueResult.decodeJsonEffect(json);
        expect(labelQueueResultEquivalent(decoded, value)).toBe(true);
      }),
      { discard: true }
    )
  );

  it.effect("round-trips benchmark case list results through their JSON codec", () =>
    Effect.forEach(
      Effect.runSync(Arbitrary.sampleEffect(benchmarkCaseListResultArbitrary, { count: 12 })),
      Effect.fnUntraced(function* (value) {
        const json = yield* AiMetricsBenchmarkCaseListResult.encodeJsonEffect(value);
        const decoded = yield* AiMetricsBenchmarkCaseListResult.decodeJsonEffect(json);
        expect(benchmarkCaseListResultEquivalent(decoded, value)).toBe(true);
      }),
      { discard: true }
    )
  );

  it.effect("round-trips weekly report results through their JSON codec", () =>
    Effect.forEach(
      Effect.runSync(Arbitrary.sampleEffect(weeklyReportResultArbitrary, { count: 12 })),
      Effect.fnUntraced(function* (value) {
        const json = yield* AiMetricsWeeklyReportResult.encodeJsonEffect(value);
        const decoded = yield* AiMetricsWeeklyReportResult.decodeJsonEffect(json);
        expect(weeklyReportResultEquivalent(decoded, value)).toBe(true);
      }),
      { discard: true }
    )
  );

  it.effect("round-trips rendered outcome labels through their JSON codec", () =>
    Effect.forEach(
      Effect.runSync(Arbitrary.sampleEffect(outcomeLabelArbitrary, { count: 12 })),
      Effect.fnUntraced(function* (value) {
        const json = yield* OutcomeLabel.encodeJsonEffect(value);
        const decoded = yield* OutcomeLabel.decodeJsonEffect(json);
        expect(outcomeLabelEquivalent(decoded, value)).toBe(true);
      }),
      { discard: true }
    )
  );

  it.effect("round-trips rendered benchmark cases through their JSON codec", () =>
    Effect.forEach(
      Effect.runSync(Arbitrary.sampleEffect(benchmarkCaseArbitrary, { count: 12 })),
      Effect.fnUntraced(function* (value) {
        const json = yield* BenchmarkCase.encodeJsonEffect(value);
        const decoded = yield* BenchmarkCase.decodeJsonEffect(json);
        expect(benchmarkCaseEquivalent(decoded, value)).toBe(true);
      }),
      { discard: true }
    )
  );

  it.effect("round-trips rendered benchmark runs through their JSON codec", () =>
    Effect.forEach(
      Effect.runSync(Arbitrary.sampleEffect(benchmarkRunArbitrary, { count: 12 })),
      Effect.fnUntraced(function* (value) {
        const json = yield* BenchmarkRun.encodeJsonEffect(value);
        const decoded = yield* BenchmarkRun.decodeJsonEffect(json);
        expect(benchmarkRunEquivalent(decoded, value)).toBe(true);
      }),
      { discard: true }
    )
  );
});
