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
import { FastCheck as fc } from "effect/testing";

const schemaCases = [
  ["AiMetricsLabelQueueItem", S.toArbitrary(AiMetricsLabelQueueItem)(fc), S.is(AiMetricsLabelQueueItem)],
  ["AiMetricsLabelQueueInput", S.toArbitrary(AiMetricsLabelQueueInput)(fc), S.is(AiMetricsLabelQueueInput)],
  ["AiMetricsLabelQueueResult", S.toArbitrary(AiMetricsLabelQueueResult)(fc), S.is(AiMetricsLabelQueueResult)],
  ["AiMetricsOutcomeLabelInput", S.toArbitrary(AiMetricsOutcomeLabelInput)(fc), S.is(AiMetricsOutcomeLabelInput)],
  ["AiMetricsBenchmarkCaseInput", S.toArbitrary(AiMetricsBenchmarkCaseInput)(fc), S.is(AiMetricsBenchmarkCaseInput)],
  [
    "AiMetricsBenchmarkCaseListResult",
    S.toArbitrary(AiMetricsBenchmarkCaseListResult)(fc),
    S.is(AiMetricsBenchmarkCaseListResult),
  ],
  ["AiMetricsBenchmarkRunInput", S.toArbitrary(AiMetricsBenchmarkRunInput)(fc), S.is(AiMetricsBenchmarkRunInput)],
  ["AiMetricsWeeklyConfigScore", S.toArbitrary(AiMetricsWeeklyConfigScore)(fc), S.is(AiMetricsWeeklyConfigScore)],
  [
    "AiMetricsWeeklyReportDocument",
    S.toArbitrary(AiMetricsWeeklyReportDocument)(fc),
    S.is(AiMetricsWeeklyReportDocument),
  ],
  ["AiMetricsWeeklyReportInput", S.toArbitrary(AiMetricsWeeklyReportInput)(fc), S.is(AiMetricsWeeklyReportInput)],
  ["AiMetricsWeeklyReportResult", S.toArbitrary(AiMetricsWeeklyReportResult)(fc), S.is(AiMetricsWeeklyReportResult)],
  ["OutcomeLabel", S.toArbitrary(OutcomeLabel)(fc), S.is(OutcomeLabel)],
  ["BenchmarkCase", S.toArbitrary(BenchmarkCase)(fc), S.is(BenchmarkCase)],
  ["BenchmarkRun", S.toArbitrary(BenchmarkRun)(fc), S.is(BenchmarkRun)],
  ["Scorecard", S.toArbitrary(Scorecard)(fc), S.is(Scorecard)],
] satisfies ReadonlyArray<readonly [string, fc.Arbitrary<unknown>, (value: unknown) => boolean]>;

const labelQueueResultArbitrary = S.toArbitrary(AiMetricsLabelQueueResult)(fc);
const benchmarkCaseListResultArbitrary = S.toArbitrary(AiMetricsBenchmarkCaseListResult)(fc);
const weeklyReportResultArbitrary = S.toArbitrary(AiMetricsWeeklyReportResult)(fc);
const outcomeLabelArbitrary = S.toArbitrary(OutcomeLabel)(fc);
const benchmarkCaseArbitrary = S.toArbitrary(BenchmarkCase)(fc);
const benchmarkRunArbitrary = S.toArbitrary(BenchmarkRun)(fc);

const labelQueueResultEquivalent = S.toEquivalence(AiMetricsLabelQueueResult);
const benchmarkCaseListResultEquivalent = S.toEquivalence(AiMetricsBenchmarkCaseListResult);
const weeklyReportResultEquivalent = S.toEquivalence(AiMetricsWeeklyReportResult);
const outcomeLabelEquivalent = S.toEquivalence(OutcomeLabel);
const benchmarkCaseEquivalent = S.toEquivalence(BenchmarkCase);
const benchmarkRunEquivalent = S.toEquivalence(BenchmarkRun);

describe("scorecard schemas", () => {
  it.each(schemaCases)("generates %s values accepted by its source schema", (_name, arbitrary, isValue) => {
    fc.assert(
      fc.property(arbitrary, (value) => {
        expect(isValue(value)).toBe(true);
      }),
      fcRuns(12)
    );
  });

  it.effect("round-trips label queue results through their JSON codec", () =>
    Effect.forEach(
      fc.sample(labelQueueResultArbitrary, 12),
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
      fc.sample(benchmarkCaseListResultArbitrary, 12),
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
      fc.sample(weeklyReportResultArbitrary, 12),
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
      fc.sample(outcomeLabelArbitrary, 12),
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
      fc.sample(benchmarkCaseArbitrary, 12),
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
      fc.sample(benchmarkRunArbitrary, 12),
      Effect.fnUntraced(function* (value) {
        const json = yield* BenchmarkRun.encodeJsonEffect(value);
        const decoded = yield* BenchmarkRun.decodeJsonEffect(json);
        expect(benchmarkRunEquivalent(decoded, value)).toBe(true);
      }),
      { discard: true }
    )
  );
});
