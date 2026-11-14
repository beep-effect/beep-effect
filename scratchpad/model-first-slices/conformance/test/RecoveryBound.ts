/**
 * The library's drain lease: an outbox or projection drain takes it before
 * delivering and holds it this long (`DurableObjects.ts`, `LEASE_MS`, not
 * exported). A drain killed with its runner leaves it held, and the rows it
 * was delivering wait for it to lapse. `RecoveryBound.test.ts` reads the
 * library source, so this cannot drift from it.
 *
 * **Example** (The lease in seconds)
 * ```ts
 * import { LEASE_MS } from "./RecoveryBound.ts";
 *
 * const seconds = LEASE_MS / 1000;
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LEASE_MS = 60_000;

/**
 * Effect Cluster's entity-message poll (`ShardingConfig`
 * `entityMessagePollInterval`, 10 s by default): how long a persisted
 * message, such as the wake a drain schedules for when the lease lapses,
 * can wait to be delivered.
 *
 * @category constants
 * @since 0.0.0
 */
export const ENTITY_MESSAGE_POLL_MS = 10_000;

/**
 * D42's recovery guarantee on the cluster: every reaction of a committed
 * command happens within one lease of a runner's death plus a wake allowance
 * of two message polls (one for the drain's wake, one for the reaction it
 * sends), measured from the kill.
 *
 * **Example** (The deadline of a case that kills at `killedAt`)
 * ```ts
 * import { RECOVERY_BOUND_MS } from "./RecoveryBound.ts";
 *
 * const deadline = (killedAt: number) => killedAt + RECOVERY_BOUND_MS;
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RECOVERY_BOUND_MS = LEASE_MS + 2 * ENTITY_MESSAGE_POLL_MS;

/**
 * Effect Cluster's lock refresh (`shardLockRefreshInterval`, 10 s): how long a runner that
 * resumes from a stall can take to find that its lock session has gone (phase 11, D49).
 *
 * @category constants
 * @since 0.0.0
 */
export const SHARD_LOCK_REFRESH_MS = 10_000;

/**
 * Effect Cluster's assignment refresh (`refreshAssignmentsInterval`, 3 s): how long a runner
 * takes to see the set of live runners change, and to try to take what it is assigned.
 *
 * @category constants
 * @since 0.0.0
 */
export const REFRESH_ASSIGNMENTS_MS = 3_000;

/**
 * Effect Cluster's entity termination (`entityTerminationTimeout`, 15 s): the longest a runner
 * keeps a shard it is giving up while that shard's entities stop.
 *
 * @category constants
 * @since 0.0.0
 */
export const ENTITY_TERMINATION_MS = 15_000;

/**
 * The longest gap between two retries of a call in transit (`TRANSIT_RETRY` in the library's
 * `DurableObjects.ts`: exponential from 100 ms, capped at 2 s, 35 times).
 *
 * @category constants
 * @since 0.0.0
 */
export const RETRY_SPACING_MS = 2_000;

/**
 * How long a caller keeps retrying a call in transit: `TRANSIT_RETRY`'s delays, 100, 200, 400,
 * 800 and 1,600 ms, then 2 s for the other 30 of its 35 retries.
 *
 * @category constants
 * @since 0.0.0
 */
export const TRANSIT_RETRY_BUDGET_MS = 100 + 200 + 400 + 800 + 1_600 + 30 * RETRY_SPACING_MS;

/**
 * D49's liveness bound: a write a fenced commit refused, on a runner that lost its shard while
 * stalled, lands exactly once within this long of the runner resuming. The resumed runner finds
 * its lock session gone at its next lock refresh; the current owner sees it live again at its
 * next assignment refresh and hands the shard back once the shard's entities stop; the resumed
 * runner takes the lock at its next assignment pass; the caller's next retry commits. A retry
 * that reaches the current owner first commits sooner. It is within the caller's retry budget.
 *
 * **Example** (The deadline of a write refused when its runner resumed at `resumedAt`)
 * ```ts
 * import { REFUSED_WRITE_BOUND_MS } from "./RecoveryBound.ts";
 *
 * const deadline = (resumedAt: number) => resumedAt + REFUSED_WRITE_BOUND_MS;
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const REFUSED_WRITE_BOUND_MS =
  SHARD_LOCK_REFRESH_MS + REFRESH_ASSIGNMENTS_MS + ENTITY_TERMINATION_MS + REFRESH_ASSIGNMENTS_MS + RETRY_SPACING_MS;

/**
 * What a cluster's attempts themselves add to the retry budget when a write is sent to a frozen
 * runner: 36 attempts, each failing in transit. An allowance, not derived; in process the attempts
 * take no time and the bound is the budget itself (phase 12, D55).
 *
 * @category constants
 * @since 0.0.0
 */
export const TRANSIT_ATTEMPT_ALLOWANCE_MS = 5_000;

/**
 * D55's bound on a cluster: a write sent to a frozen runner is answered, with its receipt or a
 * failure, within the caller's retry budget plus the attempts' own time.
 *
 * **Example** (The latest a write sent at `sentAt` to a frozen runner may be answered)
 * ```ts
 * import { FROZEN_WRITE_BOUND_MS } from "./RecoveryBound.ts";
 *
 * const deadline = (sentAt: number) => sentAt + FROZEN_WRITE_BOUND_MS;
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FROZEN_WRITE_BOUND_MS = TRANSIT_RETRY_BUDGET_MS + TRANSIT_ATTEMPT_ALLOWANCE_MS;
