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
