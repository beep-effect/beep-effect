/**
 * Daily, weekly, and overall productivity scores for the score responses.
 *
 * Response wire shapes for `/v1/daily-score` and `/v1/scores`. The database
 * layer constructs records matching these fields.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { Model, Table, nonNegativeIntCheck, pg } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/Score");

const scorePoints = S.Int.check(S.isBetween({ minimum: 0, maximum: 100 }));
const scoreWindow = S.Finite.check(S.isBetween({ minimum: 0, maximum: 100 }));
const taskCount = S.Int.check(S.isGreaterThanOrEqualTo(0));

const betweenCheck =
  (name: string, minimum: number, maximum: number) => (column: ExtraConfigColumn) =>
    Table.check(name)(
      sql<boolean>`${column} >= ${sql.raw(String(minimum))} and ${column} <= ${sql.raw(String(maximum))}`,
    );

const describedText = (column: string, description: string) =>
  S.String.annotateKey({ description }).pipe(pg.text(), pg.columnName(column));

const counted = (column: string, description: string) =>
  taskCount.annotateKey({ description }).pipe(pg.integer(), pg.columnName(column));

/**
 * One calendar day's completion score.
 *
 * **Details**
 *
 * Single-day productivity score from `get_daily_score`. `date` is the UTC
 * calendar day as text, not an instant. `score` is the rounded completion
 * percentage. Task counts are completed and total non-deleted tasks due that
 * day.
 *
 * **Gotchas**
 *
 * `date` is documented as `YYYY-MM-DD`, but the Python field has no pattern
 * check. Any string decodes. `default_tab` is not a field on this row.
 *
 * **Example** (Decode a full day)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DailyScore } from "@beep/scratchpad/beep/Score"
 *
 * const day = Effect.runSync(
 *   S.decodeUnknownEffect(DailyScore)({
 *     date: "2020-01-02",
 *     score: 100,
 *     completedTasks: 2,
 *     totalTasks: 2,
 *   }),
 * )
 * console.log(day.score) // 100
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DailyScore extends Model<DailyScore>("DailyScore")(
  {
    date: describedText("date", "Calendar date the score covers, YYYY-MM-DD (UTC)."),
    score: scorePoints
      .annotateKey({ description: "Completion percentage for the day, 0..100 (rounded)." })
      .pipe(pg.integer(), pg.columnName("score")),
    completedTasks: counted("completed_tasks", "Number of completed, non-deleted tasks due that day."),
    totalTasks: counted("total_tasks", "Total non-deleted tasks due that day."),
  },
  $I.annote("DailyScore", {
    description: "Single-day productivity score returned by get_daily_score.",
  }),
  (columns) => [
    betweenCheck("score_range", 0, 100)(columns.score),
    nonNegativeIntCheck("completed_tasks")(columns.completedTasks),
    nonNegativeIntCheck("total_tasks")(columns.totalTasks),
  ],
) {}

/**
 * Encoded daily score before decoding.
 *
 * @see {@link DailyScore} for the runtime model and bounds.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DailyScore {
  export type Encoded = S.Codec.Encoded<typeof DailyScore>;
}

/**
 * One scoring window inside the combined scores response.
 *
 * **Details**
 *
 * One scoring window (daily, weekly, or overall) inside `get_scores`. The
 * score is a float completion percentage from 0 through 100. Task counts use
 * the same non-deleted meaning as {@link DailyScore}.
 *
 * **Example** (Decode a window)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ScorePeriod } from "@beep/scratchpad/beep/Score"
 *
 * const period = Effect.runSync(
 *   S.decodeUnknownEffect(ScorePeriod)({ score: 50.5, completedTasks: 1, totalTasks: 2 }),
 * )
 * console.log(period.score) // 50.5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScorePeriod extends Model<ScorePeriod>("ScorePeriod")(
  {
    score: scoreWindow
      .annotateKey({ description: "Completion percentage for the window, 0..100 (1 decimal)." })
      .pipe(pg.doublePrecision(), pg.columnName("score")),
    completedTasks: counted("completed_tasks", "Completed, non-deleted tasks in the window."),
    totalTasks: counted("total_tasks", "Total non-deleted tasks in the window."),
  },
  $I.annote("ScorePeriod", {
    description: "Completion score for one daily, weekly, or overall window.",
  }),
  (columns) => [
    betweenCheck("score_range", 0, 100)(columns.score),
    nonNegativeIntCheck("completed_tasks")(columns.completedTasks),
    nonNegativeIntCheck("total_tasks")(columns.totalTasks),
  ],
) {}

/**
 * Encoded scoring window before decoding.
 *
 * @see {@link ScorePeriod} for the runtime model and bounds.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScorePeriod {
  export type Encoded = S.Codec.Encoded<typeof ScorePeriod>;
}

const periodColumn = (column: string) => ScorePeriod.pipe(pg.jsonb(), pg.columnName(column));

/**
 * Daily, weekly, and overall scores plus the recommended tab.
 *
 * **Details**
 *
 * Daily, weekly, and overall scores plus the recommended default tab from
 * `get_scores`. `daily` covers tasks due on `date`. `weekly` covers tasks
 * created in the 7 days ending on that date. `overall` covers every
 * non-deleted task.
 *
 * **Gotchas**
 *
 * `defaultTab` is an open string. The description names `"daily"`, `"weekly"`,
 * and `"overall"`, but those words are not a closed union. `date` is calendar
 * text, not a timestamp.
 *
 * **Example** (Decode the three windows)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Scores } from "@beep/scratchpad/beep/Score"
 *
 * const scores = Effect.runSync(
 *   S.decodeUnknownEffect(Scores)({
 *     daily: { score: 1, completedTasks: 1, totalTasks: 1 },
 *     weekly: { score: 0, completedTasks: 0, totalTasks: 4 },
 *     overall: { score: 100, completedTasks: 3, totalTasks: 3 },
 *     defaultTab: "weekly",
 *     date: "2020-01-02",
 *   }),
 * )
 * console.log(scores.defaultTab) // "weekly"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Scores extends Model<Scores>("Scores")(
  {
    daily: periodColumn("daily"),
    weekly: periodColumn("weekly"),
    overall: periodColumn("overall"),
    defaultTab: describedText("default_tab", 'Recommended default UI tab: "daily", "weekly", or "overall".'),
    date: describedText("date", "Calendar date the scores are anchored on, YYYY-MM-DD (UTC)."),
  },
  $I.annote("Scores", {
    description: "Daily, weekly, and overall scores plus the recommended default tab.",
  }),
) {}

/**
 * Encoded combined scores response before decoding.
 *
 * @see {@link Scores} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Scores {
  export type Encoded = S.Codec.Encoded<typeof Scores>;
}
