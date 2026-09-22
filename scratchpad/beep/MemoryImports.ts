/**
 * Memory import runs, batches, and artifacts.
 *
 * Blank optional strings become absent. A batch item still needs an external
 * id, a content hash, or some text. Import datetimes may be naive; they are
 * read as UTC.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Predicate from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";
import { Model, NonNegativeInt, Table, UtcTimestamp, nonNegativeIntCheck, optionalNull, pg } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/MemoryImports");

const described = <A extends S.Top>(schema: A, description: string) => schema.annotateKey({ description });

const stringOrder = Order.make<string>((self, that) => {
  if (self < that) return -1;
  if (that < self) return 1;
  return 0;
});

const strippedRequired = S.String.pipe(
  S.decodeTo(S.String.check(S.isMinLength(1)), {
    decode: SchemaGetter.transform((value: string) => Str.trim(value)),
    encode: SchemaGetter.transform((value: string) => value),
  }),
);

const strippedOptional = (column: string, description: string) =>
  described(
    S.String.pipe(
      S.NullOr,
      S.optionalKey,
      S.decodeTo(S.Option(S.String), {
        decode: SchemaGetter.transformOptional((present) =>
          present.pipe(
            O.flatMap((value) => {
              if (Predicate.isNull(value)) return O.none();
              const stripped = Str.trim(value);
              return Str.isEmpty(stripped) ? O.none() : O.some(stripped);
            }),
            O.some,
          ),
        ),
        encode: SchemaGetter.transformOptional((present) =>
          present.pipe(
            O.flatten,
            O.match({
              onNone: () => null,
              onSome: (value) => value,
            }),
            O.some,
          ),
        ),
      }),
      SchemaUtils.withNoneDefault,
    ),
    description,
  ).pipe(pg.text(), pg.columnName(column));

const jsonDefault = (column: string) =>
  S.JsonObject.pipe(S.withConstructorDefault(Effect.succeed({})), pg.jsonb(), pg.columnName(column));

const count = (column: string) =>
  NonNegativeInt.pipe(S.withConstructorDefault(Effect.succeed(0)), pg.integer(), pg.columnName(column));

const optionalInstant = (column: string) =>
  optionalNull(UtcTimestamp).pipe(
    pg.timestamp({ mode: "string", withTimezone: true }),
    pg.columnName(column),
  );

const requiredInstant = (column: string) =>
  UtcTimestamp.pipe(pg.timestamp({ mode: "string", withTimezone: true }), pg.columnName(column));

/**
 * Lifecycle of one import run.
 *
 * **Example** (Decode a received run)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryImportRunStatus } from "@beep/scratchpad/beep/MemoryImports.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemoryImportRunStatus)("received"))
 * console.log(decoded) // "received"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryImportRunStatus = LiteralKit(["received", "extracting", "completed", "failed", "cancelled"]).pipe(
  $I.annoteSchema("MemoryImportRunStatus", {
    description: "Import run status. Cancelled keeps the British spelling.",
  }),
);

/**
 * Decoded import run status.
 *
 * @see {@link MemoryImportRunStatus} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryImportRunStatus = typeof MemoryImportRunStatus.Type;

/**
 * Whether an imported artifact is still present at the source.
 *
 * **Details**
 *
 * This is a third source-state vocabulary. It is not evidence `SourceState`
 * and it has no `missing` member.
 *
 * **Example** (Decode a tombstoned artifact)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryImportArtifactSourceState } from "@beep/scratchpad/beep/MemoryImports.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemoryImportArtifactSourceState)("tombstoned"))
 * console.log(decoded) // "tombstoned"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryImportArtifactSourceState = LiteralKit(["active", "tombstoned", "purged"]).pipe(
  $I.annoteSchema("MemoryImportArtifactSourceState", {
    description: "Import artifact source state. Distinct from evidence SourceState.",
  }),
);

/**
 * Decoded import artifact source state.
 *
 * @see {@link MemoryImportArtifactSourceState} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryImportArtifactSourceState = typeof MemoryImportArtifactSourceState.Type;

/**
 * One caller-supplied import item.
 *
 * **Details**
 *
 * Optional strings are stripped. A blank string becomes absent. The item must
 * still carry `externalId`, `contentHash`, or at least one of `content`,
 * `snippet`, and `title`.
 *
 * **Gotchas**
 *
 * Datetimes are not checked for an offset. A naive timestamp is read as UTC.
 * `metadata` defaults to an empty object and is not stripped.
 *
 * **Example** (Turn a blank title into an absent title)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { MemoryImportBatchItem } from "@beep/scratchpad/beep/MemoryImports.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(MemoryImportBatchItem)({ externalId: "ext-1", title: "  " }),
 * )
 * console.log(O.isNone(decoded.title)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryImportBatchItem extends Model<MemoryImportBatchItem>("MemoryImportBatchItem")(
  {
    externalId: strippedOptional("external_id", "Caller external id. Blank becomes absent."),
    occurredAt: optionalInstant("occurred_at"),
    title: strippedOptional("title", "Optional title. Blank becomes absent."),
    snippet: strippedOptional("snippet", "Optional snippet. Blank becomes absent."),
    content: strippedOptional("content", "Optional body. Blank becomes absent."),
    contentHash: strippedOptional("content_hash", "Optional content hash. Blank becomes absent."),
    metadata: jsonDefault("metadata"),
    clientDeviceId: strippedOptional("client_device_id", "Optional capture device. Blank becomes absent."),
  },
  $I.annote("MemoryImportBatchItem", {
    description: "One import item. Needs an external id, a content hash, or text.",
  }),
) {}

/**
 * Encoded form of {@link MemoryImportBatchItem}.
 *
 * @see {@link MemoryImportBatchItem} for the identity rule.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryImportBatchItem {
  export type Encoded = S.Codec.Encoded<typeof MemoryImportBatchItem>;
}

/**
 * Report whether an import item has an identity or some text.
 *
 * **Example** (Reject an empty item)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { MemoryImportBatchItem, importItemHasIdentity } from "@beep/scratchpad/beep/MemoryImports.ts"
 *
 * const item = MemoryImportBatchItem.make({ title: O.none() })
 * console.log(importItemHasIdentity(item)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const importItemHasIdentity = (item: MemoryImportBatchItem): boolean =>
  O.isSome(item.externalId) ||
  O.isSome(item.contentHash) ||
  O.isSome(item.content) ||
  O.isSome(item.snippet) ||
  O.isSome(item.title);

/**
 * {@link MemoryImportBatchItem} decoder that requires identity or text.
 *
 * **Example** (Accept an external id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CheckedMemoryImportBatchItem } from "@beep/scratchpad/beep/MemoryImports.ts"
 *
 * import * as O from "effect/Option"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(CheckedMemoryImportBatchItem)({ externalId: "ext-1" }))
 * console.log(O.isSome(decoded.externalId)) // true
 * ```
 *
 * @see {@link importItemHasIdentity} for the predicate.
 * @category schemas
 * @since 0.0.0
 */
export const CheckedMemoryImportBatchItem = MemoryImportBatchItem.check(
  S.makeFilter(importItemHasIdentity, {
    identifier: "ImportItemIdentity",
    title: "Import item identity",
    message: "import artifact requires external_id, content_hash, or textual content",
  }),
);

/**
 * Decoded import item that has identity or text.
 *
 * @see {@link CheckedMemoryImportBatchItem} for the checked decoder.
 * @category type-level
 * @since 0.0.0
 */
export type CheckedMemoryImportBatchItem = typeof CheckedMemoryImportBatchItem.Type;

const received = "received";
const v1 = "v1";

/**
 * A caller batch of import items.
 *
 * **Details**
 *
 * `items` holds at most 100 entries. `sourceType` and `importerVersion` are
 * stripped, and a blank string is rejected. Optional ids are stripped to
 * absent.
 *
 * **Example** (Reject a blank source type)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryImportBatchRequest } from "@beep/scratchpad/beep/MemoryImports.ts"
 *
 * const exit = Effect.runSyncExit(S.decodeUnknownEffect(MemoryImportBatchRequest)({ sourceType: "  " }))
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryImportBatchRequest extends Model<MemoryImportBatchRequest>("MemoryImportBatchRequest")(
  {
    sourceType: described(strippedRequired, "Import source type. Blank is rejected.").pipe(
      pg.text(),
      pg.columnName("source_type"),
    ),
    importRunId: strippedOptional("import_run_id", "Existing run id, when the caller is appending."),
    sourceAccountHash: strippedOptional("source_account_hash", "Source account hash, when the caller has one."),
    importerVersion: described(strippedRequired, "Importer version. Defaults to v1.").pipe(
      S.withConstructorDefault(Effect.succeed(v1)),
      pg.text(),
      pg.columnName("importer_version"),
    ),
    extractorVersion: strippedOptional("extractor_version", "Extractor version, when the caller has one."),
    items: S.Array(MemoryImportBatchItem)
      .check(S.isMaxLength(100))
      .pipe(S.withConstructorDefault(Effect.succeed([])), pg.jsonb(), pg.columnName("items")),
  },
  $I.annote("MemoryImportBatchRequest", {
    description: "One import batch request. At most 100 items.",
  }),
  (columns) => [Table.check("items_max_len")(sql<boolean>`jsonb_array_length(${columns.items}) <= ${sql.raw("100")}`)],
) {}

/**
 * Encoded form of {@link MemoryImportBatchRequest}.
 *
 * @see {@link MemoryImportBatchRequest} for the item cap.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryImportBatchRequest {
  export type Encoded = S.Codec.Encoded<typeof MemoryImportBatchRequest>;
}

/**
 * Persisted import run counters.
 *
 * **Details**
 *
 * Counters start at zero and cannot be negative. `status` starts at `received`.
 * `completedAt` and `lastError` may be absent. Timestamps may be naive and are
 * read as UTC.
 *
 * **Example** (Default the counters to zero)
 *
 * ```ts
 * import { MemoryImportRun } from "@beep/scratchpad/beep/MemoryImports.ts"
 * import * as DateTime from "effect/DateTime"
 *
 * const now = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const run = MemoryImportRun.make({
 *   runId: "run-1",
 *   uid: "user-1",
 *   sourceType: "chat",
 *   importerVersion: "v1",
 *   startedAt: now,
 *   updatedAt: now,
 * })
 * console.log(run.artifactCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryImportRun extends Model<MemoryImportRun>("MemoryImportRun")(
  {
    runId: described(S.String, "Import run id.").pipe(pg.text(), pg.columnName("run_id")),
    uid: described(S.String, "Owning user id.").pipe(pg.text(), pg.columnName("uid")),
    sourceType: described(S.String, "Import source type.").pipe(pg.text(), pg.columnName("source_type")),
    sourceAccountHash: optionalNull(S.String).pipe(pg.text(), pg.columnName("source_account_hash")),
    importerVersion: described(S.String, "Importer version.").pipe(pg.text(), pg.columnName("importer_version")),
    extractorVersion: optionalNull(S.String).pipe(pg.text(), pg.columnName("extractor_version")),
    status: MemoryImportRunStatus.pipe(
      S.withConstructorDefault(Effect.succeed(received)),
      pg.text(),
      pg.columnName("status"),
    ),
    artifactCount: count("artifact_count"),
    candidateCount: count("candidate_count"),
    acceptedCount: count("accepted_count"),
    promotedCount: count("promoted_count"),
    dedupedCount: count("deduped_count"),
    startedAt: requiredInstant("started_at"),
    updatedAt: requiredInstant("updated_at"),
    completedAt: optionalInstant("completed_at"),
    lastError: optionalNull(S.String).pipe(pg.text(), pg.columnName("last_error")),
  },
  $I.annote("MemoryImportRun", {
    description: "One import run and its counters.",
  }),
  (columns) => [
    nonNegativeIntCheck("artifact_count")(columns.artifactCount),
    nonNegativeIntCheck("candidate_count")(columns.candidateCount),
    nonNegativeIntCheck("accepted_count")(columns.acceptedCount),
    nonNegativeIntCheck("promoted_count")(columns.promotedCount),
    nonNegativeIntCheck("deduped_count")(columns.dedupedCount),
  ],
) {}

/**
 * Encoded form of {@link MemoryImportRun}.
 *
 * @see {@link MemoryImportRun} for the counter defaults.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryImportRun {
  export type Encoded = S.Codec.Encoded<typeof MemoryImportRun>;
}

/**
 * Normalize sensitivity labels: trim, lowercase, drop blanks, sort, and dedupe.
 *
 * **Example** (Collapse blank and mixed-case labels)
 *
 * ```ts
 * import { normalizeSensitivityLabels } from "@beep/scratchpad/beep/MemoryImports.ts"
 *
 * console.log(normalizeSensitivityLabels([" Health ", "health", "  "]).join(",")) // "health"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const normalizeSensitivityLabels = (labels: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.sort(
    A.dedupe(A.filter(A.map(labels, (label) => Str.toLowerCase(Str.trim(label))), (label) => !Str.isEmpty(label))),
    stringOrder,
  );

const sensitivityLabels = S.Array(S.String).pipe(
  S.decodeTo(S.Array(S.String), {
    decode: SchemaGetter.transform(normalizeSensitivityLabels),
    encode: SchemaGetter.transform((labels: ReadonlyArray<string>) => labels),
  }),
  S.withConstructorDefault(Effect.succeed([])),
  pg.jsonb(),
  pg.columnName("sensitivity_labels"),
);

const redactedOrSummary = "redacted_or_summary";
const artifactActive = "active";

/**
 * One persisted import artifact.
 *
 * **Details**
 *
 * `sensitivityLabels` are normalized on decode. `redactionStatus` defaults to
 * the free string `redacted_or_summary`, not the evidence redaction enum.
 * `sourceState` defaults to `active`.
 *
 * **Gotchas**
 *
 * `clientDeviceId` is optional and is not part of an artifact hash computed
 * elsewhere. This row is not {@link MemoryEvidence} and not a legacy evidence
 * document.
 *
 * **Example** (Normalize a sensitivity label)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryImportArtifact } from "@beep/scratchpad/beep/MemoryImports.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(MemoryImportArtifact)({
 *     artifactId: "art-1",
 *     uid: "user-1",
 *     runId: "run-1",
 *     sourceType: "chat",
 *     contentHash: "abc",
 *     capturedAt: "2020-01-02T03:04:05.000Z",
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     updatedAt: "2020-01-02T03:04:05.000Z",
 *     sensitivityLabels: [" Health ", "health"],
 *   }),
 * )
 * console.log(decoded.sensitivityLabels.join(",")) // "health"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryImportArtifact extends Model<MemoryImportArtifact>("MemoryImportArtifact")(
  {
    artifactId: described(S.String, "Import artifact id.").pipe(pg.text(), pg.columnName("artifact_id")),
    uid: described(S.String, "Owning user id.").pipe(pg.text(), pg.columnName("uid")),
    runId: described(S.String, "Import run id.").pipe(pg.text(), pg.columnName("run_id")),
    sourceType: described(S.String, "Import source type.").pipe(pg.text(), pg.columnName("source_type")),
    externalId: strippedOptional("external_id", "Caller external id. Blank becomes absent."),
    contentHash: described(S.String, "Content hash of the imported artifact.").pipe(
      pg.text(),
      pg.columnName("content_hash"),
    ),
    title: strippedOptional("title", "Optional title. Blank becomes absent."),
    snippet: strippedOptional("snippet", "Optional snippet. Blank becomes absent."),
    redactedBody: strippedOptional("redacted_body", "Optional redacted body. Blank becomes absent."),
    metadata: jsonDefault("metadata"),
    occurredAt: optionalInstant("occurred_at"),
    capturedAt: requiredInstant("captured_at"),
    clientDeviceId: strippedOptional("client_device_id", "Optional capture device. Not an artifact hash input."),
    sourceState: MemoryImportArtifactSourceState.pipe(
      S.withConstructorDefault(Effect.succeed(artifactActive)),
      pg.text(),
      pg.columnName("source_state"),
    ),
    redactionStatus: S.String.pipe(
      S.withConstructorDefault(Effect.succeed(redactedOrSummary)),
      pg.text(),
      pg.columnName("redaction_status"),
    ),
    sensitivityLabels,
    createdAt: requiredInstant("created_at"),
    updatedAt: requiredInstant("updated_at"),
  },
  $I.annote("MemoryImportArtifact", {
    description: "Persisted import artifact. Redaction defaults to redacted_or_summary.",
  }),
) {}

/**
 * Encoded form of {@link MemoryImportArtifact}.
 *
 * @see {@link MemoryImportArtifact} for label normalization.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryImportArtifact {
  export type Encoded = S.Codec.Encoded<typeof MemoryImportArtifact>;
}

/**
 * Return the supplied UTC instant.
 *
 * **Details**
 *
 * The Python helper reads the clock. This port does not open a Clock service.
 * Callers pass the instant they want treated as now.
 *
 * **Example** (Keep a fixed instant)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { utcNow } from "@beep/scratchpad/beep/MemoryImports.ts"
 *
 * const now = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * console.log(DateTime.formatIso(utcNow(now))) // "2020-01-02T03:04:05.000Z"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const utcNow = (now: DateTime.Utc): DateTime.Utc => DateTime.toUtc(now);
