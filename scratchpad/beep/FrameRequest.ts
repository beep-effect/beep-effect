/**
 * Metadata queue for a just-in-time screen-frame request.
 *
 * **Details**
 *
 * The queue carries metadata only. Pixels are uploaded by the owning desktop
 * through the existing screen-sync path and are never accepted here.
 * Unknown keys are rejected. Datetimes are coerced to UTC, including naive
 * values. `uploaded` is not terminal.
 *
 * @since 0.0.0
 */
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { UtcTimestamp, accountGenerationDefault, boundedText, nonNegativeIntCheck, optionalTimestamp, textBoundsCheck, timestamp } from "./Kit.ts";
import { betweenCheck, Model, optionalNull, pg } from "./Port.ts";

const $I = $ScratchpadId.create("beep/FrameRequest");

const byteLimit = 10 * 1024 * 1024;
const cleanupLimit = 1000;
const ttlLimit = 6 * 24 * 60 * 60;

/**
 * Lifecycle state of a frame request.
 *
 * **Example** (Decode claimed)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FrameRequestState } from "@beep/scratchpad/beep/FrameRequest"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(FrameRequestState)("claimed"))) // "claimed"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FrameRequestState = LiteralKit([
  "requested",
  "claimed",
  "uploaded",
  "attached",
  "offline",
  "pruned",
  "failed",
  "expired",
  "cancelled",
]).pipe($I.annoteSchema("FrameRequestState", { description: "Lifecycle state of a screen-frame request." }));

/** @category type-level @since 0.0.0 */
export type FrameRequestState = typeof FrameRequestState.Type;

/**
 * External-pixel deletion state, independent of lifecycle terminality.
 *
 * **Example** (Decode pending cleanup)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FrameRequestCleanupState } from "@beep/scratchpad/beep/FrameRequest"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(FrameRequestCleanupState)("pending"))) // "pending"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FrameRequestCleanupState = LiteralKit(["not_required", "pending", "failed", "deleted", "permanent"]).pipe(
  $I.annoteSchema("FrameRequestCleanupState", { description: "External-pixel deletion state." }),
);

/** @category type-level @since 0.0.0 */
export type FrameRequestCleanupState = typeof FrameRequestCleanupState.Type;

/**
 * States that end a frame request. `uploaded` is not included.
 *
 * **Example** (Uploaded is not terminal)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { TerminalFrameRequestStates } from "@beep/scratchpad/beep/FrameRequest"
 *
 * console.log(HashSet.has(TerminalFrameRequestStates, "uploaded")) // false
 * console.log(HashSet.has(TerminalFrameRequestStates, "attached")) // true
 * ```
 *
 * @category sets
 * @since 0.0.0
 */
export const TerminalFrameRequestStates = HashSet.fromIterable([
  "attached",
  "offline",
  "pruned",
  "failed",
  "expired",
  "cancelled",
]);

/**
 * Frame-request contract failure.
 *
 * **Example** (Build a blank-identifier error)
 *
 * ```ts
 * import { FrameRequestContractError } from "@beep/scratchpad/beep/FrameRequest"
 *
 * const error = FrameRequestContractError.make({ message: "frame request identifiers must not be blank" })
 * console.log(error.message) // "frame request identifiers must not be blank"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FrameRequestContractError extends S.TaggedError<FrameRequestContractError>()(
  "FrameRequestContractError",
  { message: S.String },
  $I.annoteError<FrameRequestContractError>("FrameRequestContractError", {
    description: "A frame-request identifier, storage id, or lifecycle rule was rejected.",
  }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FrameRequestContractError {
  export type Encoded = S.Codec.Encoded<typeof FrameRequestContractError>;
}

const hasSlash = (value: string): boolean => Str.includes("/")(value) || Str.includes("\\")(value);

const hasHttpPrefix = (value: string): boolean => Str.startsWith("http:")(value) || Str.startsWith("https:")(value);

/**
 * Strips a required frame-request identifier.
 *
 * **Details**
 *
 * Non-strings fail. Blank after trim fails. Length checks run on the stripped
 * value.
 *
 * **Example** (Trim an id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { stripRequiredFrameString } from "@beep/scratchpad/beep/FrameRequest"
 *
 * console.log(Effect.runSync(stripRequiredFrameString("  id  "))) // "id"
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const stripRequiredFrameString = Effect.fn("FrameRequest.stripRequiredStrings")(function* (value: unknown) {
  if (!P.isString(value)) {
    return yield* FrameRequestContractError.make({ message: "frame request identifiers must be strings" });
  }
  const trimmed = Str.trim(value);
  if (Str.isEmpty(trimmed)) {
    return yield* FrameRequestContractError.make({ message: "frame request identifiers must not be blank" });
  }
  return trimmed;
});

/**
 * Rejects a request id that contains a slash or backslash.
 *
 * **Example** (Reject a path)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { validateRequestId } from "@beep/scratchpad/beep/FrameRequest"
 *
 * const failed = Effect.runSyncExit(validateRequestId("a/b"))
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const validateRequestId = Effect.fn("FrameRequest.validateRequestId")(function* (value: string) {
  if (hasSlash(value)) {
    return yield* FrameRequestContractError.make({ message: "request_id must be one opaque path segment" });
  }
  return value;
});

/**
 * Strips an optional frame-request string. Blank becomes `None`.
 *
 * **Example** (Drop a blank screenshot id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { stripOptionalFrameString } from "@beep/scratchpad/beep/FrameRequest"
 *
 * console.log(O.isNone(Effect.runSync(stripOptionalFrameString("  ")))) // true
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const stripOptionalFrameString = Effect.fn("FrameRequest.stripOptionalStrings")(function* (value: unknown) {
  if (value === null || value === undefined) return O.none();
  if (!P.isString(value)) {
    return yield* FrameRequestContractError.make({ message: "frame request optional fields must be strings" });
  }
  const trimmed = Str.trim(value);
  return Str.isEmpty(trimmed) ? O.none() : O.some(trimmed);
});

/**
 * Rejects a storage id that is not an opaque owner-scoped token.
 *
 * **Details**
 *
 * This check does not strip. `None` stays `None`. Slash, backslash, and an
 * http or https prefix fail.
 *
 * **Example** (Reject an http prefix)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { validateFrameStorageId } from "@beep/scratchpad/beep/FrameRequest"
 *
 * const failed = Effect.runSyncExit(validateFrameStorageId(O.some("https:abc")))
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const validateFrameStorageId = Effect.fn("FrameRequest.validateStorageId")(function* (
  value: O.Option<string>,
) {
  if (O.isNone(value)) return value;
  if (hasSlash(value.value) || hasHttpPrefix(value.value)) {
    return yield* FrameRequestContractError.make({ message: "storage_id must be an opaque owner-scoped identifier" });
  }
  return value;
});

/**
 * Strips a state-update storage id, maps blank to `None`, and rejects a path or URL.
 *
 * **Example** (Map blank to none)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { validateStateUpdateStorageId } from "@beep/scratchpad/beep/FrameRequest"
 *
 * console.log(O.isNone(Effect.runSync(validateStateUpdateStorageId("   ")))) // true
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const validateStateUpdateStorageId = Effect.fn("FrameRequestStateUpdate.validateStorageId")(function* (
  value: unknown,
) {
  const stripped = yield* stripOptionalFrameString(value);
  return yield* validateFrameStorageId(stripped);
});

/**
 * Reads a frame instant as UTC. Naive strings are UTC. Null stays `None`.
 *
 * **Example** (Accept a naive stamp)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { normalizeFrameInstant } from "@beep/scratchpad/beep/FrameRequest"
 *
 * const decoded = Effect.runSync(normalizeFrameInstant(O.some("2020-01-02T03:04:05.000")))
 * console.log(O.isSome(decoded)) // true
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const normalizeFrameInstant = Effect.fn("FrameRequest.normalizeDateTime")(function* (value: O.Option<string>) {
  if (O.isNone(value)) return O.none<DateTime.Utc>();
  const instant = yield* S.decodeEffect(UtcTimestamp)(value.value);
  return O.some(instant);
});

const requestedState = "requested";
const notRequiredCleanup = "not_required";

const optionalBounded = (column: string, maximum: number) =>
  S.String.check(S.isMaxLength(maximum)).pipe(optionalNull, pg.text(), pg.columnName(column));

/**
 * Owner-scoped frame request and its lifecycle.
 *
 * **Details**
 *
 * Required identifiers are 1 character after trim, up to the field maximum.
 * `byte_count` is 0 through 10485760. `cleanup_attempts` is 0 through 1000.
 * `account_generation`, `dedupe_window`, and `attempt_number` are at least 0.
 * {@link decodeFrameRequest} strips identifiers, rejects extra keys, and runs
 * the lifecycle rules.
 *
 * **Gotchas**
 *
 * `claimed` does not require `claimed_at`. `uploaded` is not terminal and
 * requires `storage_id`. `attached` requires a conversation, equal created and
 * expiry instants, and no terminal reason.
 *
 * **Example** (Construct a requested row)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { FrameRequest } from "@beep/scratchpad/beep/FrameRequest"
 *
 * const at = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const request = FrameRequest.make({
 *   requestId: "r1",
 *   uid: "user-1",
 *   deviceId: "device-1",
 *   dedupeKey: "d1",
 *   createdAt: at,
 *   expiresAt: at,
 * })
 * console.log(request.state) // "requested"
 * console.log(request.byteCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrameRequest extends Model<FrameRequest>("FrameRequest")(
  {
    requestId: boundedText("request_id", { minLength: 1, maxLength: 128 }),
    uid: boundedText("uid", { minLength: 1, maxLength: 256 }),
    deviceId: boundedText("device_id", { minLength: 1, maxLength: 256 }),
    accountGeneration: accountGenerationDefault("account_generation"),
    dedupeKey: boundedText("dedupe_key", { minLength: 1, maxLength: 256 }),
    dedupeWindow: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      pg.integer(),
      pg.columnName("dedupe_window"),
    ),
    attemptNumber: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      pg.integer(),
      pg.columnName("attempt_number"),
    ),
    conversationId: optionalBounded("conversation_id", 256),
    screenshotId: optionalBounded("screenshot_id", 256),
    state: FrameRequestState.pipe(
      S.withConstructorDefault(Effect.succeed(requestedState)),
      pg.text(),
      pg.columnName("state"),
    ),
    createdAt: timestamp("created_at"),
    expiresAt: timestamp("expires_at"),
    claimedAt: optionalTimestamp("claimed_at"),
    uploadedAt: optionalTimestamp("uploaded_at"),
    attachedAt: optionalTimestamp("attached_at"),
    terminalReason: optionalBounded("terminal_reason", 240),
    byteCount: S.Int.check(S.isBetween({ minimum: 0, maximum: byteLimit })).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      pg.integer(),
      pg.columnName("byte_count"),
    ),
    contentType: optionalBounded("content_type", 100),
    storageId: optionalBounded("storage_id", 256),
    cleanupState: FrameRequestCleanupState.pipe(
      S.withConstructorDefault(Effect.succeed(notRequiredCleanup)),
      pg.text(),
      pg.columnName("cleanup_state"),
    ),
    cleanupAttempts: S.Int.check(S.isBetween({ minimum: 0, maximum: cleanupLimit })).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      pg.integer(),
      pg.columnName("cleanup_attempts"),
    ),
    cleanupNextAttemptAt: optionalTimestamp("cleanup_next_attempt_at"),
  },
  $I.annote("FrameRequest", {
    description: "Owner-scoped screen-frame request. Pixels are not accepted on this model.",
  }),
  (columns: {
    readonly requestId: ExtraConfigColumn;
    readonly uid: ExtraConfigColumn;
    readonly deviceId: ExtraConfigColumn;
    readonly dedupeKey: ExtraConfigColumn;
    readonly dedupeWindow: ExtraConfigColumn;
    readonly attemptNumber: ExtraConfigColumn;
    readonly conversationId: ExtraConfigColumn;
    readonly screenshotId: ExtraConfigColumn;
    readonly terminalReason: ExtraConfigColumn;
    readonly byteCount: ExtraConfigColumn;
    readonly contentType: ExtraConfigColumn;
    readonly storageId: ExtraConfigColumn;
    readonly cleanupAttempts: ExtraConfigColumn;
  }) => [
    textBoundsCheck("uid", { minLength: 1, maxLength: 256 })(columns.uid),
    textBoundsCheck("request_id", { minLength: 1, maxLength: 128 })(columns.requestId),
    textBoundsCheck("device_id", { minLength: 1, maxLength: 256 })(columns.deviceId),
    textBoundsCheck("dedupe_key", { minLength: 1, maxLength: 256 })(columns.dedupeKey),
    nonNegativeIntCheck("dedupe_window")(columns.dedupeWindow),
    nonNegativeIntCheck("attempt_number")(columns.attemptNumber),
    textBoundsCheck("conversation_id", { maxLength: 256 })(columns.conversationId),
    textBoundsCheck("screenshot_id", { maxLength: 256 })(columns.screenshotId),
    textBoundsCheck("terminal_reason", { maxLength: 240 })(columns.terminalReason),
    betweenCheck("byte_count", 0, byteLimit)(columns.byteCount),
    textBoundsCheck("content_type", { maxLength: 100 })(columns.contentType),
    textBoundsCheck("storage_id", { maxLength: 256 })(columns.storageId),
    betweenCheck("cleanup_attempts", 0, cleanupLimit)(columns.cleanupAttempts),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FrameRequest {
  export type Encoded = S.Codec.Encoded<typeof FrameRequest>;
}

/**
 * Snake_case codec for {@link FrameRequest}.
 *
 * **Example** (Decode a null storage id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { FrameRequestWire } from "@beep/scratchpad/beep/FrameRequest"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FrameRequestWire)({
 *     request_id: "r1",
 *     uid: "user-1",
 *     device_id: "device-1",
 *     account_generation: 0,
 *     dedupe_key: "d1",
 *     dedupe_window: 0,
 *     attempt_number: 0,
 *     state: "requested",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     expires_at: "2020-01-02T04:04:05.000Z",
 *     byte_count: 0,
 *     cleanup_state: "not_required",
 *     cleanup_attempts: 0,
 *     storage_id: null,
 *   }),
 * )
 * console.log(O.isNone(decoded.storageId)) // true
 * ```
 *
 * @see {@link decodeFrameRequest} for lifecycle and stripping.
 * @category codecs
 * @since 0.0.0
 */
export const FrameRequestWire = FrameRequest.pipe(
  S.encodeKeys({
    requestId: "request_id",
    deviceId: "device_id",
    accountGeneration: "account_generation",
    dedupeKey: "dedupe_key",
    dedupeWindow: "dedupe_window",
    attemptNumber: "attempt_number",
    conversationId: "conversation_id",
    screenshotId: "screenshot_id",
    createdAt: "created_at",
    expiresAt: "expires_at",
    claimedAt: "claimed_at",
    uploadedAt: "uploaded_at",
    attachedAt: "attached_at",
    terminalReason: "terminal_reason",
    byteCount: "byte_count",
    contentType: "content_type",
    storageId: "storage_id",
    cleanupState: "cleanup_state",
    cleanupAttempts: "cleanup_attempts",
    cleanupNextAttemptAt: "cleanup_next_attempt_at",
  }),
);

const sameInstant = (left: DateTime.Utc, right: DateTime.Utc): boolean =>
  DateTime.toEpochMillis(left) === DateTime.toEpochMillis(right);

const notBefore = (left: DateTime.Utc, right: DateTime.Utc): boolean =>
  DateTime.toEpochMillis(left) <= DateTime.toEpochMillis(right);

/**
 * Checks expiry, attached, terminal, and uploaded rules.
 *
 * **Example** (Reject an uploaded row without storage)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { FrameRequest, validateFrameLifecycle } from "@beep/scratchpad/beep/FrameRequest"
 *
 * const at = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const request = FrameRequest.make({
 *   requestId: "r1",
 *   uid: "user-1",
 *   deviceId: "device-1",
 *   dedupeKey: "d1",
 *   state: "uploaded",
 *   createdAt: at,
 *   expiresAt: at,
 * })
 * const failed = Effect.runSyncExit(validateFrameLifecycle(request))
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const validateFrameLifecycle = Effect.fn("FrameRequest.validateLifecycle")(function* (request: FrameRequest) {
  if (!notBefore(request.createdAt, request.expiresAt)) {
    return yield* FrameRequestContractError.make({ message: "frame request expiry must not precede creation" });
  }
  if (request.state === "attached") {
    if (O.isNone(request.conversationId)) {
      return yield* FrameRequestContractError.make({ message: "attached frame requests require a conversation" });
    }
    if (!sameInstant(request.expiresAt, request.createdAt)) {
      return yield* FrameRequestContractError.make({
        message: "attached frame requests must not carry a time-based expiry",
      });
    }
    if (O.isSome(request.terminalReason)) {
      return yield* FrameRequestContractError.make({ message: "attached frame requests do not carry a terminal reason" });
    }
  }
  if (HashSet.has(TerminalFrameRequestStates, request.state) && request.state !== "attached" && O.isNone(request.terminalReason)) {
    return yield* FrameRequestContractError.make({ message: "terminal frame requests require a bounded reason" });
  }
  if (request.state === "uploaded" && O.isNone(request.storageId)) {
    return yield* FrameRequestContractError.make({ message: "uploaded frame requests require a storage id" });
  }
  return request;
});

const UnknownRecord = S.Record(S.String, S.Unknown);

const prepareStrings = Effect.fn("FrameRequest.prepareStrings")(function* (
  input: unknown,
  required: ReadonlyArray<string>,
  optional: ReadonlyArray<string>,
) {
  const record = S.decodeUnknownOption(UnknownRecord)(input);
  if (O.isNone(record)) return input;
  let next = record.value;
  for (const key of required) {
    if (!R.has(next, key)) continue;
    const stripped = yield* stripRequiredFrameString(next[key]);
    next = R.set(key, stripped)(next);
  }
  for (const key of optional) {
    if (!R.has(next, key)) continue;
    const stripped = yield* stripOptionalFrameString(next[key]);
    next = R.set(key, O.match(stripped, { onNone: () => null, onSome: (text) => text }))(next);
  }
  return next;
});

/**
 * Decodes a frame request, strips identifiers, and checks the lifecycle.
 *
 * **Details**
 *
 * Extra keys fail. Naive datetimes become UTC. A blank optional string becomes
 * null before the schema sees it.
 *
 * **Example** (Reject an extra key)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeFrameRequest } from "@beep/scratchpad/beep/FrameRequest"
 *
 * const failed = Effect.runSyncExit(
 *   decodeFrameRequest({
 *     request_id: "r1",
 *     uid: "user-1",
 *     device_id: "device-1",
 *     dedupe_key: "d1",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     expires_at: "2020-01-02T04:04:05.000Z",
 *     extra: true,
 *   }),
 * )
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @see {@link validateFrameLifecycle} for the state rules.
 * @category decoding
 * @since 0.0.0
 */
export const decodeFrameRequest = Effect.fn("FrameRequest.decode")(function* (input: unknown) {
  const prepared = yield* prepareStrings(
    input,
    ["uid", "device_id", "request_id", "dedupe_key"],
    ["conversation_id", "screenshot_id", "terminal_reason", "content_type", "storage_id"],
  );
  const decoded = yield* S.decodeUnknownEffect(FrameRequestWire, { onExcessProperty: "error" })(prepared);
  const requestId = yield* validateRequestId(decoded.requestId);
  const storageId = yield* validateFrameStorageId(decoded.storageId);
  return yield* validateFrameLifecycle(FrameRequest.make({ ...decoded, requestId, storageId }));
});

/**
 * Client create body. Identifiers are not stripped.
 *
 * **Details**
 *
 * `requested_ttl_seconds` is null or from 1 through 518400. A one-space device
 * id is length 1 and is accepted here, unlike {@link FrameRequest}.
 *
 * **Example** (Decode a null ttl)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { decodeCreateFrameRequest } from "@beep/scratchpad/beep/FrameRequest"
 *
 * const decoded = Effect.runSync(
 *   decodeCreateFrameRequest({ device_id: " d ", dedupe_key: "k", requested_ttl_seconds: null }),
 * )
 * console.log(decoded.deviceId) // " d "
 * console.log(O.isNone(decoded.requestedTtlSeconds)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreateFrameRequest extends Model<CreateFrameRequest>("CreateFrameRequest")(
  {
    deviceId: boundedText("device_id", { minLength: 1, maxLength: 256 }),
    accountGeneration: accountGenerationDefault("account_generation"),
    dedupeKey: boundedText("dedupe_key", { minLength: 1, maxLength: 256 }),
    conversationId: optionalBounded("conversation_id", 256),
    screenshotId: optionalBounded("screenshot_id", 256),
    requestedTtlSeconds: S.Int.check(S.isBetween({ minimum: 1, maximum: ttlLimit })).pipe(
      optionalNull,
      pg.integer(),
      pg.columnName("requested_ttl_seconds"),
    ),
  },
  $I.annote("CreateFrameRequest", {
    description: "Create body for a frame request. Strings are not stripped.",
  }),
  (columns: {
    readonly deviceId: ExtraConfigColumn;
    readonly dedupeKey: ExtraConfigColumn;
    readonly conversationId: ExtraConfigColumn;
    readonly screenshotId: ExtraConfigColumn;
    readonly requestedTtlSeconds: ExtraConfigColumn;
  }) => [
    textBoundsCheck("device_id", { minLength: 1, maxLength: 256 })(columns.deviceId),
    textBoundsCheck("dedupe_key", { minLength: 1, maxLength: 256 })(columns.dedupeKey),
    textBoundsCheck("conversation_id", { maxLength: 256 })(columns.conversationId),
    textBoundsCheck("screenshot_id", { maxLength: 256 })(columns.screenshotId),
    betweenCheck("requested_ttl_seconds", 1, ttlLimit)(columns.requestedTtlSeconds),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace CreateFrameRequest {
  export type Encoded = S.Codec.Encoded<typeof CreateFrameRequest>;
}

/** @category codecs @since 0.0.0 */
export const CreateFrameRequestWire = CreateFrameRequest.pipe(
  S.encodeKeys({
    deviceId: "device_id",
    accountGeneration: "account_generation",
    dedupeKey: "dedupe_key",
    conversationId: "conversation_id",
    screenshotId: "screenshot_id",
    requestedTtlSeconds: "requested_ttl_seconds",
  }),
);

/**
 * Decodes a create body and rejects unknown keys. Does not strip.
 *
 * **Example** (Keep surrounding spaces)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeCreateFrameRequest } from "@beep/scratchpad/beep/FrameRequest"
 *
 * const decoded = Effect.runSync(decodeCreateFrameRequest({ device_id: " d ", dedupe_key: "k" }))
 * console.log(decoded.deviceId) // " d "
 * ```
 *
 * @see {@link CreateFrameRequest} for the model.
 * @category decoding
 * @since 0.0.0
 */
export const decodeCreateFrameRequest = Effect.fn("CreateFrameRequest.decode")(function* (input: unknown) {
  return yield* S.decodeUnknownEffect(CreateFrameRequestWire, { onExcessProperty: "error" })(input);
});

/**
 * State transition posted by the owning device.
 *
 * **Details**
 *
 * `storage_id` is stripped, and blank becomes null, by
 * {@link validateStateUpdateStorageId}. `byte_count` constructs as 0 and is
 * at most 10485760. `account_generation` constructs as 0.
 *
 * **Example** (Decode a claimed update)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeFrameRequestStateUpdate } from "@beep/scratchpad/beep/FrameRequest"
 *
 * const decoded = Effect.runSync(
 *   decodeFrameRequestStateUpdate({ state: "claimed", device_id: "device-1", storage_id: "  sid  " }),
 * )
 * console.log(decoded.storageId) // some sid after trim is applied by the decoder
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrameRequestStateUpdate extends Model<FrameRequestStateUpdate>("FrameRequestStateUpdate")(
  {
    state: FrameRequestState.pipe(pg.text(), pg.columnName("state")),
    deviceId: boundedText("device_id", { minLength: 1, maxLength: 256 }),
    accountGeneration: accountGenerationDefault("account_generation"),
    terminalReason: optionalBounded("terminal_reason", 240),
    storageId: optionalBounded("storage_id", 256),
    byteCount: S.Int.check(S.isBetween({ minimum: 0, maximum: byteLimit })).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      pg.integer(),
      pg.columnName("byte_count"),
    ),
    contentType: optionalBounded("content_type", 100),
  },
  $I.annote("FrameRequestStateUpdate", {
    description: "Device state update. Storage ids are stripped by the decoder.",
  }),
  (columns: {
    readonly deviceId: ExtraConfigColumn;
    readonly terminalReason: ExtraConfigColumn;
    readonly storageId: ExtraConfigColumn;
    readonly byteCount: ExtraConfigColumn;
    readonly contentType: ExtraConfigColumn;
  }) => [
    textBoundsCheck("device_id", { minLength: 1, maxLength: 256 })(columns.deviceId),
    textBoundsCheck("terminal_reason", { maxLength: 240 })(columns.terminalReason),
    textBoundsCheck("storage_id", { maxLength: 256 })(columns.storageId),
    betweenCheck("byte_count", 0, byteLimit)(columns.byteCount),
    textBoundsCheck("content_type", { maxLength: 100 })(columns.contentType),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FrameRequestStateUpdate {
  export type Encoded = S.Codec.Encoded<typeof FrameRequestStateUpdate>;
}

/** @category codecs @since 0.0.0 */
export const FrameRequestStateUpdateWire = FrameRequestStateUpdate.pipe(
  S.encodeKeys({
    deviceId: "device_id",
    accountGeneration: "account_generation",
    terminalReason: "terminal_reason",
    storageId: "storage_id",
    byteCount: "byte_count",
    contentType: "content_type",
  }),
);

/**
 * Decodes a state update, strips storage id, and rejects unknown keys.
 *
 * **Example** (Trim a storage id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { decodeFrameRequestStateUpdate } from "@beep/scratchpad/beep/FrameRequest"
 *
 * const decoded = Effect.runSync(
 *   decodeFrameRequestStateUpdate({ state: "uploaded", device_id: "device-1", storage_id: " sid " }),
 * )
 * console.log(O.getOrElse(decoded.storageId, () => "")) // "sid"
 * ```
 *
 * @see {@link validateStateUpdateStorageId} for the storage rule.
 * @category decoding
 * @since 0.0.0
 */
export const decodeFrameRequestStateUpdate = Effect.fn("FrameRequestStateUpdate.decode")(function* (input: unknown) {
  const prepared = yield* prepareStrings(input, [], ["storage_id", "terminal_reason", "content_type"]);
  const decoded = yield* S.decodeUnknownEffect(FrameRequestStateUpdateWire, { onExcessProperty: "error" })(prepared);
  const storageId = yield* validateFrameStorageId(decoded.storageId);
  return FrameRequestStateUpdate.make({ ...decoded, storageId });
});

/**
 * Promotion of an uploaded frame onto a conversation.
 *
 * **Example** (Decode a promotion)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FrameRequestPromotionWire } from "@beep/scratchpad/beep/FrameRequest"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FrameRequestPromotionWire)({
 *     device_id: "device-1",
 *     account_generation: 0,
 *     conversation_id: "c1",
 *   }),
 * )
 * console.log(decoded.conversationId) // "c1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrameRequestPromotion extends Model<FrameRequestPromotion>("FrameRequestPromotion")(
  {
    deviceId: boundedText("device_id", { minLength: 1, maxLength: 256 }),
    accountGeneration: accountGenerationDefault("account_generation"),
    conversationId: boundedText("conversation_id", { minLength: 1, maxLength: 256 }),
  },
  $I.annote("FrameRequestPromotion", { description: "Attaches an uploaded frame to a conversation." }),
  (columns: { readonly deviceId: ExtraConfigColumn; readonly conversationId: ExtraConfigColumn }) => [
    textBoundsCheck("device_id", { minLength: 1, maxLength: 256 })(columns.deviceId),
    textBoundsCheck("conversation_id", { minLength: 1, maxLength: 256 })(columns.conversationId),
  ],
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FrameRequestPromotion {
  export type Encoded = S.Codec.Encoded<typeof FrameRequestPromotion>;
}

/** @category codecs @since 0.0.0 */
export const FrameRequestPromotionWire = FrameRequestPromotion.pipe(
  S.encodeKeys({
    deviceId: "device_id",
    accountGeneration: "account_generation",
    conversationId: "conversation_id",
  }),
);

/**
 * One request plus whether it was a duplicate.
 *
 * **Example** (Construct deduplicated false)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { FrameRequest, FrameRequestEnvelope } from "@beep/scratchpad/beep/FrameRequest"
 *
 * const at = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const envelope = FrameRequestEnvelope.make({
 *   request: FrameRequest.make({
 *     requestId: "r1",
 *     uid: "user-1",
 *     deviceId: "device-1",
 *     dedupeKey: "d1",
 *     createdAt: at,
 *     expiresAt: at,
 *   }),
 * })
 * console.log(envelope.deduplicated) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrameRequestEnvelope extends Model<FrameRequestEnvelope>("FrameRequestEnvelope")(
  {
    request: FrameRequestWire.pipe(pg.jsonb(), pg.columnName("request")),
    deduplicated: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false)), pg.boolean(), pg.columnName("deduplicated")),
  },
  $I.annote("FrameRequestEnvelope", { description: "One frame request and whether the write was a duplicate." }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FrameRequestEnvelope {
  export type Encoded = S.Codec.Encoded<typeof FrameRequestEnvelope>;
}

/** @category codecs @since 0.0.0 */
export const FrameRequestEnvelopeWire = FrameRequestEnvelope;

const noRequests = (): ReadonlyArray<FrameRequest> => [];

/**
 * Up to 32 frame requests.
 *
 * **Example** (Construct an empty batch)
 *
 * ```ts
 * import { FrameRequestBatch } from "@beep/scratchpad/beep/FrameRequest"
 *
 * console.log(FrameRequestBatch.make({}).requests.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrameRequestBatch extends Model<FrameRequestBatch>("FrameRequestBatch")(
  {
    requests: S.Array(FrameRequestWire)
      .check(S.isMaxLength(32))
      .pipe(S.withConstructorDefault(Effect.sync(noRequests)), pg.jsonb(), pg.columnName("requests")),
  },
  $I.annote("FrameRequestBatch", { description: "Batch of at most 32 frame requests." }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace FrameRequestBatch {
  export type Encoded = S.Codec.Encoded<typeof FrameRequestBatch>;
}

/** @category codecs @since 0.0.0 */
export const FrameRequestBatchWire = FrameRequestBatch;
