// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import type { AudienceShape } from "../../effected/env/index.ts";
import { Audience } from "../../effected/env/index.ts";
import { Cause, Console, Effect, Exit, Runtime } from "effect";
import { Argument, Command } from "effect/cli";
import { CliAudience, CliInteractive, CliRuntime } from "../../effected/cli/index.ts";

const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const double: Console.Console = Object.assign(Object.create(console) as Console.Console, {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { double, out, err };
};

/** A real two-subcommand program; the handler records the `Audience` it observes. */
const run = (argv: ReadonlyArray<string>, options?: { readonly hidden?: boolean }) =>
	Effect.gen(function* () {
		const { double, out, err } = capturing();
		const seen: AudienceShape[] = [];
		const verify = Command.make("verify", { target: Argument.String("target") }, () =>
			Effect.gen(function* () {
				seen.push(yield* Audience);
			}),
		);
		const other = Command.make("other", {}, () => Effect.void);
		const root = Command.make("tool").pipe(
			Command.withSharedFlags(CliAudience.flags(options)),
			Command.withSubcommands([verify, other]),
			CliAudience.provide,
		);
		const exit = yield* CliRuntime.main(Command.runWith(root, { version: "1.0.0" })(argv), {
			platform: NodeServices.layer,
		}).pipe(
			Effect.exit,
			Effect.provideService(Console.Console, double),
			// The ambient audience, as env's detection would have left it.
			Effect.provide(Audience.layerTest("human", "detected")),
		);
		const code = Exit.isFailure(exit) ? Runtime.getErrorExitCode(Cause.squash(exit.cause)) : 0;
		return { code, seen, out, err };
	});

const HUMAN_DETECTED: AudienceShape = { kind: "human", source: "detected" };
const AGENT_FLAG: AudienceShape = { kind: "agent", source: "flag" };
const CI_FLAG: AudienceShape = { kind: "ci", source: "flag" };

describe("CliAudience", () => {
	const cases: ReadonlyArray<readonly [string, ReadonlyArray<string>, AudienceShape]> = [
		["no flag leaves the ambient audience untouched", ["verify", "x"], { kind: "human", source: "detected" }],
		["--agent before the subcommand", ["--agent", "verify", "x"], { kind: "agent", source: "flag" }],
		["--agent after the subcommand", ["verify", "x", "--agent"], { kind: "agent", source: "flag" }],
		["--audience ci", ["verify", "x", "--audience", "ci"], { kind: "ci", source: "flag" }],
		["--human", ["--human", "verify", "x"], { kind: "human", source: "flag" }],
		["--ci", ["--ci", "verify", "x"], { kind: "ci", source: "flag" }],
		["--audience=ci, the equals form", ["--audience=ci", "verify", "x"], { kind: "ci", source: "flag" }],
		// A false boolean is "not given": it falls through to the ambient audience, never to its own kind.
		["--no-agent falls through to the ambient audience", ["--no-agent", "verify", "x"], HUMAN_DETECTED],
		["--agent=false falls through to the ambient audience", ["--agent=false", "verify", "x"], HUMAN_DETECTED],
		["--human=false falls through to the ambient audience", ["--human=false", "verify", "x"], HUMAN_DETECTED],
		// Only true occurrences count, so a false one beside a true one is not a conflict.
		["--agent=false --ci counts one true occurrence", ["--agent=false", "--ci", "verify", "x"], CI_FLAG],
		["--agent --no-agent counts one true occurrence", ["--agent", "--no-agent", "verify", "x"], AGENT_FLAG],
		["--no-agent --audience ci counts one occurrence", ["--no-agent", "--audience", "ci", "verify", "x"], CI_FLAG],
	];
	for (const [label, argv, expected] of cases) {
		it.effect(label, () =>
			Effect.gen(function* () {
				const { code, seen } = yield* run(argv);
				assert.strictEqual(code, 0);
				assert.deepStrictEqual(seen, [expected]);
			}),
		);
	}

	describe("more than one occurrence is a usage error, even when the values agree", () => {
		const conflicts: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
			["--agent, then --ci after the subcommand", ["--agent", "verify", "x", "--ci"]],
			["--agent twice", ["--agent", "--agent", "verify", "x"]],
			["--agent and --audience agent", ["--agent", "--audience", "agent", "verify", "x"]],
			["--audience ci twice", ["--audience", "ci", "--audience", "ci", "verify", "x"]],
		];
		for (const [label, argv] of conflicts) {
			it.effect(label, () =>
				Effect.gen(function* () {
					const { code, seen, out, err } = yield* run(argv);
					assert.strictEqual(code, 64);
					assert.deepStrictEqual(out, [], "a usage error writes nothing to stdout");
					assert.deepStrictEqual(seen, [], "the handler never runs");
					assert.strictEqual(err.length, 1, err.join("\n"));
					assert.include(err[0], "Give at most one of --audience, --human, --agent, --ci (once).");
				}),
			);
		}
	});

	it.effect("a bad --audience value is core's own parse error, exit 64", () =>
		Effect.gen(function* () {
			const { code, seen } = yield* run(["verify", "x", "--audience", "bogus"]);
			assert.strictEqual(code, 64);
			assert.deepStrictEqual(seen, []);
		}),
	);

	it.effect("--agent --ci --help exits 0 and prints help (intended: core's action flags win before the resolver)", () =>
		Effect.gen(function* () {
			// Core handles --help before the resolver runs, so a conflicting audience together with
			// --help is not a usage error. This is core's precedence, pinned here so a change to it is noticed.
			const { code, out, err } = yield* run(["--agent", "--ci", "--help"]);
			assert.strictEqual(code, 0);
			assert.isTrue(
				out.some((line) => line.includes("USAGE")),
				out.join("\n"),
			);
			assert.deepStrictEqual(err, []);
		}),
	);

	it.effect("--audience's help line lists the choices exactly once: core's (choices: …), no placeholder list", () =>
		Effect.gen(function* () {
			const { out } = yield* run(["--help"]);
			const line =
				out.flatMap((text) => text.split("\n")).find((text) => text.trimStart().startsWith("--audience")) ?? "";
			// The whole line names the choices once: core's "(choices: human, agent, ci)", and no placeholder list of its own.
			assert.include(line, "(choices: human, agent, ci)", line);
			assert.lengthOf(line.match(/human/g) ?? [], 1, line);
		}),
	);

	describe("flags({ hidden: true })", () => {
		it.effect("the root --help does not list --audience", () =>
			Effect.gen(function* () {
				const visible = yield* run(["--help"]);
				assert.isTrue(
					visible.out.some((line) => line.includes("--audience")),
					"control: shown when not hidden",
				);
				const hidden = yield* run(["--help"], { hidden: true });
				assert.strictEqual(hidden.code, 0);
				assert.isFalse(hidden.out.some((line) => line.includes("--audience")));
				for (const flag of ["--human", "--agent", "--ci"]) {
					assert.isFalse(hidden.out.some((line) => line.includes(flag)));
				}
			}),
		);

		it.effect("the flags still parse and resolve", () =>
			Effect.gen(function* () {
				const { code, seen } = yield* run(["--agent", "verify", "x"], { hidden: true });
				assert.strictEqual(code, 0);
				assert.deepStrictEqual(seen, [{ kind: "agent", source: "flag" }]);
			}),
		);
	});
});

describe("CliAudience and CliInteractive", () => {
	/** The interactivity the handler sees, given the ambient value the env layer decided. */
	const observe = (argv: ReadonlyArray<string>, ambient: boolean) =>
		Effect.gen(function* () {
			const { double } = capturing();
			const seen: boolean[] = [];
			const verify = Command.make("verify", { target: Argument.String("target") }, () =>
				Effect.gen(function* () {
					seen.push(yield* CliInteractive);
				}),
			);
			const root = Command.make("tool").pipe(
				Command.withSharedFlags(CliAudience.flags()),
				Command.withSubcommands([verify]),
				CliAudience.provide,
			);
			yield* CliRuntime.main(Command.runWith(root, { version: "1.0.0" })(argv), { platform: NodeServices.layer }).pipe(
				Effect.exit,
				Effect.provideService(Console.Console, double),
				Effect.provide(CliInteractive.layerTest(ambient)),
				Effect.provide(Audience.layerTest("human", "detected")),
			);
			return seen;
		});

	it.effect("a non-human audience flag turns interactivity off for the handler", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* observe(["--agent", "verify", "x"], true), [false]);
			assert.deepStrictEqual(yield* observe(["--ci", "verify", "x"], true), [false]);
			assert.deepStrictEqual(yield* observe(["--audience", "agent", "verify", "x"], true), [false]);
		}),
	);

	it.effect("no flag leaves it as decided, and --human never turns it on", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* observe(["verify", "x"], true), [true]);
			assert.deepStrictEqual(yield* observe(["verify", "x"], false), [false]);
			assert.deepStrictEqual(yield* observe(["--human", "verify", "x"], true), [true]);
			assert.deepStrictEqual(yield* observe(["--human", "verify", "x"], false), [false]);
		}),
	);
});
