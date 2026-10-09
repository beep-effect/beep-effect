import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { TextInput } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

const valueLine = (frame: string): string => frame.split("\n")[1] ?? "";

/** An emoji, a letter with a combining accent and a flag: 3 graphemes, 8 UTF-16 code units. */
const CLUSTERS = "👍é🇺🇸";

describe("TextInput mask", () => {
	it.effect("draws one mask per grapheme, never per UTF-16 unit, and resolves with the real text", () =>
		Effect.gen(function* () {
			assert.strictEqual(`ab${CLUSTERS}`.length, 10, "the fixture is wider in code units than in graphemes");
			const handle = yield* CliUiTest.render(
				TextInput.screen({ message: "Secret", initial: `ab${CLUSTERS}`, mask: true }),
				{ color: "none" },
			);
			assert.strictEqual(valueLine(yield* handle.plainFrame), "•••••▏");
			yield* handle.press("enter");
			assert.strictEqual(yield* handle.result, `ab${CLUSTERS}`);
		}),
	);

	it.effect("control: without mask the same value is drawn as itself", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Plain", initial: "ab" }), {
				color: "none",
			});
			assert.strictEqual(valueLine(yield* handle.plainFrame), "ab▏");
		}),
	);

	it.effect("a typed or pasted secret never reaches any frame, and validate sees the real text", () =>
		Effect.gen(function* () {
			const seen: Array<string> = [];
			const handle = yield* CliUiTest.render(
				TextInput.screen({
					message: "Token reference?",
					mask: true,
					validate: (value) => {
						seen.push(value);
						return value.startsWith("ghp_") ? "that is a token, not a reference" : undefined;
					},
				}),
				{ color: "none" },
			);
			yield* handle.type("ghp_");
			yield* handle.chunk({ char: "abc123" });
			yield* handle.press("enter");
			assert.deepStrictEqual(seen, ["ghp_abc123"]);
			assert.include(yield* handle.plainFrame, "that is a token, not a reference");
			assert.strictEqual(valueLine(yield* handle.plainFrame), "••••••••••▏");
			for (const frame of yield* handle.frames) {
				assert.notInclude(frame, "ghp_");
				assert.notInclude(frame, "abc123");
			}
		}),
	);

	it.effect("the cursor moves through the real text, drawn between masks", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "M", initial: "abc", mask: true }), {
				color: "none",
			});
			yield* handle.press("left");
			assert.strictEqual(valueLine(yield* handle.plainFrame), "••▏•");
			yield* handle.press("backspace", "enter");
			assert.strictEqual(yield* handle.result, "ac");
		}),
	);

	it.effect("the masks either side of the cursor always add up to the graphemes, the cursor never inside one", () =>
		Effect.gen(function* () {
			// "aé" with é as e + a combining accent: 2 graphemes, 3 code units.
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "M", initial: "ae\u0301", mask: true }), {
				color: "none",
			});
			assert.strictEqual(valueLine(yield* handle.plainFrame), "••▏");
			yield* handle.press("left");
			assert.strictEqual(valueLine(yield* handle.plainFrame), "•▏•", "one step crosses the accented e whole");
			yield* handle.press("left");
			assert.strictEqual(valueLine(yield* handle.plainFrame), "▏••");
			yield* handle.press("right", "delete", "enter");
			assert.strictEqual(yield* handle.result, "a", "delete removed the accented e whole");
		}),
	);

	it.effect("a string mask is drawn as given, and true is * under ASCII glyphs", () =>
		Effect.gen(function* () {
			const custom = yield* Effect.scoped(
				Effect.flatMap(
					CliUiTest.render(TextInput.screen({ message: "M", initial: CLUSTERS, mask: "x" }), { color: "none" }),
					(handle) => handle.plainFrame,
				),
			);
			assert.strictEqual(valueLine(custom), "xxx▏");
			const ascii = yield* Effect.scoped(
				Effect.flatMap(
					CliUiTest.render(TextInput.screen({ message: "M", initial: "ab", mask: true }), {
						color: "none",
						glyphs: "ascii",
					}),
					(handle) => handle.plainFrame,
				),
			);
			assert.strictEqual(valueLine(ascii), "**|");
		}),
	);

	/** A giveaway anywhere in the value, as the TSDoc advises: never a prefix match. */
	const looksLikeToken = (value: string): boolean => /gh[pousr]_|github_pat_/.test(value);

	it.effect("a predicate leaves an address readable while it is typed", () =>
		Effect.gen(function* () {
			const seen: Array<string> = [];
			const handle = yield* CliUiTest.render(
				TextInput.screen({
					message: "Token reference?",
					mask: (value) => {
						seen.push(value);
						return looksLikeToken(value);
					},
				}),
				{ color: "none" },
			);
			yield* handle.type("op://v/i");
			assert.strictEqual(valueLine(yield* handle.plainFrame), "op://v/i▏");
			yield* handle.press("enter");
			assert.strictEqual(yield* handle.result, "op://v/i");
			assert.include(seen, "op://v/i", "the predicate is asked with the real value");
		}),
	);

	it.effect("once it answers true the mask latches: home and delete never redraw the rest of a token in clear", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "M", mask: looksLikeToken }), {
				color: "none",
			});
			yield* handle.chunk({ char: "ghp_SECRET123" });
			yield* handle.press("home", "delete");
			assert.strictEqual(valueLine(yield* handle.plainFrame), "▏••••••••••••", "hp_SECRET123 stays masked");
			for (const frame of yield* handle.frames) assert.notInclude(frame, "SECRET");
			yield* handle.press("enter");
			assert.strictEqual(yield* handle.result, "hp_SECRET123", "the result is the real value");
		}),
	);

	it.effect("a token pasted after an address is masked: the giveaway matches anywhere, not as a prefix", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "M", mask: looksLikeToken }), {
				color: "none",
			});
			yield* handle.type("op://v/");
			assert.strictEqual(valueLine(yield* handle.plainFrame), "op://v/▏", "control: the address was readable");
			yield* handle.chunk({ char: "ghp_SECRET123" });
			assert.strictEqual(valueLine(yield* handle.plainFrame), `${"•".repeat(20)}▏`);
			const frames = yield* handle.frames;
			assert.isFalse(
				frames.some((frame) => frame.includes("SECRET")),
				"no frame ever drew the token",
			);
		}),
	);

	it.effect("clearing the value unlatches the mask", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "M", mask: looksLikeToken }), {
				color: "none",
			});
			yield* handle.chunk({ char: "ghp_x" });
			assert.strictEqual(valueLine(yield* handle.plainFrame), "•••••▏");
			for (let i = 0; i < 5; i++) yield* handle.press("backspace");
			yield* handle.type("op://a");
			assert.strictEqual(valueLine(yield* handle.plainFrame), "op://a▏", "readable again after the clear");
		}),
	);

	it.effect("a pasted token is masked from its first frame by a predicate", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "M", mask: looksLikeToken }), {
				color: "none",
			});
			yield* handle.chunk({ char: "ghp_secret123" });
			for (const frame of yield* handle.frames) assert.notInclude(frame, "ghp_");
		}),
	);

	it.effect("the placeholder still shows while the value is empty", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(
				TextInput.screen({ message: "M", placeholder: "op://vault/item", mask: true }),
				{ color: "none" },
			);
			assert.strictEqual(valueLine(yield* handle.plainFrame), "▏op://vault/item");
			yield* handle.type("s");
			assert.strictEqual(valueLine(yield* handle.plainFrame), "•▏");
		}),
	);
});
