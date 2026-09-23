/**
 * FCM, people, and voice-readiness requests that do not belong to a larger domain.
 *
 * Person photos are intentionally absent. Speech samples are audio, and the
 * app uses local speaker icons.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";
import { Model, optionalNull, optionalTimestamp, pg, textBoundsCheck, userId } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/Other");

const emptyStrings: ReadonlyArray<string> = [];

/**
 * Stored recognition evidence for a person.
 *
 * **Details**
 *
 * `unknown` means the stored shape cannot be read. `not_learned` means there
 * are no samples. `saved_sample_awaiting_embedding` means samples exist at
 * version 3 or newer and no embedding is stored. `ready` means a finite,
 * non-zero embedding is stored. This never infers a queued enrollment job.
 *
 * **Example** (Read the ready member)
 *
 * ```ts
 * import { VoiceReadiness } from "./Other.ts"
 *
 * console.log(VoiceReadiness.literals[0]) // "ready"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VoiceReadiness = LiteralKit([
  "ready",
  "saved_sample_awaiting_embedding",
  "not_learned",
  "unknown",
]).pipe(
  $I.annoteSchema("VoiceReadiness", {
    description: "Stored speaker-recognition evidence. It does not imply a queued enrollment job.",
  }),
);

/**
 * Decoded voice-readiness literal.
 *
 * @see {@link VoiceReadiness} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type VoiceReadiness = typeof VoiceReadiness.Type;

/**
 * Encoded form of {@link VoiceReadiness}.
 *
 * @see {@link VoiceReadiness} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VoiceReadiness {
  export type Encoded = S.Codec.Encoded<typeof VoiceReadiness>;
}

/**
 * IANA timezone that failed validation.
 *
 * **Example** (Name an empty zone)
 *
 * ```ts
 * import { TimeZoneRejected } from "./Other.ts"
 *
 * const error = TimeZoneRejected.make({ reason: "time_zone must be a non-empty IANA timezone" })
 * console.log(error._tag) // "TimeZoneRejected"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TimeZoneRejected extends S.TaggedError<TimeZoneRejected>()(
  "TimeZoneRejected",
  {
    reason: S.String,
  },
  $I.annoteError<TimeZoneRejected>("TimeZoneRejected", {
    description: "A caller-supplied time zone was empty or not an IANA name.",
  }),
) {}

/**
 * Encoded form of {@link TimeZoneRejected}.
 *
 * @see {@link TimeZoneRejected} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TimeZoneRejected {
  export type Encoded = S.Codec.Encoded<typeof TimeZoneRejected>;
}

const isIana = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/**
 * Strip a time zone and require a real IANA name.
 *
 * **Details**
 *
 * `SaveFcmTokenRequest.timeZone` is not validated. Only this helper and
 * {@link SyncUserTimeZoneRequest} reject empty or unknown names.
 *
 * **Example** (Reject a blank zone)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as Exit from "effect/Exit"
 * import { validateTimeZone } from "./Other.ts"
 *
 * console.log(Exit.isFailure(Effect.runSyncExit(validateTimeZone("  ")))) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateTimeZone = Effect.fn("SyncUserTimeZoneRequest.validateTimeZone")(function* (value: string) {
  const stripped = Str.trim(value);
  if (Str.isEmpty(stripped)) {
    return yield* TimeZoneRejected.make({ reason: "time_zone must be a non-empty IANA timezone" });
  }
  if (!isIana(stripped)) {
    return yield* TimeZoneRejected.make({ reason: "time_zone must be a valid IANA timezone" });
  }
  return stripped;
});

const IanaTimeZone = S.String.pipe(
  S.decodeTo(S.String, {
    decode: SchemaGetter.transform(Str.trim),
    encode: SchemaGetter.transform((value: string) => value),
  }),
  S.check(
    S.makeFilter((value: string) => {
      if (Str.isEmpty(value)) return "time_zone must be a non-empty IANA timezone";
      return isIana(value) ? undefined : "time_zone must be a valid IANA timezone";
    }),
  ),
);

/**
 * FCM token registration. The time zone is stored unchecked.
 *
 * **Gotchas**
 *
 * Unlike {@link SyncUserTimeZoneRequest}, this time zone is not required to be
 * an IANA name.
 *
 * **Example** (Accept any time zone string)
 *
 * ```ts
 * import { SaveFcmTokenRequest } from "./Other.ts"
 *
 * const request = SaveFcmTokenRequest.make({ fcmToken: "token-1", timeZone: "not-a-zone" })
 * console.log(request.fcmToken) // "token-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SaveFcmTokenRequest extends Model<SaveFcmTokenRequest>("SaveFcmTokenRequest")(
  {
    fcmToken: S.String.annotateKey({ description: "Device FCM registration token." }).pipe(
      pg.text(),
      pg.columnName("fcm_token"),
    ),
    timeZone: S.String.annotateKey({ description: "Caller time zone. Not validated on this request." }).pipe(
      pg.text(),
      pg.columnName("time_zone"),
    ),
  },
  $I.annote("SaveFcmTokenRequest", {
    description: "FCM token registration with an unchecked time zone.",
  }),
) {}

/**
 * Encoded form of {@link SaveFcmTokenRequest}.
 *
 * @see {@link SaveFcmTokenRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SaveFcmTokenRequest {
  export type Encoded = S.Codec.Encoded<typeof SaveFcmTokenRequest>;
}

/**
 * Request to store the user's IANA time zone.
 *
 * **Example** (Decode a padded zone)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SyncUserTimeZoneRequest } from "./Other.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(SyncUserTimeZoneRequest)({ timeZone: " UTC " }))
 * console.log(decoded.timeZone) // "UTC"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SyncUserTimeZoneRequest extends Model<SyncUserTimeZoneRequest>("SyncUserTimeZoneRequest")(
  {
    timeZone: IanaTimeZone.annotateKey({ description: "Non-empty IANA time zone, stripped." }).pipe(
      pg.text(),
      pg.columnName("time_zone"),
    ),
  },
  $I.annote("SyncUserTimeZoneRequest", {
    description: "Request to store a validated IANA time zone.",
  }),
) {}

/**
 * Encoded form of {@link SyncUserTimeZoneRequest}.
 *
 * @see {@link SyncUserTimeZoneRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SyncUserTimeZoneRequest {
  export type Encoded = S.Codec.Encoded<typeof SyncUserTimeZoneRequest>;
}

/**
 * Status returned after an FCM token write.
 *
 * **Example** (Read a status)
 *
 * ```ts
 * import { FcmTokenResponse } from "./Other.ts"
 *
 * console.log(FcmTokenResponse.make({ status: "ok" }).status) // "ok"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FcmTokenResponse extends Model<FcmTokenResponse>("FcmTokenResponse")(
  {
    status: S.String.annotateKey({ description: "Token write status." }).pipe(pg.text(), pg.columnName("status")),
  },
  $I.annote("FcmTokenResponse", { description: "Status returned after an FCM token write." }),
) {}

/**
 * Encoded form of {@link FcmTokenResponse}.
 *
 * @see {@link FcmTokenResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FcmTokenResponse {
  export type Encoded = S.Codec.Encoded<typeof FcmTokenResponse>;
}

/**
 * Operator request to send one notification.
 *
 * **Example** (Omit the data object)
 *
 * ```ts
 * import { SendNotificationRequest } from "./Other.ts"
 *
 * const request = SendNotificationRequest.make({ uid: "user-1", title: "Hello", body: "There" })
 * console.log(Object.keys(request.data).length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SendNotificationRequest extends Model<SendNotificationRequest>("SendNotificationRequest")(
  {
    uid: userId("uid"),
    title: S.String.annotateKey({ description: "Notification title." }).pipe(pg.text(), pg.columnName("title")),
    body: S.String.annotateKey({ description: "Notification body." }).pipe(pg.text(), pg.columnName("body")),
    data: S.JsonObject.annotateKey({ description: "Extra string payload. Construction defaults to an empty object." })
      .pipe(S.withConstructorDefault(Effect.succeed({})), pg.jsonb(), pg.columnName("data")),
  },
  $I.annote("SendNotificationRequest", { description: "Operator request to send one notification." }),
) {}

/**
 * Encoded form of {@link SendNotificationRequest}.
 *
 * @see {@link SendNotificationRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SendNotificationRequest {
  export type Encoded = S.Codec.Encoded<typeof SendNotificationRequest>;
}

/**
 * App-scoped notification request.
 *
 * **Example** (Name the app)
 *
 * ```ts
 * import { SendAppNotificationRequest } from "./Other.ts"
 *
 * const request = SendAppNotificationRequest.make({ aid: "app-1", message: "Hello", uid: "user-1" })
 * console.log(request.aid) // "app-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SendAppNotificationRequest extends Model<SendAppNotificationRequest>("SendAppNotificationRequest")(
  {
    aid: S.String.annotateKey({ description: "App id." }).pipe(pg.text(), pg.columnName("aid")),
    message: S.String.annotateKey({ description: "Notification message." }).pipe(pg.text(), pg.columnName("message")),
    uid: userId("uid"),
  },
  $I.annote("SendAppNotificationRequest", { description: "App-scoped notification request." }),
) {}

/**
 * Encoded form of {@link SendAppNotificationRequest}.
 *
 * @see {@link SendAppNotificationRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SendAppNotificationRequest {
  export type Encoded = S.Codec.Encoded<typeof SendAppNotificationRequest>;
}

/**
 * Uploaded voice profile samples.
 *
 * **Example** (Store one frame)
 *
 * ```ts
 * import { UploadProfile } from "./Other.ts"
 *
 * const profile = UploadProfile.make({ bytes: [[1, 2]], duration: 3 })
 * console.log(profile.duration) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UploadProfile extends Model<UploadProfile>("UploadProfile")(
  {
    bytes: S.Int.pipe(S.Array, S.Array)
      .annotateKey({ description: "PCM frames as nested integer lists." })
      .pipe(pg.jsonb(), pg.columnName("bytes")),
    duration: S.Int.annotateKey({ description: "Profile duration." }).pipe(pg.integer(), pg.columnName("duration")),
  },
  $I.annote("UploadProfile", { description: "Uploaded voice profile samples." }),
) {}

/**
 * Encoded form of {@link UploadProfile}.
 *
 * @see {@link UploadProfile} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UploadProfile {
  export type Encoded = S.Codec.Encoded<typeof UploadProfile>;
}

/**
 * Request to create a person by name.
 *
 * **Example** (Accept a short name)
 *
 * ```ts
 * import { CreatePerson } from "./Other.ts"
 *
 * console.log(CreatePerson.make({ name: "Ada" }).name) // "Ada"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreatePerson extends Model<CreatePerson>("CreatePerson")(
  {
    name: S.String.check(S.isMinLength(2), S.isMaxLength(40))
      .annotateKey({ description: "Person name, 2 to 40 characters." })
      .pipe(pg.text(), pg.columnName("name")),
  },
  $I.annote("CreatePerson", { description: "Request to create a person by name." }),
  (columns) => [textBoundsCheck("name", { minLength: 2, maxLength: 40 })(columns.name)],
) {}

/**
 * Encoded form of {@link CreatePerson}.
 *
 * @see {@link CreatePerson} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CreatePerson {
  export type Encoded = S.Codec.Encoded<typeof CreatePerson>;
}

const finiteNumber = (value: unknown): value is number => P.isNumber(value) && !P.isBoolean(value) && Number.isFinite(value);

const readKey = (record: { readonly [key: string]: unknown }, snake: string, camel: string): unknown =>
  P.hasProperty(record, snake) ? record[snake] : P.hasProperty(record, camel) ? record[camel] : undefined;

/**
 * Report stored recognition evidence. Never infer a queued enrollment job.
 *
 * **Details**
 *
 * Missing or non-list samples are `unknown`. An empty list is `not_learned`.
 * A version that is not an integer greater than or equal to 3, including a
 * boolean, is `unknown`. A missing or empty embedding is
 * `saved_sample_awaiting_embedding`. A non-finite, empty, or all-zero vector
 * is `unknown`. Otherwise the person is `ready`. Snake_case and camelCase keys
 * are both accepted.
 *
 * **Example** (Report an empty sample list)
 *
 * ```ts
 * import { voiceReadiness } from "./Other.ts"
 *
 * console.log(voiceReadiness({ speechSamples: [] })) // "not_learned"
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const voiceReadiness = (data: unknown): VoiceReadiness => {
  if (!P.isObject(data)) return "unknown";
  const samples = readKey(data, "speech_samples", "speechSamples");
  const version = readKey(data, "speech_samples_version", "speechSamplesVersion");
  if (!A.isArray(samples)) return "unknown";
  if (A.isArrayEmpty(samples)) return "not_learned";
  if (P.isBoolean(version) || !P.isNumber(version) || !Number.isInteger(version) || version < 3) return "unknown";
  const vector = readKey(data, "speaker_embedding", "speakerEmbedding");
  if (P.isNullish(vector) || (A.isArray(vector) && A.isArrayEmpty(vector))) return "saved_sample_awaiting_embedding";
  if (
    !A.isArray(vector) ||
    A.isArrayEmpty(vector) ||
    !A.every(vector, finiteNumber) ||
    !A.some(vector, (value) => value !== 0)
  ) {
    return "unknown";
  }
  return "ready";
};

/**
 * A stored person and the speech samples used for recognition.
 *
 * **Gotchas**
 *
 * Do not add a photo, avatar, or image field. `voiceReadiness` is often
 * overwritten by {@link decodePerson} from the stored samples and embedding.
 * Timestamps on this row accept naive ISO strings as UTC; this module does not
 * require an offset.
 *
 * **Example** (Construct an unknown voice)
 *
 * ```ts
 * import { Person } from "./Other.ts"
 *
 * const person = Person.make({ id: "person-1", name: "Ada" })
 * console.log(person.voiceReadiness) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Person extends Model<Person>("Person")(
  {
    id: S.String.annotateKey({ description: "Person id." }).pipe(pg.text(), pg.columnName("id")),
    name: S.String.annotateKey({ description: "Person name." }).pipe(pg.text(), pg.columnName("name")),
    createdAt: optionalTimestamp("created_at"),
    updatedAt: optionalTimestamp("updated_at"),
    speechSamples: S.Array(S.String)
      .annotateKey({ description: "Stored speech-sample ids." })
      .pipe(S.withConstructorDefault(Effect.succeed(emptyStrings)), pg.jsonb(), pg.columnName("speech_samples")),
    speechSampleTranscripts: S.String.pipe(S.Array, optionalNull)
      .annotateKey({ description: "Transcripts aligned with the speech samples." })
      .pipe(pg.jsonb(), pg.columnName("speech_sample_transcripts")),
    speechSamplesVersion: S.Int.annotateKey({ description: "Speech-sample schema version. Construction defaults to 3." })
      .pipe(S.withConstructorDefault(Effect.succeed(3)), pg.integer(), pg.columnName("speech_samples_version")),
    voiceReadiness: VoiceReadiness.annotateKey({
      description: "Stored recognition evidence. Construction defaults to unknown.",
    }).pipe(
      S.withConstructorDefault(Effect.succeed<VoiceReadiness>("unknown")),
      pg.text(),
      pg.columnName("voice_readiness"),
    ),
  },
  $I.annote("Person", { description: "A stored person and the speech samples used for recognition." }),
) {}

/**
 * Encoded form of {@link Person}.
 *
 * @see {@link Person} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Person {
  export type Encoded = S.Codec.Encoded<typeof Person>;
}

const withDefined = (record: { readonly [key: string]: unknown }, key: string, value: unknown) =>
  value === undefined ? record : { ...record, [key]: value };

/**
 * Decode a stored person, deriving voice readiness unless a claim stands alone.
 *
 * **Details**
 *
 * When `voiceReadiness` is already a legal member and `speakerEmbedding` is
 * absent, the claim is kept. Otherwise readiness is recomputed. Missing
 * samples become an empty list and a missing version becomes 3, matching the
 * Python constructor defaults. Snake_case stored keys are accepted.
 *
 * **Example** (Recompute when an embedding is present)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodePerson } from "./Other.ts"
 *
 * const person = Effect.runSync(
 *   decodePerson({ id: "person-1", name: "Ada", speechSamples: ["sample-1"], speakerEmbedding: [0] }),
 * )
 * console.log(person.voiceReadiness) // "unknown"
 * ```
 *
 * @see {@link voiceReadiness} for the evidence rules.
 * @category decoding
 * @since 0.0.0
 */
export const decodePerson = Effect.fn("Person.decodePerson")(function* (input: unknown) {
  if (!P.isObject(input)) return yield* S.decodeUnknownEffect(Person)(input);
  const claimed = readKey(input, "voice_readiness", "voiceReadiness");
  const embeddingPresent = P.hasProperty(input, "speaker_embedding") || P.hasProperty(input, "speakerEmbedding");
  const readiness = S.is(VoiceReadiness)(claimed) && !embeddingPresent ? claimed : voiceReadiness(input);
  const translated = withDefined(
    withDefined(
      withDefined(
        withDefined(
          withDefined(
            withDefined({ id: readKey(input, "id", "id"), name: readKey(input, "name", "name") }, "createdAt", readKey(input, "created_at", "createdAt")),
            "updatedAt",
            readKey(input, "updated_at", "updatedAt"),
          ),
          "speechSamples",
          readKey(input, "speech_samples", "speechSamples") ?? emptyStrings,
        ),
        "speechSampleTranscripts",
        readKey(input, "speech_sample_transcripts", "speechSampleTranscripts"),
      ),
      "speechSamplesVersion",
      readKey(input, "speech_samples_version", "speechSamplesVersion") ?? 3,
    ),
    "voiceReadiness",
    readiness,
  );
  return yield* S.decodeUnknownEffect(Person)(translated);
});

/**
 * Decode many stored people, skipping records that fail validation.
 *
 * **Details**
 *
 * One malformed or legacy document must not break a people lookup. `onError`,
 * when provided, is called for each skip. This mirrors `Message.deserialize_many_safe`.
 *
 * **Example** (Skip a record without an id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { deserializeManySafe } from "./Other.ts"
 *
 * const people = Effect.runSync(deserializeManySafe([{ id: "person-1", name: "Ada" }, { name: "No id" }]))
 * console.log(people.length) // 1
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const deserializeManySafe = Effect.fn("Person.deserializeManySafe")(function* (
  records: Iterable<unknown>,
  onError?: (record: unknown, error: unknown) => void,
) {
  let parsed = A.empty<Person>();
  for (const record of records) {
    const exit = yield* Effect.exit(decodePerson(record));
    if (Exit.isSuccess(exit)) parsed = A.append(parsed, exit.value);
    else if (onError !== undefined) onError(record, exit.cause);
  }
  return parsed;
});

