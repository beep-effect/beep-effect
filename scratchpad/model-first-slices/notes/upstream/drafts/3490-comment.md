<!-- Draft comment for issue #3490. Not posted. The PR description that would carry the patches follows the comment, below the second rule. -->

We hit the same fault on 2.0.0-beta.87 and have a fix for it, in four parts. It ran on a two-runner Effect Cluster with PostgreSQL 17, on a single-node Docker swarm on one workstation: two runners and a front, with one runner frozen by `docker pause` inside a commit that was waiting on a row lock held from another session, until the other runner had taken its shard.

Your diagnosis matches what we found. A commit reads `meta`, decides, and then writes inside a transaction that never checks the version again. Each runner's input gate is local to its process. Nothing relates a commit to the shard lock. So both of the ideas you name are needed, and neither is enough alone:

- **A version check inside the commit transaction.** The transaction re-reads `meta` first and writes nothing when the version moved since `decide`. The call then fails with `CommitConflict`, and the caller's existing in-transit retry runs it again under the same command id. On Effect Cluster, each transaction first takes `pg_advisory_xact_lock(hashtextextended(<object>, 0))`, so two runners' transactions on one instance run one at a time and the check sees the other's commit. In two runs without the change, the frozen runner was acknowledged at version 2 and the other runner's event then replaced its own. With it, three runs lost no acknowledged write. But the frozen runner was still acknowledged in all three, because the check orders commits by transaction, not by ownership.
- **Naming the runner's Postgres pool.** The bootstrap builds the runner's pool with `applicationName: effect-cluster:<host>:<port>` (a hash when PostgreSQL would cut or change the name). The session Effect reserves for the shard locks then says which runner it belongs to. Without it, every session carries `@effect/sql-pg`. Behind the swarm's load balancer, every session also has the same client address. On the cluster the lock sessions were named per runner, and they kept the name when Effect rebuilt them.
- **A commit fence on the runner's own lock session.** First in the transaction, the commit finds the session named after this runner that holds the instance's shard lock. It records that session's pid in a transaction-local setting. A deferred constraint trigger on `meta` writes then checks at `COMMIT` that the same pid still holds the lock, and otherwise aborts with SQLSTATE `AD001`. Either refusal surfaces as `ShardLost`, which is retried like `CommitConflict`.
  - In six runs of the paused-inside-commit case, the frozen runner's commit was refused at `COMMIT` every time.
  - Every write the resumed runner had decided before it took its shard back was refused at the fence's first read.
  - Each refused write was then committed exactly once, by whichever runner's own session held the shard at the time. The last one landed 12.03 s after the unpause.
  - An earlier version of the fence matched sessions by client address. It acknowledged a stale write in three of five runs, because every session arrived from the load balancer's address.
- **Failing at start when the fence can never pass.** A runner without an address, or whose pool isn't named after it, would have every commit refused. It now fails at start with `RunnerPoolUnnamed`, which names the pool name it expects.

What we have not observed:

- The start check has run only in process (unit tests with Effect's own `ShardingConfig`), not on a cluster.
- The version check also refuses a commit on an instance that a decision holds (`meta.held`). This part is new: we added it when we rebased onto `main` after #3420, and it has run only in an in-process test, never on a cluster. Without it, a runner that lost the shard can commit to an instance a decision has held. In the in-process case this leaves an account at −100 after a withdrawal and a transfer of the same 100 both land.
- When the fence refuses a write inside the decision protocol (`hold`, `applyIntent`, `txPrepare`), nothing is written and the instances stay held. But the sender gets a defect, not a retried failure. In process, sending the same command id again to the owner finished the decision once. A later command to a held instance should carry it on too, since `whenFree` settles a held instance first; we read that path but did not run it with the fence. Whether the decision paths should map `ShardLost` to a retry, as `send` does, is your call.
- Only a `SwarmPool`, two runners, and a pause inside a commit. We have not tried a network partition, `kill -9` during a commit, more than two runners, or a connection pooler that rewrites `application_name`. Such a pooler would make every commit refused, which is the safe failure.
- Projection intake (your point 5) is not changed by this. With the fence, a stale runner can no longer commit the events that would feed it twice. We have not checked intake against two writers on its own.

If this direction is welcome, the change could go as one PR (description below), with in-memory tests under `packages/integration-tests/test/Domain/`. The Postgres side of the fence (the trigger and the `pg_locks` read) has no in-memory test. On the cluster it was checked with the swarm runs above; no CI test covers it.

---

**Title:** `fix(domain, effect-cluster): refuse a commit from a runner that lost its shard`

Fixes #3490.

On Effect Cluster, a runner that stalls past its shard lock keeps serving the instances it had while another runner takes the shard. Both can then commit to one instance: an acknowledged write is overwritten, or a stale runner is acknowledged after it lost the shard. This change refuses such a commit and retries it on the current owner.

- **Version check.** `commit` re-reads `meta` first in its transaction and writes nothing if the version moved since `decide` or a decision holds the instance. A moved version fails the call with `CommitConflict`, which the caller retries under the same command id. A held instance fails with `InstanceHeld`, which `whenFree` already settles and retries.

  ```ts
  const stored = yield* storedMeta;
  if (stored.version !== current.version || stored.held) return undefined;
  ```

- **Per-instance lock (Effect Cluster).** `objectStorage.transaction` takes `pg_advisory_xact_lock(hashtextextended(object, 0))` first, so transactions on one instance serialize across runners.
- **Named runner pool (`@alchemy.run/effect-cluster`).** `runnerPoolName(host, port)` gives `effect-cluster:<host>:<port>`, or `effect-cluster:#<fnv1a>` when PostgreSQL would cut or change the name. The runner bootstrap builds its pool with that `applicationName`, so the session holding the shard locks says which runner it is.
- **Commit fence (Effect Cluster).** Each transaction finds this runner's named session holding the instance's shard lock and records its pid in `alchemy.commit_fence`. A deferred constraint trigger on `meta` rows then checks at `COMMIT` that the same pid still holds the lock. A refusal is `ShardLost`, logged as `commit fenced: ...` and retried like `CommitConflict`. `migrate` creates the trigger, one runner at a time.
- **Start check.** `RunnerHost` carries the pool name, and `checkRunnerPool` fails a runner at start with `RunnerPoolUnnamed` when it has no address or its pool isn't named after it, since every commit it made would be refused.

Durable Objects, Rivet and the in-memory platform get the version check only; their storage already admits one instance at a time, so it always passes. On Effect Cluster each commit costs one `meta` read, one advisory lock and one `pg_locks` read.

In-memory tests: `CommitVersionCheck.test.ts` (two runners on one instance: a lost write, and a commit on a held instance), `CommitFence.test.ts` (a commit refused by a fencing host is retried on the owner), and `ClusterRunnerPool.test.ts` (pool names and the start check). The Postgres trigger and the `pg_locks` read have no test here; they were checked on a two-runner swarm.

Open question: in the decision protocol a fenced write surfaces as a defect to the sender rather than a retried failure. Nothing is recorded, the instances stay held, and a resend of the same command id finishes the decision on the owner. Should the decision paths map `ShardLost` the way `send` does?
