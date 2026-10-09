import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { CliOutput } from "effect/cli";
import * as P from "effect/Predicate";

type Method = Exclude<keyof Console.Console, "log" | "error">;

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

		const recording: CliOutput.Formatter = Object.assign(Object.create(formatter), {
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

		const before = <Args extends ReadonlyArray<unknown>>(method: (...args: Args) => void) =>
			(...args: Args): void => {
				release();
				return method(...args);
			};
		// Every other Console method is wrapped, checked against the complete service contract.
		const others = {
			assert: before(sink.assert.bind(sink)),
			clear: before(sink.clear.bind(sink)),
			count: before(sink.count.bind(sink)),
			countReset: before(sink.countReset.bind(sink)),
			debug: before(sink.debug.bind(sink)),
			dir: before(sink.dir.bind(sink)),
			dirxml: before(sink.dirxml.bind(sink)),
			group: before(sink.group.bind(sink)),
			groupCollapsed: before(sink.groupCollapsed.bind(sink)),
			groupEnd: before(sink.groupEnd.bind(sink)),
			info: before(sink.info.bind(sink)),
			table: before(sink.table.bind(sink)),
			time: before(sink.time.bind(sink)),
			timeEnd: before(sink.timeEnd.bind(sink)),
			timeLog: before(sink.timeLog.bind(sink)),
			trace: before(sink.trace.bind(sink)),
			warn: before(sink.warn.bind(sink)),
		} satisfies Pick<Console.Console, Method>;
		const routing: Console.Console = Object.assign(Object.create(sink), others);
		routing.log = (...args: ReadonlyArray<unknown>) => {
			release();
			if (args.length === 1 && P.isString(args[0]) && helps.has(args[0])) held = args;
			else sink.log(...args);
		};
		routing.error = (...args: ReadonlyArray<unknown>) => {
			if (held !== undefined && args.length === 1 && P.isString(args[0]) && errors.has(args[0])) {
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
			Effect.provideService(Console.Console, routing),
			Effect.ensuring(Effect.sync(release)),
		);
	});
