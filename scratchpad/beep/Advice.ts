/**
 * Proactive coaching items returned by `/v1/advice*`.
 *
 * Routers and the database construct documents matching these fields.
 * The collection is `users/{uid}/advice`.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Model, UnitInterval, optionalText, pg, text, timestamp, unitIntervalCheck } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/Advice");

/**
 * One advice item shown to the user.
 *
 * **Details**
 *
 * Advice is coaching shown beside Workflow, not a memory layer. `category` is
 * an open string such as `other` or `focus`. It is metadata, not a closed
 * union. `id` is the unique advice identifier. `content` is the text shown to
 * the user. `reasoning` says why it was generated. `sourceApp` is the producing
 * app when one exists. `contextSummary` is the context the advice used.
 * `currentActivity` is what the user was doing. `createdAt` and `updatedAt` are
 * UTC instants. `isRead` and `isDismissed` construct as false.
 *
 * **Gotchas**
 *
 * Confidence constructs as `0.5` and is required. It is not an `Option`.
 * The four text notes are `None` when the key is missing or JSON null.
 *
 * **Example** (Construct unread advice)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { Advice } from "@beep/scratchpad/beep/Advice"
 *
 * const advice = Advice.make({
 *   id: "advice-1",
 *   content: "Take a break",
 *   category: "focus",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   updatedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(advice.confidence) // 0.5
 * console.log(O.isNone(advice.reasoning)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Advice extends Model<Advice>("Advice")(
  {
    id: text("id"),
    content: text("content"),
    category: text("category"),
    reasoning: optionalText("reasoning"),
    sourceApp: optionalText("source_app"),
    confidence: UnitInterval.pipe(
      S.withConstructorDefault(Effect.succeed(0.5)),
      pg.doublePrecision(),
      pg.columnName("confidence"),
    ),
    contextSummary: optionalText("context_summary"),
    currentActivity: optionalText("current_activity"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    isRead: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false)), pg.boolean(), pg.columnName("is_read")),
    isDismissed: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      pg.boolean(),
      pg.columnName("is_dismissed"),
    ),
  },
  $I.annote("Advice", {
    description: "A single proactive coaching item shown to the user.",
  }),
  (columns) => [unitIntervalCheck("confidence")(columns.confidence)],
) {}

/**
 * Encoded form of {@link Advice}.
 *
 * @see {@link Advice} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Advice {
  export type Encoded = S.Codec.Encoded<typeof Advice>;
}
