import { Console, Effect } from "effect";
import { CliOutput } from "effect/cli";

type Method = Exclude<keyof Console.Console, "log" | "error">;

// A `Record` over `Method`, so a Console method this list misses — or one it
// names that no longer exists — is a compile error, not an unrouted write.
const OTHER_METHOD_SET: Record<Method, true> = {
	assert: true,
	clear: true,
	count: true,
	countReset: true,
	debug: true,
	dir: true,
	dirxml: true,
	group: true,
	groupCollapsed: true,
	groupEnd: true,
	info: true,
	table: true,
	time: true,
	timeEnd: true,
	timeLog: true,
	trace: true,
	warn: true,
};

const OTHER_METHODS = Object.keys(OTHER_METHOD_SET) as ReadonlyArray<Method>;

/**
 * Run `program` so a help document printed together with parse errors goes to
 * stderr, beside the errors, instead of stdout.
 *
 * @remarks
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
 * @internal
 */
export const routeHelpOnUsageError = <A, E, R>(program: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
	Effect.gen(function* () {
		const formatter = yield* CliOutput.Formatter;
		const sink = yield* Console.Console;
		const helps = new Set<string>();
		const errors = new Set<string>();
		let held: ReadonlyArray<unknown> | undefined;
		const release = (): void => {
			if (held === undefined) return;
			const help = held;
			held = undefined;
			sink.log(...help);
		};

		const recording: CliOutput.Formatter = Object.assign(Object.create(formatter) as CliOutput.Formatter, {
			formatHelpDoc: (doc: Parameters<CliOutput.Formatter["formatHelpDoc"]>[0]) => {
				const text = formatter.formatHelpDoc(doc);
				helps.add(text);
				return text;
			},
			formatErrors: (list: Parameters<CliOutput.Formatter["formatErrors"]>[0]) => {
				const text = formatter.formatErrors(list);
				errors.add(text);
				return text;
			},
		});

		const routing = Object.create(sink) as Record<string, unknown>;
		for (const method of OTHER_METHODS) {
			routing[method] = (...args: ReadonlyArray<unknown>) => {
				release();
				return (sink[method] as (...args: ReadonlyArray<unknown>) => void)(...args);
			};
		}
		routing.log = (...args: ReadonlyArray<unknown>) => {
			release();
			if (args.length === 1 && typeof args[0] === "string" && helps.has(args[0])) held = args;
			else sink.log(...args);
		};
		routing.error = (...args: ReadonlyArray<unknown>) => {
			if (held !== undefined && args.length === 1 && typeof args[0] === "string" && errors.has(args[0])) {
				const help = held;
				held = undefined;
				sink.error(...help);
			} else {
				release();
			}
			sink.error(...args);
		};

		return yield* program.pipe(
			Effect.provideService(CliOutput.Formatter, recording),
			Effect.provideService(Console.Console, routing as unknown as Console.Console),
			Effect.ensuring(Effect.sync(release)),
		);
	});
