import { expect } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import { TestClock } from "effect/testing";
import type * as SqlClient from "effect/sql/SqlClient";

/**
 * Waits for both identified PostgreSQL writers to block before a lock is released.
 *
 * **Details**
 * The caller retains the blocker transaction throughout this observation.
 * Polling refreshes its statistics snapshot and uses database time, with bounded
 * attempts and a live watchdog. This helper does not retry either writer.
 *
 * **Example** (Observe two writer connections)
 *
 * ```ts
 * import type * as SqlClient from "effect/sql/SqlClient"
 * import { expectBothWritersWaiting } from "./PostgresLock.test-kit.ts"
 *
 * const observe = (sql: SqlClient.SqlClient, firstPid: number, secondPid: number) =>
 *   expectBothWritersWaiting(sql, firstPid, secondPid)
 * ```
 *
 * @category Testing
 * @since 0.0.0
 */
export const expectBothWritersWaiting = Effect.fn("PostgresLock.expectBothWritersWaiting")(
  function* (sql: SqlClient.SqlClient, firstPid: number, secondPid: number) {
    let waiters: ReadonlyArray<{ readonly count: number }> = [];
    for (let poll = 0; poll < 250; poll++) {
      // This observer runs inside the blocking transaction. Refresh statistics
      // so each query can see writers that reached the lock since the last poll.
      yield* sql`SELECT pg_stat_clear_snapshot()`;
      waiters = yield* sql<{ readonly count: number }>`
        SELECT COUNT(*)::int AS count
        FROM pg_stat_activity
        WHERE pid IN (${firstPid}, ${secondPid})
          AND wait_event_type = 'Lock'
      `;
      if (A.some(waiters, (row) => row.count === 2)) break;
      yield* sql`SELECT pg_sleep(0.01)`;
    }
    expect(A.map(waiters, (row) => row.count)).toEqual([2]);
  },
  Effect.timeout("10 seconds"),
  TestClock.withLive
);
