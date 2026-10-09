// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import type { ColorLevel } from "../../../effected/env/index.ts";
import type * as Scope from "effect/Scope";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import { holdChalkLevel, levelOf, loadInk, withInkColour } from "../../../effected/cli/ui/internal/ink.ts";
import type { ChalkLevel, InkChalk } from "../../../effected/cli/ui/internal/inkChalk.ts";
import { inkChalk } from "../../../effected/cli/ui/internal/inkChalk.ts";

const ESC = String.fromCharCode(0x1b);
const SGR = new RegExp(`${ESC}\\[[0-9;]*m`);

/** Ink's own chalk, which these tests drive; resolution failing here is a broken bridge, not a skip. */
const chalk: Effect.Effect<InkChalk> = Effect.flatMap(
	Effect.promise(() => inkChalk()),
	O.match({
		onNone: () => Effect.die(new Error("Ink's chalk did not resolve from Ink's location")),
		onSome: Effect.succeed,
	}),
);

/** Hold Ink's chalk at `level` for the test's scope, restoring whatever it was, so no test leaks a level. */
const forceLevel = (level: ChalkLevel): Effect.Effect<InkChalk, never, Scope.Scope> =>
	Effect.flatMap(chalk, (instance) =>
		Effect.as(
			Effect.acquireRelease(
				Effect.sync(() => {
					const saved = instance.level;
					instance.level = level;
					return saved;
				}),
				(saved) =>
					Effect.sync(() => {
						instance.level = saved;
					}),
			),
			instance,
		),
	);

/** A consumer's own component passing raw Ink colour props, rendered through Ink's `renderToString`. */
const consumerText: Effect.Effect<string> = Effect.map(loadInk, ({ ink, react }) =>
	ink.renderToString(react.createElement(ink.Text, { color: "red", bold: true }, "x"), { columns: 20 }),
);

describe("the Ink bridge", () => {
	it("maps each colour level to its chalk level", () => {
		const levels: Record<ColorLevel, ChalkLevel> = { none: 0, basic: 1, "256": 2, truecolor: 3 };
		for (const [colour, level] of Object.entries(levels)) assert.strictEqual(levelOf(colour as ColorLevel), level);
	});

	it.effect("control: with Ink's chalk at level 3, as FORCE_COLOR=3 leaves it, a raw red bold Text carries SGR", () =>
		Effect.gen(function* () {
			yield* forceLevel(3);
			assert.match(yield* consumerText, SGR);
		}),
	);

	it.effect(
		"at colour none a raw red bold Text renders escape-free, and releasing restores the saved level and the colour",
		() =>
			Effect.gen(function* () {
				const instance = yield* forceLevel(3);
				yield* Effect.scoped(
					Effect.gen(function* () {
						yield* withInkColour("none");
						assert.strictEqual(instance.level, 0);
						const frame = yield* consumerText;
						assert.include(frame, "x", "the frame rendered");
						assert.notInclude(frame, ESC);
					}),
				);
				assert.strictEqual(instance.level, 3);
				assert.match(yield* consumerText, SGR);
			}),
	);

	it.effect("at truecolor the same Text carries SGR even when Ink's chalk sat at level 0", () =>
		Effect.gen(function* () {
			const instance = yield* forceLevel(0);
			assert.notInclude(yield* consumerText, ESC, "level 0 is escape-free before the hold");
			yield* Effect.scoped(
				Effect.gen(function* () {
					yield* withInkColour("truecolor");
					assert.strictEqual(instance.level, 3);
					assert.match(yield* consumerText, SGR);
				}),
			);
			assert.strictEqual(instance.level, 0);
		}),
	);

	it.effect("interrupting the fiber that holds the level restores it", () =>
		Effect.gen(function* () {
			const instance = yield* forceLevel(3);
			const held = yield* Deferred.make<void>();
			const fiber = yield* Effect.gen(function* () {
				yield* withInkColour("none");
				yield* Deferred.succeed(held, undefined);
				return yield* Effect.never;
			}).pipe(Effect.scoped, Effect.forkChild);
			yield* Deferred.await(held);
			assert.strictEqual(instance.level, 0, "the level is held while the fiber runs");
			yield* Fiber.interrupt(fiber);
			assert.strictEqual(instance.level, 3);
		}),
	);

	it.effect("with no chalk to hold, it warns once and leaves the level alone", () =>
		Effect.gen(function* () {
			const instance = yield* forceLevel(2);
			const warnings: Array<string> = [];
			const capture = Logger.layer([
				Logger.make(({ message }) => {
					warnings.push(Array.isArray(message) ? message.join(" ") : String(message));
				}),
			]);
			yield* Effect.scoped(
				Effect.gen(function* () {
					yield* holdChalkLevel(O.none(), "none");
					yield* holdChalkLevel(O.none(), "none");
					assert.strictEqual(instance.level, 2);
				}),
			).pipe(Effect.provide(capture));
			assert.lengthOf(warnings, 1);
			assert.include(warnings[0] ?? "", "chalk");
		}),
	);
});
