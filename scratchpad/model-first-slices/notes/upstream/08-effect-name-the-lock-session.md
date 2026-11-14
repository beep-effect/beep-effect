# Proposal for Effect: name the session that holds a runner's shard locks

A proposal for Effect (`effect` 4.1.4, `packages/effect/src/cluster/SqlRunnerStorage.ts`),
not a patch: the prototype carries no patch to Effect. Not filed (D48). It is the
smallest change that makes the commit fence (`07-commit-fenced-on-shard-ownership.patch`)
exact.

## What a commit can see today

On PostgreSQL, `SqlRunnerStorage` holds every shard of a runner as a session-level advisory
lock, `pg_try_advisory_lock(namespace, (groupIndex + 1) * 1000000 + shard)`, on one reserved
connection (`acquireLockConn`). It already sets that session's `idle_session_timeout` to
`shardLockExpiration`, so a frozen runner's session ends and its locks go.

Another connection can read who holds a shard: `pg_locks` gives the holding backend's `pid`.
What it cannot read is whose session that is. `LockSession.pid` is private to the storage;
the session's `application_name` is the client's default (`@effect/sql-pg`), the same for
every runner; and `client_addr` is not a runner's either when connections pass a proxy or a
load balancer. On a Docker swarm overlay, every session of every runner arrives from the
network's load-balancer address.

So a library that commits on its own connection (Alchemy's domain storage does) can check
that the shard's lock did not change hands during its transaction, but not that its runner
held it when the transaction began. Phase 10 showed the difference: a write queued to a paused
runner was decided and committed by it after its shard had moved, because the fence took the
new owner's session for its own (`notes/phase-10.md`, P7b attempt 2).

## The change

In `acquireLockConn`, PostgreSQL branch, name the lock session after the runner in the same
statement that sets its timeout:

```sql
SELECT pg_backend_pid(),
  (SELECT set_config(name, '<idle timeout>', false) FROM pg_settings WHERE name = 'idle_session_timeout'),
  set_config('application_name', 'effect-cluster:<runner address>', false)
```

The runner address is `ShardingConfig.runnerAddress` (`host:port`). Restore it in the
finalizer, as the timeout already is (`reset_val`). MySQL needs nothing: its locks already
belong to the connection the storage pins.

Then any connection of the runner can establish that it holds a shard:

```sql
SELECT l.pid FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.locktype = 'advisory' AND l.classid = <namespace> AND l.objid = <lock> AND l.objsubid = 2
  AND l.granted AND a.application_name = 'effect-cluster:<runner address>'
```

## Why it is safe

- `application_name` is informational to PostgreSQL; nothing in the storage reads it.
- One extra function call in a statement the storage already runs once per lock session.
- Operators gain a way to tell runners apart in `pg_stat_activity`.

An alternative with the same effect: expose the lock session's pid on `RunnerStorage` (for
example `lockSession: Effect<{ readonly pid: number }>`), or a check that a shard's lock is
held by this runner's session, run on the lock connection. Naming the session needs no new
API and works from any connection.

## Tests it needs

- With two runners, every shard lock in `pg_locks` is held by a session named after the
  runner that acquired it, and the name survives a rebuild of the lock connection.
- With the domain's fence (patch 07), the phase 10 paused-runner case refuses the write queued
  to the paused runner as well as its paused commit.
