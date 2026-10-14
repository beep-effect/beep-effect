import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Confirm, ConfirmAction, ConfirmState, ConfirmToggle } from "../../../effected/cli/ui/Confirm.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({ initial: S.Boolean, values: S.Array(S.Boolean) });

it.effect.prop("confirm and toggle involutions preserve the complete answer", [Arbitrary.schema(Sample)], ([sample]) =>
  Effect.sync(() => {
    const initial = Confirm.init({ initial: sample.initial, toggles: A.map(sample.values, (value, index) => ({
      key: `${index}`, label: `toggle ${index}`, value,
    })) });
    assert.deepStrictEqual(Confirm.result(Confirm.step(Confirm.step(initial, "flip"), "flip")), Confirm.result(initial));
    let selected = initial;
    for (let index = 0; index < sample.values.length; index++) {
      selected = Confirm.step(selected, "down");
      const toggled = Confirm.step(selected, "toggle");
      assert.deepStrictEqual(Confirm.result(Confirm.step(toggled, "toggle")), Confirm.result(selected));
      assert.strictEqual(toggled.toggles[index]?.value, sample.values[index] === false);
      assert.strictEqual(toggled.confirmed, sample.initial);
    }
    assert.deepStrictEqual(Confirm.result(Confirm.step(selected, "submit")), Confirm.result(initial));
    assert.strictEqual(Confirm.step(selected, "down").row, sample.values.length);
  }), runs);

it.effect.prop("every reachable confirm state satisfies the production state schema", [Arbitrary.schema(Sample), ConfirmAction.pipe(S.Array, Arbitrary.schema)], ([sample, actions]) =>
  Effect.sync(() => {
    const isState = S.is(ConfirmState(S.String));
    let state = Confirm.init({ initial: sample.initial, toggles: A.map(sample.values, (value, index) => ({
      key: `${index}`, label: `toggle ${index}`, value,
    })) });
    assert.isTrue(isState(state));
    for (const toggle of state.toggles) assert.isTrue(S.is(ConfirmToggle(S.String))(toggle));
    for (const action of actions) {
      state = Confirm.step(state, action);
      assert.isTrue(isState(state));
    }
    assert.isFalse(isState({ confirmed: true, row: 0, toggles: [{ key: 1, label: "x", value: true }], submitted: false }));
  }), runs);
