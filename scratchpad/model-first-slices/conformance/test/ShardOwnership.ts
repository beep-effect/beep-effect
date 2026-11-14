import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { containersOf, docker, psql, runnerService } from "./Stack.ts";

// Phase 10 (D45): who owns a shard on the stack, read the way Effect Cluster 4.1.4 records it. Its
// SQL runner storage holds each shard as a session-level PostgreSQL advisory lock,
// `pg_try_advisory_lock(namespace, (groupIndex + 1) * 1000000 + shard)`, on one reserved
// connection per runner (`effect/src/cluster/SqlRunnerStorage.ts`); an entity's shard is
// `abs(hashString(entityId) % shardsPerGroup) + 1` (`Sharding.ts`, `getShardId`), 300 shards by
// default. Here the pool serves one group, `alchemy:default` (the deploy sets
// `CLUSTER_SHARD_GROUPS`), so its shards are lock keys 1000001 to 1000300. A shard moves once its
// runner's heartbeat in `cluster_runners` is older than the lock expiry (`getRunners` lists only
// runners heard from within `shardLockExpiration`) and its lock session has ended.

/**
 * Effect Cluster's shard hash (`effect/src/cluster/internal/hash.ts`, `hashString`, internal):
 * changing it changes every entity's shard, so it is copied here exactly.
 */
const hashString = (value: string): number => {
  let h = 5381;
  for (let i = value.length - 1; i >= 0; i--) h = (h * 33) ^ O.getOrElse(Str.charCodeAt(value, i), () => 0);
  return (h & 0xbfffffff) | ((h >>> 1) & 0x40000000);
};

/** The shard of an entity id in a group of 300 shards. */
export const shardOf = (entityId: string): number => Math.abs(hashString(entityId) % 300) + 1;

/** The lock key of a shard of the pool's group, the first (and here only) available group. */
export const lockOf = (shard: number): number => 1_000_000 + shard;

/** The lock namespace of the runner storage's default table prefix, as `pg_locks` shows it. */
export const lockNamespace = (() => {
  const bytes = new TextEncoder().encode("effect-cluster:cluster");
  let hash = 0x811c9dc5;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193);
  return (hash | 0) >>> 0;
})();

/** The entity id a two-runners slot has on the cluster. */
export const slotEntity = (slot: string) => `TwoRunners.SlotAggregate/${slot}`;

/**
 * Which session holds each shard lock now, by lock key: the holder's backend pid. Every session
 * reaches Postgres through the stack network's load-balancer address with the same application
 * name, so a session cannot be told apart by address; a change of pid is a change of holder.
 */
export const shardHolders = Effect.map(
  psql(
    `SELECT l.objid, l.pid FROM pg_locks l WHERE l.locktype = 'advisory' AND l.classid = ${lockNamespace} AND l.objsubid = 2 AND l.granted`,
  ),
  (out) =>
    HashMap.fromIterable(
      A.getSomes(
        A.map(A.filter(Str.split(out, "\n"), Str.isNonEmpty), (line) => {
          const [lock, pid] = Str.split(line, "|");
          return lock === undefined || pid === undefined ? O.none() : O.some([Number(lock), pid] as const);
        }),
      ),
    ),
);

/** The session holding one shard's lock, if any. */
export const holderOf = (shard: number) => Effect.map(shardHolders, HashMap.get(lockOf(shard)));

/** The runner containers whose log since `since` (ISO) has `line`. */
export const runnerLogging: {
  (since: string): (line: string) => ReturnType<typeof loggingOf>;
  (line: string, since: string): ReturnType<typeof loggingOf>;
} = dual(2, (line: string, since: string) => loggingOf(line, since));
const loggingOf = (line: string, since: string) =>
  Effect.flatMap(containersOf(runnerService), (ids) =>
    Effect.map(
      Effect.forEach(ids, (id) => Effect.map(docker("logs", "--since", since, id), (out) => (pipe(out, Str.includes(line)) ? [id] : []))),
      A.flatten,
    ),
  );

/** The runners table's health flags. */
export const runnerHealth = psql("SELECT address, healthy FROM cluster_runners ORDER BY address");

/** Sessions waiting on a lock, with what they run. */
export const lockWaiters = psql(
  "SELECT a.pid, left(a.query, 80) FROM pg_stat_activity a WHERE a.wait_event_type = 'Lock' AND a.datname = 'cluster'",
);

/** A runner's log lines since `since` (ISO) where the commit fence refused a commit (patch 4). */
export const fenceRefusals: {
  (since: string): (container: string) => ReturnType<typeof refusalsOf>;
  (container: string, since: string): ReturnType<typeof refusalsOf>;
} = dual(2, (container: string, since: string) => refusalsOf(container, since));
const refusalsOf = (container: string, since: string) =>
  Effect.map(docker("logs", "--since", since, container), (out) =>
    A.filter(Str.split(out, "\n"), (line) => pipe(line, Str.includes("commit fenced"))),
  );
