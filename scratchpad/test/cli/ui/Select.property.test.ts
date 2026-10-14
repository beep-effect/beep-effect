import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Select, SelectAction, SelectChoice, SelectState } from "../../../effected/cli/ui/Select.ts";

const Sample = S.Struct({ initial: S.Finite, disabled: S.Array(S.Boolean) });

it.effect.prop("any initial index selects an enabled existing choice and submission is terminal", [Arbitrary.schema(Sample)], ([sample]) =>
	Effect.sync(() => {
		const choices = [
			{ label: "disabled first", value: -1, disabled: true },
			...A.map(sample.disabled, (disabled, index) => ({ label: `${index}`, value: index, disabled })),
			{ label: "enabled last", value: sample.disabled.length, disabled: false },
		];
		const state = Select.init(choices, { initial: sample.initial });
		const choice = choices[state.viewport.cursor];
		assert.isDefined(choice);
		assert.strictEqual(choice?.disabled, false);
		const submitted = Select.step(state, "submit");
		assert.isTrue(submitted.submitted);
		assertSome(Select.chosen(submitted), choice?.value);
		for (const action of SelectAction.literals) assert.strictEqual(Select.step(submitted, action), submitted);
	}), { arbitrary: fcRuns(100) });

it.effect.prop("every reachable select state satisfies the production state schema", [Arbitrary.schema(Sample), SelectAction.pipe(S.Array, Arbitrary.schema)], ([sample, actions]) =>
	Effect.sync(() => {
		const isState = S.is(SelectState(S.Finite));
		const choices = [
			...A.map(sample.disabled, (disabled, index) => ({ label: `${index}`, value: index, disabled, detail: `detail ${index}` })),
			{ label: "enabled last", value: sample.disabled.length },
		];
		for (const choice of choices) assert.isTrue(S.is(SelectChoice(S.Finite))(choice));
		let state = Select.init(choices, { initial: sample.initial });
		assert.isTrue(isState(state));
		for (const action of actions) {
			state = Select.step(state, action);
			assert.isTrue(isState(state));
		}
		assert.isFalse(isState({ ...state, choices: [{ label: "x", value: "not a number" }] }));
	}), { arbitrary: fcRuns(100) });
