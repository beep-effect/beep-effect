import { dual } from "effect/Function";
import { CommandNeutralizer } from "../github-commands/index.ts";
import type * as Fiber from "effect/Fiber";
import type * as Layer from "effect/Layer";
import * as Console from "effect/Console";
import * as LogLevel from "effect/LogLevel";
import * as Logger from "effect/Logger";
import * as References from "effect/References";
import { sanitize } from "./Fmt.ts";
import { TrustedLine, sanitizeParts, underActionsIn } from "./internal/logSafety.ts";
import * as A from "effect/Array";
import * as P from "effect/Predicate";

/**
 * How a log record is turned into a line.
 *
 * @public
 */
export interface CliLoggerOptions {
	/**
  * Render one message. Defaults to joining an array with spaces and
  * `String`-ing anything else.
  *
  * **Details**
  *
  * An array arrives because `Effect.log("synced", 3, "repos")` is variadic.
  *
  * The text is sanitised, because it is whatever the program logged: with the default render, the line has its
  * escape sequences and control characters removed (a line break stays one, a tab becomes a space); with yours, you
  * receive the string parts already sanitised and own what you add, a colour included. Under GitHub Actions, where
  * `CurrentRuntimeEnv` says so, a line the runner would read as a workflow command is neutralized either way.
  *
  * The logger reads `CurrentRuntimeEnv` from the logging fiber's context, so a line logged outside its scope
  * (`CliLogger.layer()` provided alone, with no `CurrentRuntimeEnv`, or the warnings logged while `CliRuntime.main`
  * builds its environment) is sanitised but not neutralized. Provide the environment around the program, as `main`
  * does, for the neutralizing to apply.
  */
	readonly render?: ((message: unknown) => string) | undefined;
	/**
  * The level at and above which output goes to stderr. Defaults to `"All"`,
  * so every log level is a diagnostic and stdout carries only what the
  * program writes with `Console.log`.
  *
  * **Details**
  *
  * Pass `"Error"` to send only errors to stderr, for a tool whose output *is*
  * its log lines rather than a separate document written with
  * `Console.log`.
  */
	readonly stderrFrom?: LogLevel.LogLevel | undefined;
}

const defaultRender = (message: unknown): string =>
	A.isArray(message) ? message.map(String).join(" ") : String(message);

/**
 * A `Logger` that renders CLI output rather than service logs: no timestamp, level or fiber id, with every level
 * going to stderr by default so stdout carries only what the program writes.
 *
 * **Details**
 *
 * Effect's default logger emits `[00:33:56.619] INFO (#2): message`. That is
 * the right shape for a long-running service being scraped and the wrong one
 * for a tool a person is watching: the timestamp, level and fiber id are noise
 * in front of output a human is reading, and they make a formatted block — a
 * permissions table, a summary — unreadable.
 *
 * **A program that never installs a CLI logger looks correct in review and
 * ships timestamps to its users**, so install this one at the program's
 * boundary.
 *
 * It writes through the `Console` reference read off the logging fiber,
 * synchronously, as core's own default logger does: `Logger.make` takes a
 * synchronous callback, and a `Stdio` sink write is an `Effect` a logger cannot
 * `yield*`. `Console.Console` is a `Context.Reference`, so it never appears in
 * `R`, and a test swaps the reference rather than stubbing a global.
 *
 * **Example** (Separate diagnostics from program output)
 *
 * ```ts
 * import { CliLogger } from "./index.ts"
 * import * as Console from "effect/Console";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   yield* Effect.log("synced 3 repos")    // stderr, no timestamp — a diagnostic
 *   yield* Console.log("3 repos synced")   // stdout — the program's actual output
 *   yield* Effect.logError("one failed")   // stderr
 * })
 *
 * program.pipe(Effect.provide(CliLogger.layer()))
 * ```
 *
 * `stderrFrom` defaults to `"All"`: a CLI's stdout is its product, so every
 * log level is a diagnostic unless a consumer narrows the threshold. Write
 * program output with `Console.log`, never `Effect.log`. Pass
 * `stderrFrom: "Error"` for a tool whose output *is* its log lines.
 *
 * @public
 */
export class CliLogger {
	private constructor() {}

	/**
  * The logger itself, for composing into an existing `Logger.layer` set.
  *
  * **Details**
  *
  * Prefer {@link CliLogger.layer}. Reach for this only when you are building
  * the logger set yourself and want this one among several.
  */
	static readonly make = (options: CliLoggerOptions = {}): Logger.Logger<unknown, void> => makeCliLogger(options);

	/**
  * Replace the default logger with this one.
  *
  * **Details**
  *
  * `Logger.layer` **replaces** rather than merges, so nothing is emitted twice.
  *
  * Merge this into the layer you provide to the whole program rather than
  * providing it beneath: merged, it also covers lines emitted during layer
  * construction, which is exactly where a startup failure prints.
  */
	static readonly layer = (options: CliLoggerOptions = {}): Layer.Layer<never> =>
		Logger.layer([CliLogger.make(options)]);
}

/**
 * `CliLogger.make`, with the neutralizing decision as a parameter: `CliLog.layer` passes its own (the fiber's
 * `CurrentRuntimeEnv`, else the one captured at build, or its `neutralize` option), so its plain line and its
 * diagnostics line are neutralized alike.
 *
 * @internal
 */
export const makeCliLogger: {
	(options?: CliLoggerOptions): Logger.Logger<unknown, void>;
	(options: CliLoggerOptions | undefined, underActions: (fiber: Fiber.Fiber<unknown, unknown>) => boolean): Logger.Logger<unknown, void>;
	(underActions: (fiber: Fiber.Fiber<unknown, unknown>) => boolean): (options?: CliLoggerOptions) => Logger.Logger<unknown, void>;
} = dual((args) => !P.isFunction(args[0]), (
	options: CliLoggerOptions = {},
	underActions: (fiber: Fiber.Fiber<unknown, unknown>) => boolean = underActionsIn,
): Logger.Logger<unknown, void> => {
	const custom = options.render;
	const render = custom ?? defaultRender;
	const stderrFrom = options.stderrFrom ?? "All";

	return Logger.make<unknown, void>(({ fiber, logLevel, message }) => {
		const console = fiber.getRef(Console.Console);

		// `LogToStderr` is core's own reference and its own loggers honour it, so
		// ignoring it here would make this logger surprising in a way nothing
		// signals. It is an override in ONE direction: a consumer who sets it
		// meant "this program's output is diagnostic". It must never be able to
		// move an error back onto stdout — that is the one guarantee this logger
		// exists to make, and a reference should not be able to revoke it.
		const forced = fiber.getRef(References.LogToStderr);

		// The level ordinal rises with severity, so this catches the named level
		// and everything above it — including any level added later, which a
		// `logLevel === "Error" || logLevel === "Fatal"` test would miss.
		const diagnostic = forced || LogLevel.isGreaterThanOrEqualTo(logLevel, stderrFrom);

		// `console.log`/`console.error` supply their own newline, which is why
		// nothing here appends one.
		const write = diagnostic ? console.error : console.log;
		// A line the kit already rendered (the failure report) keeps the escapes it painted; everything else is a
		// program's own text, sanitised before it is written, and the runner never reads it as a command.
		const trusted = fiber.getRef(TrustedLine);
		const rendered = trusted
			? render(message)
			: custom === undefined
				? sanitize(render(message))
				: render(sanitizeParts(message));
		write(underActions(fiber) ? CommandNeutralizer.text(rendered) : rendered);
	});
});
