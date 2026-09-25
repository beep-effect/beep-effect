/**
 * Focus and distraction response shapes.
 *
 * **Details**
 *
 * These are the wire records for `/v1/focus-sessions*` and `/v1/focus-stats`.
 * Routers build dicts with these fields. Sessions live at
 * `users/{uid}/focus_sessions`. A focus session is attention tracking, not a
 * memory, a chat session, or an auth session.
 *
 * @since 0.0.0
 */
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { optionalText, text, timestamp } from "./Kit.ts";
import { atLeastCheck, intAtLeast, jsonList, Model, optionalNull, pg } from "./Port.ts";

const $I = $ScratchpadId.create("beep/FocusSession");

/**
 * One focus or distraction session.
 *
 * **Details**
 *
 * `status` is an open string. The field note says `"focused"` or
 * `"distracted"`, but closing it would not change the other fields.
 * `duration_seconds` is null when the length is unknown and at least zero
 * when present. `created_at` is a UTC instant. `message` is an optional user
 * note.
 *
 * **Gotchas**
 *
 * Do not treat this record as a chat session or an auth session.
 *
 * **Example** (Decode an unknown duration)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { FocusSessionWire } from "@beep/scratchpad/beep/FocusSession"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FocusSessionWire)({
 *     id: "s1",
 *     status: "focused",
 *     app_or_site: "editor",
 *     description: "Writing",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     message: null,
 *     duration_seconds: null,
 *   }),
 * )
 * console.log(decoded.status) // "focused"
 * console.log(O.isNone(decoded.durationSeconds)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FocusSession extends Model<FocusSession>("FocusSession")(
  {
    id: text("id"),
    status: text("status"),
    appOrSite: text("app_or_site"),
    description: text("description"),
    message: optionalText("message"),
    createdAt: timestamp("created_at"),
    durationSeconds: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
      optionalNull,
      pg.integer(),
      pg.columnName("duration_seconds"),
    ),
  },
  $I.annote("FocusSession", {
    description: "One focus or distraction session. Status stays an open string.",
  }),
  (columns: { readonly durationSeconds: ExtraConfigColumn }) => [
    atLeastCheck("duration_seconds", 0)(columns.durationSeconds),
  ],
) {}

/**
 * Encoded form of {@link FocusSession}.
 *
 * @see {@link FocusSessionWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FocusSession {
  export type Encoded = S.Codec.Encoded<typeof FocusSession>;
}

/**
 * Snake_case codec for {@link FocusSession}.
 *
 * **Example** (Reject a negative duration)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FocusSessionWire } from "@beep/scratchpad/beep/FocusSession"
 *
 * const failed = Effect.runSyncExit(
 *   S.decodeUnknownEffect(FocusSessionWire)({
 *     id: "s1",
 *     status: "distracted",
 *     app_or_site: "chat",
 *     description: "Scrolling",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     duration_seconds: -1,
 *   }),
 * )
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @see {@link FocusSession} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const FocusSessionWire = FocusSession.pipe(
  S.encodeKeys({
    appOrSite: "app_or_site",
    createdAt: "created_at",
    durationSeconds: "duration_seconds",
  }),
);

/**
 * One app or site in the focus-stats distraction breakdown.
 *
 * **Details**
 *
 * `total_seconds` and `count` are both at least zero. The stats list is
 * described as up to five entries, but this row itself has no length cap.
 *
 * **Example** (Decode a distraction total)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FocusDistractionWire } from "@beep/scratchpad/beep/FocusSession"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FocusDistractionWire)({ app_or_site: "chat", total_seconds: 90, count: 2 }),
 * )
 * console.log(decoded.totalSeconds) // 90
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FocusDistraction extends Model<FocusDistraction>("FocusDistraction")(
  {
    appOrSite: text("app_or_site"),
    totalSeconds: intAtLeast("total_seconds", 0),
    count: intAtLeast("count", 0),
  },
  $I.annote("FocusDistraction", {
    description: "Aggregated distracted time for one app or site.",
  }),
  (columns: { readonly totalSeconds: ExtraConfigColumn; readonly count: ExtraConfigColumn }) => [
    atLeastCheck("total_seconds", 0)(columns.totalSeconds),
    atLeastCheck("count", 0)(columns.count),
  ],
) {}

/**
 * Encoded form of {@link FocusDistraction}.
 *
 * @see {@link FocusDistractionWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FocusDistraction {
  export type Encoded = S.Codec.Encoded<typeof FocusDistraction>;
}

/**
 * Snake_case codec for {@link FocusDistraction}.
 *
 * **Example** (Reject a negative count)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FocusDistractionWire } from "@beep/scratchpad/beep/FocusSession"
 *
 * const failed = Effect.runSyncExit(
 *   S.decodeUnknownEffect(FocusDistractionWire)({ app_or_site: "chat", total_seconds: 1, count: -1 }),
 * )
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @see {@link FocusDistraction} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const FocusDistractionWire = FocusDistraction.pipe(
  S.encodeKeys({ appOrSite: "app_or_site", totalSeconds: "total_seconds" }),
);

/**
 * Aggregated focus statistics for one calendar day.
 *
 * **Details**
 *
 * `date` is a `YYYY-MM-DD` string, not a datetime. Minute and count fields
 * are whole numbers at least zero. `top_distractions` constructs as an empty
 * list. The description says the list is up to five, and the schema does not
 * enforce that cap.
 *
 * **Gotchas**
 *
 * A missing `top_distractions` key fails decode. Use `make` for the empty
 * default. The five-item note is documentation, not a check.
 *
 * **Example** (Construct empty distractions)
 *
 * ```ts
 * import { FocusStats } from "@beep/scratchpad/beep/FocusSession"
 *
 * const stats = FocusStats.make({
 *   date: "2020-01-02",
 *   focusedMinutes: 10,
 *   distractedMinutes: 0,
 *   sessionCount: 1,
 *   focusedCount: 1,
 *   distractedCount: 0,
 * })
 * console.log(stats.topDistractions.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FocusStats extends Model<FocusStats>("FocusStats")(
  {
    date: text("date"),
    focusedMinutes: intAtLeast("focused_minutes", 0),
    distractedMinutes: intAtLeast("distracted_minutes", 0),
    sessionCount: intAtLeast("session_count", 0),
    focusedCount: intAtLeast("focused_count", 0),
    distractedCount: intAtLeast("distracted_count", 0),
    topDistractions: jsonList(FocusDistractionWire, "top_distractions"),
  },
  $I.annote("FocusStats", {
    description: "Aggregated focus statistics for one YYYY-MM-DD day.",
  }),
  (columns: {
    readonly focusedMinutes: ExtraConfigColumn;
    readonly distractedMinutes: ExtraConfigColumn;
    readonly sessionCount: ExtraConfigColumn;
    readonly focusedCount: ExtraConfigColumn;
    readonly distractedCount: ExtraConfigColumn;
  }) => [
    atLeastCheck("focused_minutes", 0)(columns.focusedMinutes),
    atLeastCheck("distracted_minutes", 0)(columns.distractedMinutes),
    atLeastCheck("session_count", 0)(columns.sessionCount),
    atLeastCheck("focused_count", 0)(columns.focusedCount),
    atLeastCheck("distracted_count", 0)(columns.distractedCount),
  ],
) {}

/**
 * Encoded form of {@link FocusStats}.
 *
 * @see {@link FocusStatsWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FocusStats {
  export type Encoded = S.Codec.Encoded<typeof FocusStats>;
}

/**
 * Snake_case codec for {@link FocusStats}.
 *
 * **Example** (Decode a focused minute total)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FocusStatsWire } from "@beep/scratchpad/beep/FocusSession"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FocusStatsWire)({
 *     date: "2020-01-02",
 *     focused_minutes: 10,
 *     distracted_minutes: 1,
 *     session_count: 2,
 *     focused_count: 1,
 *     distracted_count: 1,
 *     top_distractions: [],
 *   }),
 * )
 * console.log(decoded.focusedMinutes) // 10
 * ```
 *
 * @see {@link FocusStats} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const FocusStatsWire = FocusStats.pipe(
  S.encodeKeys({
    focusedMinutes: "focused_minutes",
    distractedMinutes: "distracted_minutes",
    sessionCount: "session_count",
    focusedCount: "focused_count",
    distractedCount: "distracted_count",
    topDistractions: "top_distractions",
  }),
);
