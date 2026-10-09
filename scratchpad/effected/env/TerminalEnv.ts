import { $ScratchpadId } from "@beep/identity/packages";
import type * as StdioModule from "effect/Stdio";
import type * as TerminalModule from "effect/Terminal";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";
import { ColorLevel } from "./ColorLevel.ts";
import { colorDepth, colorKeys } from "./internal/colorDepth.ts";
import { readEnv } from "./internal/envRecord.ts";
import { allKeys } from "./internal/keys.ts";
import { detectOsc8 } from "./internal/osc8/detect.ts";

const $I = $ScratchpadId.create("effected/env/TerminalEnv");

/**
 * What one output stream can do.
 *
 * **Example** (Validate a quiet output stream)
 *
 * ```ts
 * import { StreamEnv } from "@beep/scratchpad/effected/env/TerminalEnv";
 * import * as S from "effect/Schema";
 * import * as O from "effect/Option";
 * console.log(S.is(StreamEnv)({
 *   isTerminal: false, color: "none", hyperlinks: false, columns: O.none(),
 * })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const StreamEnv = S.Struct({
	/** Whether the stream is attached to a terminal. */
	isTerminal: S.Boolean.pipe($I.annoteKey("StreamEnv.isTerminal", { description: "Whether the stream is attached to a terminal." })),
	/** The colour level: `none` unless the stream is a terminal or `FORCE_COLOR` says otherwise. */
	color: ColorLevel.pipe($I.annoteKey("StreamEnv.color", { description: "The colour level: none unless the stream is a terminal or FORCE_COLOR says otherwise." })),
	/**
  * Whether the terminal can render OSC 8 hyperlinks on this stream.
  *
  * **Details**
  *
  * Decided in this order: a truthy `FORCE_HYPERLINK` turns links on, even on a stream that is not a terminal; a
  * truthy `NO_HYPERLINK` or a non-empty `NO_COLOR` turns them off; then the stream must be a terminal, not inside a
  * multiplexer that strips them (tmux, GNU screen), and a known terminal at a version that renders them.
  *
  * This is terminal capability only and does not consider the audience. Turning links off for an agent audience
  * is applied by `@effected/cli`, where the audience is known.
  */
	hyperlinks: S.Boolean.pipe($I.annoteKey("StreamEnv.hyperlinks", { description: "Whether the terminal can render OSC 8 hyperlinks on this stream." })),
	/**
  * The terminal width in columns, or `None` when it is unknown.
  *
  * **Gotchas**
  *
  * Core's `Terminal` exposes one width, so `stderr.columns` reports stdout's width.
  */
	columns: S.Option(S.declare(P.isNumber, $I.annote("StreamColumns", {
		description: "A stream column number, retaining the full JavaScript number domain accepted by stream snapshots.",
	}))).pipe($I.annoteKey("StreamEnv.columns", { description: "The terminal width in columns, or None when it is unknown." })),
}).annotate($I.annote("StreamEnv", { description: "What one output stream can do: terminal attachment, colour, hyperlinks and optional columns." }));

/**
 * Describes a stream's terminal attachment, colour, hyperlink support, and optional width.
 *
 * @category type-level
 * @since 0.0.0
 */
export type StreamEnv = typeof StreamEnv.Type;

/**
 * The options {@link TerminalEnv.layer} takes.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface TerminalEnvOptions {
	/** Overrides the stderr TTY check; `Stdio` reports only stdout, so stderr mirrors stdout when this is omitted. */
	readonly stderrIsTerminal?: Effect.Effect<boolean>;
}

/**
 * The options {@link TerminalEnv.layerTest} takes: fields to set over the quiet terminal.
 *
 * @public
 * @category models
 * @since 0.0.0
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
 * @category models
 * @since 0.0.0
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
const snapshot = Effect.fn("snapshot")(function* (
	options: TerminalEnvOptions | undefined,
	columns: O.Option<number>,
): Effect.fn.Return<TerminalEnvShape, never, StdioModule.Stdio> {
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
 * **Details**
 *
 * `layer` reads the environment through `Config` and the TTY state through `Stdio` and `Terminal` once, when it
 * is built. `layerTest` is the only way a test changes it, and defaults to a quiet terminal so a test opts into
 * colour. `colorLevel` needs `Stdio` alone, so a caller that only decides colour never requires `Terminal`.
 *
 * **Example** (Read colour and width from a fixed terminal)
 *
 * ```ts
 * import { TerminalEnv } from "@beep/scratchpad/effected/env/TerminalEnv";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * const program = Effect.map(TerminalEnv, (value) => `${value.stdout.color}, ${value.width()}`).pipe(
 *   Effect.provide(TerminalEnv.layerTest({ stdout: { color: "256", columns: O.some(100) } })),
 * );
 * console.log(Effect.runSync(program)) // 256, 100
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class TerminalEnv extends Context.Service<TerminalEnv, TerminalEnvShape>()($I`TerminalEnv`) {
	/**
	 * Build the snapshot from `Stdio`, `Terminal` and the ambient `ConfigProvider`.
	 *
	 * **Details**
	 *
	 * `Stdio` reports only stdout, so stderr mirrors it unless `options.stderrIsTerminal` supplies its own answer.
	 * A layer-returning function mints a fresh layer per call: call it once and bind the result to a constant.
	 *
	 * **Example** (Construct a platform-backed terminal read)
	 *
	 * ```ts
	 * import { TerminalEnv } from "@beep/scratchpad/effected/env/TerminalEnv";
	 * import * as Effect from "effect/Effect";
	 * const TerminalLive = TerminalEnv.layer();
	 * const program = Effect.map(TerminalEnv, (value) => value.width()).pipe(Effect.provide(TerminalLive));
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @param options - `stderrIsTerminal` overrides the stderr TTY check
	 * @category layers
	 * @since 0.0.0
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
	 * **Details**
	 *
	 * Everything else is what {@link TerminalEnv.layer} reports: the TTY facts come from `Stdio`, the colour and
	 * hyperlink decisions from the environment, and `width()` falls back to `COLUMNS`, then the fallback, since no
	 * terminal width is known. Use it where building the platform `Terminal` has a cost, for example a long-lived
	 * host, where `NodeTerminal` listens on `process.stdin`. A layer-returning function mints a fresh layer per
	 * call: call it once and bind the result to a constant.
	 *
	 * **Example** (Construct a snapshot without Terminal)
	 *
	 * ```ts
	 * import { TerminalEnv } from "@beep/scratchpad/effected/env/TerminalEnv";
	 * import * as Effect from "effect/Effect";
	 * const TerminalLive = TerminalEnv.layerStdio();
	 * const program = Effect.map(TerminalEnv, (value) => value.width()).pipe(Effect.provide(TerminalLive));
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @param options - `stderrIsTerminal` overrides the stderr TTY check
	 * @category layers
	 * @since 0.0.0
	 */
	static layerStdio(options?: TerminalEnvOptions): Layer.Layer<TerminalEnv, never, StdioModule.Stdio> {
		return Layer.effect(TerminalEnv, snapshot(options, O.none()));
	}

	/**
	 * A fixed snapshot that touches neither `Stdio`, `Terminal` nor `Config`. Everything is quiet unless a field of
	 * `partial` sets it.
	 *
	 * **Example** (Use the quiet terminal fallback width)
	 *
	 * ```ts
	 * import { TerminalEnv } from "@beep/scratchpad/effected/env/TerminalEnv";
	 * import * as Effect from "effect/Effect";
	 * const program = Effect.map(TerminalEnv, (value) => value.width()).pipe(
	 *   Effect.provide(TerminalEnv.layerTest()),
	 * );
	 * console.log(Effect.runSync(program)) // 80
	 * ```
	 *
	 * @param partial - the fields to set; `stdout` and `stderr` are merged over the quiet stream
	 * @category layers
	 * @since 0.0.0
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
	 * **Details**
	 *
	 * An ambient `TerminalEnv`, when one is provided, answers with its stdout colour, so a test that fixes the
	 * terminal with `layerTest` also fixes this. Without one it is decided from `Config` and `Stdio` alone. It
	 * requires only `Stdio`, never `Terminal` or `TerminalEnv`, so a caller that only decides colour (a CLI's
	 * output formatter) keeps a `Stdio`-only requirement.
	 *
	 * **Example** (Construct a stdout colour decision)
	 *
	 * ```ts
	 * import { TerminalEnv } from "@beep/scratchpad/effected/env/TerminalEnv";
	 * import * as Effect from "effect/Effect";
	 * const program = TerminalEnv.colorLevel("stdout");
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @param _stream - the stream to decide for; only `stdout` is available, since `Stdio` reports no other
	 * @category utilities
	 * @since 0.0.0
	 */
	static readonly colorLevel = Effect.fn("colorLevel")(function* (_stream: "stdout"): Effect.fn.Return<ColorLevel, never, StdioModule.Stdio> {
		const ambient = yield* Effect.serviceOption(TerminalEnv);
		if (O.isSome(ambient)) return ambient.value.stdout.color;
		const stdio = yield* Stdio.Stdio;
		const isTTY = yield* stdio.stdoutIsTerminal;
		return colorDepth(yield* readEnv(colorKeys), isTTY);
	});
}
