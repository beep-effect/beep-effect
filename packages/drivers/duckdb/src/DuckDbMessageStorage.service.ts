/**
 * DuckDB message and reply persistence for a single process (D65).
 *
 * **Details**
 *
 * Ported from effect 4.0.6. DuckDB serializes writes on one connection.
 * Cluster storages cannot coordinate across processes sharing a DuckDB file.
 * Deviations from the upstream SQLite implementation carry `// beep:` markers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DuckdbId } from "@beep/identity/packages";
import { quotedString } from "@duckdb/node-api";
// eslint-disable effect/no-bigint-literals
import * as A from "effect/Array";
import { PersistenceError } from "effect/cluster/ClusterError";
import * as MessageStorage from "effect/cluster/MessageStorage";
import { SaveResultEncoded } from "effect/cluster/MessageStorage";
import * as ShardId from "effect/cluster/ShardId";
import * as Snowflake from "effect/cluster/Snowflake";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Migrator from "effect/sql/Migrator";
import * as SqlClient from "effect/sql/SqlClient";
import { isSqlError } from "effect/sql/SqlError";
import { decodeJson, encodeJson, runPrefixedMigrations } from "./internal/storage.ts";
import type * as EntityAddress from "effect/cluster/EntityAddress";
import type * as Envelope from "effect/cluster/Envelope";
import type * as Reply from "effect/cluster/Reply";
import type { ShardingConfig } from "effect/cluster/ShardingConfig";
import type * as PlatformError from "effect/PlatformError";
import type { Row } from "effect/sql/SqlConnection";
import type { SqlError } from "effect/sql/SqlError";
import type { Fragment } from "effect/sql/Statement";

const $I = $DuckdbId.create("DuckDbMessageStorage.service");

// beep: Public Effect leaf imports and SQLite-only branches specialize the 4.0.6 service for DuckDB.
// beep: Schema JSON codecs replace throwing native JSON operations in upstream callbacks.
const requiredString = (value: unknown) => Result.getOrThrowWith(S.decodeUnknownResult(S.String)(value), identity);
const ExitPayload = S.Union([
  S.TaggedStruct("Success", { value: S.Unknown }),
  S.TaggedStruct("Failure", {
    cause: S.Array(
      S.Union([
        S.TaggedStruct("Fail", { error: S.Unknown }),
        S.TaggedStruct("Die", { defect: S.Unknown }),
        S.TaggedStruct("Interrupt", { fiberId: S.Union([S.Finite, S.Null, S.Undefined]) }),
      ])
    ),
  }),
]);
const ExitJson = S.fromJsonString(ExitPayload);
const ValuesJson = S.Unknown.pipe(S.NonEmptyArray, S.fromJsonString);
const HeadersJson = S.fromJsonString(S.Record(S.String, S.String));
const SavedRows = S.NonEmptyArray(S.Record(S.String, S.Unknown));
const decodeExit = (value: string) => Result.getOrThrowWith(S.decodeResult(ExitJson)(value), identity);
const decodeValues = (value: string) => Result.getOrThrowWith(S.decodeResult(ValuesJson)(value), identity);
const decodeHeaders = (value: string) => Result.getOrThrowWith(S.decodeResult(HeadersJson)(value), identity);

const withTracerDisabled = Effect.withTracerEnabled(false);

/**
 * DuckDbMessageStorage constructor.
 *
 * **Example** (Compose DuckDB storage)
 *
 * ```ts
 * import * as Storage from "@beep/duckdb/DuckDbMessageStorage"
 * const storage = Storage.layer
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeEncoded: (options?: {
  readonly prefix?: string | undefined;
}) => Effect.Effect<MessageStorage.Encoded, never, SqlClient.SqlClient | Digest.Digest> = (options) =>
  Effect.andThen(runMessageMigrations(options), makeEncodedStorage(options));

const makeEncodedStorage = Effect.fnUntraced(function* (
  options:
    | {
        readonly prefix?: string | undefined;
      }
    | undefined
) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const crypto = yield* Digest.Digest;
  const prefix = options?.prefix ?? "cluster";
  const table = (name: string) => `${prefix}_${name}`;

  const messageKindAckChunk = sql.literal(String(messageKind.AckChunk));
  const messageKindInterrupt = sql.literal(String(messageKind.Interrupt));
  const replyKindWithExit = sql.literal(String(replyKind.WithExit));

  const messagesTable = table("messages");
  const messagesTableSql = sql(messagesTable);

  const repliesTable = table("replies");
  const repliesTableSql = sql(repliesTable);

  // The composed primary key (`entityType/entityId/tag/id`) can legally exceed
  // the 255-character `message_id` column: entity_type(150) + entity_id(255) +
  // tag(50) alone total 458 characters before the RPC primary key is appended.
  // Keys that fit are stored as-is, keeping `message_id` byte-compatible with
  // rows written by previous versions; longer keys are stored as a SHA-256
  // digest (64 hex characters, collision probability negligible at a 2^128
  // birthday bound). Digests never contain "/" while composed keys always do,
  // so the two encodings cannot collide.
  const encoder = new TextEncoder();
  const messageIdForPrimaryKey = (primaryKey: string): Effect.Effect<string, PlatformError.PlatformError> =>
    primaryKey.length <= 255
      ? Effect.succeed(primaryKey)
      : Effect.map(crypto.digest(Digest.sha256, encoder.encode(primaryKey)), Hex.encode);

  const messageIdEnforcesWidth = false;
  // sqlite's TEXT message_id column stored over-length plaintext keys before
  // digests were introduced; those legacy rows need a plaintext fallback read
  const mayHaveLegacyRow = (primaryKey: string): boolean => !messageIdEnforcesWidth && primaryKey.length > 255;

  // beep: Effect Match replaces the upstream switch while preserving encoded envelope branches.
  const envelopeToRow = (
    envelope: Envelope.Encoded,
    message_id: string | null,
    deliver_at: number | null
  ): MessageRow =>
    Match.value(envelope).pipe(
      Match.tag("Request", (envelope) => ({
        id: envelope.requestId,
        message_id,
        shard_id: ShardId.toString(envelope.address.shardId),
        entity_type: envelope.address.entityType,
        entity_id: envelope.address.entityId,
        kind: messageKind.Request,
        tag: envelope.tag,
        payload: encodeJson(envelope.payload),
        headers: encodeJson(envelope.headers),
        trace_id: envelope.traceId ?? null,
        span_id: envelope.spanId ?? null,
        // beep: DuckDB stores `sampled` as an integer flag; upstream's `supportsBooleans` switch is always false here.
        sampled: envelope.sampled === undefined ? null : envelope.sampled ? 1 : 0,
        request_id: envelope.requestId,
        reply_id: null,
        deliver_at,
      })),
      Match.tag("AckChunk", (envelope) => ({
        id: envelope.id,
        message_id,
        shard_id: ShardId.toString(envelope.address.shardId),
        entity_type: envelope.address.entityType,
        entity_id: envelope.address.entityId,
        kind: messageKind.AckChunk,
        tag: null,
        payload: null,
        headers: null,
        trace_id: null,
        span_id: null,
        sampled: null,
        request_id: envelope.requestId,
        reply_id: envelope.replyId,
        deliver_at,
      })),
      Match.tag("Interrupt", (envelope) => ({
        id: envelope.id,
        message_id,
        shard_id: ShardId.toString(envelope.address.shardId),
        entity_type: envelope.address.entityType,
        entity_id: envelope.address.entityId,
        kind: messageKind.Interrupt,
        payload: null,
        tag: null,
        headers: null,
        trace_id: null,
        span_id: null,
        sampled: null,
        request_id: envelope.requestId,
        reply_id: null,
        deliver_at,
      })),
      Match.exhaustive
    );

  const replyToRow = (reply: Reply.Encoded): ReplyRow => ({
    id: reply.id,
    kind: replyKind[reply._tag],
    request_id: reply.requestId,
    payload: reply._tag === "WithExit" ? encodeJson(reply.exit) : encodeJson(reply.values),
    sequence: reply._tag === "Chunk" ? reply.sequence : null,
  });

  type MessageResult = { readonly envelope: Envelope.Encoded; readonly lastSentReply: O.Option<Reply.Encoded> };
  // beep: Effect Match and schema JSON codecs replace upstream switch/native JSON row decoding.
  const messageFromRow = (
    row: MessageRow & ReplyJoinRow
  ): {
    readonly envelope: Envelope.Encoded;
    readonly lastSentReply: O.Option<Reply.Encoded>;
  } =>
    Match.value(Number(row.kind)).pipe(
      Match.when(
        0,
        (): MessageResult => ({
          envelope: {
            _tag: "Request",
            requestId: String(row.id),
            address: {
              shardId: ShardId.fromStringEncoded(row.shard_id),
              entityType: row.entity_type,
              entityId: row.entity_id,
            },
            tag: requiredString(row.tag),
            payload: decodeJson(requiredString(row.payload)),
            headers: decodeHeaders(requiredString(row.headers)),
            ...(row.trace_id !== null
              ? {
                  traceId: row.trace_id,
                  spanId: requiredString(row.span_id),
                  sampled: Boolean(row.sampled),
                }
              : undefined),
          },
          lastSentReply:
            row.reply_reply_id !== null
              ? O.some({
                  _tag: "Chunk",
                  id: String(row.reply_reply_id),
                  requestId: String(row.request_id),
                  sequence: Number(row.reply_sequence),
                  values: decodeValues(requiredString(row.reply_payload)),
                })
              : O.none(),
        })
      ),
      Match.when(
        1,
        (): MessageResult => ({
          envelope: {
            _tag: "AckChunk",
            id: String(row.id),
            requestId: String(row.request_id),
            replyId: String(row.reply_id),
            address: {
              shardId: ShardId.fromStringEncoded(row.shard_id),
              entityType: row.entity_type,
              entityId: row.entity_id,
            },
          },
          lastSentReply: O.none(),
        })
      ),
      Match.when(
        2,
        (): MessageResult => ({
          envelope: {
            _tag: "Interrupt",
            id: String(row.id),
            requestId: String(row.request_id),
            address: {
              shardId: ShardId.fromStringEncoded(row.shard_id),
              entityType: row.entity_type,
              entityId: row.entity_id,
            },
          },
          lastSentReply: O.none(),
        })
      ),
      Match.orElseAbsurd
    );

  // beep: integer flags, as above.
  const sqlFalse = sql.literal("0");
  const sqlTrue = sql.literal("1");

  // beep: always read BIGINT ids as text so 64-bit snowflakes above 2^53 round-trip exactly
  // (upstream's `idsAsText` switch is always true on this path).
  const idAs = (column: string, alias: string) => `CAST(${column} AS TEXT) AS ${alias}`;
  const replyJoinColumns = "r.kind as reply_kind, r.payload as reply_payload, r.sequence as reply_sequence";
  const messageColumns =
    `${idAs("m.id", "id")}, m.message_id, m.shard_id, m.entity_type, m.entity_id, m.kind, m.tag, m.payload, ` +
    `m.headers, m.trace_id, m.span_id, m.sampled, m.processed, ${idAs("m.request_id", "request_id")}, ` +
    `${idAs("m.reply_id", "reply_id")}, ${idAs("m.last_reply_id", "last_reply_id")}, m.last_read, m.deliver_at`;

  const idColumn = sql.literal(idAs("id", "id"));
  const replyColumns = sql.literal(`${idAs("id", "id")}, kind, ${idAs("request_id", "request_id")}, payload, sequence`);
  const duplicateColumns = sql.literal(`${idAs("m.id", "id")}, ${idAs("r.id", "reply_id")}, ${replyJoinColumns}`);
  const messageJoinColumns = sql.literal(`${messageColumns}, ${idAs("r.id", "reply_reply_id")}, ${replyJoinColumns}`);

  const selectByMessageId = (message_id: string): Effect.Effect<ReadonlyArray<Row>, SqlError> =>
    sql`
      SELECT ${duplicateColumns}
      FROM ${messagesTableSql} m
      LEFT JOIN ${repliesTableSql} r ON r.id = m.last_reply_id
      WHERE m.message_id = ${message_id}
    `;
  const insertEnvelope: (row: MessageRow, message_id: string) => Effect.Effect<ReadonlyArray<Row>, SqlError> = (
    row,
    message_id
  ) =>
    selectByMessageId(message_id).pipe(
      Effect.tap(sql`INSERT OR IGNORE INTO ${messagesTableSql} ${sql.insert(row)}`),
      sql.withTransaction,
      Effect.retry({ times: 3 })
    );

  // beep: DuckDB uses timestamp interval arithmetic, not SQLite datetime().
  const tenMinutesAgo = sql.literal(`get_current_timestamp() - INTERVAL '10 minutes'`);
  // beep: Explicit function syntax avoids DuckDB ON CONFLICT binding CURRENT_TIMESTAMP as a column.
  const sqlNowString = "get_current_timestamp()";
  const sqlNow = sql.literal(sqlNowString);

  const wrapString = (s: string) => `'${s}'`;
  const forUpdate = sql.literal("");
  // mssql locks claimed rows with a table hint instead of FOR UPDATE
  const updateLock = sql.literal("");

  const emptyFragment = sql.literal("");
  // mssql only limits with OFFSET/FETCH, which requires the ORDER BY that
  // both queries already have
  const limitFragment = (limit: number) => sql.literal(`LIMIT ${Math.floor(limit)}`);
  // beep: Effect grouping replaces upstream native Map state.
  const groupAddresses = (addresses: ReadonlyArray<EntityAddress.EntityAddress>) =>
    A.flatMap(R.values(A.groupBy(addresses, (address) => address.shardId.toString())), (byShard) =>
      A.map(R.values(A.groupBy(byShard, (address) => address.entityType)), (group) => ({
        shardId: group[0].shardId.toString(),
        entityType: group[0].entityType,
        addresses: group,
      }))
    );
  type UnprocessedOptions = {
    readonly limit?: number | undefined;
    readonly addresses?: ReadonlyArray<EntityAddress.EntityAddress> | undefined;
  };
  const unprocessedFilters = (options?: UnprocessedOptions | undefined) => ({
    addressFilter:
      options?.addresses !== undefined
        ? sql`AND (${sql.or(
            A.map(groupAddresses(options.addresses), (group) =>
              sql.and([
                sql`m.shard_id = ${group.shardId}`,
                sql`m.entity_type = ${group.entityType}`,
                sql.in(
                  "m.entity_id",
                  A.map(group.addresses, (address) => address.entityId)
                ),
              ])
            )
          )})`
        : emptyFragment,
    limit: options?.limit !== undefined ? limitFragment(options.limit) : emptyFragment,
  });
  type UnprocessedFilters = ReturnType<typeof unprocessedFilters>;

  const getUnprocessedMessagesForDialect = (
    shardIds: ReadonlyArray<string>,
    now: number,
    filters: UnprocessedFilters
  ) =>
    sql<MessageJoinRow>`
        SELECT ${messageJoinColumns}
        FROM ${messagesTableSql} m ${updateLock}
        LEFT JOIN ${repliesTableSql} r ON r.id = m.last_reply_id
        WHERE m.shard_id IN (${sql.literal(A.join(A.map(shardIds, wrapString), ","))})
        ${filters.addressFilter}
        AND NOT EXISTS (
          SELECT 1 FROM ${repliesTableSql}
          WHERE request_id = m.request_id
          AND (kind = ${replyKindWithExit} OR acked = ${sqlFalse})
        )
        AND processed = ${sqlFalse}
        AND (m.last_read IS NULL OR m.last_read < ${tenMinutesAgo})
        AND (m.deliver_at IS NULL OR m.deliver_at <= ${sql.literal(String(now))})
        ORDER BY m.seq ASC
        ${filters.limit}
        ${forUpdate}
      `.unprepared.pipe(
      Effect.tap((rows) => {
        if (rows.length === 0) {
          return Effect.void;
        }
        return sql`
            UPDATE ${messagesTableSql}
            SET last_read = ${sqlNow}
            WHERE id IN (${sql.literal(
              A.join(
                A.map(rows, (row) => String(row.id)),
                ","
              )
            )})
          `.unprepared;
      }),
      sql.withTransaction
    );
  const getUnprocessedMessages = (
    shardIds: ReadonlyArray<string>,
    now: number,
    options?: UnprocessedOptions | undefined
  ) =>
    options?.addresses?.length === 0
      ? Effect.succeed([])
      : getUnprocessedMessagesForDialect(shardIds, now, unprocessedFilters(options));

  const resetUnprocessed = (filter: Fragment) =>
    sql`
      UPDATE ${messagesTableSql}
      SET last_read = NULL
      WHERE processed = ${sqlFalse} AND ${filter}
    `;

  const encoded: MessageStorage.Encoded = {
    saveEnvelope: ({ deliverAt, envelope, primaryKey }) =>
      Effect.suspend(() => {
        let insert: Effect.Effect<ReadonlyArray<Row>, SqlError | PlatformError.PlatformError>;
        if (primaryKey !== null) {
          insert = Effect.flatMap(messageIdForPrimaryKey(primaryKey), (messageId) => {
            const row = envelopeToRow(envelope, messageId, deliverAt);
            if (!mayHaveLegacyRow(primaryKey)) {
              return insertEnvelope(row, messageId);
            }
            return selectByMessageId(primaryKey).pipe(
              Effect.filterOrElse(
                (rows) => rows.length > 0,
                () => insertEnvelope(row, messageId)
              )
            );
          });
        } else {
          const row = envelopeToRow(envelope, null, deliverAt);
          insert = Effect.as(sql`INSERT INTO ${messagesTableSql} ${sql.insert(row)}`.unprepared, []);
          if (envelope._tag === "AckChunk") {
            insert = sql`UPDATE ${repliesTableSql} SET acked = ${sqlTrue} WHERE id = ${envelope.replyId}`.pipe(
              Effect.andThen(
                sql`UPDATE ${messagesTableSql} SET processed = ${sqlTrue} WHERE processed = ${sqlFalse} AND request_id = ${envelope.requestId} AND kind = ${messageKindAckChunk}`
              ),
              Effect.andThen(insert),
              sql.withTransaction
            );
          }
        }
        return insert.pipe(
          Effect.map((rows) => {
            if (rows.length === 0) {
              return SaveResultEncoded.Success();
            }
            const row = A.headNonEmpty(Result.getOrThrowWith(S.decodeUnknownResult(SavedRows)(rows), identity));
            const replyKindNum = P.isBigInt(row.reply_kind) ? Number(row.reply_kind) : row.reply_kind;
            const lastReceivedReply: O.Option<Reply.Encoded> =
              row.reply_id !== undefined && row.reply_id !== null
                ? O.some(
                    replyKindNum === replyKind.WithExit
                      ? {
                          id: String(row.reply_id),
                          requestId: String(row.id),
                          _tag: "WithExit",
                          exit: decodeExit(requiredString(row.reply_payload)),
                        }
                      : {
                          id: String(row.reply_id),
                          requestId: String(row.id),
                          _tag: "Chunk",
                          sequence: Number(row.reply_sequence),
                          values: decodeValues(requiredString(row.reply_payload)),
                        }
                  )
                : O.none();
            return SaveResultEncoded.Duplicate({
              originalId: Snowflake.Snowflake(String(row.id)),
              lastReceivedReply,
            });
          })
        );
      }).pipe(Effect.provideService(SqlClient.SafeIntegers, true), PersistenceError.refail, withTracerDisabled),

    saveReply: (reply) =>
      Effect.suspend(() => {
        const row = replyToRow(reply);
        const update =
          reply._tag === "Chunk"
            ? sql`UPDATE ${messagesTableSql} SET last_reply_id = ${reply.id} WHERE id = ${reply.requestId}`
            : sql`UPDATE ${messagesTableSql} SET processed = ${sqlTrue}, last_reply_id = ${reply.id} WHERE request_id = ${reply.requestId}`;
        return update.unprepared.pipe(
          Effect.andThen(sql`INSERT INTO ${repliesTableSql} ${sql.insert(row)}`),
          sql.withTransaction
        );
      }).pipe(Effect.asVoid, PersistenceError.refail, withTracerDisabled),

    clearReplies: Effect.fnUntraced(
      function* (requestId, options) {
        const expectedReplyId = options?.expectedReplyId;
        if (expectedReplyId === undefined) {
          yield* sql`DELETE FROM ${repliesTableSql} WHERE request_id = ${String(requestId)} AND kind = 0`;
          yield* sql`DELETE FROM ${messagesTableSql} WHERE request_id = ${String(
            requestId
          )} AND kind = ${messageKindInterrupt}`;
          yield* sql`UPDATE ${messagesTableSql} SET processed = ${sqlFalse}, last_reply_id = NULL, last_read = NULL WHERE request_id = ${String(
            requestId
          )}`;
          return;
        }
        const id = String(requestId);
        const expected = String(expectedReplyId);
        // Check at the storage boundary, not at the earlier workflow read.
        yield* sql`DELETE FROM ${repliesTableSql} WHERE request_id = ${id} AND kind = 0
          AND EXISTS (SELECT 1 FROM ${messagesTableSql} WHERE id = ${id} AND last_reply_id = ${expected})`;
        yield* sql`UPDATE ${messagesTableSql} SET processed = ${sqlFalse}, last_reply_id = NULL, last_read = NULL
          WHERE request_id = ${id} AND last_reply_id = ${expected}`;
      },
      sql.withTransaction,
      PersistenceError.refail,
      withTracerDisabled
    ),

    requestIdForPrimaryKey: (primaryKey) =>
      messageIdForPrimaryKey(primaryKey).pipe(
        Effect.flatMap(
          (messageId) =>
            sql<{ id: string | bigint }>`SELECT ${idColumn} FROM ${messagesTableSql} WHERE message_id = ${messageId}`
        ),
        Effect.filterOrElse(
          (rows) => rows.length !== 0 || !mayHaveLegacyRow(primaryKey),
          () =>
            sql<{ id: string | bigint }>`SELECT ${idColumn} FROM ${messagesTableSql} WHERE message_id = ${primaryKey}`
        ),
        Effect.map((rows) => O.map(O.fromNullishOr(rows[0]?.id), Snowflake.Snowflake)),
        Effect.provideService(SqlClient.SafeIntegers, true),
        PersistenceError.refail,
        withTracerDisabled
      ),

    repliesFor: (requestIds) =>
      // replies where:
      // - the request is in the list
      // - the kind is WithExit
      // - or the kind is Chunk and has not been acked yet
      sql<ReplyRow>`
        SELECT ${replyColumns}
        FROM ${repliesTableSql}
        WHERE request_id IN (${sql.literal(A.join(requestIds, ","))})
        AND (
          kind = ${replyKindWithExit}
          OR (
            kind IS NULL
            AND acked = ${sqlFalse}
          )
        )
        ORDER BY seq ASC
      `.unprepared.pipe(
        Effect.provideService(SqlClient.SafeIntegers, true),
        Effect.map(A.map(replyFromRow)),
        PersistenceError.refail,
        withTracerDisabled
      ),

    repliesForUnfiltered: (requestIds) =>
      sql<ReplyRow>`
        SELECT ${replyColumns}
        FROM ${repliesTableSql}
        WHERE request_id IN (${sql.literal(A.join(requestIds, ","))})
        ORDER BY seq ASC
      `.unprepared.pipe(
        Effect.provideService(SqlClient.SafeIntegers, true),
        Effect.map(A.map(replyFromRow)),
        PersistenceError.refail,
        withTracerDisabled
      ),

    unprocessedMessages: Effect.fnUntraced(
      function* (shardIds, now, options) {
        const rows = yield* getUnprocessedMessages(shardIds, now, options);
        if (rows.length === 0) {
          return [];
        }
        return A.map(rows, messageFromRow);
      },
      Effect.provideService(SqlClient.SafeIntegers, true),
      PersistenceError.refail,
      withTracerDisabled
    ),

    unprocessedMessagesById(ids, now) {
      const idArr = A.map(A.fromIterable(ids), String);
      return sql<MessageRow & ReplyJoinRow>`
        SELECT ${messageJoinColumns}
        FROM ${messagesTableSql} m
        LEFT JOIN ${repliesTableSql} r ON r.id = m.last_reply_id
        WHERE m.id IN (${sql.literal(A.join(idArr, ","))})
        AND NOT EXISTS (
          SELECT 1 FROM ${repliesTableSql}
          WHERE request_id = m.request_id
          AND (kind = ${replyKindWithExit} OR acked = ${sqlFalse})
        )
        AND m.processed = ${sqlFalse}
        AND (m.deliver_at IS NULL OR m.deliver_at <= ${sql.literal(String(now))})
        ORDER BY m.seq ASC
      `.unprepared.pipe(
        Effect.map(A.map(messageFromRow)),
        Effect.provideService(SqlClient.SafeIntegers, true),
        PersistenceError.refail,
        withTracerDisabled
      );
    },

    resetRequests: (requestIds) =>
      requestIds.length === 0
        ? Effect.void
        : sql`
        UPDATE ${messagesTableSql}
        SET last_read = NULL
        WHERE processed = ${sqlFalse}
        AND ${sql.in("id", A.map(requestIds, String))}
        `.pipe(Effect.asVoid, PersistenceError.refail, withTracerDisabled),

    resetAddresses: (addresses) =>
      addresses.length === 0
        ? Effect.void
        : resetUnprocessed(
            sql`(${sql.or(
              A.map(groupAddresses(addresses), (group) =>
                sql.and([
                  sql`shard_id = ${group.shardId}`,
                  sql`entity_type = ${group.entityType}`,
                  sql.in(
                    "entity_id",
                    A.map(group.addresses, (address) => address.entityId)
                  ),
                ])
              )
            )})`
          ).pipe(Effect.asVoid, PersistenceError.refail, withTracerDisabled),

    clearAddress: (address) =>
      sql`
        DELETE FROM ${repliesTableSql}
        WHERE request_id IN (
          SELECT id FROM ${messagesTableSql}
          WHERE entity_type = ${address.entityType}
          AND entity_id = ${address.entityId}
        )
      `.pipe(
        Effect.andThen(
          sql`
            DELETE FROM ${messagesTableSql}
            WHERE entity_type = ${address.entityType}
            AND entity_id = ${address.entityId}
          `
        ),
        sql.withTransaction,
        Effect.asVoid,
        PersistenceError.refail,
        withTracerDisabled
      ),

    resetShards: (shardIds) =>
      resetUnprocessed(sql`shard_id IN (${sql.literal(A.join(A.map(shardIds, wrapString), ","))})`).pipe(
        Effect.asVoid,
        PersistenceError.refail,
        withTracerDisabled
      ),

    withTransaction: (effect) => sql.withTransaction(effect).pipe(Effect.catchIf(isSqlError, Effect.die)),
  };
  return encoded;
}, withTracerDisabled);

/**
 * DuckDbMessageStorage constructor.
 *
 * **Example** (Compose DuckDB storage)
 *
 * ```ts
 * import * as Storage from "@beep/duckdb/DuckDbMessageStorage"
 * const storage = Storage.layer
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make: (options?: {
  readonly prefix?: string | undefined;
}) => Effect.Effect<
  MessageStorage.MessageStorage["Service"],
  never,
  SqlClient.SqlClient | Snowflake.Generator | Digest.Digest
> = (options) => Effect.flatMap(makeEncoded(options), MessageStorage.makeEncoded);

/**
 * DuckDbMessageStorage migration loader.
 *
 * **Example** (Compose DuckDB storage)
 *
 * ```ts
 * import * as Storage from "@beep/duckdb/DuckDbMessageStorage"
 * const storage = Storage.layer
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const migrations = (options?: { readonly prefix?: string | undefined }): Migrator.Loader => {
  const prefix = options?.prefix ?? "cluster";
  const table = (name: string) => `${prefix}_${name}`;
  const messagesTable = table("messages");
  const repliesTable = table("replies");

  // The migrator serializes PostgreSQL DDL. Propagate errors: retrying in an
  // aborted transaction cannot succeed.
  return Migrator.fromRecord({
    "0001_create_tables": Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms();
      const messagesTableSql = sql(messagesTable);
      const repliesTableSql = sql(repliesTable);
      // beep: DuckDB rewrites a row under a new rowid when an UPDATE touches an indexed column
      // beep: (last_read, acked), so rowid is not insertion order. An explicit sequence column
      // beep: (like the PostgreSQL BIGSERIAL rowid) keeps reads in insertion order.
      const messagesSequence = `${messagesTable}_seq`;
      const repliesSequence = `${repliesTable}_seq`;
      yield* sql`CREATE SEQUENCE IF NOT EXISTS ${sql(messagesSequence)}`;
      yield* sql`CREATE SEQUENCE IF NOT EXISTS ${sql(repliesSequence)}`;

      // beep: BIGINT ids, sequences and delivery times avoid DuckDB INT32 overflow; last_read is a TIMESTAMPTZ
      // beep: instant so the ten-minute redelivery window survives a session TimeZone change (D69).
      yield* sql`
            CREATE TABLE IF NOT EXISTS ${messagesTableSql} (
              id BIGINT PRIMARY KEY,
              seq BIGINT NOT NULL DEFAULT nextval(${sql.literal(quotedString(messagesSequence))}),
              message_id TEXT,
              shard_id TEXT NOT NULL,
              entity_type TEXT NOT NULL,
              entity_id TEXT NOT NULL,
              kind BIGINT NOT NULL,
              tag TEXT,
              payload TEXT,
              headers TEXT,
              trace_id TEXT,
              span_id TEXT,
              sampled BOOLEAN,
              processed BOOLEAN NOT NULL DEFAULT FALSE,
              request_id BIGINT NOT NULL,
              reply_id BIGINT,
              last_reply_id BIGINT,
              last_read TIMESTAMPTZ,
              deliver_at BIGINT,
              UNIQUE (message_id)
            )
          `;

      // Add message indexes optimized for the specific query patterns
      const shardLookupIndex = `${messagesTable}_shard_idx`;
      const requestIdLookupIndex = `${messagesTable}_request_id_idx`;
      yield* Effect.all([
        sql`
              CREATE INDEX IF NOT EXISTS ${sql(shardLookupIndex)}
              ON ${messagesTableSql} (shard_id, processed, last_read, deliver_at)
            `,
        sql`
              CREATE INDEX IF NOT EXISTS ${sql(requestIdLookupIndex)}
              ON ${messagesTableSql} (request_id)
            `,
      ]).pipe(sql.withTransaction);

      yield* sql`
            CREATE TABLE IF NOT EXISTS ${repliesTableSql} (
              id BIGINT PRIMARY KEY,
              seq BIGINT NOT NULL DEFAULT nextval(${sql.literal(quotedString(repliesSequence))}),
              kind BIGINT,
              request_id BIGINT NOT NULL,
              payload TEXT NOT NULL,
              sequence BIGINT,
              acked BOOLEAN NOT NULL DEFAULT FALSE,
              UNIQUE (request_id, kind),
              UNIQUE (request_id, sequence)
            )
          `;

      // Add reply indexes optimized for request_id lookups
      const replyLookupIndex = `${repliesTable}_request_lookup_idx`;
      yield* sql`
            CREATE INDEX IF NOT EXISTS ${sql(replyLookupIndex)}
            ON ${repliesTableSql} (request_id, kind, acked);
          `;
    }),
    // beep: DuckDB TEXT is unbounded and 0001 already adds the ordering seq column; retain upstream migration ids as no-ops.
    "0002_entity_type_size": Effect.void,
    "0003_pg_messages_rowid_index": Effect.void,
  });
};

const runMessageMigrations = runPrefixedMigrations({ migrations, historySuffix: "migrations" });

/**
 * Run the DuckDbMessageStorage migrations and provide nothing.
 *
 * Creates the MessageStorage tables, sequences and indexes under `prefix` (history in a
 * per-storage migrations table) when the layer is built. Pair it with `layerStorage` when
 * the schema should be migrated separately from the storage service.
 *
 * **Example** (Migrate the schema)
 *
 * ```ts
 * import { DuckDbClient, DuckDbMessageStorage } from "@beep/duckdb"
 * import * as Layer from "effect/Layer"
 *
 * const MigrationsLive = DuckDbMessageStorage.layerMigrations({ prefix: "cluster" }).pipe(
 *   Layer.provide(DuckDbClient.layer({ databasePath: ":memory:" }))
 * )
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerMigrations = (options: {
  readonly prefix?: string | undefined;
}): Layer.Layer<never, never, SqlClient.SqlClient> => Layer.effectDiscard(runMessageMigrations(options));

/**
 * Provide `MessageStorage` over DuckDB without running any migrations.
 *
 * Builds the MessageStorage service against tables that must already exist; it requires
 * `SqlClient` and `ShardingConfig` and `Crypto`.
 *
 * **Gotchas**
 *
 * Runs no migrations: provide `layerMigrations` with the same `prefix` first, or use
 * `layerWith` / `layer`, otherwise the first storage call fails on missing tables.
 *
 * **Example** (Provide storage after explicit migrations)
 *
 * ```ts
 * import { DuckDbClient, DuckDbMessageStorage } from "@beep/duckdb"
 * import * as NodeCrypto from "@effect/platform-node/NodeCrypto"
 * import * as ShardingConfig from "effect/cluster/ShardingConfig"
 * import * as Layer from "effect/Layer"
 *
 * const options = { prefix: "cluster" }
 * const StorageLive = DuckDbMessageStorage.layerStorage(options).pipe(
 *   Layer.provide(DuckDbMessageStorage.layerMigrations(options)),
 *   Layer.provide(DuckDbClient.layer({ databasePath: ":memory:" })),
 *   Layer.provide(ShardingConfig.layer()),
 *   Layer.provide(NodeCrypto.layer)
 * )
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerStorage = (options: {
  readonly prefix?: string | undefined;
}): Layer.Layer<MessageStorage.MessageStorage, never, SqlClient.SqlClient | ShardingConfig | Digest.Digest> =>
  Layer.effect(
    MessageStorage.MessageStorage,
    Effect.flatMap(makeEncodedStorage(options), MessageStorage.makeEncoded)
  ).pipe(Layer.provide(Snowflake.layerGenerator));

/**
 * Migrate the DuckDbMessageStorage schema for `prefix`, then provide `MessageStorage`.
 *
 * Equivalent to `layerStorage(options)` provided with `layerMigrations(options)`.
 *
 * **Example** (Provide migrated storage with a prefix)
 *
 * ```ts
 * import { DuckDbClient, DuckDbMessageStorage } from "@beep/duckdb"
 * import * as NodeCrypto from "@effect/platform-node/NodeCrypto"
 * import * as ShardingConfig from "effect/cluster/ShardingConfig"
 * import * as Layer from "effect/Layer"
 *
 * const StorageLive = DuckDbMessageStorage.layerWith({ prefix: "cluster" }).pipe(
 *   Layer.provide(DuckDbClient.layer({ databasePath: ":memory:" })),
 *   Layer.provide(ShardingConfig.layer()),
 *   Layer.provide(NodeCrypto.layer)
 * )
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerWith = (options: {
  readonly prefix?: string | undefined;
}): Layer.Layer<MessageStorage.MessageStorage, never, SqlClient.SqlClient | ShardingConfig | Digest.Digest> =>
  layerStorage(options).pipe(Layer.provide(layerMigrations(options)));

/**
 * `layerWith({})`: migrate and provide `MessageStorage` with the default table prefix.
 *
 * Single-process deployments only (`SingleRunner`, D65): DuckDB locks the file per process.
 *
 * **Example** (Provide default storage)
 *
 * ```ts
 * import { DuckDbClient, DuckDbMessageStorage } from "@beep/duckdb"
 * import * as NodeCrypto from "@effect/platform-node/NodeCrypto"
 * import * as ShardingConfig from "effect/cluster/ShardingConfig"
 * import * as Layer from "effect/Layer"
 *
 * const StorageLive = DuckDbMessageStorage.layer.pipe(
 *   Layer.provide(DuckDbClient.layer({ databasePath: ":memory:" })),
 *   Layer.provide(ShardingConfig.layer()),
 *   Layer.provide(NodeCrypto.layer)
 * )
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer: Layer.Layer<
  MessageStorage.MessageStorage,
  never,
  SqlClient.SqlClient | ShardingConfig | Digest.Digest
> = layerWith({});

// -------------------------------------------------------------------------------------------------
// internal
// -------------------------------------------------------------------------------------------------

const messageKind = {
  Request: 0,
  AckChunk: 1,
  Interrupt: 2,
} as const satisfies Record<Envelope.Envelope.Any["_tag"], number>;

const replyKind = {
  WithExit: 0,
  Chunk: null,
} as const satisfies Record<Reply.Encoded["_tag"], number | null>;

const replyFromRow = (row: ReplyRow): Reply.Encoded =>
  row.kind !== null && Number(row.kind) === replyKind.WithExit
    ? {
        _tag: "WithExit",
        id: String(row.id),
        requestId: String(row.request_id),
        exit: decodeExit(row.payload),
      }
    : {
        _tag: "Chunk",
        id: String(row.id),
        requestId: String(row.request_id),
        values: decodeValues(row.payload),
        sequence: Number(row.sequence),
      };

// beep: SQL row shapes derive from annotated schemas.
const MessageRow = S.Struct({
  id: S.Union([S.String, S.BigInt]),
  message_id: S.Union([S.String, S.Null]),
  shard_id: S.String,
  entity_type: S.String,
  entity_id: S.String,
  kind: S.Union([
    S.Literal(0),
    S.Literal(1),
    S.Literal(2),
    S.Literal(BigInt(0)),
    S.Literal(BigInt(1)),
    S.Literal(BigInt(2)),
  ]),
  tag: S.Union([S.String, S.Null]),
  payload: S.Union([S.String, S.Null]),
  headers: S.Union([S.String, S.Null]),
  trace_id: S.Union([S.String, S.Null]),
  span_id: S.Union([S.String, S.Null]),
  sampled: S.Union([S.Boolean, S.Finite, S.BigInt, S.Null]),
  request_id: S.Union([S.String, S.BigInt, S.Null]),
  reply_id: S.Union([S.String, S.BigInt, S.Null]),
  deliver_at: S.Union([S.Finite, S.BigInt, S.Null]),
}).pipe($I.annoteSchema("MessageRow", { description: "DuckDB MessageRow persisted row." }));
type MessageRow = typeof MessageRow.Type;

// beep: SQL row shapes derive from annotated schemas.
const ReplyRow = S.Struct({
  id: S.Union([S.String, S.BigInt]),
  kind: S.Union([S.Literal(0), S.Null, S.Literal(BigInt(0))]),
  request_id: S.Union([S.String, S.BigInt]),
  payload: S.String,
  sequence: S.Union([S.Finite, S.BigInt, S.Null]),
}).pipe($I.annoteSchema("ReplyRow", { description: "DuckDB ReplyRow persisted row." }));
type ReplyRow = typeof ReplyRow.Type;

// beep: SQL row shapes derive from annotated schemas.
const ReplyJoinRow = S.Struct({
  reply_reply_id: S.Union([S.String, S.BigInt, S.Null]),
  reply_payload: S.Union([S.String, S.Null]),
  reply_sequence: S.Union([S.Finite, S.BigInt, S.Null]),
}).pipe($I.annoteSchema("ReplyJoinRow", { description: "DuckDB ReplyJoinRow persisted row." }));
type ReplyJoinRow = typeof ReplyJoinRow.Type;

type MessageJoinRow = MessageRow &
  ReplyJoinRow & {
    readonly sequence: number | bigint;
  };
