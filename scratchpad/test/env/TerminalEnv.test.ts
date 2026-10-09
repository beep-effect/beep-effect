// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";
import type { ColorLevel } from "../../effected/env/ColorLevel.ts";
import type { Env } from "../../effected/env/internal/types.ts";
import type { TerminalEnvOptions, TerminalEnvTestOptions } from "../../effected/env/TerminalEnv.ts";
import { TerminalEnv } from "../../effected/env/TerminalEnv.ts";

const withEnv = (env: Env) => Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

const stdio = (opts: { readonly stdin?: boolean; readonly stdout: boolean }) =>
	Stdio.layerTest({
		stdinIsTerminal: Effect.succeed(opts.stdin ?? opts.stdout),
		stdoutIsTerminal: Effect.succeed(opts.stdout),
	});

const terminal = (columns: number) =>
	Layer.succeed(
		Terminal.Terminal,
		Terminal.make({
			columns: Effect.succeed(columns),
			rows: Effect.succeed(24),
			readInput: Effect.die("unused"),
			readLine: Effect.die("unused"),
			display: () => Effect.void,
		}),
	);

/** Provide the platform doubles and the environment, build `TerminalEnv.layer`, and read the service. */
const read = <A>(
	env: Env,
	io: { readonly stdin?: boolean; readonly stdout: boolean; readonly columns?: number },
	use: (terminalEnv: TerminalEnv["Service"]) => A,
	options?: Parameters<typeof TerminalEnv.layer>[0],
) =>
	Effect.gen(function* () {
		return use(yield* TerminalEnv);
	}).pipe(
		Effect.provide(TerminalEnv.layer(options)),
		Effect.provide(Layer.mergeAll(stdio(io), terminal(io.columns ?? 0))),
		withEnv(env),
	);

describe("TerminalEnv.layer", () => {
	it.effect("a TTY stdout with TERM=xterm-256color has 256 colours", () =>
		Effect.map(
			read({ TERM: "xterm-256color" }, { stdout: true }, (t) => t.stdout.color),
			(color) => assert.strictEqual(color, "256"),
		),
	);

	it.effect("a non-TTY stdout under a hyperlink-capable terminal has no hyperlinks and no colour", () =>
		Effect.map(
			read({ TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" }, { stdout: false }, (t) => t.stdout),
			(stream) => {
				assert.strictEqual(stream.isTerminal, false);
				assert.strictEqual(stream.hyperlinks, false);
				assert.strictEqual(stream.color, "none");
			},
		),
	);

	it.effect("a TTY stdout under iTerm 3.5.0 has hyperlinks", () =>
		Effect.map(
			read({ TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" }, { stdout: true }, (t) => t.stdout.hyperlinks),
			(hyperlinks) => assert.strictEqual(hyperlinks, true),
		),
	);

	it.effect("stdinIsTerminal is read from Stdio independently of stdout", () =>
		Effect.map(
			read({}, { stdin: true, stdout: false }, (t) => t.stdinIsTerminal),
			(stdin) => assert.strictEqual(stdin, true),
		),
	);

	it.effect("stderr mirrors stdout when stderrIsTerminal is omitted", () =>
		Effect.map(
			read({ TERM: "xterm-256color" }, { stdout: true }, (t) => t.stderr),
			(stderr) => {
				assert.strictEqual(stderr.isTerminal, true);
				assert.strictEqual(stderr.color, "256");
			},
		),
	);

	it.effect("stderrIsTerminal false gives stderr no colour while stdout keeps it", () =>
		Effect.map(
			read(
				{ TERM: "xterm-256color", TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" },
				{ stdout: true },
				(t) => t,
				{ stderrIsTerminal: Effect.succeed(false) },
			),
			(t) => {
				// Node's table reads TERM_PROGRAM (iTerm 3.5 → truecolor) before TERM.
				assert.strictEqual(t.stdout.color, "truecolor");
				assert.strictEqual(t.stderr.isTerminal, false);
				assert.strictEqual(t.stderr.color, "none");
				assert.strictEqual(t.stderr.hyperlinks, false);
				assert.strictEqual(t.stdout.hyperlinks, true);
			},
		),
	);

	it.effect("Terminal.columns 0 is None and width() is 80", () =>
		Effect.map(
			read({}, { stdout: true, columns: 0 }, (t) => [t.stdout.columns, t.width()] as const),
			([columns, width]) => {
				assert.deepStrictEqual(columns, O.none());
				assert.strictEqual(width, 80);
			},
		),
	);

	it.effect("with no columns, COLUMNS supplies the width, then the fallback", () =>
		Effect.map(
			Effect.all([
				read({ COLUMNS: "100" }, { stdout: true }, (t) => t.width()),
				read({ COLUMNS: "garbage" }, { stdout: true }, (t) => t.width(60)),
			]),
			([fromEnv, fallback]) => {
				assert.strictEqual(fromEnv, 100);
				assert.strictEqual(fallback, 60);
			},
		),
	);

	it.effect("COLUMNS must be a positive integer: anything else falls back", () =>
		Effect.map(
			Effect.forEach(
				["-5", "0", "100abc", "abc", "1.5", " 100", "1e3"],
				(value) => read({ COLUMNS: value }, { stdout: true }, (t) => t.width(60)),
			),
			(widths) => assert.deepStrictEqual(widths, [60, 60, 60, 60, 60, 60, 60]),
		),
	);

	it.effect("a stderr that is a TTY under a non-TTY stdout gets colour and hyperlinks; stdout gets none", () =>
		Effect.map(
			read(
				{ TERM: "xterm-256color", TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" },
				{ stdout: false },
				(t) => t,
				{ stderrIsTerminal: Effect.succeed(true) },
			),
			(t) => {
				assert.strictEqual(t.stdout.isTerminal, false);
				assert.strictEqual(t.stdout.color, "none");
				assert.strictEqual(t.stdout.hyperlinks, false);
				assert.strictEqual(t.stderr.isTerminal, true);
				assert.strictEqual(t.stderr.color, "truecolor");
				assert.strictEqual(t.stderr.hyperlinks, true);
			},
		),
	);

	it.effect("Terminal.columns 120 is Some(120) and beats both COLUMNS and the fallback", () =>
		Effect.map(
			read({ COLUMNS: "100" }, { stdout: true, columns: 120 }, (t) => [t.stdout.columns, t.width(60)] as const),
			([columns, width]) => {
				assert.deepStrictEqual(columns, O.some(120));
				assert.strictEqual(width, 120);
			},
		),
	);
});

describe("TerminalEnv.layerStdio", () => {
	/** Provide ONLY `Stdio`: a `Terminal` requirement left in R would not compile here. */
	const readStdio = <A>(
		env: Env,
		io: { readonly stdin?: boolean; readonly stdout: boolean },
		use: (terminalEnv: TerminalEnv["Service"]) => A,
	) =>
		Effect.gen(function* () {
			return use(yield* TerminalEnv);
		}).pipe(Effect.provide(TerminalEnv.layerStdio()), Effect.provide(stdio(io)), withEnv(env));

	it.effect("needs only Stdio, and reports no columns whatever the terminal would say", () =>
		Effect.map(
			readStdio({}, { stdout: true }, (t) => t),
			(t) => {
				assert.isTrue(O.isNone(t.stdout.columns));
				assert.isTrue(O.isNone(t.stderr.columns));
				assert.strictEqual(t.width(), 80);
			},
		),
	);

	it.effect("the width comes from COLUMNS, then the fallback", () =>
		Effect.map(
			readStdio({ COLUMNS: "132" }, { stdout: true }, (t) => [t.width(), t.width(40)]),
			(widths) => assert.deepStrictEqual(widths, [132, 132]),
		),
	);

	it.effect("everything but columns agrees with TerminalEnv.layer over the same facts", () =>
		Effect.gen(function* () {
			const env = { TERM: "xterm-256color", TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" };
			const stdioOnly = yield* readStdio(env, { stdin: true, stdout: true }, (t) => t);
			const full = yield* read(env, { stdin: true, stdout: true, columns: 120 }, (t) => t);
			assert.strictEqual(stdioOnly.stdinIsTerminal, full.stdinIsTerminal);
			assert.deepStrictEqual(
				{ ...stdioOnly.stdout, columns: O.none() },
				{ ...full.stdout, columns: O.none() },
			);
			assert.deepStrictEqual(
				{ ...stdioOnly.stderr, columns: O.none() },
				{ ...full.stderr, columns: O.none() },
			);
			assert.isTrue(O.isSome(full.stdout.columns), "the control reads columns, so the difference is real");
		}),
	);

	it.effect("stderrIsTerminal overrides the stderr check, as it does for layer", () =>
		Effect.gen(function* () {
			const t = yield* TerminalEnv.pipe(
				Effect.provide(TerminalEnv.layerStdio({ stderrIsTerminal: Effect.succeed(false) })),
				Effect.provide(stdio({ stdout: true })),
				withEnv({ TERM: "xterm-256color" }),
			);
			assert.strictEqual(t.stdout.color, "256");
			assert.strictEqual(t.stderr.color, "none");
		}),
	);
});

describe("TerminalEnv.layerTest", () => {
	// No Stdio, no Terminal, no ConfigProvider is provided: this compiling is the type-level check that the layer
	// has no requirements, and running is the behavioural one.
	it.effect("is quiet by default and needs no platform services", () =>
		Effect.gen(function* () {
			const t = yield* TerminalEnv;
			assert.strictEqual(t.stdinIsTerminal, false);
			for (const stream of [t.stdout, t.stderr]) {
				assert.deepStrictEqual(stream, { isTerminal: false, color: "none", hyperlinks: false, columns: O.none() });
			}
			assert.strictEqual(t.width(), 80);
		}).pipe(Effect.provide(TerminalEnv.layerTest())),
	);

	it.effect("a test opts into colour per stream", () =>
		Effect.gen(function* () {
			const t = yield* TerminalEnv;
			assert.strictEqual(t.stdout.color, "truecolor");
			assert.strictEqual(t.stderr.color, "none");
			assert.deepStrictEqual(t.stdout.columns, O.some(90));
			assert.strictEqual(t.width(), 90);
		}).pipe(
			Effect.provide(
				TerminalEnv.layerTest({ stdout: { color: "truecolor", columns: O.some(90) }, stderr: { color: "none" } }),
			),
		),
	);
});

describe("TerminalEnv.colorLevel", () => {
	it.effect("FORCE_COLOR=2 gives 256 on a non-TTY stdout", () =>
		Effect.map(
			TerminalEnv.colorLevel("stdout").pipe(Effect.provide(stdio({ stdout: false })), withEnv({ FORCE_COLOR: "2" })),
			(level) => assert.strictEqual(level, "256"),
		),
	);

	it.effect("needs only Stdio: it is assignable to Effect<ColorLevel, never, Stdio> (no Terminal in R)", () => {
		const program = TerminalEnv.colorLevel("stdout") satisfies Effect.Effect<ColorLevel, never, Stdio.Stdio>;
		// A TTY stdout with no colour variables: the terminal table, not the TTY gate, decides.
		return Effect.map(
			program.pipe(Effect.provide(stdio({ stdout: true })), withEnv({ TERM: "xterm-256color" })),
			(level) => assert.strictEqual(level, "256"),
		);
	});

	it.effect("defers to an ambient TerminalEnv: its stdout colour wins over the Config and Stdio computation", () =>
		Effect.map(
			TerminalEnv.colorLevel("stdout").pipe(
				Effect.provide(TerminalEnv.layerTest({ stdout: { color: "256" } })),
				Effect.provide(stdio({ stdout: false })),
				withEnv({}),
			),
			(level) => assert.strictEqual(level, "256"),
		),
	);

	it.effect("the named options types are the ones layer and layerTest take", () => {
		const layerOptions: TerminalEnvOptions = { stderrIsTerminal: Effect.succeed(true) };
		const testOptions: TerminalEnvTestOptions = { stdinIsTerminal: true, stdout: { color: "basic" } };
		assert.isDefined(TerminalEnv.layer(layerOptions));
		assert.isDefined(TerminalEnv.layerTest(testOptions));
		return Effect.void;
	});

	it.effect("a non-TTY stdout without FORCE_COLOR is none", () =>
		Effect.map(
			TerminalEnv.colorLevel("stdout").pipe(
				Effect.provide(stdio({ stdout: false })),
				withEnv({ TERM: "xterm-256color" }),
			),
			(level) => assert.strictEqual(level, "none"),
		),
	);
});
