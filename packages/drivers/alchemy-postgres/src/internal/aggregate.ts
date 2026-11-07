/**
 * The Postgres aggregate store: one writer per instance, `commandId` dedupe,
 * atomic commit of events, state, receipt and outbox rows, scheduled commands,
 * and the instance's part of catch-up (its directory listing and source role).
 */
import { AlreadyCancelled, AlreadyExecuted, NotScheduled } from "@alchemy.run/domain/Aggregate";
import * as Backfill from "@alchemy.run/domain/Backfill";
import { A, O, P, R } from "@beep/utils";
import * as Effect from "effect/Effect";
import { constant, flow, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { AcceptedResult, EventRow, encodeJson, InstanceRow, ScheduleRow } from "../AlchemyPostgres.schema.ts";
import { orDieAs, rowsOf } from "./host.ts";
import type * as Aggregate from "@alchemy.run/domain/Aggregate";
import type * as DomainPlatform from "@alchemy.run/domain/Platform";
import type { ScheduleStatus } from "../AlchemyPostgres.schema.ts";
import type { HostContext } from "./host.ts";

/** A command the kernel rejected: fails the commit's transaction so it writes nothing. */
class RejectedCommand extends S.TaggedError<RejectedCommand, { readonly brand: unique symbol }>()("RejectedCommand", {
  rejection: S.Unknown,
}) {}

const EventTag = S.Struct({ _tag: S.String });
const decodeEventTag = S.decodeUnknownEffect(EventTag);
const decodeInstances = rowsOf(InstanceRow);
const decodeEvents = rowsOf(EventRow);
const decodeReceipts = rowsOf(S.Struct({ result: AcceptedResult }));
const decodeSchedules = rowsOf(ScheduleRow);
const decodeScheduleRefs = rowsOf(S.Struct({ id: S.String, command_id: S.String }));

/** An event class's current schema version and how it lifts older stored JSON. */
interface EventVersion {
  readonly upcast: O.Option<(fromVersion: number, json: unknown) => unknown>;
  readonly version: number;
}

/**
 * Each event class's static `schemaVersion` (default 1) and optional static
 * `upcast(fromVersion, json)`, by tag.
 */
export const eventVersionsOf = (events: ReadonlyArray<{ readonly tag: string }>) =>
  pipe(
    events,
    A.map((event): readonly [string, EventVersion] => [
      event.tag,
      {
        version: pipe(
          O.liftPredicate(event, P.hasProperty("schemaVersion")),
          O.map(({ schemaVersion }) => schemaVersion),
          O.filter(P.isNumber),
          O.getOrElse(() => 1)
        ),
        upcast: pipe(
          O.liftPredicate(event, P.hasProperty("upcast")),
          O.map(({ upcast }) => upcast),
          O.filter(
            (upcast): upcast is (fromVersion: number, json: unknown) => unknown =>
              P.isFunction(upcast) && upcast.length === 2
          )
        ),
      },
    ]),
    MutableHashMap.fromIterable
  );

/** Lift a stored row's event JSON from the version it was written at to its class's current one. */
export const upcastRow =
  (versions: MutableHashMap.MutableHashMap<string, EventVersion>) =>
  (row: EventRow): DomainPlatform.StoredEvent => {
    const lifted = O.match(MutableHashMap.get(versions, row.tag), {
      onNone: () => row.event,
      onSome: ({ upcast, version }) =>
        O.match(upcast, {
          onNone: () => row.event,
          onSome: (lift) =>
            row.schema_version < version
              ? A.reduce(A.range(row.schema_version, version - 1), row.event, (json, from) => lift(from, json))
              : row.event,
        }),
    });
    return { event: lifted, envelope: row.envelope };
  };

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

/** Host one aggregate type. */
export const makeAggregateStore = (ctx: HostContext) => (definition: Aggregate.Any, kit: DomainPlatform.AggregateKit) =>
  Effect.sync((): DomainPlatform.AggregateStore => {
    const { config, modelName, now, sql, tables } = ctx;
    const name = kit.name;
    const versions = eventVersionsOf(definition.definition.events);
    const schemaVersionOf = (tag: string) =>
      O.getOrElse(
        O.map(MutableHashMap.get(versions, tag), ({ version }) => version),
        constant(1)
      );
    const lift = upcastRow(versions);
    MutableHashMap.set(ctx.delivers, name, kit.deliver);
    const stream = (id: string) => `${name}/${id}`;
    /** One lock per instance: commits and the instance's backfill role hold it. */
    const lockOf = (id: string) => `source:${name}/${id}`;

    const eventsAfter = (id: string, after: number, limit: number) =>
      sql`SELECT tag, schema_version, event, envelope FROM ${sql(tables.aggregateEvent)}
        WHERE model = ${modelName} AND aggregate = ${name} AND id = ${id} AND seq > ${after}
        ORDER BY seq LIMIT ${limit}`.pipe(
        Effect.flatMap(decodeEvents),
        Effect.map(A.map(lift)),
        orDieAs("read")(tables.aggregateEvent)
      );

    const instanceOf = (id: string) =>
      sql`SELECT state, version, routed FROM ${sql(tables.aggregateInstance)}
        WHERE model = ${modelName} AND aggregate = ${name} AND id = ${id}`.pipe(
        Effect.flatMap(decodeInstances),
        Effect.map(A.head),
        orDieAs("read")(tables.aggregateInstance)
      );

    const sourceRoles = MutableHashMap.empty<string, Backfill.Source>();
    const sourceRole = (id: string): Backfill.Source =>
      O.getOrElse(MutableHashMap.get(sourceRoles, id), () => {
        const address = `source:${name}/${id}`;
        const role = Backfill.makeSource(
          ctx.storage(address, lockOf(id)),
          ctx.jobs(address),
          ctx.net,
          {
            ref: { source: name, id },
            model: () => ctx.plans.model,
            singleSource: (target) => ctx.plans.planOf(target)?.singleSource === true,
            log: (after, limit) => eventsAfter(id, after, limit),
            version: Effect.map(
              instanceOf(id),
              flow(
                O.map(({ version }) => version),
                O.getOrElse(constant(0))
              )
            ),
            routed: Effect.map(instanceOf(id), (row) =>
              O.getOrUndefined(O.flatMap(row, ({ routed }) => O.fromNullOr(routed)))
            ),
            markLive: (target) =>
              sql`UPDATE ${sql(tables.aggregateInstance)}
                SET routed = COALESCE(routed, '{}'::jsonb) || jsonb_build_object(${target}::text, version)
                WHERE model = ${modelName} AND aggregate = ${name} AND id = ${id}`.pipe(
                Effect.asVoid,
                orDieAs("backfill")(tables.aggregateInstance)
              ),
          },
          ctx.limits
        );
        MutableHashMap.set(sourceRoles, id, role);
        return role;
      });
    MutableHashMap.set(ctx.sourceRoles, name, sourceRole);

    /** Lock an instance for this transaction, creating its row when it has never committed. */
    const lock = Effect.fnUntraced(function* (id: string) {
      yield* sql`SELECT pg_advisory_xact_lock(hashtext(${ctx.lockKey(lockOf(id))}))`;
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
      const event = yield* encodeJson(stored.event);
      const envelope = yield* encodeJson(stored.envelope);
      const encodedContext = yield* encodeJson(context);
      yield* sql`INSERT INTO ${sql(tables.aggregateEvent)}
        (model, aggregate, id, seq, tag, event, envelope, schema_version, command_id, correlation_id,
         principal, source_kind, context, at)
        VALUES (${modelName}, ${name}, ${id}, ${stored.envelope.seq}, ${_tag}, ${event}::jsonb, ${envelope}::jsonb,
          ${schemaVersionOf(_tag)}, ${stored.envelope.commandId}, ${O.getOrNull(O.fromUndefinedOr(stored.envelope.correlationId))},
          ${principal}, ${sourceKind}, ${encodedContext}::jsonb, ${stored.envelope.at})`;
    });

    /** Persist a decided or seeded change: listing, events, state, cursors and the live deliveries. */
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
      // An instance is listed in the directory before its first commit lands.
      if (before.version === 0) yield* ctx.register({ source: name, id });
      const live = yield* Backfill.routeCommit(
        sourceRole(id),
        kit.targets,
        O.getOrUndefined(O.fromNullOr(before.routed)),
        before.version,
        after.version,
        after.deliveries
      );
      yield* Effect.forEach(after.events, (stored) => insertEvent(id, stored, context), { discard: true });
      const state = yield* encodeJson(after.state);
      const routed = yield* encodeJson(live.routed);
      yield* sql`UPDATE ${sql(tables.aggregateInstance)}
        SET state = ${state}::jsonb, version = ${after.version}, routed = ${routed}::jsonb
        WHERE model = ${modelName} AND aggregate = ${name} AND id = ${id}`;
      yield* ctx.outbox(name, live.send, at);
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
      const encoded = yield* encodeJson(sent);
      yield* sql`INSERT INTO ${sql(tables.aggregateReceipt)} (model, aggregate, id, command_id, result, at)
        VALUES (${modelName}, ${name}, ${id}, ${commandId}, ${encoded}::jsonb, ${at})`;
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
          Effect.catchTag("RejectedCommand", ({ rejection }) =>
            Effect.succeed<DomainPlatform.SendResult>({ _tag: "Rejected", rejection })
          ),
          orDieAs("commit")(tables.aggregateEvent),
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
            const encodedCommand = yield* encodeJson(command);
            const encodedMeta = yield* encodeJson(meta);
            yield* sql`INSERT INTO ${sql(tables.aggregateSchedule)}
              (model, aggregate, id, command_id, command, meta, due_at, status, updated_at)
              VALUES (${modelName}, ${name}, ${id}, ${meta.commandId}, ${encodedCommand}::jsonb,
                ${encodedMeta}::jsonb, ${due_at}, 'pending', ${at})
              ON CONFLICT (model, aggregate, id, command_id) DO UPDATE
              SET command = EXCLUDED.command, meta = EXCLUDED.meta, due_at = EXCLUDED.due_at,
                status = 'pending', updated_at = EXCLUDED.updated_at`;
            return due_at;
          })
        )
        .pipe(orDieAs("schedule")(tables.aggregateSchedule));

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
            const at = yield* now;
            yield* sql`UPDATE ${sql(tables.aggregateSchedule)} SET status = 'cancelled', updated_at = ${at}
              WHERE model = ${modelName} AND aggregate = ${name} AND id = ${id} AND command_id = ${commandId}`;
          })
        )
        .pipe(orDieAs("unschedule")(tables.aggregateSchedule));

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
        .pipe(orDieAs("schedule")(tables.aggregateSchedule));

    const fireDue = Effect.gen(function* () {
      const at = yield* now;
      const rows = yield* sql`SELECT id, command_id FROM ${sql(tables.aggregateSchedule)}
        WHERE model = ${modelName} AND aggregate = ${name} AND status = 'pending' AND due_at <= ${at}
        ORDER BY due_at`.pipe(Effect.flatMap(decodeScheduleRefs));
      yield* Effect.forEach(rows, (row) => fire(row.id, row.command_id), { discard: true });
    }).pipe(orDieAs("schedule")(tables.aggregateSchedule));

    ctx.workers.push(
      Effect.forever(
        fireDue.pipe(Effect.catchCause(ctx.logFailure(`${name} schedule pass`)), Effect.andThen(Effect.sleep(ctx.poll)))
      )
    );

    const state = (id: string) =>
      Effect.map(
        instanceOf(id),
        O.match({
          onNone: () => ({ state: null, version: 0 }),
          onSome: ({ state, version }) => ({ state, version }),
        })
      );

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
        .pipe(orDieAs("commit")(tables.aggregateEvent));

    const all = 2_147_483_647;
    return {
      send,
      schedule,
      unschedule,
      state,
      events: (id) => eventsAfter(id, 0, all),
      changes: (id) =>
        Stream.fromEffectSchedule(state(id), Schedule.spaced(ctx.poll)).pipe(
          Stream.changesWith((left, right) => left.version === right.version)
        ),
      tail: (id, after) =>
        ctx.pollTail(
          (last) => eventsAfter(id, last, all),
          ({ envelope }) => envelope.seq
        )(after),
      seed,
    };
  });
