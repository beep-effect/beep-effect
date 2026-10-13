import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { MultiSelect, MultiSelectAction } from "../../../effected/cli/ui/MultiSelect.ts";

it.effect.prop("arbitrary submitted selections retain their item order and reject every later action", [S.Boolean.pipe(S.Array, Arbitrary.schema)], ([flags]) =>
	Effect.sync(() => {
		const state = MultiSelect.init([{ title: "Items", items: A.map(flags, (selected, index) => ({
			key: `${index}`, label: `${index}`, value: index, selected,
		})) }]);
		const expected = A.filter(A.makeBy(flags.length, (index) => index), (index) => flags[index] === true);
		const submitted = MultiSelect.step(state, "submit");
		assert.deepStrictEqual(MultiSelect.selected(submitted), expected);
		for (const action of MultiSelectAction.literals) {
			const after = MultiSelect.step(submitted, action);
			assert.strictEqual(after, submitted);
			assert.deepStrictEqual(MultiSelect.selected(after), expected);
		}
	}), { arbitrary: fcRuns(100) });
