/**
 * Transcript segments, sentence merges, and the legacy conversation id.
 *
 * **Details**
 *
 * `speakerIdentityStatus` is a plain string. The enum is the evidence vocabulary,
 * not the field's schema. The minted id is a normal field after preparation.
 * `_speaker_id_synthesized` stays off the encoded row and is returned only by
 * {@link prepareTranscriptSegment}.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Record from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { v4 as uuidV4, v5 as uuidV5 } from "uuid";
import { Model, bool, optionalText, pg, text } from "./Kit.ts";
import { boolDefault, optionDefault, textDefault } from "./Port.ts";
import { dual } from "effect/Function";

const $I = $ScratchpadId.create("beep/TranscriptSegment");

const NAMESPACE_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

/**
 * Sentence-ending punctuation shared by the merge helpers.
 *
 * **Details**
 *
 * English `.?!`, CJK `。！？`, Arabic and Urdu `؟۔`, and Hindi and Sanskrit `।॥`.
 *
 * **Example** (Read the ender set)
 *
 * ```ts
 * import { SENTENCE_ENDERS } from "./TranscriptSegment.ts"
 *
 * console.log(SENTENCE_ENDERS.includes("。")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SENTENCE_ENDERS = ".?!。！？؟۔।॥";

const sentenceClass = `[${SENTENCE_ENDERS}]`;

/**
 * Split pattern that keeps the ender on the preceding sentence.
 *
 * **Example** (Show the pattern source)
 *
 * ```ts
 * import { SENTENCE_SPLIT_RE } from "./TranscriptSegment.ts"
 *
 * console.log(SENTENCE_SPLIT_RE.source.length > 0) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SENTENCE_SPLIT_RE = new RegExp(`(?<=${sentenceClass})\\s*`);

/**
 * Finder kept from the Python module. The merge helpers do not call it.
 *
 * **Example** (Show the unused finder)
 *
 * ```ts
 * import { SENTENCE_FINDALL_RE } from "./TranscriptSegment.ts"
 *
 * console.log(SENTENCE_FINDALL_RE.test("Hello.")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SENTENCE_FINDALL_RE = new RegExp(`[^${SENTENCE_ENDERS}]+(?:${sentenceClass}\\s*|\\s*$)`);

/**
 * Stable id for a legacy stored transcript segment.
 *
 * **Details**
 *
 * `uuid5(NAMESPACE_URL, omi/conversations/{id}/transcript-segments/{index})`.
 * Reads and manual writes share this id.
 *
 * **Example** (Mint the first segment id)
 *
 * ```ts
 * import { legacyConversationSegmentId } from "./TranscriptSegment.ts"
 *
 * console.log(legacyConversationSegmentId("conv-1", 0))
 * // "da57cb65-5efc-5c8a-9e87-2959d45b8279"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const legacyConversationSegmentId: {
  (conversationId: string, index: number): string,
  (index: number): (conversationId: string)=> string
} = dual(2, (conversationId: string, index: number): string =>
  uuidV5(`omi/conversations/${conversationId}/transcript-segments/${index}`, NAMESPACE_URL));

/**
 * Evidence state behind the legacy `isUser` boolean.
 *
 * **Gotchas**
 *
 * {@link TranscriptSegment.speakerIdentityStatus} is a string, not this schema.
 * SkipJsonSchema hid it from generated clients; the value is still stored.
 *
 * **Example** (Decode a user status)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SpeakerIdentityStatus } from "./TranscriptSegment.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(SpeakerIdentityStatus)("not_user"))
 * console.log(decoded) // "not_user"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SpeakerIdentityStatus = LiteralKit(["unknown", "user", "not_user", "no_match"]).pipe(
  $I.annoteSchema("SpeakerIdentityStatus", {
    description: "Evidence behind is_user: unknown, user, not_user, or no_match.",
  }),
);

/**
 * Decoded speaker identity status.
 *
 * @see {@link SpeakerIdentityStatus} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export type SpeakerIdentityStatus = typeof SpeakerIdentityStatus.Type;

/**
 * Encoded speaker identity status.
 *
 * @see {@link SpeakerIdentityStatus} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SpeakerIdentityStatus {
  export type Encoded = S.Codec.Encoded<typeof SpeakerIdentityStatus>;
}

/**
 * One translation of a transcript segment.
 *
 * **Example** (Decode a translation)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { Translation } from "./TranscriptSegment.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(Translation)({ lang: "es", text: "Hola" }))
 * console.log(decoded.lang) // "es"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Translation extends Model<Translation>("Translation")(
  {
    lang: text("lang"),
    text: text("text"),
  },
  $I.annote("Translation", { description: "Language code and translated segment text." }),
) {}

/**
 * Encoded translation.
 *
 * @see {@link Translation} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Translation {
  export type Encoded = S.Codec.Encoded<typeof Translation>;
}

const finiteColumn = (column: string) => S.Finite.pipe(pg.doublePrecision(), pg.columnName(column));

/**
 * One diarized transcript segment.
 *
 * **Details**
 *
 * Plain `datetime` is not used here; `start` and `end` are seconds. `speaker`
 * defaults to `SPEAKER_00` when the key is missing and stays empty when the
 * value is null. `translations` does the same with `[]`. Preparation mints a
 * missing id, parses `SPEAKER_N` into `speakerId`, and promotes `isUser` to
 * status `user` only when status was omitted.
 *
 * **Gotchas**
 *
 * A stored `speakerId` of 0 looks real after a round trip. The synthesized
 * flag is not on this row. `speakerIdentityStatus` accepts any string.
 *
 * **Example** (Decode a stored segment)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { toWire } from "./Port.ts"
 * import { TranscriptSegment } from "./TranscriptSegment.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(toWire(TranscriptSegment))({
 *     id: "seg-1",
 *     text: "Hello.",
 *     is_user: true,
 *     start: 0,
 *     end: 1,
 *     speaker_id: 0,
 *     speaker_identity_status: "user",
 *   }),
 * )
 * console.log(decoded.id) // "seg-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranscriptSegment extends Model<TranscriptSegment>("TranscriptSegment")(
  {
    id: text("id"),
    text: text("text"),
    speaker: optionDefault(S.String, () => "SPEAKER_00").pipe(pg.text(), pg.columnName("speaker")),
    speakerId: S.Int.pipe(pg.integer(), pg.columnName("speaker_id")),
    isUser: bool("is_user"),
    personId: optionalText("person_id"),
    start: finiteColumn("start"),
    end: finiteColumn("end"),
    translations: optionDefault(S.Array(Translation), () => []).pipe(pg.jsonb(), pg.columnName("translations")),
    speechProfileProcessed: boolDefault("speech_profile_processed", true),
    sttProvider: optionalText("stt_provider"),
    speakerMatchSource: optionalText("speaker_match_source"),
    speakerIdScope: optionalText("speaker_id_scope"),
    speakerIdentityStatus: textDefault("speaker_identity_status", "unknown"),
  },
  $I.annote("TranscriptSegment", {
    description: "Diarized transcript segment. speaker_id is filled by preparation when omitted.",
  }),
) {}

/**
 * Encoded transcript segment.
 *
 * @see {@link TranscriptSegment} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TranscriptSegment {
  export type Encoded = S.Codec.Encoded<typeof TranscriptSegment>;
}

/**
 * Construction payload before Python `__init__` fills id and speaker id.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface TranscriptSegmentIngress {
  readonly id?: string | null | undefined;
  readonly text: string;
  readonly speaker?: string | null | undefined;
  readonly speakerId?: number | null | undefined;
  readonly isUser: boolean;
  readonly personId?: string | null | undefined;
  readonly start: number;
  readonly end: number;
  readonly translations?: ReadonlyArray<Translation> | null | undefined;
  readonly speechProfileProcessed?: boolean | undefined;
  readonly sttProvider?: string | null | undefined;
  readonly speakerMatchSource?: string | null | undefined;
  readonly speakerIdScope?: string | null | undefined;
  readonly speakerIdentityStatus?: string | null | undefined;
}

/**
 * Segment plus the in-memory synthesized flag.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface PreparedTranscriptSegment {
  readonly segment: TranscriptSegment;
  readonly speakerIdSynthesized: boolean;
}

const absent = (value: string | number | null | undefined): boolean => value === null || value === undefined;

const speakerNumber = (speaker: string): number => {
  const pivot = speaker.indexOf("_");
  if (pivot < 0) return 0;
  const suffix = speaker.slice(pivot + 1);
  if (!/^[0-9]+$/.test(suffix)) return 0;
  return Number(suffix);
};

const optionText = (value: string | null | undefined): O.Option<string> =>
  value === null || value === undefined ? O.none() : O.some(value);

/**
 * Apply `TranscriptSegment.__init__`.
 *
 * **Details**
 *
 * Missing `speaker` becomes `SPEAKER_00`. Null stays empty. A missing id, or
 * an empty one, is a new uuid4. `isUser` without a status stores `user`.
 * `speakerId` is parsed from `SPEAKER_N` only when it was not provided.
 *
 * **Gotchas**
 *
 * The synthesized flag is true when both speaker and speaker id were missing
 * or null. It is not stored on the segment.
 *
 * **Example** (Parse a speaker label)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { prepareTranscriptSegment } from "./TranscriptSegment.ts"
 *
 * const prepared = Effect.runSync(
 *   prepareTranscriptSegment({ text: "Hello", speaker: "SPEAKER_03", isUser: false, start: 0, end: 1 }),
 * )
 * console.log(prepared.segment.speakerId) // 3
 * console.log(prepared.speakerIdSynthesized) // false
 * console.log(O.isSome(prepared.segment.speaker)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const prepareTranscriptSegment = Effect.fn("TranscriptSegment.prepare")(function* (
  input: TranscriptSegmentIngress,
) {
  const id =
    input.id !== undefined && input.id !== null && !Str.isEmpty(input.id) ? input.id : yield* Effect.sync(() => uuidV4());
  const speaker = input.speaker === undefined ? O.some("SPEAKER_00") : optionText(input.speaker);
  const speakerId =
    input.speakerId !== undefined && input.speakerId !== null
      ? input.speakerId
      : O.match(speaker, {
          onNone: () => 0,
          onSome: (label) => (Str.isEmpty(label) ? 0 : speakerNumber(label)),
        });
  const speakerIdentityStatus =
    input.speakerIdentityStatus !== undefined && input.speakerIdentityStatus !== null
      ? input.speakerIdentityStatus
      : input.isUser
        ? "user"
        : "unknown";
  const translations =
    input.translations === undefined ? O.some<ReadonlyArray<Translation>>([]) : optionTextList(input.translations);
  const segment = TranscriptSegment.make({
    id,
    text: input.text,
    speaker,
    speakerId,
    isUser: input.isUser,
    personId: optionText(input.personId),
    start: input.start,
    end: input.end,
    translations,
    speechProfileProcessed: input.speechProfileProcessed ?? true,
    sttProvider: optionText(input.sttProvider),
    speakerMatchSource: optionText(input.speakerMatchSource),
    speakerIdScope: optionText(input.speakerIdScope),
    speakerIdentityStatus,
  });
  return {
    segment,
    speakerIdSynthesized: absent(input.speaker) && absent(input.speakerId),
  } satisfies PreparedTranscriptSegment;
});

const optionTextList = (
  value: ReadonlyArray<Translation> | null | undefined,
): O.Option<ReadonlyArray<Translation>> => (value === null || value === undefined ? O.none() : O.some(value));

/**
 * `H:MM:SS - H:MM:SS` from truncated start and end seconds.
 *
 * **Details**
 *
 * Matches Python `str(timedelta(seconds=int(start)))`. Negative totals use
 * Python's negative-day normalization.
 *
 * **Example** (Format an hour and a minute)
 *
 * ```ts
 * import { TranscriptSegment, getTimestampString } from "./TranscriptSegment.ts"
 *
 * const segment = TranscriptSegment.make({
 *   id: "seg",
 *   text: "Hi",
 *   isUser: true,
 *   speakerId: 0,
 *   start: 3661,
 *   end: 59,
 * })
 * console.log(getTimestampString(segment)) // "1:01:01 - 0:00:59"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getTimestampString = (segment: TranscriptSegment): string =>
  `${formatTimedelta(segment.start)} - ${formatTimedelta(segment.end)}`;

const pad2 = (value: number): string => {
  const textValue = `${value}`;
  return textValue.length === 1 ? `0${textValue}` : textValue;
};

const formatTimedelta = (totalSeconds: number): string => {
  const seconds = Math.trunc(totalSeconds);
  const days = Math.floor(seconds / 86400);
  const rest = seconds - days * 86400;
  const hours = Math.floor(rest / 3600);
  const minutes = Math.floor((rest % 3600) / 60);
  const secs = rest % 60;
  const clock = `${hours}:${pad2(minutes)}:${pad2(secs)}`;
  if (days === 0) return clock;
  const label = Math.abs(days) === 1 ? "day" : "days";
  return `${days} ${label}, ${clock}`;
};

/**
 * Person id and name used when rendering a segment.
 *
 * @see {@link segmentsAsString} for the formatter that reads these fields.
 * @category type-level
 * @since 0.0.0
 */
export interface TranscriptPerson {
  readonly id: string;
  readonly name: string;
}

/**
 * True when no earlier segment extends past a later segment's start or end.
 *
 * **Example** (Reject an overlap)
 *
 * ```ts
 * import { TranscriptSegment, canDisplaySeconds } from "./TranscriptSegment.ts"
 *
 * const base = { id: "a", text: "A", isUser: false, speakerId: 0 }
 * const ordered = canDisplaySeconds([
 *   TranscriptSegment.make({ ...base, id: "a", start: 0, end: 1 }),
 *   TranscriptSegment.make({ ...base, id: "b", start: 2, end: 3 }),
 * ])
 * const overlap = canDisplaySeconds([
 *   TranscriptSegment.make({ ...base, id: "a", start: 0, end: 5 }),
 *   TranscriptSegment.make({ ...base, id: "b", start: 1, end: 2 }),
 * ])
 * console.log(ordered) // true
 * console.log(overlap) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const canDisplaySeconds = (segments: ReadonlyArray<TranscriptSegment>): boolean => {
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const left = segments[i];
      const right = segments[j];
      if (left === undefined || right === undefined) continue;
      if (left.start > right.end || left.end > right.start) return false;
    }
  }
  return true;
};

/**
 * Render segments as `Speaker: text` blocks.
 *
 * **Details**
 *
 * A missing user name is `User`. A non-user with a known person id uses that
 * name, otherwise `Speaker {id}`. Timestamps are included only when requested
 * and {@link canDisplaySeconds} is true.
 *
 * **Example** (Name a known person)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { TranscriptSegment, segmentsAsString } from "./TranscriptSegment.ts"
 *
 * const text = segmentsAsString(
 *   [TranscriptSegment.make({ id: "s", text: " Hi ", isUser: false, speakerId: 2, personId: O.some("p1"), start: 0, end: 1 })],
 *   false,
 *   undefined,
 *   [{ id: "p1", name: "Ada" }],
 * )
 * console.log(text) // "Ada: Hi"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const segmentsAsString: {
  (
  segments: ReadonlyArray<TranscriptSegment>,
  includeTimestamps?: boolean,
  userName?: string,
  people?: ReadonlyArray<TranscriptPerson>,
): string,
  (
  includeTimestamps?: boolean,
  userName?: string,
  people?: ReadonlyArray<TranscriptPerson>,
): (segments: ReadonlyArray<TranscriptSegment>) => string
} = dual((args) => A.isArray(args[0]), (
  segments: ReadonlyArray<TranscriptSegment>,
  includeTimestamps: boolean = false,
  userName?: string,
  people?: ReadonlyArray<TranscriptPerson>,
): string => {
  const name = userName === undefined || Str.isEmpty(userName) ? "User" : userName;
  const peopleMap = HashMap.fromIterable(people === undefined ? [] : people.map((person) => [person.id, person.name]));
  const showTime = includeTimestamps && canDisplaySeconds(segments);
  const lines = segments.map((segment) => {
    const body = Str.trim(segment.text);
    const timestamp = showTime ? `[${getTimestampString(segment)}] ` : "";
    const speaker = segment.isUser
      ? name
      : O.getOrElse(
          O.flatMap(segment.personId, (id) => HashMap.get(peopleMap, id)),
          () => `Speaker ${segment.speakerId}`,
        );
    return `${timestamp}${speaker}: ${body}`;
  });
  return Str.trim(lines.join("\n\n"));
});

/**
 * Merge result. Iteration yields three fields and drops the absorbed map.
 *
 * **Details**
 *
 * Callers that unpack the Python dataclass receive segments, joined segments,
 * and removed ids. `absorbedInto` must be passed on its own.
 *
 * **Example** (Drop the absorbed map)
 *
 * ```ts
 * import { CombineSegmentsResult, TranscriptSegment, iterateCombineSegmentsResult } from "./TranscriptSegment.ts"
 *
 * const segment = TranscriptSegment.make({ id: "s", text: "Hi", isUser: true, speakerId: 0, start: 0, end: 1 })
 * const result = CombineSegmentsResult.make({
 *   segments: [segment],
 *   joined: [],
 *   removedIds: [],
 *   absorbedInto: {},
 * })
 * console.log(iterateCombineSegmentsResult(result).length) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CombineSegmentsResult extends Model<CombineSegmentsResult>("CombineSegmentsResult")(
  {
    segments: S.Array(TranscriptSegment).pipe(pg.jsonb(), pg.columnName("segments")),
    joined: S.Array(TranscriptSegment).pipe(pg.jsonb(), pg.columnName("joined")),
    removedIds: S.Array(S.String).pipe(pg.jsonb(), pg.columnName("removed_ids")),
    absorbedInto: S.Record(S.String, S.String).pipe(pg.jsonb(), pg.columnName("absorbed_into")),
  },
  $I.annote("CombineSegmentsResult", {
    description: "Merge result. Iteration yields segments, joined, and removed ids only.",
  }),
) {}

/**
 * Encoded combine result.
 *
 * @see {@link CombineSegmentsResult} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CombineSegmentsResult {
  export type Encoded = S.Codec.Encoded<typeof CombineSegmentsResult>;
}

/**
 * Yield segments, joined segments, and removed ids. `absorbedInto` is omitted.
 *
 * **Example** (Read the removed ids)
 *
 * ```ts
 * import { CombineSegmentsResult, iterateCombineSegmentsResult } from "./TranscriptSegment.ts"
 *
 * const result = CombineSegmentsResult.make({
 *   segments: [],
 *   joined: [],
 *   removedIds: ["old"],
 *   absorbedInto: { old: "new" },
 * })
 * console.log(iterateCombineSegmentsResult(result)[2][0]) // "old"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const iterateCombineSegmentsResult = (
  result: CombineSegmentsResult,
): readonly [ReadonlyArray<TranscriptSegment>, ReadonlyArray<TranscriptSegment>, ReadonlyArray<string>] =>
  Tuple.make(result.segments, result.joined, result.removedIds);

interface Draft {
  id: string;
  text: string;
  speaker: O.Option<string>;
  speakerId: number;
  isUser: boolean;
  personId: O.Option<string>;
  start: number;
  end: number;
  translations: O.Option<ReadonlyArray<Translation>>;
  speechProfileProcessed: boolean;
  sttProvider: O.Option<string>;
  speakerMatchSource: O.Option<string>;
  speakerIdScope: O.Option<string>;
  speakerIdentityStatus: string;
}

const toDraft = (segment: TranscriptSegment): Draft => ({
  id: segment.id,
  text: segment.text,
  speaker: segment.speaker,
  speakerId: segment.speakerId,
  isUser: segment.isUser,
  personId: segment.personId,
  start: segment.start,
  end: segment.end,
  translations: segment.translations,
  speechProfileProcessed: segment.speechProfileProcessed,
  sttProvider: segment.sttProvider,
  speakerMatchSource: segment.speakerMatchSource,
  speakerIdScope: segment.speakerIdScope,
  speakerIdentityStatus: segment.speakerIdentityStatus,
});

const toSegment = (draft: Draft): TranscriptSegment => TranscriptSegment.make(draft);

const splitSentences = (value: string): ReadonlyArray<string> => {
  const trimmed = Str.trim(value);
  if (Str.isEmpty(trimmed)) return [];
  return A.filter(Str.split(trimmed, SENTENCE_SPLIT_RE), (part) => !Str.isEmpty(part));
};

const endsSentence = (value: string): boolean => {
  const trimmed = Str.trim(value);
  if (Str.isEmpty(trimmed)) return false;
  return Str.includes(trimmed.charAt(trimmed.length - 1))(SENTENCE_ENDERS);
};

const startsWithLowercaseCased = (value: string): boolean => {
  const match = /\p{L}/u.exec(Str.trim(value));
  const char = match?.[0];
  if (char === undefined) return false;
  return char === Str.toLowerCase(char) && char !== char.toUpperCase();
};

const normalizeText = (value: string): string =>
  Str.replaceAll(" ?", "?")(
    Str.replaceAll(" .", ".")(Str.replaceAll(" ,", ",")(Str.replaceAll("  ", " ")(Str.trim(value)))),
  );

/**
 * Merge new segments onto an existing transcript.
 *
 * **Details**
 *
 * Same-speaker text merges when the gap is under 3 seconds and the left text
 * is short or does not end a sentence. A lowercase continuation merges across
 * a longer gap. Different speakers can move an incomplete tail backward.
 * Protected ids, `sttProvider`, `speakerMatchSource`, and `speakerIdScope`
 * refuse the merge. `deltaSeconds` shifts only the new segments.
 *
 * **Example** (Join two short turns)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { TranscriptSegment, combineSegments } from "./TranscriptSegment.ts"
 *
 * const left = TranscriptSegment.make({ id: "a", text: "Hello", isUser: true, speakerId: 0, start: 0, end: 1 })
 * const right = TranscriptSegment.make({ id: "b", text: "there", isUser: true, speakerId: 0, start: 1.2, end: 2 })
 * const result = combineSegments([left], [right])
 * console.log(result.segments.length) // 1
 * console.log(O.getOrElse(result.segments[0]?.text ? O.some(result.segments[0].text) : O.none(), () => "")) // "Hello there"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const combineSegments: {
  (
  segments: ReadonlyArray<TranscriptSegment>,
  newSegments: ReadonlyArray<TranscriptSegment>,
  deltaSeconds?: number,
  protectedSegmentIds?: HashSet.HashSet<string>,
): CombineSegmentsResult,
  (
  newSegments: ReadonlyArray<TranscriptSegment>,
  deltaSeconds?: number,
  protectedSegmentIds?: HashSet.HashSet<string>,
): (segments: ReadonlyArray<TranscriptSegment>) => CombineSegmentsResult
} = dual((args) => A.isArray(args[1]), (
  segments: ReadonlyArray<TranscriptSegment>,
  newSegments: ReadonlyArray<TranscriptSegment>,
  deltaSeconds: number = 0,
  protectedSegmentIds?: HashSet.HashSet<string>,
): CombineSegmentsResult => {
  if (newSegments.length === 0) {
    return CombineSegmentsResult.make({
      segments,
      joined: [],
      removedIds: [],
      absorbedInto: {},
    });
  }

  let absorbed = HashMap.empty<string, string>();
  const removedIds: Array<string> = [];
  const absorb = (child: Draft | undefined, parent: Draft | undefined): void => {
    if (child === undefined || Str.isEmpty(child.id)) return;
    if (O.isNone(HashMap.get(absorbed, child.id))) removedIds.push(child.id);
    if (parent !== undefined && !Str.isEmpty(parent.id)) absorbed = HashMap.set(absorbed, child.id, parent.id);
  };
  const blocked = (left: Draft, right: Draft): boolean =>
    (protectedSegmentIds !== undefined &&
      (HashSet.has(protectedSegmentIds, left.id) || HashSet.has(protectedSegmentIds, right.id))) ||
    !Equal.equals(left.sttProvider, right.sttProvider) ||
    !Equal.equals(left.speakerMatchSource, right.speakerMatchSource) ||
    !Equal.equals(left.speakerIdScope, right.speakerIdScope);

  const merge = (left: Draft | undefined, right: Draft | undefined): readonly [Draft | undefined, Draft | undefined] => {
    if (left === undefined || right === undefined) return [left, right];
    if (blocked(left, right)) return [left, right];
    const sameSpeaker = Equal.equals(left.speaker, right.speaker) || (left.isUser && right.isUser);
    if (!sameSpeaker && !Str.isEmpty(left.text) && !Str.isEmpty(right.text)) {
      const parts = splitSentences(left.text);
      const last = parts[parts.length - 1];
      const incomplete = last !== undefined && !isSentenceComplete(last) ? last : undefined;
      if (incomplete !== undefined) {
        const rightParts = splitSentences(right.text);
        const first = rightParts[0] ?? "";
        const rest = Str.trim(rightParts.slice(1).join(" "));
        if (!Str.isEmpty(rest) && !Str.isEmpty(first) && first.length < incomplete.length) {
          left.text = Str.trim(`${left.text} ${first}`);
          right.text = rest;
          return [left, right];
        }
        if (
          !Str.isEmpty(first) &&
          !isSentenceComplete(first) &&
          !startsWithLowercaseCased(first) &&
          first.length < incomplete.length
        ) {
          left.text = Str.trim(`${left.text} ${first}`);
          absorb(right, left);
          return [left, undefined];
        }
        if (incomplete.length < Str.trim(right.text).length) {
          right.text = Str.trim(`${incomplete} ${right.text}`);
          const prefix = Str.trim(parts.slice(0, -1).join(" "));
          if (!Str.isEmpty(prefix)) {
            left.text = prefix;
            left.end = Math.min(left.end, right.start);
            return [left, right];
          }
          left.text = "";
          absorb(left, right);
          return [undefined, right];
        }
      }
    }
    if (shouldMergeSameSpeaker(left, right)) {
      left.text = `${left.text} ${right.text}`;
      left.end = right.end;
      absorb(right, left);
      return [left, undefined];
    }
    if (shouldMergeLowercase(left, right)) {
      left.text = `${left.text} ${right.text}`;
      left.end = right.end;
      absorb(right, left);
      return [left, undefined];
    }
    return [left, right];
  };

  const originals = segments.map(toDraft);
  const incoming = newSegments.map(toDraft);
  const tail = segments[segments.length - 1];
  const joined: Array<Draft> = tail === undefined ? [] : [toDraft(tail)];
  let droppedExistingTail = false;
  for (const next of incoming) {
    if (deltaSeconds > 0) {
      next.start += deltaSeconds;
      next.end += deltaSeconds;
    }
    const [left, right] = merge(joined[joined.length - 1], next);
    if (left !== undefined) {
      joined[joined.length - 1] = left;
    } else if (joined.length > 0 && Str.isEmpty(joined[joined.length - 1]?.text ?? "x")) {
      const tail = joined[joined.length - 1];
      const originalTail = originals[originals.length - 1];
      if (originalTail !== undefined && tail !== undefined && tail.id === originalTail.id) droppedExistingTail = true;
      joined.pop();
    }
    if (right !== undefined) joined.push(right);
  }

  const kept = droppedExistingTail
    ? originals.slice(0, -1)
    : joined[0] !== undefined && originals[originals.length - 1]?.id === joined[0].id
      ? originals.slice(0, -1)
      : originals;
  const combined = [...kept, ...joined].map((draft) => {
    draft.text = normalizeText(draft.text);
    return toSegment(draft);
  });
  return CombineSegmentsResult.make({
    segments: combined,
    joined: joined.map(toSegment),
    removedIds,
    absorbedInto: absorbed.pipe(HashMap.toEntries, Record.fromEntries),
  });
});

const isSentenceComplete = (value: string): boolean => {
  const trimmed = Str.trim(value);
  return !Str.isEmpty(trimmed) && endsSentence(trimmed) && !startsWithLowercaseCased(trimmed);
};

const shouldMergeSameSpeaker = (left: Draft, right: Draft): boolean =>
  (Equal.equals(left.speaker, right.speaker) || (left.isUser && right.isUser)) &&
  left.speechProfileProcessed === right.speechProfileProcessed &&
  right.start - left.end < 3 &&
  (left.text.length < 125 || !endsSentence(left.text));

const shouldMergeLowercase = (left: Draft, right: Draft): boolean =>
  !Str.isEmpty(left.text) &&
  !Str.isEmpty(right.text) &&
  (Equal.equals(left.speaker, right.speaker) || (left.isUser && right.isUser)) &&
  !endsSentence(left.text) &&
  startsWithLowercaseCased(right.text) &&
  left.speechProfileProcessed === right.speechProfileProcessed;

/**
 * Corrected speaker assignment for one segment.
 *
 * **Example** (Decode a correction)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { toWire } from "./Port.ts"
 * import { ImprovedTranscriptSegment } from "./TranscriptSegment.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(toWire(ImprovedTranscriptSegment))({ speaker_id: 2, text: "Hello" }),
 * )
 * console.log(decoded.speakerId) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImprovedTranscriptSegment extends Model<ImprovedTranscriptSegment>("ImprovedTranscriptSegment")(
  {
    speakerId: S.Int.pipe(pg.integer(), pg.columnName("speaker_id")),
    text: text("text"),
  },
  $I.annote("ImprovedTranscriptSegment", {
    description: "Corrected speaker id and text for one transcript segment.",
  }),
) {}

/**
 * Encoded improved segment.
 *
 * @see {@link ImprovedTranscriptSegment} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImprovedTranscriptSegment {
  export type Encoded = S.Codec.Encoded<typeof ImprovedTranscriptSegment>;
}

/**
 * List of corrected transcript segments.
 *
 * **Example** (Decode an empty correction list)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ImprovedTranscript } from "./TranscriptSegment.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ImprovedTranscript)({ result: [] }))
 * console.log(decoded.result.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImprovedTranscript extends Model<ImprovedTranscript>("ImprovedTranscript")(
  {
    result: S.Array(ImprovedTranscriptSegment).pipe(pg.jsonb(), pg.columnName("result")),
  },
  $I.annote("ImprovedTranscript", { description: "Corrected transcript segments." }),
) {}

/**
 * Encoded improved transcript.
 *
 * @see {@link ImprovedTranscript} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImprovedTranscript {
  export type Encoded = S.Codec.Encoded<typeof ImprovedTranscript>;
}
