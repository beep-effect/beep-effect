import { assert, it } from "@effect/vitest";
// Vitest requires a direct vi import to resolve hoisted mocks without globals.
import { vi } from "vitest";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as References from "effect/References";
import * as Runtime from "effect/Runtime";
import { Command, Flag, Prompt } from "effect/cli";
import * as Path from "effect/Path";
import * as Stdio from "effect/Stdio";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
import { CliInteractive, CliPrompt, CliRuntime, CliTheme, NotInteractive } from "../../../effected/cli/index.ts";
import { TestTerminal } from "../../../effected/cli/testing.ts";
import { CliUi, Select } from "../../../effected/cli/ui.ts";
import type { CliUiTestSession } from "../../../effected/cli/ui-testing.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

// Ink is a dynamic module loader with no service seam; retain the mock to count peer loads.
// Count loads of the peers through the kit's one loader, without changing what it does.
const { loads } = vi.hoisted(() => ({ loads: { count: 0 } }));
vi.mock("../../../effected/cli/ui/internal/ink.ts", (importOriginal) =>
	Promise.all([
		importOriginal<typeof import("../../../effected/cli/ui/internal/ink.ts")>(),
		import("effect/Effect"),
	]).then(([actual, Effect]) => ({
		...actual,
		loadInk: Effect.suspend(() => {
			loads.count++;
			return actual.loadInk;
		}),
	})),
);

const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const double: Console.Console = Object.assign(Object.create(console), {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { double, out, err };
};

const profile = Select.screen({
	message: "Profile",
	choices: [
		{ label: "software-project", value: "software-project" },
		{ label: "library", value: "library" },
	],
});

/** A real command whose `--profile` flag falls back to a screen. */
const app = (options: { readonly otherwise?: string } = {}) =>
	Command.make("tool").pipe(
		Command.withSubcommands([
			Command.make(
				"run",
				{
					profile: Flag.String("profile").pipe(
						Flag.withFallbackPrompt(CliUi.fallback(profile, { flag: "profile", ...options })),
					),
				},
				({ profile }) => Console.log(`profile=${profile}`),
			),
		]),
	);

const exitCode = (exit: Exit.Exit<unknown, unknown>): number =>
	Exit.isFailure(exit) ? exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode) : 0;

const services = Layer.mergeAll(
	MemoryFileSystem.layer,
	Path.layer,
	Stdio.layerTest({}),
	Layer.mock(ChildProcessSpawner, { spawn: () => Effect.die("unexpected child process") }),
);

const platform = Effect.map(TestTerminal.make(), (terminal) =>
	Layer.mergeAll(services, CliPrompt.gateTerminal.pipe(Layer.provide(terminal.layer))),
);

/** Run argv through `CliRuntime.main` under a session: its streams, theme, interactivity and console. */
const run = Effect.fn("run")(function* (
	root: ReturnType<typeof app>,
	argv: ReadonlyArray<string>,
	session: CliUiTestSession,
) {
	const layer = yield* platform;
	const context = yield* Layer.build(session.layer);
	return yield* CliRuntime.main(Command.runWith(root, { version: "1.0.0" })(argv), { platform: layer }).pipe(
		Effect.provideContext(context),
		Effect.exit,
		Effect.map(exitCode),
	);
});

it.layer(
	Layer.mergeAll(services, Layer.unwrap(Effect.map(TestTerminal.make(), (terminal) => terminal.layer))),
	{ timeout: "30 seconds" },
)("CliUi.fallback", (it) => {
	it.effect("the flag given: the screen never mounts and Ink is never loaded", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			const before = loads.count;
			assert.strictEqual(yield* run(app(), ["run", "--profile", "library"], session), 0);
			assert.strictEqual(yield* session.stdout, "profile=library\n");
			assert.strictEqual(yield* session.mounts, 0);
			assert.strictEqual(loads.count, before);
		}),
	);

	it.effect("the flag absent, interactive: the screen mounts and its answer is the flag's value", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			const before = loads.count;
			const program = yield* Effect.forkScoped(run(app({ otherwise: "software-project" }), ["run"], session));
			yield* (yield* session.next({ contains: "Profile" })).press("down", "enter");
			assert.strictEqual(yield* Fiber.join(program), 0, yield* session.stderr);
			assert.strictEqual(yield* session.stdout, "profile=library\n");
			assert.isAbove(loads.count, before, "control: an interactive fallback does load Ink");
		}),
	);

	it.effect("not interactive with otherwise: the default is the value, nothing mounts, Ink is never loaded", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session({ interactive: false });
			const before = loads.count;
			assert.strictEqual(yield* run(app({ otherwise: "software-project" }), ["run"], session), 0);
			assert.strictEqual(yield* session.stdout, "profile=software-project\n");
			assert.strictEqual(yield* session.mounts, 0);
			assert.strictEqual(loads.count, before);
		}),
	);

	it.effect("not interactive without otherwise: core's missing-flag error, exit 64, Ink never loaded", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session({ interactive: false });
			const before = loads.count;
			assert.strictEqual(yield* run(app(), ["run"], session), 64);
			assert.notInclude(yield* session.stdout, "profile=");
			assert.include(yield* session.stderr, "Missing required flag: --profile");
			assert.strictEqual(loads.count, before);
		}),
	);

	it.effect("no CliTheme around the parse counts as not interactive, even with CliInteractive on", () =>
		Effect.gen(function* () {
			const before = loads.count;
			// No session: it would provide a theme. Only CliInteractive, on, and a console.
			const { double, out } = capturing();
			const bare = (root: ReturnType<typeof app>) =>
				Effect.flatMap(platform, (layer) =>
					CliRuntime.main(Command.runWith(root, { version: "1.0.0" })(["run"]), { platform: layer }).pipe(
						Effect.provideService(CliInteractive, true),
						Effect.provideService(Console.Console, double),
						Effect.exit,
						Effect.map(exitCode),
					),
				);
			assert.strictEqual(yield* bare(app({ otherwise: "software-project" })), 0);
			assert.deepStrictEqual(out, ["profile=software-project"]);
			assert.strictEqual(yield* bare(app()), 64);
			assert.strictEqual(loads.count, before);
		}),
	);

	it.effect("with CliInteractive on but no CliTheme, it says why at debug level, once per fallback", () =>
		Effect.gen(function* () {
			const lines: Array<string> = [];
			const debug = new Set([
				Logger.make(({ logLevel, message }) => {
					lines.push(`${logLevel}: ${Array.isArray(message) ? message.join(" ") : String(message)}`);
				}),
			]);
			const answered = (interactive: boolean) =>
				Effect.gen(function* () {
					const fallback = CliUi.fallback(profile, { flag: "profile", otherwise: "library" });
					const effect = Prompt.isPrompt(fallback) ? Effect.die("a bare prompt") : fallback;
					const first = yield* effect;
					const second = yield* effect;
					void first;
					void second;
				}).pipe(
					Effect.provideService(CliInteractive, interactive),
					Effect.provideService(Logger.CurrentLoggers, debug),
					Effect.provideService(References.MinimumLogLevel, "Debug"),
				);
			yield* answered(false);
			assert.deepStrictEqual(lines, [], "not interactive is the ordinary case: nothing to explain");
			yield* answered(true);
			assert.lengthOf(lines, 1, lines.join("\n"));
			assert.match(lines[0] ?? "", /^Debug: /);
			assert.include(lines[0], "--profile");
			assert.include(lines[0], "CliTheme");
		}),
	);

	it.effect("Esc on the screen: exit 130, one line on stderr, and the handler never runs", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			const program = yield* Effect.forkScoped(run(app({ otherwise: "software-project" }), ["run"], session));
			yield* (yield* session.next({ contains: "Profile" })).press("escape");
			assert.strictEqual(
				yield* Fiber.join(program),
				130,
				"a cancel is not a usage error: core's parse step never saw it as one",
			);
			assert.strictEqual(yield* session.stderr, "cancelled; nothing written\n");
			assert.strictEqual(yield* session.stdout, "");
		}),
	);

	it.effect("Ctrl-C on the screen: exit 130 too", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			const program = yield* Effect.forkScoped(run(app(), ["run"], session));
			yield* (yield* session.next({ contains: "Profile" })).press("ctrl+c");
			assert.strictEqual(yield* Fiber.join(program), 130);
			assert.strictEqual(yield* session.stderr, "cancelled; nothing written\n");
		}),
	);
});

it.layer(CliTheme.layerTest(), { timeout: "30 seconds" })("CliUi.prompt", (it) => {
	it.effect("not interactive: otherwise when given, else NotInteractive, and Ink is never loaded", () =>
		Effect.gen(function* () {
			const before = loads.count;
			const given = yield* CliUi.prompt(profile, { otherwise: "library" });
			assert.strictEqual(given, "library");
			const error = yield* Effect.flip(CliUi.prompt(profile));
			assert.instanceOf(error, NotInteractive);
			const undefinedOtherwise = yield* Effect.flip(CliUi.prompt(profile, {}));
			assert.instanceOf(undefinedOtherwise, NotInteractive);
			assert.strictEqual(loads.count, before);
		}).pipe(Effect.provideService(CliInteractive, false)),
	);
});
