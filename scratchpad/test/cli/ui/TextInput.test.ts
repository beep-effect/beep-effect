import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Cancelled, Fmt } from "../../../effected/cli/index.ts";
import type { UiKey } from "../../../effected/cli/ui.ts";
import { TextInput } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

const char = (c: string): UiKey => ({ _tag: "Char", char: c });
const named = (name: "left" | "right" | "home" | "end" | "backspace" | "delete" | "space" | "enter"): UiKey => ({
	_tag: "Named",
	name,
});
const run = (keys: ReadonlyArray<UiKey>, initial?: string) =>
	keys.reduce((state, key) => TextInput.step(state, key), TextInput.init(initial === undefined ? {} : { initial }));

describe("TextInput reducer", () => {
	it("inserts characters at the cursor, q included", () => {
		const state = run([char("q"), char("u"), char("i"), char("t")]);
		assert.strictEqual(state.value, "quit");
		assert.strictEqual(state.cursor, 4);
	});

	it("starts at the end of the initial value", () => {
		assert.deepStrictEqual(TextInput.init({ initial: "abc" }), { value: "abc", cursor: 3, submitted: false });
	});

	it("moves the cursor and edits at it", () => {
		assert.strictEqual(run([named("left"), char("X")], "abc").value, "abXc");
		assert.strictEqual(run([named("home"), char("X")], "abc").value, "Xabc");
		assert.strictEqual(run([named("home"), named("end"), char("X")], "abc").value, "abcX");
		assert.strictEqual(run([named("left"), named("backspace")], "abc").value, "ac");
		assert.strictEqual(run([named("left"), named("left"), named("delete")], "abc").value, "ac");
		assert.strictEqual(run([named("space")], "a").value, "a ");
		assert.strictEqual(run([named("home"), named("left"), named("backspace")], "ab").value, "ab", "clamped");
		assert.strictEqual(run([named("right"), named("delete")], "ab").value, "ab", "clamped");
	});

	it("enter marks it submitted", () => {
		assert.isTrue(run([char("x"), named("enter")]).submitted);
	});

	it("an astral character is never split", () => {
		assert.strictEqual(run([char("😀"), named("backspace")]).value, "", "backspace removes the whole pair");
		assert.strictEqual(run([named("left"), char("x")], "😀").value, "x😀", "left steps over the whole pair");
		assert.strictEqual(run([named("home"), named("delete")], "😀b").value, "b", "delete removes the whole pair");
		assert.strictEqual(run([named("home"), named("right"), char("x")], "😀b").value, "😀xb");
	});

	it("moves and deletes by grapheme: a combining accent, a flag and a ZWJ family are each one step", () => {
		const accented = "ae\u0301";
		assert.strictEqual(run([named("left")], accented).cursor, 1, "left from the end crosses e + accent whole");
		assert.strictEqual(run([named("backspace")], accented).value, "a", "backspace removes the accented e whole");
		assert.strictEqual(run([named("home"), named("right")], accented).cursor, 1);
		assert.strictEqual(run([named("home"), named("right"), named("right")], accented).cursor, 3);
		assert.strictEqual(run([named("home"), named("right"), named("delete")], accented).value, "a");
		assert.strictEqual(run([named("backspace")], "x🇺🇸").value, "x", "a flag is two code points, one grapheme");
		const family = "👨\u200d👩\u200d👧";
		assert.strictEqual(run([named("left"), char("x")], family).value, `x${family}`);
		assert.strictEqual(run([named("home"), named("delete")], `${family}b`).value, "b");
	});

	it("control: plain text still moves one character at a time", () => {
		assert.strictEqual(run([named("left"), named("left")], "abc").cursor, 1);
	});

	it.prop(
		"any edit sequence over astral text leaves it well formed, with the cursor on a code-point boundary",
		{
			initial: S.Array(S.Literals(["a", "😀", "𝒳", "é", "中"])),
			edits: S.Array(S.Literals(["a", "😀", "𝒳", "left", "right", "home", "end", "backspace", "delete"])),
		},
		({ initial, edits }) => {
			const keys = edits.map(
				(edit): UiKey => (edit === "a" || edit === "😀" || edit === "𝒳" ? char(edit) : named(edit)),
			);
			const state = run(keys, initial.join(""));
			const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
			const high = state.value.charCodeAt(state.cursor - 1);
			const low = state.value.charCodeAt(state.cursor);
			const splitsPair = high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff;
			return !lone.test(state.value) && !splitsPair && state.cursor >= 0 && state.cursor <= state.value.length;
		},
		{ arbitrary: { runs: 500, size: 40 } },
	);
});

describe("TextInput.screen under CliUiTest", () => {
	it.effect('typing "quit" then enter returns "quit": q is text, not a cancel', () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name" }));
			yield* handle.type("quit");
			assert.include(yield* handle.plainFrame, "quit");
			yield* handle.press("enter");
			assert.strictEqual(yield* handle.result, "quit");
		}).pipe(Effect.scoped),
	);

	it.effect("Esc cancels with escape", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name" }));
			yield* handle.type("ab");
			yield* handle.press("escape");
			const error = yield* Effect.flip(handle.result);
			assert.strictEqual(S.is(Cancelled)(error) ? error.reason : undefined, "escape");
		}).pipe(Effect.scoped),
	);

	it.effect("Ctrl-C cancels with interrupt", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name" }));
			yield* handle.press("ctrl+c");
			const error = yield* Effect.flip(handle.result);
			assert.strictEqual(S.is(Cancelled)(error) ? error.reason : undefined, "interrupt");
		}).pipe(Effect.scoped),
	);

	it.effect("a failing validator blocks enter and shows its message as an error", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(
				TextInput.screen({
					message: "Port",
					validate: (value) => (/^\d+$/.test(value) ? undefined : "digits only"),
				}),
			);
			yield* handle.type("8x");
			yield* handle.press("enter");
			assert.include(yield* handle.frame, "[error]digits only[/error]");
			yield* handle.press("backspace");
			assert.notInclude(yield* handle.frame, "digits only", "editing clears the message");
			yield* handle.press("enter");
			assert.strictEqual(yield* handle.result, "8");
		}).pipe(Effect.scoped),
	);

	it.effect("shows the cursor with a glyph, so it stays visible at colour none", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name", initial: "ab" }), { color: "none" });
			assert.include(yield* handle.rawFrame, "ab▏");
			yield* handle.press("left");
			assert.include(yield* handle.rawFrame, "a▏b");
		}).pipe(Effect.scoped),
	);

	it.effect("a value wider than the terminal stays on one line, scrolled to keep the cursor in view", () =>
		Effect.gen(function* () {
			const long = "x".repeat(100) + "y".repeat(100);
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Paste", initial: long }), {
				columns: 20,
				color: "none",
			});
			const valueLine = (frame: string): string => frame.split("\n")[1] ?? "";
			assert.include(valueLine(yield* handle.plainFrame), "y▏", "the cursor, at the end, is in view");
			assert.isAtMost(Fmt.width(valueLine(yield* handle.plainFrame)), 19);
			assert.lengthOf((yield* handle.plainFrame).split("\n"), 3, "message, value and help: the value did not wrap");
			yield* handle.press("home");
			assert.include(valueLine(yield* handle.plainFrame), "▏x", "home scrolls the window to the start");
			assert.isAtMost(Fmt.width(valueLine(yield* handle.plainFrame)), 19);
		}).pipe(Effect.scoped),
	);

	it.effect("on a terminal narrower than the ASCII ellipsis the value line still fits", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "M", initial: "abcdefghij" }), {
				columns: 4,
				glyphs: "ascii",
				color: "none",
			});
			const valueLine = (yield* handle.plainFrame).split("\n")[1] ?? "";
			assert.include(valueLine, "|", "the cursor is drawn");
			assert.isAtMost(Fmt.width(valueLine), 3, valueLine);
		}).pipe(Effect.scoped),
	);

	it.effect("a long placeholder and a long error are cut to the width, one line each", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(
				TextInput.screen({
					message: "Port",
					placeholder: "a placeholder far too long to fit in twenty columns",
					validate: () => "an error message far too long to fit in twenty columns",
				}),
				{ columns: 20, color: "none" },
			);
			const before = (yield* handle.plainFrame).split("\n");
			assert.include(before[1] ?? "", "a placeholder");
			assert.isAtMost(Fmt.width(before[1] ?? ""), 19, before[1]);
			assert.lengthOf(before, 3, "message, value and help");
			yield* handle.press("enter");
			const after = (yield* handle.plainFrame).split("\n");
			assert.include(after[2] ?? "", "an error");
			assert.isAtMost(Fmt.width(after[2] ?? ""), 19, after[2]);
			assert.lengthOf(after, 4, "message, value, error and help");
		}).pipe(Effect.scoped),
	);

	it.effect("shows the placeholder, muted, while the value is empty", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name", placeholder: "your name" }));
			assert.include(yield* handle.frame, "[muted]your name[/muted]");
			yield* handle.type("x");
			assert.notInclude(yield* handle.frame, "your name");
		}).pipe(Effect.scoped),
	);
});

describe("TextInput with text read in one go (a fast typist, a paste)", () => {
	it.effect("foo then return in one write submits foo", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name" }));
			yield* handle.chunk({ char: "foo" }, "enter");
			assert.strictEqual(yield* handle.result, "foo");
		}).pipe(Effect.scoped),
	);

	it.effect("a backspace inside the chunk edits as it goes: ab, backspace, c, return gives ac", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name" }));
			yield* handle.chunk({ char: "ab" }, "backspace", { char: "c" }, "enter");
			assert.strictEqual(yield* handle.result, "ac");
		}).pipe(Effect.scoped),
	);

	it.effect("text after the return is ignored, a line feed becomes a space, and a tab is dropped", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name" }));
			yield* handle.chunk({ char: "a\nb\tc" }, "enter", { char: "after" });
			assert.strictEqual(yield* handle.result, "a bc");
		}).pipe(Effect.scoped),
	);

	it.effect("the validator still blocks a submit that arrives in the chunk", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(
				TextInput.screen({ message: "Port", validate: (value) => (/^\d+$/.test(value) ? undefined : "digits only") }),
			);
			yield* handle.chunk({ char: "8x" }, "enter");
			assert.include(yield* handle.plainFrame, "digits only");
			yield* handle.press("backspace");
			yield* handle.chunk({ char: "0" }, "enter");
			assert.strictEqual(yield* handle.result, "80");
		}).pipe(Effect.scoped),
	);
});
