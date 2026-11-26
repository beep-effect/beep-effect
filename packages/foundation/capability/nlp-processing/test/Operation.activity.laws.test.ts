import { verifyActivityRecord } from "@beep/jsonc/ActivityRecord";
import { ActivityPin } from "@beep/jsonc/ActivityStart";
import {
  ActivityFacts,
  ActivityFloor,
  ActivityLogReducer,
  CurrentActivity,
  composeLogged,
  Logged,
  LoggedFailure,
  withActivity,
} from "@beep/nlp-processing/Activity";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  ClockScript,
  foldPipeline,
  loggedStep,
  mintInputs,
  PipelineDescriptor,
  StepFailure,
  scriptedClock,
  stepEdition,
  stepTerm,
} from "./support/PipelineDescriptor.ts";
import type { ActivityRecord } from "@beep/jsonc/ActivityRecord";
import type { ContentHash } from "@beep/schema/ContentHash";
import type { Entities, LoggedStep, Step } from "./support/PipelineDescriptor.ts";

const editionOf = (record: ActivityRecord): string =>
  record.start.pin._tag === "Engine" ? record.start.pin.edition : record.start.pin.version;

const startedSteps = (steps: ReadonlyArray<Step>): number =>
  O.match(
    A.findFirstIndex(steps, (step) => step.fail),
    { onNone: () => A.length(steps), onSome: (index) => index + 1 }
  );

const runPipeline = Effect.fnUntraced(function* (
  pipeline: LoggedStep,
  inputs: Entities,
  script: ReadonlyArray<number> & readonly [number, ...Array<number>]
) {
  return yield* Effect.result(pipeline.run(inputs)).pipe(Effect.provideService(Clock.Clock, scriptedClock(script)));
});

const logOf = (
  result: Result.Result<
    { readonly activities: HashSet.HashSet<ActivityRecord> },
    { readonly activities: HashSet.HashSet<ActivityRecord> }
  >
) =>
  A.fromIterable(
    Result.match(result, { onFailure: (failure) => failure.activities, onSuccess: (success) => success.activities })
  );

const usedBeforeGenerated = (records: ReadonlyArray<ActivityRecord>): boolean =>
  A.some(records, (producer) =>
    A.some(
      records,
      (consumer) =>
        HashSet.size(HashSet.intersection(producer.generated, consumer.start.used)) > 0 &&
        DateTime.isGreaterThan(producer.ended, consumer.start.started)
    )
  );

const descending: readonly [number, ...Array<number>] = [10_000, ...A.makeBy(400, (offset) => 9_990 - offset * 20)];

const unflooredCompose = (f: LoggedStep, g: LoggedStep): LoggedStep => ({
  name: stepTerm,
  run: (input) =>
    Effect.flatMap(f.run(input), (first) =>
      Effect.mapBoth(g.run(first.value), {
        onFailure: (failure) => ({
          ...failure,
          activities: ActivityLogReducer.combine(first.activities, failure.activities),
        }),
        onSuccess: (second) => ({
          value: second.value,
          activities: ActivityLogReducer.combine(first.activities, second.activities),
        }),
      })
    ),
});

const successOnly = (step: LoggedStep): LoggedStep => ({
  name: step.name,
  run: (input) =>
    Effect.mapError(step.run(input), (failure) => ({
      ...failure,
      activities: HashSet.filter(failure.activities, (record) => record.outcome === "completed"),
    })),
});

describe("Activity", () => {
  it.layer(Digest.layerWebCrypto)("attributed pipelines", (it) => {
    it.effect.prop(
      "L5-3 generated is never earlier than used and every output is attributed",
      [Arbitrary.schema(PipelineDescriptor), Arbitrary.schema(ClockScript)],
      ([pipeline, script]) =>
        Effect.gen(function* () {
          const inputs = yield* mintInputs(pipeline.inputs);
          const result = yield* runPipeline(foldPipeline({ steps: pipeline.steps }), inputs, script);
          const records = logOf(result);
          const generated = A.reduce(records, HashSet.empty<ContentHash>(), (all, record) =>
            HashSet.union(all, record.generated)
          );
          for (const record of records) {
            const verified = yield* verifyActivityRecord(record);
            expect(verified).toBe(record);
            expect(DateTime.isLessThanOrEqualTo(record.start.started, record.ended)).toBe(true);
            const others = A.filter(records, (other) => other !== record);
            const fromOthers = A.reduce(others, HashSet.empty<ContentHash>(), (all, other) =>
              HashSet.union(all, other.generated)
            );
            expect(HashSet.isSubset(HashSet.difference(record.start.used, inputs), fromOthers)).toBe(true);
          }
          expect(usedBeforeGenerated(records)).toBe(false);
          expect(A.length(records)).toBe(startedSteps(pipeline.steps));
          Result.match(result, {
            onFailure: (failure) => {
              const failed = A.filter(records, (record) => record.outcome === "failed");
              const failedStep = startedSteps(pipeline.steps) - 1;
              expect(failure.error).toEqual(StepFailure.make({ step: failedStep }));
              expect(A.map(failed, editionOf)).toEqual([stepEdition(failedStep)]);
            },
            onSuccess: (success) => {
              expect(HashSet.isSubset(success.value, generated)).toBe(true);
              expect(A.every(records, (record) => record.outcome === "completed")).toBe(true);
            },
          });
        }),
      { arbitrary: fcRuns() }
    );

    it.effect("L5-3 composing without the floor uses an entity before it was generated", () =>
      Effect.gen(function* () {
        const steps = [
          { fanOut: 1, fail: false },
          { fanOut: 1, fail: false },
        ] as const;
        const inputs = yield* mintInputs([1]);
        const floored = yield* runPipeline(foldPipeline({ steps }), inputs, descending);
        const unfloored = yield* runPipeline(foldPipeline({ steps, compose: unflooredCompose }), inputs, descending);
        expect(usedBeforeGenerated(logOf(floored))).toBe(false);
        expect(usedBeforeGenerated(logOf(unfloored))).toBe(true);
      })
    );

    it.effect("L5-3 a run that records only on success loses the failed activity", () =>
      Effect.gen(function* () {
        const steps = [
          { fanOut: 2, fail: false },
          { fanOut: 1, fail: true },
        ] as const;
        const inputs = yield* mintInputs([2]);
        const pipeline = unflooredCompose(loggedStep(0)(steps[0]), successOnly(loggedStep(1)(steps[1])));
        const result = yield* runPipeline(pipeline, inputs, [5]);
        expect(A.length(logOf(result))).not.toBe(startedSteps(steps));
      })
    );

    it.effect("a failure of the facts carries an empty log", () =>
      Effect.gen(function* () {
        const refused = withActivity<Entities, Entities, StepFailure>({
          facts: () => Effect.fail(StepFailure.make({ step: 9 })),
          generated: (output) => output,
        })({ name: stepTerm, run: Effect.succeed });
        const inputs = yield* mintInputs([3]);
        const failure = yield* Effect.flip(refused.run(inputs));
        expect(failure.error).toEqual(StepFailure.make({ step: 9 }));
        expect(HashSet.size(failure.activities)).toBe(0);
      })
    );

    it.effect("a run starts no earlier than the floor and stamps inside its activity", () =>
      Effect.gen(function* () {
        const stamping = withActivity<Entities, DateTime.Utc>({
          facts: (used) =>
            Effect.succeed(
              ActivityFacts.make({
                pin: ActivityPin.cases.Engine.make({ engine: "l5-3-pipeline", edition: "stamp" }),
                promptDigest: O.none(),
                used,
              })
            ),
          generated: () => [],
        })({
          name: stepTerm,
          run: Effect.fnUntraced(function* () {
            const activity = yield* CurrentActivity;
            return yield* activity.stamp;
          }),
        });
        const inputs = yield* mintInputs([4]);
        const logged = yield* stamping
          .run(inputs)
          .pipe(
            Effect.provideService(ActivityFloor, O.some(DateTime.makeUnsafe(7_000))),
            Effect.provideService(Clock.Clock, scriptedClock([5]))
          );
        const [record] = A.fromIterable(logged.activities);
        expect(DateTime.toEpochMillis(logged.value)).toBe(7_000);
        expect(record === undefined ? 0 : DateTime.toEpochMillis(record.start.started)).toBe(7_000);
        expect(record === undefined ? 0 : DateTime.toEpochMillis(record.ended)).toBe(7_000);
      })
    );

    it.effect("composing after an unlogged arrow keeps the current floor", () =>
      Effect.gen(function* () {
        const unlogged: LoggedStep = {
          name: stepTerm,
          run: (input) => Effect.succeed({ value: input, activities: HashSet.empty() }),
        };
        const inputs = yield* mintInputs([5]);
        const pipeline = composeLogged(loggedStep(0)({ fanOut: 1, fail: false }), stepTerm)(unlogged);
        const logged = yield* runPipeline(pipeline, inputs, [5]);
        expect(A.length(logOf(logged))).toBe(1);
      })
    );
  });

  it("describes a logged value and a logged failure by schema", () => {
    expect(S.is(Logged(S.Finite))({ value: 1, activities: HashSet.empty() })).toBe(true);
    expect(
      S.is(LoggedFailure(S.String))({ _tag: "LoggedFailure", error: "refused", activities: HashSet.empty() })
    ).toBe(true);
  });
});
