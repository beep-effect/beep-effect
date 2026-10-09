import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import type * as Fiber from "effect/Fiber";
import type * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as LogLevel from "effect/LogLevel";
import * as O from "@beep/utils/Option";
import * as PathModule from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as References from "effect/References";
import * as Str from "effect/String";
import type { AudienceKind, RuntimeEnv } from "../env/index.ts";
import { Audience, CurrentRuntimeEnv, TerminalEnv } from "../env/index.ts";
import { CommandNeutralizer } from "../github-commands/index.ts";
import type { CliLoggerOptions } from "./CliLogger.ts";
import { makeCliLogger } from "./CliLogger.ts";
import { CliTheme } from "./CliTheme.ts";
import { sanitize } from "./Fmt.ts";
import { paintStyle } from "./internal/ansi.ts";
import { Level, passes } from "./internal/diagnostics.ts";
import { makeFileSink } from "./internal/fileSink.ts";
import { TrustedLine, neutralizeJson } from "./internal/logSafety.ts";
import { scanAudience } from "./internal/scanAudience.ts";
import type { Status } from "./Status.ts";
import type { Style } from "./Token.ts";

/**
 * Options for `CliLog.status`.
 *
 * @public
 */
export interface CliLogStatusOptions {
	/**
	 * The level the line is logged at. By default it follows the status's rank in its vocabulary: `Error` at or above
	 * `failure`'s rank, `Warn` at or above `warning`'s, and `Info` below that.
	 */
	readonly level?: LogLevel.Severity | undefined;
	/**
	 * What the line starts with, before the glyph, so an indented report line keeps its place in a block: a number of
	 * spaces (floored, at most 64; zero, a negative or a non-finite number is none), or a string. A string is sanitised as text is (escapes and controls removed, a tab a space) and its line
	 * breaks dropped, so the indent can never carry an escape onto the trusted line. None by default.
	 */
	readonly indent?: number | string | undefined;
}

/** The most spaces a numeric `indent` writes. */
const MAX_INDENT = 64;

/** An indent as written before the glyph: spaces for a number, a string with nothing in it that is not text. */
const indentOf = (indent: number | string | undefined): string => {
	if (indent === undefined) return "";
	// Floored and capped: `indent: 1e12` would make `repeat` throw a RangeError inside the log call.
	if (P.isNumber(indent))
		return Number.isFinite(indent) && indent > 0 ? " ".repeat(Math.min(MAX_INDENT, Math.floor(indent))) : "";
	return sanitize(indent).replace(/\r\n|\r|\n/g, "");
};

/**
 * Options for `CliLog.layer`.
 *
 * @public
 */
export interface CliLogOptions {
	/**
  * The diagnostics level, for a host that has already decided it.
  *
  * **Details**
  *
  * Beats `envVar`, which is then not read at all (so a bad value there neither warns nor overrides this), and
  * loses to core's `--log-level` flag like every diagnostics level: the sink follows the flag while it is set.
  */
	readonly level?: LogLevel.LogLevel | undefined;
	/**
	 * The environment variable that sets the diagnostics level, for example `MYTOOL_LOG_LEVEL`. Read through
	 * `Config`, never `process`. Unset or empty means `None`. Ignored when `level` is given.
	 */
	readonly envVar?: string | undefined;
	/**
  * Whether to install the plain `CliLogger` for ordinary lines. `true` by default.
  *
  * **Details**
  *
  * `false` is the diagnostics-only mode for a library host (an MCP server, a test reporter): the layer installs
  * only the diagnostics sink, the file sink if any, and `extraLoggers`. With no level set as well, stderr gets
  * no output. An invalid level in `envVar` still prints its one warning line, through a private `CliLogger`,
  * since that is a configuration error the host should see.
  *
  * Only `CliLog`'s own records are silenced. Under `CliRuntime.main`, what the platform logs while it builds follows
  * the build-time format: in NDJSON (`json`, or `auto` for an agent or a CI) it goes through this layer, so `false`
  * silences it there as at runtime; otherwise it goes through a plain `CliLogger`, routed by `logger.stderrFrom` as the
  * host set it. The audience-override warning is a
  * configuration error and is never silenced: it is written exactly once, as NDJSON when the build-time format is
  * NDJSON and as a plain line otherwise, whatever this option says, to stderr alone (never stdout, whatever
  * `logger.stderrFrom` says) and never to `extraLoggers` or the file sink. The failure report and the `CliMessage` lines
  * always go through a plain `CliLogger`.
  */
	readonly plainLogger?: boolean | undefined;
	/**
  * `json` is NDJSON, `pretty` a human line, `auto` (the default) decides by the audience alone: NDJSON for an agent
  * or a CI, the pretty `CliLogger` line for a human, at build time and at runtime alike.
  *
  * **Details**
  *
  * Stderr's terminal state is never consulted, so a human piping stderr to a file gets plain lines, never a mix of
  * plain and NDJSON; colour still follows `stderr.color`, so those lines carry no escapes when stderr is not a colour
  * terminal. Pass `format: "json"` for machine-readable logs whoever runs the program.
  *
  * Under `CliRuntime.main` with `env.log`, what the platform logs while it builds is written before the platform
  * provides the terminal or the arguments, so `auto` decides those lines from what needs no platform: an audience
  * flag in {@link CliLogOptions.argv}, else the audience override variable (`env.audienceEnvVar`), else agent and
  * CI detection from the environment. An agent or a CI gets NDJSON, as its runtime lines are; anything else gets
  * a plain line, the same choice the runtime lines make. `json` is NDJSON and `pretty` plain throughout.
  */
	readonly format?: "auto" | "json" | "pretty" | undefined;
	/**
  * The program's arguments, for the format of what the platform logs while it builds under `CliRuntime.main` with
  * `format: "auto"`: an audience flag (`--agent`, `--ci`, `--human`, `--audience <kind>`) in them decides those
  * lines as it decides the run's. Only `CliRuntime.main` reads this.
  *
  * **Details**
  *
  * The arguments core parses come from the platform's `Stdio`, which does not exist until the platform is built, and
  * this package never reads `process`. A Node host passes `process.argv.slice(2)`; without it the build-time lines
  * follow the environment alone, so `--agent` with no agent detected gets plain lines until the platform is built.
  */
	readonly argv?: ReadonlyArray<string> | undefined;
	/** Options for the `CliLogger` this layer builds for ordinary log lines; see {@link CliLoggerOptions}. */
	readonly logger?: CliLoggerOptions | undefined;
	/**
  * Loggers to keep beside the `CliLogger` and the sink, for example a telemetry logger: the layer owns the
  * whole set, so anything not listed here is dropped.
  *
  * **Details**
  *
  * Each is floored at the `MinimumLogLevel` it had, like the `CliLogger`, so lowering the level for the
  * diagnostics sink never makes it see records it would not have seen otherwise.
  */
	readonly extraLoggers?: ReadonlyArray<Logger.Logger<unknown, unknown>> | undefined;
	/**
	 * Whether a line the GitHub Actions runner would read as a workflow command is neutralized. `auto`, the default,
	 * follows the `CurrentRuntimeEnv` of the fiber that logs, and where that fiber has none, `runtimeEnv`, else the one
	 * the layer was built with: a host that builds this layer over its environment covers records logged outside it
	 * too. `true` always neutralizes, `false` never does.
	 */
	readonly neutralize?: boolean | "auto" | undefined;
	/**
  * The runtime environment `neutralize: "auto"` falls back to for a record whose fiber has no `CurrentRuntimeEnv`.
  *
  * **Gotchas**
  *
  * Given, it is used in place of the `CurrentRuntimeEnv` the layer captured when it was built, and beats it; the
  * logging fiber's own `CurrentRuntimeEnv` still comes first. The capture is invisible in the layer's type (it is read
  * if present, never required), so a host that builds this layer outside its environment either passes the snapshot
  * here, for example `RuntimeEnv.fromRecord(process.env)`, or provides `CurrentRuntimeEnv` around the layer.
  *
  * Neutralization under `"auto"` reads the logging fiber's `CurrentRuntimeEnv`, then this option, then the
  * `CurrentRuntimeEnv` captured when the layer was built. With none of the three, a record is not neutralized: set
  * this option, provide `CurrentRuntimeEnv` around the layer, or pass `neutralize: true`. Every `CliLog.layer`
  * overload points here.
  */
	readonly runtimeEnv?: RuntimeEnv | undefined;
}

/**
 * Where the file sink writes: a literal path, or the environment variable that holds it.
 *
 * @public
 */
export type CliLogFile = { readonly envVar: string } | { readonly path: string };

/**
 * {@link CliLogOptions} with a file sink, which is what makes the layer require `FileSystem` and `Path`.
 *
 * @public
 */
export interface CliLogFileOptions extends CliLogOptions {
	/**
  * Also write every record the sink accepts to a file as NDJSON, asynchronously.
  *
  * **Details**
  *
  * The line is identical to the stderr NDJSON line for the same log call and is filtered by the same
  * {@link CliLog.Level}. Lines are queued and appended by a fiber scoped to the layer, so logging never waits
  * on the disk, and the parent directory is created. The first write error prints exactly one stderr line,
  * `diagnostics log file <path> failed: <message>; further file logging disabled`, and the program keeps
  * running with its normal exit code: from then on lines, including any still queued, are discarded silently.
  * Closing the layer's scope flushes the lines queued before it, unless the sink had already disabled itself.
  * `{ envVar }` names the variable that holds the path; unset or empty, no file is written.
  *
  * `undefined` writes no file but keeps the requirements of a file sink (`FileSystem` and `Path`) in `R`, so a
  * host whose sink is optional has one stable layer type either way.
  *
  * Under `CliRuntime.main` with `env.log`, what the platform logs while it builds, before it provides
  * `FileSystem`, reaches stderr but not the file; the file starts with the program's own records.
  */
	readonly file: CliLogFile | undefined;
}

/** The accepted spellings of a level, lower-cased, to the level they mean. */
const LEVELS: Readonly<Record<string, LogLevel.LogLevel>> = {
	all: "All",
	trace: "Trace",
	debug: "Debug",
	info: "Info",
	warn: "Warn",
	warning: "Warn",
	error: "Error",
	fatal: "Fatal",
	none: "None",
};

const LEVEL_STYLES: Readonly<Record<string, Style>> = {
	FATAL: { fg: "red", bold: true },
	ERROR: { fg: "red" },
	WARN: { fg: "yellow" },
	INFO: { fg: "cyan" },
	DEBUG: { fg: "blue" },
	TRACE: { dim: true },
};

/** The diagnostics level: the option when given, else the env var, and the raw text when that is not a level. */
const readLevel = Effect.fn("readLevel")(function* (
	explicit: LogLevel.LogLevel | undefined,
	envVar: string | undefined,
): Effect.fn.Return<{ readonly level: LogLevel.LogLevel; readonly invalid: string | undefined }> {
	if (explicit !== undefined) return { level: explicit, invalid: undefined };
	if (envVar === undefined) return { level: "None", invalid: undefined };
	const raw = yield* Config.option(Config.String(envVar)).pipe(Effect.orElseSucceed(O.none<string>));
	if (O.isNone(raw) || raw.value === "") return { level: "None", invalid: undefined };
	const key = Str.toLowerCase(raw.value);
	const level = R.has(LEVELS, key) ? LEVELS[key] : undefined;
	if (level !== undefined) return { level, invalid: undefined };
	return {
		level: "None",
		invalid: `${envVar}=${raw.value} is not a log level (${R.keys(LEVELS).join("|")}); ignoring it`,
	};
});

/**
 * Whether a record's line is neutralized: the `neutralize` option when it is a boolean, else whether the logging
 * fiber's `CurrentRuntimeEnv`, or `fallback` where the fiber has none, says GitHub Actions.
 */
const actionsDecision =
	(neutralize: boolean | "auto", fallback: O.Option<RuntimeEnv>) =>
	(fiber: Fiber.Fiber<unknown, unknown>): boolean => {
		if (neutralize !== "auto") return neutralize;
		const inFiber = Context.getOption(fiber.context, CurrentRuntimeEnv);
		const runtime = O.isSome(inFiber) ? inFiber : fallback;
		return O.contains(
			O.flatMap(runtime, (env) => env.ci),
			"github-actions",
		);
	};

/**
 * Diagnostics kept apart from a program's output: a level, a format and a place to write.
 *
 * **Details**
 *
 * Two kinds of line must never be silenced by a diagnostics default: the failure report
 * `CliRuntime.reportFailures` writes through `CliLogger`, and the `CliMessage` lines. This package therefore
 * never makes the diagnostics level a global switch. The diagnostics logger filters on its **own** threshold,
 * {@link CliLog.Level}, and writes to stderr only.
 *
 * `CliLog.layer` **owns the whole logger set**. It builds a `CliLogger` for ordinary log lines and the
 * diagnostics sink itself and replaces whatever was installed, without reading it, so there is no order to get
 * wrong. Use it instead of `CliLogger.layer`, not with it: `CliLogger.layer` alone is the no-diagnostics path,
 * and a `CliLogger.layer` layered on top would replace this layer's set.
 *
 * Effect drops a record below `MinimumLogLevel` before any logger runs, so to let a debug record reach the
 * diagnostics logger `MinimumLogLevel` has to be lowered. `CliLog.layer` does that only when the
 * diagnostics level is below the ambient minimum, and in the same step floors the `CliLogger` it built at the
 * minimum it had, so it never prints a record the diagnostics level alone let through. A failure report is
 * written outside the scope core's `--log-level` flag sets, so `--log-level none` does not silence it either.
 *
 * `format: "auto"`, the default, decides by the audience alone, at build time and at runtime alike: NDJSON for an
 * agent or a CI, the pretty line for a human, whatever stderr's terminal state. A human piping stderr therefore gets
 * plain lines (without escapes unless stderr is a colour terminal); pass `format: "json"` for machine-readable logs.
 *
 * The text a program logs is sanitised before anything is painted in the pretty line (the message, the component and an
 * error's cause lose their escape sequences and control characters), and under GitHub Actions, where
 * `CurrentRuntimeEnv` in the logging fiber's context says so, a line the runner would read as a workflow command is
 * neutralized. An NDJSON record is not safe merely because `JSON.stringify` escapes control characters: the runner's
 * legacy parser reads `##[` anywhere in a line, so under Actions it is written as the JSON escape `#\u0023[`, which
 * decodes to the identical text. The file sink's lines are not read by the runner and are written as they are.
 *
 * `CurrentRuntimeEnv` is read from the logging fiber's context, and where that has none, from the `runtimeEnv` option,
 * else from the layer's own build context (captured if present, never required), so a host that builds the layer over
 * its environment, or names it with `runtimeEnv`, neutralizes every record. A record with none of the three (a program
 * with no `CurrentRuntimeEnv` anywhere) is sanitised but not neutralized, unless the `neutralize` option says otherwise.
 *
 * Core's `--log-level` flag sets `MinimumLogLevel` inside the command. While it is set to something other than
 * the value this layer installed, the diagnostics logger follows the flag instead of its own level: it writes
 * every record that reaches it. The `CliLogger` prints the same record too, so a record at or above the ambient
 * minimum is written twice, once plain and once to the diagnostics sink. Stderr is therefore not pure NDJSON while
 * diagnostics are on: a parser reads the lines that start with `{`.
 *
 * One edge: a `--log-level` value that EQUALS the level this layer installed cannot be told from no flag, so the
 * sink keeps filtering on its own level rather than following the flag. The plain `CliLogger` prints those records
 * regardless.
 *
 * **Example** (Enable diagnostics with an environment variable)
 *
 * ```ts
 * import { CliRuntime } from "./index.ts"
 * import { NodeRuntime, NodeServices } from "@effect/platform-node"
 *
 * // `env.log` makes `main` install `CliLog.layer`: set MYTOOL_LOG_LEVEL=debug to get diagnostics on stderr.
 * NodeRuntime.runMain(
 *   CliRuntime.main(program, {
 *     platform: NodeServices.layer,
 *     env: { audienceEnvVar: "MYTOOL_AUDIENCE", log: { envVar: "MYTOOL_LOG_LEVEL" } },
 *   }),
 * )
 * ```
 *
 * @public
 */
export class CliLog {
	private constructor() {}

	/**
  * The diagnostics threshold. Defaults to `None`, silent.
  *
  * **Details**
  *
  * `CliLog.layer` sets it from the environment variable. A scope may raise it to narrow the output; it
  * cannot lower it below the level the layer installed, because Effect has already dropped those records.
  */
	static readonly Level: Context.Reference<LogLevel.LogLevel> = Level;

	/**
  * The whole logger set of a program: a `CliLogger` for ordinary lines plus the diagnostics sink.
  *
  * **Details**
  *
  * Replaces the installed loggers without reading them. Provide it on the program you pass to
  * `CliRuntime.main`, or use `main`'s `env.log` option; never wrap it around `main`, whose own logger would
  * replace this one. Bind it to a constant.
  *
  * The requirements follow the format. `format: "json"` reads neither the audience nor the terminal, so it
  * requires neither; `"pretty"` requires `TerminalEnv` alone, for the stderr colour; `"auto"` and an omitted
  * format require both. A long-lived host that never builds a platform `Terminal` can provide
  * `TerminalEnv.layerStdio()` for the pretty case.
  *
  * A platform or program that installs its own `Logger.layer([...])` replaces this set: do not. The diagnostics
  * then go silent with no error.
  *
  * The NDJSON line is core's `Logger.formatJson`, unchanged so it stays interoperable with Effect tooling: the
  * `message` field is a string for one log argument and an array for several.
  *
  * Level parsing is case-insensitive and accepts `warn`, `warning`, `error`, `info`, `debug`, `trace`,
  * `fatal`, `all` and `none`. An invalid value warns once, through the `CliLogger`, and leaves diagnostics
  * off.
  *
  * With a `file` option ({@link CliLogFileOptions}) the layer also writes an async NDJSON file, and only then
  * does it require `FileSystem` and `Path`, and it leaves them in `R` unprovided: the platform supplies them, or
  * a test supplies a memory filesystem, so a host never provides Node inside its own layer.
  *
  * Without a `CurrentRuntimeEnv` around the layer, `"auto"` does not neutralize: see {@link CliLogOptions.runtimeEnv}.
  *
  * @param options - the level, the env var, the format, the `CliLogger` options and the optional file sink
  */
	static layer(
		options: CliLogOptions & { readonly format: "json"; readonly file?: undefined },
	): Layer.Layer<never, never, never>;
	/**
  * The logger set with NDJSON diagnostics and a file sink; see the first overload.
  *
  * **Gotchas**
  *
  * Without a `CurrentRuntimeEnv` around the layer, `"auto"` does not neutralize: see {@link CliLogOptions.runtimeEnv}.
  *
  * @param options - the level, the env var, the `CliLogger` options and the file sink
  */
	static layer(
		options: CliLogFileOptions & { readonly format: "json" },
	): Layer.Layer<never, never, FileSystem.FileSystem | PathModule.Path>;
	/**
  * The logger set with pretty diagnostics; see the first overload.
  *
  * **Gotchas**
  *
  * Without a `CurrentRuntimeEnv` around the layer, `"auto"` does not neutralize: see {@link CliLogOptions.runtimeEnv}.
  *
  * @param options - the level, the env var and the `CliLogger` options
  */
	static layer(
		options: CliLogOptions & { readonly format: "pretty"; readonly file?: undefined },
	): Layer.Layer<never, never, TerminalEnv>;
	/**
  * The logger set with pretty diagnostics and a file sink; see the first overload.
  *
  * **Gotchas**
  *
  * Without a `CurrentRuntimeEnv` around the layer, `"auto"` does not neutralize: see {@link CliLogOptions.runtimeEnv}.
  *
  * @param options - the level, the env var, the `CliLogger` options and the file sink
  */
	static layer(
		options: CliLogFileOptions & { readonly format: "pretty" },
	): Layer.Layer<never, never, TerminalEnv | FileSystem.FileSystem | PathModule.Path>;
	/**
  * The logger set with the format decided by the audience; see the first overload.
  *
  * **Gotchas**
  *
  * Without a `CurrentRuntimeEnv` around the layer, `"auto"` does not neutralize: see {@link CliLogOptions.runtimeEnv}.
  *
  * @param options - the level, the env var, the format and the `CliLogger` options
  */
	static layer(
		options?: CliLogOptions & { readonly file?: undefined },
	): Layer.Layer<never, never, Audience | TerminalEnv>;
	/**
  * The logger set with the format decided by the audience, and a file sink; see the first overload.
  *
  * **Gotchas**
  *
  * Without a `CurrentRuntimeEnv` around the layer, `"auto"` does not neutralize: see {@link CliLogOptions.runtimeEnv}.
  *
  * @param options - the level, the env var, the format, the `CliLogger` options and the file sink
  */
	static layer(
		options: CliLogFileOptions,
	): Layer.Layer<never, never, Audience | TerminalEnv | FileSystem.FileSystem | PathModule.Path>;
	static layer(
		options: CliLogOptions | CliLogFileOptions = {},
	): Layer.Layer<never, never, Audience | TerminalEnv | FileSystem.FileSystem | PathModule.Path> {
		const file = "file" in options ? options.file : undefined;
		const format = options.format ?? "auto";
		return Layer.unwrap(
			Effect.gen(function* () {
				// Read only what the format needs, so a fixed format never requires the rest (the overloads say so).
				const audience = format === "auto" ? yield* Audience : undefined;
				const terminal = format === "json" ? undefined : yield* TerminalEnv;
				const { level, invalid } = yield* readLevel(options.level, options.envVar);
				const ambient = yield* References.MinimumLogLevel;
				// Captured here, not required: the fallback for a record whose own fiber has no CurrentRuntimeEnv.
				const captured = yield* Effect.serviceOption(CurrentRuntimeEnv);
				// The option beats the capture: a host that names its environment means it.
				const fallback = options.runtimeEnv === undefined ? captured : O.some(options.runtimeEnv);
				const underActionsIn = actionsDecision(options.neutralize ?? "auto", fallback);

				const color = terminal?.stderr.color ?? "none";
				// Decided per record, not once at build: the logger is built outermost, before an audience flag is read,
				// so the format follows the `Audience` in force in the fiber that logs (`CliAudience.run` provides it
				// around the whole run), falling back to the one the layer was built with.
				const isPretty = (record: Logger.Options<unknown>): boolean => {
					if (format !== "auto") return format === "pretty";
					const inForce = Context.getOption(record.fiber.context, Audience);
					const kind = O.isSome(inForce) ? inForce.value.kind : audience?.kind;
					// The audience alone decides, as it does at build time: stderr's terminal state is never consulted.
					return kind === "human";
				};

				// Effect filters on MinimumLogLevel before any logger runs: lower it just far enough for the sink.
				const lowered = LogLevel.isLessThan(level, ambient) ? level : ambient;
				const isLowered = lowered !== ambient;

				const render = (record: Logger.Options<unknown>): string => {
					const underActions = underActionsIn(record.fiber);
					// NDJSON: JSON.stringify escapes every control character, but the runner's legacy parser reads `##[`
					// anywhere in a line, so under Actions it is written as a JSON escape that decodes to the same text.
					if (!isPretty(record)) {
						const json = Logger.formatJson.log(record);
						return underActions ? neutralizeJson(json) : json;
					}
					const annotations = record.fiber.getRef(References.CurrentLogAnnotations);
					// The program's text is sanitised before anything is painted, and the line is neutralized last.
					const component = annotations.component === undefined ? "" : ` [${sanitize(String(annotations.component))}]`;
					const message = sanitize(
						A.isArray(record.message) ? record.message.map(String).join(" ") : String(record.message),
					);
					const name = record.logLevel.toUpperCase();
					const levelText = paintStyle(LEVEL_STYLES[name] ?? {}, color, name);
					const cause = record.cause.reasons.length > 0 ? `\n${record.cause.pipe(Cause.pretty, sanitize)}` : "";
					const line = `${record.date.toISOString().slice(11, 23)} ${levelText}${component} ${message}${cause}`;
					return underActions ? CommandNeutralizer.text(line) : line;
				};

				const sink = Logger.make<unknown, void>((record) => {
					// While core's --log-level flag is in force the sink follows it: an explicit request for that level.
					if (!passes(record, lowered)) return;
					record.fiber.getRef(Console.Console).error(render(record));
				});

				// Every ordinary logger keeps filtering at the minimum it had, however far MinimumLogLevel was lowered.
				const floor = (inner: Logger.Logger<unknown, unknown>): Logger.Logger<unknown, unknown> =>
					isLowered
						? Logger.make<unknown, unknown>((record) => {
								const current = record.fiber.getRef(References.MinimumLogLevel);
								const threshold = current === lowered ? ambient : current;
								if (LogLevel.isGreaterThanOrEqualTo(record.logLevel, threshold)) inner.log(record);
							})
						: inner;
				// The same decision as the sink's, so the plain line and the diagnostics line are neutralized alike.
				const cliLogger = floor(makeCliLogger(options.logger, underActionsIn));
				const extras = (options.extraLoggers ?? []).map(floor);

				// An invalid level warns through the CliLogger only, never through the sink.
				if (invalid !== undefined) {
					yield* Effect.scopedWith((scope) =>
						Effect.flatMap(Layer.buildWithScope(Logger.layer([cliLogger]), scope), (context) =>
							Effect.provideContext(Effect.logWarning(invalid), context),
						),
					);
				}

				return Layer.mergeAll(
					Layer.succeed(CliLog.Level, level),
					isLowered ? Layer.succeed(References.MinimumLogLevel, lowered) : Layer.empty,
					Layer.unwrap(
						Effect.gen(function* () {
							const loggers: Array<Logger.Logger<unknown, unknown>> = [
								...(options.plainLogger === false ? [] : [cliLogger]),
								sink,
								...extras,
							];
							if (file !== undefined) {
								const target =
									"path" in file
										? O.some(file.path)
										: yield* Config.option(Config.String(file.envVar)).pipe(
												Effect.orElseSucceed(O.none<string>),
											);
								if (O.isSome(target) && target.value !== "") {
									const location = yield* PathModule.Path;
									loggers.push(yield* makeFileSink(location.resolve(target.value), lowered, underActionsIn));
								}
							}
							return Logger.layer(loggers);
						}),
					),
				);
			}),
		);
	}

	/**
  * Log a status line: its glyph painted through the theme, then `text`, at a level that follows the status.
  *
  * **Details**
  *
  * The line goes through the logger, so it is a diagnostic like any `Effect.log*` call: filtered by the level in
  * force (`--log-level`, `CliLog.Level`), routed by `CliLogger`'s `stderrFrom` (stderr by default) and neutralized
  * under GitHub Actions. What differs is the glyph: the logger sanitises every line a program logs, which strips a
  * colour a program painted itself, so a glyph on the log channel was always drawn bare. Here the kit paints it and
  * marks the line as its own, so the plain `CliLogger` line keeps the colour, while `text` is still sanitised:
  * escape sequences and control characters in it are removed, as in every line the kit writes.
  *
  * The glyph is painted with stderr's theme (where diagnostics go) through {@link CliTheme.forAudience}, so an agent
  * gets it unpainted, and an `Audience` is read only when provided, so it stays out of the requirements. ASCII glyphs
  * give the status's ASCII form. A diagnostics record carries the line as its message as any record does: the `CliLog`
  * sink's pretty line sanitises it (the glyph is drawn bare there), and NDJSON keeps it, JSON-escaped.
  *
  * The level defaults to the status's rank in `vocab`: `Error` at or above `failure`'s, `Warn` at or above
  * `warning`'s, `Info` below, so a custom status follows its own rank. Pass `level` to choose it, and `indent` (a
  * number of spaces, or a string, sanitised) to start the line inside an indented block: `    ✗ error   x: red`.
  *
  * **Example** (Log a themed failure status)
  *
  * ```ts
  * import { CliLog, Status } from "./index.ts"
  *
  * // ✗ in the failure colour, then the message: on stderr, filtered by the log level.
  * const reportError = (resource: string, message: string) =>
  *   CliLog.status(Status.core, "failure", `${resource}: ${message}`)
  * ```
  *
  * @param vocab - the vocabulary the status belongs to
  * @param name - the status
  * @param text - the text after the glyph, sanitised
  * @param options - the level to log at, and the indent before the glyph
  */
	static readonly status = Effect.fn("status")(function* <N extends string>(
		vocab: Status<N>,
		name: N,
		text: string,
		options?: CliLogStatusOptions,
	): Effect.fn.Return<void, never, CliTheme> {
		const audience = yield* Effect.serviceOption(Audience);
		const theme = CliTheme.forAudience(
			(yield* CliTheme).forStream("stderr"),
			O.isSome(audience) ? audience.value.kind : undefined,
		);
		const line = `${indentOf(options?.indent)}${theme.status(vocab, name, sanitize(text))}`;
		const core = vocab;
		const rank = vocab.def(name).rank;
		const level: LogLevel.Severity =
			options?.level ??
			(rank >= core.def("failure").rank ? "Error" : rank >= core.def("warning").rank ? "Warn" : "Info");
		yield* Effect.logWithLevel(level)(line).pipe(Effect.provideService(TrustedLine, true));
	});

	/**
  * Mark the log records an effect emits as coming from `name`.
  *
  * **Details**
  *
  * Shown as `[name]` in pretty output and as `annotations.component` in NDJSON.
  *
  * @param name - the component
  */
	static readonly component =
		(name: string) =>
		<A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
			Effect.annotateLogs(self, "component", name);
}

/**
 * The audience while the platform builds, from what needs no platform: a flag in `argv` (the rule `CliAudience` reads
 * argv with), else the override variable, else detection from the environment. No terminal is consulted. Silent: the
 * environment layer warns about an invalid override value itself, once.
 */
const buildTimeAudience = (
	argv: ReadonlyArray<string> | undefined,
	audienceEnvVar: string | undefined,
	detected: RuntimeEnv,
): Effect.Effect<AudienceKind> => {
	const { given, conflict } = scanAudience(argv ?? []);
	const [flagged] = given;
	// A conflict is core's usage error later; until then the environment decides, as it does at runtime.
	if (!conflict && flagged !== undefined) return Effect.succeed(flagged);
	return Effect.map(Audience, (audience) => audience.kind).pipe(
		(self) => Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(Audience.layer(audienceEnvVar === undefined ? undefined : { envVar: audienceEnvVar }).pipe(
				Layer.provide(Layer.succeed(CurrentRuntimeEnv, detected)),
			), scope), (context) => Effect.provideContext(self, context))),
		(self) => Effect.scopedWith((scope) =>
			Effect.flatMap(Layer.buildWithScope(Logger.layer([]), scope), (context) => Effect.provideContext(self, context)),
		),
	);
};

/** What the build-time loggers decide from, read once: the format and the runtime environment to neutralize by. */
const buildTimeDecision = Effect.fn("buildTimeDecision")(function* (
	options: CliLogOptions | CliLogFileOptions,
	audienceEnvVar: string | undefined,
): Effect.fn.Return<{ readonly ndjson: boolean; readonly runtimeEnv: RuntimeEnv }> {
	// No CurrentRuntimeEnv exists while the platform builds: detect it here, from the environment alone, so the
	// build-time lines are neutralized under GitHub Actions as the program's are; `runtimeEnv` wins when given.
	const detected: RuntimeEnv = yield* Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(CurrentRuntimeEnv.layer, scope), (context) => Effect.provideContext(CurrentRuntimeEnv, context)));
	const format = options.format ?? "auto";
	const ndjson =
		format === "json" ||
		(format === "auto" && (yield* buildTimeAudience(options.argv, audienceEnvVar, detected)) !== "human");
	return { ndjson, runtimeEnv: options.runtimeEnv ?? detected };
});

/**
 * The logger the platform is built under by `CliRuntime.main` with `env.log`: the log level and env var apply to
 * what the platform logs while it builds, too.
 *
 * **Details**
 *
 * With `format: "json"`, or `auto` when the build-time audience (`argv`, the override variable, detection) is an
 * agent or a CI, it is the full `CliLog.layer` in NDJSON (that format needs neither the audience nor the terminal,
 * which the platform has not built yet), without the file sink, whose `FileSystem` the platform provides. Otherwise it
 * is the plain `CliLogger`, with `MinimumLogLevel` lowered to the resolved level. Either way it neutralizes under
 * GitHub Actions from the detected environment. The level is resolved silently: the program's own `CliLog.layer` warns
 * about an invalid value, once.
 *
 * @internal
 */
export const platformLogLayer: {
	(audienceEnvVar?: string | undefined): (options: CliLogOptions | CliLogFileOptions) => Layer.Layer<never>;
	(options: CliLogOptions | CliLogFileOptions, audienceEnvVar?: string | undefined): Layer.Layer<never>;
} = dual((args) => P.isObjectKeyword(args[0]) && !P.isFunction(args[0]), (
	options: CliLogOptions | CliLogFileOptions,
	audienceEnvVar?: string | undefined,
): Layer.Layer<never> =>
	Layer.unwrap(
		Effect.gen(function* () {
			const { level } = yield* readLevel(options.level, options.envVar);
			const ambient = yield* References.MinimumLogLevel;
			const { ndjson, runtimeEnv } = yield* buildTimeDecision(options, audienceEnvVar);
			if (ndjson) {
				return CliLog.layer({
					level,
					format: "json",
					...O.getSomesStruct({ plainLogger: O.fromUndefinedOr(options.plainLogger) }),
					...O.getSomesStruct({ logger: O.fromUndefinedOr(options.logger) }),
					...O.getSomesStruct({ extraLoggers: O.fromUndefinedOr(options.extraLoggers) }),
					...O.getSomesStruct({ neutralize: O.fromUndefinedOr(options.neutralize) }),
					runtimeEnv,
				});
			}
			return Layer.merge(
				Logger.layer([
					makeCliLogger(options.logger, actionsDecision(options.neutralize ?? "auto", O.some(runtimeEnv))),
				]),
				LogLevel.isLessThan(level, ambient) ? Layer.succeed(References.MinimumLogLevel, level) : Layer.empty,
			);
		}),
	));

/**
 * The logger `CliRuntime.main` builds the environment layer under: one line per record, in the build-time format.
 *
 * **Details**
 *
 * What the environment layer logs is a configuration error (an invalid audience override, which interpolates the
 * variable's value), so it is never silenced and never written twice: NDJSON alone for an agent or a CI (`json`, or
 * `auto` for that build-time audience), a plain `CliLogger` line otherwise, whatever `plainLogger` and the diagnostics
 * level say, and neutralized under GitHub Actions like the platform's lines. It goes to stderr alone, whatever
 * `stderrFrom` the program's `CliLogger` options raise, and never to `extraLoggers` or the file sink. Only this
 * logger is pinned to stderr: the platform's build-time logger keeps the host's `stderrFrom`. It floors at `Warning` and installs no
 * `MinimumLogLevel`, so `CliLog.layer`'s own build, which shares this context, reads the ambient minimum.
 *
 * @internal
 */
export const envBuildLogLayer: {
	(audienceEnvVar?: string | undefined): (options: CliLogOptions | CliLogFileOptions) => Layer.Layer<never>;
	(options: CliLogOptions | CliLogFileOptions, audienceEnvVar?: string | undefined): Layer.Layer<never>;
} = dual((args) => P.isObjectKeyword(args[0]) && !P.isFunction(args[0]), (
	options: CliLogOptions | CliLogFileOptions,
	audienceEnvVar?: string | undefined,
): Layer.Layer<never> =>
	Layer.unwrap(
		Effect.gen(function* () {
			const { ndjson, runtimeEnv } = yield* buildTimeDecision(options, audienceEnvVar);
			const underActions = actionsDecision(options.neutralize ?? "auto", O.some(runtimeEnv));
			// A configuration warning is never program output: whatever `stderrFrom` the program's logger raises, every
			// line the environment build writes goes to stderr.
			if (!ndjson) return Logger.layer([makeCliLogger({ ...options.logger, stderrFrom: "All" }, underActions)]);
			return Logger.layer([
				Logger.make<unknown, void>((record) => {
					if (!LogLevel.isGreaterThanOrEqualTo(record.logLevel, "Warn")) return;
					const json = Logger.formatJson.log(record);
					record.fiber.getRef(Console.Console).error(underActions(record.fiber) ? neutralizeJson(json) : json);
				}),
			]);
		}),
	));
