import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import type { AudienceKind } from "./Audience.ts";
import { Audience } from "./Audience.ts";

const isProvider = (
	source: Readonly<Record<string, string | undefined>> | ConfigProvider.ConfigProvider,
): source is ConfigProvider.ConfigProvider => P.isFunction(source.load);

/**
 * Reads an environment variable that picks a mode within an audience.
 *
 * @remarks
 * The kit never learns a consumer's literals: the caller passes, per audience, the values it accepts.
 *
 * @public
 */
export class EnvOverride {
	private constructor() {}

	/**
	 * Read `options.envVar` and say what happened, without logging.
	 *
	 * @remarks
	 * `accepted` is the literal the current audience accepts (matching is case-insensitive and yields the
	 * literal), `rejected` is a set value it does not, with the value as written, the audience and the literals
	 * that audience accepts, so the caller owns the wording, the stream and any once-per-run dedupe. Unset and
	 * empty are neither. At most one of the two is `Some`. {@link EnvOverride.read} is the logging convenience.
	 *
	 * The variable is read from the ambient `ConfigProvider` unless `source` is given: a record (read fresh on every
	 * call, so a host passing `process.env` sees each change, and an `undefined` value is unset) or a `ConfigProvider`
	 * of its own.
	 *
	 * Without `source`, every read takes the `ConfigProvider` of the fiber that runs it, so a reader built once at
	 * module level stays testable: a test provides its own provider around the read.
	 *
	 * ```ts
	 * const consoleMode = EnvOverride.readResult({ envVar: "MYTOOL_CONSOLE", accepts })
	 * // in a test:
	 * consoleMode.pipe(
	 *   Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ MYTOOL_CONSOLE: "silent" })),
	 * )
	 * ```
	 *
	 * `source` is for a long-lived host that must re-read a record on each call (`process.env` in a watch-mode runner,
	 * where core's default provider snapshots the environment once). It is fixed when the options object is built, so a
	 * host that wants it AND testability builds the options inside a function that takes the source:
	 *
	 * ```ts
	 * const consoleModeFrom = (source: Readonly<Record<string, string | undefined>>) =>
	 *   EnvOverride.readResult({ envVar: "MYTOOL_CONSOLE", accepts, source })
	 * // production: consoleModeFrom(process.env); a test: consoleModeFrom({ MYTOOL_CONSOLE: "silent" })
	 * ```
	 *
	 * @param options - `envVar` is the variable; `accepts` lists, per audience, the literals it accepts; `source`, if
	 *   given, is where the variable is read in place of the ambient environment: a long-lived host's record, re-read
	 *   on every call, or a `ConfigProvider`; omit it to read the fiber's `ConfigProvider`, which a test provides
	 */
	static readResult<const M extends Record<AudienceKind, ReadonlyArray<string>>>(options: {
		readonly envVar: string;
		readonly accepts: M;
		readonly source?: Readonly<Record<string, string | undefined>> | ConfigProvider.ConfigProvider | undefined;
	}): Effect.Effect<
		{
			readonly audience: AudienceKind;
			readonly accepted: O.Option<M[AudienceKind][number]>;
			readonly rejected: O.Option<{
				readonly value: string;
				readonly audience: AudienceKind;
				readonly accepts: ReadonlyArray<string>;
			}>;
		},
		never,
		Audience
	> {
		return Effect.gen(function* () {
			const { kind } = yield* Audience;
			const config = Config.option(Config.String(options.envVar));
			const { source } = options;
			// A record becomes a provider on every call, so its current values are read; a provider is used as given.
			const raw =
				source === undefined
					? yield* config.pipe(Effect.orElseSucceed(O.none<string>))
					: yield* config
							.parse(isProvider(source) ? source : ConfigProvider.fromEnvRecord({ ...source }))
							.pipe(Effect.orElseSucceed(O.none<string>));
			if (O.isNone(raw) || raw.value === "") {
				return { audience: kind, accepted: O.none(), rejected: O.none() };
			}
			const accepts: ReadonlyArray<M[AudienceKind][number]> = options.accepts[kind];
			const match = accepts.find((literal) => literal.toLowerCase() === raw.value.toLowerCase());
			if (match !== undefined) {
				return { audience: kind, accepted: O.some(match), rejected: O.none() };
			}
			return {
				audience: kind,
				accepted: O.none(),
				rejected: O.some({ value: raw.value, audience: kind, accepts }),
			};
		});
	}

	/**
	 * Read `options.envVar` and accept it only when the current audience accepts it.
	 *
	 * @remarks
	 * Matching is case-insensitive and yields the accepted literal, so the result narrows to the union of every
	 * audience's literals. An unset or empty variable is `None`. A value the current audience does not accept logs
	 * one warning through `Effect.logWarning`, naming the accepted values, and is `None`; it never fails the run.
	 * The warning is once per read, so reading again warns again. It goes through `Effect.logWarning`, and Effect's
	 * default logger writes to stdout unless `References.LogToStderr` is set: an MCP server or any stdio-sensitive
	 * host must route logs to stderr (the `cli` package's `CliLogger` does).
	 *
	 * @param options - `envVar` is the variable; `accepts` lists, per audience, the literals it accepts
	 */
	static read<const M extends Record<AudienceKind, ReadonlyArray<string>>>(options: {
		readonly envVar: string;
		readonly accepts: M;
	}): Effect.Effect<O.Option<M[AudienceKind][number]>, never, Audience> {
		return Effect.gen(function* () {
			const { accepted, rejected } = yield* EnvOverride.readResult(options);
			if (O.isSome(rejected)) {
				const { value, audience, accepts } = rejected.value;
				yield* Effect.logWarning(
					`${options.envVar}=${value} is not accepted for the ${audience} audience (accepts ${accepts.join("|")}); ignoring it`,
				);
			}
			return accepted;
		});
	}
}
