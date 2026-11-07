/**
 * Postgres `Platform` for `@alchemy.run/domain`: aggregates and policies hosted
 * on any effect/sql `SqlClient` speaking Postgres (Postgres itself or PGlite).
 *
 * **Details**
 *
 * Semantics follow the installed beta.85 `Platform` contract, with
 * `Domain.InMemory` as the executable reference: one writer per aggregate
 * instance (`SELECT ... FOR UPDATE` on its instance row inside one
 * transaction), `commandId` dedupe through stored receipts, an atomic commit
 * of events, state, receipt and outbox deliveries, then delivery at least once
 * in outbox order. Outbox rows are claimed with `FOR UPDATE SKIP LOCKED` under
 * a per-host lease (`locked_until`, `claimed_by`), and only the oldest pending
 * row of each `(source, target)` is claimable, so several hosts on one
 * database deliver each row once and in order. A failed delivery stays
 * pending with bounded backoff and holds the rows behind it. Scheduled
 * commands are rows fired by a polling worker through the same commit path.
 * Live reads (`changes`, `tail`) poll at `pollMillis`.
 *
 * **Gotchas**
 *
 * Views, projections and streams are not hosted yet: hosting a model that
 * declares one dies with {@link AlchemyPostgresUnsupported}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AlreadyCancelled, AlreadyExecuted, NotScheduled } from "@alchemy.run/domain/Aggregate";
import { routeLive } from "@alchemy.run/domain/CatchUp";
import { hostedModels, Platform } from "@alchemy.run/domain/Platform";
import { A, O, P, R } from "@beep/utils";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as Queue from "effect/Queue";
import * as Random from "effect/Random";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlError from "effect/sql/SqlError";
import * as Tuple from "effect/Tuple";
import { AlchemyPostgresConfig } from "./AlchemyPostgres.config.ts";
import { AlchemyPostgresError, AlchemyPostgresUnsupported } from "./AlchemyPostgres.errors.ts";
import {
  AcceptedResult,
  AlchemyPostgresTables,
  DeliveryRow,
  EventRow,
  encodeJson,
  InstanceRow,
  migrate,
  ScheduleRow,
} from "./AlchemyPostgres.schema.ts";
import type * as Aggregate from "@alchemy.run/domain/Aggregate";
import type * as DomainPlatform from "@alchemy.run/domain/Platform";
import type * as Cause from "effect/Cause";
import type { AlchemyPostgresConcept, AlchemyPostgresOperation } from "./AlchemyPostgres.errors.ts";
import type { ScheduleStatus } from "./AlchemyPostgres.schema.ts";

/** A command the kernel rejected: fails the commit's transaction so it writes nothing. */
class RejectedCommand extends S.TaggedError<RejectedCommand, { readonly brand: unique symbol }>()("RejectedCommand", {
  rejection: S.Unknown,
}) {}

const EventTag = S.Struct({ _tag: S.String });
const decodeEventTag = S.decodeUnknownEffect(EventTag);
const decodeInstances = S.decodeUnknownEffect(S.Array(InstanceRow));
const decodeEvents = S.decodeUnknownEffect(S.Array(EventRow));
const decodeReceipts = S.decodeUnknownEffect(S.Array(S.Struct({ result: AcceptedResult })));
const decodeSchedules = S.decodeUnknownEffect(S.Array(ScheduleRow));
const decodeDeliveries = S.decodeUnknownEffect(S.Array(DeliveryRow));
const ScheduleRef = S.Struct({ id: S.String, command_id: S.String });
const decodeScheduleRefs = S.decodeUnknownEffect(S.Array(ScheduleRef));

/** SQL and row-decoding failures: infrastructure, never domain outcomes. */
const isStorageError = (error: unknown): error is SqlError.SqlError | S.SchemaError =>
  SqlError.isSqlError(error) || S.isSchemaError(error);

/** Turn a storage failure into a typed defect: the kernel's store methods have no error channel. */
const orDieAs =
  (operation: AlchemyPostgresOperation, table: string) =>
  <A, E, R>(
    self: Effect.Effect<A, E | SqlError.SqlError | S.SchemaError, R>
  ): Effect.Effect<A, Exclude<E, SqlError.SqlError | S.SchemaError>, R> =>
    Effect.catchIf(
      self,
      isStorageError,
      (cause) => Effect.die(AlchemyPostgresError.fromUnknown(operation, cause, table)),
      Effect.fail
    );

/** Each event class's static `schemaVersion` by tag, defaulting to 1. */
const schemaVersionsOf = (aggregate: Aggregate.Any) =>
  pipe(
    aggregate.definition.events,
    A.map((event) =>
      pipe(
        O.liftPredicate(event, P.hasProperty("schemaVersion")),
        O.map(({ schemaVersion }) => schemaVersion),
        O.filter(P.isNumber),
        O.getOrElse(() => 1),
        (version) => Tuple.make(event.tag, version)
      )
    ),
    MutableHashMap.fromIterable
  );

/** A string field of one encoded request-context service. */
const contextField = (context: Readonly<Record<string, unknown>>, key: string, field: string): string | null =>
  pipe(
    R.get(context, key),
    O.filter(P.isObject),
    O.flatMap((value) => R.get(value, field)),
    O.filter(P.isString),
    O.getOrNull
  );

const dueAt = (now: number) =>
  Match.type<Aggregate.Due>().pipe(
    Match.when({ at: Match.number }, ({ at }) => at),
    Match.orElse(({ afterMillis }) => now + afterMillis)
  );

/** How long a claimed outbox row stays leased to the host delivering it. */
const deliveryLeaseMillis = Duration.toMillis(Duration.seconds(30));
/** The longest a failed delivery waits before its next attempt. */
const retryCeilingMillis = Duration.toMillis(Duration.minutes(1));
const byPosition = Order.mapInput(Order.Number, (row: DeliveryRow) => row.position);

const unsupported = (concept: AlchemyPostgresConcept, name: string) =>
  Effect.die(AlchemyPostgresUnsupported.make({ concept, definition: name }));

interface HostDeps {
  readonly config: AlchemyPostgresConfig;
  readonly modelName: string;
  readonly now: Effect.Effect<number>;
  /** This host's id, written on the outbox rows it leases. */
  readonly owner: string;
  readonly scope: Scope.Scope;
  readonly sql: SqlClient.SqlClient;
  readonly tables: AlchemyPostgresTables;
  /** Wakes the delivery worker after a commit; polling covers other processes. */
  readonly wake: Queue.Queue<void>;
}

const makeHost = (deps: HostDeps): DomainPlatform.ModelHost => {
  const { config, modelName, now, owner, scope, sql, tables, wake } = deps;
  const poll = Duration.millis(config.pollMillis);
  const signal = Queue.offer(wake, undefined).pipe(Effect.asVoid);
  /** Each aggregate's `deliver`, by aggregate name: the outbox row names its producer. */
  const delivers = MutableHashMap.empty<string, (delivery: DomainPlatform.Delivery) => Effect.Effect<void>>();
  /** Background passes started once every store is built. */
  const workers: Array<Effect.Effect<void>> = [];

  /**
   * Claim the next deliverable outbox rows for this host: the oldest pending row
   * of each `(source, target)` whose retry is due and that no host holds a lease
   * on. `FOR UPDATE SKIP LOCKED` plus the lease keep two hosts on one database
   * from claiming one row; heads-only keeps every `(source, target)` in order.
   * Rows from aggregates this host does not run wait for a host that does.
   */
  const claim = Effect.fnUntraced(function* (at: number, hosted: A.NonEmptyReadonlyArray<string>) {
    const rows = yield* sql`UPDATE ${sql(tables.delivery)}
      SET locked_until = ${at + deliveryLeaseMillis}, claimed_by = ${owner}
      WHERE position IN (
        SELECT head.position FROM ${sql(tables.delivery)} head
        WHERE head.model = ${modelName} AND head.status = 'pending' AND head.aggregate IN ${sql.in(hosted)}
          AND head.next_attempt_at <= ${at} AND head.locked_until <= ${at}
          AND NOT EXISTS (
            SELECT 1 FROM ${sql(tables.delivery)} earlier
            WHERE earlier.model = head.model AND earlier.status = 'pending'
              AND earlier.source = head.source AND earlier.target_kind = head.target_kind
              AND earlier.target_name = head.target_name AND earlier.position < head.position
          )
        ORDER BY head.position LIMIT ${config.deliveryBatchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING position, aggregate, delivery`.pipe(Effect.flatMap(decodeDeliveries));
    return A.sort(rows, byPosition);
  });

  const acknowledge = (row: DeliveryRow) =>
    sql`UPDATE ${sql(tables.delivery)} SET status = 'delivered', attempts = attempts + 1, locked_until = 0
      WHERE position = ${row.position} AND claimed_by = ${owner}`;

  /** A failed run stays pending: count the attempt, back off, and release the lease. */
  const retryLater = Effect.fnUntraced(function* (row: DeliveryRow, cause: Cause.Cause<unknown>) {
    const at = yield* now;
    yield* Effect.logError(
      `alchemy-postgres ${modelName} delivery ${row.position} to ${row.delivery.target.kind} ${row.delivery.target.name} failed; retrying`,
      cause
    );
    yield* sql`UPDATE ${sql(tables.delivery)}
      SET attempts = attempts + 1, locked_until = 0,
        next_attempt_at = ${at} + LEAST(${config.pollMillis} * POWER(2, attempts)::bigint, ${retryCeilingMillis})
      WHERE position = ${row.position} AND claimed_by = ${owner}`;
  });

  const release = (rows: ReadonlyArray<DeliveryRow>) =>
    A.match(rows, {
      onEmpty: () => Effect.void,
      onNonEmpty: (left) =>
        sql`UPDATE ${sql(tables.delivery)} SET locked_until = 0
          WHERE ${sql.in(
            "position",
            A.map(left, ({ position }) => position)
          )} AND claimed_by = ${owner}`.pipe(Effect.asVoid),
    });

  /** Deliver claimed rows in position order; the first failure stops the pass and frees the rest. */
  const deliverAll = (rows: ReadonlyArray<DeliveryRow>): Effect.Effect<boolean, SqlError.SqlError> =>
    A.match(rows, {
      onEmpty: () => Effect.succeed(true),
      onNonEmpty: ([row, ...rest]) =>
        Effect.exit(deliverRow(row)).pipe(
          Effect.flatMap(
            Exit.match({
              onSuccess: () => acknowledge(row).pipe(Effect.andThen(deliverAll(rest))),
              onFailure: (cause) => retryLater(row, cause).pipe(Effect.andThen(release(rest)), Effect.as(false)),
            })
          )
        ),
    });

  /** Route one claimed row through its producer's kit; `claim` only returns rows of hosted producers. */
  const deliverRow = (row: DeliveryRow) =>
    O.match(MutableHashMap.get(delivers, row.aggregate), {
      onNone: () => Effect.die(AlchemyPostgresError.fromUnknown("deliver", undefined, tables.delivery)),
      onSome: (deliver) => deliver(row.delivery),
    });

  /** One pass: claim, deliver; another pass follows while every claimed row was delivered. */
  const drainOnce = Effect.gen(function* () {
    const at = yield* now;
    const hosted = A.fromIterable(MutableHashMap.keys(delivers));
    const rows = A.isReadonlyArrayNonEmpty(hosted) ? yield* claim(at, hosted) : [];
    const completed = yield* deliverAll(rows);
    return completed && A.isReadonlyArrayNonEmpty(rows);
  }).pipe(orDieAs("deliver", tables.delivery));

  /** Deliver pending outbox rows in position order, one at a time, until none are left. */
  const drain: Effect.Effect<void> = Effect.repeat(drainOnce, { while: P.isTruthy }).pipe(Effect.asVoid);

  const deliveryWorker = Effect.forever(
    Queue.take(wake).pipe(
      Effect.timeoutOption(poll),
      Effect.andThen(drain),
      Effect.catchCause((cause) => Effect.logError(`alchemy-postgres ${modelName} delivery pass failed`, cause))
    )
  );

  const aggregate = (definition: Aggregate.Any, kit: DomainPlatform.AggregateKit) =>
    Effect.sync((): DomainPlatform.AggregateStore => {
      const name = kit.name;
      const versions = schemaVersionsOf(definition);
      const schemaVersionOf = (tag: string) => O.getOrElse(MutableHashMap.get(versions, tag), () => 1);
      MutableHashMap.set(delivers, name, kit.deliver);
      const stream = (id: string) => `${name}/${id}`;

      /** Lock an instance's row for this transaction, creating it when it has never committed. */
      const lock = Effect.fnUntraced(function* (id: string) {
        yield* sql`INSERT INTO ${sql(tables.aggregateInstance)} (model, aggregate, id, state, version)
          VALUES (${modelName}, ${name}, ${id}, NULL, 0) ON CONFLICT DO NOTHING`;
        const rows = yield* sql`SELECT state, version, routed FROM ${sql(tables.aggregateInstance)}
          WHERE model = ${modelName} AND aggregate = ${name} AND id = ${id} FOR UPDATE`.pipe(
          Effect.flatMap(decodeInstances)
        );
        return yield* Effect.fromOption(A.head(rows)).pipe(Effect.orDie);
      });

      const receiptOf = Effect.fnUntraced(function* (id: string, commandId: string) {
        const rows = yield* sql`SELECT result FROM ${sql(tables.aggregateReceipt)}
          WHERE model = ${modelName} AND aggregate = ${name} AND id = ${id} AND command_id = ${commandId}`.pipe(
          Effect.flatMap(decodeReceipts)
        );
        return O.map(A.head(rows), ({ result }): DomainPlatform.SendResult => result);
      });

      const insertEvent = Effect.fnUntraced(function* (
        id: string,
        stored: DomainPlatform.StoredEvent,
        context: Readonly<Record<string, unknown>>
      ) {
        const { _tag } = yield* decodeEventTag(stored.event);
        const principal = O.match(config.provenance, {
          onNone: () => null,
          onSome: (mapping) => contextField(context, mapping.contextKey, mapping.principalField),
        });
        const sourceKind = O.match(config.provenance, {
          onNone: () => null,
          onSome: (mapping) => contextField(context, mapping.contextKey, mapping.sourceKindField),
        });
        yield* sql`INSERT INTO ${sql(tables.aggregateEvent)}
          (model, aggregate, id, seq, tag, event, envelope, schema_version, command_id, correlation_id,
           principal, source_kind, context, at)
          VALUES (${modelName}, ${name}, ${id}, ${stored.envelope.seq}, ${_tag},
            ${yield* encodeJson(stored.event)}::jsonb, ${yield* encodeJson(stored.envelope)}::jsonb,
            ${schemaVersionOf(_tag)}, ${stored.envelope.commandId}, ${stored.envelope.correlationId ?? null},
            ${principal}, ${sourceKind}, ${yield* encodeJson(context)}::jsonb, ${stored.envelope.at})`;
      });

      const insertDelivery = Effect.fnUntraced(function* (delivery: DomainPlatform.Delivery, at: number) {
        yield* sql`INSERT INTO ${sql(tables.delivery)}
          (model, aggregate, source, source_seq, target_kind, target_name, target_key, delivery, status, at)
          VALUES (${modelName}, ${name}, ${delivery.source}, ${delivery.seq}, ${delivery.target.kind},
            ${delivery.target.name}, ${delivery.key}, ${yield* encodeJson(delivery)}::jsonb, 'pending', ${at})`;
      });

      /** Persist a decided or seeded change: events, state, cursors and the live deliveries. */
      const persist = Effect.fnUntraced(function* (
        id: string,
        before: InstanceRow,
        after: {
          readonly state: unknown;
          readonly version: number;
          readonly events: ReadonlyArray<DomainPlatform.StoredEvent>;
          readonly deliveries: ReadonlyArray<DomainPlatform.Delivery>;
        },
        context: Readonly<Record<string, unknown>>,
        at: number
      ) {
        const live = routeLive(
          kit.targets,
          O.getOrUndefined(O.fromNullOr(before.routed)),
          before.version,
          after.version,
          after.deliveries
        );
        yield* Effect.forEach(after.events, (stored) => insertEvent(id, stored, context), { discard: true });
        yield* sql`UPDATE ${sql(tables.aggregateInstance)}
          SET state = ${yield* encodeJson(after.state)}::jsonb, version = ${after.version},
            routed = ${yield* encodeJson(live.routed)}::jsonb
          WHERE model = ${modelName} AND aggregate = ${name} AND id = ${id}`;
        yield* Effect.forEach(live.deliveries, (delivery) => insertDelivery(delivery, at), { discard: true });
      });

      /** Decide a command on a locked instance and persist it; a rejection fails with {@link RejectedCommand}. */
      const commitLocked = Effect.fnUntraced(function* (
        id: string,
        current: InstanceRow,
        command: DomainPlatform.Json,
        meta: Aggregate.SendMeta
      ) {
        const at = yield* now;
        const { commandId, context, ...flow } = meta;
        const result = yield* kit.handle({
          id,
          state: current.state,
          version: current.version,
          command,
          commandId,
          context,
          now: at,
          ...flow,
        });
        if (result._tag === "Rejected") return yield* RejectedCommand.make({ rejection: result.rejection });
        yield* persist(id, current, result, context, at);
        const sent: DomainPlatform.SendResult = {
          _tag: "Accepted",
          receipt: {
            stream: stream(id),
            version: result.version,
            events: A.map(result.events, ({ event }) => event),
            reply: result.reply,
          },
        };
        yield* sql`INSERT INTO ${sql(tables.aggregateReceipt)} (model, aggregate, id, command_id, result, at)
          VALUES (${modelName}, ${name}, ${id}, ${commandId}, ${yield* encodeJson(sent)}::jsonb, ${at})`;
        return sent;
      });

      const send = (id: string, command: DomainPlatform.Json, meta: Aggregate.SendMeta) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              const current = yield* lock(id);
              const duplicate = yield* receiptOf(id, meta.commandId);
              return yield* O.match(duplicate, {
                onNone: () => commitLocked(id, current, command, meta),
                onSome: Effect.succeed,
              });
            })
          )
          .pipe(
            Effect.tap(() => signal),
            Effect.catchTag("RejectedCommand", ({ rejection }) =>
              Effect.succeed<DomainPlatform.SendResult>({ _tag: "Rejected", rejection })
            ),
            orDieAs("commit", tables.aggregateEvent),
            Effect.withSpan("AlchemyPostgresPlatform.send", { attributes: { aggregate: name, id } })
          );

      const executed = (id: string, commandId: string) => Effect.map(receiptOf(id, commandId), O.isSome);

      const schedule = (id: string, command: DomainPlatform.Json, meta: Aggregate.SendMeta, due: Aggregate.Due) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              yield* lock(id);
              if (yield* executed(id, meta.commandId))
                return yield* new AlreadyExecuted({ aggregate: name, id, commandId: meta.commandId });
              const at = yield* now;
              const due_at = dueAt(at)(due);
              yield* sql`INSERT INTO ${sql(tables.aggregateSchedule)}
                (model, aggregate, id, command_id, command, meta, due_at, status, updated_at)
                VALUES (${modelName}, ${name}, ${id}, ${meta.commandId}, ${yield* encodeJson(command)}::jsonb,
                  ${yield* encodeJson(meta)}::jsonb, ${due_at}, 'pending', ${at})
                ON CONFLICT (model, aggregate, id, command_id) DO UPDATE
                SET command = EXCLUDED.command, meta = EXCLUDED.meta, due_at = EXCLUDED.due_at,
                  status = 'pending', updated_at = EXCLUDED.updated_at`;
              return due_at;
            })
          )
          .pipe(orDieAs("schedule", tables.aggregateSchedule));

      const scheduleRow = Effect.fnUntraced(function* (id: string, commandId: string) {
        const rows = yield* sql`SELECT id, command_id, command, meta, status FROM ${sql(tables.aggregateSchedule)}
          WHERE model = ${modelName} AND aggregate = ${name} AND id = ${id} AND command_id = ${commandId}
          FOR UPDATE`.pipe(Effect.flatMap(decodeSchedules));
        return A.head(rows);
      });

      const unschedule = (id: string, commandId: string) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              yield* lock(id);
              const fields = { aggregate: name, id, commandId };
              if (yield* executed(id, commandId)) return yield* new AlreadyExecuted(fields);
              const row = yield* scheduleRow(id, commandId);
              if (O.exists(row, ({ status }) => status === "cancelled")) return yield* new AlreadyCancelled(fields);
              if (!O.exists(row, ({ status }) => status === "pending")) return yield* new NotScheduled(fields);
              yield* sql`UPDATE ${sql(tables.aggregateSchedule)} SET status = 'cancelled', updated_at = ${yield* now}
                WHERE model = ${modelName} AND aggregate = ${name} AND id = ${id} AND command_id = ${commandId}`;
            })
          )
          .pipe(orDieAs("unschedule", tables.aggregateSchedule));

      /** Fire one due scheduled command under the instance lock, unless it was cancelled or already ran. */
      const fire = (id: string, commandId: string) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              const current = yield* lock(id);
              const row = yield* scheduleRow(id, commandId);
              const pending = O.filter(row, ({ status }) => status === "pending");
              if (O.isNone(pending)) return;
              const { command, meta } = pending.value;
              const alreadyRan = yield* executed(id, commandId);
              // Executed only with a receipt. A rejection writes none, so like InMemory the
              // command id stays free: `unschedule` says NotScheduled and `schedule` re-arms it.
              const status: ScheduleStatus = alreadyRan
                ? "executed"
                : yield* commitLocked(id, current, command, meta).pipe(
                    Effect.as<ScheduleStatus>("executed"),
                    Effect.catchTag("RejectedCommand", ({ rejection }) =>
                      Effect.logWarning(
                        `alchemy-postgres scheduled ${name}/${id} ${commandId} was rejected`,
                        rejection
                      ).pipe(Effect.as<ScheduleStatus>("rejected"))
                    )
                  );
              const at = yield* now;
              yield* sql`UPDATE ${sql(tables.aggregateSchedule)} SET status = ${status}, updated_at = ${at}
                WHERE model = ${modelName} AND aggregate = ${name} AND id = ${id} AND command_id = ${commandId}`;
            })
          )
          .pipe(Effect.andThen(signal), orDieAs("schedule", tables.aggregateSchedule));

      const fireDue = Effect.gen(function* () {
        const rows = yield* sql`SELECT id, command_id FROM ${sql(tables.aggregateSchedule)}
          WHERE model = ${modelName} AND aggregate = ${name} AND status = 'pending' AND due_at <= ${yield* now}
          ORDER BY due_at`.pipe(Effect.flatMap(decodeScheduleRefs));
        yield* Effect.forEach(rows, (row) => fire(row.id, row.command_id), { discard: true });
      }).pipe(orDieAs("schedule", tables.aggregateSchedule));

      workers.push(
        Effect.forever(
          fireDue.pipe(
            Effect.catchCause((cause) =>
              Effect.logError(`alchemy-postgres ${modelName}/${name} schedule pass failed`, cause)
            ),
            Effect.andThen(Effect.sleep(poll))
          )
        )
      );

      const state = (id: string) =>
        sql`SELECT state, version, routed FROM ${sql(tables.aggregateInstance)}
          WHERE model = ${modelName} AND aggregate = ${name} AND id = ${id}`.pipe(
          Effect.flatMap(decodeInstances),
          Effect.map((rows) =>
            O.match(A.head(rows), {
              onNone: () => ({ state: null, version: 0 }),
              onSome: ({ state, version }) => ({ state, version }),
            })
          ),
          orDieAs("read", tables.aggregateInstance)
        );

      const eventsAfter = (id: string, after: number): Effect.Effect<ReadonlyArray<DomainPlatform.StoredEvent>> =>
        sql`SELECT event, envelope FROM ${sql(tables.aggregateEvent)}
          WHERE model = ${modelName} AND aggregate = ${name} AND id = ${id} AND seq > ${after}
          ORDER BY seq`.pipe(Effect.flatMap(decodeEvents), orDieAs("read", tables.aggregateEvent));

      const seed = (id: string, events: ReadonlyArray<DomainPlatform.Json>) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              const current = yield* lock(id);
              const at = yield* now;
              const result = yield* kit.seed({
                id,
                state: current.state,
                version: current.version,
                events,
                commandId: `seed:${id}:${current.version}`,
                now: at,
              });
              yield* persist(id, current, result, {}, at);
            })
          )
          .pipe(Effect.andThen(signal), orDieAs("commit", tables.aggregateEvent));

      return {
        send,
        schedule,
        unschedule,
        state,
        events: (id) => eventsAfter(id, 0),
        changes: (id) =>
          Stream.fromEffectSchedule(state(id), Schedule.spaced(poll)).pipe(
            Stream.changesWith((left, right) => left.version === right.version)
          ),
        tail: (id, after) =>
          Stream.unwrap(
            Effect.map(Ref.make(after), (cursor) =>
              Stream.fromEffectSchedule(
                Ref.get(cursor).pipe(
                  Effect.flatMap((last) => eventsAfter(id, last)),
                  Effect.tap((fresh) =>
                    O.match(A.last(fresh), {
                      onNone: () => Effect.void,
                      onSome: ({ envelope }) => Ref.set(cursor, envelope.seq),
                    })
                  )
                ),
                Schedule.spaced(poll)
              ).pipe(Stream.flatMap(Stream.fromIterable))
            )
          ),
        seed,
      };
    });

  const policy = (_definition: unknown, kit: DomainPlatform.PolicyKit) =>
    Effect.sync((): DomainPlatform.PolicyStore => {
      const locks = MutableHashMap.empty<string, Semaphore.Semaphore>();
      const lockFor = (key: string) =>
        O.getOrElse(MutableHashMap.get(locks, key), () => {
          const created = Semaphore.makeUnsafe(1);
          MutableHashMap.set(locks, key, created);
          return created;
        });
      return {
        // The outbox marks a delivery done only after this succeeds: at least once, in order per key.
        // A failed run fails the delivery: the outbox keeps the row pending and retries it.
        receive: (delivery) => lockFor(delivery.key).withPermits(1)(kit.run(delivery)),
      };
    });

  return {
    aggregate,
    policy,
    view: (_definition, kit) => unsupported("view", kit.name),
    projection: (_definition, kit) => unsupported("projection", kit.name),
    stream: (_definition, kit) => unsupported("stream", kit.name),
    // Every store is built: deliveries now find their targets hosted.
    start: () =>
      Effect.forEach([deliveryWorker, ...workers], (worker) => Effect.forkIn(worker, scope), { discard: true }),
  };
};

const make = Effect.fn("AlchemyPostgresPlatform.make")(function* (config: AlchemyPostgresConfig) {
  const sql = yield* SqlClient.SqlClient;
  const clock = yield* Clock.Clock;
  yield* migrate(config);
  const tables = AlchemyPostgresTables.of(config);
  const claim = hostedModels({ release: true });
  const model = Effect.fn("AlchemyPostgresPlatform.model")(function* (hosted: DomainPlatform.HostedModel) {
    yield* claim(hosted.modelName, hosted.id);
    const scope = yield* Scope.Scope;
    const now = clock.currentTimeMillis;
    const builtAt = yield* now;
    const sagas = yield* encodeJson(hosted.sagas).pipe(Effect.orDie);
    yield* sql`INSERT INTO ${sql(tables.hostedModel)} (model, legacy_data, sagas, built_at)
      VALUES (${hosted.modelName}, ${hosted.legacyData}, ${sagas}::jsonb, ${builtAt})
      ON CONFLICT (model) DO UPDATE
      SET legacy_data = EXCLUDED.legacy_data, sagas = EXCLUDED.sagas, built_at = EXCLUDED.built_at`.pipe(
      orDieAs("claim", tables.hostedModel)
    );
    const wake = yield* Queue.sliding<void>(1);
    const nonce = yield* Random.nextInt;
    const owner = `${hosted.modelName}:${builtAt}:${nonce}`;
    return makeHost({ sql, tables, config, now, owner, scope, modelName: hosted.modelName, wake });
  });
  return Platform.of({ model });
});

/**
 * Host `@alchemy.run/domain` models on Postgres: the `Platform` service over the
 * ambient effect/sql `SqlClient`, with the driver's tables migrated when the
 * Layer is built.
 *
 * **Details**
 *
 * Provenance columns are filled from `meta.context` per `config.provenance`;
 * each event row's `schema_version` is its class's static `schemaVersion`
 * (default 1). Hosting two different models with the same name on one built
 * platform dies, as upstream.
 *
 * **Example** (Build the platform Layer)
 *
 * ```ts
 * import { AlchemyPostgresConfig } from "@beep/alchemy-postgres/AlchemyPostgres.config"
 * import * as AlchemyPostgresPlatform from "@beep/alchemy-postgres/AlchemyPostgresPlatform"
 * import * as Layer from "effect/Layer"
 *
 * // Provide an effect/sql `SqlClient` (Postgres or PGlite) to finish it.
 * const PlatformLive = AlchemyPostgresPlatform.layer(AlchemyPostgresConfig.make({ pollMillis: 50 }))
 * console.log(Layer.isLayer(PlatformLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = (
  config: AlchemyPostgresConfig = AlchemyPostgresConfig.make({})
): Layer.Layer<Platform, AlchemyPostgresError, SqlClient.SqlClient> => Layer.effect(Platform)(make(config));
