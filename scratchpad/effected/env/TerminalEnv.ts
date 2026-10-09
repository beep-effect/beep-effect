import type * as StdioModule from "effect/Stdio";
import type * as TerminalModule from "effect/Terminal";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";
import type { ColorLevel } from "./ColorLevel.ts";
import { colorDepth, colorKeys } from "./internal/colorDepth.ts";
import { readEnv } from "./internal/envRecord.ts";
import { allKeys } from "./internal/keys.ts";
import { detectOsc8 } from "./internal/osc8/detect.ts";

/**
 * What one output stream can do.
 *
 * @public
 */
export interface StreamEnv {
	/** Whether the stream is attached to a terminal. */
	readonly isTerminal: boolean;
	/** The colour level: `none` unless the stream is a terminal or `FORCE_COLOR` says otherwise. */
	readonly color: ColorLevel;
	/**
	 * Whether the terminal can render OSC 8 hyperlinks on this stream.
	 *
	 * @remarks
	 * Decided in this order: a truthy `FORCE_HYPERLINK` turns links on, even on a stream that is not a terminal; a
	 * truthy `NO_HYPERLINK` or a non-empty `NO_COLOR` turns them off; then the stream must be a terminal, not inside a
	 * multiplexer that strips them (tmux, GNU screen), and a known terminal at a version that renders them.
	 *
	 * This is terminal capability only and does not consider the audience. Turning links off for an agent audience
	 * is applied by `@effected/cli`, where the audience is known.
	 */
	readonly hyperlinks: boolean;
	/**
	 * The terminal width in columns, or `None` when it is unknown.
	 *
	 * @remarks
	 * Core's `Terminal` exposes one width, so `stderr.columns` reports stdout's width.
	 */
	readonly columns: O.Option<number>;
}

/**
 * The options {@link TerminalEnv.layer} takes.
 *
 * @public
 */
export interface TerminalEnvOptions {
	/** Overrides the stderr TTY check; `Stdio` reports only stdout, so stderr mirrors stdout when this is omitted. */
	readonly stderrIsTerminal?: Effect.Effect<boolean>;
}

/**
 * The options {@link TerminalEnv.layerTest} takes: fields to set over the quiet terminal.
 *
 * @public
 */
export interface TerminalEnvTestOptions {
	/** Whether standard input is a terminal. */
	readonly stdinIsTerminal?: boolean;
	/** Fields merged over the quiet stdout. */
	readonly stdout?: Partial<StreamEnv>;
	/** Fields merged over the quiet stderr. */
	readonly stderr?: Partial<StreamEnv>;
}

/**
 * The shape of the {@link TerminalEnv} service: a snapshot taken when the layer is built, not a live view.
 *
 * @public
 */
export interface TerminalEnvShape {
	/** Whether standard input is attached to a terminal. */
	readonly stdinIsTerminal: boolean;
	/** The capabilities of standard output. */
	readonly stdout: StreamEnv;
	/** The capabilities of standard error; its `columns` is stdout's width, since core's `Terminal` has one. */
	readonly stderr: StreamEnv;
	/**
	 * The width to lay output out at: the stdout columns, else the `COLUMNS` variable, else `fallback`.
	 *
	 * @param fallback - the width when nothing else is known; defaults to 80
	 */
	readonly width: (fallback?: number) => number;
}

const make = (
	env: Readonly<Record<string, string | undefined>>,
	isTTY: { readonly stdin: boolean; readonly stdout: boolean; readonly stderr: boolean },
	columns: O.Option<number>,
): TerminalEnvShape => {
	const links = detectOsc8(env, isTTY.stdout, isTTY.stderr);
	// COLUMNS counts only as a positive integer: "-5", "0", "100abc" and "abc" all fall through to the fallback.
	const fromEnv = /^\d+$/.test(env.COLUMNS ?? "") ? Number(env.COLUMNS) : 0;
	return {
		stdinIsTerminal: isTTY.stdin,
		stdout: { isTerminal: isTTY.stdout, color: colorDepth(env, isTTY.stdout), hyperlinks: links.stdout, columns },
		stderr: { isTerminal: isTTY.stderr, color: colorDepth(env, isTTY.stderr), hyperlinks: links.stderr, columns },
		width: (fallback = 80) => O.getOrElse(columns, () => fromEnv || fallback),
	};
};

/** Read the TTY facts from `Stdio` and the environment from `Config`, with the width the caller already knows. */
const snapshot = (
	options: TerminalEnvOptions | undefined,
	columns: O.Option<number>,
): Effect.Effect<TerminalEnvShape, never, StdioModule.Stdio> =>
	Effect.gen(function* () {
		const stdio = yield* Stdio.Stdio;
		const stdin = yield* stdio.stdinIsTerminal;
		const stdout = yield* stdio.stdoutIsTerminal;
		const stderr = yield* options?.stderrIsTerminal ?? Effect.succeed(stdout);
		const env = yield* readEnv([...allKeys, "COLUMNS"]);
		return make(env, { stdin, stdout, stderr }, columns);
	});

/** The quiet terminal {@link TerminalEnv.layerTest} starts from: not a terminal, no colour, no links, no width. */
const quiet: StreamEnv = { isTerminal: false, color: "none", hyperlinks: false, columns: O.none() };

/**
 * What the terminal can do: per-stream colour level, hyperlink support and columns, and the width to lay out at.
 *
 * @remarks
 * `layer` reads the environment through `Config` and the TTY state through `Stdio` and `Terminal` once, when it
 * is built. `layerTest` is the only way a test changes it, and defaults to a quiet terminal so a test opts into
 * colour. `colorLevel` needs `Stdio` alone, so a caller that only decides colour never requires `Terminal`.
 *
 * @example
 * ```ts
 * import { TerminalEnv } from "./index.ts"
 * import { Effect, Option } from "effect"
 *
 * const program = Effect.gen(function* () {
 * 	const terminal = yield* TerminalEnv
 * 	return { color: terminal.stdout.color, width: terminal.width() }
 * }).pipe(Effect.provide(TerminalEnv.layerTest({ stdout: { color: "256", columns: Option.some(100) } })))
 * ```
 *
 * @public
 */
export class TerminalEnv extends Context.Service<TerminalEnv, TerminalEnvShape>()("@beep/scratchpad/effected/env/TerminalEnv") {
	/**
	 * Build the snapshot from `Stdio`, `Terminal` and the ambient `ConfigProvider`.
	 *
	 * @remarks
	 * `Stdio` reports only stdout, so stderr mirrors it unless `options.stderrIsTerminal` supplies its own answer.
	 * A layer-returning function mints a fresh layer per call: call it once and bind the result to a constant.
	 *
	 * @param options - `stderrIsTerminal` overrides the stderr TTY check
	 */
	static layer(
		options?: TerminalEnvOptions,
	): Layer.Layer<TerminalEnv, never, StdioModule.Stdio | TerminalModule.Terminal> {
		return Layer.effect(
			TerminalEnv,
			Effect.gen(function* () {
				const terminal = yield* Terminal.Terminal;
				const width = yield* terminal.columns;
				return yield* snapshot(options, width > 0 ? O.some(width) : O.none());
			}),
		);
	}

	/**
	 * The snapshot from `Stdio` and the ambient `ConfigProvider` alone: it never requires or builds `Terminal`, and
	 * reports no columns.
	 *
	 * @remarks
	 * Everything else is what {@link TerminalEnv.layer} reports: the TTY facts come from `Stdio`, the colour and
	 * hyperlink decisions from the environment, and `width()` falls back to `COLUMNS`, then the fallback, since no
	 * terminal width is known. Use it where building the platform `Terminal` has a cost, for example a long-lived
	 * host, where `NodeTerminal` listens on `process.stdin`. A layer-returning function mints a fresh layer per
	 * call: call it once and bind the result to a constant.
	 *
	 * @param options - `stderrIsTerminal` overrides the stderr TTY check
	 */
	static layerStdio(options?: TerminalEnvOptions): Layer.Layer<TerminalEnv, never, StdioModule.Stdio> {
		return Layer.effect(TerminalEnv, snapshot(options, O.none()));
	}

	/**
	 * A fixed snapshot that touches neither `Stdio`, `Terminal` nor `Config`. Everything is quiet unless a field of
	 * `partial` sets it.
	 *
	 * @param partial - the fields to set; `stdout` and `stderr` are merged over the quiet stream
	 */
	static readonly layerTest = (partial?: TerminalEnvTestOptions): Layer.Layer<TerminalEnv> => {
		const stdout: StreamEnv = { ...quiet, ...partial?.stdout };
		return Layer.succeed(TerminalEnv, {
			stdinIsTerminal: partial?.stdinIsTerminal ?? false,
			stdout,
			stderr: { ...quiet, ...partial?.stderr },
			width: (fallback = 80) => O.getOrElse(stdout.columns, () => fallback),
		});
	};

	/**
	 * The colour level of a stream.
	 *
	 * @remarks
	 * An ambient `TerminalEnv`, when one is provided, answers with its stdout colour, so a test that fixes the
	 * terminal with `layerTest` also fixes this. Without one it is decided from `Config` and `Stdio` alone. It
	 * requires only `Stdio`, never `Terminal` or `TerminalEnv`, so a caller that only decides colour (a CLI's
	 * output formatter) keeps a `Stdio`-only requirement.
	 *
	 * @param _stream - the stream to decide for; only `stdout` is available, since `Stdio` reports no other
	 */
	static colorLevel(_stream: "stdout"): Effect.Effect<ColorLevel, never, StdioModule.Stdio> {
		return Effect.gen(function* () {
			const ambient = yield* Effect.serviceOption(TerminalEnv);
			if (O.isSome(ambient)) return ambient.value.stdout.color;
			const stdio = yield* Stdio.Stdio;
			const isTTY = yield* stdio.stdoutIsTerminal;
			return colorDepth(yield* readEnv(colorKeys), isTTY);
		});
	}
}
