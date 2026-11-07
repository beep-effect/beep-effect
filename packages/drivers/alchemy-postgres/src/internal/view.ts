/**
 * The Postgres view store, mirroring `Domain.InMemory`'s: one writer per key,
 * snapshot, entries, input log and downstream outbox rows persisted together,
 * a rebuilt generation starting every key over, and the key's consumer and
 * source parts of catch-up.
 */
import * as Backfill from "@alchemy.run/domain/Backfill";
import { emptySnapshot } from "@alchemy.run/domain/Platform";
import { A, O } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { encodeJson, ViewEntryJson, ViewSnapshotJson } from "../AlchemyPostgres.schema.ts";
import { orDieAs, rowsOf } from "./host.ts";
import type * as DomainPlatform from "@alchemy.run/domain/Platform";
import type * as View from "@alchemy.run/domain/View";
import type { HostContext } from "./host.ts";

const decodeKeys = rowsOf(S.Struct({ snapshot: ViewSnapshotJson, routed: S.NullOr(S.Record(S.String, S.Finite)) }));
const decodeEntries = rowsOf(ViewEntryJson);
/** `COALESCE(MAX(...), 0)` always answers one row. */
const decodeCount = S.decodeUnknownEffect(S.NonEmptyArray(S.Struct({ position: S.Int })));

const all = 2_147_483_647;

/** Host one view. */
export const makeViewStore = (ctx: HostContext) => (_definition: View.Any, kit: DomainPlatform.ViewKit) =>
  Effect.gen(function* () {
    const { modelName, now, sql, tables } = ctx;
    const name = kit.name;
    const consumerId = `view:${name}`;
    const orDie = orDieAs("receive")(tables.viewKey);
    // Rebuilt (a new generation): start every key over; the history is replayed to it.
    yield* ctx.resetConsumer(
      consumerId,
      kit.generation,
      Effect.all(
        [
          sql`DELETE FROM ${sql(tables.viewKey)} WHERE model = ${modelName} AND view = ${name}`,
          sql`DELETE FROM ${sql(tables.viewEntry)} WHERE model = ${modelName} AND view = ${name}`,
          sql`DELETE FROM ${sql(tables.consumerInput)} WHERE model = ${modelName} AND consumer = ${consumerId}`,
        ],
        { discard: true }
      )
    );
    const target = kit.target;
    /** One lock per key: applying, and the key's consumer and source roles, hold it. */
    const lockOf = (key: string) => `view:${name}/${key}`;
    MutableHashMap.set(ctx.delivers, consumerId, kit.deliver);

    const keyRow = (key: string) =>
      sql`SELECT snapshot, routed FROM ${sql(tables.viewKey)}
        WHERE model = ${modelName} AND view = ${name} AND key = ${key}`.pipe(
        Effect.flatMap(decodeKeys),
        Effect.map(A.head),
        orDie
      );
    const snapshotOf = (key: string) =>
      Effect.map(
        keyRow(key),
        O.match({ onNone: (): DomainPlatform.ViewSnapshot => emptySnapshot, onSome: ({ snapshot }) => snapshot })
      );
    const entriesAfter = (key: string, after: number, limit: number) =>
      sql`SELECT seq, event, envelope, state FROM ${sql(tables.viewEntry)}
        WHERE model = ${modelName} AND view = ${name} AND key = ${key} AND seq > ${after}
        ORDER BY seq LIMIT ${limit}`.pipe(Effect.flatMap(decodeEntries), orDie);

    /** Apply deliveries to a key and route what it emits, in one transaction holding the key's lock. */
    const apply = (key: string, deliveries: ReadonlyArray<DomainPlatform.Delivery>): Effect.Effect<void> =>
      ctx
        .exclusive(lockOf(key))(
          Effect.gen(function* () {
            const current = yield* keyRow(key);
            const before = O.match(current, {
              onNone: (): DomainPlatform.ViewSnapshot => emptySnapshot,
              onSome: ({ snapshot }) => snapshot,
            });
            const result = yield* kit.apply(key, before, deliveries);
            if (!result.changed) return;
            const at = yield* now;
            const fresh = A.filter(deliveries, (delivery) => (before.checkpoints[delivery.source] ?? 0) < delivery.seq);
            const last = yield* sql`SELECT COALESCE(MAX(position), 0)::int AS position FROM ${sql(tables.consumerInput)}
              WHERE model = ${modelName} AND consumer = ${consumerId} AND key = ${key}`.pipe(
              Effect.flatMap(decodeCount),
              Effect.map((rows) => A.headNonEmpty(rows).position)
            );
            yield* Effect.forEach(
              fresh,
              (delivery, index) =>
                Effect.flatMap(
                  encodeJson(delivery),
                  (json) => sql`INSERT INTO ${sql(tables.consumerInput)}
                    (model, consumer, key, position, source, source_seq, delivery, at)
                    VALUES (${modelName}, ${consumerId}, ${key}, ${last + index + 1}, ${delivery.source},
                      ${delivery.seq}, ${json}::jsonb, ${at})`
                ),
              { discard: true }
            );
            yield* Effect.forEach(
              result.entries,
              Effect.fnUntraced(function* (entry) {
                const event = yield* encodeJson(entry.event);
                const envelope = yield* encodeJson(entry.envelope);
                const state = yield* encodeJson(entry.state);
                yield* sql`INSERT INTO ${sql(tables.viewEntry)} (model, view, key, seq, event, envelope, state)
                    VALUES (${modelName}, ${name}, ${key}, ${entry.seq}, ${event}::jsonb, ${envelope}::jsonb,
                      ${state}::jsonb)`;
              }),
              { discard: true }
            );
            const live = yield* Backfill.routeCommit(
              sourceRole(key),
              kit.targets,
              O.getOrUndefined(O.flatMap(current, ({ routed }) => O.fromNullOr(routed))),
              before.seq,
              result.snapshot.seq,
              result.downstream
            );
            const snapshot = yield* encodeJson(result.snapshot);
            const routed = yield* encodeJson(live.routed);
            yield* sql`INSERT INTO ${sql(tables.viewKey)} (model, view, key, snapshot, routed)
              VALUES (${modelName}, ${name}, ${key}, ${snapshot}::jsonb, ${routed}::jsonb)
              ON CONFLICT (model, view, key) DO UPDATE SET snapshot = EXCLUDED.snapshot, routed = EXCLUDED.routed`;
            yield* ctx.outbox(consumerId, live.send, at);
          }).pipe(orDie)
        )
        .pipe(kit.observe(key, deliveries));

    // As a consumer: buffers and merges history while a backfill runs.
    const consumer = ctx.consumerKeys({
      id: consumerId,
      target,
      lockOf,
      singleSource: kit.singleSource,
      history: kit.history,
      apply,
    });

    const tailFrom = (key: string) =>
      ctx.pollTail(
        (after) => entriesAfter(key, after, all),
        ({ seq }) => seq
      );

    // As a source: other views and projections read its entries.
    const sources = MutableHashMap.empty<string, Backfill.Source>();
    const sourceRole = (key: string): Backfill.Source =>
      O.getOrElse(MutableHashMap.get(sources, key), () => {
        const address = `source:${name}/${key}`;
        const role = Backfill.makeSource(
          ctx.storage(address, lockOf(key)),
          ctx.jobs(address),
          ctx.net,
          {
            ref: { source: name, id: key },
            model: () => ctx.plans.model,
            singleSource: (routeTarget) => ctx.plans.planOf(routeTarget)?.singleSource === true,
            log: (after, limit) => entriesAfter(key, after, limit),
            version: Effect.map(snapshotOf(key), ({ seq }) => seq),
            routed: Effect.map(keyRow(key), (row) =>
              O.getOrUndefined(O.flatMap(row, ({ routed }) => O.fromNullOr(routed)))
            ),
            markLive: Effect.fn("AlchemyPostgres.view.markLive")(function* (routeTarget: string) {
              const empty = yield* encodeJson(emptySnapshot);
              yield* sql`INSERT INTO ${sql(tables.viewKey)} (model, view, key, snapshot, routed)
                  VALUES (${modelName}, ${name}, ${key}, ${empty}::jsonb, NULL) ON CONFLICT DO NOTHING`;
              yield* sql`UPDATE ${sql(tables.viewKey)}
                  SET routed = COALESCE(routed, '{}'::jsonb)
                    || jsonb_build_object(${routeTarget}::text, (snapshot->>'seq')::int)
                  WHERE model = ${modelName} AND view = ${name} AND key = ${key}`;
            }, orDie),
          },
          ctx.limits
        );
        MutableHashMap.set(sources, key, role);
        return role;
      });

    // A key of a view keyed by its one aggregate reads its history from that
    // instance before it answers anything, the first time: when the view is
    // lazy, or rebuilt in place. After that, it is read like any other.
    const caughtUp = MutableHashSet.empty<string>();
    const ready = (key: string): Effect.Effect<void> =>
      Effect.suspend(() => {
        const catchUp = kit.catchUp;
        if (catchUp === undefined || MutableHashSet.has(caughtUp, key)) return Effect.void;
        const ref = { source: catchUp.source, id: key };
        return consumer(key)
          .start(target, ref, 5_000)
          .pipe(
            Effect.repeat({ until: (started) => started === "settled", times: 20 }),
            Effect.tap((started) =>
              Effect.sync(() => {
                if (started === "settled") MutableHashSet.add(caughtUp, key);
              })
            ),
            Effect.asVoid
          );
      });
    // Read as a source (by a view or projection catching up), a key has its
    // own history first: what reads it never sees a key still filling.
    MutableHashMap.set(ctx.sourceRoles, name, (key) => {
      const role = sourceRole(key);
      const first = ready(key);
      return {
        ...role,
        log: (after, limit) => Effect.andThen(first, role.log(after, limit)),
        cursor: (routeTarget) => Effect.andThen(first, role.cursor(routeTarget)),
        read: (routeTarget, at, after, limit) => Effect.andThen(first, role.read(routeTarget, at, after, limit)),
        handoff: (routeTarget, at, through) => Effect.andThen(first, role.handoff(routeTarget, at, through)),
      };
    });

    return {
      receive: Effect.fn("AlchemyPostgres.view.receive")(function* (
        key: string,
        deliveries: ReadonlyArray<DomainPlatform.Delivery>
      ) {
        // A key is listed as a source before it first applies anything.
        const existing = yield* keyRow(key);
        if (O.isNone(existing)) yield* ctx.register({ source: name, id: key });
        if (yield* consumer(key).admit(target, deliveries)) yield* apply(key, deliveries);
      }),
      read: (key) => ready(key).pipe(Effect.andThen(snapshotOf(key))),
      changes: (key) =>
        Stream.unwrap(
          ready(key).pipe(
            Effect.as(
              Stream.fromEffectSchedule(snapshotOf(key), Schedule.spaced(ctx.poll)).pipe(
                Stream.changesWith((left, right) => left.version === right.version && left.seq === right.seq)
              )
            )
          )
        ),
      list: (key) => ready(key).pipe(Effect.andThen(entriesAfter(key, 0, all))),
      tail: (key, after) => Stream.unwrap(ready(key).pipe(Effect.as(tailFrom(key)(after)))),
    } satisfies DomainPlatform.ViewStore;
  }).pipe(orDieAs("receive")(ctx.tables.viewKey));
