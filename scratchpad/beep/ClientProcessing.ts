/**
 * Client-owned conversation summary delivered to the server.
 *
 * **Details**
 *
 * A capable client produces this projection and the server persists it
 * verbatim. It is not a memory and not a server-generated structured summary.
 * The wire version is exactly 1. Datetimes must be timezone-aware ISO-8601
 * strings. Numbers and naive timestamps are rejected.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as SchemaGetter from "effect/SchemaGetter";
import type * as SchemaAST from "effect/SchemaAST";
import * as SchemaIssue from "effect/SchemaIssue";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { textBoundsCheck } from "./Kit.ts";
import { CategoryEnum } from "./ConversationEnums.ts";
import {
  atLeastCheck,
  betweenCheck,
  boolDefault,
  intBetween,
  jsonbArrayLengthCheck,
  Model,
  optionalNull,
  pg,
} from "./Port.ts";

const $I = $ScratchpadId.create("beep/ClientProcessing");

/**
 * Wire version of a client processing projection.
 *
 * **Example** (Read the version)
 *
 * ```ts
 * import { CLIENT_PROCESSING_SCHEMA_VERSION } from "./ClientProcessing.ts"
 *
 * console.log(CLIENT_PROCESSING_SCHEMA_VERSION) // 1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CLIENT_PROCESSING_SCHEMA_VERSION = 1;

/**
 * Fields that name a projection family.
 *
 * **Example** (The family field is included)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { PROJECTION_FAMILY_FIELDS } from "./ClientProcessing.ts"
 *
 * console.log(HashSet.has(PROJECTION_FAMILY_FIELDS, "projection_family")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROJECTION_FAMILY_FIELDS = HashSet.fromIterable([
  "projection_family",
  "client_device_id",
  "client_device_label",
  "client_created_at",
  "client_timezone",
  "transcript_sha256",
]);

const emptyList = <A>(): ReadonlyArray<A> => [];

const tooLong = (value: string, maxLength: number, options: SchemaAST.ParseOptions) =>
  new SchemaIssue.InvalidValue(
    { message: `string too long (${value.length} > ${maxLength})` },
    value,
    options,
  );

const tooShort = (value: string, minLength: number, options: SchemaAST.ParseOptions) =>
  new SchemaIssue.InvalidValue(
    { message: `string too short (${Str.trim(value).length} < ${minLength})` },
    value,
    options,
  );

/**
 * Strips a string after enforcing the raw maximum length.
 *
 * **Details**
 *
 * The raw value is capped first, then stripped. A whitespace-only value fails
 * when `minLength` is greater than 0. Numbers are not strings, so they fail
 * before this transform.
 *
 * **Example** (Strip padding and reject a blank title)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { strippedText } from "./ClientProcessing.ts"
 *
 * const Title = strippedText(10, 1)
 * console.log(Effect.runSync(S.decodeUnknownEffect(Title)("  hi  "))) // "hi"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Maximum and minimum lengths are co-primary inputs, and neither is a pipeable value.
export const strippedText = (maxLength: number, minLength = 0) =>
  S.String.check(S.isMaxLength(maxLength)).pipe(
    S.decodeTo(
      minLength > 0
        ? S.String.check(S.isMinLength(minLength), S.isMaxLength(maxLength))
        : S.String.check(S.isMaxLength(maxLength)),
      {
        decode: SchemaGetter.transformEffect((value, options) => {
          if (value.length > maxLength) return Effect.fail(tooLong(value, maxLength, options));
          const stripped = Str.trim(value);
          if (stripped.length < minLength) return Effect.fail(tooShort(value, minLength, options));
          return Effect.succeed(stripped);
        }),
        encode: SchemaGetter.transform((value) => value),
      },
    ),
  );

const optionalStripped = (column: string, maxLength: number, minLength = 0) =>
  optionalNull(strippedText(maxLength, minLength)).pipe(pg.text(), pg.columnName(column));

const requiredStripped = (column: string, maxLength: number, minLength: number) =>
  strippedText(maxLength, minLength).pipe(pg.text(), pg.columnName(column));

const defaultedStripped = (column: string, maxLength: number, minLength: number, fallback: string) =>
  strippedText(maxLength, minLength).pipe(
    S.withConstructorDefault(Effect.succeed(fallback)),
    pg.text(),
    pg.columnName(column),
  );

/**
 * Timezone-aware UTC instant. Naive strings and numbers fail.
 *
 * **Example** (Reject a naive timestamp)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AwareInstant } from "./ClientProcessing.ts"
 *
 * console.log(Effect.runSyncExit(S.decodeUnknownEffect(AwareInstant)("2020-01-02T03:04:05"))._tag) // "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AwareInstant = S.String.check(S.isPattern(/[zZ]|[+-][0-9]{2}:[0-9]{2}$/)).pipe(
  S.decodeTo(S.DateTimeUtc, {
    decode: SchemaGetter.transformEffect((value, options) =>
      O.match(DateTime.make(value), {
        onNone: () =>
          Effect.fail(
            new SchemaIssue.InvalidValue({ message: "expected a timezone-aware ISO-8601 datetime" }, value, options),
          ),
        onSome: (instant) => Effect.succeed(instant.pipe(DateTime.toUtc)),
      }),
    ),
    encode: SchemaGetter.transform((value) => DateTime.formatIso(value)),
  }),
  $I.annoteSchema("AwareInstant", {
    description: "Timezone-aware ISO-8601 instant stored as UTC. Naive timestamps and numbers are rejected.",
  }),
);

const optionalAware = (column: string) =>
  optionalNull(AwareInstant).pipe(pg.timestamp({ mode: "string", withTimezone: true }), pg.columnName(column));

const requiredAware = (column: string) =>
  AwareInstant.pipe(pg.timestamp({ mode: "string", withTimezone: true }), pg.columnName(column));

/**
 * IANA timezone name, trimmed on decode. Blank strings, unknown zones, and numbers fail.
 *
 * **Example** (Accept a trimmed zone and reject an unknown one)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { IanaTimezone } from "./ClientProcessing.ts"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(IanaTimezone)(" Europe/Lisbon "))) // "Europe/Lisbon"
 * console.log(Effect.runSyncExit(S.decodeUnknownEffect(IanaTimezone)("Mars/Olympus"))._tag) // "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IanaTimezone = S.String.pipe(
  S.decodeTo(S.String.check(S.isMinLength(1)), {
    decode: SchemaGetter.transformEffect((value, options) => {
      const stripped = Str.trim(value);
      if (stripped.length === 0 || O.isNone(DateTime.zoneFromString(stripped))) {
        return Effect.fail(
          new SchemaIssue.InvalidValue({ message: "client_timezone must be an IANA timezone name" }, value, options),
        );
      }
      return Effect.succeed(stripped);
    }),
    encode: SchemaGetter.transform((value) => value),
  }),
  $I.annoteSchema("IanaTimezone", {
    description: "IANA timezone name. Blank strings and numeric timestamps are rejected.",
  }),
);

/**
 * Decoded type of {@link IanaTimezone}.
 *
 * @see {@link IanaTimezone} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type IanaTimezone = typeof IanaTimezone.Type;

const categoryColumn = (column: string) =>
  CategoryEnum.pipe(
    S.withConstructorDefault(Effect.succeed<CategoryEnum>("other")),
    pg.text(),
    pg.columnName(column),
  );

const cappedList = <A extends S.Top>(schema: A, column: string, maximum: number) =>
  S.Array(schema)
    .check(S.isMaxLength(maximum))
    .pipe(
      S.withConstructorDefault(Effect.sync(() => emptyList<A["Type"]>())),
      pg.jsonb(),
      pg.columnName(column),
    );

/**
 * One section of a client summary.
 *
 * **Example** (Strip a section title)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClientSection } from "./ClientProcessing.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ClientSection)({ title: "  Notes  ", overview: "", emoji: "" }))
 * console.log(decoded.title) // "Notes"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClientSection extends Model<ClientSection>("ClientSection")(
  {
    title: requiredStripped("title", 200, 1),
    overview: defaultedStripped("overview", 2000, 0, ""),
    emoji: defaultedStripped("emoji", 32, 0, ""),
  },
  $I.annote("ClientSection", { description: "Section of a client-owned summary." }),
  (columns) => [
    textBoundsCheck("title", { minLength: 1, maxLength: 200 })(columns.title),
    textBoundsCheck("overview", { maxLength: 2000 })(columns.overview),
    textBoundsCheck("emoji", { maxLength: 32 })(columns.emoji),
  ],
) {}

/**
 * Encoded shape of {@link ClientSection}.
 *
 * @see {@link ClientSection} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClientSection {
  export type Encoded = S.Codec.Encoded<typeof ClientSection>;
}

/**
 * Action item inside a client projection.
 *
 * **Example** (Construct an open item)
 *
 * ```ts
 * import { ClientActionItem } from "./ClientProcessing.ts"
 *
 * console.log(ClientActionItem.make({ description: "Ship" }).completed) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClientActionItem extends Model<ClientActionItem>("ClientActionItem")(
  {
    description: requiredStripped("description", 500, 1),
    completed: boolDefault("completed", false),
  },
  $I.annote("ClientActionItem", { description: "Action item in a client-owned projection." }),
  (columns) => [textBoundsCheck("description", { minLength: 1, maxLength: 500 })(columns.description)],
) {}

/**
 * Encoded shape of {@link ClientActionItem}.
 *
 * @see {@link ClientActionItem} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClientActionItem {
  export type Encoded = S.Codec.Encoded<typeof ClientActionItem>;
}

/**
 * Calendar-style event inside a client projection.
 *
 * **Details**
 *
 * `start` is timezone-aware. `duration` is 1 to 1440 minutes.
 *
 * **Example** (Decode a thirty-minute event)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClientEvent } from "./ClientProcessing.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ClientEvent)({ title: "Standup", description: "", start: "2020-01-02T03:04:05Z", duration: 30, created: false }),
 * )
 * console.log(decoded.duration) // 30
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClientEvent extends Model<ClientEvent>("ClientEvent")(
  {
    title: requiredStripped("title", 200, 1),
    description: defaultedStripped("description", 2000, 0, ""),
    start: requiredAware("start"),
    duration: intBetween("duration", 1, 1440),
    created: boolDefault("created", false),
  },
  $I.annote("ClientEvent", { description: "Event in a client-owned projection. start is timezone-aware." }),
  (columns) => [
    textBoundsCheck("title", { minLength: 1, maxLength: 200 })(columns.title),
    textBoundsCheck("description", { maxLength: 2000 })(columns.description),
    betweenCheck("duration", 1, 1440)(columns.duration),
  ],
) {}

/**
 * Encoded shape of {@link ClientEvent}.
 *
 * @see {@link ClientEvent} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClientEvent {
  export type Encoded = S.Codec.Encoded<typeof ClientEvent>;
}

/**
 * Memory text inside a client projection.
 *
 * **Example** (Default the category)
 *
 * ```ts
 * import { ClientMemory } from "./ClientProcessing.ts"
 *
 * console.log(ClientMemory.make({ content: "Lives in Seattle" }).category) // "other"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClientMemory extends Model<ClientMemory>("ClientMemory")(
  {
    content: requiredStripped("content", 2000, 1),
    category: categoryColumn("category"),
  },
  $I.annote("ClientMemory", { description: "Memory text in a client-owned projection." }),
  (columns) => [textBoundsCheck("content", { minLength: 1, maxLength: 2000 })(columns.content)],
) {}

/**
 * Encoded shape of {@link ClientMemory}.
 *
 * @see {@link ClientMemory} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClientMemory {
  export type Encoded = S.Codec.Encoded<typeof ClientMemory>;
}

/**
 * Structured summary inside a client projection.
 *
 * **Example** (Default the overview)
 *
 * ```ts
 * import { ClientSummary } from "./ClientProcessing.ts"
 *
 * console.log(ClientSummary.make({ title: "Day" }).overview) // ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClientSummary extends Model<ClientSummary>("ClientSummary")(
  {
    title: requiredStripped("title", 500, 1),
    overview: defaultedStripped("overview", 4000, 0, ""),
    emoji: defaultedStripped("emoji", 32, 0, ""),
    category: categoryColumn("category"),
  },
  $I.annote("ClientSummary", { description: "Structured summary produced by the client." }),
  (columns) => [
    textBoundsCheck("title", { minLength: 1, maxLength: 500 })(columns.title),
    textBoundsCheck("overview", { maxLength: 4000 })(columns.overview),
    textBoundsCheck("emoji", { maxLength: 32 })(columns.emoji),
  ],
) {}

/**
 * Encoded shape of {@link ClientSummary}.
 *
 * @see {@link ClientSummary} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClientSummary {
  export type Encoded = S.Codec.Encoded<typeof ClientSummary>;
}

/**
 * Why a projection has no usable content.
 *
 * **Example** (Flag an empty projection)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ClientProcessing, clientProcessingContentIssue } from "./ClientProcessing.ts"
 *
 * const issue = clientProcessingContentIssue(ClientProcessing.make({ durationSeconds: 1, projectionFamily: "phone" }))
 * console.log(O.isSome(issue)) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
/**
 * Client-owned summary persisted verbatim by the server.
 *
 * **Details**
 *
 * `schemaVersion` is exactly 1. `durationSeconds` is 1 to 1440. At least one
 * content field must be non-empty; {@link ClientProcessingChecked} enforces
 * that. Family fields are the device and transcript identity, not content.
 *
 * **Gotchas**
 *
 * Effect ignores unknown keys unless decode uses `{ onExcessProperty: "error" }`.
 * Python forbids them.
 *
 * **Example** (Decode a summary-text projection)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClientProcessing } from "./ClientProcessing.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ClientProcessing)({
 *     schemaVersion: 1,
 *     durationSeconds: 15,
 *     projectionFamily: "phone",
 *     summaryText: "  Talked about shipping  ",
 *     sections: [],
 *     actionItems: [],
 *     events: [],
 *     memories: [],
 *   }),
 * )
 * console.log(decoded.summaryText._tag === "Some" && decoded.summaryText.value) // "Talked about shipping"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClientProcessing extends Model<ClientProcessing>("ClientProcessing")(
  {
    schemaVersion: S.Literal(1).pipe(
      S.withConstructorDefault(Effect.succeed<1>(1)),
      pg.integer(),
      pg.columnName("schema_version"),
    ),
    durationSeconds: intBetween("duration_seconds", 1, 1440),
    projectionFamily: requiredStripped("projection_family", 100, 1),
    clientDeviceId: optionalNull(
      strippedText(128, 1).check(S.isPattern(/^[a-z0-9_]+$/)),
    ).pipe(pg.text(), pg.columnName("client_device_id")),
    clientDeviceLabel: optionalStripped("client_device_label", 200),
    clientCreatedAt: optionalAware("client_created_at"),
    clientTimezone: optionalNull(IanaTimezone).pipe(pg.text(), pg.columnName("client_timezone")),
    transcriptSha256: optionalNull(
      strippedText(64, 64).check(S.isPattern(/^[a-f0-9]{64}$/)),
    ).pipe(pg.text(), pg.columnName("transcript_sha256")),
    summaryText: optionalStripped("summary_text", 4000),
    summary: optionalNull(ClientSummary).pipe(pg.jsonb(), pg.columnName("summary")),
    sections: cappedList(ClientSection, "sections", 12),
    actionItems: cappedList(ClientActionItem, "action_items", 100),
    events: cappedList(ClientEvent, "events", 100),
    memories: cappedList(ClientMemory, "memories", 100),
  },
  $I.annote("ClientProcessing", {
    description: "Client-owned conversation summary. Version 1. Aware datetimes only. At least one content field.",
  }),
  (columns) => [
    atLeastCheck("schema_version", 1)(columns.schemaVersion),
    betweenCheck("duration_seconds", 1, 1440)(columns.durationSeconds),
    textBoundsCheck("projection_family", { minLength: 1, maxLength: 100 })(columns.projectionFamily),
    textBoundsCheck("client_device_id", { minLength: 1, maxLength: 128, pattern: "^[a-z0-9_]+$" })(columns.clientDeviceId),
    textBoundsCheck("client_device_label", { maxLength: 200 })(columns.clientDeviceLabel),
    textBoundsCheck("transcript_sha256", { minLength: 64, maxLength: 64, pattern: "^[a-f0-9]{64}$" })(
      columns.transcriptSha256,
    ),
    textBoundsCheck("summary_text", { maxLength: 4000 })(columns.summaryText),
    jsonbArrayLengthCheck("sections", { maximum: 12 })(columns.sections),
    jsonbArrayLengthCheck("action_items", { maximum: 100 })(columns.actionItems),
    jsonbArrayLengthCheck("events", { maximum: 100 })(columns.events),
    jsonbArrayLengthCheck("memories", { maximum: 100 })(columns.memories),
  ],
) {}

/**
 * Encoded shape of {@link ClientProcessing}.
 *
 * @see {@link ClientProcessing} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClientProcessing {
  export type Encoded = S.Codec.Encoded<typeof ClientProcessing>;
}

/**
 * Why a projection has no usable content.
 *
 * **Example** (Flag an empty projection)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ClientProcessing, clientProcessingContentIssue } from "./ClientProcessing.ts"
 *
 * const issue = clientProcessingContentIssue(ClientProcessing.make({ durationSeconds: 1, projectionFamily: "phone" }))
 * console.log(O.isSome(issue)) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const clientProcessingContentIssue = (value: ClientProcessing): O.Option<string> => {
  if (Str.trim(O.getOrElse(value.summaryText, () => "")).length > 0) return O.none();
  if (O.isSome(value.summary)) return O.none();
  if (value.sections.length + value.actionItems.length + value.events.length + value.memories.length > 0) {
    return O.none();
  }
  return O.some(
    "at least one of summary_text, summary, sections, action_items, events, memories must be non-empty",
  );
};

/**
 * {@link ClientProcessing} plus the non-empty content rule.
 *
 * **Example** (Reject an empty projection)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClientProcessingChecked } from "./ClientProcessing.ts"
 *
 * const exit = Effect.runSyncExit(
 *   S.decodeUnknownEffect(ClientProcessingChecked)({
 *     schemaVersion: 1,
 *     durationSeconds: 1,
 *     projectionFamily: "phone",
 *     sections: [],
 *     actionItems: [],
 *     events: [],
 *     memories: [],
 *   }),
 * )
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClientProcessingChecked = ClientProcessing.check(
  S.makeFilter((value: ClientProcessing) => {
    const issue = clientProcessingContentIssue(value);
    return O.isSome(issue) ? issue.value : undefined;
  }),
);

