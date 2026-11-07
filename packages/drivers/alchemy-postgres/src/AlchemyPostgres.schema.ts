/**
 * Storage schema of the Postgres `Platform` driver for `@alchemy.run/domain`.
 *
 * **Details**
 *
 * Six tables back the aggregate and policy half of the platform: the hosted
 * model claim, aggregate instances (the single-writer row lock), committed
 * events with provenance and schema-version columns, command receipts,
 * scheduled commands and the delivery outbox. Every table name carries the
 * configured `tablePrefix`. JSON columns are `jsonb` holding the kernel's JSON
 * as is; the driver never decodes event payloads. Times are epoch
 * milliseconds in `bigint` columns, the platform's own clock.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EnvelopeJson } from "@alchemy.run/domain/Platform";
import { TraceJson } from "@alchemy.run/domain/Telemetry";
import { $AlchemyPostgresId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { AlchemyPostgresError } from "./AlchemyPostgres.errors.ts";
import type { AlchemyPostgresConfig } from "./AlchemyPostgres.config.ts";

const $I = $AlchemyPostgresId.create("AlchemyPostgres.schema");

/**
 * Lifecycle of a scheduled command row.
 *
 * **Example** (Guard a schedule status)
 *
 * ```ts
 * import { ScheduleStatus } from "@beep/alchemy-postgres/AlchemyPostgres.schema"
 *
 * console.log(ScheduleStatus.is.pending("pending")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ScheduleStatus = LiteralKit(["pending", "executed", "rejected", "cancelled"]).pipe(
  $I.annoteSchema("ScheduleStatus", {
    description:
      "Lifecycle of a scheduled command: pending until it fires (executed, or rejected without a receipt) or is cancelled.",
  })
);

/**
 * Type-level member of {@link ScheduleStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type ScheduleStatus = typeof ScheduleStatus.Type;

/**
 * Lifecycle of an outbox delivery row.
 *
 * **Example** (Guard a delivery status)
 *
 * ```ts
 * import { DeliveryStatus } from "@beep/alchemy-postgres/AlchemyPostgres.schema"
 *
 * console.log(DeliveryStatus.is.delivered("delivered")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeliveryStatus = LiteralKit(["pending", "delivered"]).pipe(
  $I.annoteSchema("DeliveryStatus", {
    description: "Lifecycle of an outbox delivery: pending until its target ran it.",
  })
);

/**
 * Type-level member of {@link DeliveryStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type DeliveryStatus = typeof DeliveryStatus.Type;

/**
 * The table names of one driver configuration, each carrying its prefix.
 *
 * **Example** (Names under the default prefix)
 *
 * ```ts
 * import { AlchemyPostgresConfig } from "@beep/alchemy-postgres/AlchemyPostgres.config"
 * import { AlchemyPostgresTables } from "@beep/alchemy-postgres/AlchemyPostgres.schema"
 *
 * const tables = AlchemyPostgresTables.of(AlchemyPostgresConfig.make({}))
 * console.log(tables.aggregateEvent) // "alchemy_aggregate_event"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AlchemyPostgresTables extends S.Opaque<AlchemyPostgresTables, { readonly brand: unique symbol }>()(
  S.Struct({
    hostedModel: S.NonEmptyString,
    aggregateInstance: S.NonEmptyString,
    aggregateEvent: S.NonEmptyString,
    aggregateReceipt: S.NonEmptyString,
    aggregateSchedule: S.NonEmptyString,
    delivery: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("AlchemyPostgresTables", {
      description: "Prefixed names of the driver's tables for one configuration.",
    })
  )
) {
  /**
   * The table names under a configuration's `tablePrefix`.
   *
   * @since 0.0.0
   */
  static readonly of = (config: AlchemyPostgresConfig): AlchemyPostgresTables =>
    AlchemyPostgresTables.make({
      hostedModel: `${config.tablePrefix}hosted_model`,
      aggregateInstance: `${config.tablePrefix}aggregate_instance`,
      aggregateEvent: `${config.tablePrefix}aggregate_event`,
      aggregateReceipt: `${config.tablePrefix}aggregate_receipt`,
      aggregateSchedule: `${config.tablePrefix}aggregate_schedule`,
      delivery: `${config.tablePrefix}delivery`,
    });
}

/** `bigint` columns: PGlite returns numbers, postgres.js returns decimal strings. */
const Int8 = S.Union([S.Int, S.NumberFromString.check(S.isInt())]);

/**
 * Row of the aggregate instance table: the stored state, version and catch-up
 * cursors of one instance.
 *
 * **Example** (Decode an instance row)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { InstanceRow } from "@beep/alchemy-postgres/AlchemyPostgres.schema"
 *
 * const program = S.decodeUnknownEffect(InstanceRow)({ state: null, version: 0, routed: null })
 * Effect.runPromise(program).then((row) => console.log(row.version)) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InstanceRow extends S.Opaque<InstanceRow, { readonly brand: unique symbol }>()(
  S.Struct({
    state: S.Unknown,
    version: S.Int,
    routed: S.NullOr(S.Record(S.String, S.Finite)),
  }).pipe(
    $I.annoteSchema("InstanceRow", {
      description: "Stored state, version and catch-up cursors of one aggregate instance.",
    })
  )
) {}

/**
 * Row of the aggregate event table as the platform reads it back: the event
 * JSON and its kernel envelope.
 *
 * **Example** (Decode an event row)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EventRow } from "@beep/alchemy-postgres/AlchemyPostgres.schema"
 *
 * const program = S.decodeUnknownEffect(EventRow)({
 *   event: { _tag: "Opened" },
 *   envelope: { id: "a-1", stream: "Account/a-1", seq: 1, at: 0, commandId: "c-1" },
 * })
 * Effect.runPromise(program).then((row) => console.log(row.envelope.seq)) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EventRow extends S.Opaque<EventRow, { readonly brand: unique symbol }>()(
  S.Struct({
    event: S.Unknown,
    envelope: EnvelopeJson,
  }).pipe(
    $I.annoteSchema("EventRow", {
      description: "A committed event as read back from the event table: its JSON and kernel envelope.",
    })
  )
) {}

/**
 * The stored receipt of an accepted command, as the kernel's `SendResult`.
 *
 * **Example** (Decode a receipt)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AcceptedResult } from "@beep/alchemy-postgres/AlchemyPostgres.schema"
 *
 * const program = S.decodeUnknownEffect(AcceptedResult)({
 *   _tag: "Accepted",
 *   receipt: { stream: "Account/a-1", version: 1, events: [], reply: null },
 * })
 * Effect.runPromise(program).then((result) => console.log(result.receipt.version)) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AcceptedResult = S.TaggedStruct("Accepted", {
  receipt: S.Struct({
    stream: S.String,
    version: S.Int,
    events: S.Array(S.Unknown),
    reply: S.Unknown,
  }),
}).pipe(
  $I.annoteSchema("AcceptedResult", {
    description: "The stored receipt of an accepted command, replayed to a duplicate send.",
  })
);

/**
 * Type-level member of {@link AcceptedResult}.
 *
 * @category models
 * @since 0.0.0
 */
export type AcceptedResult = typeof AcceptedResult.Type;

/**
 * The send metadata a scheduled command fires with, as stored.
 *
 * **Example** (Decode stored metadata)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { StoredSendMeta } from "@beep/alchemy-postgres/AlchemyPostgres.schema"
 *
 * const program = S.decodeUnknownEffect(StoredSendMeta)({ commandId: "remind", context: {}, link: true })
 * Effect.runPromise(program).then((meta) => console.log(meta.commandId)) // "remind"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StoredSendMeta extends S.Opaque<StoredSendMeta, { readonly brand: unique symbol }>()(
  S.Struct({
    commandId: S.String,
    context: S.Record(S.String, S.Unknown),
    correlationId: S.optionalKey(S.String),
    trace: S.optionalKey(TraceJson),
    link: S.optionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("StoredSendMeta", {
      description: "Send metadata (command id, encoded request context, flow and trace) kept with a scheduled command.",
    })
  )
) {}

/**
 * Row of the schedule table that a scheduled-command pass fires.
 *
 * **Example** (Decode a schedule row)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ScheduleRow } from "@beep/alchemy-postgres/AlchemyPostgres.schema"
 *
 * const program = S.decodeUnknownEffect(ScheduleRow)({
 *   id: "a-1",
 *   command_id: "remind",
 *   command: { _tag: "Remind" },
 *   meta: { commandId: "remind", context: {} },
 *   status: "pending",
 * })
 * Effect.runPromise(program).then((row) => console.log(row.status)) // "pending"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScheduleRow extends S.Opaque<ScheduleRow, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    command_id: S.String,
    command: S.Unknown,
    meta: StoredSendMeta,
    status: ScheduleStatus,
  }).pipe(
    $I.annoteSchema("ScheduleRow", {
      description: "A scheduled command with its stored metadata and lifecycle status.",
    })
  )
) {}

/**
 * The kernel's `Delivery`, as stored in the outbox.
 *
 * **Example** (Decode a stored delivery)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DeliveryJson } from "@beep/alchemy-postgres/AlchemyPostgres.schema"
 *
 * const program = S.decodeUnknownEffect(DeliveryJson)({
 *   target: { kind: "policy", name: "Provisioning" },
 *   key: "Account/a-1",
 *   source: "Account/a-1",
 *   seq: 1,
 *   origin: "Account",
 *   tag: "Opened",
 *   event: { _tag: "Opened" },
 *   envelope: { id: "a-1", stream: "Account/a-1", seq: 1, at: 0, commandId: "c-1" },
 * })
 * Effect.runPromise(program).then((delivery) => console.log(delivery.target.kind)) // "policy"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeliveryJson extends S.Opaque<DeliveryJson, { readonly brand: unique symbol }>()(
  S.Struct({
    target: S.Struct({
      kind: S.Literals(["view", "policy", "projection"]),
      name: S.String,
      generation: S.Finite.pipe(S.optionalKey),
      inPlace: S.optionalKey(S.Boolean),
    }),
    key: S.String,
    routes: S.Array(S.String).pipe(S.optionalKey),
    source: S.String,
    seq: S.Finite,
    origin: S.String,
    tag: S.String,
    event: S.Unknown,
    envelope: EnvelopeJson,
    state: S.optionalKey(S.Unknown),
    history: S.optionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("DeliveryJson", {
      description: "A unit of work routed from an aggregate to a consumer, as kept in the outbox.",
    })
  )
) {}

/**
 * Row of the outbox the delivery worker drains in position order.
 *
 * **Example** (Decode an outbox row)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DeliveryRow } from "@beep/alchemy-postgres/AlchemyPostgres.schema"
 *
 * const program = S.decodeUnknownEffect(DeliveryRow)({
 *   position: "7",
 *   aggregate: "Account",
 *   delivery: {
 *     target: { kind: "policy", name: "Provisioning" },
 *     key: "Account/a-1",
 *     source: "Account/a-1",
 *     seq: 1,
 *     origin: "Account",
 *     tag: "Opened",
 *     event: { _tag: "Opened" },
 *     envelope: { id: "a-1", stream: "Account/a-1", seq: 1, at: 0, commandId: "c-1" },
 *   },
 * })
 * Effect.runPromise(program).then((row) => console.log(row.position)) // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeliveryRow extends S.Opaque<DeliveryRow, { readonly brand: unique symbol }>()(
  S.Struct({
    position: Int8,
    aggregate: S.String,
    delivery: DeliveryJson,
  }).pipe(
    $I.annoteSchema("DeliveryRow", {
      description: "An outbox row: its position, the aggregate that produced it and the delivery.",
    })
  )
) {}

/**
 * Encode any kernel JSON value as the text a `jsonb` parameter binds.
 *
 * **Example** (Encode a value)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { encodeJson } from "@beep/alchemy-postgres/AlchemyPostgres.schema"
 *
 * Effect.runPromise(encodeJson({ seq: 1 })).then(console.log) // {"seq":1}
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeJson: (value: unknown) => Effect.Effect<string, S.SchemaError> = S.encodeUnknownEffect(
  S.fromJsonString(S.Unknown)
);

const ddl = (sql: SqlClient.SqlClient, tables: AlchemyPostgresTables, prefix: string) => [
  sql`CREATE TABLE IF NOT EXISTS ${sql(tables.hostedModel)} (
    model text PRIMARY KEY,
    legacy_data boolean NOT NULL,
    sagas jsonb NOT NULL,
    built_at bigint NOT NULL
  )`,
  sql`CREATE TABLE IF NOT EXISTS ${sql(tables.aggregateInstance)} (
    model text NOT NULL,
    aggregate text NOT NULL,
    id text NOT NULL,
    state jsonb,
    version integer NOT NULL,
    routed jsonb,
    PRIMARY KEY (model, aggregate, id)
  )`,
  sql`CREATE TABLE IF NOT EXISTS ${sql(tables.aggregateEvent)} (
    model text NOT NULL,
    aggregate text NOT NULL,
    id text NOT NULL,
    seq integer NOT NULL,
    tag text NOT NULL,
    event jsonb NOT NULL,
    envelope jsonb NOT NULL,
    schema_version integer NOT NULL DEFAULT 1,
    command_id text NOT NULL,
    correlation_id text,
    principal text,
    source_kind text,
    context jsonb NOT NULL,
    at bigint NOT NULL,
    PRIMARY KEY (model, aggregate, id, seq)
  )`,
  sql`CREATE TABLE IF NOT EXISTS ${sql(tables.aggregateReceipt)} (
    model text NOT NULL,
    aggregate text NOT NULL,
    id text NOT NULL,
    command_id text NOT NULL,
    result jsonb NOT NULL,
    at bigint NOT NULL,
    PRIMARY KEY (model, aggregate, id, command_id)
  )`,
  sql`CREATE TABLE IF NOT EXISTS ${sql(tables.aggregateSchedule)} (
    model text NOT NULL,
    aggregate text NOT NULL,
    id text NOT NULL,
    command_id text NOT NULL,
    command jsonb NOT NULL,
    meta jsonb NOT NULL,
    due_at bigint NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'executed', 'rejected', 'cancelled')),
    updated_at bigint NOT NULL,
    PRIMARY KEY (model, aggregate, id, command_id)
  )`,
  sql`CREATE INDEX IF NOT EXISTS ${sql(`${prefix}aggregate_schedule_due_idx`)}
    ON ${sql(tables.aggregateSchedule)} (model, aggregate, status, due_at)`,
  sql`CREATE TABLE IF NOT EXISTS ${sql(tables.delivery)} (
    position bigserial PRIMARY KEY,
    model text NOT NULL,
    aggregate text NOT NULL,
    source text NOT NULL,
    source_seq integer NOT NULL,
    target_kind text NOT NULL,
    target_name text NOT NULL,
    target_key text NOT NULL,
    delivery jsonb NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'delivered')),
    attempts integer NOT NULL DEFAULT 0,
    next_attempt_at bigint NOT NULL DEFAULT 0,
    locked_until bigint NOT NULL DEFAULT 0,
    claimed_by text,
    at bigint NOT NULL
  )`,
  sql`CREATE INDEX IF NOT EXISTS ${sql(`${prefix}delivery_pending_idx`)}
    ON ${sql(tables.delivery)} (model, status, position)`,
];

/**
 * Create the driver's tables when they are missing. Idempotent: every
 * statement is `IF NOT EXISTS`, and concurrent migrations serialize on a
 * transaction-scoped advisory lock keyed by the table prefix.
 *
 * **Example** (Migrate on the default prefix)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { AlchemyPostgresConfig } from "@beep/alchemy-postgres/AlchemyPostgres.config"
 * import { migrate } from "@beep/alchemy-postgres/AlchemyPostgres.schema"
 *
 * const program = migrate(AlchemyPostgresConfig.make({}))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category resource-management
 * @since 0.0.0
 */
export const migrate = Effect.fn("AlchemyPostgres.migrate")(
  function* (config: AlchemyPostgresConfig) {
    const sql = yield* SqlClient.SqlClient;
    const tables = AlchemyPostgresTables.of(config);
    yield* sql.withTransaction(
      Effect.gen(function* () {
        yield* sql`SELECT pg_advisory_xact_lock(hashtext(${`${config.tablePrefix}migrate`}))`;
        yield* Effect.forEach(ddl(sql, tables, config.tablePrefix), Effect.asVoid, { discard: true });
      })
    );
  },
  Effect.mapError((cause) => AlchemyPostgresError.fromUnknown("migrate", cause))
);
