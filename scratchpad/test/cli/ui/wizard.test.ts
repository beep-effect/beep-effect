// @effect-diagnostics strictEffectProvide:skip-file asyncFunction:skip-file
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Runtime from "effect/Runtime";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";
import { Command } from "effect/cli";
import { vi } from "vitest";
import { CliPrompt, CliRuntime } from "../../../effected/cli/index.ts";
import { TestTerminal } from "../../../effected/cli/testing.ts";
import { CliUi, Select, TextInput } from "../../../effected/cli/ui.ts";
import type { CliUiTestSession } from "../../../effected/cli/ui-testing.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

const Json = S.fromJsonString(S.Unknown);

// Count loads of the peers through the kit's one loader, without changing what it does.
const { loads } = vi.hoisted(() => ({ loads: { count: 0 } }));
vi.mock("../../../effected/cli/ui/internal/ink.ts", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../../effected/cli/ui/internal/ink.ts")>();
	const { Effect } = await import("effect");
	return {
		...actual,
		loadInk: Effect.suspend(() => {
			loads.count++;
			return actual.loadInk;
		}),
	};
});

const PROFILES = ["software-project", "library"] as const;
const LOCATIONS = [".config/okfit.toml", "package.json"] as const;

/** okfit's discovery: what the repository already says, found before anything is asked. */
const discover = Effect.sync(() => ({ profile: "library", dir: "docs/okf", location: "package.json" }));

/** okfit's init: discovery first, then profile, bundle directory and config location, each defaulted from it. */
const init = Command.make("init", {}, () =>
	Effect.gen(function* () {
		const found = yield* discover;
		const profile = yield* CliUi.prompt(
			Select.screen({
				message: "Profile",
				choices: PROFILES.map((value) => ({ label: value, value: value })),
				initial: PROFILES.findIndex((profile) => profile === found.profile),
			}),
			{ otherwise: found.profile },
		);
		const dir = yield* CliUi.prompt(TextInput.screen({ message: "Bundle directory", initial: found.dir }), {
			otherwise: found.dir,
		});
		const location = yield* CliUi.prompt(
			Select.screen({
				message: "Config location",
				choices: LOCATIONS.map((value) => ({ label: value, value: value })),
				initial: LOCATIONS.findIndex((location) => location === found.location),
			}),
			{ otherwise: found.location },
		);
		yield* S.encodeUnknownResult(Json)({ profile, dir, location }).pipe(Result.getOrThrow, Console.log);
	}),
);

const exitCode = (exit: Exit.Exit<unknown, unknown>): number =>
	Exit.isFailure(exit) ? exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode) : 0;

/** okfit's init through `CliRuntime.main`, under a session: its streams, theme, interactivity and console. */
const run = Effect.fn("run")(function* (session: CliUiTestSession) {
		const terminal = yield* TestTerminal.make();
		return yield* CliRuntime.main(Command.runWith(init, { version: "1.0.0" })([]), {
			platform: Layer.mergeAll(NodeServices.layer, CliPrompt.gateTerminal.pipe(Layer.provide(terminal.layer))),
		}).pipe(Effect.provide(session.layer), Effect.exit, Effect.map(exitCode));
	});

describe("okfit's init wizard through CliUi.prompt, driven by CliUiTest.session", () => {
	it.effect("interactive: each screen starts on the discovered default, and the answers flow through", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			const program = yield* Effect.forkScoped(run(session));
			const profile = yield* session.next({ contains: "Profile" });
			yield* profile.press("up", "enter");
			const dir = yield* session.next({ contains: "Bundle directory" });
			yield* dir.type("2");
			yield* dir.press("enter");
			const location = yield* session.next({ contains: "Config location" });
			yield* location.press("up", "enter");
			assert.strictEqual(yield* Fiber.join(program), 0, yield* session.stderr);
			assert.strictEqual(
				yield* session.stdout,
				`${Result.getOrThrow(S.encodeUnknownResult(Json)({ profile: "software-project", dir: "docs/okf2", location: ".config/okfit.toml" }))}\n`,
			);
			assert.strictEqual(yield* session.mounts, 3);
		}).pipe(Effect.scoped),
	);

	it.effect("not interactive: the discovered defaults, byte-identical, with nothing mounted and Ink never loaded", () =>
		Effect.gen(function* () {
			const before = loads.count;
			const session = yield* CliUiTest.session({ interactive: false });
			assert.strictEqual(yield* run(session), 0);
			assert.strictEqual(yield* session.stdout, `${Result.getOrThrow(S.encodeUnknownResult(Json)(yield* discover))}\n`);
			assert.strictEqual(yield* session.mounts, 0);
			assert.strictEqual(loads.count, before);
		}).pipe(Effect.scoped),
	);

	it.effect("Esc on the second screen: exit 130, and the third screen never mounts", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			const program = yield* Effect.forkScoped(run(session));
			const profile = yield* session.next({ contains: "Profile" });
			yield* profile.press("enter");
			const dir = yield* session.next({ contains: "Bundle directory" });
			yield* dir.press("escape");
			assert.strictEqual(yield* Fiber.join(program), 130);
			assert.strictEqual(yield* session.stderr, "cancelled; nothing written\n");
			assert.strictEqual(yield* session.stdout, "", "the handler wrote nothing");
			assert.strictEqual(yield* session.mounts, 2, "two screens mounted, not three");
		}).pipe(Effect.scoped),
	);
});

/** Node's services, with `Stdio` and `Terminal` doubles over them (last wins): what CliEnv reads to decide. */
const platform = (tty: boolean) =>
	Layer.mergeAll(
		NodeServices.layer,
		Stdio.layerTest({ stdinIsTerminal: Effect.succeed(tty), stdoutIsTerminal: Effect.succeed(tty) }),
		Layer.succeed(
			Terminal.Terminal,
			Terminal.make({
				columns: Effect.succeed(80),
				rows: Effect.succeed(24),
				readInput: Effect.die("unused"),
				readLine: Effect.die("unused"),
				display: () => Effect.void,
			}),
		),
	);

/** okfit's production wiring: `CliRuntime.main` with `env`, so CliEnv provides the theme and decides interactivity. */
const production = (session: CliUiTestSession, tty: boolean) =>
	CliRuntime.main(Command.runWith(init, { version: "1.0.0" })([]), { platform: platform(tty), env: {} }).pipe(
		// The session supplies only the streams, the frame capture and the console here: CliEnv, provided inside
		// main, shadows the session's own theme and interactivity, exactly as it does for a real program.
		Effect.provide(session.layer),
		Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})),
		Effect.exit,
		Effect.map(exitCode),
	);

describe("CliUi.prompt under okfit's production wiring (CliRuntime.main with env)", () => {
	it.effect("a human on a terminal gets the screens, with CliEnv's theme and interactivity", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session({ interactive: false });
			const program = yield* Effect.forkScoped(production(session, true));
			yield* (yield* session.next({ contains: "Profile" })).press("enter");
			yield* (yield* session.next({ contains: "Bundle directory" })).press("enter");
			yield* (yield* session.next({ contains: "Config location" })).press("enter");
			assert.strictEqual(yield* Fiber.join(program), 0, yield* session.stderr);
			assert.strictEqual(yield* session.stdout, `${Result.getOrThrow(S.encodeUnknownResult(Json)(yield* discover))}\n`);
		}).pipe(Effect.scoped),
	);

	it.effect("piped: CliEnv decides not interactive, and the defaults come back with Ink never loaded", () =>
		Effect.gen(function* () {
			const before = loads.count;
			const session = yield* CliUiTest.session();
			assert.strictEqual(yield* production(session, false), 0, yield* session.stderr);
			assert.strictEqual(yield* session.stdout, `${Result.getOrThrow(S.encodeUnknownResult(Json)(yield* discover))}\n`);
			assert.strictEqual(yield* session.mounts, 0);
			assert.strictEqual(loads.count, before);
		}).pipe(Effect.scoped),
	);
});
