import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import { createElement } from "react";
import type { Screen } from "../../../effected/cli/ui.ts";
import { CliUi, Confirm, MultiSelect, Select, Tabs, TextInput, Toggle } from "../../../effected/cli/ui.ts";
import { Fmt } from "../../../effected/cli/index.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

const long = "X".repeat(100);
const cases: ReadonlyArray<readonly [string, Screen<unknown>, number, boolean]> = [
	["input value and title", TextInput.screen({ message: long, initial: long }), 3, false],
	["input placeholder", TextInput.screen({ message: long, placeholder: long }), 3, false],
	["input validation message", TextInput.screen({ message: long, initial: long, validate: () => long }), 4, true],
	["highlighted toggle", () => createElement(Toggle.View, { label: long, value: true, highlighted: true }), 1, false],
	["plain toggle", () => createElement(Toggle.View, { label: long, value: false, highlighted: false }), 1, false],
	["column tabs", () => createElement(Tabs.View, { direction: "column", tabs: [{ name: "a", label: long }, { name: "b", label: long }] }), 2, false],
	["confirm question, answer, toggle and help", Confirm.screen({ message: long, toggles: [{ key: "a", label: long, value: true }] }), 4, false],
	["select question, choices, detail and help", Select.screen({ message: long, choices: [{ label: long, value: 1, detail: long }, { label: long, value: 2 }] }), 5, false],
	["multi-select question, header, item, detail and help", MultiSelect.screen({ message: long, sections: [{ title: long, items: [{ key: "a", label: long, value: 1, detail: long }] }] }), 5, false],
];

/** Resize an 80-column session to each width in turn, asserting the row budget and cursor column of every repaint. */
const resizes = Effect.fn("resizes")(
	function* (screen: Screen<unknown>, height: number, invalid: boolean, widths: ReadonlyArray<number>) {
		const session = yield* CliUiTest.session({ columns: 80, rows: 24, color: "none", renderPath: "production" });
		const context = yield* Layer.build(session.layer);
		const fiber = yield* Effect.forkChild(CliUi.run(screen).pipe(Effect.provideContext(context)));
		const handle = yield* session.next({ contains: "XXX" });
		if (invalid) yield* handle.press("enter");
		for (const columns of widths) {
			const before = (yield* handle.frames).length;
			yield* handle.resize(columns, 24);
			const repaints = (yield* handle.frames).slice(before);
			assert.isNotEmpty(repaints, "every resize captures its repaints");
			for (const frame of repaints) {
				const lines = frame.split("\n");
				assert.lengthOf(lines, height, "every intermediate repaint retains its row budget");
				for (const line of lines) assert.isAtMost(Fmt.width(line), columns - 1, "layout reserves the cursor column");
			}
		}
		yield* Fiber.interrupt(fiber);
	},
);

describe("single-row widgets clip during Ink's immediate resize repaint", () => {
	for (const [name, screen, height, invalid] of cases) {
		it.effect(name, () => resizes(screen, height, invalid, [20, 10, 40, 15]));
	}
});

describe("single-row widgets clip on a direct shrink from 80 columns", () => {
	for (const [name, screen, height, invalid] of cases) {
		for (const columns of [20, 10]) {
			it.effect(`${name}: 80 to ${columns}`, () => resizes(screen, height, invalid, [columns]));
		}
	}
});
