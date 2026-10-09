import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, Option, Schema } from "effect";
import { Cancelled, Fmt } from "../../../effected/cli/index.ts";
import type { SelectChoice } from "../../../effected/cli/ui.ts";
import { Select } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

const choices: ReadonlyArray<SelectChoice<string>> = [
	{ label: "alpha", value: "a", detail: "the first" },
	{ label: "beta", value: "b", disabled: true },
	{ label: "gamma", value: "c", detail: "the third" },
	{ label: "delta", value: "d" },
];

describe("Select reducer", () => {
	it("starts on the first enabled choice, or the initial one when it is enabled", () => {
		assert.strictEqual(Select.init(choices).viewport.cursor, 0);
		assert.strictEqual(Select.init(choices, { initial: 2 }).viewport.cursor, 2);
		assert.strictEqual(Select.init(choices, { initial: 1 }).viewport.cursor, 2, "a disabled initial moves on");
		assert.strictEqual(Select.init([{ label: "x", value: "x", disabled: true }, ...choices]).viewport.cursor, 1);
	});

	it("moves skip disabled choices, and stop at the ends", () => {
		const start = Select.init(choices);
		const down = Select.step(start, "down");
		assert.strictEqual(down.viewport.cursor, 2, "beta is skipped");
		assert.strictEqual(Select.step(down, "up").viewport.cursor, 0, "and skipped going back");
		assert.strictEqual(Select.step(start, "up").viewport.cursor, 0, "no wrap at the top");
		const end = Select.step(start, "end");
		assert.strictEqual(end.viewport.cursor, 3);
		assert.strictEqual(Select.step(end, "down").viewport.cursor, 3, "no wrap at the bottom");
		assert.strictEqual(Select.step(end, "home").viewport.cursor, 0);
	});

	it("submit marks the highlighted value chosen", () => {
		const state = Select.step(Select.step(Select.init(choices), "down"), "submit");
		assert.deepStrictEqual(Select.chosen(state), Option.some("c"));
		assert.isTrue(Option.isNone(Select.chosen(Select.init(choices))), "nothing is chosen before submit");
	});

	it("needs at least one enabled choice: none, or only disabled ones, is a programming error", () => {
		assert.throws(() => Select.init([]), /at least one enabled choice/);
		assert.throws(() => Select.init([{ label: "x", value: 1, disabled: true }]), /at least one enabled choice/);
	});

	it("binds q to cancel, enter to submit, and the viewport's moves", () => {
		assert.deepStrictEqual(Select.keys.match({ _tag: "Char", char: "q" }), Option.some("cancel"));
		assert.deepStrictEqual(Select.keys.match({ _tag: "Named", name: "enter" }), Option.some("submit"));
		assert.deepStrictEqual(Select.keys.match({ _tag: "Named", name: "pagedown" }), Option.some("pagedown"));
	});
});

describe("Select.screen under CliUiTest", () => {
	it.effect("down, down, enter returns the value two enabled choices down", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(Select.screen({ message: "Pick one", choices }));
			yield* handle.press("down", "down", "enter");
			assert.strictEqual(yield* handle.result, "d");
		}).pipe(Effect.scoped),
	);

	it.effect("draws the message, the highlighted row in accent with the arrow, and its detail muted below", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(Select.screen({ message: "Pick one", choices }));
			const frame = yield* handle.frame;
			assert.include(frame, "Pick one");
			assert.include(frame, "[accent]→ alpha[/accent]");
			assert.include(frame, "[muted]the first[/muted]");
			assert.include(frame, "[muted]  beta[/muted]", "a disabled choice is muted");
			yield* handle.press("down");
			assert.include(yield* handle.frame, "[accent]→ gamma[/accent]");
			assert.include(yield* handle.frame, "[muted]the third[/muted]");
		}).pipe(Effect.scoped),
	);

	it.effect("a screen with no enabled choice dies with the reason", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(
				Select.screen({ message: "Pick", choices: [{ label: "x", value: 1, disabled: true }] }),
			);
			const exit = yield* Effect.exit(handle.result);
			if (Exit.isFailure(exit)) {
				const defect = Cause.squash(exit.cause);
				assert.include(defect instanceof Error ? defect.message : "", "at least one enabled choice");
			} else {
				assert.fail("expected a defect, but the select resolved");
			}
		}).pipe(Effect.scoped),
	);

	it.effect("the help line merges q and the root's esc into one pinned q/esc cancel", () =>
		Effect.gen(function* () {
			const wide = yield* Effect.scoped(
				Effect.flatMap(
					CliUiTest.render(Select.screen({ message: "Pick one", choices })),
					(handle) => handle.plainFrame,
				),
			);
			const help = wide.trimEnd().split("\n").at(-1) ?? "";
			assert.isTrue(help.endsWith("q/esc cancel"), help);
			assert.notInclude(help, "q cancel ·");
			const narrow = yield* Effect.scoped(
				Effect.flatMap(
					CliUiTest.render(Select.screen({ message: "Pick one", choices }), { columns: 30 }),
					(handle) => handle.plainFrame,
				),
			);
			const cut = narrow.trimEnd().split("\n").at(-1) ?? "";
			assert.isTrue(cut.endsWith(" · q/esc cancel"), `still pinned when cut: ${cut}`);
			assert.include(cut, "…");
		}).pipe(Effect.scoped),
	);

	it.effect("the help line fits 80 columns: page, home and end are bound but not listed", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(Select.screen({ message: "Pick one", choices }));
			const help = (yield* handle.plainFrame).trimEnd().split("\n").at(-1) ?? "";
			assert.notInclude(help, "…", help);
			assert.include(help, "enter choose");
			assert.isTrue(help.endsWith("q/esc cancel"), help);
			assert.notInclude(help, "pgup");
			assert.deepStrictEqual(Select.keys.match({ _tag: "Named", name: "end" }), Option.some("end"), "still bound");
		}).pipe(Effect.scoped),
	);

	it.effect("q cancels with escape", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(Select.screen({ message: "Pick one", choices }));
			yield* handle.type("q");
			const error = yield* Effect.flip(handle.result);
			assert.instanceOf(error, Cancelled);
			assert.strictEqual(Schema.is(Cancelled)(error) ? error.reason : undefined, "escape");
		}).pipe(Effect.scoped),
	);

	it.effect("on an 8-column terminal rows are cut with the ellipsis to 7 cells", () =>
		Effect.gen(function* () {
			const long: ReadonlyArray<SelectChoice<number>> = [
				{ label: "a very long choice", value: 1 },
				{ label: "another long one", value: 2 },
			];
			const handle = yield* CliUiTest.render(Select.screen({ message: "Pick", choices: long }), {
				columns: 8,
				color: "none",
			});
			const lines = (yield* handle.plainFrame).split("\n");
			assert.isTrue(
				lines.some((line) => line.includes("…") && line.includes("a ve")),
				lines.join(" / "),
			);
			for (const line of lines) assert.isAtMost(Fmt.width(line), 7, line);
		}).pipe(Effect.scoped),
	);
});

describe("Select: a disabled choice is marked without colour", () => {
	it.effect("at colour none a disabled row ends with (disabled), which survives a narrow terminal", () =>
		Effect.gen(function* () {
			const lines = (yield* Effect.scoped(
				Effect.flatMap(
					CliUiTest.render(Select.screen({ message: "Pick one", choices }), { color: "none" }),
					(plain) => plain.rawFrame,
				),
			)).split("\n");
			assert.isTrue(
				lines.some((line) => line.trimEnd().endsWith("beta (disabled)")),
				"the disabled row is marked",
			);
			assert.isFalse(
				lines.some((line) => /alpha|gamma|delta/.test(line) && line.includes("(disabled)")),
				"enabled rows are not",
			);
			// Its own scope: screens mount one at a time, so a second render waits for the first to be released.
			const narrowFrame = yield* Effect.scoped(
				Effect.flatMap(
					CliUiTest.render(
						Select.screen({
							message: "Pick",
							choices: [
								{ label: "a", value: 1 },
								{ label: "a very long disabled choice label", value: 2, disabled: true },
							],
						}),
						{ color: "none", columns: 24 },
					),
					(narrow) => narrow.rawFrame,
				),
			);
			assert.isTrue(
				narrowFrame.split("\n").some((line) => line.trimEnd().endsWith("(disabled)")),
				"the marker is kept and the label cut instead",
			);
		}).pipe(Effect.scoped),
	);

	it.effect("with colour the muted token marks it, so the row carries no text marker", () =>
		Effect.gen(function* () {
			const coloured = yield* CliUiTest.render(Select.screen({ message: "Pick one", choices }), {
				color: "truecolor",
			});
			assert.notInclude(yield* coloured.frame, "(disabled)");
		}).pipe(Effect.scoped),
	);
});
