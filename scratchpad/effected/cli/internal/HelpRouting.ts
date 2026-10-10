import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as MutableHashSet from "effect/MutableHashSet";
import { CliOutput } from "effect/cli";
import * as P from "effect/Predicate";

/**
 * Run `program` so a help document printed together with parse errors goes to
 * stderr, beside the errors, instead of stdout.
 *
 * **Details**
 *
 * Core's `Command.runWith` prints a usage error as `Console.log(help)` then
 * `Console.error(errors)`, and an explicit `--help` or a bare group
 * invocation as the same `Console.log(help)` with nothing after it. The two
 * only differ in what follows, so the help is held: the Formatter records
 * every string its `formatHelpDoc` and `formatErrors` return, and a `log` of
 * a recorded help string waits for the next console call. An `error` of a
 * recorded errors string moves it to stderr; anything else, or the program
 * ending, releases it to stdout. At most one document is held, and output
 * order is kept.
 *
 * A Formatter or Console provided inside `program` is not wrapped, so help
 * stays on stdout there: core's own behaviour.
 *
 * **Example** (Construct a help-routing program)
 *
 * ```ts
 * import { routeHelpOnUsageError } from "@beep/scratchpad/effected/cli/internal/HelpRouting"
 * import * as Effect from "effect/Effect"
 *
 * const program = routeHelpOnUsageError(Effect.succeed("done"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const routeHelpOnUsageError = Effect.fn("routeHelpOnUsageError")(function* <A, E, R>(
	program: Effect.Effect<A, E, R>,
): Effect.fn.Return<A, E, R> {
	const formatter = yield* CliOutput.Formatter;
	const sink = yield* Console.Console;
	const helps = MutableHashSet.empty<string>();
	const errors = MutableHashSet.empty<string>();
	let held: ReadonlyArray<unknown> | undefined;
	const release = (): void => {
		if (held === undefined) return;
		const help = held;
		held = undefined;
		sink.log(...help);
	};

	const recording = {
		formatHelpDoc: (doc: Parameters<CliOutput.Formatter["formatHelpDoc"]>[0]) => {
			const text = formatter.formatHelpDoc(doc);
			MutableHashSet.add(helps, text);
			return text;
		},
		formatErrors: (list: Parameters<CliOutput.Formatter["formatErrors"]>[0]) => {
			const text = formatter.formatErrors(list);
			MutableHashSet.add(errors, text);
			return text;
		},
		formatCliError: (error) => formatter.formatCliError(error),
		formatError: (error) => formatter.formatError(error),
		formatVersion: (name, version) => formatter.formatVersion(name, version),
	} satisfies CliOutput.Formatter;

	const before = <Args extends ReadonlyArray<unknown>>(method: (...args: Args) => void) =>
		(...args: Args): void => {
			release();
			return method(...args);
		};
	// Explicit argument types keep the console contract's permissive types out of the delegates.
	const routing = {
		assert: before((condition: boolean, ...args: ReadonlyArray<unknown>) => sink.assert(condition, ...args)),
		clear: before(() => sink.clear()),
		count: before((...args: readonly [label?: string]) => sink.count(...args)),
		countReset: before((...args: readonly [label?: string]) => sink.countReset(...args)),
		debug: before((...args: ReadonlyArray<unknown>) => sink.debug(...args)),
		dir: before((...args: readonly [item: unknown, options?: unknown]) => sink.dir(...args)),
		dirxml: before((...args: ReadonlyArray<unknown>) => sink.dirxml(...args)),
		group: before((...args: ReadonlyArray<unknown>) => sink.group(...args)),
		groupCollapsed: before((...args: ReadonlyArray<unknown>) => sink.groupCollapsed(...args)),
		groupEnd: before(() => sink.groupEnd()),
		info: before((...args: ReadonlyArray<unknown>) => sink.info(...args)),
		table: before((...args: readonly [tabularData: unknown, properties?: ReadonlyArray<string>]) => sink.table(...args)),
		time: before((...args: readonly [label?: string]) => sink.time(...args)),
		timeEnd: before((...args: readonly [label?: string]) => sink.timeEnd(...args)),
		timeLog: before((...args: readonly [label?: string, ...data: ReadonlyArray<unknown>]) => sink.timeLog(...args)),
		trace: before((...args: ReadonlyArray<unknown>) => sink.trace(...args)),
		warn: before((...args: ReadonlyArray<unknown>) => sink.warn(...args)),
		log: (...args: ReadonlyArray<unknown>) => {
			release();
			if (args.length === 1 && P.isString(args[0]) && MutableHashSet.has(helps, args[0])) held = args;
			else sink.log(...args);
		},
		error: (...args: ReadonlyArray<unknown>) => {
			if (held !== undefined && args.length === 1 && P.isString(args[0]) && MutableHashSet.has(errors, args[0])) {
				const help = held;
				held = undefined;
				sink.error(...help);
			} else {
				release();
			}
			sink.error(...args);
		},
	} satisfies Console.Console;

	return yield* program.pipe(
		Effect.provideService(CliOutput.Formatter, recording),
		Effect.provideService(Console.Console, routing),
		Effect.ensuring(Effect.sync(release)),
	);
});
