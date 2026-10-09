// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import * as S from "effect/Schema";
import * as Result from "effect/Result";
// The audience flag must be known BEFORE core parses, because a fallback prompt fires during the parse: core parses
// the root flags into a local context (Command.ts:922-925) and only wraps the subcommand HANDLER with what
// `provideEffect` resolves (Command.ts:941), so the prompt in `sub.parse` (Param.ts:1478-1485) cannot see them.
// `CliAudience.run` / `runWith` scan argv first and provide the answer around the whole run.
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Audience, TerminalEnv } from "../../effected/env/index.ts";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Runtime from "effect/Runtime";
import { CliConfig, Command, Flag, GlobalFlag, Prompt } from "effect/cli";
import { CliAudience, CliInteractive, CliPrompt, CliRuntime } from "../../effected/cli/index.ts";
import { TestTerminal } from "../../effected/cli/testing.ts";

const Json = S.fromJsonString(S.Unknown);

const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const double: Console.Console = Object.assign(Object.create(console) as Console.Console, {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { double, out, err };
};

const profile = Flag.String("profile").pipe(
	Flag.withFallbackPrompt(
		CliPrompt.fallback(
			Prompt.Select({
				message: "Profile",
				choices: [
					{ title: "x", value: "x" },
					{ title: "library", value: "library" },
				],
			}),
			{ flag: "profile", otherwise: "x" },
		),
	),
);

const init = Command.make("init", { profile }, ({ profile }) =>
	Effect.gen(function* () {
		const audience = yield* Audience;
		yield* Console.log(`profile=${profile} audience=${audience.kind}/${audience.source}`);
	}),
);
// The one wiring: share the flags, and hand the root to CliAudience.run / runWith, which apply `provide` themselves.
const root = Command.make("tool").pipe(Command.withSharedFlags(CliAudience.flags()), Command.withSubcommands([init]));

/** A human on a terminal (interactive), with keys waiting that "down, enter" would answer the prompt with. */
const run = Effect.fn("run")(function* (argv: ReadonlyArray<string>, via: "runWith" | "core" = "runWith", gateWizard: boolean = false) {
		const terminal = yield* TestTerminal.make();
		yield* terminal.input([{ name: "down" }, { name: "enter" }]);
		const { double, out, err } = capturing();
		const program =
			via === "runWith"
				? CliAudience.runWith(root, { version: "1.0.0" })(argv)
				: Command.runWith(CliAudience.provide(root), { version: "1.0.0" })(argv);
		const exit = yield* CliRuntime.main(program, {
			platform: Layer.mergeAll(NodeServices.layer, CliPrompt.gateTerminal.pipe(Layer.provide(terminal.layer))),
		}).pipe(
			Effect.exit,
			Effect.provideService(Console.Console, double),
			gateWizard ? Effect.provide(CliPrompt.gateWizard) : (self) => self,
			Effect.provide(CliInteractive.layerTest(true)),
			Effect.provide(Audience.layerTest("human", "detected")),
		);
		const code = Exit.isFailure(exit) ? exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode) : 0;
		return { out, err, code, reads: yield* terminal.reads };
	});

const QUIET = { keys: 0, lines: 0, subscriptions: 0 };

describe("CliAudience.runWith resolves the audience flag before parsing", () => {
	it.effect("no flag: the human on a terminal is prompted", () =>
		Effect.gen(function* () {
			const { out, reads } = yield* run(["init"]);
			assert.deepStrictEqual(out, ["profile=library audience=human/detected"]);
			assert.deepStrictEqual(reads.keys, 2);
			assert.isAtLeast(reads.subscriptions, 1);
		}),
	);

	for (const [label, argv, audience] of [
		["--agent before the subcommand", ["--agent", "init"], "agent"],
		["--ci before the subcommand", ["--ci", "init"], "ci"],
		["--agent after the subcommand", ["init", "--agent"], "agent"],
		["--audience agent", ["--audience", "agent", "init"], "agent"],
		["--audience=ci", ["--audience=ci", "init"], "ci"],
	] as const) {
		it.effect(`${label}: no prompt, the fallback default is used, the terminal is never touched`, () =>
			Effect.gen(function* () {
				const { out, code, reads } = yield* run(argv);
				assert.strictEqual(code, 0);
				assert.deepStrictEqual(out, [`profile=x audience=${audience}/flag`]);
				assert.deepStrictEqual(reads, QUIET);
			}),
		);
	}

	it.effect("--no-agent and --agent=false are not given: the prompt still fires", () =>
		Effect.gen(function* () {
			for (const argv of [
				["--no-agent", "init"],
				["--agent=false", "init"],
				["--agent", "false", "init"],
			]) {
				const { out, reads } = yield* run(argv);
				assert.deepStrictEqual(out, ["profile=library audience=human/detected"], argv.join(" "));
				assert.deepStrictEqual(reads.keys, 2);
			}
		}),
	);

	it.effect("--human on an interactive run still prompts, and the audience is the flag's", () =>
		Effect.gen(function* () {
			const { out } = yield* run(["--human", "init"]);
			assert.deepStrictEqual(out, ["profile=library audience=human/flag"]);
		}),
	);

	it.effect("--agent --ci: exit 64 from core's own resolver, and no prompt", () =>
		Effect.gen(function* () {
			const { out, err, code, reads } = yield* run(["--agent", "--ci", "init"]);
			assert.strictEqual(code, 64);
			assert.isFalse(out.some((line) => line.startsWith("profile=")));
			assert.isTrue(err.some((line) => line.includes("Give at most one of --audience, --human, --agent, --ci")));
			assert.deepStrictEqual(reads, QUIET);
		}),
	);

	it.effect("control: core's own runWith lets the prompt fire under --agent (the parse-order gap)", () =>
		Effect.gen(function* () {
			const { out, reads } = yield* run(["--agent", "init"], "core");
			// The fallback ran before the flag was visible, so the terminal was read.
			assert.deepStrictEqual(out, ["profile=library audience=agent/flag"]);
			assert.deepStrictEqual(reads.keys, 2);
		}),
	);

	// `gateWizard` decides from the audience DETECTED at build time, before the flag is read, so on a human terminal
	// `--agent --wizard` used to run core's wizard (ANSI on stdout, exit 0) for a run that did nothing.
	it.effect("--agent --wizard on a human terminal is an unrecognised flag (64), never the wizard", () =>
		Effect.gen(function* () {
			const { out, err, code } = yield* run(["--agent", "--wizard", "init"], "runWith", true);
			assert.strictEqual(code, 64);
			assert.isTrue(
				err.some((line) => line.includes("wizard")),
				err.join("\n"),
			);
			assert.isFalse(
				out.some((line) => /wizard/i.test(line) && !line.includes("--wizard")),
				"no wizard output",
			);
		}),
	);

	// Without `provide` the conflict check used to be skipped silently: `--agent --ci` ran the handler, exit 0.
	it.effect("runWith applies provide itself: --agent --ci exits 64 with no explicit provide on the root", () =>
		Effect.gen(function* () {
			const { code, out } = yield* run(["--agent", "--ci", "init"]);
			assert.strictEqual(code, 64);
			assert.isFalse(out.some((line) => line.startsWith("profile=")));
		}),
	);

	it("a root without the shared audience flags is a compile error", () => {
		const bare = Command.make("tool").pipe(Command.withSubcommands([Command.make("x", {}, () => Effect.void)]));
		// @ts-expect-error the root must carry the four flags (Command.withSharedFlags(CliAudience.flags()))
		const program = CliAudience.runWith(bare, { version: "1.0.0" });
		assert.isDefined(program);
	});
});

// A flag that names the audience decides interactivity from the TTY facts, so `--human` can widen it: a human who runs a
// tool inside an agent (detected `agent`) on a real terminal gets the human experience back, and a pipe still cannot
// prompt. Only the audience input changes; the TTY requirement does not.
describe("CliAudience: a flag decides CliInteractive from the TTY facts", () => {
	interface Facts {
		/** The audience the environment detected, before any flag. */
		readonly detected: "human" | "agent" | "ci";
		readonly stdin: boolean;
		readonly stdout: boolean;
		/** What `CliInteractive` was built as from the detected audience and the TTYs. */
		readonly ambient: boolean;
	}

	const probe = Command.make("probe", {}, () =>
		Effect.gen(function* () {
			const audience = yield* Audience;
			yield* Console.log(`interactive=${yield* CliInteractive} audience=${audience.kind}/${audience.source}`);
		}),
	);
	const both = Command.make("tool").pipe(
		Command.withSharedFlags(CliAudience.flags()),
		Command.withSubcommands([init, probe]),
	);

	interface RunUnderOptions {
		/** Through `CliAudience.runWith` (the default) or core's `Command.runWith` over `CliAudience.provide`. */
		readonly via?: "runWith" | "core";
		/** Provide `CliPrompt.gateWizard`. */
		readonly gateWizard?: boolean;
		/** End the terminal's input, so core's wizard quits instead of waiting. */
		readonly endInput?: boolean;
		/** A consumer's own `builtIns`, provided under the gate. */
		readonly builtIns?: ReadonlyArray<GlobalFlag.BuiltIn>;
		/** A consumer's `builtIns`, provided inside the gate, around the program. */
		readonly innerBuiltIns?: ReadonlyArray<GlobalFlag.BuiltIn>;
		/** The environment, fixed, never the host's: `TERM` decides interactivity on two terminals. */
		readonly env?: Record<string, string>;
	}

	const runUnder = Effect.fn("runUnder")(function* (facts: Facts, argv: ReadonlyArray<string>, options: RunUnderOptions = {}) {
			const { via = "runWith", gateWizard = false, endInput = false, builtIns, innerBuiltIns, env = {} } = options;
			const terminal = yield* TestTerminal.make();
			yield* terminal.input([{ name: "down" }, { name: "enter" }]);
			// Core's wizard keeps reading until the input ends; ending it quits the wizard instead of hanging.
			if (endInput) yield* terminal.end;
			const { double, out, err } = capturing();
			const program =
				via === "runWith"
					? CliAudience.runWith(both, { version: "1.0.0" })(argv)
					: Command.runWith(CliAudience.provide(both), { version: "1.0.0" })(argv);
			// A consumer's config provided INSIDE the gate, around the program: the gate never saw it.
			const inner =
				innerBuiltIns === undefined ? program : Effect.provide(program, CliConfig.layer({ builtIns: innerBuiltIns }));
			const exit = yield* CliRuntime.main(inner, {
				platform: Layer.mergeAll(NodeServices.layer, CliPrompt.gateTerminal.pipe(Layer.provide(terminal.layer))),
			}).pipe(
				Effect.exit,
				Effect.provideService(Console.Console, double),
				gateWizard ? Effect.provide(CliPrompt.gateWizard) : (self) => self,
				// The consumer's own config, provided under the gate: it filters whatever `builtIns` it finds.
				builtIns === undefined ? (self) => self : Effect.provide(CliConfig.layer({ builtIns })),
				Effect.provide(CliInteractive.layerTest(facts.ambient)),
				Effect.provide(TerminalEnv.layerTest({ stdinIsTerminal: facts.stdin, stdout: { isTerminal: facts.stdout } })),
				Effect.provide(Audience.layerTest(facts.detected, "detected")),
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
			);
			const code = Exit.isFailure(exit) ? exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode) : 0;
			return { out, err, code, reads: yield* terminal.reads };
		});

	// Detected as an agent on real TTYs (a human running `! tool` inside Claude Code): ambient interactivity is off.
	const agentOnTtys: Facts = { detected: "agent", stdin: true, stdout: true, ambient: false };

	it.effect("--human on real TTYs widens a detected agent: the prompt runs", () =>
		Effect.gen(function* () {
			const { out, reads, code } = yield* runUnder(agentOnTtys, ["--human", "init"]);
			assert.strictEqual(code, 0);
			assert.deepStrictEqual(out, ["profile=library audience=human/flag"]);
			assert.strictEqual(reads.keys, 2, "the prompt read the terminal");
		}),
	);

	it.effect("--human still cannot prompt without a terminal on stdin, or on stdout", () =>
		Effect.gen(function* () {
			for (const facts of [
				{ ...agentOnTtys, stdin: false },
				{ ...agentOnTtys, stdout: false },
				{ ...agentOnTtys, stdin: false, stdout: false },
			]) {
				const { out, reads } = yield* runUnder(facts, ["--human", "init"]);
				assert.deepStrictEqual(out, ["profile=x audience=human/flag"], Result.getOrThrow(S.encodeUnknownResult(Json)(facts)));
				assert.deepStrictEqual(reads, QUIET, Result.getOrThrow(S.encodeUnknownResult(Json)(facts)));
			}
		}),
	);

	it.effect("--human cannot prompt on a TERM=dumb terminal, through runWith and through a bare provide", () =>
		Effect.gen(function* () {
			for (const via of ["runWith", "core"] as const) {
				const dumb = yield* runUnder(agentOnTtys, ["--human", "probe"], { via, env: { TERM: "dumb" } });
				assert.deepStrictEqual(dumb.out, ["interactive=false audience=human/flag"], via);
				const real = yield* runUnder(agentOnTtys, ["--human", "probe"], { via, env: { TERM: "xterm" } });
				assert.deepStrictEqual(real.out, ["interactive=true audience=human/flag"], `${via} control`);
			}
		}),
	);

	it.effect("--agent and --ci still narrow, even on a human terminal", () =>
		Effect.gen(function* () {
			const humanOnTtys: Facts = { detected: "human", stdin: true, stdout: true, ambient: true };
			for (const flag of ["--agent", "--ci"]) {
				const { out, reads } = yield* runUnder(humanOnTtys, [flag, "init"]);
				assert.deepStrictEqual(out, [`profile=x audience=${flag.slice(2)}/flag`], flag);
				assert.deepStrictEqual(reads, QUIET, flag);
			}
		}),
	);

	it.effect("a conflict is never interactive, whatever the TTYs say", () =>
		Effect.gen(function* () {
			const { code, reads } = yield* runUnder(agentOnTtys, ["--human", "--agent", "init"]);
			assert.strictEqual(code, 64);
			assert.deepStrictEqual(reads, QUIET);
		}),
	);

	it.effect("the handler sees the recomputed value, through runWith and through a bare provide", () =>
		Effect.gen(function* () {
			for (const via of ["runWith", "core"] as const) {
				const widened = yield* runUnder(agentOnTtys, ["--human", "probe"], { via });
				assert.deepStrictEqual(widened.out, ["interactive=true audience=human/flag"], via);
				const piped = yield* runUnder({ ...agentOnTtys, stdin: false }, ["--human", "probe"], { via });
				assert.deepStrictEqual(piped.out, ["interactive=false audience=human/flag"], `${via} piped`);
				const narrowed = yield* runUnder(
					{ detected: "human", stdin: true, stdout: true, ambient: true },
					["--agent", "probe"],
					{ via },
				);
				assert.deepStrictEqual(narrowed.out, ["interactive=false audience=agent/flag"], `${via} agent`);
				const none = yield* runUnder(agentOnTtys, ["probe"], { via });
				assert.deepStrictEqual(
					none.out,
					["interactive=false audience=agent/detected"],
					`${via} no flag: the ambient value stays`,
				);
			}
		}),
	);

	it.effect("--human --wizard on real TTYs is the wizard, not an unknown flag, though the gate had dropped it", () =>
		Effect.gen(function* () {
			const { err, code, reads } = yield* runUnder(agentOnTtys, ["--human", "--wizard", "init"], {
				gateWizard: true,
				endInput: true,
			});
			assert.isAtLeast(reads.subscriptions, 1, "the wizard read the terminal");
			assert.isFalse(
				err.some((line) => /unrecogni[sz]ed.*wizard|wizard.*unrecogni[sz]ed|unknown.*wizard/i.test(line)),
				err.join("\n"),
			);
			assert.notStrictEqual(code, 64, err.join("\n"));
			// Without a terminal the gate's drop stands: the wizard is an unknown flag.
			const piped = yield* runUnder({ ...agentOnTtys, stdin: false }, ["--human", "--wizard", "init"], {
				gateWizard: true,
			});
			assert.strictEqual(piped.code, 64);
		}),
	);

	it.effect(
		"a consumer who left --wizard out of their own builtIns keeps it out: only a drop by the gate is restored",
		() =>
			Effect.gen(function* () {
				const noWizard = GlobalFlag.BuiltIns.filter((flag) => flag !== GlobalFlag.Wizard);
				assert.isFalse(noWizard.includes(GlobalFlag.Wizard));
				// Under a detected agent the gate has nothing to drop, and --human on real TTYs must not invent a wizard.
				const { err, code, reads } = yield* runUnder(agentOnTtys, ["--human", "--wizard", "init"], {
					gateWizard: true,
					endInput: true,
					builtIns: noWizard,
				});
				assert.strictEqual(code, 64, err.join("\n"));
				assert.isTrue(
					err.some((line) => /unrecogni[sz]ed.*wizard/i.test(line)),
					err.join("\n"),
				);
				assert.strictEqual(reads.subscriptions, 0, "the wizard never ran");
				// The same consumer's --human still widens the prompt itself.
				const prompted = yield* runUnder(agentOnTtys, ["--human", "init"], { gateWizard: true, builtIns: noWizard });
				assert.deepStrictEqual(prompted.out, ["profile=library audience=human/flag"]);
			}),
	);

	it.effect(
		"a consumer config provided INSIDE the gate, without Wizard, is not overridden: --human --wizard is 64",
		() =>
			Effect.gen(function* () {
				const noWizard = GlobalFlag.BuiltIns.filter((flag) => flag !== GlobalFlag.Wizard);
				// The gate (outside) saw the full list and dropped Wizard, so its mark is set; the consumer's config is a
				// different object, so the mark must not license putting Wizard back into it.
				const inner = yield* runUnder(agentOnTtys, ["--human", "--wizard", "init"], {
					gateWizard: true,
					endInput: true,
					innerBuiltIns: noWizard,
				});
				assert.strictEqual(inner.code, 64, inner.err.join("\n"));
				assert.isTrue(
					inner.err.some((line) => /unrecogni[sz]ed.*wizard/i.test(line)),
					inner.err.join("\n"),
				);
				assert.strictEqual(inner.reads.subscriptions, 0, "the wizard never ran");
				// Control: with no consumer config inside, the gate's own object is current, so the restore still happens.
				const control = yield* runUnder(agentOnTtys, ["--human", "--wizard", "init"], {
					gateWizard: true,
					endInput: true,
				});
				assert.isTrue(control.reads.subscriptions >= 1, "the wizard ran");
			}),
	);

	it.effect("the gate's drop is restored, and a second flag-driven narrowing then drops it again", () =>
		Effect.gen(function* () {
			// Gate dropped it (ambient non-interactive, full builtIns): --human on TTYs brings it back.
			const back = yield* runUnder(agentOnTtys, ["--human", "--wizard", "init"], { gateWizard: true, endInput: true });
			assert.isTrue(back.reads.subscriptions >= 1, "the wizard ran");
			// A non-human flag drops it whatever the ambient config had.
			const humanOnTtys: Facts = { detected: "human", stdin: true, stdout: true, ambient: true };
			const dropped = yield* runUnder(humanOnTtys, ["--agent", "--wizard", "init"], { gateWizard: true });
			assert.strictEqual(dropped.code, 64);
		}),
	);

	it.effect("with no TerminalEnv in the environment a flag only narrows, as before", () =>
		Effect.gen(function* () {
			// The harness of the first block provides no TerminalEnv: `--human` leaves the ambient value alone.
			const { out, reads } = yield* run(["--human", "init"]);
			assert.deepStrictEqual(out, ["profile=library audience=human/flag"]);
			assert.strictEqual(reads.keys, 2);
		}),
	);
});
