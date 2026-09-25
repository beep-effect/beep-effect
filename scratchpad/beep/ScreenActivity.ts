/**
 * Read-time coverage of synced screen observations, independent of semantic memory.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Model, Table, bool, optionalText, pg } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/ScreenActivity");

const rowLimit = S.Int.check(S.isGreaterThanOrEqualTo(1));

const minCheck = (name: string, minimum: number) => (column: ExtraConfigColumn) =>
  Table.check(name)(sql<boolean>`${column} >= ${sql.raw(String(minimum))}`);

/**
 * Source marker for a cloud read of synced screen activity.
 *
 * **Details**
 *
 * The only wire value is `synced_screen_activity`. Construction may omit it.
 * Decode still requires that exact string.
 *
 * **Example** (Accept the only source)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScreenActivitySource } from "@beep/scratchpad/beep/ScreenActivity"
 *
 * console.log(S.is(ScreenActivitySource)("synced_screen_activity")) // true
 * console.log(S.is(ScreenActivitySource)("memory")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScreenActivitySource = LiteralKit(["synced_screen_activity"]).pipe(
  $I.annoteSchema("ScreenActivitySource", {
    description: "Read came from synced screen activity, not from semantic memory.",
  }),
);

/**
 * Decoded screen-activity source marker.
 *
 * @see {@link ScreenActivitySource} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ScreenActivitySource = typeof ScreenActivitySource.Type;

/**
 * Capture-completeness marker a bounded cloud query is allowed to report.
 *
 * **Details**
 *
 * A bounded cloud query cannot attest to device capture state or unsynced
 * rows, so the only value is `unknown`.
 *
 * **Example** (Reject a stronger completeness claim)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScreenActivityCaptureCompleteness } from "@beep/scratchpad/beep/ScreenActivity"
 *
 * console.log(S.is(ScreenActivityCaptureCompleteness)("unknown")) // true
 * console.log(S.is(ScreenActivityCaptureCompleteness)("complete")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScreenActivityCaptureCompleteness = LiteralKit(["unknown"]).pipe(
  $I.annoteSchema("ScreenActivityCaptureCompleteness", {
    description: "Cloud coverage cannot attest device capture completeness.",
  }),
);

/**
 * Decoded capture-completeness marker.
 *
 * @see {@link ScreenActivityCaptureCompleteness} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ScreenActivityCaptureCompleteness = typeof ScreenActivityCaptureCompleteness.Type;

/**
 * How much synced screen activity a bounded cloud read actually covered.
 *
 * **Details**
 *
 * Read-time coverage of synced screen observations, independent of semantic
 * memory. `firstObservedAt` and `lastObservedAt` are raw strings, not
 * datetimes. `rowLimit` is at least 1.
 *
 * **Gotchas**
 *
 * `captureCompleteness` cannot become anything but `unknown`. Absence of the
 * observed-at strings means the read saw no rows, not that capture failed.
 *
 * **Example** (Decode a truncated read)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ScreenActivityCoverage } from "@beep/scratchpad/beep/ScreenActivity"
 *
 * const coverage = Effect.runSync(
 *   S.decodeUnknownEffect(ScreenActivityCoverage)({
 *     source: "synced_screen_activity",
 *     rowLimit: 20,
 *     truncated: true,
 *     captureCompleteness: "unknown",
 *   }),
 * )
 * console.log(coverage.truncated) // true
 * console.log(O.isNone(coverage.firstObservedAt)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScreenActivityCoverage extends Model<ScreenActivityCoverage>("ScreenActivityCoverage")(
  {
    source: ScreenActivitySource.pipe(
      S.withConstructorDefault(Effect.succeed("synced_screen_activity")),
      pg.text(),
      pg.columnName("source"),
    ),
    rowLimit: rowLimit.annotateKey({ description: "Maximum synced screen rows included in this read." }).pipe(
      pg.integer(),
      pg.columnName("row_limit"),
    ),
    truncated: bool("truncated"),
    firstObservedAt: optionalText("first_observed_at"),
    lastObservedAt: optionalText("last_observed_at"),
    captureCompleteness: ScreenActivityCaptureCompleteness.pipe(
      S.withConstructorDefault(Effect.succeed("unknown")),
      pg.text(),
      pg.columnName("capture_completeness"),
    ),
  },
  $I.annote("ScreenActivityCoverage", {
    description: "Bounded cloud coverage of synced screen observations, independent of semantic memory.",
  }),
  (columns) => [minCheck("row_limit_min", 1)(columns.rowLimit)],
) {}

/**
 * Encoded screen-activity coverage before decoding.
 *
 * @see {@link ScreenActivityCoverage} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScreenActivityCoverage {
  export type Encoded = S.Codec.Encoded<typeof ScreenActivityCoverage>;
}
