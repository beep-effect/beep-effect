import { Context, LogLevel, Logger, References } from "effect";

/**
 * The diagnostics threshold reference behind `CliLog.Level`. Lives here so the stderr sink and the file sink share
 * one definition without `CliLog` importing itself.
 *
 * @internal
 */
export const Level: Context.Reference<LogLevel.LogLevel> = Context.Reference<LogLevel.LogLevel>(
	"@effected/cli/CliLog/Level",
	{ defaultValue: () => "None" },
);

/**
 * Whether a diagnostics sink writes `record`. `installed` is the `MinimumLogLevel` the diagnostics layer put in
 * place: while the fiber still sees that value the sink filters on its own {@link Level}; a different value is taken
 * to be core's `--log-level` flag and the sink follows it. A flag whose value EQUALS `installed` cannot be told from
 * no flag, so the sink keeps filtering on its own level; the plain `CliLogger` prints those records anyway.
 *
 * @internal
 */
export const passes = (record: Logger.Options<unknown>, installed: LogLevel.LogLevel): boolean => {
	const current = record.fiber.getRef(References.MinimumLogLevel);
	const threshold = current === installed ? record.fiber.getRef(Level) : current;
	return LogLevel.isGreaterThanOrEqualTo(record.logLevel, threshold);
};

/**
 * The NDJSON line for a record, the one shape every diagnostics sink writes.
 *
 * @internal
 */
export const formatNdjson = (record: Logger.Options<unknown>): string => Logger.formatJson.log(record);
