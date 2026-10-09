// @effect-diagnostics strictEffectProvide:skip-file
import * as F from "effect/Function";
import * as Data from "effect/Data";
import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Runtime from "effect/Runtime";
import { CliError } from "effect/cli";
import { CliLogger } from "../../effected/cli/CliLogger.ts";
import { CliRuntime } from "../../effected/cli/CliRuntime.ts";
import { ExitRequested } from "../../effected/cli/internal/ExitRequested.ts";

class TestError extends Data.TaggedError("TestError")<{ readonly message: string; readonly cause?: unknown }> {
	override readonly name = "Error";
	constructor(message: string, options?: { readonly cause?: unknown }) { super({ message, ...options }); }
}

const capturing = (): { readonly console: Console.Console; readonly out: string[]; readonly err: string[] } => {
	const out: string[] = [];
	const err: string[] = [];
	const console_: Console.Console = Object.assign(Object.create(console), {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { console: console_, out, err };
};

/** Run a program under the CLI logger, returning what was written and the exit. */
const run = <A, E>(
	program: Effect.Effect<A, E>,
	options: Parameters<typeof CliRuntime.reportFailures>[0] = {},
): Effect.Effect<{ out: string[]; err: string[]; exit: Exit.Exit<A, Error> }> =>
	Effect.gen(function* () {
		const { console: double, out, err } = capturing();
		const exit = yield* program.pipe(
			CliRuntime.reportFailures(options),
			Effect.exit,
			Effect.provide(CliLogger.layer()),
			Effect.provideService(Console.Console, double),
		);
		return { out, err, exit };
	});

/** The squashed failure, the same way `makeRunMain` reads one. */
const failureOf = <A>(exit: Exit.Exit<A, Error>): unknown =>
	Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined;

describe("CliRuntime.reportFailures", () => {
	it.effect("reports through the program's own logger, on stderr", () =>
		Effect.gen(function* () {
			const { out, err, exit } = yield* F.pipe(new TestError("boom"), Effect.fail, run);

			assert.deepStrictEqual(err, ["[FAIL] Error: boom"]);
			// The bug this exists to prevent is the report landing on stdout.
			assert.deepStrictEqual(out, []);
			assert.strictEqual(Exit.isFailure(exit), true);
		}),
	);

	it.effect("re-fails rather than swallowing, so a broken run cannot exit zero", () =>
		Effect.gen(function* () {
			const { exit } = yield* F.pipe(new TestError("boom"), Effect.fail, run);
			assert.strictEqual(Exit.isSuccess(exit), false);
		}),
	);

	it.effect("marks the error so the runtime does NOT report it a second time", () =>
		Effect.gen(function* () {
			const { exit } = yield* F.pipe(new TestError("boom"), Effect.fail, run);
			const error = failureOf(exit);

			// Read through core's own getter, not our property. The polarity is
			// inverted relative to the name — `false` is what suppresses — so this
			// assertion FAILS if anyone "corrects" the marker to `true` to match the
			// name, which is the whole reason it is written this way.
			assert.strictEqual(Runtime.getErrorReported(CliRuntime.reported(new Error("x"))), false);
			assert.strictEqual(error === undefined ? true : Runtime.getErrorReported(error), false);
		}),
	);

	it.effect("keeps an exit code the error chose for itself", () =>
		Effect.gen(function* () {
			const picky = Object.assign(new Error("needs 3"), { [Runtime.errorExitCode]: 3 });
			const { exit } = yield* run(Effect.fail(picky), { exitCode: 9 });
			const error = failureOf(exit);

			// The option is a FALLBACK, never an override: 3 was a deliberate choice
			// by whatever raised the error.
			assert.strictEqual(Runtime.getErrorExitCode(error), 3);
		}),
	);

	it.effect("distinguishes an explicit exit code of 1 from no marker at all", () =>
		Effect.gen(function* () {
			const explicitlyOne = Object.assign(new Error("one"), { [Runtime.errorExitCode]: 1 });
			const unmarked = new Error("unmarked");

			const kept = yield* run(Effect.fail(explicitlyOne), { exitCode: 7 });
			const defaulted = yield* run(Effect.fail(unmarked), { exitCode: 7 });

			const codeOf = <A>(exit: Exit.Exit<A, Error>): number => exit.pipe(failureOf, Runtime.getErrorExitCode);

			// `getErrorExitCode` answers 1 for both an error marked 1 and an unmarked
			// one, so reading it alone would let the option override a deliberate 1.
			assert.strictEqual(codeOf(kept.exit), 1);
			assert.strictEqual(codeOf(defaulted.exit), 7);
		}),
	);

	it.effect("renders several lines when the renderer returns several", () =>
		Effect.gen(function* () {
			const { err } = yield* run(Effect.fail(new TestError("bad config")), {
				render: (error) => [String(error), "  unknown key at groups.g.rulesetz"],
			});

			assert.deepStrictEqual(err, ["Error: bad config", "  unknown key at groups.g.rulesetz"]);
		}),
	);

	it.effect("tells render a typed failure is not a defect, and hands it the whole cause", () =>
		Effect.gen(function* () {
			const seen: Array<{ error: unknown; isDefect: boolean; cause: Cause.Cause<unknown> }> = [];
			const typed = new Error("typed");
			yield* run(Effect.fail(typed), {
				render: (error, { cause, isDefect }) => {
					seen.push({ error, isDefect, cause });
					return String(error);
				},
			});
			assert.strictEqual(seen.length, 1);
			assert.strictEqual(seen[0]?.error, typed);
			assert.isFalse(seen[0]?.isDefect);
			assert.isTrue(Cause.hasFails(seen[0]?.cause ?? Cause.empty));
		}),
	);

	it.effect("tells render a die is a defect, even when the defect is an Error carrying a _tag", () =>
		Effect.gen(function* () {
			const flags: Array<boolean> = [];
			const lookalike = Object.assign(new Error("bug"), { _tag: "LooksTyped" });
			const { err } = yield* run(Effect.die(lookalike), {
				render: (error, { isDefect }) => {
					flags.push(isDefect);
					return isDefect ? `defect: ${String(error)}` : String(error);
				},
			});
			assert.deepStrictEqual(flags, [true]);
			assert.deepStrictEqual(err, ["defect: Error: bug"]);
		}),
	);

	it.effect("a cause with both a failure and a defect renders the typed failure as not a defect", () =>
		Effect.gen(function* () {
			const flags: Array<[unknown, boolean]> = [];
			const typed = new Error("typed");
			yield* run(F.pipe(new TestError("bug"), Cause.die, Cause.combine(Cause.fail(typed)), Effect.failCause), {
				render: (error, { isDefect }) => {
					flags.push([error, isDefect]);
					return String(error);
				},
			});
			assert.deepStrictEqual(flags, [[typed, false]]);
		}),
	);

	it.effect("leaves an interrupt alone", () =>
		Effect.gen(function* () {
			const { out, err, exit } = yield* run(Effect.interrupt);

			// An interrupt is not a failure to report, and the default teardown
			// already maps an interrupt-only cause to 130.
			assert.deepStrictEqual(err, []);
			assert.deepStrictEqual(out, []);
			assert.strictEqual(Exit.isFailure(exit), true);
		}),
	);

	it.effect("leaves a success untouched", () =>
		Effect.gen(function* () {
			const { out, err, exit } = yield* run(Effect.succeed(42));

			assert.strictEqual(Exit.isSuccess(exit), true);
			assert.deepStrictEqual([...out, ...err], []);
		}),
	);
});

describe("CliRuntime.reportFailures and ShowHelp", () => {
	it.effect("never renders a ShowHelp: runWith already printed help", () =>
		Effect.gen(function* () {
			const help = CliError.ShowHelp.make({ commandPath: ["tool"], errors: [] });
			const { out, err } = yield* F.pipe(help, Effect.fail, run);
			assert.deepStrictEqual(err, []);
			assert.deepStrictEqual(out, []);
		}),
	);

	it.effect("a bare-root ShowHelp (no errors) exits 0", () =>
		Effect.gen(function* () {
			const help = CliError.ShowHelp.make({ commandPath: ["tool"], errors: [] });
			const { exit } = yield* F.pipe(help, Effect.fail, run);
			assert.strictEqual(exit.pipe(failureOf, Runtime.getErrorExitCode), 0);
		}),
	);

	it.effect("a ShowHelp carrying parse errors exits with usageExitCode, default 64", () =>
		Effect.gen(function* () {
			const help = CliError.ShowHelp.make({
				commandPath: ["tool"],
				errors: [CliError.UnrecognizedOption.make({ option: "--nope", suggestions: [] })],
			});
			const { exit } = yield* F.pipe(help, Effect.fail, run);
			assert.strictEqual(exit.pipe(failureOf, Runtime.getErrorExitCode), 64);
			const custom = yield* run(Effect.fail(help), { usageExitCode: 2 });
			assert.strictEqual(custom.exit.pipe(failureOf, Runtime.getErrorExitCode), 2);
		}),
	);

	it.effect("never renders the CliExit sentinel, and keeps its code", () =>
		Effect.gen(function* () {
			const { err, exit } = yield* F.pipe(ExitRequested.make({ code: 2 }), Effect.fail, run);
			assert.deepStrictEqual(err, []);
			assert.strictEqual(exit.pipe(failureOf, Runtime.getErrorExitCode), 2);
		}),
	);

	it.effect("still renders an already-reported error that is not ShowHelp", () =>
		Effect.gen(function* () {
			const gate = CliRuntime.reported(new Error("3 schemas drifted"), 1);
			const { err } = yield* run(Effect.fail(gate));
			assert.deepStrictEqual(err, ["[FAIL] Error: 3 schemas drifted"]);
		}),
	);
});

describe("CliRuntime.reported", () => {
	/** A stand-in for the typed errors a CLI fails with (issue #717). */
	class GateError extends Data.TaggedError("GateError")<{ readonly message: string }> {
	override readonly name = "Error";

		readonly count: number;
		constructor(count: number) {
			super({ message: `gate: ${count} over budget` });
			this.count = count;
		}
	}

	it.effect("returns the same typed instance, so catchTags narrows without a cast", () =>
		Effect.gen(function* () {
			const error = new GateError(2);
			const marked = CliRuntime.reported(error, 1);

			// The overload's contract at the type level: no cast, no widening.
			const typed: GateError = marked;
			assert.strictEqual(typed, error);
			assert.strictEqual(typed.count, 2);
			assert.strictEqual(Runtime.getErrorExitCode(typed), 1);
			assert.strictEqual(Runtime.getErrorReported(typed), false);

			// The narrowing the issue exists for: the failure channel keeps the
			// tag, so catchTags compiles against it directly. If `reported` ever
			// widens to plain Error again, this line stops compiling.
			const recovered = yield* Effect.fail(CliRuntime.reported(new GateError(3), 1)).pipe(
				Effect.catchTags({ GateError: (caught) => Effect.succeed(caught.count) }),
			);
			assert.strictEqual(recovered, 3);
		}),
	);

	it("wraps a non-Error value in a plain marked Error", () => {
		const marked = CliRuntime.reported("boom", 3);
		const asError: Error = marked;
		assert.strictEqual(asError instanceof Error, true);
		assert.strictEqual(asError.message, "boom");
		assert.strictEqual(Runtime.getErrorExitCode(asError), 3);
		assert.strictEqual(Runtime.getErrorReported(asError), false);
	});

	it("defaults the exit code to 1", () => {
		assert.strictEqual(Runtime.getErrorExitCode(CliRuntime.reported(new Error("x"))), 1);
	});
});
