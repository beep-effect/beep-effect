/**
 * Usage counters for the user-usage API and the hourly database row.
 *
 * **Details**
 *
 * `_utc_now` in Python takes the current UTC time and then strips tzinfo, so
 * the stored value is naive UTC. This port keeps a real UTC instant. A naive
 * ISO string still decodes as UTC, and encoding writes an explicit offset so
 * clients do not read the wall time as local.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Model, pg, text, timestampDefaultNow, userId } from "./Kit.ts";
import { intDefault, optionalJsonColumn } from "./Port.ts";

const $I = $ScratchpadId.create("beep/UserUsage");

/**
 * Period names the usage API could have keyed, and does not.
 *
 * **Details**
 *
 * The response uses four optional slots instead of a map keyed by this enum.
 * No field stores the enum. The wire values are `today`, `monthly`, `yearly`,
 * and `all_time`.
 *
 * **Example** (Decode the all-time period)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { UsagePeriod } from "./UserUsage.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(UsagePeriod)("all_time"))
 * console.log(decoded) // "all_time"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UsagePeriod = LiteralKit(["today", "monthly", "yearly", "all_time"]).pipe(
  $I.annoteSchema("UsagePeriod", {
    description: "Usage window name. The response uses slots, not a map of this enum.",
  }),
);

/**
 * Decoded usage period name.
 *
 * @see {@link UsagePeriod} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export type UsagePeriod = typeof UsagePeriod.Type;

/**
 * Encoded usage period name.
 *
 * @see {@link UsagePeriod} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UsagePeriod {
  export type Encoded = S.Codec.Encoded<typeof UsagePeriod>;
}

/**
 * Current UTC instant.
 *
 * **Details**
 *
 * Python `datetime.now(timezone.utc).replace(tzinfo=None)` drops the zone
 * after reading UTC. Callers that need "now" for `HourlyUsage.lastUpdated`
 * use this instant. The schema still encodes it with a `Z` suffix.
 *
 * **Example** (Read a UTC instant)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { utcNow } from "./UserUsage.ts"
 *
 * const now = Effect.runSync(utcNow())
 * console.log(DateTime.isUtc(now)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const utcNow = Effect.fn("UserUsage.utcNow")(function* () {
  return yield* Effect.sync(DateTime.nowUnsafe);
});

const counter = (column: string) => intDefault(column, 0);

/**
 * Usage metrics for one period.
 *
 * **Details**
 *
 * Five counters, each constructing as 0. `memoriesCreated` and `speechSeconds`
 * are not plan-limit fields. The Python model does not declare `ge=0`.
 *
 * **Example** (Construct the zero counters)
 *
 * ```ts
 * import { UsageStats } from "./UserUsage.ts"
 *
 * const stats = UsageStats.make({})
 * console.log(stats.transcriptionSeconds) // 0
 * console.log(stats.memoriesCreated) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsageStats extends Model<UsageStats>("UsageStats")(
  {
    transcriptionSeconds: counter("transcription_seconds"),
    wordsTranscribed: counter("words_transcribed"),
    insightsGained: counter("insights_gained"),
    memoriesCreated: counter("memories_created"),
    speechSeconds: counter("speech_seconds"),
  },
  $I.annote("UsageStats", {
    description: "Usage metrics for a period. Counters construct as 0.",
  }),
) {}

/**
 * Encoded usage counters.
 *
 * @see {@link UsageStats} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UsageStats {
  export type Encoded = S.Codec.Encoded<typeof UsageStats>;
}

/**
 * One history point: the usage counters plus a date string.
 *
 * **Example** (Decode a history point)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { toWire } from "./Port.ts"
 * import { UsageHistoryPoint } from "./UserUsage.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(toWire(UsageHistoryPoint))({
 *     date: "2020-01-02",
 *     transcription_seconds: 3,
 *     words_transcribed: 4,
 *     insights_gained: 5,
 *     memories_created: 6,
 *     speech_seconds: 7,
 *   }),
 * )
 * console.log(decoded.date) // "2020-01-02"
 * console.log(decoded.speechSeconds) // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsageHistoryPoint extends Model<UsageHistoryPoint>("UsageHistoryPoint")(
  {
    transcriptionSeconds: counter("transcription_seconds"),
    wordsTranscribed: counter("words_transcribed"),
    insightsGained: counter("insights_gained"),
    memoriesCreated: counter("memories_created"),
    speechSeconds: counter("speech_seconds"),
    date: text("date"),
  },
  $I.annote("UsageHistoryPoint", {
    description: "Usage counters for one history date string.",
  }),
) {}

/**
 * Encoded usage history point.
 *
 * @see {@link UsageHistoryPoint} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UsageHistoryPoint {
  export type Encoded = S.Codec.Encoded<typeof UsageHistoryPoint>;
}

/**
 * Response body for the user usage API.
 *
 * **Details**
 *
 * Four optional period slots plus an optional history list. Missing and null
 * become `None`. The period enum is not used as a map key.
 *
 * **Example** (Decode a response with only today)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { toWire } from "./Port.ts"
 * import { UserUsageResponse } from "./UserUsage.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(toWire(UserUsageResponse))({
 *     today: { transcription_seconds: 1, words_transcribed: 2, insights_gained: 0, memories_created: 0, speech_seconds: 0 },
 *     monthly: null,
 *   }),
 * )
 * console.log(O.isSome(decoded.today)) // true
 * console.log(O.isNone(decoded.monthly)) // true
 * console.log(O.isNone(decoded.history)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UserUsageResponse extends Model<UserUsageResponse>("UserUsageResponse")(
  {
    today: optionalJsonColumn(UsageStats, "today"),
    monthly: optionalJsonColumn(UsageStats, "monthly"),
    yearly: optionalJsonColumn(UsageStats, "yearly"),
    allTime: optionalJsonColumn(UsageStats, "all_time"),
    history: optionalJsonColumn(S.Array(UsageHistoryPoint), "history"),
  },
  $I.annote("UserUsageResponse", {
    description: "User usage API body. Period slots and history are optional.",
  }),
) {}

/**
 * Encoded user usage response.
 *
 * @see {@link UserUsageResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UserUsageResponse {
  export type Encoded = S.Codec.Encoded<typeof UserUsageResponse>;
}

const hourPart = (column: string) => S.Int.pipe(pg.integer(), pg.columnName(column));

/**
 * Hourly usage row stored for one user.
 *
 * **Details**
 *
 * Extends the five counters with `uid` and a calendar hour. `lastUpdated`
 * constructs as the current UTC instant, which is the port of `_utc_now`.
 * Decode still requires the timestamp string.
 *
 * **Example** (Construct the update instant)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { HourlyUsage } from "./UserUsage.ts"
 *
 * const row = HourlyUsage.make({ uid: "user-1", year: 2020, month: 1, day: 2, hour: 3 })
 * console.log(DateTime.isUtc(row.lastUpdated)) // true
 * console.log(row.wordsTranscribed) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HourlyUsage extends Model<HourlyUsage>("HourlyUsage")(
  {
    transcriptionSeconds: counter("transcription_seconds"),
    wordsTranscribed: counter("words_transcribed"),
    insightsGained: counter("insights_gained"),
    memoriesCreated: counter("memories_created"),
    speechSeconds: counter("speech_seconds"),
    uid: userId("uid"),
    year: hourPart("year"),
    month: hourPart("month"),
    day: hourPart("day"),
    hour: hourPart("hour"),
    lastUpdated: timestampDefaultNow("last_updated"),
  },
  $I.annote("HourlyUsage", {
    description: "Hourly usage row. last_updated constructs as the current UTC instant.",
  }),
) {}

/**
 * Encoded hourly usage row.
 *
 * @see {@link HourlyUsage} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HourlyUsage {
  export type Encoded = S.Codec.Encoded<typeof HourlyUsage>;
}
