// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as References from "effect/References";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import { CliLogger, makeCliLogger } from "../../effected/cli/CliLogger.ts";

/**
 * A `Console` that keeps the two streams apart.
 *
 * @remarks
 * The whole point of reading the `Console` off the fiber is that this is
 * possible at all: a `process.stdout` write is untestable without stubbing a
 * global inside a runner that is itself writing to those streams, which is
 * exactly why nobody notices when the split regresses.
 *
 * `Object.create(console)` inherits the members neither the logger nor these
 * assertions touch, so the double stays a `Console` without restating one.
 */
const capturing = (): { readonly console: Console.Console; readonly out: string[]; readonly err: string[] } => {
	const out: string[] = [];
	const err: string[] = [];
	const console_: Console.Console = Object.assign(Object.create(console), {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { console: console_, out, err };
};

const capture = (
	program: Effect.Effect<void>,
	options: Parameters<typeof CliLogger.layer>[0] = {},
): Effect.Effect<{ out: string[]; err: string[] }> =>
	Effect.gen(function* () {
		const { console: double, out, err } = capturing();
		yield* program.pipe(Effect.provide(CliLogger.layer(options)), Effect.provideService(Console.Console, double));
		return { out, err };
	});

describe("CliLogger", () => {
	it.effect("dispatches data-first constructors and the required-action curried constructor", () =>
		Effect.gen(function* () {
			const acceptsEmptyCurriedArgs: [] extends Parameters<typeof makeCliLogger> ? true : false = false;
			assert.isFalse(acceptsEmptyCurriedArgs);
			const underActions = (_fiber: Fiber.Fiber<unknown, unknown>): boolean => true;
			const curried: (options?: Parameters<typeof CliLogger.layer>[0]) => Logger.Logger<unknown, void> =
				makeCliLogger(underActions);
			const loggers: ReadonlyArray<Logger.Logger<unknown, void>> = [
				makeCliLogger(),
				makeCliLogger(undefined),
				makeCliLogger({}),
				makeCliLogger({}, underActions),
				makeCliLogger(undefined, underActions),
				curried(),
				curried({}),
			];
			const expected = [
				"::warning::literal", "::warning::literal", "::warning::literal",
				"\u200b::warning::literal", "\u200b::warning::literal",
				"\u200b::warning::literal", "\u200b::warning::literal",
			];
			const { console: double, out, err } = capturing();
			for (const logger of loggers) {
				yield* Effect.scopedWith((scope) =>
					Effect.flatMap(
						Layer.buildWithScope(Logger.layer([logger]), scope),
						(context) => Effect.provideContext(Effect.logWarning("::warning::literal"), context),
					),
				).pipe(Effect.provideService(Console.Console, double));
			}
			assert.deepStrictEqual(out, []);
			assert.deepStrictEqual(err, expected);
		}),
	);

	it.effect("writes info to stderr and errors to stderr under the default stderrFrom", () =>
		Effect.gen(function* () {
			const { out, err } = yield* capture(
				Effect.gen(function* () {
					yield* Effect.log("progress");
					yield* Effect.logError("broke");
				}),
			);

			assert.deepStrictEqual(out, []);
			assert.deepStrictEqual(err, ["progress", "broke"]);
		}),
	);

	it.effect("routes every level at or above Error to stderr, and nothing below, with stderrFrom Error", () =>
		Effect.gen(function* () {
			const { out, err } = yield* capture(
				Effect.gen(function* () {
					yield* Effect.logDebug("debug");
					yield* Effect.logInfo("info");
					yield* Effect.logWarning("warn");
					yield* Effect.logError("error");
					yield* Effect.logFatal("fatal");
				}).pipe(Effect.provideService(References.MinimumLogLevel, "Debug")),
				{ stderrFrom: "Error" },
			);

			// The discriminating mutant for this logger is "route everything to
			// stdout". Warn is the boundary that catches it: it must NOT be stderr.
			assert.deepStrictEqual(err, ["error", "fatal"]);
			assert.deepStrictEqual(out, ["debug", "info", "warn"]);
		}),
	);

	it.effect("renders plainly, with no timestamp, level or fiber id", () =>
		Effect.gen(function* () {
			const { err } = yield* capture(Effect.log("a plain line"));

			assert.deepStrictEqual(err, ["a plain line"]);
			assert.notMatch(err[0] ?? "", /^\[|INFO|\(#\d+\)/);
		}),
	);

	it.effect("joins a variadic message with spaces", () =>
		Effect.gen(function* () {
			const { err } = yield* capture(Effect.log("synced", 3, "repos"));

			assert.deepStrictEqual(err, ["synced 3 repos"]);
		}),
	);

	it.effect("by default routes Info and Warning to stderr, keeping stdout for program output (#716)", () =>
		Effect.gen(function* () {
			const { console: double, out, err } = capturing();
			yield* Effect.logInfo("info line").pipe(
				Effect.andThen(Effect.logWarning("warning line")),
				Effect.andThen(Console.log("the document")),
				Effect.provide(CliLogger.layer()),
				Effect.provideService(Console.Console, double),
			);
			assert.deepStrictEqual(err, ["info line", "warning line"]);
			assert.deepStrictEqual(out, ["the document"]);
		}),
	);

	it.effect("stderrFrom still opts back into stdout for lower levels", () =>
		Effect.gen(function* () {
			const { console: double, out, err } = capturing();
			yield* Effect.logInfo("info line").pipe(
				Effect.provide(CliLogger.layer({ stderrFrom: "Error" })),
				Effect.provideService(Console.Console, double),
			);
			assert.deepStrictEqual(out, ["info line"]);
			assert.deepStrictEqual(err, []);
		}),
	);

	it.effect("honours LogToStderr by forcing everything to stderr", () =>
		Effect.gen(function* () {
			// stderrFrom: "Error" so that, without the force, "progress" (Info)
			// would land on stdout — the force is what has to move it to stderr.
			// Under the default "All" this would already route Info to stderr on
			// its own, making the LogToStderr force untested.
			const { out, err } = yield* capture(
				Effect.gen(function* () {
					yield* Effect.log("progress");
					yield* Effect.logError("broke");
				}).pipe(Effect.provideService(References.LogToStderr, true)),
				{ stderrFrom: "Error" },
			);

			assert.deepStrictEqual(err, ["progress", "broke"]);
			// It forces one direction only: it must never move an error onto stdout.
			assert.deepStrictEqual(out, []);
		}),
	);

	it.effect("takes a custom renderer and a custom stderr threshold", () =>
		Effect.gen(function* () {
			const { out, err } = yield* capture(
				Effect.gen(function* () {
					yield* Effect.logInfo("info");
					yield* Effect.logWarning("warn");
				}).pipe(Effect.provideService(References.MinimumLogLevel, "Debug")),
				{ render: (message) => `> ${String(message)}`, stderrFrom: "Warn" },
			);

			assert.deepStrictEqual(out, ["> info"]);
			assert.deepStrictEqual(err, ["> warn"]);
		}),
	);
});
