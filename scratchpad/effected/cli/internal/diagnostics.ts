import { $ScratchpadId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as Context from "effect/Context";
import * as LogLevel from "effect/LogLevel";
import * as Logger from "effect/Logger";
import * as References from "effect/References";

const $I = $ScratchpadId.create("effected/cli/internal/diagnostics");

/**
 * The diagnostics threshold reference behind `CliLog.Level`. Lives here so the stderr sink and the file sink share
 * one definition without `CliLog` importing itself.
 *
 * **Example** (Read the default diagnostics threshold)
 *
 * ```ts
 * import { Level } from "@beep/scratchpad/effected/cli/internal/diagnostics"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(Level)) // None
 * ```
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const Level: Context.Reference<LogLevel.LogLevel> = Context.Reference<LogLevel.LogLevel>(
	$I`Level`,
	{ defaultValue: () => "None" },
);

/**
 * Whether a diagnostics sink writes `record`. `installed` is the `MinimumLogLevel` the diagnostics layer put in
 * place: while the fiber still sees that value the sink filters on its own {@link Level}; a different value is taken
 * to be core's `--log-level` flag and the sink follows it. A flag whose value EQUALS `installed` cannot be told from
 * no flag, so the sink keeps filtering on its own level; the plain `CliLogger` prints those records anyway.
 *
 * **Example** (Filter an informational record at the default level)
 *
 * ```ts
 * import { passes } from "@beep/scratchpad/effected/cli/internal/diagnostics"
 * import * as Effect from "effect/Effect"
 * import * as Cause from "effect/Cause"
 * import type * as Logger from "effect/Logger"
 *
 * const program = Effect.withFiber((fiber) => {
 *   const record: Logger.Options<string> = {
 *     message: "ready", logLevel: "Info", cause: Cause.empty, fiber,
 *     date: new Date("2026-01-01T00:00:00.000Z"),
 *   }
 *   return Effect.succeed(passes(record, "Info"))
 * })
 * console.log(Effect.runSync(program)) // false
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const passes: {
	(installed: LogLevel.LogLevel): (record: Logger.Options<unknown>) => boolean;
	(record: Logger.Options<unknown>, installed: LogLevel.LogLevel): boolean;
} = dual(2, (record: Logger.Options<unknown>, installed: LogLevel.LogLevel): boolean => {
	const current = record.fiber.getRef(References.MinimumLogLevel);
	const threshold = current === installed ? record.fiber.getRef(Level) : current;
	return LogLevel.isGreaterThanOrEqualTo(record.logLevel, threshold);
});

/**
 * The NDJSON line for a record, the one shape every diagnostics sink writes.
 *
 * **Example** (Serialize the diagnostic message)
 *
 * ```ts
 * import { formatNdjson } from "@beep/scratchpad/effected/cli/internal/diagnostics"
 * import * as Effect from "effect/Effect"
 * import * as Cause from "effect/Cause"
 * import type * as Logger from "effect/Logger"
 *
 * const program = Effect.withFiber((fiber) => {
 *   const record: Logger.Options<string> = {
 *     message: "ready", logLevel: "Info", cause: Cause.empty, fiber,
 *     date: new Date("2026-01-01T00:00:00.000Z"),
 *   }
 *   return Effect.succeed(formatNdjson(record).includes('"message":"ready"'))
 * })
 * console.log(Effect.runSync(program)) // true
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const formatNdjson = (record: Logger.Options<unknown>): string => Logger.formatJson.log(record);
