import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, Option } from "effect";
import { createElement } from "react";
import { Cancelled, Fmt } from "../../../effected/cli/index.ts";
import type { ConfirmResult, ConfirmToggle } from "../../../effected/cli/ui.ts";
import { Confirm, Toggle } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

const promote = (drafts: number): ReadonlyArray<ConfirmToggle<"promote">> =>
	drafts > 0 ? [{ key: "promote", label: `promote ${drafts} drafts to stable`, value: true }] : [];

describe("Confirm reducer", () => {
	it("y and n set the answer, and left or right flip it", () => {
		const start = Confirm.init({ initial: false });
		assert.isTrue(Confirm.step(start, "yes").confirmed);
		assert.isFalse(Confirm.step(Confirm.step(start, "yes"), "no").confirmed);
		assert.isTrue(Confirm.step(start, "flip").confirmed);
		assert.isFalse(Confirm.step(Confirm.step(start, "flip"), "flip").confirmed);
		assert.deepStrictEqual(Confirm.keys.match({ _tag: "Named", name: "left" }), Option.some("flip"));
		assert.deepStrictEqual(Confirm.keys.match({ _tag: "Named", name: "right" }), Option.some("flip"));
		assert.deepStrictEqual(Confirm.keys.match({ _tag: "Char", char: "y" }), Option.some("yes"));
		assert.deepStrictEqual(Confirm.keys.match({ _tag: "Char", char: "n" }), Option.some("no"));
		assert.deepStrictEqual(Confirm.keys.match({ _tag: "Char", char: "q" }), Option.some("cancel"));
	});

	it("space toggles only a toggle row: on the yes/no row it changes nothing", () => {
		const start = Confirm.init({ initial: true, toggles: promote(3) });
		const onAnswer = Confirm.step(start, "toggle");
		assert.deepStrictEqual(Confirm.result(onAnswer), { confirmed: true, toggles: { promote: true } });
		const onToggle = Confirm.step(Confirm.step(start, "down"), "toggle");
		assert.deepStrictEqual(Confirm.result(onToggle), { confirmed: true, toggles: { promote: false } });
	});

	it("up and down move over the rows, clamped", () => {
		const two = Confirm.init({
			toggles: [
				{ key: "a", label: "a", value: false },
				{ key: "b", label: "b", value: false },
			],
		});
		assert.strictEqual(Confirm.step(two, "up").row, 0);
		assert.strictEqual(Confirm.step(Confirm.step(Confirm.step(two, "down"), "down"), "down").row, 2);
		assert.strictEqual(Confirm.step(Confirm.init({}), "down").row, 0, "no toggle rows to move to");
	});

	it("submit marks it submitted, and the result carries the answer and every toggle by key", () => {
		const state = Confirm.step(Confirm.step(Confirm.init({ initial: false, toggles: promote(2) }), "yes"), "submit");
		assert.isTrue(state.submitted);
		assert.deepStrictEqual(Confirm.result(state), { confirmed: true, toggles: { promote: true } });
		assert.deepStrictEqual(Confirm.result(Confirm.init({})), { confirmed: false, toggles: {} });
	});

	it("toggle keys must be unique", () => {
		assert.throws(
			() =>
				Confirm.init({
					toggles: [
						{ key: "x", label: "one", value: true },
						{ key: "x", label: "two", value: false },
					],
				}),
			/unique.*x/,
		);
	});
});

describe("Confirm.screen under CliUiTest", () => {
	it.effect("okfit's promote toggle is on by default; down, space, enter turns it off", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(
				Confirm.screen({ message: "Publish the release?", initial: true, toggles: promote(3) }),
			);
			assert.include(yield* handle.plainFrame, "◉ promote 3 drafts to stable");
			yield* handle.press("down", "space");
			assert.include(yield* handle.plainFrame, "◯ promote 3 drafts to stable");
			yield* handle.press("enter");
			const result = yield* handle.result;
			assert.isFalse(result.toggles.promote);
			assert.isTrue(result.confirmed);
		}).pipe(Effect.scoped),
	);

	it.effect("with no toggles it shows only the question, the answer and the help", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(Confirm.screen({ message: "Publish the release?", toggles: promote(0) }));
			const lines = (yield* handle.plainFrame).trimEnd().split("\n");
			assert.lengthOf(lines, 3, lines.join(" / "));
			assert.strictEqual(lines[0], "Publish the release?");
			assert.notInclude(lines.join("\n"), "◉");
			assert.notInclude(lines.join("\n"), "◯");
			yield* handle.type("y");
			yield* handle.press("enter");
			const result = yield* handle.result;
			assert.isTrue(result.confirmed);
			// okfit's shape infers K = "promote" even with no drafts: the key is then absent, and the type says so.
			assert.strictEqual(result.toggles.promote, undefined);
			assert.isFalse(result.toggles.promote ?? false, "okfit reads it with ?? false");
		}).pipe(Effect.scoped),
	);

	it.effect("the chosen answer is marked without colour, and moves with y, n and the arrows", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(Confirm.screen({ message: "Go?", initial: false }), { color: "none" });
			const answer = (frame: string): string => frame.split("\n")[1] ?? "";
			assert.include(answer(yield* handle.plainFrame), "[No]");
			yield* handle.press("right");
			assert.include(answer(yield* handle.plainFrame), "[Yes]");
			yield* handle.type("n");
			assert.include(answer(yield* handle.plainFrame), "[No]");
		}).pipe(Effect.scoped),
	);

	it.effect("q cancels with escape", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(Confirm.screen({ message: "Go?", toggles: promote(1) }));
			yield* handle.type("q");
			const error = yield* Effect.flip(handle.result);
			assert.strictEqual(error instanceof Cancelled ? error.reason : undefined, "escape");
		}).pipe(Effect.scoped),
	);

	it.effect("the help line fits 80 columns and names y, n, space, enter and esc", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(Confirm.screen({ message: "Go?", toggles: promote(1) }));
			const help = (yield* handle.plainFrame).trimEnd().split("\n").at(-1) ?? "";
			assert.notInclude(help, "…", help);
			for (const part of ["y yes", "n no", "space toggle", "enter submit", "q/esc cancel"])
				assert.include(help, part, help);
		}).pipe(Effect.scoped),
	);

	it.effect("with no toggles the help names no row or toggle keys", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(Confirm.screen({ message: "Go?", toggles: promote(0) }));
			const help = (yield* handle.plainFrame).trimEnd().split("\n").at(-1) ?? "";
			assert.notInclude(help, "row", help);
			assert.notInclude(help, "toggle", help);
			for (const part of ["y yes", "n no", "←/→ flip", "enter submit", "q/esc cancel"])
				assert.include(help, part, help);
		}).pipe(Effect.scoped),
	);

	it.effect("twenty toggles on a 10-row terminal scroll in a window that never fills the terminal", () =>
		Effect.gen(function* () {
			const many = Array.from({ length: 20 }, (_, index) => ({
				key: `t${index}`,
				label: `toggle ${index}`,
				value: false,
			}));
			const handle = yield* CliUiTest.render(Confirm.screen({ message: "Go?", toggles: many }), {
				rows: 10,
				color: "none",
			});
			const lines = (frame: string) => frame.trimEnd().split("\n");
			const first = lines(yield* handle.plainFrame);
			assert.isAtMost(first.length, 9, first.join(" / "));
			assert.include(first.join("\n"), "Go?");
			assert.include(first.at(-1) ?? "", "enter submit", "the help line stays on screen");
			for (let press = 0; press < 15; press++) yield* handle.press("down");
			const scrolled = lines(yield* handle.plainFrame);
			assert.isAtMost(scrolled.length, 9, scrolled.join(" / "));
			assert.include(scrolled.join("\n"), "→ ◯ toggle 14", "the highlighted toggle is in view");
			assert.include(scrolled[0] ?? "", "Go?", "the question stays on top");
			yield* handle.press("space", "enter");
			const result = yield* handle.result;
			assert.strictEqual(Object.keys(result.toggles).length, 20);
			assert.isTrue(result.toggles.t14);
			assert.isFalse(result.toggles.t13);
		}).pipe(Effect.scoped),
	);

	it.effect("toggle rows: ASCII check glyphs, accent when highlighted, and labels cut to the width", () =>
		Effect.gen(function* () {
			const ascii = yield* Effect.scoped(
				Effect.flatMap(
					CliUiTest.render(Confirm.screen({ message: "Go?", toggles: promote(3) }), { glyphs: "ascii" }),
					(handle) => handle.plainFrame,
				),
			);
			assert.include(ascii, "[x] promote 3 drafts to stable");
			const highlighted = yield* Effect.scoped(
				Effect.gen(function* () {
					const handle = yield* CliUiTest.render(Confirm.screen({ message: "Go?", toggles: promote(3) }));
					yield* handle.press("down");
					return yield* handle.frame;
				}),
			);
			assert.include(highlighted, "[accent]→ ◉ promote 3 drafts to stable[/accent]");
			const narrow = yield* Effect.scoped(
				Effect.flatMap(
					CliUiTest.render(Confirm.screen({ message: "Go?", toggles: promote(3) }), { columns: 20, color: "none" }),
					(handle) => handle.plainFrame,
				),
			);
			const row = narrow.split("\n").find((line) => line.includes("promote")) ?? "";
			assert.include(row, "…");
			assert.isAtMost(Fmt.width(row), 19, row);
		}),
	);

	it.effect("a screen with a repeated toggle key dies with the reason", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(
				Confirm.screen({
					message: "Go?",
					toggles: [
						{ key: "k", label: "one", value: true },
						{ key: "k", label: "two", value: true },
					],
				}),
			);
			const exit = yield* Effect.exit(handle.result);
			if (Exit.isFailure(exit)) {
				const defect = Cause.squash(exit.cause);
				assert.include(defect instanceof Error ? defect.message : "", "unique");
			} else {
				assert.fail("expected a defect, but the confirm resolved");
			}
		}).pipe(Effect.scoped),
	);
});

/** True only when `A` and `B` are the same type. */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

describe("ConfirmResult typing", () => {
	it("types a toggle as boolean | undefined, because a conditional toggle may be absent", () => {
		type Promote = ConfirmResult<"promote">["toggles"]["promote"];
		const honest: Equals<Promote, boolean | undefined> = true;
		assert.isTrue(honest);
	});
});

describe("Toggle.View", () => {
	it.effect("draws the check glyph and the label, highlighted in accent with the arrow", () =>
		Effect.gen(function* () {
			const off = yield* Effect.scoped(
				Effect.flatMap(
					CliUiTest.render(() => createElement(Toggle.View, { label: "dry run", value: false, highlighted: false })),
					(handle) => handle.frame,
				),
			);
			assert.strictEqual(off.trim(), "◯ dry run");
			const on = yield* Effect.scoped(
				Effect.flatMap(
					CliUiTest.render(() => createElement(Toggle.View, { label: "dry run", value: true, highlighted: true })),
					(handle) => handle.frame,
				),
			);
			assert.strictEqual(on.trim(), "[accent]→ ◉ dry run[/accent]");
		}),
	);
});
