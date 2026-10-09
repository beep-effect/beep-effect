// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Audience, TerminalEnv } from "../../effected/env/index.ts";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Runtime from "effect/Runtime";
import * as Terminal from "effect/Terminal";
import { Command, Flag, Prompt } from "effect/cli";
import { CliInteractive, CliPrompt, CliRuntime } from "../../effected/cli/index.ts";
import type { TestTerminalHandle } from "../../effected/cli/testing.ts";
import { TestTerminal } from "../../effected/cli/testing.ts";

const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const double: Console.Console = Object.assign(Object.create(console) as Console.Console, {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { double, out, err };
};

const select = Prompt.Select({
	message: "Profile",
	choices: [
		{ title: "software-project", value: "software-project" },
		{ title: "library", value: "library" },
	],
});

/** A real command whose `--profile` flag falls back to a prompt. */
const app = (fallback: Flag.Flag<string>) =>
	Command.make("tool").pipe(
		Command.withSubcommands([
			Command.make("run", { profile: fallback }, ({ profile }) => Console.log(`profile=${profile}`)),
		]),
	);

const withPrompt = (options?: { readonly otherwise?: string }) =>
	Flag.String("profile").pipe(Flag.withFallbackPrompt(CliPrompt.fallback(select, { flag: "profile", ...options })));

const run = Effect.fn("run")(function* (root: ReturnType<typeof app>, argv: ReadonlyArray<string>, options: {
		readonly interactive: boolean | Layer.Layer<never>;
		readonly terminal: TestTerminalHandle;
		readonly gate?: boolean;
	}) {
		const { double, out, err } = capturing();
		const interactive =
			typeof options.interactive === "boolean" ? CliInteractive.layerTest(options.interactive) : options.interactive;
		const program = CliRuntime.main(Command.runWith(root, { version: "1.0.0" })(argv), {
			// The gate reads CliInteractive when it is built; CliEnv installs it for a real program.
			platform: Layer.mergeAll(NodeServices.layer, CliPrompt.gateTerminal.pipe(Layer.provide(options.terminal.layer))),
		}).pipe(
			options.gate === true ? Effect.provide(CliPrompt.gateWizard) : (self) => self,
			Effect.provide(interactive),
			Effect.exit,
			Effect.provideService(Console.Console, double),
		);
		const exit = yield* program;
		const code = Exit.isFailure(exit) ? exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode) : 0;
		return { out, err, code };
	});

describe("CliPrompt.fallback", () => {
	it.effect("interactive: the prompt runs and its answer is used (down, enter selects the second choice)", () =>
		Effect.gen(function* () {
			const terminal = yield* TestTerminal.make();
			yield* terminal.input([{ name: "down" }, { name: "enter" }]);
			const { out, code } = yield* run(app(withPrompt({ otherwise: "software-project" })), ["run"], {
				interactive: true,
				terminal,
			});
			assert.strictEqual(code, 0);
			assert.deepStrictEqual(out, ["profile=library"]);
			assert.include(yield* terminal.output, "Profile");
		}),
	);

	it.effect("a flag given on the command line never prompts", () =>
		Effect.gen(function* () {
			const terminal = yield* TestTerminal.make();
			const { out } = yield* run(app(withPrompt()), ["run", "--profile", "library"], { interactive: true, terminal });
			assert.deepStrictEqual(out, ["profile=library"]);
			assert.strictEqual(yield* terminal.output, "");
		}),
	);

	it.effect("non-interactive with `otherwise`: the default is used and the terminal is never read", () =>
		Effect.gen(function* () {
			const terminal = yield* TestTerminal.make();
			// Keys are waiting; a read would consume them.
			yield* terminal.input([{ name: "down" }, { name: "enter" }]);
			const { out, code } = yield* run(app(withPrompt({ otherwise: "software-project" })), ["run"], {
				interactive: false,
				terminal,
			});
			assert.strictEqual(code, 0);
			assert.deepStrictEqual(out, ["profile=software-project"]);
			assert.deepStrictEqual(yield* terminal.reads, { keys: 0, lines: 0, subscriptions: 0 });
			assert.strictEqual(yield* terminal.pending, 2);
			assert.strictEqual(yield* terminal.output, "");
		}),
	);

	it.effect("non-interactive without `otherwise`: core's missing-flag error, exit 64, nothing read", () =>
		Effect.gen(function* () {
			const terminal = yield* TestTerminal.make();
			yield* terminal.input([{ name: "enter" }]);
			const { out, err, code } = yield* run(app(withPrompt()), ["run"], { interactive: false, terminal });
			assert.strictEqual(code, 64);
			// Core prints the help on stdout for a usage error; the handler never ran.
			assert.isFalse(out.some((line) => line.includes("profile=")));
			assert.isTrue(
				err.some((line) => line.includes("Missing required flag: --profile")),
				err.join("\n"),
			);
			assert.deepStrictEqual(yield* terminal.reads, { keys: 0, lines: 0, subscriptions: 0 });
			assert.strictEqual(yield* terminal.pending, 1);
		}),
	);

	it.effect("Ctrl-C (input ends) in the prompt is Cancelled, exit 130, one plain line, the handler never runs", () =>
		Effect.gen(function* () {
			const terminal = yield* TestTerminal.make();
			yield* terminal.end;
			const { out, err, code } = yield* run(app(withPrompt({ otherwise: "software-project" })), ["run"], {
				interactive: true,
				terminal,
			});
			assert.strictEqual(code, 130);
			assert.deepStrictEqual(err, ["cancelled; nothing written"]);
			assert.deepStrictEqual(out, []);
		}),
	);

	it.effect(
		"control (why fallback runs the prompt itself): core's own withFallbackPrompt turns a quit into a usage error",
		() =>
			Effect.gen(function* () {
				const terminal = yield* TestTerminal.make();
				yield* terminal.end;
				const { err, code } = yield* run(app(Flag.String("profile").pipe(Flag.withFallbackPrompt(select))), ["run"], {
					interactive: true,
					terminal,
				});
				// Param.ts re-fails with the original MissingOption on QuitError, so a cancelled prompt exits 64, not 130.
				assert.strictEqual(code, 64);
				assert.isTrue(err.some((line) => line.includes("Missing required flag: --profile")));
			}),
	);

	// A prompt needs a terminal on stdin AND stdout: one alone is not enough.
	it.effect("a human with stdin NOT a TTY but stdout a TTY is non-interactive: no prompt", () =>
		Effect.gen(function* () {
			const terminal = yield* TestTerminal.make();
			yield* terminal.input([{ name: "down" }, { name: "enter" }]);
			const detected = CliInteractive.layer.pipe(
				Layer.provide(
					Layer.mergeAll(
						Audience.layerTest("human"),
						TerminalEnv.layerTest({ stdinIsTerminal: false, stdout: { isTerminal: true } }),
					),
				),
			);
			const { out, code } = yield* run(app(withPrompt({ otherwise: "software-project" })), ["run"], {
				interactive: detected,
				terminal,
			});
			assert.strictEqual(code, 0);
			assert.deepStrictEqual(out, ["profile=software-project"]);
			assert.deepStrictEqual(yield* terminal.reads, { keys: 0, lines: 0, subscriptions: 0 });
			assert.strictEqual(yield* terminal.output, "");
		}),
	);
});

describe("CliPrompt.fallback otherwise", () => {
	it.effect("`{ otherwise: undefined }` counts as not given", () =>
		Effect.gen(function* () {
			const terminal = yield* TestTerminal.make();
			const { code } = yield* run(
				app(
					Flag.String("profile").pipe(
						Flag.withFallbackPrompt(CliPrompt.fallback(select, { flag: "profile", otherwise: undefined as never })),
					),
				),
				["run"],
				{ interactive: false, terminal },
			);
			assert.strictEqual(code, 64);
		}),
	);
});

describe("CliPrompt.gateTerminal", () => {
	const gated = (interactive: boolean, terminal: TestTerminalHandle) =>
		Terminal.Terminal.pipe(
			Effect.provide(CliPrompt.gateTerminal.pipe(Layer.provide(terminal.layer))),
			Effect.provide(CliInteractive.layerTest(interactive)),
		);

	it.effect("non-interactive: a quiet terminal that never touches the real one, but keeps its size", () =>
		Effect.gen(function* () {
			const real = yield* TestTerminal.make({ columns: 120, rows: 40 });
			yield* real.input([{ name: "enter" }]);
			const terminal = yield* gated(false, real);
			assert.strictEqual(yield* terminal.columns, 120);
			assert.strictEqual(yield* terminal.rows, 40);
			// The input is an already-ended queue: a prompt reading it is quit, and no key of the real one is taken.
			const exit = yield* Effect.flatMap(terminal.readInput, (queue) => Queue.take(queue)).pipe(Effect.scoped, Effect.exit);
			assert.isTrue(Exit.isFailure(exit));
			const line = yield* Effect.exit(terminal.readLine);
			assert.isTrue(Exit.isFailure(line));
			yield* terminal.display("never shown");
			assert.strictEqual(yield* real.output, "");
			assert.deepStrictEqual(yield* real.reads, { keys: 0, lines: 0, subscriptions: 0 });
			assert.strictEqual(yield* real.pending, 1);
		}),
	);

	it.effect("decides per call, so a scope that narrows or widens CliInteractive later still gates it", () =>
		Effect.gen(function* () {
			const real = yield* TestTerminal.make();
			yield* real.input([{ name: "enter" }]);
			// Built where CliInteractive is true; the decision is made when each call runs, not here.
			const terminal = yield* gated(true, real);
			const take = Effect.scoped(Effect.flatMap(terminal.readInput, (queue) => Queue.take(queue)));
			const quiet = yield* Effect.exit(take.pipe(Effect.provideService(CliInteractive, false)));
			assert.isTrue(Exit.isFailure(quiet));
			assert.deepStrictEqual(yield* real.reads, { keys: 0, lines: 0, subscriptions: 0 });
			const key = yield* take.pipe(Effect.provideService(CliInteractive, true));
			assert.strictEqual(key.key.name, "enter");
			assert.deepStrictEqual(yield* real.reads, { keys: 1, lines: 0, subscriptions: 1 });
		}),
	);

	it.effect("interactive: the real terminal passes through untouched", () =>
		Effect.gen(function* () {
			const real = yield* TestTerminal.make();
			yield* real.input([{ name: "enter" }]);
			const terminal = yield* gated(true, real);
			const interactive = Effect.provideService(CliInteractive, true);
			const key = yield* Effect.scoped(Effect.flatMap(terminal.readInput, (queue) => Queue.take(queue))).pipe(
				interactive,
			);
			assert.strictEqual(key.key.name, "enter");
			yield* terminal.display("shown").pipe(interactive);
			assert.strictEqual(yield* real.output, "shown");
			assert.deepStrictEqual(yield* real.reads, { keys: 1, lines: 0, subscriptions: 1 });
		}),
	);
});

describe("CliPrompt.gateWizard", () => {
	const root = app(withPrompt({ otherwise: "software-project" }));

	it.effect("non-interactive: --wizard is an unknown flag, a usage error (64), and is absent from --help", () =>
		Effect.gen(function* () {
			const terminal = yield* TestTerminal.make();
			const wizard = yield* run(root, ["--wizard", "run"], { interactive: false, terminal, gate: true });
			assert.strictEqual(wizard.code, 64);
			assert.isTrue(
				wizard.err.some((line) => line.includes("wizard")),
				wizard.err.join("\n"),
			);
			const help = yield* run(root, ["--help"], { interactive: false, terminal, gate: true });
			assert.strictEqual(help.code, 0);
			assert.isFalse(help.out.some((line) => line.includes("--wizard")));
		}),
	);

	it.effect("interactive: --wizard stays in --help", () =>
		Effect.gen(function* () {
			const terminal = yield* TestTerminal.make();
			const help = yield* run(root, ["--help"], { interactive: true, terminal, gate: true });
			assert.isTrue(help.out.some((line) => line.includes("--wizard")));
		}),
	);

	it.effect("control: without the gate, --wizard is in --help even when non-interactive", () =>
		Effect.gen(function* () {
			const terminal = yield* TestTerminal.make();
			const help = yield* run(root, ["--help"], { interactive: false, terminal });
			assert.isTrue(help.out.some((line) => line.includes("--wizard")));
		}),
	);
});
