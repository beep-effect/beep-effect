/**
 * Wire types and internal models for meeting-note screenshot egress.
 *
 * **Details**
 *
 * The client uploads candidate bytes. The server canonicalises them, judges
 * those exact bytes, mints an internal approval, and only a holder of that
 * approval may write the screenshot bucket. {@link ScreenFrameApprovalClaims}
 * never leaves the process.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { Model, Table, bool, boundedText, confidence, optionalNull, optionalTimestamp, pg, text, textBoundsCheck, timestamp, unitIntervalCheck } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/ScreenFrame");

const joiners = "\u200d\u200c\ufe0f\ufe0e";
const combiningMark = /^\p{M}$/u;

const betweenCheck =
  (name: string, minimum: number, maximum: number) => (column: ExtraConfigColumn) =>
    Table.check(name)(
      sql<boolean>`${column} >= ${sql.raw(String(minimum))} and ${column} <= ${sql.raw(String(maximum))}`,
    );

const jsonbLengthCheck =
  (name: string, minimum: number, maximum: number) => (column: ExtraConfigColumn) =>
    Table.check(name)(
      sql<boolean>`jsonb_typeof(${column}) = 'array' and jsonb_array_length(${column}) >= ${sql.raw(String(minimum))} and jsonb_array_length(${column}) <= ${sql.raw(String(maximum))}`,
    );

const jsonbMaxCheck = (name: string, maximum: number) => (column: ExtraConfigColumn) =>
  Table.check(name)(
    sql<boolean>`jsonb_typeof(${column}) = 'array' and jsonb_array_length(${column}) <= ${sql.raw(String(maximum))}`,
  );

const intBetween = (minimum: number, maximum: number) => S.Int.check(S.isBetween({ minimum, maximum }));

const codePointWidth = (value: string, index: number): number => {
  const point = value.codePointAt(index);
  if (point === undefined) return 1;
  return point > 0xffff ? 2 : 1;
};

const codePointCount = (value: string): number => {
  let count = 0;
  let index = 0;
  while (index < value.length) {
    index += codePointWidth(value, index);
    count += 1;
  }
  return count;
};

const takeCodePoints = (value: string, count: number): string => {
  let taken = 0;
  let index = 0;
  while (index < value.length && taken < count) {
    index += codePointWidth(value, index);
    taken += 1;
  }
  return Str.slice(0, index)(value);
};

const lastCodePointWidth = (value: string): number => {
  if (Str.isEmpty(value)) return 0;
  const last = value.charCodeAt(value.length - 1);
  return last >= 0xdc00 && last <= 0xdfff ? 2 : 1;
};

const lastCodePoint = (value: string): string => {
  const width = lastCodePointWidth(value);
  return width === 0 ? "" : Str.slice(value.length - width)(value);
};

const dropLastCodePoint = (value: string): string => {
  const width = lastCodePointWidth(value);
  return width === 0 ? value : Str.slice(0, value.length - width)(value);
};

const endsWithMarkOrJoiner = (value: string): boolean => {
  const last = lastCodePoint(value);
  return Str.isNonEmpty(last) && (combiningMark.test(last) || Str.includes(last)(joiners));
};

/**
 * Cuts a caption to 160 Unicode code points without leaving a dangling mark.
 *
 * **Details**
 *
 * Python `_truncate_caption` runs before validation. A non-string is returned
 * unchanged so the string check can reject it. A string of 160 code points or
 * fewer is unchanged. A longer string is cut on a code-point boundary, then
 * combining marks and the joiners U+200D, U+200C, U+FE0F, and U+FE0E are
 * dropped from the cut so clients do not render a broken glyph.
 *
 * **Gotchas**
 *
 * The cut is by code point, matching Python `str` slicing, not by UTF-16 code
 * unit and not by grapheme cluster. An emoji that is one code point survives
 * as one character. A ZWJ sequence can still be split when the joiner itself
 * is not the last code point of the cut.
 *
 * **Example** (Back off a combining mark)
 *
 * ```ts
 * import { truncateCaption } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const marked = `${"a".repeat(159)}\u0301extra`
 * console.log(truncateCaption(marked)) // "a" repeated 159 times
 * console.log(truncateCaption(1)) // 1
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const truncateCaption = (value: unknown): unknown => {
  if (!P.isString(value) || codePointCount(value) <= 160) return value;
  let cut = takeCodePoints(value, 160);
  while (endsWithMarkOrJoiner(cut)) cut = dropLastCodePoint(cut);
  return cut;
};

/**
 * Keeps the first eight labels when the value is a list.
 *
 * **Details**
 *
 * Python `_cap_labels` returns `value[:8]` when the value is a list and
 * returns every other value unchanged. Element types are not inspected here.
 *
 * **Example** (Cap a long label list)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import { capLabels } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const capped = capLabels(["a", "b", "c", "d", "e", "f", "g", "h", "i"])
 * console.log(A.isArray(capped) && capped.length) // 8
 * console.log(capLabels("labels")) // "labels"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const capLabels = (value: unknown): unknown => (A.isArray(value) ? A.take(value, 8) : value);

const truncatedCaption = S.String.pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: (value: string) => {
        const truncated = truncateCaption(value);
        return P.isString(truncated) ? truncated : value;
      },
      encode: (value: string) => value,
    }),
  ),
);

const cappedStringList = S.Array(S.String).pipe(
  S.decodeTo(
    S.Array(S.String),
    SchemaTransformation.transform({
      decode: (labels: ReadonlyArray<string>) => {
        const capped = capLabels(labels);
        return A.isArray(capped) ? A.filter(capped, P.isString) : labels;
      },
      encode: (labels: ReadonlyArray<string>) => labels,
    }),
  ),
);

const uuid = (column: string) => S.String.pipe(pg.uuid(), pg.columnName(column));

/**
 * Egress purpose stored beside the request literal.
 *
 * **Details**
 *
 * `ScreenFrameEgressPurpose.MEETING_NOTE_V1` encodes as `meeting_note_v1`.
 * The request field uses this value. Approval claims do not: their `purpose`
 * is an open string.
 *
 * **Example** (Accept the meeting-note purpose)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScreenFrameEgressPurpose } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * console.log(S.is(ScreenFrameEgressPurpose)("meeting_note_v1")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScreenFrameEgressPurpose = LiteralKit(["meeting_note_v1"]).pipe(
  $I.annoteSchema("ScreenFrameEgressPurpose", {
    description: "Screenshot egress purpose. The only declared value is meeting_note_v1.",
  }),
);

/**
 * Decoded egress purpose.
 *
 * @see {@link ScreenFrameEgressPurpose} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ScreenFrameEgressPurpose = typeof ScreenFrameEgressPurpose.Type;

/**
 * Retention class declared beside the claims string.
 *
 * **Details**
 *
 * `ScreenFrameRetentionClass.WITH_SUBJECT` encodes as `with_subject`. No field
 * in this module uses the enum. Approval `retention` is an open string.
 *
 * **Example** (Accept the subject retention class)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScreenFrameRetentionClass } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * console.log(S.is(ScreenFrameRetentionClass)("with_subject")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScreenFrameRetentionClass = LiteralKit(["with_subject"]).pipe(
  $I.annoteSchema("ScreenFrameRetentionClass", {
    description: "Declared retention class. The only value is with_subject, and claims do not use it.",
  }),
);

/**
 * Decoded retention class.
 *
 * @see {@link ScreenFrameRetentionClass} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ScreenFrameRetentionClass = typeof ScreenFrameRetentionClass.Type;

/**
 * Subject kind a screen frame may name.
 *
 * **Example** (Accept a conversation subject)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScreenFrameSubjectKind } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * console.log(S.is(ScreenFrameSubjectKind)("conversation")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScreenFrameSubjectKind = LiteralKit(["conversation"]).pipe(
  $I.annoteSchema("ScreenFrameSubjectKind", {
    description: "Subject kind for a screen frame. The only value is conversation.",
  }),
);

/**
 * Decoded screen-frame subject kind.
 *
 * @see {@link ScreenFrameSubjectKind} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ScreenFrameSubjectKind = typeof ScreenFrameSubjectKind.Type;

/**
 * Image types a candidate frame may declare.
 *
 * **Example** (Accept JPEG and PNG)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScreenFrameMimeType } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * console.log(S.is(ScreenFrameMimeType)("image/jpeg")) // true
 * console.log(S.is(ScreenFrameMimeType)("image/png")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScreenFrameMimeType = LiteralKit(["image/jpeg", "image/png"]).pipe(
  $I.annoteSchema("ScreenFrameMimeType", {
    description: "Declared image type for a candidate screen frame.",
  }),
);

/**
 * Decoded candidate mime type.
 *
 * @see {@link ScreenFrameMimeType} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ScreenFrameMimeType = typeof ScreenFrameMimeType.Type;

/**
 * Where an approved frame is placed in the meeting note.
 *
 * **Example** (Accept banner and strip)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScreenFrameRole } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * console.log(S.is(ScreenFrameRole)("banner")) // true
 * console.log(S.is(ScreenFrameRole)("strip")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScreenFrameRole = LiteralKit(["banner", "strip"]).pipe(
  $I.annoteSchema("ScreenFrameRole", {
    description: "Placement of an approved screen frame: banner or strip.",
  }),
);

/**
 * Decoded frame role.
 *
 * @see {@link ScreenFrameRole} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ScreenFrameRole = typeof ScreenFrameRole.Type;

/**
 * Badge naming the kind of surface visible in a frame.
 *
 * **Example** (Accept a code badge)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScreenFrameSourceBadge } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * console.log(S.is(ScreenFrameSourceBadge)("code")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScreenFrameSourceBadge = LiteralKit(["code", "browser", "document", "slides", "product"]).pipe(
  $I.annoteSchema("ScreenFrameSourceBadge", {
    description: "Surface badge for an approved screen frame.",
  }),
);

/**
 * Decoded source badge.
 *
 * @see {@link ScreenFrameSourceBadge} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ScreenFrameSourceBadge = typeof ScreenFrameSourceBadge.Type;

/**
 * Outcome of one adjudication attempt.
 *
 * **Details**
 *
 * Both outcomes carry the same frame set. This is not a shape split.
 *
 * **Example** (Accept both attempt outcomes)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScreenFrameAdjudicationOutcome } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * console.log(S.is(ScreenFrameAdjudicationOutcome)("committed")) // true
 * console.log(S.is(ScreenFrameAdjudicationOutcome)("no_approved_frames")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScreenFrameAdjudicationOutcome = LiteralKit(["committed", "no_approved_frames"]).pipe(
  $I.annoteSchema("ScreenFrameAdjudicationOutcome", {
    description: "Whether an adjudication attempt committed frames or approved none.",
  }),
);

/**
 * Decoded adjudication outcome.
 *
 * @see {@link ScreenFrameAdjudicationOutcome} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ScreenFrameAdjudicationOutcome = typeof ScreenFrameAdjudicationOutcome.Type;

/**
 * Judge outcome for one candidate frame.
 *
 * **Example** (Accept approval and rejection)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScreenFrameJudgementOutcome } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * console.log(S.is(ScreenFrameJudgementOutcome)("approved_clean")) // true
 * console.log(S.is(ScreenFrameJudgementOutcome)("rejected")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScreenFrameJudgementOutcome = LiteralKit(["approved_clean", "rejected"]).pipe(
  $I.annoteSchema("ScreenFrameJudgementOutcome", {
    description: "Single judge outcome for one candidate frame.",
  }),
);

/**
 * Decoded judge outcome.
 *
 * @see {@link ScreenFrameJudgementOutcome} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ScreenFrameJudgementOutcome = typeof ScreenFrameJudgementOutcome.Type;

/**
 * Why a candidate frame was rejected.
 *
 * **Gotchas**
 *
 * The vocabulary is closed, but it is not exclusive to `rejected`. The Python
 * model leaves `reject_reason` optional on both outcomes.
 *
 * **Example** (Accept a credentials rejection)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScreenFrameRejectReason } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * console.log(S.is(ScreenFrameRejectReason)("credentials")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScreenFrameRejectReason = LiteralKit([
  "credentials",
  "private_messages",
  "email",
  "banking",
  "medical",
  "identifiable_person",
  "personal_document",
  "unreadable",
  "other",
]).pipe(
  $I.annoteSchema("ScreenFrameRejectReason", {
    description: "Closed rejection vocabulary. It is optional on both judge outcomes.",
  }),
);

/**
 * Decoded rejection reason.
 *
 * @see {@link ScreenFrameRejectReason} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ScreenFrameRejectReason = typeof ScreenFrameRejectReason.Type;

/**
 * Adjudication request schema version.
 *
 * **Example** (Accept version 1)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScreenFrameSchemaVersion } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * console.log(S.is(ScreenFrameSchemaVersion)(1)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScreenFrameSchemaVersion = S.Literal(1).pipe(
  $I.annoteSchema("ScreenFrameSchemaVersion", {
    description: "Screen-frame adjudication request schema version. Only 1 is accepted.",
  }),
);

/**
 * Decoded adjudication schema version.
 *
 * @see {@link ScreenFrameSchemaVersion} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ScreenFrameSchemaVersion = typeof ScreenFrameSchemaVersion.Type;

/**
 * Conversation a candidate frame claims to illustrate.
 *
 * **Details**
 *
 * `kind` is only `conversation`. `id` is 1 to 256 characters. Unknown keys are
 * not part of the Python contract (`extra=forbid`); Effect's default decode
 * ignores them unless the caller passes `onExcessProperty: "error"`.
 *
 * **Example** (Decode a conversation subject)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ScreenFrameSubjectIn } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const subject = Effect.runSync(
 *   S.decodeUnknownEffect(ScreenFrameSubjectIn)({ kind: "conversation", id: "conv-1" }),
 * )
 * console.log(subject.id) // "conv-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScreenFrameSubjectIn extends Model<ScreenFrameSubjectIn>("ScreenFrameSubjectIn")(
  {
    kind: ScreenFrameSubjectKind.pipe(pg.text(), pg.columnName("kind")),
    id: boundedText("id", { minLength: 1, maxLength: 256 }),
  },
  $I.annote("ScreenFrameSubjectIn", {
    description: "Conversation subject named by a screen-frame adjudication request.",
  }),
  (columns) => [textBoundsCheck("id", { minLength: 1, maxLength: 256 })(columns.id)],
) {}

/**
 * Encoded frame subject before decoding.
 *
 * @see {@link ScreenFrameSubjectIn} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScreenFrameSubjectIn {
  export type Encoded = S.Codec.Encoded<typeof ScreenFrameSubjectIn>;
}

/**
 * One uploaded candidate frame.
 *
 * **Details**
 *
 * `clientFrameId` is 1 to 128 characters. Dimensions are 1 to 10000. The
 * SHA-256 transport check is a string of length 44, not a decoded digest.
 * `bytesBase64` is the uploaded payload.
 *
 * **Example** (Decode a JPEG candidate)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ScreenFrameCandidateIn } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const candidate = Effect.runSync(
 *   S.decodeUnknownEffect(ScreenFrameCandidateIn)({
 *     clientFrameId: "frame-1",
 *     capturedAt: "2020-01-02T03:04:05.000Z",
 *     mimeType: "image/jpeg",
 *     declaredWidth: 640,
 *     declaredHeight: 480,
 *     sha256Base64: "a".repeat(44),
 *     bytesBase64: "aaaa",
 *   }),
 * )
 * console.log(candidate.mimeType) // "image/jpeg"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScreenFrameCandidateIn extends Model<ScreenFrameCandidateIn>("ScreenFrameCandidateIn")(
  {
    clientFrameId: boundedText("client_frame_id", { minLength: 1, maxLength: 128 }),
    capturedAt: timestamp("captured_at"),
    mimeType: ScreenFrameMimeType.pipe(pg.text(), pg.columnName("mime_type")),
    declaredWidth: intBetween(1, 10000).pipe(pg.integer(), pg.columnName("declared_width")),
    declaredHeight: intBetween(1, 10000).pipe(pg.integer(), pg.columnName("declared_height")),
    sha256Base64: boundedText("sha256_base64", { minLength: 44, maxLength: 44 }),
    bytesBase64: text("bytes_base64"),
  },
  $I.annote("ScreenFrameCandidateIn", {
    description: "Client-uploaded candidate frame. The server, not the client, decides whether it may be stored.",
  }),
  (columns) => [
    textBoundsCheck("client_frame_id", { minLength: 1, maxLength: 128 })(columns.clientFrameId),
    betweenCheck("declared_width_range", 1, 10000)(columns.declaredWidth),
    betweenCheck("declared_height_range", 1, 10000)(columns.declaredHeight),
    textBoundsCheck("sha256_base64", { minLength: 44, maxLength: 44 })(columns.sha256Base64),
  ],
) {}

/**
 * Encoded candidate frame before decoding.
 *
 * @see {@link ScreenFrameCandidateIn} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScreenFrameCandidateIn {
  export type Encoded = S.Codec.Encoded<typeof ScreenFrameCandidateIn>;
}

/**
 * Request to judge one through eight candidate frames.
 *
 * **Details**
 *
 * `schemaVersion` is the integer literal 1. `purpose` is `meeting_note_v1`,
 * which matches {@link ScreenFrameEgressPurpose} but is not the unused
 * retention enum. `candidates` has length 1 through 8.
 *
 * **Example** (Decode a one-candidate request)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ScreenFrameAdjudicationRequest } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const request = Effect.runSync(
 *   S.decodeUnknownEffect(ScreenFrameAdjudicationRequest)({
 *     schemaVersion: 1,
 *     attemptId: "00000000-0000-4000-8000-000000000001",
 *     purpose: "meeting_note_v1",
 *     subject: { kind: "conversation", id: "conv-1" },
 *     candidates: [
 *       {
 *         clientFrameId: "frame-1",
 *         capturedAt: "2020-01-02T03:04:05.000Z",
 *         mimeType: "image/png",
 *         declaredWidth: 1,
 *         declaredHeight: 1,
 *         sha256Base64: "a".repeat(44),
 *         bytesBase64: "aaaa",
 *       },
 *     ],
 *   }),
 * )
 * console.log(request.purpose) // "meeting_note_v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScreenFrameAdjudicationRequest extends Model<ScreenFrameAdjudicationRequest>(
  "ScreenFrameAdjudicationRequest",
)(
  {
    schemaVersion: ScreenFrameSchemaVersion.pipe(pg.integer(), pg.columnName("schema_version")),
    attemptId: uuid("attempt_id"),
    purpose: ScreenFrameEgressPurpose.pipe(pg.text(), pg.columnName("purpose")),
    subject: ScreenFrameSubjectIn.pipe(pg.jsonb(), pg.columnName("subject")),
    candidates: S.Array(ScreenFrameCandidateIn)
      .check(S.isLengthBetween(1, 8))
      .pipe(pg.jsonb(), pg.columnName("candidates")),
  },
  $I.annote("ScreenFrameAdjudicationRequest", {
    description: "Request to judge one through eight candidate meeting-note frames.",
  }),
  (columns) => [jsonbLengthCheck("candidates_len", 1, 8)(columns.candidates)],
) {}

/**
 * Encoded adjudication request before decoding.
 *
 * @see {@link ScreenFrameAdjudicationRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScreenFrameAdjudicationRequest {
  export type Encoded = S.Codec.Encoded<typeof ScreenFrameAdjudicationRequest>;
}

/**
 * Change to whether meeting-note screenshots may be shared.
 *
 * **Example** (Decode an enabled update)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ScreenFrameSharingUpdateRequest } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const update = Effect.runSync(S.decodeUnknownEffect(ScreenFrameSharingUpdateRequest)({ enabled: true }))
 * console.log(update.enabled) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScreenFrameSharingUpdateRequest extends Model<ScreenFrameSharingUpdateRequest>(
  "ScreenFrameSharingUpdateRequest",
)(
  {
    enabled: bool("enabled"),
  },
  $I.annote("ScreenFrameSharingUpdateRequest", {
    description: "Request to enable or disable sharing of meeting-note screenshots.",
  }),
) {}

/**
 * Encoded sharing update before decoding.
 *
 * @see {@link ScreenFrameSharingUpdateRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScreenFrameSharingUpdateRequest {
  export type Encoded = S.Codec.Encoded<typeof ScreenFrameSharingUpdateRequest>;
}

/**
 * Account-level gate for screen-frame egress.
 *
 * **Details**
 *
 * The account-level setting gating screen-frame egress admission
 * (`setting_key="meeting_note_screenshots_enabled"`). Shared and authoritative
 * across every device — desktop, web, a reinstall — because it protects the
 * user from themselves, not third parties from the user. The privacy judge
 * protects people appearing in frames. It does not need to be tamper-proof,
 * only consistent, so it is a plain user-profile field, not a signed claim.
 *
 * **Example** (Decode the account gate)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ScreenFrameSettings } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const settings = Effect.runSync(
 *   S.decodeUnknownEffect(ScreenFrameSettings)({ meetingNoteScreenshotsEnabled: false }),
 * )
 * console.log(settings.meetingNoteScreenshotsEnabled) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScreenFrameSettings extends Model<ScreenFrameSettings>("ScreenFrameSettings")(
  {
    meetingNoteScreenshotsEnabled: bool("meeting_note_screenshots_enabled"),
  },
  $I.annote("ScreenFrameSettings", {
    description: "Account-level gate for meeting-note screenshot egress. Not a signed claim.",
  }),
) {}

/**
 * Encoded screen-frame settings before decoding.
 *
 * @see {@link ScreenFrameSettings} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScreenFrameSettings {
  export type Encoded = S.Codec.Encoded<typeof ScreenFrameSettings>;
}

/**
 * Replacement value for {@link ScreenFrameSettings}.
 *
 * **Example** (Decode a settings update)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ScreenFrameSettingsUpdateRequest } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const update = Effect.runSync(
 *   S.decodeUnknownEffect(ScreenFrameSettingsUpdateRequest)({ meetingNoteScreenshotsEnabled: true }),
 * )
 * console.log(update.meetingNoteScreenshotsEnabled) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScreenFrameSettingsUpdateRequest extends Model<ScreenFrameSettingsUpdateRequest>(
  "ScreenFrameSettingsUpdateRequest",
)(
  {
    meetingNoteScreenshotsEnabled: bool("meeting_note_screenshots_enabled"),
  },
  $I.annote("ScreenFrameSettingsUpdateRequest", {
    description: "Replacement for the account-level meeting-note screenshot gate.",
  }),
) {}

/**
 * Encoded settings update before decoding.
 *
 * @see {@link ScreenFrameSettingsUpdateRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScreenFrameSettingsUpdateRequest {
  export type Encoded = S.Codec.Encoded<typeof ScreenFrameSettingsUpdateRequest>;
}

/**
 * Normalized rectangle inside a frame.
 *
 * **Example** (Decode a focal rectangle)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { NormalizedRect } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const rect = Effect.runSync(S.decodeUnknownEffect(NormalizedRect)({ x: 0, y: 0, width: 1, height: 1 }))
 * console.log(rect.width) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NormalizedRect extends Model<NormalizedRect>("NormalizedRect")(
  {
    x: S.Finite.pipe(pg.doublePrecision(), pg.columnName("x")),
    y: S.Finite.pipe(pg.doublePrecision(), pg.columnName("y")),
    width: S.Finite.pipe(pg.doublePrecision(), pg.columnName("width")),
    height: S.Finite.pipe(pg.doublePrecision(), pg.columnName("height")),
  },
  $I.annote("NormalizedRect", {
    description: "Normalized rectangle inside a screen frame.",
  }),
) {}

/**
 * Encoded rectangle before decoding.
 *
 * @see {@link NormalizedRect} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NormalizedRect {
  export type Encoded = S.Codec.Encoded<typeof NormalizedRect>;
}

/**
 * Two gradient stops taken from the canonical JPEG.
 *
 * **Details**
 *
 * Gradient stops derived from the canonical bytes at approval time. Both
 * clients render the banner from these; neither samples pixels. A signed
 * cross-origin URL cannot be read back from a canvas, and two independent
 * extractions would drift. Extracted once, server-side, from the canonical
 * JPEG.
 *
 * **Gotchas**
 *
 * The stops are documented as `#RRGGBB`, but that comment is not a pattern
 * check. Any two strings decode.
 *
 * **Example** (Decode two stops)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ScreenFrameGround } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const ground = Effect.runSync(
 *   S.decodeUnknownEffect(ScreenFrameGround)({ stops: ["#112233", "#445566"], isNeutral: false }),
 * )
 * console.log(ground.stops.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScreenFrameGround extends Model<ScreenFrameGround>("ScreenFrameGround")(
  {
    stops: S.Array(S.String).check(S.isLengthBetween(2, 2)).pipe(pg.jsonb(), pg.columnName("stops")),
    isNeutral: bool("is_neutral"),
  },
  $I.annote("ScreenFrameGround", {
    description: "Two gradient stops extracted once from the canonical JPEG.",
  }),
  (columns) => [jsonbLengthCheck("stops_len", 2, 2)(columns.stops)],
) {}

/**
 * Encoded gradient ground before decoding.
 *
 * @see {@link ScreenFrameGround} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScreenFrameGround {
  export type Encoded = S.Codec.Encoded<typeof ScreenFrameGround>;
}

/**
 * One approved frame returned to a conversation client.
 *
 * **Details**
 *
 * `rank` is 0 through 6. `caption` is at most 160 characters on this wire
 * model. `labels` has at most 8 entries. `contentUrl` and `thumbnailUrl` are
 * signed for 60 minutes. `urlExpiresAt` is that expiry.
 *
 * **Example** (Decode a banner frame)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ConversationScreenFrame } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const frame = Effect.runSync(
 *   S.decodeUnknownEffect(ConversationScreenFrame)({
 *     id: "frame-1",
 *     capturedAt: "2020-01-02T03:04:05.000Z",
 *     role: "banner",
 *     rank: 0,
 *     caption: "Notes",
 *     labels: [],
 *     width: 640,
 *     height: 480,
 *     contentUrl: "https://example.test/frame",
 *     thumbnailUrl: "https://example.test/thumb",
 *     urlExpiresAt: "2020-01-02T04:04:05.000Z",
 *     ground: { stops: ["#000000", "#ffffff"], isNeutral: true },
 *   }),
 * )
 * console.log(frame.role) // "banner"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationScreenFrame extends Model<ConversationScreenFrame>("ConversationScreenFrame")(
  {
    id: text("id"),
    capturedAt: timestamp("captured_at"),
    role: ScreenFrameRole.pipe(pg.text(), pg.columnName("role")),
    rank: intBetween(0, 6).pipe(pg.integer(), pg.columnName("rank")),
    caption: boundedText("caption", { maxLength: 160 }),
    labels: S.Array(S.String).check(S.isMaxLength(8)).pipe(pg.jsonb(), pg.columnName("labels")),
    sourceBadge: optionalNull(ScreenFrameSourceBadge).pipe(pg.text(), pg.columnName("source_badge")),
    focalRegion: optionalNull(NormalizedRect).pipe(pg.jsonb(), pg.columnName("focal_region")),
    width: S.Int.pipe(pg.integer(), pg.columnName("width")),
    height: S.Int.pipe(pg.integer(), pg.columnName("height")),
    contentUrl: text("content_url"),
    thumbnailUrl: text("thumbnail_url"),
    urlExpiresAt: timestamp("url_expires_at"),
    ground: ScreenFrameGround.pipe(pg.jsonb(), pg.columnName("ground")),
  },
  $I.annote("ConversationScreenFrame", {
    description: "Approved screen frame with signed URLs, caption, and server-extracted gradient.",
  }),
  (columns) => [
    betweenCheck("rank_range", 0, 6)(columns.rank),
    textBoundsCheck("caption", { maxLength: 160 })(columns.caption),
    jsonbMaxCheck("labels_max", 8)(columns.labels),
  ],
) {}

/**
 * Encoded conversation frame before decoding.
 *
 * @see {@link ConversationScreenFrame} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationScreenFrame {
  export type Encoded = S.Codec.Encoded<typeof ConversationScreenFrame>;
}

const emptyStrip: ReadonlyArray<ConversationScreenFrame> = [];

/**
 * Banner and strip produced by one adjudication pass.
 *
 * **Details**
 *
 * `adjudicatedAt` is how a client knows a pass ran. `revision` stays 0 when
 * everything was rejected. A client must use `adjudicatedAt`, not `revision`,
 * to decide whether to offer candidates. `revision` only moves when something
 * was approved, so an all-rejected pass leaves it at 0 and reads as "never
 * attempted" — and the client then re-uploads the frames the judge refused.
 * Those are the sensitive ones by definition. `strip` has at most 6 frames.
 *
 * **Example** (Decode a pass that approved nothing)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ConversationScreenFrameSet } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const set = Effect.runSync(
 *   S.decodeUnknownEffect(ConversationScreenFrameSet)({
 *     revision: 0,
 *     adjudicatedAt: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(set.revision) // 0
 * console.log(O.isNone(set.banner)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationScreenFrameSet extends Model<ConversationScreenFrameSet>("ConversationScreenFrameSet")(
  {
    revision: S.Int.pipe(pg.integer(), pg.columnName("revision")),
    banner: optionalNull(ConversationScreenFrame).pipe(pg.jsonb(), pg.columnName("banner")),
    strip: S.Array(ConversationScreenFrame)
      .check(S.isMaxLength(6))
      .pipe(S.withConstructorDefault(Effect.succeed(emptyStrip)), pg.jsonb(), pg.columnName("strip")),
    adjudicatedAt: optionalTimestamp("adjudicated_at"),
  },
  $I.annote("ConversationScreenFrameSet", {
    description: "Banner and strip from the latest adjudication pass, including an all-rejected pass.",
  }),
  (columns) => [jsonbMaxCheck("strip_max", 6)(columns.strip)],
) {}

/**
 * Encoded frame set before decoding.
 *
 * @see {@link ConversationScreenFrameSet} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationScreenFrameSet {
  export type Encoded = S.Codec.Encoded<typeof ConversationScreenFrameSet>;
}

/**
 * Result of one adjudication attempt.
 *
 * **Details**
 *
 * `outcome` is uniform: both `committed` and `no_approved_frames` carry
 * `frameSet`. This is not a shape split.
 *
 * **Example** (Decode a commit)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ScreenFrameAdjudicationResponse } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const response = Effect.runSync(
 *   S.decodeUnknownEffect(ScreenFrameAdjudicationResponse)({
 *     attemptId: "00000000-0000-4000-8000-000000000001",
 *     outcome: "no_approved_frames",
 *     frameSet: { revision: 0, strip: [] },
 *   }),
 * )
 * console.log(response.outcome) // "no_approved_frames"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScreenFrameAdjudicationResponse extends Model<ScreenFrameAdjudicationResponse>(
  "ScreenFrameAdjudicationResponse",
)(
  {
    attemptId: uuid("attempt_id"),
    outcome: ScreenFrameAdjudicationOutcome.pipe(pg.text(), pg.columnName("outcome")),
    frameSet: ConversationScreenFrameSet.pipe(pg.jsonb(), pg.columnName("frame_set")),
  },
  $I.annote("ScreenFrameAdjudicationResponse", {
    description: "Adjudication attempt outcome and the frame set the client should keep.",
  }),
) {}

/**
 * Encoded adjudication response before decoding.
 *
 * @see {@link ScreenFrameAdjudicationResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScreenFrameAdjudicationResponse {
  export type Encoded = S.Codec.Encoded<typeof ScreenFrameAdjudicationResponse>;
}

/**
 * Strict judge output for one candidate frame.
 *
 * **Details**
 *
 * There is deliberately no separate decision-plus-sensitivity pair. A single
 * outcome cannot contradict itself the way two independent fields can.
 * `caption` is truncated to 160 code points before the string is accepted.
 * `labels` are capped at 8 when they are already strings. `bannerSuitability`
 * is 0 through 1.
 *
 * **Gotchas**
 *
 * `rejectReason` stays optional on both `approved_clean` and `rejected`. No
 * validator ties the reason to the outcome. Caption and labels are not
 * max-constrained as field checks: a strict max would drop an approved frame
 * when the judge overruns the cosmetic limit. The wire model
 * {@link ConversationScreenFrame} keeps the real length contract. A non-string
 * inside the first eight labels still fails. A non-string only after index 8
 * also fails, because the list is parsed as strings before the cap; Python
 * sliced first.
 *
 * **Example** (Truncate a long caption)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ScreenFrameJudgement } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const judgement = Effect.runSync(
 *   S.decodeUnknownEffect(ScreenFrameJudgement)({
 *     outcome: "approved_clean",
 *     caption: "a".repeat(161),
 *     labels: ["one"],
 *     bannerSuitability: 1,
 *   }),
 * )
 * console.log(judgement.caption.length) // 160
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScreenFrameJudgement extends Model<ScreenFrameJudgement>("ScreenFrameJudgement")(
  {
    outcome: ScreenFrameJudgementOutcome.pipe(pg.text(), pg.columnName("outcome")),
    rejectReason: optionalNull(ScreenFrameRejectReason).pipe(pg.text(), pg.columnName("reject_reason")),
    caption: truncatedCaption.pipe(pg.text(), pg.columnName("caption")),
    labels: cappedStringList.pipe(pg.jsonb(), pg.columnName("labels")),
    sourceBadge: optionalNull(ScreenFrameSourceBadge).pipe(pg.text(), pg.columnName("source_badge")),
    bannerSuitability: confidence("banner_suitability"),
  },
  $I.annote("ScreenFrameJudgement", {
    description: "Judge output for one candidate frame. One outcome, no separate sensitivity field.",
  }),
  (columns) => [unitIntervalCheck("banner_suitability")(columns.bannerSuitability)],
) {}

/**
 * Encoded judge output before decoding.
 *
 * @see {@link ScreenFrameJudgement} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScreenFrameJudgement {
  export type Encoded = S.Codec.Encoded<typeof ScreenFrameJudgement>;
}

/**
 * Internal approval that authorizes a bucket write.
 *
 * **Details**
 *
 * This never appears in a response model and is never sent to a client. `jti`
 * is one-use. `decision` is only `approved_clean`; rejected frames never get a
 * claim. `expiresAt` is commented as at most 10 minutes and that bound is not
 * enforced here.
 *
 * **Gotchas**
 *
 * `purpose`, `retention`, and `policyVersion` are open strings. The egress and
 * retention enums exist and are not the types of these fields. `purpose` on
 * {@link ScreenFrameAdjudicationRequest} is the closed literal
 * `meeting_note_v1`; this claim does not reuse that literal. The device or
 * subject id is provenance, not an input that this model hashes.
 *
 * **Example** (Decode an approval)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ScreenFrameApprovalClaims } from "@beep/scratchpad/beep/ScreenFrame"
 *
 * const claims = Effect.runSync(
 *   S.decodeUnknownEffect(ScreenFrameApprovalClaims)({
 *     iss: "omi-screen-frame-adjudicator",
 *     aud: "omi-screen-frame-writer",
 *     jti: "00000000-0000-4000-8000-000000000001",
 *     uid: "user-1",
 *     purpose: "meeting_note_v1",
 *     subjectKind: "conversation",
 *     subjectId: "conv-1",
 *     canonicalSha256: "abc",
 *     model: "judge",
 *     policyVersion: "p1",
 *     promptVersion: "prompt-1",
 *     retention: "with_subject",
 *     decision: "approved_clean",
 *     labelsDigest: "digest",
 *     issuedAt: "2020-01-02T03:04:05.000Z",
 *     expiresAt: "2020-01-02T03:14:05.000Z",
 *   }),
 * )
 * console.log(claims.decision) // "approved_clean"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScreenFrameApprovalClaims extends Model<ScreenFrameApprovalClaims>("ScreenFrameApprovalClaims")(
  {
    iss: S.Literal("omi-screen-frame-adjudicator").pipe(pg.text(), pg.columnName("iss")),
    aud: S.Literal("omi-screen-frame-writer").pipe(pg.text(), pg.columnName("aud")),
    jti: uuid("jti"),
    uid: text("uid"),
    purpose: text("purpose"),
    subjectKind: ScreenFrameSubjectKind.pipe(pg.text(), pg.columnName("subject_kind")),
    subjectId: text("subject_id"),
    canonicalSha256: text("canonical_sha256"),
    model: text("model"),
    policyVersion: text("policy_version"),
    promptVersion: text("prompt_version"),
    retention: text("retention"),
    decision: S.Literal("approved_clean").pipe(pg.text(), pg.columnName("decision")),
    labelsDigest: text("labels_digest"),
    issuedAt: timestamp("issued_at"),
    expiresAt: timestamp("expires_at"),
  },
  $I.annote("ScreenFrameApprovalClaims", {
    description: "Internal one-use approval. Never serialized into a client response.",
  }),
) {}

/**
 * Encoded approval claims before decoding.
 *
 * @see {@link ScreenFrameApprovalClaims} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScreenFrameApprovalClaims {
  export type Encoded = S.Codec.Encoded<typeof ScreenFrameApprovalClaims>;
}
