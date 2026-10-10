import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import type { ReactElement } from "react";
import { createElement } from "react";
import { Fmt } from "../../../effected/cli/index.ts";
import type { Screen } from "../../../effected/cli/ui.ts";
import { Confirm, KeyHelp, KeyTable, MultiSelect, Select, Tabs, TextInput } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
const OSC8 = `${ESC}]8`;

/** Text from data a widget draws: a colour, a hyperlink whose target differs from its label, and a second line. */
const HOSTILE = `x${ESC}[31mRED${ESC}[0m ${OSC8};;https://evil.example${BEL}link${OSC8};;${BEL}\nSECOND`;

const showing =
	(element: ReactElement): Screen<never> =>
	() =>
		element;

const screens: ReadonlyArray<readonly [string, Screen<unknown>]> = [
	[
		"Select: message, label and detail",
		Select.screen({
			message: HOSTILE,
			choices: [
				{ label: HOSTILE, value: 1, detail: HOSTILE },
				{ label: "plain", value: 2 },
			],
		}),
	],
	[
		"MultiSelect: message, section title, label and detail",
		MultiSelect.screen({
			message: HOSTILE,
			sections: [{ title: HOSTILE, items: [{ key: "a", label: HOSTILE, value: 1, detail: HOSTILE }] }],
		}),
	],
	[
		"Confirm: message and toggle label",
		Confirm.screen({ message: HOSTILE, toggles: [{ key: "t", label: HOSTILE, value: false }] }),
	],
	["TextInput: message and placeholder", TextInput.screen({ message: HOSTILE, placeholder: HOSTILE })],
	[
		"Tabs: labels and separator",
		showing(
			createElement(Tabs.View<"a" | "b">, {
				tabs: [
					{ name: "a", label: HOSTILE },
					{ name: "b", label: "plain" },
				],
				separator: ` ${ESC}[31m|${ESC}[0m `,
			}),
		),
	],
	[
		"KeyHelp: a binding's help",
		showing(
			createElement(KeyHelp, { tables: [KeyTable.make([{ keys: [{ char: "z" }], action: "z", help: HOSTILE }])] }),
		),
	],
];

/** No line of the frame starts with the text after the newline: the second line was folded onto the first. */
const assertFolded = (frame: string): void => {
	for (const line of frame.split("\n"))
		assert.notMatch(line, /^\s*SECOND/, `a second line was drawn: ${JSON.stringify(line)}`);
	assert.include(frame, "SECOND", "the folded text is still shown");
};

describe("widget text from data is sanitised and drawn on one line", () => {
	it.effect("TextInput: a hostile initial value is folded for display and submitted unchanged", () =>
		Effect.gen(function* () {
			const validated: Array<string> = [];
			const handle = yield* CliUiTest.render(
				TextInput.screen({
					message: "Name",
					initial: HOSTILE,
					validate: (value) => {
						validated.push(value);
						return undefined;
					},
				}),
				{ color: "none", columns: 120 },
			);
			const frame = yield* handle.rawFrame;
			assert.notInclude(frame, ESC);
			assert.include(frame, "xRED link SECOND▏");
			assertFolded(frame);
			assert.lengthOf(frame.split("\n"), 3, "the input occupies one physical row");
			yield* handle.press("enter");
			assert.strictEqual(yield* handle.result, HOSTILE);
			assert.deepStrictEqual(validated, [HOSTILE]);
		}),
	);

	it.effect("TextInput: hostile value segments are sanitised before scrolling around the original cursor", () =>
		Effect.gen(function* () {
			const initial = `ab${ESC}[31mRED${ESC}[0m\r\nSECOND`;
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name", initial }), {
				color: "none",
				columns: 10,
			});
			assert.include(yield* handle.rawFrame, "… SECOND▏");
			yield* handle.press("home");
			assert.include(yield* handle.rawFrame, "▏abRED S…");
			yield* handle.type("x");
			yield* handle.press("end", "left");
			assert.include(yield* handle.rawFrame, "SECON▏D");
			for (const frame of yield* handle.frames) {
				assert.notInclude(frame, ESC);
				assert.lengthOf(frame.split("\n"), 3);
				for (const line of frame.split("\n")) assert.isAtMost(Fmt.width(line), 9);
			}
			yield* handle.press("enter");
			assert.strictEqual(yield* handle.result, `x${initial}`);
		}),
	);

	for (const [name, screen] of screens) {
		it.effect(`${name}: no escape at colour none, no OSC 8 at truecolor, newlines folded`, () =>
			Effect.gen(function* () {
				const none = yield* CliUiTest.render(screen, { color: "none", columns: 120 });
				const plain = yield* none.rawFrame;
				assert.notInclude(plain, ESC, "no escape byte at colour none");
				assertFolded(plain);
				const coloured = yield* CliUiTest.render(screen, { color: "truecolor", columns: 120 });
				assert.notInclude(yield* coloured.rawFrame, OSC8, "no hyperlink planted by data at any level");
			}),
		);
	}

	it.effect("TextInput: a validator's message is sanitised and folded", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name", validate: () => HOSTILE }), {
				color: "none",
				columns: 120,
			});
			yield* handle.press("enter");
			const frame = yield* handle.rawFrame;
			assert.include(frame, "xRED", "the validation message is shown");
			assert.notInclude(frame, ESC);
			assertFolded(frame);
		}),
	);
});
