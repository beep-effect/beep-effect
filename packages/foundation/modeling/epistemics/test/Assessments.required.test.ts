import { makeAssessmentArrows } from "@beep/epistemics/Assessments";
import { $EpistemicsId } from "@beep/identity/packages";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as S from "effect/Schema";
import type { Gate } from "@beep/epistemics/Assessments";
import type * as R from "effect/Record";

const $I = $EpistemicsId.create("test/AssessmentsRequired");
const coordinates: R.ReadonlyRecord<string, typeof S.Int> = { score: S.Int };
const arrows = makeAssessmentArrows({ $I, coordinates });
const initial = arrows.Assessments.make({ score: { _tag: "Assessed", value: 0 } });
const gateRequiring = (required: ReadonlyArray<string>): Gate<typeof coordinates> => ({
  name: "score-gate",
  version: "1",
  requiredCoordinates: HashSet.fromIterable(required),
  order: { score: Num.Order },
  passes: () => true,
});

it.effect("L4-6 a gate requiring an undeclared coordinate refuses even when its predicate accepts", () =>
  Effect.gen(function* () {
    const refused = yield* arrows.updateAssessment({
      record: initial,
      coordinate: "score",
      input: 1,
      gate: gateRequiring(["score", "missing"]),
    });
    expect(refused._tag).toBe("Refused");
    expect(refused.record).toBe(initial);
    const updated = yield* arrows.updateAssessment({
      record: initial,
      coordinate: "score",
      input: 1,
      gate: gateRequiring(["score"]),
    });
    expect(updated._tag).toBe("Updated");
  })
);
