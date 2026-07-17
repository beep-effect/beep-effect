/**
 * Shared terminal printer helpers for repo-cli command adapters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, Effect } from "effect";
import { dual } from "effect/Function";
import * as R from "effect/Record";
import { printCommandJson } from "./Json.ts";
import type { CliJsonError } from "./Json.ts";

/**
 * Print each line in order.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { printLines } from "@beep/repo-cli/internal/cli/Printer"
 * import * as TestConsole from "effect/testing/TestConsole"
 *
 * const program = Effect.gen(function* () {
 *   yield* printLines(["one", "two"])
 *   return yield* TestConsole.logLines
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(TestConsole.layer))).then((lines) => {
 *   console.log(lines) // ["one", "two"]
 * })
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const printLines = Effect.fn("RepoCli.Printer.printLines")(function* (
  lines: ReadonlyArray<string>
): Effect.fn.Return<void> {
  yield* Effect.forEach(lines, Console.log, { discard: true });
});

/**
 * Print a value as machine JSON when `json` is set, otherwise print lines.
 *
 * Collapses the `if (json) { printCommandJson(value) } else { printLines(lines) }`
 * branch repeated across command handlers. The JSON branch uses
 * {@link printCommandJson}, so it emits the same compact single-line payload.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { printJsonOrLines } from "@beep/repo-cli/internal/cli/Printer"
 * import * as TestConsole from "effect/testing/TestConsole"
 *
 * const program = Effect.gen(function* () {
 *   yield* printJsonOrLines(false, { count: 2 }, ["count: 2"])
 *   return yield* TestConsole.logLines
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(TestConsole.layer))).then((lines) => {
 *   console.log(lines) // ["count: 2"]
 * })
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const printJsonOrLines = Effect.fn("RepoCli.Printer.printJsonOrLines")(function* (
  json: boolean,
  value: unknown,
  lines: ReadonlyArray<string>
): Effect.fn.Return<void, CliJsonError> {
  if (json) {
    yield* printCommandJson(value);
    return;
  }
  yield* printLines(lines);
});

/**
 * Build a logger that prefixes every message with a `[tag]` marker.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { makeTaggedLogger } from "@beep/repo-cli/internal/cli/Printer"
 * import * as TestConsole from "effect/testing/TestConsole"
 *
 * const program = Effect.gen(function* () {
 *   const log = makeTaggedLogger("ci")
 *   yield* log("done")
 *   return yield* TestConsole.logLines
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(TestConsole.layer))).then((lines) => {
 *   console.log(lines) // ["[ci] done"]
 * })
 * ```
 * @category logging
 * @since 0.0.0
 */
export const makeTaggedLogger =
  (tag: string): ((message: string) => Effect.Effect<void>) =>
  (message: string) =>
    Console.log(`[${tag}] ${message}`);

/**
 * Log each record entry as a `[tag] key=value` line, in insertion order.
 *
 * The caller supplies the exact label/value record so hand-chosen metric names
 * (for example `live_entries`) are preserved verbatim rather than derived from
 * struct field names.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { logTaggedSummary } from "@beep/repo-cli/internal/cli/Printer"
 * import * as TestConsole from "effect/testing/TestConsole"
 *
 * const program = Effect.gen(function* () {
 *   yield* logTaggedSummary("schema-first", { live_entries: 3, missing_entries: 0 })
 *   return yield* TestConsole.logLines
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(TestConsole.layer))).then((lines) => {
 *   console.log(lines) // ["[schema-first] live_entries=3", "[schema-first] missing_entries=0"]
 * })
 * ```
 * @category logging
 * @since 0.0.0
 */
export const logTaggedSummary = Effect.fn("RepoCli.Printer.logTaggedSummary")(function* (
  tag: string,
  record: Readonly<Record<string, string | number | boolean>>
): Effect.fn.Return<void> {
  yield* Effect.forEach(R.toEntries(record), ([key, value]) => Console.log(`[${tag}] ${key}=${value}`), {
    discard: true,
  });
});

/**
 * Render a millisecond duration as fixed-precision seconds with an `s` suffix.
 *
 * The precision is a parameter because call sites diverge (`toFixed(2)` vs
 * `toFixed(1)`); each keeps its current output by passing its own precision.
 * Dual-arity: pass both arguments for data-first, or the precision alone to get
 * a reusable data-last renderer.
 *
 * @example
 * ```ts
 * import { formatDurationSeconds } from "@beep/repo-cli/internal/cli/Printer"
 *
 * console.log(formatDurationSeconds(1234, 2)) // "1.23s" (data-first)
 *
 * const toOneDecimal = formatDurationSeconds(1)
 * console.log(toOneDecimal(1234)) // "1.2s" (data-last)
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const formatDurationSeconds: {
  (ms: number, precision: number): string;
  (precision: number): (ms: number) => string;
} = dual(2, (ms: number, precision: number): string => `${(ms / 1000).toFixed(precision)}s`);
