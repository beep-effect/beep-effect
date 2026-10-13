import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Select, SelectAction } from "../../../effected/cli/ui/Select.ts";

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
