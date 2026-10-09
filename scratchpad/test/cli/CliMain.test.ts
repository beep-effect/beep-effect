import { Data } from "effect";
import { Schema } from "effect";
import { Result } from "effect";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Cause, Console, Context, Effect, Exit, Layer, MutableRef, Runtime } from "effect";
import { CliError, Command } from "effect/cli";
import { CliExit, CliRuntime } from "../../effected/cli/index.ts";

const Json = Schema.fromJsonString(Schema.Unknown);

class TestError extends Data.TaggedError("TestError")<{ readonly message: string; readonly cause?: unknown }> {
	override readonly name = "Error";
	constructor(message: string, options?: { readonly cause?: unknown }) { super({ message, ...options }); }
}

class Platform extends Context.Service<Platform, { readonly name: string }>()("@beep/scratchpad/test/cli/CliMain.test/Platform") {}

const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const double: Console.Console = Object.assign(Object.create(console) as Console.Console, {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { double, out, err };
};

const codeOf = <A>(exit: Exit.Exit<A, unknown>): number | undefined =>
	Exit.isFailure(exit) ? Runtime.getErrorExitCode(Cause.squash(exit.cause)) : undefined;

describe("CliRuntime.main", () => {
	it.effect("a program that succeeds with no findings succeeds", () =>
		Effect.gen(function* () {
			const { double } = capturing();
			const exit = yield* CliRuntime.main(Effect.void, { platform: Layer.empty }).pipe(
				Effect.exit,
				Effect.provideService(Console.Console, double),
			);
			assert.isTrue(Exit.isSuccess(exit));
		}),
	);

	it.effect("findings exit non-zero and finalizers still run", () =>
		Effect.gen(function* () {
			const { double, err } = capturing();
			let finalized = false;
			const program = Effect.gen(function* () {
				yield* Effect.addFinalizer(() =>
					Effect.sync(() => {
						finalized = true;
					}),
				);
				yield* CliExit.set(1);
			}).pipe(Effect.scoped);
			const exit = yield* CliRuntime.main(program, { platform: Layer.empty }).pipe(
				Effect.exit,
				Effect.provideService(Console.Console, double),
			);
			assert.strictEqual(codeOf(exit), 1);
			assert.isTrue(finalized);
			assert.deepStrictEqual(err, [], "the findings sentinel is never rendered");
			// The sentinel carries the no-double-report mark (false SUPPRESSES), so
			// the runtime stays quiet, and the teardown turns it into exit 1.
			assert.isTrue(Exit.isFailure(exit));
			if (Exit.isFailure(exit)) {
				assert.strictEqual(Runtime.getErrorReported(Cause.squash(exit.cause)), false);
			}
			const codes: number[] = [];
			Runtime.defaultTeardown(exit, (code) => codes.push(code));
			assert.deepStrictEqual(codes, [1]);
		}),
	);

	it.effect("a platform layer that fails to build renders one line on stderr with the fallback code", () =>
		Effect.gen(function* () {
			const { double, out, err } = capturing();
			const broken = Layer.effect(Platform, Effect.fail(new TestError("HOME is not set")));
			const program = Effect.asVoid(Platform);
			const exit = yield* CliRuntime.main(program, { platform: broken, exitCode: 3 }).pipe(
				Effect.exit,
				Effect.provideService(Console.Console, double),
			);
			assert.strictEqual(codeOf(exit), 3);
			// A defect: the status line first, then its cleaned stack.
			assert.strictEqual(err[0], "[FAIL] Error: HOME is not set");
			assert.deepStrictEqual(out, []);
		}),
	);

	it.effect("the default logger is installed outermost: a failure lands on stderr", () =>
		Effect.gen(function* () {
			const { double, out, err } = capturing();
			yield* CliRuntime.main(Effect.fail(new TestError("boom")), { platform: Layer.empty }).pipe(
				Effect.exit,
				Effect.provideService(Console.Console, double),
			);
			assert.deepStrictEqual(err, ["[FAIL] Error: boom"]);
			assert.deepStrictEqual(out, []);
		}),
	);

	for (const bad of [256, 1.5]) {
		it.effect(`validates a code written to the CliExit cell directly (${bad})`, () =>
			Effect.gen(function* () {
				const { double, out, err } = capturing();
				const program = Effect.gen(function* () {
					const cell = yield* CliExit;
					MutableRef.set(cell.code, bad);
				});
				const exit = yield* CliRuntime.main(program, { platform: Layer.empty }).pipe(
					Effect.exit,
					Effect.provideService(Console.Console, double),
				);
				// A bad code is a wiring defect: rendered once, exit 1 — never a
				// silent 0 (256 wraps to 0 under POSIX) or a process.exit throw (1.5).
				assert.strictEqual(codeOf(exit), 1);
				assert.strictEqual(
					err[0],
					`[FAIL] Error: CliRuntime.main: CliExit code must be an integer 0..255, received ${bad}`,
				);
				assert.deepStrictEqual(out, []);
			}),
		);
	}

	it.effect("a program failure beats findings: its own code wins", () =>
		Effect.gen(function* () {
			const { double } = capturing();
			const program = Effect.gen(function* () {
				yield* CliExit.set(2);
				return yield* new TestError("boom");
			});
			const exit = yield* CliRuntime.main(program, { platform: Layer.empty, exitCode: 5 }).pipe(
				Effect.exit,
				Effect.provideService(Console.Console, double),
			);
			assert.strictEqual(codeOf(exit), 5);
		}),
	);
});

describe("CliRuntime.main and a UserError raised through Command.runWith", () => {
	// A handler that fails with CliError.UserError. runWith renders it through
	// the CliOutput formatter itself, then re-fails with it.
	const deploy = Command.make("deploy", {}, () =>
		Effect.fail(CliError.UserError.make({ cause: "unknown target: moon", userMessage: "unknown target: moon" })),
	);

	it.effect("reports it exactly once, and exits with the usage code 64", () =>
		Effect.gen(function* () {
			const { double, out, err } = capturing();
			const exit = yield* CliRuntime.main(Command.runWith(deploy, { version: "1.0.0" })([]), {
				platform: NodeServices.layer,
			}).pipe(Effect.exit, Effect.provideService(Console.Console, double));
			assert.strictEqual(err.length, 1, `expected one stderr entry, got ${Result.getOrThrow(Schema.encodeUnknownResult(Json)(err))}`);
			assert.include(err[0], "unknown target: moon");
			assert.deepStrictEqual(out, []);
			assert.strictEqual(codeOf(exit), 64);
			const custom = yield* CliRuntime.main(Command.runWith(deploy, { version: "1.0.0" })([]), {
				platform: NodeServices.layer,
				usageExitCode: 2,
			}).pipe(Effect.exit, Effect.provideService(Console.Console, capturing().double));
			assert.strictEqual(codeOf(custom), 2);
		}),
	);

	it.effect("with renderErrors: false runWith prints nothing, so reportFailures renders it once", () =>
		Effect.gen(function* () {
			const { double, err } = capturing();
			const exit = yield* CliRuntime.main(Command.runWith(deploy, { version: "1.0.0", renderErrors: false })([]), {
				platform: NodeServices.layer,
			}).pipe(Effect.exit, Effect.provideService(Console.Console, double));
			assert.strictEqual(err.length, 1, `expected one stderr entry, got ${Result.getOrThrow(Schema.encodeUnknownResult(Json)(err))}`);
			// Rendered here like any other failure, so it takes the fallback exit
			// code, not the usage code.
			assert.strictEqual(codeOf(exit), 1);
		}),
	);

	it.effect("a plain UserError carries no exit-code mark of its own", () =>
		Effect.sync(() => {
			// The usage-code fallback below relies on this: were core ever to mark
			// a UserError with a code, chooseExitCode would keep that instead.
			assert.isFalse(Runtime.errorExitCode in CliError.UserError.make({ cause: "x" }));
		}),
	);

	it.effect("a UserError marked with an explicit exit code keeps it, and is printed once", () =>
		Effect.gen(function* () {
			const marked = Command.make("deploy", {}, () =>
				Effect.fail(CliRuntime.reported(CliError.UserError.make({ cause: "x" }), 3)),
			);
			const { double, err } = capturing();
			const exit = yield* CliRuntime.main(Command.runWith(marked, { version: "1.0.0" })([]), {
				platform: NodeServices.layer,
			}).pipe(Effect.exit, Effect.provideService(Console.Console, double));
			assert.strictEqual(err.length, 1, `expected one stderr entry, got ${Result.getOrThrow(Schema.encodeUnknownResult(Json)(err))}`);
			assert.strictEqual(codeOf(exit), 3);
		}),
	);
});

describe("CliRuntime.main and --log-level", () => {
	// Core's --log-level flag sets MinimumLogLevel for the command program. Effect filters a log
	// record against MinimumLogLevel BEFORE any logger runs, so a flag value of `none` silences every Effect.log*
	// call made inside the handler. The failure report is written by reportFailures AFTER the handler's scope
	// has closed, so it must still reach stderr, and the exit code must still be right.
	const boom = Command.make("boom", {}, () => Effect.fail(new TestError("boom")));
	const app = Command.make("tool").pipe(Command.withSubcommands([boom]));

	for (const level of ["none", "all", "debug"]) {
		it.effect(
			`--log-level ${level}: a failing command still reports its failure on stderr with the right exit code`,
			() =>
				Effect.gen(function* () {
					const { double, out, err } = capturing();
					const exit = yield* CliRuntime.main(
						Command.runWith(app, { version: "1.0.0" })(["--log-level", level, "boom"]),
						{
							platform: NodeServices.layer,
						},
					).pipe(Effect.exit, Effect.provideService(Console.Console, double));
					assert.deepStrictEqual(err, ["[FAIL] Error: boom"]);
					assert.deepStrictEqual(out, []);
					assert.strictEqual(codeOf(exit), 1);
				}),
		);
	}

	// The positive control for the tests above: the flag really does silence logging INSIDE the handler, so the
	// failure report surviving is the runtime's doing and not a flag that never took effect.
	it.effect("control: --log-level none silences Effect.logError inside the handler, --log-level error does not", () => Effect.gen(function* () {
			const noisy = Command.make("noisy", {}, () => Effect.logError("inside"));
			const root = Command.make("tool").pipe(Command.withSubcommands([noisy]));
			const run = Effect.fn("run")(function* (level: string) {
					const { double, err } = capturing();
					yield* CliRuntime.main(Command.runWith(root, { version: "1.0.0" })(["--log-level", level, "noisy"]), {
						platform: NodeServices.layer,
					}).pipe(Effect.exit, Effect.provideService(Console.Console, double));
					return err;
				});
			assert.deepStrictEqual(yield* run("none"), []);
			assert.deepStrictEqual(yield* run("error"), ["inside"]);
		}),
	);
});
