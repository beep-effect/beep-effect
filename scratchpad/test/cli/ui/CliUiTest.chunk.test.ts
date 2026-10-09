// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Text } from "ink";
import type { ReactElement } from "react";
import { createElement, useState } from "react";
import { CliUi, Confirm, KeyTable, Select, TextInput, useKeys } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

const RIGHT = KeyTable.make<"step">([{ keys: ["right"], action: "step", help: "step" }]);

/** The bug class: the handler steps from the count its render captured. */
const ClosureStepper = (): ReactElement => {
	const [count, setCount] = useState(0);
	useKeys(RIGHT, () => setCount(count + 1));
	return createElement(Text, null, `count=${count}`);
};

/** The fix: a functional update steps from the current count. */
const FunctionalStepper = (): ReactElement => {
	const [count, setCount] = useState(0);
	useKeys(RIGHT, () => setCount((current) => current + 1));
	return createElement(Text, null, `count=${count}`);
};

const counted = (
	component: () => ReactElement,
	drive: (handle: {
		readonly press: (...keys: ReadonlyArray<"right">) => Effect.Effect<void>;
		readonly chunk: (...keys: ReadonlyArray<"right">) => Effect.Effect<void>;
	}) => Effect.Effect<void>,
) =>
	Effect.scoped(
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(() => createElement(component));
			yield* drive(handle);
			return (yield* handle.plainFrame).trim();
		}),
	);

describe("chunk: several keys in one stdin write", () => {
	it.effect("a render-closure handler steps once for two keys in one chunk, but twice when pressed one by one", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* counted(ClosureStepper, (handle) => handle.chunk("right", "right")), "count=1");
			assert.strictEqual(yield* counted(ClosureStepper, (handle) => handle.press("right", "right")), "count=2");
		}),
	);

	it.effect("a functional update steps twice either way", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* counted(FunctionalStepper, (handle) => handle.chunk("right", "right")), "count=2");
			assert.strictEqual(yield* counted(FunctionalStepper, (handle) => handle.press("right", "right")), "count=2");
		}),
	);

	it.effect("a session's screens chunk too", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			yield* Effect.forkScoped(CliUi.run(() => createElement(ClosureStepper)).pipe(Effect.provide(session.layer)));
			const screen = yield* session.next({ contains: "count=0" });
			yield* screen.chunk("right", "right");
			assert.strictEqual((yield* screen.plainFrame).trim(), "count=1");
		}).pipe(Effect.scoped),
	);
});

const Y = KeyTable.make<"y">([{ keys: [{ char: "y" }], action: "y", help: "y" }]);

/** Counts each `y`, stepping functionally, so every dispatch counts. */
const YCounter = (): ReactElement => {
	const [count, setCount] = useState(0);
	useKeys(Y, () => setCount((current) => current + 1));
	return createElement(Text, null, `y=${count}`);
};

describe("chunk: coalesced characters (Ink hands one read of text to useInput as one string)", () => {
	it.effect("useKeys dispatches each character of a coalesced read: yy is two y presses", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(() => createElement(YCounter));
			yield* handle.chunk({ char: "y" }, { char: "y" });
			assert.strictEqual((yield* handle.plainFrame).trim(), "y=2");
		}).pipe(Effect.scoped),
	);

	it.effect("a coalesced y then return answers a Confirm yes and submits it", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(Confirm.screen({ message: "Go?", initial: false }));
			yield* handle.chunk({ char: "y" }, "enter");
			const result = yield* handle.result;
			assert.isTrue(result.confirmed);
		}).pipe(Effect.scoped),
	);

	it.effect("TextInput still inserts coalesced text whole", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name" }));
			yield* handle.chunk({ char: "a" }, { char: "b" }, "space");
			yield* handle.chunk({ char: "c" });
			assert.include(yield* handle.plainFrame, "ab c");
		}).pipe(Effect.scoped),
	);
});

/** Counts the actions a table dispatches, by name. */
const counter = <A extends string>(table: KeyTable<A>) => {
	const Counter = (): ReactElement => {
		const [seen, setSeen] = useState<ReadonlyArray<string>>([]);
		useKeys(table, (action) => setSeen((current) => [...current, action]));
		return createElement(Text, null, `seen=${seen.join(",")}`);
	};
	return Counter;
};
const seenOf = (frame: string): string => frame.trim().replace(/^seen=/, "");

describe("useKeys splits by grapheme and compares NFC", () => {
	const letters = KeyTable.make<"e" | "é" | "dev" | "enter">([
		{ keys: [{ char: "e" }], action: "e", help: "e" },
		{ keys: [{ char: "é" }], action: "é", help: "é" },
		{ keys: [{ char: "👩‍💻" }], action: "dev", help: "dev" },
		{ keys: ["enter"], action: "enter", help: "enter" },
	]);

	it.effect("a decomposed é does not fire e, and fires the precomposed é binding", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(() => createElement(counter(letters)));
			yield* handle.chunk({ char: "éé" });
			assert.strictEqual(seenOf(yield* handle.plainFrame), "é,é");
		}).pipe(Effect.scoped),
	);

	it.effect("a ZWJ emoji is one key, and CR LF is one enter", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(() => createElement(counter(letters)));
			yield* handle.chunk({ char: "👩‍💻👩‍💻\r\n" });
			assert.strictEqual(seenOf(yield* handle.plainFrame), "dev,dev,enter");
		}).pipe(Effect.scoped),
	);
});

describe("a bracketed paste never drives a key table", () => {
	const paste = (text: string) => ({ char: `\u001b[200~${text}\u001b[201~` });

	it.effect("a paste holding q does not cancel a Select", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(
				Select.screen({
					message: "Pick",
					choices: [
						{ label: "one", value: 1 },
						{ label: "two", value: 2 },
					],
				}),
			);
			yield* handle.chunk(paste("q"));
			yield* handle.press("enter");
			assert.strictEqual(yield* handle.result, 1);
		}).pipe(Effect.scoped),
	);

	it.effect("a paste of yes and a newline does not answer a Confirm", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(Confirm.screen({ message: "Go?", initial: false }));
			yield* handle.chunk(paste("yes\n"));
			assert.include(yield* handle.plainFrame, "[No]");
			yield* handle.press("enter");
			assert.isFalse((yield* handle.result).confirmed);
		}).pipe(Effect.scoped),
	);

	it.effect("TextInput takes a paste as text, a pasted newline as a space, and never submits on it", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name" }));
			yield* handle.chunk(paste("a\nb\r"));
			assert.include(yield* handle.plainFrame, "a b");
			yield* handle.press("enter");
			assert.strictEqual(yield* handle.result, "a b ");
		}).pipe(Effect.scoped),
	);
});
