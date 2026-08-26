/**
 * Log level and log severity literal kits.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity";
import { LiteralKit } from "./LiteralKit/index.ts";

const $I = $SchemaId.create("Logs");

/**
 * Supported log levels including global enable-all and disable-all sentinels.
 *
 * **Example** (Decode and inspect LogLevel)
 *
 * ```ts import.meta.vitest name="Decode and inspect LogLevel"
 * import * as S from "effect/Schema"
 * import { LogLevel } from "@beep/schema/Logs"
 *
 * const level = S.decodeUnknownSync(LogLevel)("Info")
 * console.log(level)
 *
 * LogLevel.Enum.Info  // "Info"
 * LogLevel.is.Debug("Debug") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LogLevel = LiteralKit(["All", "Fatal", "Error", "Warn", "Info", "Debug", "Trace", "None"]).pipe(
  $I.annoteSchema("LogLevel", {
    description: "Log levels supported",
  })
);

/**
 * Runtime type for `LogLevel`.
 *
 * **Example** (Annotate LogLevel value)
 *
 * ```ts import.meta.vitest name="Annotate LogLevel value"
 * import { LogLevel } from "@beep/schema/Logs"
 *
 * const level: LogLevel = "Info"
 * console.log(LogLevel.Options.includes(level))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LogLevel = typeof LogLevel.Type;

/**
 * Supported log severities emitted by the logger (excludes `All` and `None`).
 *
 * **Example** (Decode LogSeverity values)
 *
 * ```ts import.meta.vitest name="Decode LogSeverity values"
 * import * as S from "effect/Schema"
 * import { LogSeverity } from "@beep/schema/Logs"
 *
 * const severity = S.decodeUnknownSync(LogSeverity)("Error")
 * console.log(severity)
 *
 * LogSeverity.Enum.Warn  // "Warn"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LogSeverity = LiteralKit(["Fatal", "Error", "Warn", "Info", "Debug", "Trace"]).pipe(
  $I.annoteSchema("LogSeverity", {
    description: "Log severities supported",
  })
);

/**
 * Runtime type for `LogSeverity`.
 *
 * **Example** (Annotate LogSeverity value)
 *
 * ```ts import.meta.vitest name="Annotate LogSeverity value"
 * import { LogSeverity } from "@beep/schema/Logs"
 *
 * const severity: LogSeverity = "Warn"
 * console.log(LogSeverity.Options.includes(severity))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LogSeverity = typeof LogSeverity.Type;
