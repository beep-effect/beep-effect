import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Context from "effect/Context";
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

/** Build each snapshot in the runner's shared fixture scope. */
const snapshot = (
	name: string,
	env: Env,
	io: {
		readonly stdin?: boolean;
		readonly stdout: boolean;
		readonly columns?: number;
	},
	options?: TerminalEnvOptions,
	stdioOnly = false,
) => {
	class Snapshot extends Context.Service<Snapshot, TerminalEnv["Service"]>()(name) {}
	const key = Snapshot;
	const config = Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));
	const subject = stdioOnly
		? TerminalEnv.layerStdio(options).pipe(Layer.provide(stdio(io)), Layer.provide(config))
		: TerminalEnv.layer(options).pipe(
				Layer.provide(Layer.mergeAll(stdio(io), terminal(io.columns ?? 0))),
				Layer.provide(config),
			);
	const layer = Layer.effect(key, TerminalEnv).pipe(Layer.provide(subject));
	return { key, layer };
};

describe("TerminalEnv.layer", () => {
	{
		const tty256 = snapshot("TerminalEnv tty256", { TERM: "xterm-256color" }, { stdout: true });
		it.layer(tty256.layer, { timeout: "30 seconds" })((it) => {
			it.effect("a TTY stdout with TERM=xterm-256color has 256 colours", () =>
				Effect.map(
					Effect.map(tty256.key, (t) => t.stdout.color),
					(color) => assert.strictEqual(color, "256"),
				),
			);
		});
	}

	{
		const nonTty = snapshot(
			"TerminalEnv nonTty",
			{ TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" },
			{ stdout: false },
		);
		it.layer(nonTty.layer, { timeout: "30 seconds" })((it) => {
			it.effect("a non-TTY stdout under a hyperlink-capable terminal has no hyperlinks and no colour", () =>
				Effect.map(
					Effect.map(nonTty.key, (t) => t.stdout),
					(stream) => {
						assert.strictEqual(stream.isTerminal, false);
						assert.strictEqual(stream.hyperlinks, false);
						assert.strictEqual(stream.color, "none");
					},
				),
			);
		});
	}

	{
		const iterm = snapshot(
			"TerminalEnv iterm",
			{ TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" },
			{ stdout: true },
		);
		it.layer(iterm.layer, { timeout: "30 seconds" })((it) => {
			it.effect("a TTY stdout under iTerm 3.5.0 has hyperlinks", () =>
				Effect.map(
					Effect.map(iterm.key, (t) => t.stdout.hyperlinks),
					(hyperlinks) => assert.strictEqual(hyperlinks, true),
				),
			);
		});
	}

	{
		const stdin = snapshot("TerminalEnv stdin", {}, { stdin: true, stdout: false });
		it.layer(stdin.layer, { timeout: "30 seconds" })((it) => {
			it.effect("stdinIsTerminal is read from Stdio independently of stdout", () =>
				Effect.map(
					Effect.map(stdin.key, (t) => t.stdinIsTerminal),
					(stdin) => assert.strictEqual(stdin, true),
				),
			);
		});
	}

	{
		const stderrMirror = snapshot("TerminalEnv stderrMirror", { TERM: "xterm-256color" }, { stdout: true });
		it.layer(stderrMirror.layer, { timeout: "30 seconds" })((it) => {
			it.effect("stderr mirrors stdout when stderrIsTerminal is omitted", () =>
				Effect.map(
					Effect.map(stderrMirror.key, (t) => t.stderr),
					(stderr) => {
						assert.strictEqual(stderr.isTerminal, true);
						assert.strictEqual(stderr.color, "256");
					},
				),
			);
		});
	}

	{
		const stderrOff = snapshot(
			"TerminalEnv stderrOff",
			{
				TERM: "xterm-256color",
				TERM_PROGRAM: "iTerm.app",
				TERM_PROGRAM_VERSION: "3.5.0",
			},
			{ stdout: true },
			{ stderrIsTerminal: Effect.succeed(false) },
			false,
		);
		it.layer(stderrOff.layer, { timeout: "30 seconds" })((it) => {
			it.effect("stderrIsTerminal false gives stderr no colour while stdout keeps it", () =>
				Effect.map(stderrOff.key, (t) => {
					// Node's table reads TERM_PROGRAM (iTerm 3.5 → truecolor) before TERM.
					assert.strictEqual(t.stdout.color, "truecolor");
					assert.strictEqual(t.stderr.isTerminal, false);
					assert.strictEqual(t.stderr.color, "none");
					assert.strictEqual(t.stderr.hyperlinks, false);
					assert.strictEqual(t.stdout.hyperlinks, true);
				}),
			);
		});
	}

	{
		const unknownWidth = snapshot("TerminalEnv unknownWidth", {}, { stdout: true, columns: 0 });
		it.layer(unknownWidth.layer, { timeout: "30 seconds" })((it) => {
			it.effect("Terminal.columns 0 is None and width() is 80", () =>
				Effect.map(
					Effect.map(unknownWidth.key, (t) => [t.stdout.columns, t.width()] as const),
					([columns, width]) => {
						assertNone(columns);
						assert.strictEqual(width, 80);
					},
				),
			);
		});
	}

	{
		const invalidWidth = snapshot("TerminalEnv invalidWidth", { COLUMNS: "garbage" }, { stdout: true });
		const envWidth = snapshot("TerminalEnv envWidth", { COLUMNS: "100" }, { stdout: true });
		it.layer(Layer.mergeAll(invalidWidth.layer, envWidth.layer), { timeout: "30 seconds" })((it) => {
			it.effect("with no columns, COLUMNS supplies the width, then the fallback", () =>
				Effect.map(
					Effect.all([Effect.map(envWidth.key, (t) => t.width()), Effect.map(invalidWidth.key, (t) => t.width(60))]),
					([fromEnv, fallback]) => {
						assert.strictEqual(fromEnv, 100);
						assert.strictEqual(fallback, 60);
					},
				),
			);
		});
	}

	{
		const invalidWidths = ["-5", "0", "100abc", "abc", "1.5", " 100", "1e3"].map((value) =>
			snapshot("invalid COLUMNS " + value, { COLUMNS: value }, { stdout: true }),
		);
		const [first, ...rest] = invalidWidths;
		if (first === undefined) throw new Error("missing invalid COLUMNS fixtures");
		it.layer(Layer.mergeAll(first.layer, ...rest.map((fixture) => fixture.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("COLUMNS must be a positive integer: anything else falls back", () =>
				Effect.map(
					Effect.forEach(invalidWidths, (fixture) => Effect.map(fixture.key, (t) => t.width(60))),
					(widths) => assert.deepStrictEqual(widths, [60, 60, 60, 60, 60, 60, 60]),
				),
			);
		});
	}

	{
		const stderrOnly = snapshot(
			"TerminalEnv stderrOnly",
			{
				TERM: "xterm-256color",
				TERM_PROGRAM: "iTerm.app",
				TERM_PROGRAM_VERSION: "3.5.0",
			},
			{ stdout: false },
			{ stderrIsTerminal: Effect.succeed(true) },
			false,
		);
		it.layer(stderrOnly.layer, { timeout: "30 seconds" })((it) => {
			it.effect("a stderr that is a TTY under a non-TTY stdout gets colour and hyperlinks; stdout gets none", () =>
				Effect.map(stderrOnly.key, (t) => {
					assert.strictEqual(t.stdout.isTerminal, false);
					assert.strictEqual(t.stdout.color, "none");
					assert.strictEqual(t.stdout.hyperlinks, false);
					assert.strictEqual(t.stderr.isTerminal, true);
					assert.strictEqual(t.stderr.color, "truecolor");
					assert.strictEqual(t.stderr.hyperlinks, true);
				}),
			);
		});
	}

	{
		const terminalWidth = snapshot("TerminalEnv terminalWidth", { COLUMNS: "100" }, { stdout: true, columns: 120 });
		it.layer(terminalWidth.layer, { timeout: "30 seconds" })((it) => {
			it.effect("Terminal.columns 120 is Some(120) and beats both COLUMNS and the fallback", () =>
				Effect.map(
					Effect.map(terminalWidth.key, (t) => [t.stdout.columns, t.width(60)] as const),
					([columns, width]) => {
						assertSome(columns, 120);
						assert.strictEqual(width, 120);
					},
				),
			);
		});
	}
});

describe("TerminalEnv.layerStdio", () => {
	{
		const stdioOnly = snapshot("TerminalEnv stdioOnly", {}, { stdout: true }, undefined, true);
		it.layer(stdioOnly.layer, { timeout: "30 seconds" })((it) => {
			it.effect("needs only Stdio, and reports no columns whatever the terminal would say", () =>
				Effect.map(stdioOnly.key, (t) => {
					assertNone(t.stdout.columns);
					assertNone(t.stderr.columns);
					assert.strictEqual(t.width(), 80);
				}),
			);
		});
	}

	{
		const stdioWidth = snapshot("TerminalEnv stdioWidth", { COLUMNS: "132" }, { stdout: true }, undefined, true);
		it.layer(stdioWidth.layer, { timeout: "30 seconds" })((it) => {
			it.effect("the width comes from COLUMNS, then the fallback", () =>
				Effect.map(
					Effect.map(stdioWidth.key, (t) => [t.width(), t.width(40)]),
					(widths) => assert.deepStrictEqual(widths, [132, 132]),
				),
			);
		});
	}

	{
		const fullFixture = snapshot(
			"TerminalEnv fullFixture",
			{
				TERM: "xterm-256color",
				TERM_PROGRAM: "iTerm.app",
				TERM_PROGRAM_VERSION: "3.5.0",
			},
			{ stdin: true, stdout: true, columns: 120 },
		);
		const stdioFixture = snapshot(
			"TerminalEnv stdioFixture",
			{
				TERM: "xterm-256color",
				TERM_PROGRAM: "iTerm.app",
				TERM_PROGRAM_VERSION: "3.5.0",
			},
			{ stdin: true, stdout: true },
			undefined,
			true,
		);
		it.layer(Layer.mergeAll(fullFixture.layer, stdioFixture.layer), { timeout: "30 seconds" })((it) => {
			it.effect("everything but columns agrees with TerminalEnv.layer over the same facts", () =>
				Effect.gen(function* () {
					const stdioOnly = yield* stdioFixture.key;
					const full = yield* fullFixture.key;
					assert.strictEqual(stdioOnly.stdinIsTerminal, full.stdinIsTerminal);
					assert.deepStrictEqual({ ...stdioOnly.stdout, columns: O.none() }, { ...full.stdout, columns: O.none() });
					assert.deepStrictEqual({ ...stdioOnly.stderr, columns: O.none() }, { ...full.stderr, columns: O.none() });
					assertSome(full.stdout.columns, 120);
				}),
			);
		});
	}

	const override = snapshot(
		"stderr override",
		{ TERM: "xterm-256color" },
		{ stdout: true },
		{ stderrIsTerminal: Effect.succeed(false) },
		true,
	);
	it.layer(override.layer, { timeout: "30 seconds" })((it) => {
		it.effect("stderrIsTerminal overrides the stderr check, as it does for layer", () =>
			Effect.gen(function* () {
				const t = yield* override.key;
				assert.strictEqual(t.stdout.color, "256");
				assert.strictEqual(t.stderr.color, "none");
			}),
		);
	});
});

describe("TerminalEnv.layerTest", () => {
	// No Stdio, no Terminal, no ConfigProvider is provided: this compiling is the type-level check that the layer
	// has no requirements, and running is the behavioural one.
	it.layer(TerminalEnv.layerTest(), { timeout: "30 seconds" })((it) => {
		it.effect("is quiet by default and needs no platform services", () =>
			Effect.gen(function* () {
				const t = yield* TerminalEnv;
				assert.strictEqual(t.stdinIsTerminal, false);
				for (const stream of [t.stdout, t.stderr]) {
					assert.deepStrictEqual(stream, {
						isTerminal: false,
						color: "none",
						hyperlinks: false,
						columns: O.none(),
					});
				}
				assert.strictEqual(t.width(), 80);
			}),
		);
	});

	it.layer(
		TerminalEnv.layerTest({
			stdout: { color: "truecolor", columns: O.some(90) },
			stderr: { color: "none" },
		}),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("a test opts into colour per stream", () =>
			Effect.gen(function* () {
				const t = yield* TerminalEnv;
				assert.strictEqual(t.stdout.color, "truecolor");
				assert.strictEqual(t.stderr.color, "none");
				assertSome(t.stdout.columns, 90);
				assert.strictEqual(t.width(), 90);
			}),
		);
	});
});

describe("TerminalEnv.colorLevel", () => {
	it.layer(
		Layer.mergeAll(
			stdio({ stdout: false }),
			Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ FORCE_COLOR: "2" })),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("FORCE_COLOR=2 gives 256 on a non-TTY stdout", () =>
			Effect.map(TerminalEnv.colorLevel("stdout"), (level) => assert.strictEqual(level, "256")),
		);
	});

	it.layer(
		Layer.mergeAll(
			stdio({ stdout: true }),
			Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ TERM: "xterm-256color" })),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("needs only Stdio: it is assignable to Effect<ColorLevel, never, Stdio> (no Terminal in R)", () => {
			const program = TerminalEnv.colorLevel("stdout") satisfies Effect.Effect<ColorLevel, never, Stdio.Stdio>;
			// A TTY stdout with no colour variables: the terminal table, not the TTY gate, decides.
			return Effect.map(program, (level) => assert.strictEqual(level, "256"));
		});
	});

	it.layer(
		Layer.mergeAll(
			TerminalEnv.layerTest({ stdout: { color: "256" } }),
			stdio({ stdout: false }),
			Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("defers to an ambient TerminalEnv: its stdout colour wins over the Config and Stdio computation", () =>
			Effect.map(TerminalEnv.colorLevel("stdout"), (level) => assert.strictEqual(level, "256")),
		);
	});

	it.effect("the named options types are the ones layer and layerTest take", () => {
		const layerOptions: TerminalEnvOptions = {
			stderrIsTerminal: Effect.succeed(true),
		};
		const testOptions: TerminalEnvTestOptions = {
			stdinIsTerminal: true,
			stdout: { color: "basic" },
		};
		assert.isDefined(TerminalEnv.layer(layerOptions));
		assert.isDefined(TerminalEnv.layerTest(testOptions));
		return Effect.void;
	});

	it.layer(
		Layer.mergeAll(
			stdio({ stdout: false }),
			Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ TERM: "xterm-256color" })),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("a non-TTY stdout without FORCE_COLOR is none", () =>
			Effect.map(TerminalEnv.colorLevel("stdout"), (level) => assert.strictEqual(level, "none")),
		);
	});
});
