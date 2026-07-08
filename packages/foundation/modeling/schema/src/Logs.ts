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
 * @example
 * ```ts
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
 * @since 0.0.0
 * @category models
 */
export const LogLevel = LiteralKit(["All", "Fatal", "Error", "Warn", "Info", "Debug", "Trace", "None"]).pipe(
  $I.annoteSchema("LogLevel", {
    description: "Log levels supported",
  })
);

/**
 * Runtime type for `LogLevel`.
 *
 * @example
 * ```ts
 * import { LogLevel } from "@beep/schema/Logs"
 *
 * const level: LogLevel = "Info"
 * console.log(LogLevel.Options.includes(level))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type LogLevel = typeof LogLevel.Type;

/**
 * Supported log severities emitted by the logger (excludes `All` and `None`).
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { LogSeverity } from "@beep/schema/Logs"
 *
 * const severity = S.decodeUnknownSync(LogSeverity)("Error")
 * console.log(severity)
 *
 * LogSeverity.Enum.Warn  // "Warn"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const LogSeverity = LiteralKit(["Fatal", "Error", "Warn", "Info", "Debug", "Trace"]).pipe(
  $I.annoteSchema("LogSeverity", {
    description: "Log severities supported",
  })
);

/**
 * Runtime type for `LogSeverity`.
 *
 * @example
 * ```ts
 * import { LogSeverity } from "@beep/schema/Logs"
 *
 * const severity: LogSeverity = "Warn"
 * console.log(LogSeverity.Options.includes(severity))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type LogSeverity = typeof LogSeverity.Type;
