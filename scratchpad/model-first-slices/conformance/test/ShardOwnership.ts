import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import { containersOf, docker, psql, runnerService } from "./Stack.ts";
import { thunk0 } from "@beep/utils"

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
  for (let i = value.length - 1; i >= 0; i--) h = (h * 33) ^ O.getOrElse(Str.charCodeAt(value, i), thunk0);
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

/**
 * The name of the session holding one shard's lock, if any (phase 11): since patch 6 a runner's
 * pool, and so its lock session, is named `effect-cluster:<host>:<port>` after the runner.
 */
export const holderNameOf = (shard: number) =>
  Effect.map(
    psql(
      `SELECT a.application_name FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid WHERE l.locktype = 'advisory' AND l.classid = ${lockNamespace} AND l.objid = ${lockOf(shard)} AND l.objsubid = 2 AND l.granted`,
    ),
    (out) => O.filter(O.some(Str.trim(out)), Str.isNonEmpty),
  );

/** Each session holding locks in the cluster's namespace: its name, and how many shards it holds. */
export const lockSessions = psql(
  `SELECT a.application_name, l.pid, count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid WHERE l.locktype = 'advisory' AND l.classid = ${lockNamespace} AND l.objsubid = 2 AND l.granted GROUP BY 1, 2 ORDER BY 1, 2`,
);

/** The name each running runner container's pool carries: `effect-cluster:` and the address it registered with. */
export const runnerNames = Effect.gen(function* () {
  const registered = yield* psql("SELECT address FROM cluster_runners");
  const addresses = A.filter(Str.split(registered, "\n"), Str.isNonEmpty);
  const ids = yield* containersOf(runnerService);
  return yield* Effect.forEach(ids, (id) =>
    Effect.map(docker("inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}", id), (out) => {
      const ips = A.filter(Str.split(out, " "), Str.isNonEmpty);
      const address = A.findFirst(addresses, (registeredAt) => A.some(ips, (ip) => pipe(registeredAt, Str.startsWith(`${ip}:`))));
      return { id, name: O.map(address, (at) => `effect-cluster:${at}`) };
    }),
    { concurrency: 1 },
  );
});

/** The runner containers whose log since `since` (ISO) has `line`. */
export const runnerLogging: {
  (since: string): (line: string) => ReturnType<typeof loggingOf>;
  (line: string, since: string): ReturnType<typeof loggingOf>;
} = dual(2, (line: string, since: string) => loggingOf(line, since));
const loggingOf = (line: string, since: string) =>
  Effect.flatMap(containersOf(runnerService), (ids) =>
    Effect.map(
      Effect.forEach(ids, (id) => Effect.map(docker("logs", "--since", since, id), (out) => (pipe(out, Str.includes(line)) ? [id] : [])), { concurrency: 1 }),
      A.flatten,
    ),
  );

/**
 * The health flags of the runners the cluster counts: those whose last heartbeat is inside the
 * shard lock's expiry (35 s, `ShardingConfig.shardLockExpiration`), which is how the cluster's own
 * storage reads the table. A killed runner's row stays, flagged healthy, until some runner
 * unregisters; nothing reads it once its heartbeat is that old.
 */
export const runnerHealth = psql(
  "SELECT address, healthy FROM cluster_runners WHERE last_heartbeat > now() - INTERVAL '35 seconds' ORDER BY address",
);
