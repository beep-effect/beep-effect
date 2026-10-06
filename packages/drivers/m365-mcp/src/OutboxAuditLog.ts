/**
 * Local audit log of the Microsoft 365 outbox server.
 *
 * **Details**
 *
 * The log is append-only JSON Lines, one file per month, in a directory on
 * the workstation. A send writes a `send-intent` record that is flushed to
 * disk before the Graph call, then a `send-outcome` record with the same
 * audit id. Records hold recipients, subjects, attachment names, sizes and
 * digests; they never hold a message body or attachment bytes. The log is
 * never committed and never leaves the workstation.
 *
 * @category services
 * @since 0.1.0
 */

import { $M365McpId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Context, Crypto, DateTime, Effect, FileSystem, Layer, Order, Path, pipe, Semaphore } from "effect";
import * as A from "effect/Array";
import * as Hex from "effect/encoding/Hex";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { emptyByDefault } from "./internal/OutboxFields.ts";
import { OutboxAttachmentDigest } from "./OutboxAttachmentSource.ts";
import { OutboxSendMismatchField } from "./OutboxSendGuard.ts";

const $I = $M365McpId.create("OutboxAuditLog");

const AUDIT_DIRECTORY_MODE = 0o700;
const AUDIT_FILE_MODE = 0o600;
const AUDIT_FILE_SUFFIX = ".jsonl";
const AUDIT_ID_BYTES = 16;
const MONTH_PREFIX_LENGTH = 7;

const textEncoder = new TextEncoder();

/**
 * How a send ended.
 *
 * **Details**
 *
 * `sent`: Graph accepted the send. `refused`: nothing was sent, because the
 * guard found a mismatch or Graph rejected the request. `unknown`: the send
 * request may or may not have reached Graph.
 *
 * **Example** (Guard a send outcome)
 *
 * ```ts
 * import { OutboxSendOutcome } from "@beep/m365-mcp/OutboxAuditLog"
 *
 * console.log(OutboxSendOutcome.is.unknown("unknown"))
 * // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const OutboxSendOutcome = LiteralKit(["sent", "refused", "unknown"]).pipe(
  $I.annoteSchema("OutboxSendOutcome", { description: "How a send through the outbox ended." })
);

/**
 * Type for {@link OutboxSendOutcome}.
 *
 * **Example** (Type a send outcome)
 *
 * ```ts
 * import type { OutboxSendOutcome } from "@beep/m365-mcp/OutboxAuditLog"
 *
 * const outcome: OutboxSendOutcome = "sent"
 * console.log(outcome)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type OutboxSendOutcome = typeof OutboxSendOutcome.Type;

const stamp = {
  at: S.DateTimeUtcFromString.annotateKey({ description: "When the record was written (UTC, ISO-8601)." }),
  auditId: S.NonEmptyString.annotateKey({ description: "Audit id; a send's intent and outcome share one." }),
  version: S.tag(1).annotateKey({ description: "Record schema version." }),
};

const addresses = (description: string) => S.Array(S.String).annotateKey({ description });

/**
 * Audit record of a draft the server created.
 *
 * **Details**
 *
 * Its existence is what lets `delete_draft` delete the draft later. The
 * attachment digests are a record of what was attached; the send guard does
 * not read them, it hashes the stored bytes.
 *
 * **Example** (Record a created draft)
 *
 * ```ts
 * import { OutboxDraftCreatedRecord } from "@beep/m365-mcp/OutboxAuditLog"
 * import { DateTime } from "effect"
 *
 * const record = OutboxDraftCreatedRecord.make({
 *   at: DateTime.makeUnsafe("2030-01-15T00:00:00Z"),
 *   attachments: [],
 *   auditId: "audit-1",
 *   bcc: [],
 *   cc: [],
 *   draftId: "message-id",
 *   subject: "Filing receipt",
 *   to: ["counsel@example.test"]
 * })
 * console.log(record._tag)
 * // "draft-created"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxDraftCreatedRecord extends S.TaggedClass<OutboxDraftCreatedRecord>($I`OutboxDraftCreatedRecord`)(
  "draft-created",
  {
    ...stamp,
    attachments: S.Array(OutboxAttachmentDigest).annotateKey({ description: "Files the server attached." }),
    bcc: addresses("Blind-carbon-copy addresses."),
    cc: addresses("Carbon-copy addresses."),
    draftId: S.NonEmptyString.annotateKey({ description: "Graph id of the draft." }),
    subject: S.String.annotateKey({ description: "Draft subject." }),
    to: addresses("Primary recipient addresses."),
  },
  $I.annote("OutboxDraftCreatedRecord", { description: "Audit record of a draft the outbox server created." })
) {}

/**
 * Audit record of a draft the server deleted.
 *
 * **Example** (Record a deleted draft)
 *
 * ```ts
 * import { OutboxDraftDeletedRecord } from "@beep/m365-mcp/OutboxAuditLog"
 * import { DateTime } from "effect"
 *
 * const record = OutboxDraftDeletedRecord.make({
 *   at: DateTime.makeUnsafe("2030-01-15T00:00:00Z"),
 *   auditId: "audit-2",
 *   draftId: "message-id"
 * })
 * console.log(record._tag)
 * // "draft-deleted"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxDraftDeletedRecord extends S.TaggedClass<OutboxDraftDeletedRecord>($I`OutboxDraftDeletedRecord`)(
  "draft-deleted",
  {
    ...stamp,
    draftId: S.NonEmptyString.annotateKey({ description: "Graph id of the draft." }),
  },
  $I.annote("OutboxDraftDeletedRecord", { description: "Audit record of a draft the outbox server deleted." })
) {}

/**
 * Audit record written and flushed before a send reaches Graph.
 *
 * **Example** (Record a send intent)
 *
 * ```ts
 * import { OutboxSendIntentRecord } from "@beep/m365-mcp/OutboxAuditLog"
 * import { DateTime } from "effect"
 *
 * const record = OutboxSendIntentRecord.make({
 *   at: DateTime.makeUnsafe("2030-01-15T00:00:00Z"),
 *   attachments: [],
 *   auditId: "audit-3",
 *   bcc: [],
 *   cc: [],
 *   draftId: "message-id",
 *   subject: "Filing receipt",
 *   to: ["counsel@example.test"]
 * })
 * console.log(record._tag)
 * // "send-intent"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxSendIntentRecord extends S.TaggedClass<OutboxSendIntentRecord>($I`OutboxSendIntentRecord`)(
  "send-intent",
  {
    ...stamp,
    attachments: S.Array(OutboxAttachmentDigest).annotateKey({
      description: "Attachments of the draft about to be sent: name, byte length and digest of the stored bytes.",
    }),
    bcc: addresses("Blind-carbon-copy addresses."),
    cc: addresses("Carbon-copy addresses."),
    draftId: S.NonEmptyString.annotateKey({ description: "Graph id of the draft." }),
    subject: S.String.annotateKey({ description: "Subject of the draft about to be sent." }),
    to: addresses("Primary recipient addresses."),
  },
  $I.annote("OutboxSendIntentRecord", {
    description: "Audit record written before the outbox server asks Graph to send a draft.",
  })
) {}

/**
 * Audit record of how a send ended.
 *
 * **Example** (Record a refused send)
 *
 * ```ts
 * import { OutboxSendOutcomeRecord } from "@beep/m365-mcp/OutboxAuditLog"
 * import { DateTime } from "effect"
 *
 * const record = OutboxSendOutcomeRecord.make({
 *   at: DateTime.makeUnsafe("2030-01-15T00:00:00Z"),
 *   auditId: "audit-4",
 *   draftId: "message-id",
 *   mismatches: ["subject"],
 *   outcome: "refused"
 * })
 * console.log(record.outcome)
 * // "refused"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxSendOutcomeRecord extends S.TaggedClass<OutboxSendOutcomeRecord>($I`OutboxSendOutcomeRecord`)(
  "send-outcome",
  {
    ...stamp,
    draftId: S.NonEmptyString.annotateKey({ description: "Graph id of the draft." }),
    graphStatus: S.OptionFromOptionalKey(S.Int)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "HTTP status of a Graph rejection, when Graph answered." }),
    internetMessageId: S.OptionFromOptionalKey(S.String)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "RFC 2822 message id of the sent message, when known." }),
    mismatches: emptyByDefault(OutboxSendMismatchField, "Fields the guard found different; empty unless it refused."),
    outcome: OutboxSendOutcome.annotateKey({ description: "How the send ended." }),
  },
  $I.annote("OutboxSendOutcomeRecord", { description: "Audit record of how a send through the outbox ended." })
) {}

/**
 * Audit record of a calendar event the server created.
 *
 * **Example** (Record a created event)
 *
 * ```ts
 * import { OutboxEventCreatedRecord } from "@beep/m365-mcp/OutboxAuditLog"
 * import { DateTime } from "effect"
 *
 * const record = OutboxEventCreatedRecord.make({
 *   at: DateTime.makeUnsafe("2030-01-15T00:00:00Z"),
 *   auditId: "audit-5",
 *   eventId: "event-id",
 *   subject: "Response due"
 * })
 * console.log(record._tag)
 * // "event-created"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxEventCreatedRecord extends S.TaggedClass<OutboxEventCreatedRecord>($I`OutboxEventCreatedRecord`)(
  "event-created",
  {
    ...stamp,
    eventId: S.NonEmptyString.annotateKey({ description: "Graph id of the event." }),
    subject: S.String.annotateKey({ description: "Event subject." }),
  },
  $I.annote("OutboxEventCreatedRecord", { description: "Audit record of an event the outbox server created." })
) {}

/**
 * Audit record of a calendar event the server updated.
 *
 * **Example** (Record an updated event)
 *
 * ```ts
 * import { OutboxEventUpdatedRecord } from "@beep/m365-mcp/OutboxAuditLog"
 * import { DateTime } from "effect"
 *
 * const record = OutboxEventUpdatedRecord.make({
 *   at: DateTime.makeUnsafe("2030-01-15T00:00:00Z"),
 *   auditId: "audit-6",
 *   eventId: "event-id"
 * })
 * console.log(record._tag)
 * // "event-updated"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxEventUpdatedRecord extends S.TaggedClass<OutboxEventUpdatedRecord>($I`OutboxEventUpdatedRecord`)(
  "event-updated",
  {
    ...stamp,
    eventId: S.NonEmptyString.annotateKey({ description: "Graph id of the event." }),
    subject: S.OptionFromOptionalKey(S.String)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "New subject, when the update changed it." }),
  },
  $I.annote("OutboxEventUpdatedRecord", { description: "Audit record of an event the outbox server updated." })
) {}

/**
 * One line of the outbox audit log.
 *
 * **Example** (Match a record by tag)
 *
 * ```ts
 * import { OutboxAuditRecord, OutboxDraftDeletedRecord } from "@beep/m365-mcp/OutboxAuditLog"
 * import { DateTime } from "effect"
 *
 * const record = OutboxDraftDeletedRecord.make({
 *   at: DateTime.makeUnsafe("2030-01-15T00:00:00Z"),
 *   auditId: "audit-2",
 *   draftId: "message-id"
 * })
 * console.log(OutboxAuditRecord.guards["draft-deleted"](record))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.1.0
 */
export const OutboxAuditRecord = S.Union([
  OutboxDraftCreatedRecord,
  OutboxDraftDeletedRecord,
  OutboxSendIntentRecord,
  OutboxSendOutcomeRecord,
  OutboxEventCreatedRecord,
  OutboxEventUpdatedRecord,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("OutboxAuditRecord", { description: "One versioned line of the outbox audit log." })
);

/**
 * Type for {@link OutboxAuditRecord}.
 *
 * **Example** (Read a record's tag)
 *
 * ```ts
 * import type { OutboxAuditRecord } from "@beep/m365-mcp/OutboxAuditLog"
 *
 * const tag = (record: OutboxAuditRecord) => record._tag
 * console.log(tag)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type OutboxAuditRecord = typeof OutboxAuditRecord.Type;

/**
 * Which audit log step failed.
 *
 * **Example** (Guard an audit failure reason)
 *
 * ```ts
 * import { OutboxAuditErrorReason } from "@beep/m365-mcp/OutboxAuditLog"
 *
 * console.log(OutboxAuditErrorReason.is.append("append"))
 * // true
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export const OutboxAuditErrorReason = LiteralKit(["directory", "append", "read"]).pipe(
  $I.annoteSchema("OutboxAuditErrorReason", { description: "Which outbox audit log step failed." })
);

/**
 * Type for {@link OutboxAuditErrorReason}.
 *
 * **Example** (Type an audit failure reason)
 *
 * ```ts
 * import type { OutboxAuditErrorReason } from "@beep/m365-mcp/OutboxAuditLog"
 *
 * const reason: OutboxAuditErrorReason = "append"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export type OutboxAuditErrorReason = typeof OutboxAuditErrorReason.Type;

/**
 * Typed failure of the outbox audit log.
 *
 * **Example** (Construct an audit failure)
 *
 * ```ts
 * import { OutboxAuditError } from "@beep/m365-mcp/OutboxAuditLog"
 *
 * const error = OutboxAuditError.make({ message: "The audit record could not be appended.", reason: "append" })
 * console.log(error.reason)
 * // "append"
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export class OutboxAuditError extends S.TaggedError<OutboxAuditError>($I`OutboxAuditError`)(
  "OutboxAuditError",
  {
    message: S.String.annotateKey({ description: "Human-readable failure; never record content." }),
    reason: OutboxAuditErrorReason.annotateKey({ description: "Which step failed." }),
  },
  $I.annoteError<OutboxAuditError>("OutboxAuditError", {
    description: "Typed failure of the outbox audit log.",
  })
) {}

/**
 * Audit id generator service shape.
 *
 * **Example** (Name the generator method)
 *
 * ```ts
 * import type { OutboxAuditIdsShape } from "@beep/m365-mcp/OutboxAuditLog"
 *
 * const method: keyof OutboxAuditIdsShape = "next"
 * console.log(method)
 * ```
 *
 * @category services
 * @since 0.1.0
 */
export type OutboxAuditIdsShape = {
  readonly next: Effect.Effect<string>;
};

/**
 * Generates audit ids. Injectable so tests are deterministic.
 *
 * **Example** (Provide fixed audit ids)
 *
 * ```ts
 * import { OutboxAuditIds } from "@beep/m365-mcp/OutboxAuditLog"
 * import { Effect, Layer } from "effect"
 *
 * const layer = Layer.succeed(OutboxAuditIds, OutboxAuditIds.of({ next: Effect.succeed("audit-1") }))
 * console.log(Layer.isLayer(layer))
 * // true
 * ```
 *
 * @category services
 * @since 0.1.0
 */
export class OutboxAuditIds extends Context.Service<OutboxAuditIds, OutboxAuditIdsShape>()($I`OutboxAuditIds`) {
  /**
   * Random 128-bit audit ids, hex encoded.
   *
   * **Example** (Use random audit ids)
   *
   * ```ts
   * import { OutboxAuditIds } from "@beep/m365-mcp/OutboxAuditLog"
   * import { Layer } from "effect"
   *
   * console.log(Layer.isLayer(OutboxAuditIds.layer))
   * // true
   * ```
   *
   * @category layers
   * @since 0.1.0
   */
  static readonly layer: Layer.Layer<OutboxAuditIds, never, Crypto.Crypto> = Layer.effect(
    OutboxAuditIds,
    Effect.gen(function* () {
      const crypto = yield* Crypto.Crypto;
      return OutboxAuditIds.of({
        next: crypto.randomBytes(AUDIT_ID_BYTES).pipe(Effect.map(Hex.encode), Effect.orDie),
      });
    })
  );
}

/**
 * Outbox audit log service shape.
 *
 * **Example** (Name an audit log method)
 *
 * ```ts
 * import type { OutboxAuditLogShape } from "@beep/m365-mcp/OutboxAuditLog"
 *
 * const method: keyof OutboxAuditLogShape = "append"
 * console.log(method)
 * ```
 *
 * @category services
 * @since 0.1.0
 */
export type OutboxAuditLogShape = {
  readonly append: (record: OutboxAuditRecord) => Effect.Effect<void, OutboxAuditError>;
  readonly hasCreatedDraft: (draftId: string) => Effect.Effect<boolean, OutboxAuditError>;
  readonly nextAuditId: Effect.Effect<string>;
};

const AuditLine = S.fromJsonString(OutboxAuditRecord);
const encodeLine = S.encodeEffect(AuditLine);
const decodeLine = S.decodeUnknownOption(AuditLine);
const isDraftCreated = S.is(OutboxDraftCreatedRecord);

const failure = (reason: OutboxAuditErrorReason, message: string) => (): OutboxAuditError =>
  OutboxAuditError.make({ message, reason });

/**
 * File name of the monthly audit log that holds a record.
 *
 * **Example** (Name the file for a record)
 *
 * ```ts
 * import { OutboxDraftDeletedRecord, outboxAuditFileName } from "@beep/m365-mcp/OutboxAuditLog"
 * import { DateTime } from "effect"
 *
 * const record = OutboxDraftDeletedRecord.make({
 *   at: DateTime.makeUnsafe("2030-01-15T00:00:00Z"),
 *   auditId: "audit-2",
 *   draftId: "message-id"
 * })
 * console.log(outboxAuditFileName(record))
 * // "2030-01.jsonl"
 * ```
 *
 * @category formatting
 * @since 0.1.0
 */
export const outboxAuditFileName = (record: OutboxAuditRecord): string =>
  `${Str.slice(0, MONTH_PREFIX_LENGTH)(DateTime.formatIso(record.at))}${AUDIT_FILE_SUFFIX}`;

const makeLog = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ids = yield* OutboxAuditIds;
  const gate = yield* Semaphore.make(1);

  yield* fs
    .makeDirectory(directory, { mode: AUDIT_DIRECTORY_MODE, recursive: true })
    .pipe(Effect.mapError(failure("directory", "The audit log directory could not be created.")));

  const appendLine = Effect.fnUntraced(function* (fileName: string, line: string) {
    const file = yield* fs.open(path.join(directory, fileName), { flag: "a", mode: AUDIT_FILE_MODE });
    yield* file.writeAll(textEncoder.encode(`${line}\n`));
    // The record must be on disk before the caller acts on it.
    yield* file.sync;
  }, Effect.scoped);

  const readRecords = Effect.fnUntraced(function* () {
    const names = yield* fs.readDirectory(directory);
    const texts = yield* Effect.forEach(
      pipe(A.filter(names, Str.endsWith(AUDIT_FILE_SUFFIX)), A.sort(Order.String)),
      (name) => fs.readFileString(path.join(directory, name))
    );
    // A torn last line after a crash is skipped rather than blocking every later send.
    return pipe(
      texts,
      A.flatMap(Str.split("\n")),
      A.filter(Str.isNonEmpty),
      A.map((line) => decodeLine(line)),
      A.getSomes
    );
  });

  return OutboxAuditLog.of({
    append: Effect.fn("OutboxAuditLog.append")(function* (record) {
      yield* Effect.annotateCurrentSpan({ m365_outbox_audit_record: record._tag });
      const line = yield* encodeLine(record).pipe(
        Effect.mapError(failure("append", "The audit record could not be encoded."))
      );
      yield* gate
        .withPermits(1)(appendLine(outboxAuditFileName(record), line))
        .pipe(Effect.mapError(failure("append", "The audit record could not be appended.")));
    }),
    hasCreatedDraft: Effect.fn("OutboxAuditLog.hasCreatedDraft")(function* (draftId) {
      const records = yield* readRecords().pipe(Effect.mapError(failure("read", "The audit log could not be read.")));
      return A.some(records, (record) => isDraftCreated(record) && record.draftId === draftId);
    }),
    nextAuditId: ids.next,
  });
});

/**
 * Append-only audit log of the outbox server.
 *
 * **Example** (Build the audit log layer)
 *
 * ```ts
 * import { OutboxAuditLog } from "@beep/m365-mcp/OutboxAuditLog"
 * import { Layer } from "effect"
 *
 * const layer = OutboxAuditLog.layer("/var/lib/outbox/audit")
 * console.log(Layer.isLayer(layer))
 * // true
 * ```
 *
 * @category services
 * @since 0.1.0
 */
export class OutboxAuditLog extends Context.Service<OutboxAuditLog, OutboxAuditLogShape>()($I`OutboxAuditLog`) {
  /**
   * Build the audit log over a directory.
   *
   * **Details**
   *
   * The directory is created with mode 0700 when the layer is built, and the
   * layer fails when it cannot be. Each append opens the month's file in
   * append mode, writes one line and flushes it to disk before it returns.
   * Appends are serialized.
   *
   * **Example** (Build the layer over a directory)
   *
   * ```ts
   * import { OutboxAuditLog } from "@beep/m365-mcp/OutboxAuditLog"
   * import { Layer } from "effect"
   *
   * const layer = OutboxAuditLog.layer("/var/lib/outbox/audit")
   * console.log(Layer.isLayer(layer))
   * // true
   * ```
   *
   * @category layers
   * @since 0.1.0
   */
  static readonly layer = (
    directory: string
  ): Layer.Layer<OutboxAuditLog, OutboxAuditError, FileSystem.FileSystem | Path.Path | OutboxAuditIds> =>
    Layer.effect(OutboxAuditLog, makeLog(directory));
}
