/**
 * DuckDB persisted queue store with scoped claims, retries, and cleanup.
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
import { quotedString as quoteString } from "@duckdb/node-api";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { PersistedQueueError, PersistedQueueStore } from "effect/persistence/PersistedQueue";
import * as Queue from "effect/Queue";
import * as RcMap from "effect/RcMap";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Migrator from "effect/sql/Migrator";
import * as SqlClient from "effect/sql/SqlClient";
import { decodeJson, encodeJsonEffect, runMigrations } from "./internal/storage.ts";
import type * as Scope from "effect/Scope";
import type { SqlError } from "effect/sql/SqlError";
import type { Fragment } from "effect/sql/Statement";

const $I = $DuckdbId.create("DuckDbPersistedQueue.service");

// beep: Public Effect leaf imports and SQLite-only branches specialize the 4.0.6 service for DuckDB.
// beep: Schema JSON codecs replace throwing native JSON operations in upstream callbacks.

const sqlCleanupBatchSize = 1000;
type QueueState = {
  maxAttempts: number;
  readonly nudge: Latch.Latch;
};

// beep: Effect HashMap/HashSet replace upstream native collections without global state.
const makeQueueStates = (): {
  readonly peek: (name: string) => QueueState | undefined;
  readonly get: (name: string) => QueueState;
} => {
  let states = HashMap.empty<string, QueueState>();
  return {
    peek: (name) => O.getOrUndefined(HashMap.get(states, name)),
    get: (name) => {
      let state = O.getOrUndefined(HashMap.get(states, name));
      if (state === undefined) {
        // the placeholder is overwritten by take before any mailbox reads it,
        // and is kept int32-safe for SQL parameters
        state = { maxAttempts: 2147483647, nudge: Latch.makeUnsafe(false) };
        states = HashMap.set(states, name, state);
      }
      return state;
    },
  };
};

const makeAckRetrySchedule = (lockExpiration: Duration.Input) =>
  Schedule.min([Schedule.exponential(200, 1.5), Schedule.spaced(5000)]).pipe(
    Schedule.upTo({ duration: lockExpiration })
  );

// Internal signal used by the factory to tell a store that a taken element
// cannot ever be processed (its stored payload fails to decode) and must be
// dead-lettered instead of retried.
// beep: type-only — upstream `PersistedQueue.make` constructs dead letters; this store only matches them by tag.
interface DeadLetter {
  readonly _tag: "~effect/persistence/PersistedQueue/DeadLetter";
  readonly cause: Cause.Cause<unknown>;
}

const isDeadLetter = (u: unknown): u is DeadLetter => P.isTagged(u, "~effect/persistence/PersistedQueue/DeadLetter");

// stores only see a positive delay, so a zero or negative one is dropped here
const deadLetterFromCause = (cause: Cause.Cause<unknown>): DeadLetter | undefined => {
  for (const reason of cause.reasons) {
    if (Cause.isFailReason(reason) && isDeadLetter(reason.error)) {
      return reason.error;
    }
  }
  return undefined;
};

/**
 * Construct a DuckDB persisted queue store and migrate its tables.
 *
 * **Details**
 *
 * Requires Effect Crypto for claim UUIDs. Delayed offers use the live local
 * wall clock because DuckDB timestamp functions are transaction-stable.
 * The database and worker share the local clock in a DuckDB deployment.
 *
 * **Example** (Build a queue store layer)
 *
 * ```ts
 * import * as DuckDbPersistedQueue from "@beep/duckdb/DuckDbPersistedQueue"
 * const store = DuckDbPersistedQueue.layerStoreSql({ tableName: "jobs" })
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeStoreSql: (
  options?:
    | {
        readonly tableName?: string | undefined;
        readonly pollInterval?: Duration.Input | undefined;
        readonly lockRefreshInterval?: Duration.Input | undefined;
        readonly lockExpiration?: Duration.Input | undefined;
      }
    | undefined
) => Effect.Effect<
  PersistedQueueStore["Service"],
  SqlError,
  SqlClient.SqlClient | SecureRandom.SecureRandom | Scope.Scope
> = Effect.fnUntraced(function* (options) {
  const crypto = yield* SecureRandom.SecureRandom;
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const tableName = options?.tableName ?? "effect_queue";
  const tableNameSql = sql(tableName);
  const pollInterval = Duration.max(
    options?.pollInterval !== undefined ? Duration.fromInputUnsafe(options.pollInterval) : Duration.millis(1000),
    Duration.millis(1)
  );
  const lockRefreshInterval = Duration.max(
    options?.lockRefreshInterval !== undefined
      ? Duration.fromInputUnsafe(options.lockRefreshInterval)
      : Duration.seconds(30),
    Duration.millis(1)
  );
  const lockExpiration = Duration.max(
    options?.lockExpiration !== undefined ? Duration.fromInputUnsafe(options.lockExpiration) : Duration.minutes(2),
    Duration.millis(1)
  );
  const ackRetrySchedule = makeAckRetrySchedule(lockExpiration);

  yield* runMigrations({ loader: sqlMigrations(tableName), table: `${tableName}_migrations` });

  // beep: DuckDB timestamp functions are transaction-stable; delayed offers bind the offer-time clock below.
  const sqlNow = sql.literal("get_current_timestamp()");
  const secondsOffset = (seconds: number) => sql`${sqlNow} + INTERVAL '${sql.literal(seconds.toString())} seconds'`;
  const secondsAgo = (seconds: number) => secondsOffset(-Math.max(Math.ceil(seconds), 0));
  const secondsFromNow = (seconds: number) => secondsOffset(Math.max(Math.ceil(seconds), 0));
  // beep: DuckDB clocks are transaction-stable; bind a live offer-time TIMESTAMPTZ, independent of session time zone.
  const delayedVisibleAt = (delay: Duration.Duration, now: number) =>
    sql`make_timestamptz(CAST(${now + Math.ceil(Duration.toMillis(delay))} AS BIGINT) * 1000)`;
  const expiresAt = lockExpiration.pipe(Duration.toSeconds, secondsAgo);

  const offer = (id: string, name: string, element: string, visibleAt: Fragment) =>
    sql`
        INSERT OR IGNORE INTO ${tableNameSql} (id, queue_name, element, state, attempts, visible_at, created_at, updated_at)
        VALUES (${id}, ${name}, ${element}, 'pending', 0, ${visibleAt}, ${sqlNow}, ${sqlNow})
      `;

  const wrapString = (s: string) => `'${s}'`;
  const stringLiteral = (s: string) => sql.literal(wrapString(s));

  // Elements this store has claimed and not yet settled. Each poll claims its
  // rows under a fresh lock, so a settlement only matches the acquisition it
  // belongs to, even after the same store re-claims a lapsed row.
  let held = HashSet.empty<Element>();
  const refreshLocks: Effect.Effect<void, SqlError> = Effect.suspend((): Effect.Effect<void, SqlError> => {
    if (HashSet.size(held) === 0) return Effect.void;
    let sequences = HashSet.empty<number | string>();
    let locks = HashSet.empty<string>();
    for (const element of held) {
      sequences = HashSet.add(sequences, element.sequence);
      locks = HashSet.add(locks, wrapString(element.lock));
    }
    // A row only ever carries the lock of the poll that claimed it, so matching
    // every held sequence against every live lock renews just this store's own
    // claims while keeping the statement flat
    return sql`
      UPDATE ${tableNameSql}
      SET acquired_at = ${sqlNow}
      WHERE sequence IN (${sql.literal(A.join(A.map(A.fromIterable(sequences), String), ","))})
      AND acquired_by IN (${sql.literal(A.join(A.fromIterable(locks), ","))})
    `;
  });
  const ack = (statement: Effect.Effect<unknown, SqlError>, element: Element): Effect.Effect<void> =>
    statement.pipe(
      Effect.retry(ackRetrySchedule),
      Effect.orDie,
      Effect.ensuring(
        Effect.sync(() => {
          held = HashSet.remove(held, element);
        })
      ),
      Effect.asVoid
    );
  const complete = (element: Element) =>
    ack(
      sql`
        UPDATE ${tableNameSql}
        SET acquired_at = NULL, acquired_by = NULL, updated_at = ${sqlNow}, state = 'completed'
        WHERE sequence = ${element.sequence}
        AND acquired_by = ${stringLiteral(element.lock)}
      `,
      element
    );
  const fail = (element: Element, cause: Cause.Cause<unknown>) =>
    ack(
      sql`
        UPDATE ${tableNameSql}
        SET acquired_at = NULL, acquired_by = NULL, updated_at = ${sqlNow}, state = 'failed', last_failure = ${Cause.pretty(
          cause
        )}
        WHERE sequence = ${element.sequence}
        AND acquired_by = ${stringLiteral(element.lock)}
      `,
      element
    );
  const retry = (element: Element, delay: Duration.Duration, cause: Cause.Cause<unknown>) =>
    ack(
      sql`
        UPDATE ${tableNameSql}
        SET acquired_at = NULL, acquired_by = NULL, updated_at = ${sqlNow}, visible_at = ${delay.pipe(
          Duration.toSeconds,
          secondsFromNow
        )}, last_failure = ${Cause.pretty(cause)}
        WHERE sequence = ${element.sequence}
        AND acquired_by = ${stringLiteral(element.lock)}
      `,
      element
    );
  const interrupt = (element: Element) =>
    ack(
      sql`
        UPDATE ${tableNameSql}
        SET acquired_at = NULL, acquired_by = NULL, attempts = attempts - 1
        WHERE sequence = ${element.sequence}
        AND acquired_by = ${stringLiteral(element.lock)}
      `,
      element
    );

  yield* refreshLocks.pipe(
    Effect.tapCause(Effect.logWarning),
    Effect.retry(Schedule.spaced(500)),
    Effect.schedule(Schedule.fixed(lockRefreshInterval)),
    Effect.annotateLogs({
      package: "@effect/sql",
      module: "SqlPersistedQueue",
      fiber: "refreshLocks",
    }),
    Effect.forkScoped
  );

  // beep: SQL row shapes derive from annotated schemas.
  const Element = S.Struct({
    id: S.String,
    sequence: S.Union([S.Finite, S.String]),
    element: S.String,
    attempts: S.mutableKey(S.Finite),
    lock: S.mutableKey(S.String),
  }).pipe($I.annoteSchema("Element", { description: "DuckDB Element persisted row." }));
  type Element = typeof Element.Type;
  const queueStates = makeQueueStates();
  const mailboxes = yield* RcMap.make({
    lookup: Effect.fnUntraced(function* (name: string) {
      const state = queueStates.get(name);
      const maxAttempts = state.maxAttempts;
      const queue = yield* Queue.make<Element>();
      const takers = MutableRef.make(0);
      const pollLatch = Latch.makeUnsafe();
      const takenLatch = Latch.makeUnsafe();
      const nudge = state.nudge;

      yield* Effect.addFinalizer(() =>
        Effect.flatMap(Queue.clear(queue), (elements) =>
          Effect.forEach(elements, interrupt, { concurrency: "unbounded", discard: true })
        )
      );

      // flip exhausted rows whose lock expired (worker crashed on the final
      // attempt) to failed, since no finalizer will ever run for them
      yield* sql`
        UPDATE ${tableNameSql}
        SET state = 'failed', acquired_at = NULL, acquired_by = NULL, updated_at = ${sqlNow},
          last_failure = COALESCE(last_failure, 'Lock expired after final attempt')
        WHERE queue_name = ${name}
        AND state = 'pending'
        AND attempts >= ${maxAttempts}
        AND (acquired_at IS NULL OR acquired_at < ${expiresAt})
      `.pipe(
        Effect.tapCause(Effect.logWarning),
        Effect.ignore,
        Effect.schedule(Schedule.spaced(lockRefreshInterval)),
        Effect.forkScoped,
        Effect.interruptible
      );

      const poll = (size: number, lockSql: Fragment) =>
        sql<Element>`
            UPDATE ${tableNameSql}
            SET acquired_at = ${sqlNow}, acquired_by = ${lockSql}, attempts = attempts + 1
            WHERE sequence IN (
              SELECT sequence FROM ${tableNameSql}
              WHERE queue_name = ${name}
              AND state = 'pending'
              AND attempts < ${maxAttempts}
              AND visible_at <= ${sqlNow}
              AND (acquired_at IS NULL OR acquired_at < ${expiresAt})
              ORDER BY visible_at ASC, sequence ASC
              LIMIT ${sql.literal(size.toString())}
            )
            RETURNING sequence, id, element, attempts
          `;

      yield* Effect.gen(function* () {
        while (true) {
          yield* pollLatch.await;
          yield* Effect.yieldNow;
          nudge.closeUnsafe();
          const lock = yield* crypto.uuidV4();
          // beep: no zero-takers short-circuit; a taker leaving mid-iteration polls `LIMIT 0`, which returns no rows.
          const results = yield* poll(takers.current, stringLiteral(lock));
          if (results.length === 0) {
            yield* Effect.race(Effect.sleep(pollInterval), nudge.await);
            continue;
          }
          takenLatch.closeUnsafe();
          for (const row of results) {
            row.attempts = Number(row.attempts);
            row.lock = lock;
            held = HashSet.add(held, row);
          }
          yield* Queue.offerAll(queue, results);
          yield* takenLatch.await;
          yield* Effect.yieldNow;
        }
      }).pipe(
        Effect.tapCause(Effect.logWarning),
        Effect.sandbox,
        Effect.retry(Schedule.spaced(500)),
        Effect.forkScoped
      );

      return { queue, takers, pollLatch, takenLatch } as const;
    }),
    idleTimeToLive: Duration.seconds(30),
  });

  const cleanupBatch = (state: string, seconds: number) =>
    sql<{ readonly deleted: number }>`
        DELETE FROM ${tableNameSql}
        WHERE sequence IN (
          SELECT sequence FROM ${tableNameSql}
          WHERE state = ${state} AND updated_at <= ${secondsAgo(seconds)}
          LIMIT ${sql.literal(String(sqlCleanupBatchSize))}
        )
        RETURNING 1 AS deleted
      `.pipe(Effect.map((rows) => rows.length));

  const cleanupState = (state: string, timeToLive: Duration.Duration) =>
    cleanupBatch(state, Duration.toSeconds(timeToLive)).pipe(
      Effect.repeat({
        while: (deletedCount) => deletedCount === sqlCleanupBatchSize,
        schedule: Schedule.spaced(Duration.millis(10)),
      })
    );

  return PersistedQueueStore.of({
    offer: Effect.fn("DuckDbPersistedQueue.offer")(({ delay, element, id, name }) =>
      Effect.catchCause(
        Effect.gen(function* () {
          const now = yield* Clock.Clock.defaultValue().currentTimeMillis;
          return yield* offer(
            id,
            name,
            yield* encodeJsonEffect(element),
            delay === undefined ? sqlNow : delayedVisibleAt(delay, now)
          );
        }),
        (cause) =>
          Effect.fail(
            PersistedQueueError.make({
              message: "Failed to offer element to persisted queue",
              cause,
            })
          )
      ).pipe(
        // Wake takers once the offer is committed.
        Effect.tap(() =>
          sql.afterCommit(
            Effect.sync(() => {
              queueStates.peek(name)?.nudge.openUnsafe();
            })
          )
        )
      )
    ),
    take: Effect.fn("DuckDbPersistedQueue.take")((options) => {
      queueStates.get(options.name).maxAttempts = options.maxAttempts;
      const loop: Effect.Effect<
        {
          readonly id: string;
          readonly attempts: number;
          readonly element: unknown;
        },
        PersistedQueueError,
        Scope.Scope
      > = Effect.uninterruptibleMask((restore) =>
        RcMap.get(mailboxes, options.name).pipe(
          Effect.flatMap(({ pollLatch, queue, takenLatch, takers }) => {
            takers.current++;
            if (takers.current === 1) {
              pollLatch.openUnsafe();
            }
            // onExit so the decrement also runs when a waiting take is
            // interrupted, otherwise the poller keeps fetching for a phantom
            // taker
            return Effect.onExit(restore(Queue.take(queue)), () =>
              Effect.sync(() => {
                takers.current--;
                if (takers.current === 0) {
                  pollLatch.closeUnsafe();
                  takenLatch.openUnsafe();
                } else if (Queue.sizeUnsafe(queue) === 0) {
                  takenLatch.openUnsafe();
                }
              })
            );
          }),
          Effect.scoped,
          restore,
          Effect.flatMap((element) => {
            let parsed: unknown;
            try {
              parsed = decodeJson(element.element);
            } catch (defect) {
              // a row that cannot be parsed will never succeed, so dead-letter
              // it and take the next element
              // beep: restore so the next take stays interruptible instead of inheriting this mask (#2306 review).
              return Effect.andThen(fail(element, Cause.die(defect)), restore(loop));
            }
            return Effect.as(
              Effect.addFinalizer((exit) => {
                if (exit._tag === "Success") {
                  return complete(element);
                }
                const dead = deadLetterFromCause(exit.cause);
                if (dead !== undefined) {
                  return fail(element, dead.cause);
                }
                if (Cause.hasInterruptsOnly(exit.cause)) {
                  return interrupt(element);
                }
                if (element.attempts >= options.maxAttempts) {
                  return fail(element, exit.cause);
                }
                return Effect.flatMap(options.retryDelay(element.attempts), (delay) =>
                  retry(element, delay, exit.cause)
                );
              }),
              { id: element.id, attempts: element.attempts, element: parsed }
            );
          })
        )
      );
      return loop;
    }),
    cleanup: Effect.fnUntraced(
      function* ({ failedTimeToLive, timeToLive }) {
        yield* cleanupState("completed", timeToLive);
        if (failedTimeToLive !== undefined) {
          yield* cleanupState("failed", failedTimeToLive);
        }
      },
      Effect.catchCause((cause) =>
        Effect.fail(
          PersistedQueueError.make({
            message: "Failed to clean up persisted queue",
            cause,
          })
        )
      )
    ),
  });
});

// beep: DuckDB starts at the current schema; sequence identity and full indexes replace SQLite rebuilds/partial indexes.
const sqlMigrations = (tableName: string) =>
  Migrator.fromRecord({
    "0001_create_table": Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms();
      const table = sql(tableName);
      yield* sql`CREATE SEQUENCE IF NOT EXISTS ${sql(`${tableName}_sequence`)}`;
      yield* sql`CREATE TABLE IF NOT EXISTS ${table} (
 sequence BIGINT PRIMARY KEY DEFAULT nextval(${sql.literal(quoteString(sql`${sql(`${tableName}_sequence`)}`.compile()[0]))}),
 id TEXT NOT NULL, queue_name TEXT NOT NULL, element TEXT NOT NULL, state TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, last_failure TEXT, visible_at TIMESTAMPTZ NOT NULL,
 acquired_at TIMESTAMPTZ, acquired_by TEXT, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL)`;
      yield* sql`CREATE UNIQUE INDEX IF NOT EXISTS ${sql(`idx_${tableName}_id`)} ON ${table} (id, queue_name)`;
      yield* sql`CREATE INDEX IF NOT EXISTS ${sql(`idx_${tableName}_take`)} ON ${table} (queue_name, state, visible_at)`;
      yield* sql`CREATE INDEX IF NOT EXISTS ${sql(`idx_${tableName}_update`)} ON ${table} (sequence, acquired_by)`;
    }),
  });
/**
 * DuckDbPersistedQueue layer.
 *
 * **Example** (Compose DuckDB storage)
 *
 * ```ts
 * import * as Storage from "@beep/duckdb/DuckDbPersistedQueue"
 * const storage = Storage.layerStoreSql()
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerStoreSql: (
  options?:
    | {
        readonly tableName?: string | undefined;
        readonly pollInterval?: Duration.Input | undefined;
        readonly lockRefreshInterval?: Duration.Input | undefined;
        readonly lockExpiration?: Duration.Input | undefined;
      }
    | undefined
) => Layer.Layer<PersistedQueueStore, SqlError, SqlClient.SqlClient | SecureRandom.SecureRandom> = flow(
  makeStoreSql,
  Layer.effect(PersistedQueueStore)
);
