/**
 * Count, duration and size formatting for console lines.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import { ItemKind } from "./Vocabulary.ts";
import type { Totals } from "./GateReport.ts";

/**
 * A count followed by its noun, singular for one and plural otherwise.
 *
 * **Example** (Pluralise a noun)
 *
 * ```ts
 * import { plural } from "@beep/gate-report/Format";
 *
 * console.log(plural({ count: 1, one: "test", other: "tests" })); // 1 test
 * console.log(plural({ count: 3, one: "test", other: "tests" })); // 3 tests
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const plural = (input: { readonly count: number; readonly one: string; readonly other: string }): string =>
  `${input.count} ${input.count === 1 ? input.one : input.other}`;

const minutesAndSeconds = (ms: number): string => {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const secondsOrMinutes = (ms: number): string => {
  const seconds = Math.round(ms / 100) / 10;
  return seconds < 60 ? `${seconds}s` : minutesAndSeconds(ms);
};

/**
 * A duration in milliseconds as a short human string.
 *
 * **Details**
 *
 * Below one second it is whole milliseconds; below one minute, seconds to one
 * decimal with a trailing `.0` dropped; from one minute, whole minutes and
 * seconds. A value that rounds up to a second is written in seconds, never
 * `1000ms`.
 *
 * **Example** (Format durations)
 *
 * ```ts
 * import { formatDuration } from "@beep/gate-report/Format";
 *
 * console.log(formatDuration(250)); // 250ms
 * console.log(formatDuration(2549)); // 2.5s
 * console.log(formatDuration(63210)); // 1m 3s
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const formatDuration = (ms: number): string => {
  const rounded = Math.round(ms);
  return rounded < 1000 ? `${rounded}ms` : secondsOrMinutes(ms);
};

const UNITS = ["B", "KB", "MB", "GB"] as const;

/**
 * A byte count as a short human size.
 *
 * **Example** (Format sizes)
 *
 * ```ts
 * import { formatBytes } from "@beep/gate-report/Format";
 *
 * console.log(formatBytes(512)); // 512 B
 * console.log(formatBytes(1536)); // 1.5 KB
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const formatBytes = (bytes: number): string => {
  const exponent = Math.min(UNITS.length - 1, bytes < 1024 ? 0 : Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = exponent === 0 ? bytes : Math.round((bytes / 1024 ** exponent) * 10) / 10;
  return `${value} ${UNITS[exponent]}`;
};

const faultParts = (totals: Totals): ReadonlyArray<string> =>
  pipe(
    [
      { count: totals.loadFailed, one: "load failure", other: "load failures" },
      { count: totals.hookFailed, one: "hook failure", other: "hook failures" },
      { count: totals.unhandled, one: "unhandled error", other: "unhandled errors" },
      { count: totals.errored, one: "errored", other: "errored" },
    ],
    A.filter((part) => part.count > 0),
    A.map(plural)
  );

const testParts = (totals: Totals): ReadonlyArray<string> => {
  const denominator = totals.passed + totals.failed + totals.warned + totals.skipped + totals.timedOut;
  const extra = pipe(
    [
      { count: totals.failed, one: "failed", other: "failed" },
      { count: totals.warned, one: "warned", other: "warned" },
      { count: totals.timedOut, one: "timed out", other: "timed out" },
      { count: totals.skipped, one: "skipped", other: "skipped" },
    ],
    A.filter((part) => part.count > 0),
    A.map(plural)
  );
  return denominator === 0 && totals.collected === 0
    ? ["0 tests collected"]
    : [`${totals.passed}/${denominator} passed`, ...extra];
};

const diagnosticParts = (totals: Totals): ReadonlyArray<string> => [
  plural({ count: totals.failed, one: "error", other: "errors" }),
  plural({ count: totals.warned, one: "warning", other: "warnings" }),
  `${plural({ count: totals.collected, one: "unit", other: "units" })} checked`,
];

const stepParts = (totals: Totals): ReadonlyArray<string> =>
  totals.collected === 0 ? ["0 steps run"] : testParts(totals);

/**
 * The counts of a report as one comma-separated phrase.
 *
 * **Details**
 *
 * A test or step gate prints `passed/total passed` and every non-zero total
 * after it; an empty test run prints `0 tests collected`. A diagnostic gate
 * prints its errors, warnings and the units it checked. Load, hook, unhandled
 * and errored totals follow whenever they are non-zero.
 *
 * **Example** (Format test counts)
 *
 * ```ts
 * import { formatCounts } from "@beep/gate-report/Format";
 * import { Totals } from "@beep/gate-report/GateReport";
 *
 * console.log(formatCounts({ totals: Totals.make({ collected: 4, passed: 2, failed: 1, skipped: 1 }), itemKind: "test" }));
 * // 2/4 passed, 1 failed, 1 skipped
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const formatCounts = (input: { readonly totals: Totals; readonly itemKind: ItemKind }): string =>
  A.join(
    A.appendAll(
      ItemKind.match(input.itemKind, {
        test: () => testParts(input.totals),
        diagnostic: () => diagnosticParts(input.totals),
        step: () => stepParts(input.totals),
      }),
      faultParts(input.totals)
    ),
    ", "
  );
