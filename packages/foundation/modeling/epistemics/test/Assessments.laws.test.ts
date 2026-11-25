import { makeAssessmentArrows, makeAssessments } from "@beep/epistemics/Assessments";
import { $EpistemicsId } from "@beep/identity/packages";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as S from "effect/Schema";
import type { Gate } from "@beep/epistemics/Assessments";

const $I = $EpistemicsId.create("test/Assessments");
const coordinates = { left: S.FiniteFromString, right: S.FiniteFromString };
const arrows = makeAssessmentArrows({ $I, coordinates });
const Assessments = makeAssessments({ $I, coordinates });
const initial = Assessments.make({ left: { _tag: "Assessed", value: 1 }, right: { _tag: "Assessed", value: 2 } });
const gate: Gate<typeof coordinates> = {
  name: "positive-coordinates",
  version: "1",
  requiredCoordinates: HashSet.fromIterable<keyof typeof coordinates>(["left", "right"]),
  order: { left: Num.Order, right: Num.Order },
  passes: (record) =>
    record.left._tag === "Assessed" &&
    record.right._tag === "Assessed" &&
    record.left.value >= 0 &&
    record.right.value >= 0,
};

it("L4-6 every declared coordinate is required at decode", () => {
  expect(S.is(Assessments)({ left: initial.left })).toBe(false);
});
it.effect("L4-6 malformed encoded values preserve the original record and invoke the gate zero times", () =>
  Effect.gen(function* () {
    let calls = 0;
    const counted = {
      ...gate,
      passes: () => {
        calls += 1;
        return true;
      },
    };
    const result = yield* arrows.updateAssessment({
      record: initial,
      coordinate: "left",
      input: "not-a-number",
      gate: counted,
    });
    expect(result._tag).toBe("Invalid");
    expect(result.record).toBe(initial);
    expect(calls).toBe(0);
  })
);
it.effect("L4-6 unknown coordinates and failed transitions are no-ops before gate side effects", () =>
  Effect.gen(function* () {
    const unknown = Assessments.make({ ...initial, right: { _tag: "Unassessed", reason: "unavailable" } });
    let calls = 0;
    const counted = {
      ...gate,
      passes: () => {
        calls += 1;
        return true;
      },
    };
    const absent = yield* arrows.updateAssessment({ record: unknown, coordinate: "left", input: "5", gate: counted });
    expect(absent._tag).toBe("Refused");
    expect(absent.record).toBe(unknown);
    expect(calls).toBe(0);
    const refused = yield* arrows.updateAssessment({ record: initial, coordinate: "left", input: "-1", gate });
    expect(refused._tag).toBe("Refused");
    expect(refused.record).toBe(initial);
  })
);
it.effect.prop(
  "L4-6 independent encoded coordinate updates commute under the actual owner gate",
  [
    S.Tuple([
      S.Int.check(S.isBetween({ minimum: 0, maximum: 100 })),
      S.Int.check(S.isBetween({ minimum: 0, maximum: 100 })),
    ]),
  ],
  ([[left, right]]) =>
    Effect.gen(function* () {
      const one = yield* arrows.updateAssessment({ record: initial, coordinate: "left", input: `${left}`, gate });
      const lr = yield* arrows.updateAssessment({ record: one.record, coordinate: "right", input: `${right}`, gate });
      const two = yield* arrows.updateAssessment({ record: initial, coordinate: "right", input: `${right}`, gate });
      const rl = yield* arrows.updateAssessment({ record: two.record, coordinate: "left", input: `${left}`, gate });
      expect(lr._tag).toBe("Updated");
      expect(rl._tag).toBe("Updated");
      expect(lr.record).toEqual(rl.record);
      expect(lr.record.left).toEqual({ _tag: "Assessed", value: left });
      expect(lr.record.right).toEqual({ _tag: "Assessed", value: right });
    })
);
it.prop(
  "L4-6 the fixture owner gate is monotone under its declared coordinate orders including ties",
  [
    S.Tuple([
      S.Int.check(S.isBetween({ minimum: -10, maximum: 10 })),
      S.Natural.check(S.isBetween({ minimum: 0, maximum: 10 })),
    ]),
  ],
  ([[value, delta]]) => {
    const lower = Assessments.make({ left: { _tag: "Assessed", value }, right: { _tag: "Assessed", value } });
    const upper = Assessments.make({
      left: { _tag: "Assessed", value: value + delta },
      right: { _tag: "Assessed", value: value + delta },
    });
    expect(gate.order.left(value, value + delta)).toBeLessThanOrEqual(0);
    expect(!gate.passes(lower) || gate.passes(upper)).toBe(true);
  }
);
