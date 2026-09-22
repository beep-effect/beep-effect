/**
 * Conversation summary shapes.
 *
 * The live Python module prefers `omi_plugin_sdk` and falls back to these
 * classes. The fallback is the port. Do not import the plugin SDK. The shapes
 * matched on 2026-09-22, including `romance` encoding as `romantic`.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import {
  Model,
  optionalBool,
  optionalConfidence,
  optionalNull,
  optionalText,
  optionalTimestamp,
  pg,
  text,
  timestamp,
  unitIntervalCheck,
} from "./Kit.ts";

const $I = $ScratchpadId.create("beep/Structured");

const emptyStrings: Array<string> = [];
const brain = "🧠";

/**
 * Conversation category.
 *
 * **Details**
 *
 * Member-identical to `models.conversation_enums.CategoryEnum` and to the
 * plugin SDK enum. The Python member `romance` stores the wire value
 * `romantic`.
 *
 * **Gotchas**
 *
 * Decode `romantic`, not the member name `romance`.
 *
 * **Example** (Read the romance wire value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CategoryEnum } from "@beep/scratchpad/beep/Structured"
 *
 * console.log(S.is(CategoryEnum)("romantic")) // true
 * console.log(S.is(CategoryEnum)("romance")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CategoryEnum = LiteralKit([
  "personal",
  "education",
  "health",
  "finance",
  "legal",
  "philosophy",
  "spiritual",
  "science",
  "entrepreneurship",
  "parenting",
  "romantic",
  "travel",
  "inspiration",
  "technology",
  "business",
  "social",
  "work",
  "sports",
  "politics",
  "literature",
  "history",
  "architecture",
  "music",
  "weather",
  "news",
  "entertainment",
  "psychology",
  "real",
  "design",
  "family",
  "economics",
  "environment",
  "other",
]).pipe(
  $I.annoteSchema("CategoryEnum", {
    description: "Conversation category. romance is stored as romantic.",
  }),
);

/**
 * Decoded conversation category.
 *
 * @see {@link CategoryEnum} for the runtime schema and the romance wire value.
 * @category type-level
 * @since 0.0.0
 */
export type CategoryEnum = typeof CategoryEnum.Type;

/**
 * How explicitly an action item was captured.
 *
 * **Example** (Accept an explicit command)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CaptureKind } from "@beep/scratchpad/beep/Structured"
 *
 * console.log(S.is(CaptureKind)("explicit_command")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CaptureKind = LiteralKit([
  "explicit_command",
  "clear_commitment",
  "direct_request",
  "inferred_next_step",
]).pipe(
  $I.annoteSchema("CaptureKind", {
    description: "How explicitly the conversation captured an action item.",
  }),
);

/**
 * Decoded capture kind.
 *
 * @see {@link CaptureKind} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type CaptureKind = typeof CaptureKind.Type;

/**
 * Who owns a captured action item.
 *
 * **Example** (Accept an unknown owner)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CaptureOwner } from "@beep/scratchpad/beep/Structured"
 *
 * console.log(S.is(CaptureOwner)("unknown")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CaptureOwner = LiteralKit([
  "user",
  "other",
  "unknown",
]).pipe(
  $I.annoteSchema("CaptureOwner", {
    description: "Who owns a captured action item: user, other, or unknown.",
  }),
);

/**
 * Decoded capture owner.
 *
 * @see {@link CaptureOwner} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type CaptureOwner = typeof CaptureOwner.Type;

/**
 * How certain a due date is.
 *
 * **Example** (Accept a tentative due date)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DueCertainty } from "@beep/scratchpad/beep/Structured"
 *
 * console.log(S.is(DueCertainty)("tentative")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DueCertainty = LiteralKit([
  "confirmed",
  "tentative",
]).pipe(
  $I.annoteSchema("DueCertainty", {
    description: "Whether an action-item due date is confirmed or tentative.",
  }),
);

/**
 * Decoded due-date certainty.
 *
 * @see {@link DueCertainty} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type DueCertainty = typeof DueCertainty.Type;

/**
 * What the extractor wants done with an existing action item.
 *
 * **Example** (Accept an update)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CandidateAction } from "@beep/scratchpad/beep/Structured"
 *
 * console.log(S.is(CandidateAction)("update")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CandidateAction = LiteralKit(["create", "update", "complete"]).pipe(
  $I.annoteSchema("CandidateAction", {
    description: "Whether a captured item should be created, updated, or completed.",
  }),
);

/**
 * Decoded candidate action.
 *
 * @see {@link CandidateAction} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type CandidateAction = typeof CandidateAction.Type;

const otherCategory = "other" satisfies CategoryEnum;

/**
 * Maps an unusable category to `other`.
 *
 * **Details**
 *
 * Python `set_category_default_on_error` keeps a category value, tries to
 * construct one from anything else, and returns `other` when that fails.
 * `romance` is not a wire value, so it becomes `other`. `romantic` stays.
 *
 * **Gotchas**
 *
 * The schema field accepts a string and then runs this function. A non-string
 * fails that string schema. Call this function directly for a non-string; a
 * number becomes `other`, matching `CategoryEnum(value)` raising `ValueError`.
 *
 * **Example** (Replace the member name romance)
 *
 * ```ts
 * import { setCategoryDefaultOnError } from "@beep/scratchpad/beep/Structured"
 *
 * console.log(setCategoryDefaultOnError("romantic")) // "romantic"
 * console.log(setCategoryDefaultOnError("romance")) // "other"
 * console.log(setCategoryDefaultOnError(1)) // "other"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const setCategoryDefaultOnError = (value: unknown): CategoryEnum =>
  S.is(CategoryEnum)(value) ? value : otherCategory;

const categoryField = S.String.pipe(
  S.decodeTo(
    CategoryEnum,
    SchemaTransformation.transform<CategoryEnum, string>({
      decode: (value) => setCategoryDefaultOnError(value),
      encode: (value): string => value,
    }),
  ),
  S.withConstructorDefault(Effect.succeed<CategoryEnum>("other")),
  S.withDecodingDefaultTypeKey(Effect.succeed<CategoryEnum>("other")),
  pg.text(),
  pg.columnName("category"),
);

const defaultText = (column: string, value: string) =>
  SchemaUtils.withKeyDefaults(S.String, value).pipe(pg.text(), pg.columnName(column));

const defaultFlag = (column: string) =>
  SchemaUtils.withKeyDefaults(S.Boolean, false).pipe(pg.boolean(), pg.columnName(column));

const stringList = (column: string) =>
  SchemaUtils.withKeyDefaults(S.Array(S.String), emptyStrings).pipe(pg.jsonb(), pg.columnName(column));

const pad2 = (value: number): string => Str.padStart(2, "0")(String(value));
const pad4 = (value: number): string => Str.padStart(4, "0")(String(value));

const formatUtcClock = (instant: DateTime.DateTime): string => {
  const parts = DateTime.toPartsUtc(instant);
  return `${pad4(parts.year)}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
};

const pythonCapitalize = (value: string): string =>
  Str.isEmpty(value) ? value : `${Str.toUpperCase(Str.takeLeft(1)(value))}${Str.toLowerCase(Str.slice(1)(value))}`;

const timestampLabel = (label: string, value: O.Option<DateTime.DateTime>): O.Option<string> =>
  O.map(value, (instant) => `${label}: ${formatUtcClock(instant)} UTC`);

/**
 * One action item extracted from a conversation.
 *
 * **Details**
 *
 * `description` is the action to complete. `completed` defaults to false.
 * The timestamps, conversation id, capture fields, owner name, and source
 * segment ids are optional. Confidence fields are 0 through 1 when present.
 *
 * **Example** (Construct a pending item)
 *
 * ```ts
 * import { ActionItem } from "@beep/scratchpad/beep/Structured"
 *
 * const item = ActionItem.make({ description: "Send the notes" })
 * console.log(item.completed) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActionItem extends Model<ActionItem>("ActionItem")(
  {
    description: text("description"),
    completed: defaultFlag("completed"),
    createdAt: optionalTimestamp("created_at"),
    updatedAt: optionalTimestamp("updated_at"),
    dueAt: optionalTimestamp("due_at"),
    completedAt: optionalTimestamp("completed_at"),
    conversationId: optionalText("conversation_id"),
    captureKind: optionalNull(CaptureKind).pipe(pg.text(), pg.columnName("capture_kind")),
    captureConfidence: optionalConfidence("capture_confidence"),
    ownershipConfidence: optionalConfidence("ownership_confidence"),
    captureOwner: optionalNull(CaptureOwner).pipe(pg.text(), pg.columnName("capture_owner")),
    ownerName: optionalText("owner_name"),
    context: optionalText("context"),
    dueCertainty: optionalNull(DueCertainty).pipe(pg.text(), pg.columnName("due_certainty")),
    concreteDeliverable: optionalBool("concrete_deliverable"),
    candidateAction: optionalNull(CandidateAction).pipe(pg.text(), pg.columnName("candidate_action")),
    targetTaskId: optionalText("target_task_id"),
    sourceSegmentIds: stringList("source_segment_ids"),
  },
  $I.annote("ActionItem", {
    description: "Action item extracted from a conversation.",
  }),
  (columns) => [
    unitIntervalCheck("capture_confidence")(columns.captureConfidence),
    unitIntervalCheck("ownership_confidence")(columns.ownershipConfidence),
  ],
) {}

/**
 * Encoded action item before decoding.
 *
 * @see {@link ActionItem} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ActionItem {
  export type Encoded = S.Codec.Encoded<typeof ActionItem>;
}

/**
 * Renders action items the way `ActionItem.actions_to_string` does.
 *
 * **Details**
 *
 * An empty list returns the string `None`, not an empty string and not an
 * absent value. Each line is `- description (pending|completed)`. Present
 * timestamps are appended as `Created`, `Due`, and `Completed`, formatted as
 * `YYYY-MM-DD HH:MM:SS UTC`.
 *
 * **Example** (Render no items)
 *
 * ```ts
 * import { actionsToString } from "@beep/scratchpad/beep/Structured"
 *
 * console.log(actionsToString([])) // "None"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
const joinWith = (lines: ReadonlyArray<string>, separator: string): string => {
  let result = "";
  let index = 0;
  for (const line of lines) {
    result = index === 0 ? line : `${result}${separator}${line}`;
    index += 1;
  }
  return result;
};

export const actionsToString = (actionItems: ReadonlyArray<ActionItem>): string => {
  if (actionItems.length === 0) return "None";
  return joinWith(
    A.map(actionItems, (item) => {
      const status = Bool.match(item.completed, { onFalse: () => "pending", onTrue: () => "completed" });
      const stamps = A.getSomes([
        timestampLabel("Created", item.createdAt),
        timestampLabel("Due", item.dueAt),
        timestampLabel("Completed", item.completedAt),
      ]);
      const line = `- ${item.description} (${status})`;
      return stamps.length === 0 ? line : `${line} [${joinWith(stamps, ", ")}]`;
    }),
    "\n",
  );
};

/**
 * One calendar event extracted from a conversation.
 *
 * **Details**
 *
 * `start` is the event start. `duration` is minutes and defaults to 30.
 * `created` defaults to false.
 *
 * **Example** (Construct the default duration)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { Event } from "@beep/scratchpad/beep/Structured"
 *
 * const event = Event.make({
 *   title: "Standup",
 *   description: "",
 *   start: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(event.duration) // 30
 * console.log(event.created) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Event extends Model<Event>("Event")(
  {
    title: text("title"),
    description: defaultText("description", ""),
    start: timestamp("start"),
    duration: SchemaUtils.withKeyDefaults(S.Int, 30).pipe(pg.integer(), pg.columnName("duration")),
    created: defaultFlag("created"),
  },
  $I.annote("Event", {
    description: "Calendar event extracted from a conversation.",
  }),
) {}

/**
 * Encoded event before decoding.
 *
 * @see {@link Event} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Event {
  export type Encoded = S.Codec.Encoded<typeof Event>;
}

/**
 * Renders events the way `Event.events_to_string` does.
 *
 * **Details**
 *
 * An empty list returns the string `None`. Each event is
 * `- title (YYYY-MM-DD HH:MM:SS UTC)`. A non-empty description is a following
 * indented line.
 *
 * **Example** (Render no events)
 *
 * ```ts
 * import { eventsToString } from "@beep/scratchpad/beep/Structured"
 *
 * console.log(eventsToString([])) // "None"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const eventsToString = (events: ReadonlyArray<Event>): string => {
  if (events.length === 0) return "None";
  return joinWith(
    A.map(events, (event) => {
      const headline = `${event.title} (${formatUtcClock(event.start)} UTC)`;
      return Str.isEmpty(event.description) ? `- ${headline}` : `- ${headline}\n  ${event.description}`;
    }),
    "\n",
  );
};

/**
 * Copies an event and replaces `start` with an ISO-8601 string.
 *
 * **Details**
 *
 * Python `as_dict_cleaned_dates` dumps the model and replaces `start` with
 * `isoformat()`. The keys here are the decoded camelCase names. The instant is
 * `DateTime.formatIso`, which uses a `Z` suffix rather than Python's `+00:00`.
 *
 * **Example** (Format the start)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { Event, asDictCleanedDates } from "@beep/scratchpad/beep/Structured"
 *
 * const event = Event.make({
 *   title: "Standup",
 *   description: "Notes",
 *   start: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(asDictCleanedDates(event).start) // "2020-01-02T03:04:05.000Z"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const asDictCleanedDates = (
  event: Event,
): {
  readonly title: string;
  readonly description: string;
  readonly start: string;
  readonly duration: number;
  readonly created: boolean;
} => ({
  title: event.title,
  description: event.description,
  start: DateTime.formatIso(event.start),
  duration: event.duration,
  created: event.created,
});

/**
 * One free-form note section.
 *
 * **Details**
 *
 * `heading` and `bodyMarkdown` are required. `sourceSegmentIds` defaults to
 * an empty list.
 *
 * **Example** (Decode a section)
 *
 * ```ts
 * import { Section } from "@beep/scratchpad/beep/Structured"
 *
 * const section = Section.make({ heading: "Notes", bodyMarkdown: "Shipped it." })
 * console.log(section.heading) // "Notes"
 * console.log(section.sourceSegmentIds.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Section extends Model<Section>("Section")(
  {
    heading: text("heading"),
    bodyMarkdown: text("body_markdown"),
    sourceSegmentIds: stringList("source_segment_ids"),
  },
  $I.annote("Section", {
    description: "Free-form note section in the model-chosen structure.",
  }),
) {}

/**
 * Encoded section before decoding.
 *
 * @see {@link Section} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Section {
  export type Encoded = S.Codec.Encoded<typeof Section>;
}

const emptySections: Array<Section> = [];
const emptyItems: Array<ActionItem> = [];
const emptyEvents: Array<Event> = [];

/**
 * Title, overview, sections, action items, and events for one conversation.
 *
 * **Details**
 *
 * `title` and `overview` default to an empty string. `emoji` defaults to the
 * brain emoji. `category` defaults to `other` and an unknown category string
 * also becomes `other`. The three lists default to empty.
 *
 * **Gotchas**
 *
 * `romance` decodes as `other`. The wire value is `romantic`. A non-string
 * category fails the string schema; {@link setCategoryDefaultOnError} is the
 * direct call for that Python branch.
 *
 * **Example** (Construct the defaults)
 *
 * ```ts
 * import { Structured } from "@beep/scratchpad/beep/Structured"
 *
 * const summary = Structured.make({})
 * console.log(summary.category) // "other"
 * console.log(summary.emoji) // "🧠"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Structured extends Model<Structured>("Structured")(
  {
    title: defaultText("title", ""),
    overview: defaultText("overview", ""),
    emoji: defaultText("emoji", brain),
    category: categoryField,
    sections: SchemaUtils.withKeyDefaults(S.Array(Section), emptySections).pipe(pg.jsonb(), pg.columnName("sections")),
    actionItems: SchemaUtils.withKeyDefaults(S.Array(ActionItem), emptyItems).pipe(
      pg.jsonb(),
      pg.columnName("action_items"),
    ),
    events: SchemaUtils.withKeyDefaults(S.Array(Event), emptyEvents).pipe(pg.jsonb(), pg.columnName("events")),
  },
  $I.annote("Structured", {
    description: "Conversation title, overview, sections, action items, and events.",
  }),
) {}

/**
 * Encoded conversation summary before decoding.
 *
 * @see {@link Structured} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Structured {
  export type Encoded = S.Codec.Encoded<typeof Structured>;
}

/**
 * Renders a summary the way Python `Structured.__str__` does.
 *
 * **Details**
 *
 * The title and category are capitalized, then the overview. Action items and
 * events are appended only when their lists are non-empty. The result is
 * stripped.
 *
 * **Example** (Render a title and overview)
 *
 * ```ts
 * import { Structured, formatStructured } from "@beep/scratchpad/beep/Structured"
 *
 * const summary = Structured.make({ title: "hello", overview: "world" })
 * console.log(formatStructured(summary)) // "Hello (Other)\nWorld"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const formatStructured = (summary: Structured): string => {
  let result = `${pythonCapitalize(summary.title)} (${pythonCapitalize(summary.category)})\n${pythonCapitalize(summary.overview)}\n`;
  if (summary.actionItems.length > 0) {
    result = `${result}Action Items:\n${actionsToString(summary.actionItems)}\n`;
  }
  if (summary.events.length > 0) {
    result = `${result}Events:\n${eventsToString(summary.events)}\n`;
  }
  return Str.trim(result);
};
