/**
 * Admin announcements, changelogs, and feature callouts.
 *
 * `type` chooses the content shape. The shell fields stay on every arm.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { Model, optionalNull, optionalText, pg, text, timestamp } from "./Kit.ts";

const decodeDateTimeUtcFromString = S.decodeEffect(S.DateTimeUtcFromString);

const $I = $ScratchpadId.create("beep/Announcement");

const boolDefault = (column: string, value: boolean) =>
  S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(value)), pg.boolean(), pg.columnName(column));

const intDefault = (column: string, value: number) =>
  S.Int.pipe(S.withConstructorDefault(Effect.succeed(value)), pg.integer(), pg.columnName(column));

const optionalTimestamp = (column: string) =>
  optionalNull(S.DateTimeUtcFromString).pipe(
    pg.timestamp({ mode: "string", withTimezone: true }),
    pg.columnName(column),
  );

const epoch = DateTime.makeUnsafe("1970-01-01T00:00:00.000Z");

/**
 * Which content shape an announcement carries.
 *
 * **Example** (Decode a changelog)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AnnouncementType } from "@beep/scratchpad/beep/Announcement"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(AnnouncementType)("changelog"))
 * console.log(decoded) // "changelog"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AnnouncementType = LiteralKit(["changelog", "feature", "announcement"]).pipe(
  $I.annoteSchema("AnnouncementType", {
    description: "Announcement content kind: changelog, feature, or announcement.",
  }),
);

/**
 * Decoded announcement type.
 *
 * @see {@link AnnouncementType} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type AnnouncementType = typeof AnnouncementType.Type;

const isAnnouncementType = S.is(AnnouncementType);

/**
 * When a client should consider showing the announcement.
 *
 * **Example** (Decode an immediate trigger)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TriggerType } from "@beep/scratchpad/beep/Announcement"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TriggerType)("immediate"))
 * console.log(decoded) // "immediate"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TriggerType = LiteralKit(["immediate", "version_upgrade", "firmware_upgrade"]).pipe(
  $I.annoteSchema("TriggerType", {
    description: "When the client checks an announcement: every launch, app upgrade, or firmware upgrade.",
  }),
);

/**
 * Decoded trigger.
 *
 * @see {@link TriggerType} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type TriggerType = typeof TriggerType.Type;

/**
 * One changelog bullet.
 *
 * **Example** (Indent a nested bullet)
 *
 * ```ts
 * import { ChangelogItem } from "@beep/scratchpad/beep/Announcement"
 *
 * const item = ChangelogItem.make({ title: "Fix", description: "Audio", indentLevel: 1 })
 * console.log(item.indentLevel) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChangelogItem extends Model<ChangelogItem>("ChangelogItem")(
  {
    title: text("title"),
    description: text("description"),
    indentLevel: S.Int.check(S.isBetween({ minimum: 0, maximum: 3 })).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      pg.integer(),
      pg.columnName("indent_level"),
    ),
  },
  $I.annote("ChangelogItem", { description: "One changelog bullet, optionally indented." }),
  (columns) => [
    pg.Table.check("indent_level_between")(sql<boolean>`${columns.indentLevel} >= 0 and ${columns.indentLevel} <= 3`),
  ],
) {}

/**
 * Encoded form of {@link ChangelogItem}.
 *
 * @see {@link ChangelogItem} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChangelogItem {
  export type Encoded = S.Codec.Encoded<typeof ChangelogItem>;
}

/**
 * Changelog body: a title and its bullets.
 *
 * **Example** (One bullet)
 *
 * ```ts
 * import { ChangelogContent, ChangelogItem } from "@beep/scratchpad/beep/Announcement"
 *
 * const content = ChangelogContent.make({
 *   title: "January",
 *   changes: [ChangelogItem.make({ title: "Fix", description: "Audio" })],
 * })
 * console.log(content.changes.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChangelogContent extends Model<ChangelogContent>("ChangelogContent")(
  {
    title: text("title"),
    changes: S.Array(ChangelogItem).pipe(pg.jsonb(), pg.columnName("changes")),
  },
  $I.annote("ChangelogContent", { description: "Changelog title and its bullets." }),
) {}

/**
 * Encoded form of {@link ChangelogContent}.
 *
 * @see {@link ChangelogContent} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChangelogContent {
  export type Encoded = S.Codec.Encoded<typeof ChangelogContent>;
}

const encodeChangelogContent = S.encodeEffect(ChangelogContent);

/**
 * One step in a feature walkthrough.
 *
 * **Example** (Name a step)
 *
 * ```ts
 * import { FeatureStep } from "@beep/scratchpad/beep/Announcement"
 *
 * const step = FeatureStep.make({ title: "Open", description: "Tap the orb" })
 * console.log(step.title) // "Open"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeatureStep extends Model<FeatureStep>("FeatureStep")(
  {
    title: text("title"),
    description: text("description"),
  },
  $I.annote("FeatureStep", { description: "One step in a feature walkthrough." }),
) {}

/**
 * Encoded form of {@link FeatureStep}.
 *
 * @see {@link FeatureStep} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FeatureStep {
  export type Encoded = S.Codec.Encoded<typeof FeatureStep>;
}

/**
 * Feature walkthrough body.
 *
 * **Example** (One step)
 *
 * ```ts
 * import { FeatureContent, FeatureStep } from "@beep/scratchpad/beep/Announcement"
 *
 * const content = FeatureContent.make({
 *   title: "Memory",
 *   steps: [FeatureStep.make({ title: "Open", description: "Tap the orb" })],
 * })
 * console.log(content.title) // "Memory"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeatureContent extends Model<FeatureContent>("FeatureContent")(
  {
    title: text("title"),
    steps: S.Array(FeatureStep).pipe(pg.jsonb(), pg.columnName("steps")),
  },
  $I.annote("FeatureContent", { description: "Feature title and its walkthrough steps." }),
) {}

/**
 * Encoded form of {@link FeatureContent}.
 *
 * @see {@link FeatureContent} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FeatureContent {
  export type Encoded = S.Codec.Encoded<typeof FeatureContent>;
}

const encodeFeatureContent = S.encodeEffect(FeatureContent);

/**
 * General announcement body.
 *
 * **Example** (Body without an image)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AnnouncementContent } from "@beep/scratchpad/beep/Announcement"
 *
 * const content = AnnouncementContent.make({ title: "Hello", body: "World" })
 * console.log(O.isNone(content.imageUrl)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AnnouncementContent extends Model<AnnouncementContent>("AnnouncementContent")(
  {
    title: text("title"),
    body: text("body"),
    imageUrl: optionalText("image_url"),
    actionType: optionalText("action_type"),
    actionUrl: optionalText("action_url"),
  },
  $I.annote("AnnouncementContent", { description: "General announcement title, body, and optional action." }),
) {}

/**
 * Encoded form of {@link AnnouncementContent}.
 *
 * @see {@link AnnouncementContent} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AnnouncementContent {
  export type Encoded = S.Codec.Encoded<typeof AnnouncementContent>;
}

const encodeAnnouncementContent = S.encodeEffect(AnnouncementContent);

/**
 * Who should see an announcement.
 *
 * **Details**
 *
 * Version bounds, device models, and platforms are open strings. `trigger`
 * constructs as `version_upgrade`. `testUids`, when present, limits the
 * announcement to those users.
 *
 * **Example** (Default the trigger)
 *
 * ```ts
 * import { Targeting } from "@beep/scratchpad/beep/Announcement"
 *
 * const targeting = Targeting.make({})
 * console.log(targeting.trigger) // "version_upgrade"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Targeting extends Model<Targeting>("Targeting")(
  {
    appVersionMin: optionalText("app_version_min"),
    appVersionMax: optionalText("app_version_max"),
    firmwareVersionMin: optionalText("firmware_version_min"),
    firmwareVersionMax: optionalText("firmware_version_max"),
    deviceModels: S.String.pipe(S.Array, optionalNull, pg.jsonb(), pg.columnName("device_models")),
    platforms: S.String.pipe(S.Array, optionalNull, pg.jsonb(), pg.columnName("platforms")),
    trigger: TriggerType.pipe(
      S.withConstructorDefault(Effect.succeed<TriggerType>("version_upgrade")),
      pg.text(),
      pg.columnName("trigger"),
    ),
    testUids: S.String.pipe(S.Array, optionalNull, pg.jsonb(), pg.columnName("test_uids")),
  },
  $I.annote("Targeting", { description: "Who sees an announcement, and when the client checks." }),
) {}

/**
 * Encoded form of {@link Targeting}.
 *
 * @see {@link Targeting} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Targeting {
  export type Encoded = S.Codec.Encoded<typeof Targeting>;
}

const decodeTargeting = S.decodeUnknownEffect(Targeting);

/**
 * How an announcement is displayed.
 *
 * **Details**
 *
 * `priority` constructs as 0. `dismissible` and `showOnce` construct as true.
 * `startAt` and `expiresAt` are UTC instants and stay datetime values in
 * {@link displayToDict}.
 *
 * **Example** (Construct a dismissible card)
 *
 * ```ts
 * import { Display } from "@beep/scratchpad/beep/Announcement"
 *
 * const display = Display.make({})
 * console.log(display.dismissible) // true
 * console.log(display.showOnce) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Display extends Model<Display>("Display")(
  {
    priority: intDefault("priority", 0),
    startAt: optionalTimestamp("start_at"),
    expiresAt: optionalTimestamp("expires_at"),
    dismissible: boolDefault("dismissible", true),
    showOnce: boolDefault("show_once", true),
  },
  $I.annote("Display", { description: "Display timing and dismissal rules for an announcement." }),
) {}

/**
 * Encoded form of {@link Display}.
 *
 * @see {@link Display} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Display {
  export type Encoded = S.Codec.Encoded<typeof Display>;
}

const decodeDisplay = S.decodeUnknownEffect(Display);

const shell = {
  id: text("id"),
  createdAt: timestamp("created_at"),
  active: boolDefault("active", true),
  appVersion: optionalText("app_version"),
  firmwareVersion: optionalText("firmware_version"),
  deviceModels: S.String.pipe(S.Array, optionalNull, pg.jsonb(), pg.columnName("device_models")),
  expiresAt: optionalNull(S.DateTimeUtcFromString).pipe(
    pg.timestamp({ mode: "string", withTimezone: true }),
    pg.columnName("expires_at"),
  ),
  targeting: optionalNull(Targeting).pipe(pg.jsonb(), pg.columnName("targeting")),
  display: optionalNull(Display).pipe(pg.jsonb(), pg.columnName("display")),
};

/**
 * Changelog announcement. `type` is `changelog` and content is {@link ChangelogContent}.
 *
 * **Example** (Construct a changelog)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { ChangelogAnnouncement, ChangelogContent, ChangelogItem } from "@beep/scratchpad/beep/Announcement"
 *
 * const row = ChangelogAnnouncement.make({
 *   id: "log-1",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   content: ChangelogContent.make({
 *     title: "January",
 *     changes: [ChangelogItem.make({ title: "Fix", description: "Audio" })],
 *   }),
 * })
 * console.log(row.type) // "changelog"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChangelogAnnouncement extends Model<ChangelogAnnouncement>("ChangelogAnnouncement")(
  {
    ...shell,
    type: S.tag("changelog").pipe(pg.text(), pg.columnName("type")),
    content: ChangelogContent.pipe(pg.jsonb(), pg.columnName("content")),
  },
  $I.annote("ChangelogAnnouncement", { description: "Announcement whose content is a changelog." }),
) {}

/**
 * Encoded form of {@link ChangelogAnnouncement}.
 *
 * @see {@link ChangelogAnnouncement} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChangelogAnnouncement {
  export type Encoded = S.Codec.Encoded<typeof ChangelogAnnouncement>;
}

/**
 * Feature announcement. `type` is `feature` and content is {@link FeatureContent}.
 *
 * **Example** (Construct a feature)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { FeatureAnnouncement, FeatureContent, FeatureStep } from "@beep/scratchpad/beep/Announcement"
 *
 * const row = FeatureAnnouncement.make({
 *   id: "feat-1",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   content: FeatureContent.make({
 *     title: "Memory",
 *     steps: [FeatureStep.make({ title: "Open", description: "Tap the orb" })],
 *   }),
 * })
 * console.log(row.type) // "feature"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeatureAnnouncement extends Model<FeatureAnnouncement>("FeatureAnnouncement")(
  {
    ...shell,
    type: S.tag("feature").pipe(pg.text(), pg.columnName("type")),
    content: FeatureContent.pipe(pg.jsonb(), pg.columnName("content")),
  },
  $I.annote("FeatureAnnouncement", { description: "Announcement whose content is a feature walkthrough." }),
) {}

/**
 * Encoded form of {@link FeatureAnnouncement}.
 *
 * @see {@link FeatureAnnouncement} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FeatureAnnouncement {
  export type Encoded = S.Codec.Encoded<typeof FeatureAnnouncement>;
}

/**
 * General announcement. `type` is `announcement` and content is {@link AnnouncementContent}.
 *
 * **Example** (Construct a notice)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { AnnouncementContent, NoticeAnnouncement } from "@beep/scratchpad/beep/Announcement"
 *
 * const row = NoticeAnnouncement.make({
 *   id: "note-1",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   content: AnnouncementContent.make({ title: "Hello", body: "World" }),
 * })
 * console.log(row.type) // "announcement"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NoticeAnnouncement extends Model<NoticeAnnouncement>("NoticeAnnouncement")(
  {
    ...shell,
    type: S.tag("announcement").pipe(pg.text(), pg.columnName("type")),
    content: AnnouncementContent.pipe(pg.jsonb(), pg.columnName("content")),
  },
  $I.annote("NoticeAnnouncement", { description: "Announcement whose content is a general notice." }),
) {}

/**
 * Encoded form of {@link NoticeAnnouncement}.
 *
 * @see {@link NoticeAnnouncement} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NoticeAnnouncement {
  export type Encoded = S.Codec.Encoded<typeof NoticeAnnouncement>;
}

/**
 * Announcement tagged by content kind.
 *
 * **Details**
 *
 * `type` partitions `content`. Changelog, feature, and general notice are
 * three members. The shell fields are the same on each member.
 *
 * **Gotchas**
 *
 * Python stored `content` as an unchecked dict and parsed it in getters. This
 * union rejects content that does not match `type` at decode time.
 *
 * **Example** (Decode a notice)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Announcement } from "@beep/scratchpad/beep/Announcement"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(Announcement)({
 *     id: "note-1",
 *     type: "announcement",
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     active: true,
 *     content: { title: "Hello", body: "World" },
 *   }),
 * )
 * console.log(decoded.type) // "announcement"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Announcement = LiteralKit(["changelog", "feature", "announcement"])
  .mapMembers(Tuple.evolve([() => ChangelogAnnouncement, () => FeatureAnnouncement, () => NoticeAnnouncement]))
  .pipe(
    S.toTaggedUnion("type"),
    $I.annoteSchema("Announcement", {
      description: "Announcement whose type selects changelog, feature, or general content.",
    }),
  );

/**
 * Decoded announcement.
 *
 * @see {@link Announcement} for the runtime union.
 * @category type-level
 * @since 0.0.0
 */
export type Announcement = typeof Announcement.Type;

const decodeAnnouncement = S.decodeUnknownEffect(Announcement);

/**
 * Content getter was called for a different announcement type.
 *
 * **Example** (Name the mismatch)
 *
 * ```ts
 * import { AnnouncementContentMismatch } from "@beep/scratchpad/beep/Announcement"
 *
 * const error = AnnouncementContentMismatch.make({ expected: "changelog", actual: "feature" })
 * console.log(error.expected) // "changelog"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AnnouncementContentMismatch extends S.TaggedError<AnnouncementContentMismatch>()(
  "AnnouncementContentMismatch",
  { expected: S.String, actual: S.String },
  $I.annoteError<AnnouncementContentMismatch>("AnnouncementContentMismatch", {
    description: "An announcement content getter was used for a different type.",
  }),
) {}

/**
 * Encoded form of {@link AnnouncementContentMismatch}.
 *
 * @see {@link AnnouncementContentMismatch} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AnnouncementContentMismatch {
  export type Encoded = S.Codec.Encoded<typeof AnnouncementContentMismatch>;
}

/**
 * Changelog content, or a mismatch when the announcement is not a changelog.
 *
 * **Example** (Read changelog content)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { ChangelogAnnouncement, ChangelogContent, ChangelogItem, getChangelogContent } from "@beep/scratchpad/beep/Announcement"
 *
 * const row = ChangelogAnnouncement.make({
 *   id: "log-1",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   content: ChangelogContent.make({
 *     title: "January",
 *     changes: [ChangelogItem.make({ title: "Fix", description: "Audio" })],
 *   }),
 * })
 * const content = Effect.runSync(getChangelogContent(row))
 * console.log(content.title) // "January"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getChangelogContent = Effect.fn("Announcement.getChangelogContent")(function* (
  announcement: Announcement,
) {
  if (announcement.type !== "changelog") {
    return yield* AnnouncementContentMismatch.make({ expected: "changelog", actual: announcement.type });
  }
  return announcement.content;
});

/**
 * Feature content, or a mismatch when the announcement is not a feature.
 *
 * **Example** (Reject a notice)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { AnnouncementContent, NoticeAnnouncement, getFeatureContent } from "@beep/scratchpad/beep/Announcement"
 *
 * const row = NoticeAnnouncement.make({
 *   id: "note-1",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   content: AnnouncementContent.make({ title: "Hello", body: "World" }),
 * })
 * const failed = Effect.runSyncExit(getFeatureContent(row))._tag
 * console.log(failed) // "Failure"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getFeatureContent = Effect.fn("Announcement.getFeatureContent")(function* (announcement: Announcement) {
  if (announcement.type !== "feature") {
    return yield* AnnouncementContentMismatch.make({ expected: "feature", actual: announcement.type });
  }
  return announcement.content;
});

/**
 * General content, or a mismatch when the announcement is a changelog or feature.
 *
 * **Example** (Read notice content)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { AnnouncementContent, NoticeAnnouncement, getAnnouncementContent } from "@beep/scratchpad/beep/Announcement"
 *
 * const row = NoticeAnnouncement.make({
 *   id: "note-1",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   content: AnnouncementContent.make({ title: "Hello", body: "World" }),
 * })
 * const content = Effect.runSync(getAnnouncementContent(row))
 * console.log(content.body) // "World"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getAnnouncementContent = Effect.fn("Announcement.getAnnouncementContent")(function* (
  announcement: Announcement,
) {
  if (announcement.type !== "announcement") {
    return yield* AnnouncementContentMismatch.make({ expected: "announcement", actual: announcement.type });
  }
  return announcement.content;
});

/**
 * Python dict for targeting. Absent options are null.
 *
 * **Example** (Keep a null version floor)
 *
 * ```ts
 * import { Targeting, targetingToDict } from "@beep/scratchpad/beep/Announcement"
 *
 * const dict = targetingToDict(Targeting.make({}))
 * console.log(dict.app_version_min) // null
 * console.log(dict.trigger) // "version_upgrade"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const targetingToDict = (targeting: Targeting) => ({
  app_version_min: O.getOrNull(targeting.appVersionMin),
  app_version_max: O.getOrNull(targeting.appVersionMax),
  firmware_version_min: O.getOrNull(targeting.firmwareVersionMin),
  firmware_version_max: O.getOrNull(targeting.firmwareVersionMax),
  device_models: O.getOrNull(targeting.deviceModels),
  platforms: O.getOrNull(targeting.platforms),
  trigger: targeting.trigger,
  test_uids: O.getOrNull(targeting.testUids),
});

/**
 * Python dict for display. Timestamps stay datetime values, not strings.
 *
 * **Example** (Keep a null start)
 *
 * ```ts
 * import { Display, displayToDict } from "@beep/scratchpad/beep/Announcement"
 *
 * const dict = displayToDict(Display.make({}))
 * console.log(dict.start_at) // null
 * console.log(dict.dismissible) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const displayToDict = (display: Display) => ({
  priority: display.priority,
  start_at: O.getOrNull(display.startAt),
  expires_at: O.getOrNull(display.expiresAt),
  dismissible: display.dismissible,
  show_once: display.showOnce,
});

/**
 * Stored targeting, or one built from the legacy shell fields.
 *
 * **Details**
 *
 * When targeting is absent, both app version bounds copy `appVersion`, both
 * firmware bounds copy `firmwareVersion`, device models are copied, and the
 * trigger is `version_upgrade`.
 *
 * **Example** (Copy a legacy app version)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { AnnouncementContent, NoticeAnnouncement, getEffectiveTargeting } from "@beep/scratchpad/beep/Announcement"
 *
 * const row = NoticeAnnouncement.make({
 *   id: "note-1",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   appVersion: O.some("1.2.0"),
 *   content: AnnouncementContent.make({ title: "Hello", body: "World" }),
 * })
 * const targeting = getEffectiveTargeting(row)
 * console.log(O.getOrNull(targeting.appVersionMin)) // "1.2.0"
 * console.log(targeting.trigger) // "version_upgrade"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getEffectiveTargeting = (announcement: Announcement): Targeting =>
  O.match(announcement.targeting, {
    onSome: (targeting) => targeting,
    onNone: () =>
      Targeting.make({
        appVersionMin: announcement.appVersion,
        appVersionMax: announcement.appVersion,
        firmwareVersionMin: announcement.firmwareVersion,
        firmwareVersionMax: announcement.firmwareVersion,
        deviceModels: announcement.deviceModels,
        trigger: "version_upgrade",
      }),
  });

/**
 * Stored display, or one whose expiry copies the shell `expiresAt`.
 *
 * **Example** (Copy a legacy expiry)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { AnnouncementContent, NoticeAnnouncement, getEffectiveDisplay } from "@beep/scratchpad/beep/Announcement"
 *
 * const expires = DateTime.makeUnsafe("2020-02-02T03:04:05.000Z")
 * const row = NoticeAnnouncement.make({
 *   id: "note-1",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   expiresAt: O.some(expires),
 *   content: AnnouncementContent.make({ title: "Hello", body: "World" }),
 * })
 * const display = getEffectiveDisplay(row)
 * console.log(O.getOrNull(display.expiresAt) === expires) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getEffectiveDisplay = (announcement: Announcement): Display =>
  O.match(announcement.display, {
    onSome: (display) => display,
    onNone: () => Display.make({ expiresAt: announcement.expiresAt }),
  });

const readTargeting = Effect.fn("Announcement.readTargeting")(function* (value: unknown) {
  if (!P.isObject(value) || A.isArray(value)) return O.none<Targeting>();
  const result = yield* Effect.result(decodeTargeting(value));
  return Result.isSuccess(result) ? O.some(result.success) : O.none<Targeting>();
});

const readDisplay = Effect.fn("Announcement.readDisplay")(function* (value: unknown) {
  if (!P.isObject(value) || A.isArray(value)) return O.none<Display>();
  const result = yield* Effect.result(decodeDisplay(value));
  return Result.isSuccess(result) ? O.some(result.success) : O.none<Display>();
});

const readCreatedAt = (value: unknown) => {
  if (value === undefined || value === null || value === "") return Effect.succeed(epoch);
  if (DateTime.isDateTime(value)) return Effect.succeed(value.pipe(DateTime.toUtc));
  if (P.isString(value)) return decodeDateTimeUtcFromString(value);
  return Effect.fail(AnnouncementContentMismatch.make({ expected: "datetime", actual: "created_at" }));
};

const readActive = (value: unknown) => {
  if (value === undefined) return Effect.succeed(true);
  if (P.isBoolean(value)) return Effect.succeed(value);
  return Effect.fail(AnnouncementContentMismatch.make({ expected: "boolean", actual: "active" }));
};

/**
 * Builds an announcement from a stored dict.
 *
 * **Details**
 *
 * An unknown `type` becomes `announcement` so one bad row does not fail a list.
 * A missing id becomes `""`. A missing, null, or empty `created_at` becomes the
 * UTC epoch. Targeting and display that are not objects, or that fail their
 * schemas, are dropped. Content must match the resolved type.
 *
 * **Gotchas**
 *
 * Python kept an unchecked content dict. This function fails when content does
 * not match the type, including the `{}` default.
 *
 * **Example** (Fall back from a bad type)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { announcementFromDict } from "@beep/scratchpad/beep/Announcement"
 *
 * const row = Effect.runSync(
 *   announcementFromDict({
 *     id: "note-1",
 *     type: "nope",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     content: { title: "Hello", body: "World" },
 *   }),
 * )
 * console.log(row.type) // "announcement"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const announcementFromDict = Effect.fn("Announcement.fromDict")(function* (input: unknown) {
  if (!P.isObject(input) || A.isArray(input)) {
    return yield* AnnouncementContentMismatch.make({ expected: "object", actual: "announcement" });
  }
  const data: { [key: string]: unknown } = { ...input };
  const type: AnnouncementType = isAnnouncementType(data.type) ? data.type : "announcement";
  const id = P.isString(data.id) ? data.id : "";
  const createdAt = DateTime.formatIso(yield* readCreatedAt(data.created_at));
  const active = yield* readActive(data.active);
  const targeting = yield* readTargeting(data.targeting);
  const display = yield* readDisplay(data.display);
  const content = data.content === undefined ? {} : data.content;
  const wire: unknown = {
    id,
    type,
    createdAt,
    active,
    appVersion: data.app_version ?? null,
    firmwareVersion: data.firmware_version ?? null,
    deviceModels: data.device_models ?? null,
    expiresAt: data.expires_at ?? null,
    targeting: O.getOrNull(targeting),
    display: O.getOrNull(display),
    content,
  };
  return yield* decodeAnnouncement(wire);
});

/**
 * Python dict for an announcement. Nested models are included only when present.
 *
 * **Details**
 *
 * `created_at` and display timestamps stay datetime values. Content is encoded
 * to a plain object. Targeting and display keys are omitted when absent.
 *
 * **Example** (Omit an absent display)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { AnnouncementContent, NoticeAnnouncement, announcementToDict } from "@beep/scratchpad/beep/Announcement"
 *
 * const dict = Effect.runSync(
 *   announcementToDict(
 *     NoticeAnnouncement.make({
 *       id: "note-1",
 *       createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *       content: AnnouncementContent.make({ title: "Hello", body: "World" }),
 *     }),
 *   ),
 * )
 * console.log(dict.type) // "announcement"
 * console.log("display" in dict) // false
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const announcementToDict = Effect.fn("Announcement.toDict")(function* (announcement: Announcement) {
  const content = yield* Announcement.match(announcement, {
    changelog: (arm) => encodeChangelogContent(arm.content),
    feature: (arm) => encodeFeatureContent(arm.content),
    announcement: (arm) => encodeAnnouncementContent(arm.content),
  });
  const base = {
    id: announcement.id,
    type: announcement.type,
    created_at: announcement.createdAt,
    active: announcement.active,
    app_version: O.getOrNull(announcement.appVersion),
    firmware_version: O.getOrNull(announcement.firmwareVersion),
    device_models: O.getOrNull(announcement.deviceModels),
    expires_at: O.getOrNull(announcement.expiresAt),
    content,
  };
  const withTargeting = O.isSome(announcement.targeting)
    ? { ...base, targeting: targetingToDict(announcement.targeting.value) }
    : base;
  return O.isSome(announcement.display)
    ? { ...withTargeting, display: displayToDict(announcement.display.value) }
    : withTargeting;
});

/**
 * Changelog list response.
 *
 * **Example** (Empty changelog list)
 *
 * ```ts
 * import { ChangelogResponse } from "@beep/scratchpad/beep/Announcement"
 *
 * const page = ChangelogResponse.make({ changelogs: [] })
 * console.log(page.changelogs.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChangelogResponse extends Model<ChangelogResponse>("ChangelogResponse")(
  {
    changelogs: S.Array(Announcement).pipe(pg.jsonb(), pg.columnName("changelogs")),
  },
  $I.annote("ChangelogResponse", { description: "List of changelog announcements." }),
) {}

/**
 * Encoded form of {@link ChangelogResponse}.
 *
 * @see {@link ChangelogResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChangelogResponse {
  export type Encoded = S.Codec.Encoded<typeof ChangelogResponse>;
}

/**
 * Feature list response.
 *
 * **Example** (Empty feature list)
 *
 * ```ts
 * import { FeatureResponse } from "@beep/scratchpad/beep/Announcement"
 *
 * const page = FeatureResponse.make({ features: [] })
 * console.log(page.features.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeatureResponse extends Model<FeatureResponse>("FeatureResponse")(
  {
    features: S.Array(Announcement).pipe(pg.jsonb(), pg.columnName("features")),
  },
  $I.annote("FeatureResponse", { description: "List of feature announcements." }),
) {}

/**
 * Encoded form of {@link FeatureResponse}.
 *
 * @see {@link FeatureResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FeatureResponse {
  export type Encoded = S.Codec.Encoded<typeof FeatureResponse>;
}

/**
 * General announcement list response.
 *
 * **Example** (Empty announcement list)
 *
 * ```ts
 * import { AnnouncementListResponse } from "@beep/scratchpad/beep/Announcement"
 *
 * const page = AnnouncementListResponse.make({ announcements: [] })
 * console.log(page.announcements.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AnnouncementListResponse extends Model<AnnouncementListResponse>("AnnouncementListResponse")(
  {
    announcements: S.Array(Announcement).pipe(pg.jsonb(), pg.columnName("announcements")),
  },
  $I.annote("AnnouncementListResponse", { description: "List of general announcements." }),
) {}

/**
 * Encoded form of {@link AnnouncementListResponse}.
 *
 * @see {@link AnnouncementListResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AnnouncementListResponse {
  export type Encoded = S.Codec.Encoded<typeof AnnouncementListResponse>;
}
