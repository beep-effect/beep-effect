// @effect-diagnostics strictEffectProvide:skip-file
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Runtime from "effect/Runtime";
import { CliError, CliOutput, Command, Flag } from "effect/cli";
import { CliRuntime } from "../../effected/cli/index.ts";

const sub = Command.make("sub", { count: Flag.Int("count").pipe(Flag.withDefault(1)) }, ({ count }) =>
	Console.log(JSON.stringify({ count })),
);
const app = Command.make("app").pipe(Command.withSubcommands([sub]));
const HELP_MARK = "USAGE";

/** A console double recording each stream, and every call in one shared sequence so order ACROSS streams is visible. */
const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const seq: Array<readonly ["out" | "err", string]> = [];
	const record = (stream: "out" | "err", line: string) => {
		(stream === "out" ? out : err).push(line);
		seq.push([stream, line]);
	};
	const double: Console.Console = Object.assign(Object.create(console) as Console.Console, {
		log: (...args: ReadonlyArray<unknown>) => record("out", args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => record("err", args.map(String).join(" ")),
		warn: (...args: ReadonlyArray<unknown>) => record("err", `warn:${args.map(String).join(" ")}`),
	});
	return { double, out, err, seq };
};

const codeOf = (exit: Exit.Exit<unknown, unknown>): number =>
	Exit.isFailure(exit) ? exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode) : 0;

const run = Effect.fn("run")(function* (args: ReadonlyArray<string>, helpOnUsageError?: "stdout" | "stderr", platform: Layer.Layer<NodeServices.NodeServices> = NodeServices.layer) {
		const { double, out, err } = capturing();
		const exit = yield* CliRuntime.main(Command.runWith(app, { version: "1.0.0" })(args), {
			platform,
			...(helpOnUsageError === undefined ? {} : { helpOnUsageError }),
		}).pipe(Effect.exit, Effect.provideService(Console.Console, double));
		return { out, err, code: codeOf(exit) };
	});

const helpIn = (lines: ReadonlyArray<string>): boolean => lines.some((line) => line.includes(HELP_MARK));

describe("CliRuntime.main helpOnUsageError", () => {
	describe('"stderr"', () => {
		for (const [label, args] of [
			["--help", ["--help"]],
			["sub --help", ["sub", "--help"]],
			["a bare group invocation", []],
		] as const) {
			it.effect(`${label}: help stays on stdout, stderr empty, exit 0`, () =>
				Effect.gen(function* () {
					const { out, err, code } = yield* run(args, "stderr");
					assert.isTrue(helpIn(out), out.join("\n"));
					assert.deepStrictEqual(err, []);
					assert.strictEqual(code, 0);
				}),
			);
		}

		for (const [label, args] of [
			["an unknown flag", ["sub", "--nope"]],
			["a bad value", ["sub", "--count", "abc"]],
			["an unknown subcommand", ["bogus"]],
		] as const) {
			it.effect(`${label}: help and errors both on stderr, help first, stdout empty, exit 64`, () =>
				Effect.gen(function* () {
					const { out, err, code } = yield* run(args, "stderr");
					assert.deepStrictEqual(out, []);
					assert.isTrue(helpIn(err));
					assert.isFalse(helpIn(err.slice(1)), "help comes first, the errors after it");
					assert.isAbove(err.length, 1);
					assert.strictEqual(code, 64);
				}),
			);
		}

		it.effect("a normal run writes its own stdout untouched", () =>
			Effect.gen(function* () {
				const { out, err, code } = yield* run(["sub", "--count", "3"], "stderr");
				assert.deepStrictEqual(out, ['{"count":3}']);
				assert.deepStrictEqual(err, []);
				assert.strictEqual(code, 0);
			}),
		);

		it.effect("sees a Formatter provided through platform", () =>
			Effect.gen(function* () {
				const marked = Layer.succeed(CliOutput.Formatter, {
					...CliOutput.defaultFormatter({ colors: false }),
					formatHelpDoc: () => "CUSTOM HELP",
				});
				const { out, err } = yield* run(["sub", "--nope"], "stderr", Layer.merge(NodeServices.layer, marked));
				assert.deepStrictEqual(out, []);
				assert.strictEqual(err[0], "CUSTOM HELP");
			}),
		);
	});

	describe('"stdout" (the default): core behaviour, the control', () => {
		for (const [label, args] of [
			["--help", ["--help"]],
			["sub --help", ["sub", "--help"]],
			["a bare group invocation", []],
			["an unknown flag", ["sub", "--nope"]],
			["a bad value", ["sub", "--count", "abc"]],
			["an unknown subcommand", ["bogus"]],
		] as const) {
			it.effect(`${label}: help on stdout`, () =>
				Effect.gen(function* () {
					const { out, err } = yield* run(args);
					assert.isTrue(helpIn(out));
					assert.isFalse(helpIn(err));
				}),
			);
		}

		it.effect("explicit stdout matches the default", () =>
			Effect.gen(function* () {
				const { out } = yield* run(["sub", "--nope"], "stdout");
				assert.isTrue(helpIn(out));
			}),
		);
	});

	it.effect("under renderErrors: false, help stays on stdout (documented caveat)", () =>
		Effect.gen(function* () {
			const { double, out, err } = capturing();
			yield* CliRuntime.main(Command.runWith(app, { version: "1.0.0", renderErrors: false })(["sub", "--nope"]), {
				platform: NodeServices.layer,
				helpOnUsageError: "stderr",
			}).pipe(Effect.exit, Effect.provideService(Console.Console, double));
			assert.isTrue(helpIn(out));
			assert.isFalse(helpIn(err));
		}),
	);

	it.effect("a Formatter provided inside the program bypasses the routing (documented caveat)", () =>
		Effect.gen(function* () {
			const { double, out } = capturing();
			const program = Command.runWith(app, { version: "1.0.0" })(["sub", "--nope"]).pipe(
				Effect.provide(CliOutput.layer(CliOutput.defaultFormatter({ colors: false }))),
			);
			yield* CliRuntime.main(program, { platform: NodeServices.layer, helpOnUsageError: "stderr" }).pipe(
				Effect.exit,
				Effect.provideService(Console.Console, double),
			);
			assert.isTrue(helpIn(out));
		}),
	);

	describe("held help, driven directly (order across both streams)", () => {
		/** Run `body` under main with routing on; `help`/`errors` are strings the recording Formatter produced. */
		const drive = (
			body: (text: { readonly help: string; readonly errors: string }) => Effect.Effect<void>,
		): Effect.Effect<ReadonlyArray<readonly ["out" | "err", string]>> =>
			Effect.gen(function* () {
				const { double, seq } = capturing();
				const program = Effect.gen(function* () {
					const formatter = yield* CliOutput.Formatter;
					const help = formatter.formatHelpDoc({ description: "", usage: "USAGE x", flags: [], args: [] } as never);
					const errors = formatter.formatErrors([CliError.UserError.make({ cause: "bad flag" })]);
					yield* body({ help, errors });
				});
				yield* CliRuntime.main(program, { platform: NodeServices.layer, helpOnUsageError: "stderr" }).pipe(
					Effect.exit,
					Effect.provideService(Console.Console, double),
				);
				return seq;
			});

		it.effect("help then its recorded errors: both on stderr, help first", () =>
			Effect.gen(function* () {
				let text = { help: "", errors: "" };
				const seq = yield* drive((t) => {
					text = t;
					return Effect.andThen(Console.log(t.help), Console.error(t.errors));
				});
				assert.deepStrictEqual(seq, [
					["err", text.help],
					["err", text.errors],
				]);
			}),
		);

		it.effect("help then another console method: help is released to stdout FIRST", () =>
			Effect.gen(function* () {
				let help = "";
				const seq = yield* drive((t) => {
					help = t.help;
					return Console.log(t.help).pipe(Effect.andThen(Console.warn("after")), Effect.andThen(Console.log("plain")));
				});
				assert.deepStrictEqual(seq, [
					["out", help],
					["err", "warn:after"],
					["out", "plain"],
				]);
			}),
		);

		it.effect("help then an unrelated error(): help stays on stdout, ahead of the error", () =>
			Effect.gen(function* () {
				let help = "";
				const seq = yield* drive((t) => {
					help = t.help;
					return Effect.andThen(Console.log(t.help), Console.error("something else broke"));
				});
				assert.deepStrictEqual(seq, [
					["out", help],
					["err", "something else broke"],
				]);
			}),
		);

		it.effect("only recorded help is held: a plain log before recorded errors stays on stdout", () =>
			Effect.gen(function* () {
				let errors = "";
				const seq = yield* drive((t) => {
					errors = t.errors;
					return Effect.andThen(Console.log("plain line"), Console.error(t.errors));
				});
				assert.deepStrictEqual(seq, [
					["out", "plain line"],
					["err", errors],
				]);
			}),
		);

		it.effect("help at the very end of the program is released to stdout", () =>
			Effect.gen(function* () {
				let help = "";
				const seq = yield* drive((t) => {
					help = t.help;
					return Console.log(t.help);
				});
				assert.deepStrictEqual(seq, [["out", help]]);
			}),
		);
	});
});
