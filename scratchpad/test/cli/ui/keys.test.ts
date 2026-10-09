import { assert, describe, it } from "@effect/vitest";
import { fcRuns } from "@beep/fc-runs";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Text, useInput } from "ink";
import type { ReactElement } from "react";
import { createElement } from "react";
import { Glyphs } from "../../../effected/cli/index.ts";
import type { KeyName, Screen, UiKey as UiKeyType } from "../../../effected/cli/ui.ts";
import { KeyHelp, KeyTable, UiKey, useKeys } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";
import { KeyName as KeyNameDomain, UiKeyPayload } from "../../../effected/cli/ui/UiKey.ts";

/** A screen that records what `UiKey.fromInk` makes of every input Ink delivers. */
const recording = (seen: Array<UiKeyType | undefined>): Screen<never> => {
	const Recorder = (): ReactElement => {
		useInput((input, key) => {
			seen.push(UiKey.fromInk(input, key));
		});
		return createElement(Text, null, "recording");
	};
	return () => createElement(Recorder);
};

const named = (name: KeyName): UiKeyType => ({ _tag: "Named", name });

describe("UiKey schema ownership", () => {
	it.effect.prop("round-trips the named-key domain", [Arbitrary.schema(KeyNameDomain)], ([name]) =>
		Effect.gen(function* () {
			const encoded = yield* S.encodeEffect(KeyNameDomain)(name);
			assert.strictEqual(yield* S.decodeEffect(KeyNameDomain)(encoded), name);
			assert.deepStrictEqual(UiKey.named(name), named(name));
		}), { arbitrary: fcRuns(100) },
	);

	it.effect.prop("round-trips plain Named and Char payloads", [Arbitrary.schema(UiKeyPayload)], ([key]) =>
		Effect.gen(function* () {
			const encoded = yield* S.encodeEffect(UiKeyPayload)(key);
			assert.deepStrictEqual(yield* S.decodeEffect(UiKeyPayload)(encoded), key);
			assert.deepStrictEqual(key._tag === "Named" ? UiKey.named(key.name) : UiKey.char(key.char), key);
		}), { arbitrary: fcRuns(100) },
	);

	it("rejects unknown key names and malformed payloads while preserving arbitrary typed text", () => {
		assert.isFalse(S.is(KeyNameDomain)("unknown"));
		assert.isFalse(S.is(UiKeyPayload)({ _tag: "Named", name: "unknown" }));
		assert.isFalse(S.is(UiKeyPayload)({ _tag: "Char", char: 1 }));
		for (const char of ["", " ", "pasted text", "\u0003"]) {
			assert.deepStrictEqual(UiKey.char(char), { _tag: "Char", char });
		}
	});
});

describe("UiKey.fromInk", () => {
	it.effect("names every key Ink reports, from the bytes a terminal sends", () =>
		Effect.gen(function* () {
			const keys: ReadonlyArray<KeyName> = [
				"up",
				"down",
				"left",
				"right",
				"enter",
				"space",
				"tab",
				"shift+tab",
				"backspace",
				"delete",
				"home",
				"end",
				"pageup",
				"pagedown",
			];
			const seen: Array<UiKeyType | undefined> = [];
			const handle = yield* CliUiTest.render(recording(seen));
			yield* handle.press(...keys);
			assert.deepStrictEqual(seen, keys.map(named));
		}).pipe(Effect.scoped),
	);

	it.effect("names Esc and Ctrl-C, which also end the screen", () =>
		Effect.gen(function* () {
			for (const key of ["escape", "ctrl+c"] as const) {
				const seen: Array<UiKeyType | undefined> = [];
				yield* Effect.scoped(
					Effect.gen(function* () {
						const handle = yield* CliUiTest.render(recording(seen));
						yield* handle.press(key);
						yield* Effect.flip(handle.result);
					}),
				);
				assert.deepStrictEqual(seen, [named(key)], key);
			}
		}),
	);

	it.effect("gives a printable character as Char, and space as Named, never Char", () =>
		Effect.gen(function* () {
			const seen: Array<UiKeyType | undefined> = [];
			const handle = yield* CliUiTest.render(recording(seen));
			yield* handle.type("q Z");
			assert.deepStrictEqual(seen, [{ _tag: "Char", char: "q" }, named("space"), { _tag: "Char", char: "Z" }]);
		}).pipe(Effect.scoped),
	);
});

type Action = "move-up" | "move-down" | "toggle" | "quit" | "secret";

const table = KeyTable.make<Action>([
	{ keys: ["up"], action: "move-up", help: "move" },
	{ keys: ["down"], action: "move-down", help: "move" },
	{ keys: ["space", { char: "x" }], action: "toggle", help: "toggle" },
	{ keys: ["space"], action: "quit", help: "never reached" },
	{ keys: [{ char: "q" }], action: "quit", help: "quit" },
	{ keys: ["tab"], action: "secret", help: "hidden", hidden: true },
]);

describe("KeyTable", () => {
	it("matches the first binding for a key, and nothing for an unbound one", () => {
		assert.deepStrictEqual(table.match(named("space")), O.some("toggle"));
		assert.deepStrictEqual(table.match({ _tag: "Char", char: "x" }), O.some("toggle"));
		assert.deepStrictEqual(table.match({ _tag: "Char", char: "q" }), O.some("quit"));
		assert.deepStrictEqual(table.match(named("tab")), O.some("secret"), "hidden bindings still match");
		assert.isTrue(O.isNone(table.match(named("enter"))));
		assert.isTrue(O.isNone(table.match({ _tag: "Char", char: "Q" })), "characters match exactly");
	});

	it("labels help from the glyph set: arrows under Unicode, words under ASCII, hidden bindings omitted", () => {
		const unicode = table.help(Glyphs.unicode);
		const ascii = table.help(Glyphs.ascii);
		assert.deepStrictEqual(
			unicode.map((row) => row.label),
			["↑", "↓", "space/x", "q"],
		);
		assert.deepStrictEqual(
			ascii.map((row) => row.label),
			["up", "down", "space/x", "q"],
		);
		assert.notInclude(
			unicode.map((row) => row.help),
			"never reached",
			"a binding whose keys are all taken by earlier ones can never fire, so help omits it",
		);
		assert.notInclude(
			unicode.map((row) => row.help),
			"hidden",
		);
	});

	it("labels a partly shadowed binding with only the keys that can still fire it", () => {
		const partly = KeyTable.make([
			{ keys: ["space"], action: "first", help: "first" },
			{ keys: ["space", { char: "y" }], action: "second", help: "second" },
		]);
		assert.deepStrictEqual(partly.help(Glyphs.unicode), [
			{ label: "space", help: "first" },
			{ label: "y", help: "second" },
		]);
	});

	it("normalises a typed space to the named space key, which is the only one Ink input ever gives", () => {
		const spaced = KeyTable.make([{ keys: [{ char: " " }], action: "toggle", help: "toggle" }]);
		assert.deepStrictEqual(spaced.match(named("space")), O.some("toggle"));
		assert.deepStrictEqual(spaced.help(Glyphs.unicode), [{ label: "space", help: "toggle" }]);
	});

	it("the root table cancels with escape on Esc (help: cancel) and interrupt on Ctrl-C (hidden)", () => {
		assert.deepStrictEqual(KeyTable.root.match(named("escape")), O.some("escape"));
		assert.deepStrictEqual(KeyTable.root.match(named("ctrl+c")), O.some("interrupt"));
		assert.isTrue(O.isNone(KeyTable.root.match({ _tag: "Char", char: "q" })), "q is never a root key");
		assert.deepStrictEqual(KeyTable.root.help(Glyphs.unicode), [{ label: "esc", help: "cancel" }]);
	});
});

describe("useKeys and KeyHelp", () => {
	it.effect("useKeys dispatches the matched action, and nothing for an unbound key", () =>
		Effect.gen(function* () {
			const dispatched: Array<Action> = [];
			const Keys = (): ReactElement => {
				useKeys(table, (action) => {
					dispatched.push(action);
				});
				return createElement(Text, null, "keys");
			};
			const handle = yield* CliUiTest.render(() => createElement(Keys));
			yield* handle.press("down", "space", "enter", "up");
			yield* handle.type("q");
			assert.deepStrictEqual(dispatched, ["move-down", "toggle", "move-up", "quit"]);
		}).pipe(Effect.scoped),
	);

	it.effect("useKeys dispatches nothing while inactive", () =>
		Effect.gen(function* () {
			const dispatched: Array<Action> = [];
			const Keys = (): ReactElement => {
				useKeys(table, (action) => dispatched.push(action), { isActive: false });
				return createElement(Text, null, "keys");
			};
			const handle = yield* CliUiTest.render(() => createElement(Keys));
			yield* handle.press("down", "space");
			assert.deepStrictEqual(dispatched, []);
		}).pipe(Effect.scoped),
	);

	it.effect("KeyHelp names every visible binding, then the root's esc cancel, and no hidden one", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(() => createElement(KeyHelp, { tables: [table] }));
			const line = (yield* handle.plainFrame).trim();
			for (const row of table.help(Glyphs.unicode)) {
				assert.include(line, row.label, row.label);
				assert.include(line, row.help, row.help);
			}
			assert.include(line, "↑/↓ move", "neighbouring rows with the same help share one entry");
			assert.include(line, "space/x toggle");
			assert.notInclude(line, "hidden");
			assert.notInclude(line, "never reached");
			assert.isTrue(line.endsWith("esc cancel"), line);
			assert.include(yield* handle.frame, "[muted]", "the help line is painted muted");
		}).pipe(Effect.scoped),
	);

	it.effect("KeyHelp under ASCII glyphs labels with words", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(() => createElement(KeyHelp, { tables: [table] }), { glyphs: "ascii" });
			const line = (yield* handle.plainFrame).trim();
			assert.include(line, "up/down move");
			assert.notInclude(line, "↑");
		}).pipe(Effect.scoped),
	);
});

describe("KeyTable help shadowing compares chars in NFC", () => {
	it("a precomposed and a decomposed binding of the same char shadow each other", () => {
		const precomposedFirst = KeyTable.make<"a" | "b">([
			{ keys: [{ char: "é" }], action: "a", help: "first" },
			{ keys: [{ char: "é" }], action: "b", help: "second" },
		]);
		assert.deepStrictEqual(
			precomposedFirst.help(Glyphs.unicode).map((row) => row.help),
			["first"],
		);
		const decomposedFirst = KeyTable.make<"a" | "b">([
			{ keys: [{ char: "é" }], action: "a", help: "first" },
			{ keys: [{ char: "é" }], action: "b", help: "second" },
		]);
		assert.deepStrictEqual(
			decomposedFirst.help(Glyphs.unicode).map((row) => row.help),
			["first"],
		);
	});
});
